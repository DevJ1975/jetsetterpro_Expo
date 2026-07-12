import { fetch as expoFetch } from 'expo/fetch';
import { env, isSupabaseConfigured } from '@/src/core/env';
import { supabase } from '@/src/core/supabase/client';

// Streaming client for the `ai-iris` Edge Function (which proxies the Anthropic
// Messages API and holds the key). `expo/fetch` gives us a real streaming body
// on iOS + Android so we can render Claude's SSE token-by-token.

export const IRIS_MODEL = 'claude-sonnet-5';

// ── Anthropic Messages types (subset we use) ─────────────────────────────────

export interface TextBlock {
  type: 'text';
  text: string;
}
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AssistantTurn {
  content: (TextBlock | ToolUseBlock)[];
  stopReason: string | null;
  text: string;
}

export class AIUnavailableError extends Error {
  constructor(message = 'IRIS is unavailable') {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

function functionUrl(): string {
  return `${env.supabaseUrl}/functions/v1/ai-iris`;
}

/** Stream one assistant turn. Calls `onText` with each text delta; resolves with
 *  the fully-assembled turn (text + any tool_use blocks). */
export async function streamAssistantTurn(params: {
  system: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  maxTokens?: number;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<AssistantTurn> {
  if (!isSupabaseConfigured()) throw new AIUnavailableError('Backend not configured');

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? env.supabaseAnonKey;

  const resp = await expoFetch(functionUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IRIS_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!resp.ok || !resp.body) {
    throw new AIUnavailableError(`ai-iris ${resp.status}`);
  }

  // Assemble content blocks from the SSE event stream.
  const blocks: (TextBlock | ToolUseBlock)[] = [];
  const toolJson: Record<number, string> = {};
  let stopReason: string | null = null;
  let text = '';

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (raw: string) => {
    const dataLines = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join('');
    if (!payload || payload === '[DONE]') return;

    let evt: any;
    try {
      evt = JSON.parse(payload);
    } catch {
      return;
    }

    switch (evt.type) {
      case 'content_block_start': {
        const block = evt.content_block;
        if (block?.type === 'text') blocks[evt.index] = { type: 'text', text: '' };
        else if (block?.type === 'tool_use') {
          blocks[evt.index] = { type: 'tool_use', id: block.id, name: block.name, input: {} };
          toolJson[evt.index] = '';
        }
        break;
      }
      case 'content_block_delta': {
        const d = evt.delta;
        const b = blocks[evt.index];
        if (d?.type === 'text_delta' && b?.type === 'text') {
          b.text += d.text;
          text += d.text;
          params.onText?.(d.text);
        } else if (d?.type === 'input_json_delta') {
          toolJson[evt.index] = (toolJson[evt.index] ?? '') + (d.partial_json ?? '');
        }
        break;
      }
      case 'content_block_stop': {
        const b = blocks[evt.index];
        if (b?.type === 'tool_use') {
          try {
            b.input = toolJson[evt.index] ? JSON.parse(toolJson[evt.index]) : {};
          } catch {
            b.input = {};
          }
        }
        break;
      }
      case 'message_delta': {
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        break;
      }
      default:
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    // SSE events are separated by a blank line.
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      handleEvent(chunk);
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  return { content: blocks.filter(Boolean), stopReason, text };
}
