export const LIBRARY_KEY = "pica-library-v1"
const DRAFT_KEY = "pica-resume-v1"

export function titleFromText(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n")
  const named = lines.findIndex((line) => /^name$/i.test(line.trim()) || /^#+\s*name$/i.test(line.trim()))
  if (named >= 0) {
    const next = lines.slice(named + 1).map((l) => l.trim()).find(Boolean)
    if (next && !/^[A-Z][A-Z0-9 &/]+$/.test(next)) return next
  }
  return lines.map((l) => l.trim()).find(Boolean) || "Untitled resume"
}

function emptyLibrary() {
  return { currentId: "", items: [] }
}

export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.items)) return data
    }
  } catch {
    /* ignore */
  }

  const lib = emptyLibrary()
  try {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) {
      const data = JSON.parse(draft)
      if (data?.text?.trim()) {
        const item = makeItem(data)
        lib.items.push(item)
        lib.currentId = item.id
      }
    }
  } catch {
    /* ignore */
  }
  saveLibrary(lib)
  return lib
}

export function saveLibrary(lib) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib))
}

export function makeItem({
  text = "",
  template = "classic",
  page = "letter",
  photo = "",
  margins,
  paperSize,
  lineSpacing = 1,
  name = "",
  customName = false,
  id = "",
} = {}) {
  const now = Date.now()
  const label = String(name || "").trim() || titleFromText(text)
  return {
    id: id || crypto.randomUUID(),
    name: label,
    customName: Boolean(customName) && Boolean(String(name || "").trim()),
    text,
    template,
    page,
    photo: photo || "",
    margins,
    paperSize,
    lineSpacing,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertCurrent(lib, current) {
  const index = lib.items.findIndex((entry) => entry.id === (current.id || ""))
  const existing = index >= 0 ? lib.items[index] : null
  const customName = Boolean(current.customName ?? existing?.customName)
  const keptName = String(current.name || existing?.name || "").trim()
  const item = {
    id: current.id || existing?.id || crypto.randomUUID(),
    name: customName && keptName ? keptName : titleFromText(current.text),
    customName: customName && Boolean(keptName),
    text: current.text,
    template: current.template,
    page: current.page,
    photo: current.photo || "",
    margins: current.margins,
    paperSize: current.paperSize,
    lineSpacing: current.lineSpacing,
    createdAt: current.createdAt || existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  if (index >= 0) {
    item.createdAt = existing.createdAt || item.createdAt
    lib.items[index] = item
  } else {
    lib.items.unshift(item)
  }
  lib.currentId = item.id
  saveLibrary(lib)
  return item
}

export function renameItem(lib, id, nextName) {
  const item = lib.items.find((entry) => entry.id === id)
  if (!item) return null
  const name = String(nextName || "").trim().replace(/\s+/g, " ").slice(0, 80)
  if (!name) return null
  item.name = name
  item.customName = true
  item.updatedAt = Date.now()
  saveLibrary(lib)
  return item
}

export function blankText() {
  return `NAME

HEADLINE

CONTACT
phone:
email:
location:
linkedin:
github:
website:

SUMMARY

EDUCATION
TABLE
Course | Institute | Year | CGPA/%
B.Tech Computer Science | IIT Delhi | 2020 – 2024 | 8.74/10

EXPERIENCE
Company | Title | Location | Dates
- 

PROJECTS
Name | Tech | link | Dates
- 

SKILLS
Languages:
`
}
