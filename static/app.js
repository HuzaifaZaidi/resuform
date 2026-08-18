import { FORMAT_GUIDE, SAMPLE_TEXT, emptyResume } from "./sample.js"
import { parseResumeText, serializeResume } from "./parse.js"
import { generateLatex } from "./latex.js"
import { renderPreview } from "./preview.js"
import { blankText, loadLibrary, makeItem, renameItem, saveLibrary, titleFromText, upsertCurrent } from "./library.js"
import { DEFAULT_ORDER, SECTION_DEFS, ensureResume, sectionDef } from "./sections.js"
import {
  defaultMargins,
  marginsMatchTemplate,
  normalizeLineSpacing,
  normalizeMargins,
} from "./layout.js"
import { initAnalytics, trackEvent } from "./analytics.js"

initAnalytics()

const STORAGE_KEY = "pica-resume-v1"
const TEMPLATES = ["classic", "modern", "compact", "two_column", "modern_photo", "two_column_photo"]
const PHOTO_TEMPLATES = ["modern_photo", "two_column_photo"]

const els = {
  source: document.getElementById("source"),
  fields: document.getElementById("fields"),
  proof: document.getElementById("proof"),
  texView: document.getElementById("tex-view"),
  pdfFrame: document.getElementById("pdf-frame"),
  pdfPane: document.getElementById("pdf-pane"),
  pdfEmpty: document.getElementById("pdf-empty"),
  proofStage: document.getElementById("proof-stage"),
  status: document.getElementById("status"),
  log: document.getElementById("log"),
  template: document.getElementById("template"),
  page: document.getElementById("page"),
  layoutPop: document.getElementById("layout-pop"),
  marginTop: document.getElementById("margin-top"),
  marginRight: document.getElementById("margin-right"),
  marginBottom: document.getElementById("margin-bottom"),
  marginLeft: document.getElementById("margin-left"),
  lineSpacing: document.getElementById("line-spacing"),
  typeset: document.getElementById("typeset"),
  downloadPdf: document.getElementById("download-pdf"),
  downloadTex: document.getElementById("download-tex"),
  example: document.getElementById("example"),
  clearFields: document.getElementById("clear-fields"),
  guide: document.getElementById("guide"),
  toggleGuide: document.getElementById("toggle-guide"),
  libraryBtn: document.getElementById("library-btn"),
  library: document.getElementById("library"),
  libraryBackdrop: document.getElementById("library-backdrop"),
  libraryClose: document.getElementById("library-close"),
  libraryList: document.getElementById("library-list"),
  resumeNew: document.getElementById("resume-new"),
  resumeSave: document.getElementById("resume-save"),
}

const state = {
  mode: "fields",
  view: "proof",
  text: SAMPLE_TEXT,
  resume: parseResumeText(SAMPLE_TEXT),
  template: "classic",
  page: "letter",
  photo: "",
  margins: defaultMargins("classic"),
  lineSpacing: 1,
  pdfUrl: "",
  pdfBlob: null,
  compiling: false,
  dirty: true,
  currentId: "",
  createdAt: Date.now(),
}

const library = loadLibrary()

function setStatus(message, kind = "") {
  els.status.textContent = message
  els.status.className = `status ${kind}`.trim()
}

function attachLayout(resume) {
  resume.page = state.page
  resume.photo = state.photo
  resume.margins = state.margins
  resume.lineSpacing = state.lineSpacing
  return resume
}

function currentLatex() {
  return generateLatex(attachLayout({ ...state.resume }), state.template)
}

function syncLayoutInputs() {
  if (!els.marginTop) return
  els.marginTop.value = state.margins.top
  els.marginRight.value = state.margins.right
  els.marginBottom.value = state.margins.bottom
  els.marginLeft.value = state.margins.left
  els.lineSpacing.value = state.lineSpacing
}

function readLayoutFromForm() {
  state.margins = normalizeMargins(
    {
      top: els.marginTop.value,
      right: els.marginRight.value,
      bottom: els.marginBottom.value,
      left: els.marginLeft.value,
    },
    state.template
  )
  state.lineSpacing = normalizeLineSpacing(els.lineSpacing.value)
  syncLayoutInputs()
}

function refreshPreview() {
  state.resume = parseResumeText(state.text)
  ensureResume(state.resume)
  attachLayout(state.resume)
  els.proof.innerHTML = renderPreview(state.resume, state.template)
  const page = els.proof.querySelector(".resume-page")
  if (page) {
    const frame = els.proof
    const maxW = els.proofStage.clientWidth - 48
    const scale = Math.min(1, maxW / page.offsetWidth)
    frame.style.transform = `scale(${scale})`
    frame.style.width = `${page.offsetWidth}px`
    frame.style.marginBottom = `${(scale - 1) * page.offsetHeight}px`
  }
  els.texView.textContent = currentLatex()
}

function persist() {
  const item = upsertCurrent(library, {
    id: state.currentId,
    text: state.text,
    template: state.template,
    page: state.page,
    photo: state.photo,
    margins: state.margins,
    lineSpacing: state.lineSpacing,
    createdAt: state.createdAt,
  })
  state.currentId = item.id
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      text: state.text,
      template: state.template,
      page: state.page,
      photo: state.photo,
      margins: state.margins,
      lineSpacing: state.lineSpacing,
    })
  )
  if (!els.library.hidden) renderLibrary()
}

function field(id, label, value, multiline = false) {
  const control = multiline
    ? `<textarea data-path="${id}">${escapeAttr(value)}</textarea>`
    : `<input data-path="${id}" value="${escapeAttr(value)}" />`
  return `<label>${label}${control}</label>`
}

const openSections = new Set(["personal"])

function sectionBlock(title, tools, body, sectionId = "", blockId = "") {
  const id = sectionId || blockId
  const attr = [
    sectionId ? `data-section="${sectionId}"` : "",
    blockId ? `data-block="${blockId}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const isOpen = openSections.has(id)
  return `<details class="field-group"${isOpen ? " open" : ""}${attr ? ` ${attr}` : ""}>
    <summary>
      <span class="field-title">${title}</span>
      <span class="field-tools"${tools ? " data-stop-toggle" : ""}>${tools || ""}</span>
      <span class="field-chevron" aria-hidden="true"></span>
    </summary>
    <div class="field-body">${body}</div>
  </details>`
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const max = 480
      const scale = Math.min(1, max / Math.max(image.width, image.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("bad image"))
    }
    image.src = url
  })
}

function roleCards(kind, items, orgLabel, roleLabel) {
  return (items || [])
    .map((item, i) => {
      const heading = item.title || item.company || `Entry ${i + 1}`
      const sub = [item.company && item.title ? item.company : "", item.dates].filter(Boolean).join(" · ")
      return `<div class="card">
        <div class="card-head">
          <div><strong>${escapeAttr(heading)}</strong>${sub ? `<em>${escapeAttr(sub)}</em>` : ""}</div>
          <button type="button" data-remove="${kind}:${i}">Remove</button>
        </div>
        <div class="grid-2">
          ${field(`${kind}.${i}.company`, orgLabel, item.company)}
          ${field(`${kind}.${i}.title`, roleLabel, item.title)}
          ${field(`${kind}.${i}.location`, "Location", item.location)}
          ${field(`${kind}.${i}.dates`, "Dates", item.dates)}
        </div>
        ${field(`${kind}.${i}.bullets`, "Details (one per line)", item.bullets, true)}
      </div>`
    })
    .join("")
}

function sectionChrome(id, extra = "") {
  return `<span class="section-move">
    <button type="button" data-move="${id}:-1" title="Move up">Up</button>
    <button type="button" data-move="${id}:1" title="Move down">Down</button>
  </span>${extra}`
}

function renderSectionFields(r, id) {
  const def = sectionDef(id)
  if (!def) return ""
  if (def.kind === "text") {
    return sectionBlock(def.label, sectionChrome(id), field("summary", "Summary", r.summary, true), id)
  }
  if (def.kind === "education") {
    const tableEdu = r.educationLayout === "table"
    const edu = (r.education || [])
      .map((item, i) =>
        tableEdu
          ? `<div class="card">
        <div class="card-head">
          <div><strong>${escapeAttr(item.degree || item.school || `Row ${i + 1}`)}</strong>${item.school ? `<em>${escapeAttr(item.school)}</em>` : ""}</div>
          <button type="button" data-remove="education:${i}">Remove</button>
        </div>
        <div class="grid-2">
          ${field(`education.${i}.degree`, "Course", item.degree)}
          ${field(`education.${i}.school`, "Institute", item.school)}
          ${field(`education.${i}.dates`, "Year", item.dates)}
          ${field(`education.${i}.score`, "CGPA/%", item.score || "")}
        </div>
      </div>`
          : `<div class="card">
        <div class="card-head">
          <div><strong>${escapeAttr(item.degree || item.school || `Education ${i + 1}`)}</strong>${item.school && item.degree ? `<em>${escapeAttr(item.school)}</em>` : ""}</div>
          <button type="button" data-remove="education:${i}">Remove</button>
        </div>
        <div class="grid-2">
          ${field(`education.${i}.school`, "School", item.school)}
          ${field(`education.${i}.degree`, "Degree", item.degree)}
          ${field(`education.${i}.location`, "Location", item.location)}
          ${field(`education.${i}.dates`, "Dates", item.dates)}
        </div>
        ${field(`education.${i}.details`, "Details (one per line)", item.details, true)}
      </div>`
      )
      .join("")
    return sectionBlock(
      def.label,
      `<button type="button" data-add="education">Add</button>
        ${sectionChrome(id, `<span class="layout-toggle">
          <button type="button" data-edu-layout="list" class="${tableEdu ? "" : "on"}">List</button>
          <button type="button" data-edu-layout="table" class="${tableEdu ? "on" : ""}">Table</button>
        </span>`)}`,
      edu || "<p class='hint'>No schools yet.</p>",
      id
    )
  }
  if (def.kind === "roles") {
    const cards = roleCards(id, r[id], def.org, def.role)
    const optional = def.core ? "" : `<button type="button" data-drop-section="${id}">Remove</button>`
    return sectionBlock(
      def.label,
      `<button type="button" data-add="${id}">Add</button> ${sectionChrome(id, optional)}`,
      cards || "<p class='hint'>No entries yet.</p>",
      id
    )
  }
  if (def.kind === "projects") {
    const projects = (r.projects || [])
      .map(
        (item, i) => `<div class="card">
        <div class="card-head">
          <div><strong>${escapeAttr(item.name || `Project ${i + 1}`)}</strong>${item.tech ? `<em>${escapeAttr(item.tech)}</em>` : ""}</div>
          <button type="button" data-remove="projects:${i}">Remove</button>
        </div>
        <div class="grid-2">
          ${field(`projects.${i}.name`, "Name", item.name)}
          ${field(`projects.${i}.tech`, "Tech", item.tech)}
          ${field(`projects.${i}.link`, "Link", item.link)}
          ${field(`projects.${i}.dates`, "Dates", item.dates)}
        </div>
        ${field(`projects.${i}.bullets`, "Details (one per line)", item.bullets, true)}
      </div>`
      )
      .join("")
    return sectionBlock(
      def.label,
      `<button type="button" data-add="projects">Add</button> ${sectionChrome(id)}`,
      projects || "<p class='hint'>No projects yet.</p>",
      id
    )
  }
  if (def.kind === "skills") {
    const colSkills = r.skillsLayout === "columns"
    const skills = (r.skills || [])
      .map(
        (item, i) => `<div class="card">
        <div class="card-head">
          <div><strong>${escapeAttr(item.category || `Skill group ${i + 1}`)}</strong></div>
          <button type="button" data-remove="skills:${i}">Remove</button>
        </div>
        <div class="grid-2">
          ${field(`skills.${i}.category`, "Category", item.category)}
          ${field(`skills.${i}.items`, "Items", item.items)}
        </div>
      </div>`
      )
      .join("")
    return sectionBlock(
      def.label,
      `<button type="button" data-add="skills">Add</button>
        ${sectionChrome(id, `<span class="layout-toggle">
          <button type="button" data-skills-layout="list" class="${colSkills ? "" : "on"}">List</button>
          <button type="button" data-skills-layout="columns" class="${colSkills ? "on" : ""}">Columns</button>
        </span>`)}`,
      skills || "<p class='hint'>No skills yet.</p>",
      id
    )
  }
  return ""
}

function renderFields() {
  const r = ensureResume(state.resume)
  const order = r.sectionOrder?.length ? r.sectionOrder : DEFAULT_ORDER
  const unused = SECTION_DEFS.filter((def) => !order.includes(def.id))
  const addOptions = unused
    .map((def) => `<option value="${def.id}">${def.label}</option>`)
    .join("")
  els.fields.innerHTML = `
    ${sectionBlock(
      "Personal information",
      "",
      `<div class="grid-2">
        ${field("name", "Name", r.name)}
        ${field("headline", "Headline", r.headline)}
        ${field("phone", "Phone", r.phone)}
        ${field("email", "Email", r.email)}
        ${field("location", "Location", r.location)}
        ${field("website", "Website", r.website)}
        ${field("linkedin", "LinkedIn", r.linkedin)}
        ${field("github", "GitHub", r.github)}
      </div>
      <label>Photo
        <input type="file" id="photo-file" accept="image/*" />
      </label>
      ${state.photo ? `<div class="photo-edit"><img src="${state.photo}" alt="Candidate photo" /><button type="button" id="photo-clear">Remove photo</button></div>` : `<p class="hint">Used by Modern (photo) and Two Column (photo). Pick a headshot, then switch to one of those templates.</p>`}`,
      "",
      "personal"
    )}
    ${sectionBlock(
      "Formatting / layout",
      "",
      `<p class="hint">Use Up/Down on each section, or add Internships, Fieldwork, POR, Extra Curricular. Template, paper size, and margins are in the header.</p>
      ${addOptions ? `<label>Add section
        <select id="add-section">
          <option value="">Choose…</option>
          ${addOptions}
        </select>
      </label>` : "<p class='hint'>All optional sections are on the resume.</p>"}`,
      "",
      "layout"
    )}
    ${order.map((id) => renderSectionFields(r, id)).join("")}
  `
  document.getElementById("add-section")?.addEventListener("change", (event) => {
    const id = event.target.value
    if (id) addSection(id)
  })
  document.getElementById("photo-file")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      state.photo = await compressPhoto(file)
      persist()
      refreshPreview()
      renderFields()
      setStatus("Photo added. Choose a photo template to see it on the resume.")
    } catch {
      setStatus("Could not read that image.", "error")
    }
  })
  document.getElementById("photo-clear")?.addEventListener("click", () => {
    state.photo = ""
    persist()
    refreshPreview()
    renderFields()
  })
  els.fields.querySelectorAll("details.field-group").forEach((group) => {
    group.addEventListener("toggle", () => {
      const id = group.dataset.section || group.dataset.block
      if (!id) return
      if (group.open) openSections.add(id)
      else openSections.delete(id)
    })
  })
}

function setByPath(path, value) {
  const parts = path.split(".")
  if (parts.length === 1) {
    state.resume[parts[0]] = value
    return
  }
  const [list, index, key] = parts
  state.resume[list][Number(index)][key] = value
}

function addItem(kind) {
  const id = crypto.randomUUID()
  ensureResume(state.resume)
  if (kind) openSections.add(kind)
  if (kind === "education") {
    state.resume.education.push({ id, school: "", degree: "", location: "", dates: "", details: "", score: "" })
  } else if (kind === "projects") {
    state.resume.projects.push({ id, name: "", tech: "", link: "", dates: "", bullets: "" })
  } else if (kind === "skills") {
    state.resume.skills.push({ id, category: "", items: "" })
  } else if (["experience", "internships", "fieldwork", "responsibilities", "extracurricular"].includes(kind)) {
    if (!Array.isArray(state.resume[kind])) state.resume[kind] = []
    state.resume[kind].push({ id, company: "", title: "", location: "", dates: "", bullets: "" })
  }
  syncFromFields()
}

function moveSection(id, delta) {
  ensureResume(state.resume)
  const order = [...state.resume.sectionOrder]
  const index = order.indexOf(id)
  const next = index + Number(delta)
  if (index < 0 || next < 0 || next >= order.length) return
  ;[order[index], order[next]] = [order[next], order[index]]
  state.resume.sectionOrder = order
  syncFromFields()
  trackEvent("section_reordered", { section_count: order.length })
}

function addSection(id) {
  ensureResume(state.resume)
  if (id) openSections.add(id)
  const order = state.resume.sectionOrder
  const added = !order.includes(id)
  if (added) {
    const after = {
      internships: order.includes("education") ? "education" : "",
      fieldwork: order.includes("internships") ? "internships" : order.includes("education") ? "education" : "",
      responsibilities: order.includes("experience") ? "experience" : "",
      extracurricular: order.includes("projects") ? "projects" : "",
    }[id]
    const at = after ? order.indexOf(after) + 1 : order.indexOf("skills")
    if (at >= 0) order.splice(at, 0, id)
    else order.push(id)
  }
  const def = sectionDef(id)
  if (def?.kind === "roles" && !state.resume[id]?.length) addItem(id)
  else syncFromFields()
  if (added) trackEvent("section_added", { section_type: id })
}

function dropSection(id) {
  ensureResume(state.resume)
  const def = sectionDef(id)
  if (def?.core) return
  state.resume.sectionOrder = state.resume.sectionOrder.filter((item) => item !== id)
  if (def?.kind === "roles") state.resume[id] = []
  syncFromFields()
}

function syncFromFields() {
  state.text = serializeResume(state.resume)
  els.source.value = state.text
  persist()
  refreshPreview()
  if (state.mode === "fields") renderFields()
}

function setMode(mode) {
  state.mode = mode
  document.querySelectorAll(".editor-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode)
  })
  els.source.style.display = mode === "text" ? "block" : "none"
  els.fields.classList.toggle("open", mode === "fields")
  if (mode === "fields") {
    state.resume = parseResumeText(state.text)
    ensureResume(state.resume)
    renderFields()
  }
}

function setView(view) {
  state.view = view
  document.querySelectorAll(".preview-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view)
  })
  els.proofStage.classList.toggle("open", view === "proof")
  els.pdfPane.classList.toggle("open", view === "pdf")
  els.texView.classList.toggle("open", view === "tex")
}

function filenameBase() {
  return (state.resume.name || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume"
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.rel = "noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function showPdf(blob) {
  state.pdfBlob = blob
  if (state.pdfUrl && state.pdfUrl.startsWith("blob:")) URL.revokeObjectURL(state.pdfUrl)
  state.pdfUrl = URL.createObjectURL(blob)
  const viewer = document.createElement("iframe")
  viewer.id = "pdf-frame"
  viewer.title = "Compiled PDF"
  viewer.src = state.pdfUrl
  els.pdfFrame.replaceWith(viewer)
  els.pdfFrame = viewer
  els.pdfPane.classList.add("has-pdf")
  els.pdfEmpty.hidden = true
}

function pdfSafeText(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\t\n\r\x20-\x7E]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function addSearchableResumeText(pdf, text) {
  const safe = pdfSafeText(text)
  if (!safe) return
  const pageW = pdf.internal.pageSize.getWidth()
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(255, 255, 255)
  const lines = pdf.splitTextToSize(safe, Math.max(120, pageW - 24))
  pdf.text(lines.slice(0, 400), 12, 16)
}

async function pdfFromProof() {
  refreshPreview()
  if (document.fonts?.ready) await document.fonts.ready
  const source = els.proof.querySelector(".resume-page")
  if (!source) throw new Error("Nothing to print. Add resume content first.")
  const html2canvas = window.html2canvas
  const JsPDF = window.jspdf?.jsPDF
  if (!html2canvas || !JsPDF) throw new Error("PDF tools did not load. Refresh the page and try again.")

  const holder = document.createElement("div")
  holder.setAttribute("aria-hidden", "true")
  holder.style.cssText = "position:fixed;left:-14000px;top:0;background:#fffdf8;"
  const clone = source.cloneNode(true)
  clone.style.transform = "none"
  clone.style.margin = "0"
  holder.appendChild(clone)
  document.body.appendChild(holder)
  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#fffdf8",
      useCORS: true,
      logging: false,
      letterRendering: true,
    })
    const root = clone.getBoundingClientRect()
    const links = [...clone.querySelectorAll("a[href]")].map((anchor) => {
      const box = anchor.getBoundingClientRect()
      return {
        url: anchor.href,
        x: box.left - root.left,
        y: box.top - root.top,
        w: box.width,
        h: box.height,
      }
    })
    const format = state.page === "a4" ? "a4" : "letter"
    const pdf = new JsPDF({ unit: "pt", format, compress: true })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const ratio = pageW / canvas.width
    const pageHeightPx = pageH / ratio
    let y = 0
    let first = true
    while (y < canvas.height - 0.5) {
      const sliceH = Math.min(pageHeightPx, canvas.height - y)
      const slice = document.createElement("canvas")
      slice.width = canvas.width
      slice.height = Math.max(1, Math.round(sliceH))
      slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height)
      if (!first) pdf.addPage()
      if (first) {
        try {
          addSearchableResumeText(pdf, state.text)
        } catch {
          /* visual PDF still works */
        }
      }
      first = false
      pdf.addImage(slice.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pageW, slice.height * ratio, undefined, "FAST")
      y += pageHeightPx
    }
    const scale = canvas.width / root.width
    const pageHeightCss = pageHeightPx / scale
    for (const link of links) {
      if (!link.url || link.url.startsWith("javascript:") || link.w < 1 || link.h < 1) continue
      let top = link.y
      let remain = link.h
      while (remain > 0.5) {
        const pageIndex = Math.max(0, Math.floor(top / pageHeightCss))
        const yOnPage = top - pageIndex * pageHeightCss
        const hOnPage = Math.min(remain, pageHeightCss - yOnPage)
        pdf.setPage(pageIndex + 1)
        pdf.link(
          (link.x / root.width) * pageW,
          (yOnPage / pageHeightCss) * pageH,
          (link.w / root.width) * pageW,
          (hOnPage / pageHeightCss) * pageH,
          { url: link.url }
        )
        top += hOnPage
        remain -= hOnPage
      }
    }
    return pdf.output("blob")
  } finally {
    holder.remove()
  }
}

async function typeset() {
  if (state.compiling) return null
  state.compiling = true
  els.typeset.disabled = true
  const extra = document.getElementById("typeset-from-pdf")
  if (extra) extra.disabled = true
  els.downloadPdf.disabled = true
  setStatus("Building PDF from the proof…")
  els.log.classList.remove("open")
  try {
    const blob = await pdfFromProof()
    showPdf(blob)
    state.dirty = false
    setView("pdf")
    setStatus("PDF ready — same layout as Proof.", "ok")
    trackEvent("pdf_generated", { template_name: state.template })
    return blob
  } catch (err) {
    els.log.textContent = err.message || String(err)
    els.log.classList.add("open")
    setView("pdf")
    setStatus("Could not build PDF from the proof.", "error")
    return null
  } finally {
    state.compiling = false
    els.typeset.disabled = false
    if (extra) extra.disabled = false
    els.downloadPdf.disabled = false
  }
}

function formatWhen(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return ""
  }
}

function applyItem(item, { save = false } = {}) {
  state.currentId = item.id
  state.createdAt = item.createdAt || Date.now()
  state.text = item.text || ""
  state.template = TEMPLATES.includes(item.template) ? item.template : "classic"
  state.page = item.page || "letter"
  state.photo = item.photo || ""
  state.margins = normalizeMargins(item.margins, state.template)
  state.lineSpacing = normalizeLineSpacing(item.lineSpacing)
  state.dirty = true
  state.pdfBlob = null
  library.currentId = item.id
  els.source.value = state.text
  els.template.value = state.template
  els.page.value = state.page
  syncLayoutInputs()
  refreshPreview()
  if (state.mode === "fields") renderFields()
  setView("proof")
  if (save) persist()
  else saveLibrary(library)
}

function renderLibrary() {
  const items = [...library.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  if (!items.length) {
    els.libraryList.innerHTML = `<li class="library-empty"><strong>No resumes yet</strong><p>Create your first resume or load an example to get started.</p></li>`
    return
  }
  els.libraryList.innerHTML = items
    .map((item) => {
      const current = item.id === state.currentId
      return `<li class="${current ? "current" : ""}" data-id="${item.id}">
        <h3>${escapeAttr(item.name || titleFromText(item.text))}${current ? " · open" : ""}</h3>
        <span class="meta">${escapeAttr(item.template || "classic")} template</span>
        <time datetime="">${formatWhen(item.updatedAt)}</time>
        <div class="row-actions">
          <button type="button" data-open="${item.id}">Open</button>
          <button type="button" data-rename="${item.id}">Rename</button>
          <button type="button" data-copy="${item.id}">Duplicate</button>
          <button type="button" data-delete="${item.id}">Delete</button>
        </div>
      </li>`
    })
    .join("")
}

function setLibraryOpen(open) {
  els.library.hidden = !open
  els.libraryBackdrop.hidden = !open
  document.body.style.overflow = open ? "hidden" : ""
  if (open) {
    renderLibrary()
    if (location.hash !== "#library") history.replaceState(null, "", "#library")
  } else if (location.hash === "#library") {
    history.replaceState(null, "", location.pathname + location.search)
  }
}

function openResume(id) {
  persist()
  const item = library.items.find((entry) => entry.id === id)
  if (!item) return
  applyItem(item)
  setLibraryOpen(false)
  setStatus(`Opened ${item.name || "resume"}.`)
}

function newResume() {
  const exists = library.items.some((entry) => entry.id === state.currentId)
  if (exists) persist()
  const item = makeItem({ text: blankText() })
  library.items.unshift(item)
  applyItem(item, { save: true })
  setLibraryOpen(false)
  setStatus("Started a blank resume.")
  trackEvent("resume_created")
}

function saveCopy() {
  const item = makeItem({
    text: state.text,
    template: state.template,
    page: state.page,
    photo: state.photo,
    margins: state.margins,
    lineSpacing: state.lineSpacing,
    name: `${titleFromText(state.text)} copy`,
    customName: true,
  })
  library.items.unshift(item)
  saveLibrary(library)
  renderLibrary()
  setStatus(`Saved copy: ${item.name}`)
  trackEvent("resume_saved")
}

function duplicateResume(id) {
  const source = library.items.find((entry) => entry.id === id)
  if (!source) return
  const item = makeItem({
    ...source,
    id: "",
    name: `${source.name || titleFromText(source.text)} copy`,
    customName: true,
  })
  library.items.unshift(item)
  saveLibrary(library)
  renderLibrary()
  setStatus(`Duplicated ${item.name}.`)
  trackEvent("resume_duplicated")
}

function renameResume(id) {
  const item = library.items.find((entry) => entry.id === id)
  if (!item) return
  const current = item.name || titleFromText(item.text) || "Untitled resume"
  const next = window.prompt("Rename this resume", current)
  if (next == null) return
  const renamed = renameItem(library, id, next)
  if (!renamed) {
    setStatus("Enter a name to rename this resume.")
    return
  }
  renderLibrary()
  setStatus(`Renamed to ${renamed.name}.`)
}

function deleteResume(id) {
  const item = library.items.find((entry) => entry.id === id)
  if (!item) return
  const label = item.name || "this resume"
  if (!confirm(`Delete “${label}”? This cannot be undone.`)) return
  library.items = library.items.filter((entry) => entry.id !== id)
  if (state.currentId === id) {
    const next = library.items[0]
    if (next) applyItem(next, { save: true })
    else newResume()
  } else {
    saveLibrary(library)
    renderLibrary()
  }
  setStatus("Deleted from library.")
  trackEvent("resume_deleted")
}

function restore() {
  const current = library.items.find((entry) => entry.id === library.currentId) || library.items[0]
  if (current) {
    applyItem(current)
  } else {
    state.text = SAMPLE_TEXT
    els.source.value = state.text
    persist()
  }
  els.guide.textContent = FORMAT_GUIDE
  syncLayoutInputs()
  setView("proof")
  setMode("fields")
  refreshPreview()
}

els.source.addEventListener("input", () => {
  state.text = els.source.value
  state.dirty = true
  persist()
  refreshPreview()
})

els.template.addEventListener("change", () => {
  const prev = state.template
  const next = els.template.value
  if (marginsMatchTemplate(state.margins, prev) && state.lineSpacing === 1) {
    state.margins = defaultMargins(next)
    syncLayoutInputs()
  }
  state.template = next
  state.dirty = true
  persist()
  refreshPreview()
  if (next !== prev) trackEvent("template_changed", { template_name: next })
})

els.page.addEventListener("change", () => {
  state.page = els.page.value
  state.dirty = true
  persist()
  refreshPreview()
})

function onLayoutInput() {
  const top = Number(els.marginTop.value)
  const right = Number(els.marginRight.value)
  const bottom = Number(els.marginBottom.value)
  const left = Number(els.marginLeft.value)
  const spacing = Number(els.lineSpacing.value)
  if (![top, right, bottom, left, spacing].every(Number.isFinite)) return
  state.margins = normalizeMargins({ top, right, bottom, left }, state.template)
  state.lineSpacing = normalizeLineSpacing(spacing)
  state.dirty = true
  persist()
  refreshPreview()
}

function onLayoutChange() {
  readLayoutFromForm()
  state.dirty = true
  persist()
  refreshPreview()
}

;[els.marginTop, els.marginRight, els.marginBottom, els.marginLeft, els.lineSpacing].forEach((input) => {
  input?.addEventListener("input", onLayoutInput)
  input?.addEventListener("change", onLayoutChange)
})

document.querySelectorAll(".editor-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode))
})
document.querySelectorAll(".preview-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view))
})

els.toggleGuide.addEventListener("click", () => {
  const open = els.guide.classList.toggle("open")
  els.toggleGuide.textContent = open ? "Hide format" : "Show format"
})

els.fields.addEventListener("input", (event) => {
  const path = event.target.dataset.path
  if (!path) return
  setByPath(path, event.target.value)
  state.text = serializeResume(state.resume)
  state.dirty = true
  els.source.value = state.text
  persist()
  attachLayout(state.resume)
  els.proof.innerHTML = renderPreview(state.resume, state.template)
  els.texView.textContent = currentLatex()
})

els.fields.addEventListener("click", (event) => {
  if (event.target.closest("[data-stop-toggle]")) event.preventDefault()
  const add = event.target.dataset.add
  const remove = event.target.dataset.remove
  const layout = event.target.dataset.eduLayout
  const skillsLayout = event.target.dataset.skillsLayout
  const move = event.target.dataset.move
  const drop = event.target.dataset.dropSection
  if (skillsLayout) {
    state.resume.skillsLayout = skillsLayout
    syncFromFields()
    return
  }
  if (layout) {
    state.resume.educationLayout = layout
    if (layout === "table") {
      state.resume.education.forEach((item) => {
        if (!item.score) {
          const match = String(item.details || "").match(/(?:c\.?\s*g\.?\s*p\.?\s*a\.?|g\.?\s*p\.?\s*a\.?|%)\s*[:=]?\s*([0-9./% ]+)/i)
          if (match) item.score = match[1].trim()
        }
      })
    }
    syncFromFields()
    return
  }
  if (move) {
    const [id, delta] = move.split(":")
    moveSection(id, delta)
    return
  }
  if (drop) {
    dropSection(drop)
    return
  }
  if (add) addItem(add)
  if (remove) {
    const [list, index] = remove.split(":")
    state.resume[list].splice(Number(index), 1)
    syncFromFields()
  }
})

els.typeset.addEventListener("click", typeset)
document.getElementById("typeset-from-pdf")?.addEventListener("click", typeset)
els.downloadPdf.addEventListener("click", async () => {
  const blob = !state.dirty && state.pdfBlob ? state.pdfBlob : await typeset()
  if (!blob) return
  downloadBlob(blob, `${filenameBase()}.pdf`)
  trackEvent("pdf_downloaded", { template_name: state.template })
})
els.downloadTex.addEventListener("click", () => {
  downloadBlob(new Blob([currentLatex()], { type: "application/x-tex" }), `${filenameBase()}.tex`)
  trackEvent("latex_downloaded")
})

function isSameResume(a, b) {
  return String(a || "").replace(/\r\n/g, "\n").trim() === String(b || "").replace(/\r\n/g, "\n").trim()
}

function loadExample() {
  persist()
  if (isSameResume(state.text, SAMPLE_TEXT)) {
    setStatus("This is already the example resume.")
    return
  }
  if (state.text.trim() && !confirm("Load the example resume?\n\nYour current fields will stay in Library. They will not be overwritten.")) {
    return
  }
  const item = makeItem({
    text: SAMPLE_TEXT,
    template: state.template,
    page: state.page,
    margins: state.margins,
    lineSpacing: state.lineSpacing,
    name: "Example resume",
    customName: true,
  })
  library.items.unshift(item)
  applyItem(item, { save: true })
  setStatus("Loaded example. Open Library to return to your resume.")
  trackEvent("example_opened")
}

function clearAllFields() {
  if (!confirm("Clear every field on this resume?\n\nThe resume stays in Library, but all current fields will be emptied.")) {
    return
  }
  state.text = serializeResume(emptyResume())
  state.photo = ""
  state.resume = emptyResume()
  state.dirty = true
  state.pdfBlob = null
  els.source.value = state.text
  persist()
  refreshPreview()
  if (state.mode === "fields") renderFields()
  setView("proof")
  setStatus("All fields cleared.")
}

els.example.addEventListener("click", loadExample)
els.clearFields.addEventListener("click", clearAllFields)

document.addEventListener("click", (event) => {
  if (els.layoutPop?.open && !els.layoutPop.contains(event.target)) els.layoutPop.open = false
  document.querySelectorAll(".more-menu").forEach((menu) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false
  })
})

els.libraryBtn.addEventListener("click", () => {
  persist()
  setLibraryOpen(true)
})
els.libraryClose.addEventListener("click", () => setLibraryOpen(false))
els.libraryBackdrop.addEventListener("click", () => setLibraryOpen(false))
els.resumeNew.addEventListener("click", newResume)
els.resumeSave.addEventListener("click", saveCopy)
els.libraryList.addEventListener("click", (event) => {
  const open = event.target.dataset.open
  const rename = event.target.dataset.rename
  const copy = event.target.dataset.copy
  const remove = event.target.dataset.delete
  if (open) openResume(open)
  if (rename) renameResume(rename)
  if (copy) duplicateResume(copy)
  if (remove) deleteResume(remove)
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (els.layoutPop?.open) {
      event.preventDefault()
      els.layoutPop.open = false
      return
    }
    if (!els.library.hidden) {
      event.preventDefault()
      setLibraryOpen(false)
      return
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault()
    typeset()
  }
})

window.addEventListener("resize", refreshPreview)

try {
  restore()
} catch (err) {
  console.error(err)
  state.text = SAMPLE_TEXT
  if (els.source) els.source.value = SAMPLE_TEXT
  setView("proof")
  try {
    refreshPreview()
    setMode("fields")
  } catch (inner) {
    console.error(inner)
    setStatus("Could not render preview. Click Load example.", "error")
  }
}
if (location.hash === "#library") setLibraryOpen(true)
window.addEventListener("hashchange", () => {
  if (location.hash === "#library") setLibraryOpen(true)
})
