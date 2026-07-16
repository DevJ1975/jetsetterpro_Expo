import { boundedHistory } from '@/src/core/ai/history';
import type { ChatMessage } from '@/src/core/ai/anthropic';

// boundedHistory keeps a long IRIS chat under aiIris's 60-message cap by cutting
// only at clean user turns (string content), never orphaning a tool_result.

const userTurn = (t: string): ChatMessage => ({ role: 'user', content: t });
const assistantTurn = (t: string): ChatMessage => ({ role: 'assistant', content: t });
const toolResultTurn = (): ChatMessage => ({
  role: 'user',
  content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] as never,
});
const assistantToolUse = (): ChatMessage => ({
  role: 'assistant',
  content: [{ type: 'tool_use', id: 'x', name: 't', input: {} }] as never,
});

describe('boundedHistory', () => {
  it('returns short histories unchanged', () => {
    const msgs = [userTurn('hi'), assistantTurn('hello')];
    expect(boundedHistory(msgs, 40)).toBe(msgs);
  });

  it('trims to the earliest clean user start that fits under the cap', () => {
    // 10 simple exchanges = 20 messages; cap 6 → keep the last 3 exchanges.
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(userTurn(`q${i}`), assistantTurn(`a${i}`));
    }
    const out = boundedHistory(msgs, 6);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out[0].role).toBe('user');
    expect(typeof out[0].content).toBe('string');
    // Newest turn is preserved.
    expect(out[out.length - 1]).toEqual(assistantTurn('a9'));
  });

  it('never cuts so the transcript starts on a tool_result (orphaning a tool_use)', () => {
    // A turn with a tool round: user → assistant(tool_use) → user(tool_result) → assistant.
    const msgs: ChatMessage[] = [
      userTurn('old1'),
      assistantTurn('old1a'),
      userTurn('book something'),
      assistantToolUse(),
      toolResultTurn(),
      assistantTurn('done'),
      userTurn('thanks'),
      assistantTurn('welcome'),
    ];
    const out = boundedHistory(msgs, 5);
    // Must start on a clean (string-content) user turn, not the tool_result.
    expect(out[0].role).toBe('user');
    expect(typeof out[0].content).toBe('string');
    // The tool_result is never the first kept message.
    expect(Array.isArray(out[0].content)).toBe(false);
  });

  it('falls back to the last clean start when even one turn exceeds the cap', () => {
    const msgs: ChatMessage[] = [
      userTurn('first'),
      assistantTurn('a'),
      userTurn('megaturn'),
      assistantToolUse(),
      toolResultTurn(),
      assistantToolUse(),
      toolResultTurn(),
      assistantTurn('final'),
    ];
    const out = boundedHistory(msgs, 3);
    expect(out[0]).toEqual(userTurn('megaturn')); // last clean start
  });
});
