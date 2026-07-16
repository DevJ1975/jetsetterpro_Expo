// genkit.js — shared Genkit runtime for JetSetter Pro's Cloud Functions.
//
// Genkit is adopted SURGICALLY here: it powers new *server-side* AI flows whose
// tools are server resources (the Duffel flight agent — search / book / cancel),
// which is exactly where a server-side tool loop pays off. It deliberately does
// NOT replace `aiIris.js`: the IRIS assistant's tools are device-coupled (they
// mutate on-device state, drive navigation, and stage a confirm-before-commit
// card), so its tool loop stays client-owned and its proxy stays a thin pipe.
//
// Same provider + models as the proxy: Anthropic Claude. Keeping Claude while
// gaining Genkit's tooling (server-side tool loop, typed/structured output,
// tracing, prompt management) is the whole point — this is not a Gemini switch.
//
// The ANTHROPIC_API_KEY secret is only present in a function's env when that
// function declares `secrets: ['ANTHROPIC_API_KEY']`. So the Genkit instance is
// created LAZILY (memoized per warm instance): the key is read at first use, and
// functions that never call AI don't initialize Genkit or pay its cold start.
const { genkit } = require('genkit');
const { anthropic } = require('@genkit-ai/anthropic');

// Mirror aiIris.js exactly so the proxy and Genkit flows share one model set.
const ALLOWED_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
]);
const DEFAULT_MODEL = 'claude-sonnet-5';

let _ai = null;

/**
 * The shared Genkit instance (Claude via the Anthropic plugin), built once per
 * warm instance. `anthropic()` reads ANTHROPIC_API_KEY from the function env, so
 * only call this from a function that declares that secret.
 */
function getAI() {
  if (!_ai) _ai = genkit({ plugins: [anthropic()] });
  return _ai;
}

/**
 * A Genkit ModelReference for a Claude model, validated against the same
 * allow-list as the proxy so a caller can't request an arbitrary model. The
 * plugin's string overload passes our current 2026 Opus/Sonnet ids straight
 * through to the Anthropic API even though its bundled known-list is one release
 * behind. Unknown ids fall back to the default.
 */
function claudeModel(model) {
  return anthropic.model(ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL);
}

module.exports = { getAI, claudeModel, ALLOWED_MODELS, DEFAULT_MODEL };
