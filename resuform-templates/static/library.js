const LIBRARY_KEY = "resuform-templates-library-v1"
const DRAFT_KEY = "resuform-templates-resume-v1"

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

export function makeItem({ text = "", template = "classic", page = "letter", name = "", id = "" } = {}) {
  const now = Date.now()
  return {
    id: id || crypto.randomUUID(),
    name: name || titleFromText(text),
    text,
    template,
    page,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertCurrent(lib, current) {
  const item = {
    id: current.id || crypto.randomUUID(),
    name: titleFromText(current.text),
    text: current.text,
    template: current.template,
    page: current.page,
    createdAt: current.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  const index = lib.items.findIndex((entry) => entry.id === item.id)
  if (index >= 0) {
    item.createdAt = lib.items[index].createdAt || item.createdAt
    lib.items[index] = item
  } else {
    lib.items.unshift(item)
  }
  lib.currentId = item.id
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
