import { emptyResume } from "./sample.js"
import { DEFAULT_ORDER, SECTION_ALIASES, ensureResume, sectionDef } from "./sections.js"

function uid() {
  return crypto.randomUUID()
}

function normalizeHeader(line) {
  const trimmed = line.trim()
  if (!trimmed) return null
  const hash = trimmed.match(/^#{1,3}\s+(.+)$/)
  const raw = (hash ? hash[1] : trimmed).trim()
  if (hash || /^[A-Z][A-Z0-9 &/]+$/.test(raw)) {
    const key = raw.toLowerCase().replace(/[^a-z]/g, "")
    return SECTION_ALIASES[key] || null
  }
  return null
}

function splitPipes(line) {
  return line.split("|").map((part) => part.trim())
}

function looksLikeContactLine(line) {
  return /@|linkedin\.com|github\.com|https?:\/\/|www\.|\.[a-z]{2,}(\/|$)/i.test(line) || (line.includes("|") && /\d/.test(line))
}

function applyContactLine(resume, line) {
  const labeled = line.match(/^([A-Za-z ]{2,12})\s*:\s*(.+)$/)
  if (labeled) {
    const key = labeled[1].trim().toLowerCase()
    const value = labeled[2].trim()
    if (key.includes("mail")) resume.email = value
    else if (key.includes("phone") || key.includes("mobile") || key === "tel") resume.phone = value
    else if (key.includes("locat") || key.includes("city")) resume.location = value
    else if (key.includes("linked")) resume.linkedin = value
    else if (key.includes("git")) resume.github = value
    else if (key.includes("web") || key.includes("site") || key.includes("url") || key.includes("portfolio")) {
      resume.website = value
    } else {
      assignGuessedContact(resume, value)
    }
    return
  }
  if (line.includes("|")) {
    splitPipes(line).forEach((part) => assignGuessedContact(resume, part))
    return
  }
  assignGuessedContact(resume, line)
}

function assignGuessedContact(resume, value) {
  const v = value.trim()
  if (!v) return
  if (/@/.test(v) && !resume.email) resume.email = v.replace(/^mailto:/i, "")
  else if (/linkedin\.com/i.test(v) || /^linkedin:/i.test(v)) resume.linkedin = v.replace(/^linkedin:\s*/i, "")
  else if (/github\.com/i.test(v) || /^github:/i.test(v)) resume.github = v.replace(/^github:\s*/i, "")
  else if (/^https?:\/\//i.test(v) || /^www\./i.test(v) || /\.[a-z]{2,}(\/|$)/i.test(v)) resume.website = v
  else if (/(\+?\d[\d .\-()]{7,}\d)/.test(v) && !resume.phone) resume.phone = v
  else if (!resume.location && /[A-Za-z]/.test(v) && v.length < 48) resume.location = v
}

function parseBulletedBlock(lines) {
  const entries = []
  let current = null
  const flush = () => {
    if (current) entries.push(current)
    current = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
      if (!current) current = { header: "", bullets: [] }
      current.bullets.push(line.replace(/^[-•*]\s*/, ""))
      continue
    }
    if (current && !line.includes("|") && current.header) {
      current.bullets.push(line)
      continue
    }
    flush()
    current = { header: line, bullets: [] }
  }
  flush()
  return entries
}

function extractScore(details) {
  const text = String(details || "")
  const match = text.match(/(?:c\.?\s*g\.?\s*p\.?\s*a\.?|g\.?\s*p\.?\s*a\.?|percentage|percent|%)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:\/\s*[0-9]+(?:\.[0-9]+)?)?\s*%?)/i)
  return match ? match[1].replace(/\s+/g, "") : ""
}

function isTableMarker(line) {
  const t = line.trim().toLowerCase().replace(/\s+/g, "")
  return t === "table" || t === "layout:table" || t === "layouttable"
}

function isEducationHeader(parts) {
  const a = (parts[0] || "").toLowerCase()
  const b = (parts[1] || "").toLowerCase()
  return /^course/.test(a) && /(institut|college|school|university)/.test(b)
}

function parseEducation(lines) {
  return parseBulletedBlock(lines).map((entry) => {
    const parts = splitPipes(entry.header)
    const details = entry.bullets.join("\n")
    return {
      id: uid(),
      school: parts[0] || "",
      degree: parts[1] || "",
      location: parts[2] || "",
      dates: parts[3] || "",
      details,
      score: extractScore(details),
    }
  })
}

function parseEducationTable(lines) {
  const items = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || isTableMarker(line)) continue
    if (!line.includes("|")) continue
    const parts = splitPipes(line)
    if (isEducationHeader(parts)) continue
    items.push({
      id: uid(),
      degree: parts[0] || "",
      school: parts[1] || "",
      dates: parts[2] || "",
      score: parts[3] || "",
      location: "",
      details: parts[3] ? `CGPA/%: ${parts[3]}` : "",
    })
  }
  return items
}

function parseEducationBlock(lines) {
  const trimmed = lines.map((l) => l.trim())
  const first = trimmed.find(Boolean) || ""
  const firstParts = first.includes("|") ? splitPipes(first) : []
  const table = isTableMarker(first) || isEducationHeader(firstParts)
  if (table) {
    return { layout: "table", items: parseEducationTable(trimmed) }
  }
  return { layout: "list", items: parseEducation(trimmed).map(fixEducationDates) }
}

function fixEducationDates(item) {
  const parts = [item.school, item.degree, item.location, item.dates].filter(Boolean)
  // If 3 pipe parts, treat last as dates when it looks like a year range.
  if (!item.dates && item.location && /\d{4}/.test(item.location) && !/\d{4}/.test(item.degree)) {
    item.dates = item.location
    item.location = ""
  }
  return item
}

function parseExperience(lines) {
  return parseBulletedBlock(lines).map((entry) => {
    const parts = splitPipes(entry.header)
    let company = parts[0] || ""
    let title = parts[1] || ""
    let location = parts[2] || ""
    let dates = parts[3] || ""
    if (parts.length === 3 && /\d{4}|present|current/i.test(parts[2])) {
      dates = parts[2]
      location = ""
    }
    return {
      id: uid(),
      company,
      title,
      location,
      dates,
      bullets: entry.bullets.join("\n"),
    }
  })
}

function parseProjects(lines) {
  return parseBulletedBlock(lines).map((entry) => {
    const parts = splitPipes(entry.header)
    let name = parts[0] || ""
    let tech = parts[1] || ""
    let link = ""
    let dates = ""
    if (parts.length >= 4) {
      link = parts[2]
      dates = parts[3]
    } else if (parts.length === 3) {
      if (/github|\.com|https?:/i.test(parts[2])) link = parts[2]
      else dates = parts[2]
    }
    return {
      id: uid(),
      name,
      tech,
      link,
      dates,
      bullets: entry.bullets.join("\n"),
    }
  })
}

function parseSkills(lines) {
  const skills = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const labeled = line.match(/^([^:]{1,40}):\s*(.+)$/)
    if (labeled) {
      skills.push({ id: uid(), category: labeled[1].trim(), items: labeled[2].trim() })
    } else {
      skills.push({ id: uid(), category: skills.length ? "Other" : "Skills", items: line.replace(/^[-•*]\s*/, "") })
    }
  }
  return skills
}

export function parseResumeText(text) {
  const resume = ensureResume(emptyResume())
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n")
  const blocks = []
  let current = { name: "preamble", lines: [] }

  for (const line of lines) {
    const header = normalizeHeader(line)
    if (header) {
      blocks.push(current)
      current = { name: header, lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  blocks.push(current)

  const preamble = blocks.find((b) => b.name === "preamble")
  if (preamble) {
    const useful = preamble.lines.map((l) => l.trim()).filter(Boolean)
    if (useful[0] && !resume.name) resume.name = useful[0]
    if (useful[1] && !looksLikeContactLine(useful[1]) && useful[1].length < 90) {
      resume.headline = useful[1]
      useful.slice(2).forEach((line) => applyContactLine(resume, line))
    } else {
      useful.slice(1).forEach((line) => applyContactLine(resume, line))
    }
  }

  const seen = []
  let explicitOrder = null
  for (const block of blocks) {
    const body = block.lines
    const def = sectionDef(block.name)
    if (def && !seen.includes(def.id)) seen.push(def.id)
    switch (block.name) {
      case "name":
        resume.name = body.map((l) => l.trim()).find(Boolean) || resume.name
        break
      case "headline":
        resume.headline = body.map((l) => l.trim()).find(Boolean) || resume.headline
        break
      case "contact":
        body.forEach((line) => line.trim() && applyContactLine(resume, line))
        break
      case "order":
        explicitOrder = body
          .join(" ")
          .split(/[|,]/)
          .map((part) => part.trim().toLowerCase().replace(/[^a-z]/g, ""))
          .map((key) => SECTION_ALIASES[key] || key)
          .filter((id) => sectionDef(id))
        break
      case "summary":
        resume.summary = body.join("\n").trim()
        break
      case "education": {
        const parsed = parseEducationBlock(body)
        resume.education = parsed.items
        resume.educationLayout = parsed.layout
        break
      }
      case "experience":
      case "internships":
      case "fieldwork":
      case "responsibilities":
      case "extracurricular":
        resume[block.name] = parseExperience(body)
        break
      case "projects":
        resume.projects = parseProjects(body)
        break
      case "skills":
        resume.skills = parseSkills(body)
        break
      default:
        break
    }
  }
  if (explicitOrder?.length) resume.sectionOrder = explicitOrder
  else if (seen.length) resume.sectionOrder = seen
  else resume.sectionOrder = [...DEFAULT_ORDER]
  return resume
}

function joinPipes(parts) {
  return parts.map((p) => (p || "").trim()).join(" | ")
}

function serializeRoles(push, header, items) {
  if (!items?.length) return
  push(header)
  items.forEach((item, i) => {
    push(joinPipes([item.company, item.title, item.location, item.dates]))
    if (item.bullets) {
      item.bullets.split("\n").filter(Boolean).forEach((b) => push(b.startsWith("-") ? b : `- ${b}`))
    }
    if (i < items.length - 1) push("")
  })
  push("")
}

export function serializeResume(resume) {
  ensureResume(resume)
  const lines = []
  const push = (value) => lines.push(value)
  push("NAME")
  push(resume.name || "")
  push("")
  if (resume.headline) {
    push("HEADLINE")
    push(resume.headline)
    push("")
  }
  push("CONTACT")
  if (resume.phone) push(`phone: ${resume.phone}`)
  if (resume.email) push(`email: ${resume.email}`)
  if (resume.location) push(`location: ${resume.location}`)
  if (resume.linkedin) push(`linkedin: ${resume.linkedin}`)
  if (resume.github) push(`github: ${resume.github}`)
  if (resume.website) push(`website: ${resume.website}`)
  push("")
  if (resume.sectionOrder?.length) {
    push("ORDER")
    push(resume.sectionOrder.join(", "))
    push("")
  }

  const writers = {
    summary() {
      if (!resume.summary) return
      push("SUMMARY")
      push(resume.summary)
      push("")
    },
    education() {
      if (!(resume.educationLayout === "table" || resume.education?.length)) return
      push("EDUCATION")
      if (resume.educationLayout === "table") {
        push("TABLE")
        push("Course | Institute | Year | CGPA/%")
        resume.education.forEach((item) => {
          const score = item.score || extractScore(item.details)
          push(joinPipes([item.degree, item.school, item.dates, score]))
        })
      } else {
        resume.education.forEach((item, i) => {
          push(joinPipes([item.school, item.degree, item.location, item.dates]))
          if (item.details) push(item.details)
          else if (item.score) push(`CGPA/%: ${item.score}`)
          if (i < resume.education.length - 1) push("")
        })
      }
      push("")
    },
    experience() { serializeRoles(push, "EXPERIENCE", resume.experience) },
    internships() { serializeRoles(push, "INTERNSHIPS", resume.internships) },
    fieldwork() { serializeRoles(push, "FIELDWORK", resume.fieldwork) },
    responsibilities() { serializeRoles(push, "POSITIONS OF RESPONSIBILITY", resume.responsibilities) },
    extracurricular() { serializeRoles(push, "EXTRA CURRICULAR", resume.extracurricular) },
    projects() {
      if (!resume.projects?.length) return
      push("PROJECTS")
      resume.projects.forEach((item, i) => {
        push(joinPipes([item.name, item.tech, item.link, item.dates].filter((p, idx) => idx < 2 || p)))
        if (item.bullets) {
          item.bullets.split("\n").filter(Boolean).forEach((b) => push(b.startsWith("-") ? b : `- ${b}`))
        }
        if (i < resume.projects.length - 1) push("")
      })
      push("")
    },
    skills() {
      if (!resume.skills?.length) return
      push("SKILLS")
      resume.skills.forEach((item) => push(`${item.category}: ${item.items}`))
    },
  }

  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER
  order.forEach((id) => writers[id]?.())
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}
