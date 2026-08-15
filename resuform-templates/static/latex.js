import { DEFAULT_ORDER, ensureResume, sectionHasContent } from "./sections.js"

function normalize(text) {
  return String(text ?? "")
    .replace(/[\u2013\u2014]/g, "--")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
}

function escapeLatex(text) {
  return normalize(text)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$#&%_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}")
}

function formatLatex(text) {
  return String(text ?? "")
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? `\\textbf{${escapeLatex(part)}}` : escapeLatex(part)))
    .join("")
}

function hrefUrl(raw) {
  if (!raw) return ""
  let url = String(raw).trim()
  if (!url) return ""
  if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:") && !url.startsWith("tel:")) {
    if (url.includes("@") && !url.includes(" ")) url = `mailto:${url}`
    else url = `https://${url}`
  }
  return url.replace(/([#%\\])/g, "\\$1")
}

function href(raw, label) {
  const url = hrefUrl(raw)
  if (!url) return formatLatex(label || raw)
  return `\\href{${url}}{\\underline{${formatLatex(label || raw)}}}`
}

function bullets(text) {
  const items = String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
  if (!items.length) return ""
  return [
    "\\resumeItemListStart",
    ...items.map((item) => `\\resumeItem{${formatLatex(item)}}`),
    "\\resumeItemListEnd",
  ].join("\n")
}

function displayHost(value) {
  return String(value)
    .replace(/^https?:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
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

function iconHref(icon, raw, label) {
  const url = hrefUrl(raw)
  const text = `\\${icon}\\,${formatLatex(label)}`
  if (!url) return text
  return `\\href{${url}}{${text}}`
}

function joinPipesLatex(parts) {
  return parts.filter(Boolean).join(" $|$ ")
}

function contactCells(resume) {
  const cells = []
  if (resume.linkedin) {
    cells.push(iconHref("faLinkedin", resume.linkedin, socialHandle(resume.linkedin, "linkedin")))
  }
  if (resume.phone) {
    const tel = String(resume.phone).replace(/[^\d+]/g, "")
    cells.push(iconHref("faPhone", tel ? `tel:${tel}` : resume.phone, resume.phone))
  }
  if (resume.github) {
    cells.push(iconHref("faGithub", resume.github, socialHandle(resume.github, "github")))
  }
  if (resume.email) {
    cells.push(iconHref("faEnvelope", resume.email, resume.email))
  }
  if (resume.website) {
    cells.push(iconHref("faGlobe", resume.website, displayHost(resume.website)))
  }
  const rows = []
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2))
  return rows
}

function headerBlock(resume) {
  const name = formatLatex(resume.name || "Your Name")
  const leftBits = [`{\\Huge\\bfseries ${name}}`]
  if (resume.headline) leftBits.push(`{\\small ${formatLatex(resume.headline)}}`)
  if (resume.location) leftBits.push(`{\\small ${formatLatex(resume.location)}}`)

  const rightRows = contactCells(resume).map((row) => joinPipesLatex(row)).filter(Boolean)
  const right = rightRows.length
    ? `\\begin{tabular}[c]{@{}r@{}}
${rightRows.map((row) => `{\\small ${row}}`).join(" \\\\\n")}
\\end{tabular}`
    : ""

  return `{\\fontfamily{phv}\\selectfont
\\noindent
\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
\\begin{tabular}[c]{@{}l@{}}
${leftBits.join(" \\\\\n")}
\\end{tabular}
&
${right}
\\end{tabular*}
}\\vspace{6pt}`
}

function educationRow(item) {
  const score = item.score || String(item.details || "").match(/(?:c\.?\s*g\.?\s*p\.?\s*a\.?|g\.?\s*p\.?\s*a\.?|%)\s*[:=]?\s*([0-9./% ]+)/i)?.[1]?.trim() || ""
  return {
    course: item.degree || "",
    institute: item.school || "",
    year: item.dates || "",
    score,
  }
}

function educationTable(resume) {
  const rows = (resume.education || []).filter((item) => item.school || item.degree || item.score)
  if (!rows.length) return ""
  const body = rows
    .map((item) => {
      const row = educationRow(item)
      return `${formatLatex(row.course)} & ${formatLatex(row.institute)} & ${formatLatex(row.year)} & ${formatLatex(row.score)} \\\\`
    })
    .join("\n")
  return `\\section{Education}
{\\setlength{\\tabcolsep}{6pt}\\renewcommand{\\arraystretch}{1.2}
\\begin{tabularx}{\\textwidth}{>{\\raggedright\\arraybackslash}X >{\\raggedright\\arraybackslash}X l r}
\\textbf{Course} & \\textbf{Institute} & \\textbf{Year} & \\textbf{CGPA/\\%} \\\\
\\hline
${body}
\\hline
\\end{tabularx}
}\\vspace{-6pt}`
}

function educationBlock(resume) {
  if (!resume.education?.length) return ""
  if (resume.educationLayout === "table") return educationTable(resume)
  const items = resume.education.map((item) => {
    const extra = String(item.details || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `\\resumeItem{${formatLatex(l)}}`)
      .join("\n")
    const extraBlock = extra
      ? `\\resumeItemListStart\n${extra}\n\\resumeItemListEnd`
      : ""
    return `\\resumeSubheading{${formatLatex(item.school)}}{${formatLatex(item.dates)}}{${formatLatex(item.degree)}}{${formatLatex(item.location)}}\n${extraBlock}`
  })
  return `\\section{Education}\n\\resumeSubHeadingListStart\n${items.join("\n")}\n\\resumeSubHeadingListEnd`
}

function rolesBlock(title, items) {
  const rows = (items || []).filter((item) => item.company || item.title)
  if (!rows.length) return ""
  const body = rows.map((item) => {
    return `\\resumeSubheading{${formatLatex(item.company)}}{${formatLatex(item.dates)}}{${formatLatex(item.title)}}{${formatLatex(item.location)}}\n${bullets(item.bullets)}`
  })
  return `\\section{${title}}\n\\resumeSubHeadingListStart\n${body.join("\n")}\n\\resumeSubHeadingListEnd`
}

function projectsBlock(resume) {
  if (!resume.projects?.length) return ""
  const items = resume.projects.map((item) => {
    const name = item.link
      ? `\\textbf{${href(item.link, item.name)}}`
      : `\\textbf{${formatLatex(item.name)}}`
    const tech = item.tech ? ` $|$ \\emph{${formatLatex(item.tech)}}` : ""
    return `\\resumeProjectHeading{${name}${tech}}{${formatLatex(item.dates)}}\n${bullets(item.bullets)}`
  })
  return `\\section{Projects}\n\\resumeSubHeadingListStart\n${items.join("\n")}\n\\resumeSubHeadingListEnd`
}

function skillsBlock(resume) {
  if (!resume.skills?.length) return ""
  const rows = resume.skills
    .filter((s) => s.category || s.items)
    .map((s) => `\\textbf{${formatLatex(s.category)}}{: ${formatLatex(s.items)}}`)
  return `\\section{Technical Skills}\n\\begin{itemize}[leftmargin=0.15in, label={}]\n\\small{\\item{\n${rows.join(" \\\\\n")}\n}}\n\\end{itemize}`
}

function summaryBlock(resume) {
  if (!resume.summary?.trim()) return ""
  return `\\section{Summary}\n${formatLatex(resume.summary.trim())}\\vspace{-8pt}`
}

function macros() {
  return String.raw`
\newcommand{\resumeItem}[1]{\item\small{#1 \vspace{-2pt}}}
\newcommand{\resumeSubheading}[4]{
  \vspace{-1pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=1.5em, itemsep=2pt, parsep=0pt, topsep=2pt, label=\textbullet]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
`.trim()
}

function paper(resume) {
  return resume.page === "a4" ? "a4paper" : "letterpaper"
}

function body(resume) {
  ensureResume(resume)
  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER
  const blocks = {
    summary: () => summaryBlock(resume),
    education: () => educationBlock(resume),
    experience: () => rolesBlock("Experience", resume.experience),
    internships: () => rolesBlock("Internships", resume.internships),
    fieldwork: () => rolesBlock("Fieldwork", resume.fieldwork),
    responsibilities: () => rolesBlock("Positions of Responsibility", resume.responsibilities),
    extracurricular: () => rolesBlock("Extra Curricular", resume.extracurricular),
    projects: () => projectsBlock(resume),
    skills: () => skillsBlock(resume),
  }
  const content = order
    .filter((id) => sectionHasContent(resume, id))
    .map((id) => blocks[id]?.() || "")
    .filter(Boolean)
    .join("\n\n")
  return `
\\begin{document}

${headerBlock(resume)}

${content}

\\end{document}
`.trim()
}

const TEMPLATES = {
  classic: (resume) => `% Resume generated by ResuForm
\\documentclass[${paper(resume)},11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{xcolor}
\\usepackage{fontawesome5}
\\pagestyle{empty}
\\setlength{\\tabcolsep}{0in}
\\raggedright
\\raggedbottom
\\urlstyle{same}
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\titlerule \\vspace{-5pt}]
${macros()}
${body(resume)}
`,

  modern: (resume) => `% Resume generated by ResuForm
\\documentclass[${paper(resume)},11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{xcolor}
\\usepackage{fontawesome5}
\\definecolor{accent}{HTML}{7A2E2E}
\\pagestyle{empty}
\\setlength{\\tabcolsep}{0in}
\\raggedright
\\raggedbottom
\\urlstyle{same}
\\titleformat{\\section}{\\color{accent}\\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[{\\color{accent}\\titlerule}\\vspace{-5pt}]
${macros()}
${body(resume)}
`,

  compact: (resume) => `% Resume generated by ResuForm
\\documentclass[${paper(resume)},10pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.4in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{xcolor}
\\usepackage{fontawesome5}
\\pagestyle{empty}
\\setlength{\\tabcolsep}{0in}
\\raggedright
\\raggedbottom
\\setlist[itemize]{itemsep=1pt, parsep=0pt, topsep=2pt}
\\urlstyle{same}
\\titleformat{\\section}{\\vspace{-6pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\titlerule \\vspace{-6pt}]
${macros()}
${body(resume)}
`,
}

export function generateLatex(resume, template = "classic") {
  const fn = TEMPLATES[template] || TEMPLATES.classic
  return fn(resume).replace(/\n{3,}/g, "\n\n").trim() + "\n"
}
