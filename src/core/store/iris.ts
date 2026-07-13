import { create } from 'zustand';
import { runIrisConversation } from '@/src/core/ai/agentLoop';
import { ChatMessage } from '@/src/core/ai/anthropic';
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
    const apiUser: ChatMessage = { role: 'user', content: composeFirstTurn(text, snapshot) };

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
        messages: [...s.apiMessages, apiUser],
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
    const result = await pending.commit();
    // Display-only: appending to apiMessages here would create two consecutive
    // assistant turns (the model's "prepared…" turn already ended the exchange),
    // which Anthropic rejects. The commit result shows in the transcript instead.
    set((st) => ({ messages: [...st.messages, { id: makeId(), role: 'assistant', text: result }] }));
  },

  cancelPending: () => {
    if (get().isResponding) return;
    useIrisRouter.getState().cancel();
    set((st) => ({
      messages: [
        ...st.messages,
        { id: makeId(), role: 'assistant', text: "No problem — I won't make that change." },
      ],
    }));
  },

  rate: (id) => set((st) => ({ ratedIds: [...st.ratedIds, id] })),

  clear: () => {
    useIrisRouter.getState().cancel();
    set({ messages: [], apiMessages: [], streamingContent: '', error: null, ratedIds: [] });
  },
}));
