import { FORMAT_GUIDE, SAMPLE_TEXT } from "./sample.js"
import { parseResumeText, serializeResume } from "./parse.js"
import { generateLatex } from "./latex.js"
import { renderPreview } from "./preview.js"
import { blankText, loadLibrary, makeItem, saveLibrary, titleFromText, upsertCurrent } from "./library.js"
import { DEFAULT_ORDER, SECTION_DEFS, ensureResume, sectionDef } from "./sections.js"

const STORAGE_KEY = "resuform-templates-resume-v1"

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
  typeset: document.getElementById("typeset"),
  downloadPdf: document.getElementById("download-pdf"),
  downloadTex: document.getElementById("download-tex"),
  overleaf: document.getElementById("overleaf"),
  example: document.getElementById("example"),
  guide: document.getElementById("guide"),
  toggleGuide: document.getElementById("toggle-guide"),
  overleafSnip: document.getElementById("overleaf-snip"),
  overleafForm: document.getElementById("overleaf-form"),
  libraryBtn: document.getElementById("library-btn"),
  library: document.getElementById("library"),
  libraryBackdrop: document.getElementById("library-backdrop"),
  libraryClose: document.getElementById("library-close"),
  libraryList: document.getElementById("library-list"),
  resumeNew: document.getElementById("resume-new"),
  resumeSave: document.getElementById("resume-save"),
}

const state = {
  mode: "text",
  view: "proof",
  text: SAMPLE_TEXT,
  resume: parseResumeText(SAMPLE_TEXT),
  template: "classic",
  page: "letter",
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

function currentLatex() {
  return generateLatex({ ...state.resume, page: state.page }, state.template)
}

function refreshPreview() {
  state.resume = parseResumeText(state.text)
  ensureResume(state.resume)
  state.resume.page = state.page
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
    createdAt: state.createdAt,
  })
  state.currentId = item.id
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      text: state.text,
      template: state.template,
      page: state.page,
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

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function roleCards(kind, items, orgLabel, roleLabel) {
  return (items || [])
    .map(
      (item, i) => `<div class="card">
        <div class="card-head"><span>Entry ${i + 1}</span><button type="button" data-remove="${kind}:${i}">Remove</button></div>
        <div class="grid-2">
          ${field(`${kind}.${i}.company`, orgLabel, item.company)}
          ${field(`${kind}.${i}.title`, roleLabel, item.title)}
          ${field(`${kind}.${i}.location`, "Location", item.location)}
          ${field(`${kind}.${i}.dates`, "Dates", item.dates)}
        </div>
        ${field(`${kind}.${i}.bullets`, "Details (one per line)", item.bullets, true)}
      </div>`
    )
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
    return `<div class="field-group" data-section="${id}">
      <h3>${def.label} ${sectionChrome(id)}</h3>
      ${field("summary", "Summary", r.summary, true)}
    </div>`
  }
  if (def.kind === "education") {
    const tableEdu = r.educationLayout === "table"
    const edu = (r.education || [])
      .map((item, i) =>
        tableEdu
          ? `<div class="card">
        <div class="card-head"><span>Row ${i + 1}</span><button type="button" data-remove="education:${i}">Remove</button></div>
        <div class="grid-2">
          ${field(`education.${i}.degree`, "Course", item.degree)}
          ${field(`education.${i}.school`, "Institute", item.school)}
          ${field(`education.${i}.dates`, "Year", item.dates)}
          ${field(`education.${i}.score`, "CGPA/%", item.score || "")}
        </div>
      </div>`
          : `<div class="card">
        <div class="card-head"><span>Education ${i + 1}</span><button type="button" data-remove="education:${i}">Remove</button></div>
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
    return `<div class="field-group" data-section="${id}">
      <h3>${def.label}
        <button type="button" data-add="education">+ Add</button>
        ${sectionChrome(id, `<span class="layout-toggle">
          <button type="button" data-edu-layout="list" class="${tableEdu ? "" : "on"}">List</button>
          <button type="button" data-edu-layout="table" class="${tableEdu ? "on" : ""}">Table</button>
        </span>`)}
      </h3>
      ${edu || "<p class='hint'>No schools yet.</p>"}
    </div>`
  }
  if (def.kind === "roles") {
    const cards = roleCards(id, r[id], def.org, def.role)
    const optional = def.core ? "" : `<button type="button" data-drop-section="${id}">Remove</button>`
    return `<div class="field-group" data-section="${id}">
      <h3>${def.label}
        <button type="button" data-add="${id}">+ Add</button>
        ${sectionChrome(id, optional)}
      </h3>
      ${cards || "<p class='hint'>No entries yet.</p>"}
    </div>`
  }
  if (def.kind === "projects") {
    const projects = (r.projects || [])
      .map(
        (item, i) => `<div class="card">
        <div class="card-head"><span>Project ${i + 1}</span><button type="button" data-remove="projects:${i}">Remove</button></div>
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
    return `<div class="field-group" data-section="${id}">
      <h3>${def.label} <button type="button" data-add="projects">+ Add</button> ${sectionChrome(id)}</h3>
      ${projects || "<p class='hint'>No projects yet.</p>"}
    </div>`
  }
  if (def.kind === "skills") {
    const skills = (r.skills || [])
      .map(
        (item, i) => `<div class="card">
        <div class="card-head"><span>Skill group ${i + 1}</span><button type="button" data-remove="skills:${i}">Remove</button></div>
        <div class="grid-2">
          ${field(`skills.${i}.category`, "Category", item.category)}
          ${field(`skills.${i}.items`, "Items", item.items)}
        </div>
      </div>`
      )
      .join("")
    return `<div class="field-group" data-section="${id}">
      <h3>${def.label} <button type="button" data-add="skills">+ Add</button> ${sectionChrome(id)}</h3>
      ${skills || "<p class='hint'>No skills yet.</p>"}
    </div>`
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
    <div class="field-group">
      <h3>Header</h3>
      <div class="grid-2">
        ${field("name", "Name", r.name)}
        ${field("headline", "Headline", r.headline)}
        ${field("phone", "Phone", r.phone)}
        ${field("email", "Email", r.email)}
        ${field("location", "Location", r.location)}
        ${field("website", "Website", r.website)}
        ${field("linkedin", "LinkedIn", r.linkedin)}
        ${field("github", "GitHub", r.github)}
      </div>
    </div>
    <div class="field-group">
      <h3>Section order</h3>
      <p class="hint">Use Up/Down on each section, or add Internships, Fieldwork, POR, Extra Curricular.</p>
      ${addOptions ? `<label>Add section
        <select id="add-section">
          <option value="">Choose…</option>
          ${addOptions}
        </select>
      </label>` : "<p class='hint'>All optional sections are on the resume.</p>"}
    </div>
    ${order.map((id) => renderSectionFields(r, id)).join("")}
  `
  document.getElementById("add-section")?.addEventListener("change", (event) => {
    const id = event.target.value
    if (id) addSection(id)
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
}

function addSection(id) {
  ensureResume(state.resume)
  const order = state.resume.sectionOrder
  if (!order.includes(id)) {
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
  state.pdfUrl = `/api/resume.pdf?t=${Date.now()}`
  const viewer = document.createElement("iframe")
  viewer.id = "pdf-frame"
  viewer.title = "Compiled PDF"
  viewer.src = state.pdfUrl
  els.pdfFrame.replaceWith(viewer)
  els.pdfFrame = viewer
  els.pdfPane.classList.add("has-pdf")
  els.pdfEmpty.hidden = true
}

async function compilePdf() {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tex: currentLatex(), filename: `${filenameBase()}.pdf` }),
  })
  const buffer = await response.arrayBuffer()
  if (!response.ok) {
    let detail = `Compile failed (${response.status})`
    const ctype = response.headers.get("content-type") || ""
    if (ctype.includes("json")) {
      try {
        detail = JSON.parse(new TextDecoder().decode(buffer)).error || detail
      } catch {
        detail = new TextDecoder().decode(buffer) || detail
      }
    } else {
      detail = new TextDecoder().decode(buffer) || detail
    }
    throw new Error(detail)
  }
  const bytes = new Uint8Array(buffer)
  const isPdf = bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF"
  if (!isPdf) {
    throw new Error("Compiler did not return a PDF. Try Download .tex or Open in Overleaf.")
  }
  return new Blob([buffer], { type: "application/pdf" })
}

async function typeset() {
  if (state.compiling) return null
  state.compiling = true
  els.typeset.disabled = true
  const extra = document.getElementById("typeset-from-pdf")
  if (extra) extra.disabled = true
  els.downloadPdf.disabled = true
  setStatus("Typesetting with LaTeX…")
  els.log.classList.remove("open")
  try {
    const blob = await compilePdf()
    showPdf(blob)
    state.dirty = false
    setView("pdf")
    setStatus("PDF ready.", "ok")
    return blob
  } catch (err) {
    els.log.textContent = err.message || String(err)
    els.log.classList.add("open")
    setView("pdf")
    setStatus("Typeset failed. You can still download .tex or open Overleaf.", "error")
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
  state.template = ["classic", "modern", "compact"].includes(item.template) ? item.template : "classic"
  state.page = item.page || "letter"
  state.dirty = true
  state.pdfBlob = null
  library.currentId = item.id
  els.source.value = state.text
  els.template.value = state.template
  els.page.value = state.page
  refreshPreview()
  if (state.mode === "fields") renderFields()
  setView("proof")
  if (save) persist()
  else saveLibrary(library)
}

function renderLibrary() {
  const items = [...library.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  if (!items.length) {
    els.libraryList.innerHTML = `<li class="library-empty">No saved resumes yet. Write one, then open Library again — the current draft is kept automatically.</li>`
    return
  }
  els.libraryList.innerHTML = items
    .map((item) => {
      const current = item.id === state.currentId
      return `<li class="${current ? "current" : ""}" data-id="${item.id}">
        <h3>${escapeAttr(item.name || titleFromText(item.text))}${current ? " · open" : ""}</h3>
        <time>${formatWhen(item.updatedAt)}</time>
        <div class="row-actions">
          <button type="button" data-open="${item.id}">Open</button>
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
  if (open) renderLibrary()
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
}

function saveCopy() {
  const item = makeItem({
    text: state.text,
    template: state.template,
    page: state.page,
    name: `${titleFromText(state.text)} copy`,
  })
  library.items.unshift(item)
  saveLibrary(library)
  renderLibrary()
  setStatus(`Saved copy: ${item.name}`)
}

function duplicateResume(id) {
  const source = library.items.find((entry) => entry.id === id)
  if (!source) return
  const item = makeItem({
    ...source,
    id: "",
    name: `${source.name || titleFromText(source.text)} copy`,
  })
  library.items.unshift(item)
  saveLibrary(library)
  renderLibrary()
  setStatus(`Duplicated ${item.name}.`)
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
  setView("proof")
  refreshPreview()
}

els.source.addEventListener("input", () => {
  state.text = els.source.value
  state.dirty = true
  persist()
  refreshPreview()
})

els.template.addEventListener("change", () => {
  state.template = els.template.value
  state.dirty = true
  persist()
  refreshPreview()
})

els.page.addEventListener("change", () => {
  state.page = els.page.value
  state.dirty = true
  persist()
  refreshPreview()
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
  els.proof.innerHTML = renderPreview(state.resume, state.template)
  els.texView.textContent = currentLatex()
})

els.fields.addEventListener("click", (event) => {
  const add = event.target.dataset.add
  const remove = event.target.dataset.remove
  const layout = event.target.dataset.eduLayout
  const move = event.target.dataset.move
  const drop = event.target.dataset.dropSection
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
  const a = document.createElement("a")
  a.href = `/api/resume.pdf?download=1&t=${Date.now()}`
  a.download = `${filenameBase()}.pdf`
  a.rel = "noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  a.remove()
})
els.downloadTex.addEventListener("click", () => {
  downloadBlob(new Blob([currentLatex()], { type: "application/x-tex" }), `${filenameBase()}.tex`)
})
els.overleaf.addEventListener("click", () => {
  els.overleafSnip.value = currentLatex()
  els.overleafForm.submit()
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
    name: "Example resume",
  })
  library.items.unshift(item)
  applyItem(item, { save: true })
  setStatus("Loaded example. Open Library to return to your resume.")
}

els.example.addEventListener("click", loadExample)

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
  const copy = event.target.dataset.copy
  const remove = event.target.dataset.delete
  if (open) openResume(open)
  if (copy) duplicateResume(copy)
  if (remove) deleteResume(remove)
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.library.hidden) {
    event.preventDefault()
    setLibraryOpen(false)
    return
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
  } catch (inner) {
    console.error(inner)
    setStatus("Could not render preview. Click Load example.", "error")
  }
}
