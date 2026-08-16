const ALLOWED_EVENTS = new Set([
  "resume_created",
  "resume_saved",
  "resume_duplicated",
  "resume_deleted",
  "template_changed",
  "section_added",
  "section_reordered",
  "example_opened",
  "pdf_generated",
  "pdf_downloaded",
  "latex_downloaded",
  "ats_analyzed",
])

const ALLOWED_PARAMS = new Set(["template_name", "section_type", "section_count", "source_type", "score"])

function measurementId() {
  const raw = String(window.__GA_MEASUREMENT_ID__ || "").trim()
  return /^G-[A-Z0-9]+$/i.test(raw) ? raw : ""
}

function safeParams(params) {
  const out = {}
  if (!params || typeof params !== "object") return out
  for (const key of Object.keys(params)) {
    if (!ALLOWED_PARAMS.has(key)) continue
    const value = params[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
      out[key] = Math.round(value)
    } else if (typeof value === "string" && value.length > 0 && value.length <= 40 && !value.includes("@")) {
      out[key] = value
    }
  }
  return out
}

export function initAnalytics() {
  try {
    const id = measurementId()
    if (!id || window.__GA_INITIALIZED__) return
    window.__GA_INITIALIZED__ = true
    window.dataLayer = window.dataLayer || []
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments)
      }
    }
    const script = document.createElement("script")
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    script.onerror = () => {}
    document.head.appendChild(script)
    window.gtag("js", new Date())
    window.gtag("config", id, {
      send_page_view: true,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    window.addEventListener("popstate", () => {
      try {
        if (!measurementId() || typeof window.gtag !== "function") return
        window.gtag("event", "page_view", {
          page_path: location.pathname,
          page_location: `${location.origin}${location.pathname}`,
        })
      } catch {
        /* analytics is optional */
      }
    })
  } catch {
    /* analytics is optional */
  }
}

export function trackEvent(name, params) {
  try {
    if (!measurementId() || typeof window.gtag !== "function") return
    if (!ALLOWED_EVENTS.has(name)) return
    window.gtag("event", name, safeParams(params))
  } catch {
    /* analytics is optional */
  }
}
