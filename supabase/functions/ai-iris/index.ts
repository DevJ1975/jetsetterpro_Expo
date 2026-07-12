// IRIS AI proxy — a thin, secure streaming bridge to the Anthropic Messages API.
//
// The ANTHROPIC_API_KEY lives ONLY here (never in the RN bundle). The client
// owns the system prompt, the tool catalog, and the agentic tool-execution loop
// (mirroring the iOS app, where the app — not the model host — owns the tools);
// this function just verifies the caller is an authenticated Supabase user and
// pipes the SSE stream (or JSON) straight through.
//
// Deploy:  supabase functions deploy ai-iris
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ALLOWED_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
]);
const DEFAULT_MODEL = 'claude-sonnet-5';

// Request-shape bounds (defense against cost abuse / oversized payloads).
const MAX_MESSAGES = 60;
const MAX_BODY_BYTES = 256 * 1024;
const MIN_TOKENS = 64;
const MAX_TOKENS = 4096;

// Best-effort per-user rate limit. NOTE: in-memory state is per-isolate and not
// durable across Edge instances — a Postgres/Upstash-backed limiter is the
// follow-up for hard guarantees. This still throttles a hot loop within an isolate.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();
function rateLimited(userId: string, now: number): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore — Deno global provided by the Edge runtime.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // @ts-ignore — Deno global.
  const env = (k: string) => Deno.env.get(k);
  const supabaseUrl = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'server_misconfigured' }, 500);
  if (!apiKey) return json({ error: 'ai_unconfigured' }, 503);

  // Require an authenticated Supabase user (anonymous users are allowed).
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const now = Date.now();
  if (rateLimited(user.id, now)) return json({ error: 'rate_limited' }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);

  let body: {
    model?: string;
    max_tokens?: number;
    system?: unknown;
    messages?: unknown[];
    tools?: unknown;
    tool_choice?: unknown;
    stream?: boolean;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages_required' }, 400);
  }
  if (body.messages.length > MAX_MESSAGES) return json({ error: 'too_many_messages' }, 400);

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const maxTokens = Math.max(
    MIN_TOKENS,
    Math.min(MAX_TOKENS, typeof body.max_tokens === 'number' ? body.max_tokens : 1024),
  );
  const payload = {
    model,
    max_tokens: maxTokens,
    system: body.system,
    messages: body.messages,
    tools: body.tools,
    tool_choice: body.tool_choice,
    stream: body.stream !== false,
  };

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Controlled failure with CORS headers (never surface upstream internals).
    return json({ error: 'ai_upstream_error' }, 502);
  }

  // Pass the upstream body (SSE stream when streaming, JSON otherwise) through.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
});
