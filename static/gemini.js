import { GEMINI_CONFIG, resolveGeminiModel } from "./gemini-config.js"

const SESSION_KEY = "resuform.gemini.tabKey"

export const AI_DISCLAIMER =
  "This is an AI-generated analysis based on the resume and job description. It is not a score from an employer's ATS."

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall_alignment: { type: "integer" },
    technical_alignment: { type: "integer" },
    experience_alignment: { type: "integer" },
    education_alignment: { type: "integer" },
    project_alignment: { type: "integer" },
    achievement_strength: { type: "integer" },
    strengths: { type: "array", items: { type: "string" } },
    important_gaps: { type: "array", items: { type: "string" } },
    semantic_matches: { type: "array", items: { type: "string" } },
    experience_gaps: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    requirement_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: { type: "string" },
          importance: { type: "string" },
          status: { type: "string" },
          reason: { type: "string" },
          resume_evidence: { type: "string" },
          evidence_type: { type: "string" },
        },
        required: ["requirement", "importance", "status", "reason", "resume_evidence", "evidence_type"],
      },
    },
  },
  required: [
    "overall_alignment",
    "technical_alignment",
    "experience_alignment",
    "education_alignment",
    "project_alignment",
    "achievement_strength",
    "strengths",
    "important_gaps",
    "semantic_matches",
    "experience_gaps",
    "improvements",
    "requirement_analysis",
  ],
}

export function currentDateISO(now = new Date()) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim())
}

export function analysisPrompt(currentDate) {
  const today = isIsoDate(currentDate) ? String(currentDate).trim() : currentDateISO()
  return `You are analyzing a resume against a job description for the candidate's private use.

Return ONLY one JSON object. No markdown. No commentary. No code fences.

Scoring fields are integers from 0 to 100. They are AI alignment estimates, NOT an ATS score and NOT an employer score.

Current date: ${today}

Analyze:
A. Overall JD alignment
B. Technical skill alignment
C. Experience relevance
D. Education alignment
E. Project relevance
F. Achievement / impact strength
G. Missing experience
H. Semantic skill matches (same meaning, different wording)
I. Important gaps
J. Resume weaknesses
K. Resume strengths
L. Specific improvement suggestions
M. Requirement-by-requirement reasoning

Semantic matching is required. Example: JD "Experience deploying ML models as production APIs" and resume "Built FastAPI services for real-time model inference" is a strong semantic match even if the wording differs.

ANTI-HALLUCINATION RULES (mandatory):
- Use only the supplied resume, job description, and current date.
- Never invent technologies, jobs, dates, years of experience, certifications, metrics, projects, or responsibilities.
- Never tell the candidate to add a skill, tool, certification, metric, or experience unless the resume already supports it.
- Phrase suggestions as: "If you have this experience..." or "Only add this if it is accurate..."
- If there is no mention at all, status must be not_found. If the only support is a skills-list mention, status must be claimed. Do not assume the candidate has used the skill on the job.
- Ignore contact details if present. Do not comment on name, email, or phone.

requirement_analysis.importance must be one of: required, preferred, optional.
requirement_analysis.status must be one of: matched, partially_matched, claimed, not_found.
- matched: a job or project description supports the requirement
- partially_matched: some relevant job or project evidence exists, but it is incomplete (narrower scope, related tool, or shorter duration)
- claimed: listed only in a skills section or keyword list, with no supporting job or project evidence. This is NOT partially_matched.
- not_found: no mention on the resume
Do not use partially_matched for a skills-list-only mention. That status is claimed.

requirement_analysis.evidence_type must be one of:
- direct_experience: a dated job/role bullet describes using it
- project_experience: a named project describes using it, not a job
- skill_mention: it appears only in a skills list or summary keyword list
- education_coursework: only degree, major, or coursework supports it
- semantic_inference: related wording supports it, but the exact skill is not named
- no_evidence: nothing on the resume supports it

A skills-section listing is NOT professional experience. Example: "Deployment: Docker, Kubernetes" is status claimed and evidence_type skill_mention. Example: "Containerized the API with Docker and deployed on Kubernetes" is status matched and evidence_type direct_experience.
Do not put claimed skills under experience_gaps as if they were absent. If useful, note that they were listed without supporting experience.

EXPERIENCE DATE RULES (mandatory):
1. Use the current date provided by the application when calculating experience. The current date is ${today}.
2. The current date is dynamically supplied; never assume an old date, a training cutoff, or a different year.
3. For an employment entry marked Present, Current, or Now, calculate duration from the stated start date through ${today}.
4. Distinguish full-time employment from internships, co-ops, and research internships.
5. Do not rely on the resume summary's claimed years of experience when dated employment entries are available.
6. If the calculated full-time experience satisfies the JD requirement, mark it as matched. Do not list it under missing experience.
7. If dates are ambiguous, state that clearly rather than inventing a duration.
Count calendar months from the start month through the current month. Example: "Aug 2023 – Present" as of ${today} is about 3.0 years, not 1 year.
In the reason, show the dated calculation, e.g. "NLP Engineer, Aug 2023 – Present ≈ 3.0 years as of ${today}, which meets a 2+ years requirement."

semantic_matches must be an array of plain strings, one sentence each.
Example: "JD production APIs ↔ resume FastAPI real-time inference services".
Do not put objects in strengths, important_gaps, semantic_matches, experience_gaps, or improvements.

requirement_analysis.reason must be 1-2 sentences explaining why the status was chosen. Never leave reason empty.
requirement_analysis.resume_evidence must quote or closely paraphrase the resume. If status is matched, partially_matched, or claimed, do not use "None found".

JSON keys:
overall_alignment, technical_alignment, experience_alignment, education_alignment, project_alignment, achievement_strength, strengths, important_gaps, semantic_matches, experience_gaps, improvements, requirement_analysis.`
}

export function redactContact(text) {
  return String(text || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[phone removed]")
}

export function truncate(text, max, label) {
  const value = String(text || "")
  if (value.length <= max) return { text: value, truncated: false }
  return {
    text: `${value.slice(0, max)}\n\n[${label} truncated for length]`,
    truncated: true,
  }
}

export function formatResumeForGemini({ libraryText = "", structured = null, extractedPdfText = "" } = {}) {
  if (structured && typeof structured === "object") {
    const lines = []
    if (structured.headline) lines.push(`Headline: ${structured.headline}`)
    const summary = String(libraryText || "").match(/SUMMARY\n([\s\S]*?)(?:\n[A-Z][A-Z ]+\n|$)/)
    if (summary?.[1]?.trim()) lines.push(`Summary:\n${summary[1].trim()}`)
    if (structured.education_text) lines.push(`Education:\n${structured.education_text}`)
    const edu = structured.education || []
    if (edu.length) {
      lines.push(
        "Education entries:\n" +
          edu.map((item) => `- ${item.degree || ""} ${item.dates || ""}`.trim()).join("\n")
      )
    }
    const roles = structured.roles || []
    if (roles.length) {
      lines.push(
        "Roles:\n" +
          roles
            .map((role) => `- ${role.kind || "experience"}: ${role.title || ""} (${role.dates || ""})\n  ${role.bullets || ""}`)
            .join("\n")
      )
    }
    if (Array.isArray(structured.experience_text) && structured.experience_text.length) {
      lines.push(`Experience:\n${structured.experience_text.join("\n")}`)
    }
    if (Array.isArray(structured.internships_text) && structured.internships_text.length) {
      lines.push(`Internships:\n${structured.internships_text.join("\n")}`)
    }
    if (Array.isArray(structured.projects_text) && structured.projects_text.length) {
      lines.push(`Projects:\n${structured.projects_text.join("\n")}`)
    }
    if (structured.skills_text) lines.push(`Skills:\n${structured.skills_text}`)
    const assembled = lines.join("\n\n").trim()
    if (assembled) return redactContact(assembled)
  }
  const raw = extractedPdfText || libraryText || ""
  return redactContact(raw)
}

function clampScore(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(100, Math.round(num)))
}

function asText(value) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(" — ")
  }
  if (typeof value !== "object") return ""
  if (value.jd && (value.resume || value.resume_evidence || value.evidence)) {
    return `${asText(value.jd)} ↔ ${asText(value.resume || value.resume_evidence || value.evidence)}`
  }
  if (value.requirement && (value.resume || value.resume_evidence || value.evidence || value.match)) {
    return `${asText(value.requirement)}: ${asText(value.match || value.resume_evidence || value.evidence || value.resume)}`
  }
  const preferred = [
    "text",
    "match",
    "summary",
    "description",
    "explanation",
    "reason",
    "reasoning",
    "rationale",
    "detail",
    "semantic_match",
    "alignment",
    "resume_evidence",
    "evidence",
  ]
  for (const key of preferred) {
    const text = asText(value[key])
    if (text) return text
  }
  return Object.values(value).map(asText).filter(Boolean).join(" — ")
}

function stringList(value) {
  if (!Array.isArray(value)) {
    const single = asText(value)
    return single ? [single] : []
  }
  return value.map(asText).filter(Boolean).slice(0, 24)
}

function pickField(row, keys) {
  if (!row || typeof row !== "object") return ""
  for (const key of keys) {
    const text = asText(row[key])
    if (text) return text
  }
  const wanted = new Set(keys.map((key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, "")))
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""))) continue
    const text = asText(value)
    if (text) return text
  }
  return ""
}

function emptyEvidence(text) {
  const value = String(text || "").trim().toLowerCase()
  return !value || value === "none found" || value === "none" || value === "n/a" || value === "na" || value === "null"
}

function requirementReason(row, status, evidence) {
  const text = pickField(row, ["reason", "reasoning", "rationale", "explanation", "analysis", "detail", "justification"])
  if (text && text.toLowerCase() !== "no reason provided.") return text
  if (status === "matched" && evidence && evidence !== "None found") {
    return `The resume supports this with: ${evidence}`
  }
  if (status === "partially_matched" && evidence && evidence !== "None found") {
    return `Partial resume evidence: ${evidence}`
  }
  if (status === "claimed" && evidence && evidence !== "None found") {
    return `Claimed on the resume, but no supporting job or project evidence was found: ${evidence}`
  }
  if (status === "not_found") return "No matching evidence was found on the resume."
  return "No reason provided."
}

function normalizeImportance(value) {
  const raw = String(value || "").toLowerCase()
  if (raw.includes("require") || raw.includes("must")) return "required"
  if (raw.includes("prefer") || raw.includes("nice")) return "preferred"
  if (raw.includes("optional")) return "optional"
  return "optional"
}

function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase().replace(/\s+/g, "_")
  if (raw.includes("claim") || raw.includes("listed_only") || raw.includes("no_supporting")) return "claimed"
  if (raw.includes("partial")) return "partially_matched"
  if (raw.includes("match") && !raw.includes("not")) return "matched"
  return "not_found"
}

const EVIDENCE_TYPES = new Set([
  "direct_experience",
  "project_experience",
  "skill_mention",
  "education_coursework",
  "semantic_inference",
  "no_evidence",
])

function normalizeEvidenceType(value, status, evidence, reason) {
  const raw = String(value || "").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "")
  if (raw.includes("direct") || raw.includes("professional") || raw === "work_experience" || raw === "job") {
    return "direct_experience"
  }
  if (raw.includes("project")) return "project_experience"
  if (raw.includes("skill")) return "skill_mention"
  if (raw.includes("education") || raw.includes("course") || raw.includes("degree")) return "education_coursework"
  if (raw.includes("semantic") || raw.includes("infer")) return "semantic_inference"
  if (raw.includes("no_evidence") || raw === "none" || raw === "missing") return "no_evidence"
  if (EVIDENCE_TYPES.has(raw)) return raw
  return inferEvidenceType(status, evidence, reason)
}

function inferEvidenceType(status, evidence, reason) {
  if (status === "not_found" || emptyEvidence(evidence)) return "no_evidence"
  const blob = `${evidence || ""} ${reason || ""}`.toLowerCase()
  const listedOnly = /\b(skills? section|listed under|listed in|skills?:\s|deployment:\s|data:\s|mlops:\s)/.test(blob)
  const handsOn = /\b(built|developed|designed|deployed|implemented|used|fine-tuned|containerized|integrated)\b/.test(blob)
  if (listedOnly && !handsOn) return "skill_mention"
  if (/\b(coursework|course work|bachelor|master|m\.s\.|b\.s\.|degree|gpa)\b/.test(blob) && !handsOn) {
    return "education_coursework"
  }
  if (/\b(project|personal project|side project)\b/.test(blob) && !/\b(engineer|internship|intern at|role:)\b/.test(blob)) {
    return "project_experience"
  }
  if (/\bsemantic\b/.test(blob) && !handsOn) return "semantic_inference"
  if (listedOnly) return "skill_mention"
  return "direct_experience"
}

export function extractJsonText(raw) {
  let text = String(raw || "").replace(/^\uFEFF/, "").trim()
  if (!text) throw Object.assign(new Error("Gemini returned an empty response."), { code: "parse" })
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw Object.assign(new Error("Gemini did not return valid JSON."), { code: "parse" })
  }
  return text.slice(start, end + 1)
}

function parseJsonObject(raw) {
  const snippet = extractJsonText(raw)
  try {
    return JSON.parse(snippet)
  } catch {
    const repaired = snippet.replace(/,\s*([}\]])/g, "$1")
    return JSON.parse(repaired)
  }
}

function candidateOutputText(envelope) {
  const parts = envelope?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts) || !parts.length) return ""
  const visible = parts.filter((part) => part && !part.thought && part.text).map((part) => part.text)
  if (visible.length) return visible.join("\n")
  return parts.map((part) => part?.text || "").join("\n")
}

export function validateAnalysis(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw Object.assign(new Error("Gemini JSON was not an object."), { code: "parse" })
  }
  const rows = Array.isArray(payload.requirement_analysis) ? payload.requirement_analysis : []
  return {
    overall_alignment: clampScore(payload.overall_alignment),
    technical_alignment: clampScore(payload.technical_alignment),
    experience_alignment: clampScore(payload.experience_alignment),
    education_alignment: clampScore(payload.education_alignment),
    project_alignment: clampScore(payload.project_alignment),
    achievement_strength: clampScore(payload.achievement_strength),
    strengths: stringList(payload.strengths),
    important_gaps: stringList(payload.important_gaps),
    semantic_matches: stringList(payload.semantic_matches),
    experience_gaps: stringList(payload.experience_gaps),
    improvements: stringList(payload.improvements),
    requirement_analysis: rows.slice(0, 40).map((row) => {
      let status = normalizeStatus(row?.status || row?.match_status || row?.result)
      let evidence = pickField(row, [
        "resume_evidence",
        "resumeEvidence",
        "evidence",
        "resume_quote",
        "quote",
        "support",
        "source",
        "citation",
        "resume_excerpt",
        "excerpt",
      ])
      if (emptyEvidence(evidence)) evidence = ""
      let evidenceType = normalizeEvidenceType(
        pickField(row, ["evidence_type", "evidenceType", "evidence_kind", "source_type"]),
        status,
        evidence,
        pickField(row, ["reason", "reasoning", "rationale"])
      )
      if (evidenceType === "skill_mention" && status !== "not_found") status = "claimed"
      if (status === "claimed" && evidenceType === "no_evidence") evidenceType = "skill_mention"
      const reason = requirementReason(row, status, evidence || "None found")
      if (!evidence) {
        evidence = status === "not_found" ? "None found" : reason && reason.toLowerCase() !== "no reason provided." ? reason : "None found"
      }
      return {
        requirement: pickField(row, ["requirement", "name", "item", "skill"]) || "Unnamed requirement",
        importance: normalizeImportance(row?.importance || row?.priority),
        status,
        reason,
        resume_evidence: evidence,
        evidence_type: evidenceType,
      }
    }),
  }
}

export function hideSecret(text, secret) {
  let out = String(text || "Something went wrong.")
  const key = String(secret || "").trim()
  if (key && key.length >= 8) out = out.split(key).join("[api-key hidden]")
  return out.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[api-key hidden]")
}

export function mapGeminiHttpError(status, bodyText, apiKey) {
  const safe = hideSecret(bodyText, apiKey)
  let parsed = null
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    parsed = null
  }
  const message = hideSecret(parsed?.error?.message || safe || "", apiKey)
  const statusName = String(parsed?.error?.status || "")
  if (status === 404 || statusName === "NOT_FOUND" || /not found|not supported|unknown model/i.test(message)) {
    return { code: "unknown", message: "That Gemini model is not available for your API key. Try a Flash model on the free tier." }
  }
  if (status === 400 && /api key/i.test(message)) {
    return { code: "invalid_key", message: "That Gemini API key looks invalid. Check the key and try again." }
  }
  if (status === 401 || status === 403 || statusName === "PERMISSION_DENIED" || /api key not valid/i.test(message)) {
    return { code: "invalid_key", message: "That Gemini API key is invalid or does not have access to this model." }
  }
  if (status === 429 || statusName === "RESOURCE_EXHAUSTED" || /quota|rate.?limit/i.test(message)) {
    const quota = /quota/i.test(message)
    return {
      code: quota ? "quota" : "rate_limit",
      message: quota
        ? "Gemini quota exceeded. Check Google's current API quotas and pricing, then try later."
        : "Gemini rate limit reached. Wait a moment and try again.",
    }
  }
  if (status >= 500) {
    return { code: "network", message: "Gemini is temporarily unavailable. Try again in a few minutes." }
  }
  return { code: "unknown", message: "Gemini could not complete this analysis. Try again." }
}

export function loadSessionKey() {
  try {
    return String(sessionStorage.getItem(SESSION_KEY) || "")
  } catch {
    return ""
  }
}

export function saveSessionKey(key) {
  try {
    const value = String(key || "").trim()
    if (value) sessionStorage.setItem(SESSION_KEY, value)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* sessionStorage may be blocked */
  }
}

export function clearSessionKey() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function geminiUrl(model) {
  const base = GEMINI_CONFIG.apiBase.replace(/\/$/, "")
  const id = encodeURIComponent(resolveGeminiModel(model))
  return `${base}/models/${id}:generateContent`
}

async function postGemini(apiKey, userText, generationConfig, signal, model) {
  const response = await fetch(geminiUrl(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig,
    }),
  })
  const bodyText = await response.text()
  return { response, bodyText }
}

function analysisFromEnvelope(envelope) {
  const block = envelope?.promptFeedback?.blockReason
  if (block) {
    throw Object.assign(new Error("Gemini blocked this request. Try a different resume or job description."), { code: "unknown" })
  }
  const finish = String(envelope?.candidates?.[0]?.finishReason || "")
  const raw = candidateOutputText(envelope)
  if (!String(raw).trim()) {
    if (finish === "MAX_TOKENS") {
      throw Object.assign(new Error("Gemini stopped before finishing the JSON. Try again with a shorter job description."), { code: "parse" })
    }
    throw Object.assign(new Error("Gemini returned an empty response."), { code: "parse" })
  }
  try {
    return validateAnalysis(parseJsonObject(raw))
  } catch (err) {
    if (finish === "MAX_TOKENS") {
      throw Object.assign(new Error("Gemini stopped before finishing the JSON. Try again with a shorter job description."), { code: "parse" })
    }
    throw Object.assign(new Error(err.message || "Gemini JSON could not be parsed."), { code: "parse" })
  }
}

export async function analyzeWithGemini({ apiKey, resumeText, jdText, model, currentDate } = {}) {
  const key = String(apiKey || "").trim()
  const modelId = resolveGeminiModel(model)
  if (!key) {
    throw Object.assign(new Error("Enter your Gemini API key first."), { code: "missing_key" })
  }
  const resume = String(resumeText || "").trim()
  const jd = String(jdText || "").trim()
  if (!resume) {
    throw Object.assign(new Error("No resume text is available to send to Gemini."), { code: "empty" })
  }
  if (!jd) {
    throw Object.assign(new Error("Paste a job description before running AI analysis."), { code: "empty" })
  }
  const resumePart = truncate(resume, GEMINI_CONFIG.maxResumeChars, "Resume")
  const jdPart = truncate(jd, GEMINI_CONFIG.maxJdChars, "Job description")
  const today = isIsoDate(currentDate) ? String(currentDate).trim() : currentDateISO()
  const userText = `${analysisPrompt(today)}

JOB DESCRIPTION:
${jdPart.text}

RESUME:
${resumePart.text}`

  const baseConfig = {
    temperature: 0.1,
    maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 0 },
  }
  const attempts = [
    { ...baseConfig, responseSchema: RESPONSE_SCHEMA },
    { ...baseConfig },
    { temperature: 0.1, maxOutputTokens: GEMINI_CONFIG.maxOutputTokens, responseMimeType: "application/json" },
  ]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.timeoutMs)
  let lastError = null
  try {
    for (const generationConfig of attempts) {
      let posted
      try {
        posted = await postGemini(key, userText, generationConfig, controller.signal, modelId)
      } catch (err) {
        if (err?.name === "AbortError") {
          throw Object.assign(new Error("Gemini took too long to respond. Try again."), { code: "network" })
        }
        throw Object.assign(new Error("Could not reach Gemini. Check your network connection."), { code: "network" })
      }
      if (!posted.response.ok) {
        const mapped = mapGeminiHttpError(posted.response.status, posted.bodyText, key)
        lastError = Object.assign(new Error(mapped.message), { code: mapped.code })
        if (mapped.code === "invalid_key" || mapped.code === "quota" || mapped.code === "rate_limit") throw lastError
        continue
      }
      let envelope
      try {
        envelope = JSON.parse(posted.bodyText)
      } catch {
        lastError = Object.assign(new Error("Gemini returned a response that could not be read."), { code: "parse" })
        continue
      }
      try {
        return analysisFromEnvelope(envelope)
      } catch (err) {
        lastError = err
      }
    }
  } finally {
    clearTimeout(timer)
  }
  throw lastError || Object.assign(new Error("Gemini did not return valid JSON."), { code: "parse" })
}
