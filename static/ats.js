import { loadLibrary } from "./library.js"
import { parseResumeText } from "./parse.js"
import { initAnalytics, trackEvent } from "./analytics.js"

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
  disclaimer: document.getElementById("ats-disclaimer"),
  bars: document.getElementById("ats-bars"),
  matched: document.getElementById("ats-matched"),
  missing: document.getElementById("ats-missing"),
  warning: document.getElementById("ats-warning"),
  skillTable: document.querySelector("#ats-skill-table tbody"),
  requirements: document.getElementById("ats-requirements"),
  structure: document.getElementById("ats-structure"),
  formatting: document.getElementById("ats-formatting"),
  again: document.getElementById("ats-again"),
}

const state = {
  source: "library",
  resumeId: "",
  file: null,
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
  if (!hasResume()) setStatus("Choose a resume and paste a job description.")
  else if (!els.jd.value.trim()) setStatus("Paste a job description to continue.")
  else if (els.jd.value.trim().length <= 20) setStatus("Paste the complete job description.")
  else setStatus("Ready to analyze.")
}

function structuredFromText(text) {
  const resume = parseResumeText(text)
  const skillsText = (resume.skills || []).map((row) => `${row.category || ""} ${row.items || ""}`).join(" ")
  const roles = [...(resume.experience || []), ...(resume.internships || []), ...(resume.projects || [])]
  const experienceText = roles.map((item) =>
    [item.company, item.title, item.name, item.tech, item.bullets].filter(Boolean).join(" ")
  )
  return {
    headline: resume.headline || "",
    skills_text: skillsText,
    experience_text: experienceText,
    has_contact: Boolean(resume.email || resume.phone),
    has_summary: Boolean(resume.summary?.trim()),
    has_education: Boolean(resume.education?.length),
    has_experience: Boolean(resume.experience?.length),
    has_internships: Boolean(resume.internships?.length),
    has_projects: Boolean(resume.projects?.length),
    has_skills: Boolean(resume.skills?.length),
    has_responsibilities: Boolean(resume.responsibilities?.length),
    has_extracurricular: Boolean(resume.extracurricular?.length),
    has_certifications: /certif/i.test(text),
  }
}

function renderLibrary() {
  const library = loadLibrary()
  const items = library.items || []
  if (!items.length) {
    els.libraryList.innerHTML = `<li class="ats-empty">No resumes in this browser yet. Save one from the resume builder, or upload a PDF.</li>`
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
  return items.map((item) => `<span class="ats-chip">${escapeHtml(item.term)}</span>`).join("")
}

function reqGroup(title, items) {
  if (!items?.length) return ""
  const rows = items
    .map(
      (item) => `<li class="${item.status}">
        <span>${escapeHtml(item.label)}</span>
        <em>${item.status === "met" ? "Appears matched" : "Not found"}</em>
      </li>`
    )
    .join("")
  return `<h3>${title}</h3><ul class="ats-req">${rows}</ul>`
}

function renderResults(data) {
  els.scoreNum.textContent = `${data.score} / 100`
  els.disclaimer.textContent = data.disclaimer || ""
  els.warning.textContent = data.warning || ""
  const order = [
    "keyword_match",
    "technical_skills",
    "requirements",
    "experience_relevance",
    "section_completeness",
    "formatting",
  ]
  els.bars.innerHTML = order
    .map((key) => {
      const row = data.breakdown?.[key]
      if (!row) return ""
      return `<div class="ats-bar">
        <div><span>${escapeHtml(row.label)}</span><strong>${row.score}%</strong></div>
        <i><b style="width:${row.score}%"></b></i>
      </div>`
    })
    .join("")
  els.matched.innerHTML = chips(data.matched, "No catalog skills from the job description were found on the resume.")
  els.missing.innerHTML = chips(data.missing, "No obvious missing catalog skills.")
  els.skillTable.innerHTML = (data.skill_rows || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.term)}</td>
        <td class="kind-${row.kind === "Not Found" ? "miss" : "hit"}">${escapeHtml(row.kind)}</td>
      </tr>`
    )
    .join("")
  const req = data.requirements || {}
  els.requirements.innerHTML = `<h2>Job requirements</h2>
    ${reqGroup("Technical skills", req.technical_skills)}
    ${reqGroup("Education", req.education)}
    ${reqGroup("Experience", req.experience)}
    ${reqGroup("Certifications", req.certifications)}
    ${reqGroup("Tools / technologies", req.tools)}
    ${reqGroup("Other requirements", req.other)}`
  const sections = data.structure?.sections || []
  els.structure.innerHTML = `<h2>Resume structure</h2>
    <ul class="ats-req">${sections
      .map(
        (row) => `<li class="${row.present ? "met" : "missing"}">
          <span>${escapeHtml(row.label)}${row.emphasized ? "" : " <small>(optional)</small>"}</span>
          <em>${row.present ? "Present" : "Not found"}</em>
        </li>`
      )
      .join("")}</ul>`
  const checks = data.formatting?.checks || []
  els.formatting.innerHTML = `<h2>Formatting / extractability</h2>
    <ul class="ats-req">${checks
      .map(
        (row) => `<li class="${row.ok ? "met" : "missing"}">
          <span>${escapeHtml(row.detail)}</span>
        </li>`
      )
      .join("")}</ul>`
  els.form.hidden = true
  els.results.hidden = false
  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function analyze() {
  if (els.analyze.disabled) return
  els.analyze.disabled = true
  setStatus("Analyzing on the Resuform server…")
  try {
    let response
    if (state.source === "pdf") {
      if (!state.file) throw new Error("Choose a PDF first.")
      const body = new FormData()
      body.append("resume", state.file, state.file.name || "resume.pdf")
      body.append("jd_text", els.jd.value)
      response = await fetch("/api/ats/analyze", { method: "POST", body })
    } else {
      const library = loadLibrary()
      const item = library.items.find((entry) => entry.id === state.resumeId)
      if (!item?.text?.trim()) throw new Error("Choose a resume from the library.")
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
    renderResults(data)
    trackEvent("ats_analyzed", { source_type: state.source, score: data.score })
    setStatus("Analysis complete.", "ok")
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
  els.pdfName.textContent = state.file ? state.file.name : "PDF text is extracted on the Resuform server. Scanned image PDFs cannot be read."
  refreshReady()
})
els.jd.addEventListener("input", refreshReady)
els.analyze.addEventListener("click", analyze)
els.again.addEventListener("click", () => {
  els.results.hidden = true
  els.form.hidden = false
  refreshReady()
})

renderLibrary()
