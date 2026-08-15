import { DEFAULT_ORDER, ensureResume, sectionHasContent } from "./sections.js"

function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatHtml(text) {
  return String(text ?? "")
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? `<strong>${esc(part)}</strong>` : esc(part)))
    .join("")
}

function linkify(raw, label) {
  if (!raw) return esc(label || "")
  let href = String(raw).trim()
  if (!/^https?:\/\//i.test(href) && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
    href = href.includes("@") ? `mailto:${href}` : `https://${href}`
  }
  const text = formatHtml(label || raw.replace(/^https?:\/\//i, "").replace(/\/$/, ""))
  return `<a href="${esc(href)}" target="_blank" rel="noreferrer">${text}</a>`
}

function lineList(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
}

function socialHandle(value, kind) {
  let v = String(value || "").trim()
  v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "")
  if (kind === "linkedin") {
    const match = v.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i)
    if (match) return decodeURIComponent(match[1])
  }
  if (kind === "github") {
    const match = v.match(/github\.com\/([^/?#]+)/i)
    if (match) return decodeURIComponent(match[1])
  }
  return v
}

const ICONS = {
  linkedin: `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V24h-4zm7.5 0h3.8v2.12h.05c.53-1 1.84-2.12 3.78-2.12 4.04 0 4.79 2.66 4.79 6.12V24h-4v-8.2c0-1.96-.04-4.47-2.73-4.47-2.73 0-3.15 2.13-3.15 4.33V24h-4z"/></svg>`,
  github: `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/></svg>`,
  phone: `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z"/></svg>`,
  email: `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/></svg>`,
  website: `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.4 9h-3.2a15.4 15.4 0 0 0-1.3-5 8.1 8.1 0 0 1 4.5 5zM12 4c.9 1.3 1.7 3.2 2.1 7H9.9C10.3 7.2 11.1 5.3 12 4zM4.6 13h3.2c.2 1.8.7 3.5 1.3 5A8.1 8.1 0 0 1 4.6 13zM9.9 13h4.2c-.4 3.8-1.2 5.7-2.1 7-.9-1.3-1.7-3.2-2.1-7zm5 5c.6-1.5 1.1-3.2 1.3-5h3.2a8.1 8.1 0 0 1-4.5 5zM7.8 6A8.1 8.1 0 0 0 4.6 11h3.2c.2-1.8.7-3.5 1.3-5H7.8z"/></svg>`,
}

function contactItem(kind, href, label) {
  if (!href && !label) return ""
  const icon = ICONS[kind] || ""
  if (!href) return `<span class="citem">${icon}${formatHtml(label)}</span>`
  return `<span class="citem">${icon}${linkify(href, label)}</span>`
}

function masthead(resume) {
  const items = [
    resume.linkedin && contactItem("linkedin", resume.linkedin, socialHandle(resume.linkedin, "linkedin")),
    resume.phone && contactItem("phone", `tel:${String(resume.phone).replace(/[^\d+]/g, "")}`, resume.phone),
    resume.github && contactItem("github", resume.github, socialHandle(resume.github, "github")),
    resume.email && contactItem("email", resume.email, resume.email),
    resume.website && contactItem("website", resume.website, String(resume.website).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "")),
  ].filter(Boolean)
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push(`<div class="contact-row">${items.slice(i, i + 2).join('<span class="sep">|</span>')}</div>`)
  }
  const sub = [
    resume.headline ? `<p class="headline">${formatHtml(resume.headline)}</p>` : "",
    resume.location ? `<p class="place">${formatHtml(resume.location)}</p>` : "",
  ].join("")
  return `<header class="masthead">
    <div class="who">
      <h1>${formatHtml(resume.name || "Your Name")}</h1>
      ${sub}
    </div>
    <div class="contact-stack">${rows.join("")}</div>
  </header>`
}

function bullets(text) {
  const items = lineList(text)
  if (!items.length) return ""
  return `<ul>${items.map((i) => `<li>${formatHtml(i)}</li>`).join("")}</ul>`
}

function educationRow(item) {
  const fromDetails = String(item.details || "").match(/(?:c\.?\s*g\.?\s*p\.?\s*a\.?|g\.?\s*p\.?\s*a\.?|%)\s*[:=]?\s*([0-9./% ]+)/i)
  return {
    course: item.degree || "",
    institute: item.school || "",
    year: item.dates || "",
    score: item.score || fromDetails?.[1]?.trim() || "",
  }
}

function rolesHtml(items) {
  return (items || [])
    .filter((e) => e.company || e.title)
    .map(
      (e) => `<article>
        <div class="row"><strong>${formatHtml(e.company)}</strong><span>${formatHtml(e.dates)}</span></div>
        <div class="row muted"><em>${formatHtml(e.title)}</em><em>${formatHtml(e.location)}</em></div>
        ${bullets(e.bullets)}
      </article>`
    )
    .join("")
}

export function renderPreview(resume, template = "classic") {
  ensureResume(resume)
  const eduItems = resume.education || []
  const edu = resume.educationLayout === "table"
    ? (() => {
        const rows = eduItems.filter((e) => e.school || e.degree || e.score)
        if (!rows.length) return ""
        const body = rows
          .map((e) => {
            const row = educationRow(e)
            return `<tr><td>${formatHtml(row.course)}</td><td>${formatHtml(row.institute)}</td><td>${formatHtml(row.year)}</td><td>${formatHtml(row.score)}</td></tr>`
          })
          .join("")
        return `<table class="edu-table">
          <thead><tr><th>Course</th><th>Institute</th><th>Year</th><th>CGPA/%</th></tr></thead>
          <tbody>${body}</tbody>
        </table>`
      })()
    : eduItems
        .filter((e) => e.school || e.degree)
        .map((e) => {
          const extra = lineList(e.details)
          return `<article>
        <div class="row"><strong>${formatHtml(e.school)}</strong><span>${formatHtml(e.dates)}</span></div>
        <div class="row muted"><em>${formatHtml(e.degree)}</em><em>${formatHtml(e.location)}</em></div>
        ${extra.length ? `<ul>${extra.map((x) => `<li>${formatHtml(x)}</li>`).join("")}</ul>` : ""}
      </article>`
        })
        .join("")

  const projects = (resume.projects || [])
    .filter((p) => p.name)
    .map((p) => {
      const title = p.link ? linkify(p.link, p.name) : formatHtml(p.name)
      const tech = p.tech ? `<span class="sep">|</span><em>${formatHtml(p.tech)}</em>` : ""
      return `<article>
        <div class="row"><span><strong>${title}</strong>${tech}</span><span>${formatHtml(p.dates)}</span></div>
        ${bullets(p.bullets)}
      </article>`
    })
    .join("")

  const skills = (resume.skills || [])
    .filter((s) => s.category || s.items)
    .map((s) => `<div class="skill"><strong>${formatHtml(s.category)}:</strong> ${formatHtml(s.items)}</div>`)
    .join("")

  const summary = resume.summary?.trim()
    ? `<section><h2>Summary</h2><p class="summary">${formatHtml(resume.summary.trim())}</p></section>`
    : ""

  const blocks = {
    summary: () => summary,
    education: () => (edu ? `<section><h2>Education</h2>${edu}</section>` : ""),
    experience: () => {
      const html = rolesHtml(resume.experience)
      return html ? `<section><h2>Experience</h2>${html}</section>` : ""
    },
    internships: () => {
      const html = rolesHtml(resume.internships)
      return html ? `<section><h2>Internships</h2>${html}</section>` : ""
    },
    fieldwork: () => {
      const html = rolesHtml(resume.fieldwork)
      return html ? `<section><h2>Fieldwork</h2>${html}</section>` : ""
    },
    responsibilities: () => {
      const html = rolesHtml(resume.responsibilities)
      return html ? `<section><h2>Positions of Responsibility</h2>${html}</section>` : ""
    },
    extracurricular: () => {
      const html = rolesHtml(resume.extracurricular)
      return html ? `<section><h2>Extra Curricular</h2>${html}</section>` : ""
    },
    projects: () => (projects ? `<section><h2>Projects</h2>${projects}</section>` : ""),
    skills: () => (skills ? `<section><h2>Technical Skills</h2>${skills}</section>` : ""),
  }

  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER
  const content = order
    .filter((id) => sectionHasContent(resume, id))
    .map((id) => blocks[id]?.() || "")
    .join("")

  return `<div class="resume-page ${esc(template)} ${resume.page === "a4" ? "a4" : "letter"}">
    ${masthead(resume)}
    ${content}
  </div>`
}
