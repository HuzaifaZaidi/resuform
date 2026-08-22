import { LIBRARY_KEY, loadLibrary } from "./library.js"
import { parseResumeText } from "./parse.js"
import { extractPdfFile } from "./pdftext.js?v=20260818a"
import { initAnalytics, trackEvent } from "./analytics.js"
import {
  AI_DISCLAIMER,
  analyzeWithGemini,
  clearSessionKey,
  currentDateISO,
  formatResumeForGemini,
  loadSessionKey,
  saveSessionKey,
} from "./gemini.js?v=20260817l"
import { GEMINI_CONFIG, GEMINI_MODELS, geminiModelLabel, resolveGeminiModel } from "./gemini-config.js"

initAnalytics()

const els = {
  form: document.getElementById("ats-form"),
  results: document.getElementById("ats-results"),
  libraryBox: document.getElementById("ats-library-box"),
  pdfBox: document.getElementById("ats-pdf-box"),
  libraryList: document.getElementById("ats-library-list"),
  pdf: document.getElementById("ats-pdf"),
  pdfName: document.getElementById("ats-pdf-name"),
  jd: document.getElementById("ats-jd"),
  analyze: document.getElementById("ats-analyze"),
  status: document.getElementById("ats-status"),
  scoreNum: document.getElementById("ats-score-num"),
  scoreHero: document.getElementById("ats-score-hero"),
  scoreRing: document.getElementById("ats-score-ring"),
  scoreBand: document.getElementById("ats-score-band"),
  disclaimer: document.getElementById("ats-disclaimer"),
  bars: document.getElementById("ats-bars"),
  matched: document.getElementById("ats-matched"),
  missing: document.getElementById("ats-missing"),
  warning: document.getElementById("ats-warning"),
  skillTable: document.querySelector("#ats-skill-table tbody"),
  strengths: document.getElementById("ats-strengths"),
  improvements: document.getElementById("ats-improvements"),
  experience: document.getElementById("ats-experience"),
  structure: document.getElementById("ats-structure"),
  formatting: document.getElementById("ats-formatting"),
  again: document.getElementById("ats-again"),
  geminiKey: document.getElementById("ats-gemini-key"),
  geminiToggle: document.getElementById("ats-gemini-toggle"),
  geminiKeep: document.getElementById("ats-gemini-keep"),
  geminiRun: document.getElementById("ats-gemini-run"),
  geminiStatus: document.getElementById("ats-gemini-status"),
  geminiModel: document.getElementById("ats-gemini-model"),
  aiResults: document.getElementById("ats-ai-results"),
  aiScoreNum: document.getElementById("ats-ai-score-num"),
  aiScoreHero: document.getElementById("ats-ai-score-hero"),
  aiScoreRing: document.getElementById("ats-ai-score-ring"),
  aiScoreBand: document.getElementById("ats-ai-score-band"),
  aiDisclaimer: document.getElementById("ats-ai-disclaimer"),
  aiBars: document.getElementById("ats-ai-bars"),
  aiStrengths: document.getElementById("ats-ai-strengths"),
  aiGaps: document.getElementById("ats-ai-gaps"),
  aiSemantic: document.getElementById("ats-ai-semantic"),
  aiExperienceGaps: document.getElementById("ats-ai-experience-gaps"),
  aiImprovements: document.getElementById("ats-ai-improvements"),
  aiReqTable: document.querySelector("#ats-ai-req-table tbody"),
}

const state = {
  source: "library",
  resumeId: "",
  file: null,
  pdfText: "",
  pdfKey: "",
  geminiBusy: false,
  lastResumeText: "",
  lastJdText: "",
  lastStructured: null,
}

function scoreTone(score) {
  const value = Number(score)
  if (!Number.isFinite(value)) return { tone: "neutral", label: "", note: "" }
  if (value >= 80) {
    return { tone: "good", label: "Strong match", note: "Good alignment with this job description, with some remaining gaps." }
  }
  if (value >= 60) {
    return { tone: "warn", label: "Partial match", note: "Some alignment; several requirements still need evidence on the resume." }
  }
  return { tone: "bad", label: "Weak match", note: "Limited alignment with this job description as written." }
}

function paintScore(numEl, ringEl, heroEl, bandEl, score) {
  const value = Number(score)
  if (numEl) numEl.textContent = Number.isFinite(value) ? String(Math.round(value)) : "—"
  const band = scoreTone(value)
  if (heroEl) heroEl.dataset.tone = band.tone
  if (bandEl) {
    bandEl.innerHTML = band.label ? `<strong>${escapeHtml(band.label)}</strong><span>${escapeHtml(band.note)}</span>` : ""
  }
  if (ringEl && Number.isFinite(value)) {
    const c = 2 * Math.PI * 52
    ringEl.style.strokeDasharray = String(c)
    ringEl.style.strokeDashoffset = String(c * (1 - Math.max(0, Math.min(100, value)) / 100))
  }
}

function setStatus(text, kind = "") {
  els.status.textContent = text
  els.status.className = `status${kind ? ` ${kind}` : ""}`
}

function hasResume() {
  if (state.source === "pdf") return Boolean(state.file)
  return Boolean(state.resumeId)
}

function refreshReady() {
  const ready = hasResume() && els.jd.value.trim().length > 20
  els.analyze.disabled = !ready
  if (els.geminiRun) els.geminiRun.disabled = !ready || state.geminiBusy
  if (!hasResume()) setStatus("Choose a resume and paste a job description.")
  else if (!els.jd.value.trim()) setStatus("Paste a job description to continue.")
  else if (els.jd.value.trim().length <= 20) setStatus("Paste the complete job description.")
  else setStatus("Ready to analyze.")
}

function mapRoles(items, kind) {
  return (items || []).map((item) => ({
    kind,
    title: item.title || item.name || "",
    dates: item.dates || "",
    bullets: item.bullets || "",
  }))
}

function structuredFromText(text) {
  const resume = parseResumeText(text)
  const skillsText = (resume.skills || []).map((row) => `${row.category || ""} ${row.items || ""}`).join(" ")
  const experienceItems = resume.experience || []
  const internships = resume.internships || []
  const projects = resume.projects || []
  return {
    headline: resume.headline || "",
    skills_text: skillsText,
    experience_text: experienceItems.map((item) => [item.title, item.bullets].filter(Boolean).join(" ")),
    internships_text: internships.map((item) => [item.title, item.bullets].filter(Boolean).join(" ")),
    projects_text: projects.map((item) => [item.name, item.tech, item.bullets].filter(Boolean).join(" ")),
    education_text: [
      ...(resume.education || []).map((item) => [item.degree, item.details].filter(Boolean).join(" ")),
      ...(resume.coursework || []).map((item) => [item.category, item.items].filter(Boolean).join(" ")),
    ].join(" "),
    roles: [...mapRoles(experienceItems, "experience"), ...mapRoles(internships, "internship")],
    education: (resume.education || []).map((item) => ({ degree: item.degree || "", dates: item.dates || "" })),
    has_contact: Boolean(resume.email || resume.phone),
    has_summary: Boolean(resume.summary?.trim()),
    has_education: Boolean(resume.education?.length),
    has_experience: Boolean(experienceItems.length),
    has_internships: Boolean(internships.length),
    has_projects: Boolean(projects.length),
    has_skills: Boolean(resume.skills?.length),
    has_responsibilities: Boolean(resume.responsibilities?.length),
    has_extracurricular: Boolean(resume.extracurricular?.length),
    has_coursework: Boolean(resume.coursework?.length),
    has_certifications: Boolean(resume.onlineCerts?.length) || /certif/i.test(text),
  }
}

function renderLibrary() {
  const library = loadLibrary()
  const items = library.items || []
  if (!items.length) {
    els.libraryList.innerHTML = `<li class="ats-empty">No resume selected. Save one from the resume builder, or upload a PDF.</li>`
    state.resumeId = ""
    refreshReady()
    return
  }
  if (!state.resumeId || !items.some((item) => item.id === state.resumeId)) {
    state.resumeId = library.currentId && items.some((item) => item.id === library.currentId) ? library.currentId : items[0].id
  }
  els.libraryList.innerHTML = items
    .map(
      (item) => `<li>
        <label>
          <input type="radio" name="ats-resume" value="${item.id}" ${item.id === state.resumeId ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(item.name || "Untitled resume")}</strong>
            <em>${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}</em>
          </span>
        </label>
      </li>`
    )
    .join("")
  refreshReady()
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function setSource(source) {
  state.source = source
  document.querySelectorAll(".ats-source-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.source === source)
  })
  els.libraryBox.hidden = source !== "library"
  els.pdfBox.hidden = source !== "pdf"
  refreshReady()
}

function chips(items, empty) {
  if (!items?.length) return `<p class="ats-empty">${empty}</p>`
  return items
    .map((item) => {
      const extra = item.importance ? ` <small>${escapeHtml(item.importance)}</small>` : ""
      return `<span class="ats-chip">${escapeHtml(item.term)}${extra}</span>`
    })
    .join("")
}

function listBlock(title, items, empty) {
  if (!items?.length) return `<h2>${title}</h2><p class="ats-empty">${empty}</p>`
  return `<h2>${title}</h2><ul class="ats-req">${items.map((item) => `<li><span>${escapeHtml(item)}</span></li>`).join("")}</ul>`
}

function setGeminiStatus(text, kind = "") {
  if (!els.geminiStatus) return
  els.geminiStatus.textContent = text
  els.geminiStatus.className = `status${kind ? ` ${kind}` : ""}`
}

function rememberKeyIfChosen() {
  if (!els.geminiKey) return
  if (els.geminiKeep?.checked) saveSessionKey(els.geminiKey.value)
  else clearSessionKey()
}

async function loadCurrentDate() {
  try {
    const res = await fetch("/api/ats/clock", { cache: "no-store" })
    if (!res.ok) throw new Error("clock")
    const data = await res.json()
    const value = String(data?.current_date || "").trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  } catch {
    /* use the local calendar date */
  }
  return currentDateISO()
}

const MODEL_STORAGE = "resuform.gemini.model"

function selectedGeminiModel() {
  return resolveGeminiModel(els.geminiModel?.value)
}

function fillGeminiModels() {
  if (!els.geminiModel) return
  let saved = GEMINI_CONFIG.model
  try {
    saved = resolveGeminiModel(sessionStorage.getItem(MODEL_STORAGE) || GEMINI_CONFIG.model)
  } catch {
    saved = GEMINI_CONFIG.model
  }
  const groups = [
    ["Usually free in AI Studio", GEMINI_MODELS.filter((item) => item.tier === "free")],
    ["Paid or limited quota", GEMINI_MODELS.filter((item) => item.tier === "paid")],
  ]
  els.geminiModel.innerHTML = groups
    .map(([label, items]) => {
      if (!items.length) return ""
      return `<optgroup label="${escapeHtml(label)}">${items
        .map((item) => {
          const tag = item.tier === "free" ? "free tier" : "paid"
          return `<option value="${escapeHtml(item.id)}" title="${escapeHtml(item.note)}">${escapeHtml(item.label)} — ${tag}</option>`
        })
        .join("")}</optgroup>`
    })
    .join("")
  els.geminiModel.value = saved
}

function rememberGeminiModel() {
  try {
    sessionStorage.setItem(MODEL_STORAGE, selectedGeminiModel())
  } catch {
    /* ignore */
  }
}

function pdfFileKey(file = state.file) {
  if (!file) return ""
  return `${file.name}:${file.size}:${file.lastModified}`
}

async function extractPdfOnServer(file) {
  const body = new FormData()
  body.append("resume", file, file.name || "resume.pdf")
  const response = await fetch("/api/ats/extract", { method: "POST", body })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Could not read this PDF.")
  return String(data.text || "")
}

async function resumeTextFromPdf(onStatus = setStatus) {
  if (!state.file) throw new Error("Choose a PDF first.")
  const key = pdfFileKey()
  if (state.pdfText && state.pdfKey === key) return state.pdfText
  let text = ""
  try {
    text = await extractPdfFile(state.file, { onStatus })
  } catch (err) {
    try {
      onStatus?.("Trying server PDF reader…")
      text = await extractPdfOnServer(state.file)
    } catch {
      throw err
    }
    if ((text.replace(/[^0-9A-Za-z]/g, "").length || 0) < 80) throw err
  }
  state.pdfText = text
  state.pdfKey = key
  return text
}

function resetAiPanel() {
  if (els.aiResults) els.aiResults.hidden = true
  if (els.aiBars) els.aiBars.innerHTML = ""
  if (els.aiReqTable) els.aiReqTable.innerHTML = ""
  if (!state.geminiBusy) setGeminiStatus("Gemini is not run automatically.")
}

async function loadResumeForGemini() {
  const jdText = els.jd.value.trim()
  if (jdText.length <= 20) {
    throw Object.assign(new Error("Paste the complete job description."), { code: "empty" })
  }
  if (state.source === "pdf") {
    const extracted = await resumeTextFromPdf(setGeminiStatus)
    return {
      resumeText: formatResumeForGemini({ extractedPdfText: extracted }),
      jdText,
    }
  }
  const library = loadLibrary()
  const item = library.items.find((entry) => entry.id === state.resumeId)
  if (!item?.text?.trim()) throw Object.assign(new Error("Choose a resume from the library."), { code: "empty" })
  return {
    resumeText: formatResumeForGemini({
      libraryText: item.text,
      structured: structuredFromText(item.text),
    }),
    jdText,
  }
}

function renderAiResults(data) {
  const overall = Number.isFinite(Number(data.overall_alignment)) ? Math.round(Number(data.overall_alignment)) : 0
  paintScore(els.aiScoreNum, els.aiScoreRing, els.aiScoreHero, els.aiScoreBand, overall)
  els.aiDisclaimer.textContent = AI_DISCLAIMER
  const bars = [
    ["Technical Alignment", data.technical_alignment],
    ["Experience Alignment", data.experience_alignment],
    ["Education Alignment", data.education_alignment],
    ["Project Alignment", data.project_alignment],
    ["Achievement Strength", data.achievement_strength],
  ]
  els.aiBars.innerHTML = `<h2 class="ats-breakdown-title">Alignment breakdown</h2>${bars
    .map(
      ([label, score]) => `<div class="ats-bar">
        <div><span>${escapeHtml(label)}</span><strong>${score} / 100</strong></div>
        <i><b style="width:${score}%"></b></i>
      </div>`
    )
    .join("")}`
  els.aiStrengths.innerHTML = listBlock("AI Strengths", data.strengths, "No strengths returned.")
  els.aiGaps.innerHTML = listBlock("Important Gaps", data.important_gaps, "No important gaps returned.")
  els.aiSemantic.innerHTML = listBlock("Semantic Matches", data.semantic_matches, "No semantic matches returned.")
  els.aiExperienceGaps.innerHTML = listBlock("Missing Experience", data.experience_gaps, "No experience gaps returned.")
  els.aiImprovements.innerHTML = listBlock("Potential Improvements", data.improvements, "No extra suggestions.")
  const statusClass = {
    matched: "ats-status-matched",
    partially_matched: "ats-status-partial",
    claimed: "ats-status-claimed",
    not_found: "ats-status-miss",
  }
  const statusLabels = {
    matched: "Matched",
    partially_matched: "Partially matched",
    claimed: "Claimed — no supporting evidence",
    not_found: "Not found",
  }
  const evidenceLabels = {
    direct_experience: "Direct experience",
    project_experience: "Project experience",
    skill_mention: "Skill mention",
    education_coursework: "Education / coursework",
    semantic_inference: "Semantic inference",
    no_evidence: "No evidence",
  }
  els.aiReqTable.innerHTML = (data.requirement_analysis || [])
    .map((row) => {
      const status = row.status || "not_found"
      const evidenceType = evidenceLabels[row.evidence_type] ? row.evidence_type : "no_evidence"
      return `<tr>
        <td>${escapeHtml(row.requirement)}</td>
        <td>${escapeHtml(row.importance)}</td>
        <td class="${statusClass[status] || ""}">${escapeHtml(statusLabels[status] || status.replaceAll("_", " "))}</td>
        <td class="ats-evidence-${evidenceType}">${escapeHtml(evidenceLabels[evidenceType])}</td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${escapeHtml(row.resume_evidence)}</td>
      </tr>`
    })
    .join("")
  els.aiResults.hidden = false
}

async function runGeminiAnalysis() {
  if (state.geminiBusy || !els.geminiRun) return
  const apiKey = els.geminiKey?.value || ""
  if (!apiKey.trim()) {
    setGeminiStatus("Enter your Gemini API key first.", "error")
    trackEvent("ai_analysis_failed", { source_type: state.source, error_code: "missing_key" })
    return
  }
  if (!hasResume() || els.jd.value.trim().length <= 20) {
    setGeminiStatus("Choose a resume and paste a job description first.", "error")
    return
  }
  state.geminiBusy = true
  els.geminiRun.disabled = true
  setGeminiStatus("Analyzing resume...")
  trackEvent("ai_analysis_started", { source_type: state.source })
  try {
    const payload = await loadResumeForGemini()
    const model = selectedGeminiModel()
    const data = await analyzeWithGemini({
      apiKey,
      resumeText: payload.resumeText,
      jdText: payload.jdText,
      model,
      currentDate: await loadCurrentDate(),
    })
    rememberKeyIfChosen()
    rememberGeminiModel()
    renderAiResults(data)
    els.aiResults?.scrollIntoView({ behavior: "smooth", block: "start" })
    trackEvent("ai_analysis_completed", { source_type: state.source })
    setGeminiStatus(`AI analysis complete (${geminiModelLabel(model)}).`, "ok")
  } catch (err) {
    const code = err?.code || "unknown"
    trackEvent("ai_analysis_failed", { source_type: state.source, error_code: String(code).replace(/[^a-z_]/g, "").slice(0, 40) || "unknown" })
    setGeminiStatus(err.message || "Gemini analysis failed.", "error")
  } finally {
    state.geminiBusy = false
    refreshReady()
  }
}

function renderResults(data) {
  paintScore(els.scoreNum, els.scoreRing, els.scoreHero, els.scoreBand, data.score)
  els.disclaimer.textContent = data.disclaimer || ""
  els.warning.textContent = data.warning || ""
  const order = [
    "required",
    "preferred",
    "experience_relevance",
    "keyword_relevance",
    "education",
    "structure",
    "extractability",
  ]
  els.bars.innerHTML = `<h2 class="ats-breakdown-title">Score breakdown</h2>${order
    .map((key) => {
      const row = data.breakdown?.[key]
      if (!row) return ""
      return `<div class="ats-bar">
        <div><span>${escapeHtml(row.label)} <small>${row.weight}%</small></span><strong>${row.score} / 100</strong></div>
        <i><b style="width:${row.score}%"></b></i>
      </div>`
    })
    .join("")}`
  els.matched.innerHTML = chips(data.strong_matches || data.matched, "No strong matches yet.")
  els.missing.innerHTML = chips(data.important_gaps || data.missing, "No important required or preferred gaps.")
  const tableRows = data.requirements_table || data.skill_rows || []
  els.skillTable.innerHTML = tableRows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.term)}</td>
        <td>${escapeHtml(row.category || "")}</td>
        <td>${escapeHtml(row.importance || "")}</td>
        <td class="kind-${String(row.match_type || row.kind).includes("Not Found") ? "miss" : "hit"}">${escapeHtml(row.match_type || row.kind || "")}</td>
        <td>${escapeHtml(row.evidence || "")}</td>
      </tr>`
    )
    .join("")
  els.strengths.innerHTML = listBlock("Resume strengths", data.strengths, "No extra strengths flagged.")
  els.improvements.innerHTML = listBlock("Potential improvements", data.improvements, "No extra suggestions.")
  const exp = data.experience || {}
  els.experience.innerHTML = `<h2>Experience</h2>
    <p class="ats-lead">${escapeHtml(exp.detail || "Experience duration could not be reliably determined.")}</p>
    <ul class="ats-req">
      <li><span>Full-time</span><em>${exp.full_time_years == null ? "Not determined" : `${exp.full_time_years} years`}</em></li>
      <li><span>Internships</span><em>${exp.intern_years ? `${exp.intern_years} years` : "Not counted as full-time"}</em></li>
      <li><span>JD requirement</span><em>${exp.required_years ? `${exp.required_years}+ years` : "None detected"}</em></li>
    </ul>`
  const sections = data.structure?.sections || []
  els.structure.innerHTML = `<h2>Resume structure</h2>
    <ul class="ats-req">${sections
      .map(
        (row) => `<li class="${row.present ? "met" : row.optional ? "optional" : "missing"}">
          <span>${escapeHtml(row.label)}</span>
          <em>${escapeHtml(row.display || (row.present ? "Present" : row.optional ? "Optional — Not provided" : "Not found"))}</em>
        </li>`
      )
      .join("")}</ul>`
  const extract = data.extractability || data.formatting || {}
  const checks = extract.checks || []
  els.formatting.innerHTML = `<h2>ATS Extractability</h2>
    <p class="ats-lead">${extract.score != null ? `${extract.score} / 100. This does not guarantee compatibility with every ATS.` : ""}</p>
    <ul class="ats-req">${checks
      .map(
        (row) => `<li class="${row.ok ? "met" : "missing"}">
          <span>${escapeHtml(row.label || row.detail)}</span>
          <em>${row.score != null ? `${row.score}` : ""}</em>
        </li>`
      )
      .join("")}</ul>`
  els.results.hidden = false
  els.results.scrollIntoView({ behavior: "smooth", block: "start" })
}

async function analyze() {
  if (els.analyze.disabled) return
  els.analyze.disabled = true
  trackEvent("ats_analysis_started", { source_type: state.source })
  setStatus(state.source === "pdf" ? "Reading PDF…" : "Analyzing on the Resuform server…")
  try {
    let response
    if (state.source === "pdf") {
      if (!state.file) throw new Error("Choose a PDF first.")
      const resumeText = await resumeTextFromPdf(setStatus)
      state.lastResumeText = resumeText
      state.lastStructured = null
      setStatus("Analyzing on the Resuform server…")
      response = await fetch("/api/ats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "pdf",
          resume_text: resumeText,
          jd_text: els.jd.value,
        }),
      })
    } else {
      const library = loadLibrary()
      const item = library.items.find((entry) => entry.id === state.resumeId)
      if (!item?.text?.trim()) throw new Error("Choose a resume from the library.")
      state.lastResumeText = item.text
      state.lastStructured = structuredFromText(item.text)
      response = await fetch("/api/ats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "library",
          resume_text: item.text,
          jd_text: els.jd.value,
          structured: structuredFromText(item.text),
        }),
      })
    }
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not analyze this resume.")
    if (state.source === "pdf") {
      state.lastResumeText = state.lastResumeText || data.extracted_resume_text || ""
      state.lastStructured = null
    }
    state.lastJdText = els.jd.value
    renderResults(data)
    trackEvent("ats_analysis_completed", { source_type: state.source, score: data.score })
    setStatus("Analysis complete.", "ok")
    refreshReady()
  } catch (err) {
    setStatus(err.message || String(err), "error")
    els.analyze.disabled = false
  }
}

document.querySelectorAll(".ats-source-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => setSource(btn.dataset.source))
})
els.libraryList.addEventListener("change", (event) => {
  if (event.target.name === "ats-resume") {
    state.resumeId = event.target.value
    refreshReady()
  }
})
els.pdf.addEventListener("change", () => {
  state.file = els.pdf.files?.[0] || null
  state.pdfText = ""
  state.pdfKey = ""
  els.pdfName.textContent = state.file
    ? state.file.name
    : "PDF text is read in this browser, including image-only files. The first image PDF can take a minute."
  resetAiPanel()
  refreshReady()
})
els.jd.addEventListener("input", refreshReady)
els.analyze.addEventListener("click", analyze)
els.again.addEventListener("click", () => {
  els.results.hidden = true
  resetAiPanel()
  window.scrollTo({ top: 0, behavior: "smooth" })
  refreshReady()
})

if (els.geminiToggle && els.geminiKey) {
  els.geminiToggle.addEventListener("click", () => {
    const hidden = els.geminiKey.type === "password"
    els.geminiKey.type = hidden ? "text" : "password"
    els.geminiToggle.textContent = hidden ? "Hide" : "Show"
  })
}
if (els.geminiKeep) {
  const saved = loadSessionKey()
  if (saved) {
    els.geminiKeep.checked = true
    els.geminiKey.value = saved
  }
  els.geminiKeep.addEventListener("change", rememberKeyIfChosen)
}
if (els.geminiKey) {
  els.geminiKey.addEventListener("change", rememberKeyIfChosen)
}
if (els.geminiRun) els.geminiRun.addEventListener("click", runGeminiAnalysis)
if (els.geminiModel) {
  fillGeminiModels()
  els.geminiModel.addEventListener("change", rememberGeminiModel)
}

renderLibrary()
window.addEventListener("storage", (event) => {
  if (event.key === LIBRARY_KEY) renderLibrary()
})
