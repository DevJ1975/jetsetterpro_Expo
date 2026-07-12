import {
  AssistantTurn,
  ChatMessage,
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

/** Run a full IRIS exchange: stream assistant turns and service tool calls until
 *  the model stops requesting tools. Returns the extended message list. */
export async function runIrisConversation(params: {
  system: string;
  messages: ChatMessage[];
  tools: ToolSchema[];
  executeTool: ToolExecutor;
  onText?: (delta: string) => void;
  onTurn?: (turn: AssistantTurn) => void;
  maxToolRounds?: number;
  signal?: AbortSignal;
}): Promise<ChatMessage[]> {
  const convo: ChatMessage[] = [...params.messages];
  const maxRounds = params.maxToolRounds ?? 5;

  for (let round = 0; round <= maxRounds; round++) {
    const turn = await streamAssistantTurn({
      system: params.system,
      messages: convo,
      tools: params.tools,
      onText: params.onText,
      signal: params.signal,
    });

    convo.push({ role: 'assistant', content: turn.content });
    params.onTurn?.(turn);

    const toolUses = turn.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    if (turn.stopReason !== 'tool_use' || toolUses.length === 0) break;

    const results: ToolResultBlock[] = [];
    for (const tu of toolUses) {
      try {
        const r = await params.executeTool(tu.name, tu.input);
        results.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: r.content,
          is_error: r.isError,
        });
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

  return convo;
}
