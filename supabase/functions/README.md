# Supabase Edge Functions

Server-side functions for the JetSetter Pro RN app. They keep sensitive keys off
the client (a RN bundle is extractable, so direct-embedded keys are unsafe).

## `ai-iris`

A thin, authenticated streaming proxy to the Anthropic Messages API. The
`ANTHROPIC_API_KEY` lives only here. The client owns the system prompt, tool
catalog, and the tool-execution loop; this function verifies the caller is a
signed-in Supabase user and pipes Claude's SSE stream back.

Request body (forwarded to Anthropic): `{ model?, max_tokens?, system, messages, tools?, tool_choice?, stream? }`.
Model is allow-listed (`claude-sonnet-5` default).

### Deploy

```bash
supabase functions deploy ai-iris
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the runtime.

## `delete-account`

Already deployed in the shared project (created for the iOS app) — the RN
`deleteAccount()` flow invokes it. Not re-declared here.
