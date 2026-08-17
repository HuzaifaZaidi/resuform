/**
 * Single place to change Gemini models later.
 * Google retires model IDs and free-tier rules; update this list only.
 */
export const GEMINI_CONFIG = {
  model: "gemini-2.5-flash",
  apiBase: "https://generativelanguage.googleapis.com/v1beta",
  maxResumeChars: 80_000,
  maxJdChars: 40_000,
  maxOutputTokens: 8192,
  timeoutMs: 90_000,
}

/** Text models useful for resume analysis. `free` = typically available on the AI Studio free tier. */
export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    tier: "free",
    note: "Recommended. Usually free in Google AI Studio.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    tier: "free",
    note: "Faster and lighter. Usually free in Google AI Studio.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    tier: "free",
    note: "Newer Flash model. Usually free in Google AI Studio.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    tier: "free",
    note: "Newer Lite model. Usually free in Google AI Studio.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    tier: "free",
    note: "Newer Flash model. Usually free in Google AI Studio.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    tier: "paid",
    note: "Stronger reasoning. Often paid or a very small free quota.",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    tier: "paid",
    note: "Paid only in current Google pricing.",
  },
]

export function resolveGeminiModel(id) {
  const wanted = String(id || "").trim()
  if (GEMINI_MODELS.some((item) => item.id === wanted)) return wanted
  return GEMINI_CONFIG.model
}

export function geminiModelLabel(id) {
  const found = GEMINI_MODELS.find((item) => item.id === id)
  return found?.label || id || GEMINI_CONFIG.model
}
