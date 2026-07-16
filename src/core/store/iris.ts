import { create } from 'zustand';
import { runIrisConversation } from '@/src/core/ai/agentLoop';
import { ChatMessage } from '@/src/core/ai/anthropic';
import { boundedHistory } from '@/src/core/ai/history';
import { buildSystemPrompt } from '@/src/core/ai/iris/agent';
import { composeFirstTurn, currentSnapshot } from '@/src/core/ai/iris/context';
import { executeIrisTool, IRIS_TOOLS } from '@/src/core/ai/iris/tools';
import { makeId } from '@/src/core/format';
import { isAiConfigured } from '@/src/core/firebase/config';
import { useIrisRouter } from '@/src/core/store/irisRouter';
import { useTravel } from '@/src/core/store/travel';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface IrisChatState {
  messages: DisplayMessage[];
  apiMessages: ChatMessage[]; // raw Anthropic conversation
  streamingContent: string;
  isResponding: boolean;
  error: string | null;
  // Outcome of the last confirmed/declined staged action, injected into the
  // NEXT user turn so the model knows it completed (can report it, and won't
  // re-stage it). Not written to apiMessages directly — that would create two
  // consecutive assistant turns, which Anthropic rejects.
  actionNote: string | null;
  ratedIds: string[];
  queuedPrompt: string | null;
  queuePrompt: (text: string) => void;
  consumeQueuedPrompt: () => void;
  send: (text: string) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  rate: (id: string) => void;
  clear: () => void;
}

// Shown when the AI backend isn't reachable — honest, never a canned answer.
const IRIS_NOT_CONNECTED =
  "IRIS isn't connected yet. Once the AI backend is set up, I can plan trips, track flights, log expenses, and manage your itinerary.";
const IRIS_REQUEST_FAILED =
  'Something went wrong reaching IRIS. Please check your connection and try again in a moment.';

export const useIris = create<IrisChatState>((set, get) => ({
  messages: [],
  apiMessages: [],
  streamingContent: '',
  isResponding: false,
  error: null,
  actionNote: null,
  ratedIds: [],
  queuedPrompt: null,

  queuePrompt: (text) => set({ queuedPrompt: text }),
  consumeQueuedPrompt: () => set({ queuedPrompt: null }),

  send: async (raw) => {
    const text = raw.trim();
    const s = get();
    if (!text || s.isResponding) return;

    const userMsg: DisplayMessage = { id: makeId(), role: 'user', text };
    set({ messages: [...s.messages, userMsg], isResponding: true, streamingContent: '', error: null });

    const isFirst = s.apiMessages.length === 0;
    const travel = useTravel.getState();
    const snapshot = isFirst ? currentSnapshot(travel.trips, travel.expenses) : '';
    // Surface the outcome of the last confirmed/declined action to the model so
    // it can report it accurately and won't re-stage a completed booking.
    const note = s.actionNote;
    if (note) set({ actionNote: null });
    const baseContent = composeFirstTurn(text, snapshot);
    const apiUser: ChatMessage = {
      role: 'user',
      content: note ? `[System note — result of your last prepared action: ${note}]\n\n${baseContent}` : baseContent,
    };

    // No AI backend configured — be honest rather than fake a reply. Don't
    // record this in apiMessages so a later live turn starts a clean history.
    if (!isAiConfigured()) {
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: IRIS_NOT_CONNECTED }],
        isResponding: false,
        streamingContent: '',
      }));
      return;
    }

    // Live path — Claude via the ai-iris Edge Function, with the tool loop.
    let acc = '';
    try {
      const result = await runIrisConversation({
        system: buildSystemPrompt(),
        // Bound the history so a marathon chat never trips aiIris's 60-message
        // cap; trims whole old exchanges from the front, keeping the newest.
        messages: boundedHistory([...s.apiMessages, apiUser]),
        tools: IRIS_TOOLS,
        executeTool: executeIrisTool,
        // Reset the live buffer each turn so the streamed bubble shows only the
        // current turn's text (not intermediate tool-round text concatenated).
        onTurnStart: () => {
          acc = '';
          set({ streamingContent: '' });
        },
        onText: (delta) => {
          acc += delta;
          set({ streamingContent: acc });
        },
      });
      const finalText = result.finalText.trim() || 'Done.';
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: finalText }],
        apiMessages: result.messages,
        isResponding: false,
        streamingContent: '',
      }));
    } catch {
      // Surface the failure honestly and leave apiMessages untouched so the
      // user can simply resend without corrupting the conversation history.
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: IRIS_REQUEST_FAILED }],
        isResponding: false,
        streamingContent: '',
        error: 'IRIS request failed',
      }));
    }
  },

  confirmPending: async () => {
    // Don't race an in-flight turn — its final `apiMessages` write would clobber
    // this append, and the transcript must stay role-alternating.
    if (get().isResponding) return;
    const pending = useIrisRouter.getState().pendingAction;
    if (!pending) return;
    // Clear optimistically BEFORE awaiting so the card can't double-commit.
    useIrisRouter.getState().cancel();
    // A rejecting commit must never strand the ConfirmationCard's spinner or
    // raise an unhandled rejection — surface the failure as a normal bubble.
    // (Booking commits also resolve friendly strings themselves; this guards
    // every other kind, e.g. a throwing calendar permission.)
    let result: string;
    try {
      result = await pending.commit();
    } catch {
      result = "That didn't go through — nothing was changed. Please try again.";
    }
    // Display-only append (a direct apiMessages write would be a second
    // consecutive assistant turn). The outcome is fed back to the model on the
    // next turn via `actionNote` so it stays in sync with reality.
    set((st) => ({
      messages: [...st.messages, { id: makeId(), role: 'assistant', text: result }],
      actionNote: result,
    }));
  },

  cancelPending: () => {
    if (get().isResponding) return;
    useIrisRouter.getState().cancel();
    set((st) => ({
      messages: [
        ...st.messages,
        { id: makeId(), role: 'assistant', text: "No problem — I won't make that change." },
      ],
      actionNote: 'The user declined the prepared action; it was not performed.',
    }));
  },

  rate: (id) => set((st) => ({ ratedIds: [...st.ratedIds, id] })),

  clear: () => {
    useIrisRouter.getState().cancel();
    set({ messages: [], apiMessages: [], streamingContent: '', error: null, actionNote: null, ratedIds: [] });
  },
}));
