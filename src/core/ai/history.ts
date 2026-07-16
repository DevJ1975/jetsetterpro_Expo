import type { ChatMessage } from '@/src/core/ai/anthropic';

// The aiIris Cloud Function rejects transcripts longer than MAX_MESSAGES (60),
// so a long-lived IRIS chat would eventually 400. `boundedHistory` drops the
// oldest exchanges to stay under the cap — but only ever cuts at a "clean" user
// turn (a real message with string content, never a tool_result array), so the
// kept transcript always starts with a user turn and never orphans a
// tool_result from the tool_use that produced it (both of which Anthropic
// rejects).

/** Trim old exchanges so the transcript stays under `maxMessages`, cutting only
 *  at clean user-turn boundaries. Keeps as much recent history as fits. */
export function boundedHistory(messages: ChatMessage[], maxMessages = 40): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;

  const cleanUserStarts: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string') cleanUserStarts.push(i);
  }
  if (cleanUserStarts.length === 0) return messages; // nothing safe to cut

  // Earliest clean start whose tail already fits under the cap = keeps the most
  // history. If even the last real turn is bigger than the cap (a single
  // mega-turn with many tool rounds), fall back to that last start.
  for (const idx of cleanUserStarts) {
    if (messages.length - idx <= maxMessages) return messages.slice(idx);
  }
  return messages.slice(cleanUserStarts[cleanUserStarts.length - 1]);
}
