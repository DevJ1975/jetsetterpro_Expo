import { summaryForPrompt, useIrisMemory } from '@/src/core/store/irisMemory';
import { instructionsForCurrentUser } from './personality';

/** System prompt = base identity + injected memory summary (rebuilt each turn so
 *  new preferences take effect immediately). */
export function buildSystemPrompt(): string {
  const prefs = useIrisMemory.getState().preferences;
  return instructionsForCurrentUser(summaryForPrompt(prefs));
}

/** Faithful port of IRISChatViewModel.composeGreeting (learned-profile case is
 *  ported in a later phase). */
export function composeGreeting(knownPreferences: number): string {
  if (knownPreferences === 0) {
    return "Hi, I'm IRIS — your travel agent in your pocket. Tell me about your next trip or just say hi to get started.";
  }
  return `Welcome back. I've kept track of ${knownPreferences} preference${
    knownPreferences === 1 ? '' : 's'
  } about how you like to travel. What's on your mind?`;
}
