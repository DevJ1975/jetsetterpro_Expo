import {
  AssistantTurn,
  ChatMessage,
  TextBlock,
  ToolResultBlock,
  ToolSchema,
  ToolUseBlock,
  streamAssistantTurn,
} from './anthropic';

export interface AgentToolResult {
  content: string;
  isError?: boolean;
}

// Executes a tool call. READ tools run immediately and return real data. STAGED
// WRITE tools (confirm-before-commit) DO NOT mutate here — they park a pending
// action for the UI's confirmation card and return a "prepared, awaiting
// confirmation" string, so the model reports the staged action to the user and
// nothing is committed until the user taps Approve.
export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<AgentToolResult>;

export interface AgentResult {
  messages: ChatMessage[];
  finalText: string;
}

function assistantText(text: string): [TextBlock] {
  // Anthropic rejects an assistant message with an empty content array or an
  // empty text block, so always synthesize at least a placeholder.
  return [{ type: 'text', text: text.trim() ? text : '…' }];
}

/** Run a full IRIS exchange: stream assistant turns and service tool calls until
 *  the model stops requesting tools. Guarantees the returned transcript always
 *  ends on a valid (non-empty) assistant message so the next turn's request
 *  stays role-alternating and Anthropic-valid. `finalText` is the LAST turn's
 *  text only (not concatenated across tool rounds). */
export async function runIrisConversation(params: {
  system: string;
  messages: ChatMessage[];
  tools: ToolSchema[];
  executeTool: ToolExecutor;
  onTurnStart?: () => void;
  onText?: (delta: string) => void;
  onTurn?: (turn: AssistantTurn) => void;
  maxToolRounds?: number;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const convo: ChatMessage[] = [...params.messages];
  const maxRounds = params.maxToolRounds ?? 5;

  for (let round = 0; round <= maxRounds; round++) {
    params.onTurnStart?.();
    const turn = await streamAssistantTurn({
      system: params.system,
      messages: convo,
      tools: params.tools,
      onText: params.onText,
      signal: params.signal,
    });
    params.onTurn?.(turn);

    const toolUses = turn.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    const wantsTools = turn.stopReason === 'tool_use' && toolUses.length > 0;

    // Push the assistant turn (never an empty content array).
    convo.push({
      role: 'assistant',
      content: turn.content.length > 0 ? turn.content : assistantText(turn.text),
    });

    if (!wantsTools) {
      return { messages: convo, finalText: turn.text };
    }

    // Service the tool calls and feed the results back.
    const results: ToolResultBlock[] = [];
    for (const tu of toolUses) {
      try {
        const r = await params.executeTool(tu.name, tu.input);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content, is_error: r.isError });
      } catch (e) {
        results.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: `Error running ${tu.name}: ${String(e)}`,
          is_error: true,
        });
      }
    }
    convo.push({ role: 'user', content: results });
  }

  // Rounds exhausted while the model still wanted tools — force one final answer
  // WITHOUT tools so the transcript ends on an assistant turn (never a dangling
  // tool_result, which would make the next request send two consecutive user turns).
  params.onTurnStart?.();
  const finalTurn = await streamAssistantTurn({
    system: params.system,
    messages: convo,
    tools: undefined,
    onText: params.onText,
    signal: params.signal,
  });
  params.onTurn?.(finalTurn);
  const finalText = finalTurn.text.trim()
    ? finalTurn.text
    : 'I hit my tool limit for this request — could you narrow it down a bit?';
  convo.push({
    role: 'assistant',
    content: finalTurn.content.length > 0 ? finalTurn.content : assistantText(finalText),
  });
  return { messages: convo, finalText };
}
