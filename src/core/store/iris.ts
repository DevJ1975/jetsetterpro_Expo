import { create } from 'zustand';
import { runIrisConversation } from '@/src/core/ai/agentLoop';
import { ChatMessage } from '@/src/core/ai/anthropic';
import { buildSystemPrompt } from '@/src/core/ai/iris/agent';
import { composeFirstTurn, currentSnapshot } from '@/src/core/ai/iris/context';
import { demoResponse } from '@/src/core/ai/iris/demo';
import { executeIrisTool, IRIS_TOOLS } from '@/src/core/ai/iris/tools';
import { makeId } from '@/src/core/format';
import { isSupabaseConfigured } from '@/src/core/env';
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

// Demo "typing" simulation (chunked to avoid a setState per character).
async function typeOut(reply: string, onPartial: (s: string) => void): Promise<void> {
  const steps = Math.min(reply.length, 60);
  const chunk = Math.max(1, Math.ceil(reply.length / Math.max(steps, 1)));
  for (let i = chunk; i < reply.length; i += chunk) {
    onPartial(reply.slice(0, i));
    await new Promise((r) => setTimeout(r, 24));
  }
  onPartial(reply);
}

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

    // Demo / offline fallback — no backend configured.
    if (!isSupabaseConfigured()) {
      const reply = demoResponse(text);
      await typeOut(reply, (partial) => set({ streamingContent: partial }));
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: reply }],
        apiMessages: [...st.apiMessages, apiUser, { role: 'assistant', content: reply }],
        isResponding: false,
        streamingContent: '',
      }));
      return;
    }

    // Live path — Claude via the ai-iris Edge Function, with the tool loop.
    let acc = '';
    try {
      const convo = await runIrisConversation({
        system: buildSystemPrompt(),
        messages: [...s.apiMessages, apiUser],
        tools: IRIS_TOOLS,
        executeTool: executeIrisTool,
        onText: (delta) => {
          acc += delta;
          set({ streamingContent: acc });
        },
      });
      const finalText = acc.trim() || 'Done.';
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: finalText }],
        apiMessages: convo,
        isResponding: false,
        streamingContent: '',
      }));
    } catch {
      // Fall back to a canned reply rather than dead-ending the user (mirrors iOS).
      const reply = demoResponse(text);
      set((st) => ({
        messages: [...st.messages, { id: makeId(), role: 'assistant', text: reply }],
        apiMessages: [...st.apiMessages, apiUser, { role: 'assistant', content: reply }],
        isResponding: false,
        streamingContent: '',
      }));
    }
  },

  confirmPending: async () => {
    const pending = useIrisRouter.getState().pendingAction;
    if (!pending) return;
    // Clear optimistically BEFORE awaiting so the card can't double-commit.
    useIrisRouter.getState().cancel();
    const result = await pending.commit();
    set((st) => ({
      messages: [...st.messages, { id: makeId(), role: 'assistant', text: result }],
      apiMessages: [...st.apiMessages, { role: 'assistant', content: result }],
    }));
  },

  cancelPending: () => {
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
