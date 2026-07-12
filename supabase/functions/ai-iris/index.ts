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
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const payload = {
    model,
    max_tokens: Math.min(body.max_tokens ?? 1024, 4096),
    system: body.system,
    messages: body.messages ?? [],
    tools: body.tools,
    tool_choice: body.tool_choice,
    stream: body.stream !== false,
  };

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
