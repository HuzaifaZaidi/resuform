export const SECTION_DEFS = [
  { id: "summary", label: "Summary", header: "SUMMARY", kind: "text", core: true },
  { id: "education", label: "Education", header: "EDUCATION", kind: "education", core: true },
  { id: "experience", label: "Experience", header: "EXPERIENCE", kind: "roles", org: "Company", role: "Title", core: true },
  { id: "internships", label: "Internships", header: "INTERNSHIPS", kind: "roles", org: "Organization", role: "Role", core: false },
  { id: "fieldwork", label: "Fieldwork", header: "FIELDWORK", kind: "roles", org: "Organization", role: "Role", core: false },
  { id: "responsibilities", label: "Positions of Responsibility", header: "POSITIONS OF RESPONSIBILITY", kind: "roles", org: "Organization", role: "Position", core: false },
  { id: "extracurricular", label: "Extra Curricular", header: "EXTRA CURRICULAR", kind: "roles", org: "Activity", role: "Role", core: false },
  { id: "projects", label: "Projects", header: "PROJECTS", kind: "projects", core: true },
  { id: "skills", label: "Technical Skills", header: "SKILLS", kind: "skills", core: true },
]

export const DEFAULT_ORDER = SECTION_DEFS.filter((s) => s.core).map((s) => s.id)

export const SECTION_ALIASES = {
  name: "name",
  names: "name",
  headline: "headline",
  title: "headline",
  tagline: "headline",
  contact: "contact",
  contacts: "contact",
  summary: "summary",
  profile: "summary",
  objective: "summary",
  about: "summary",
  education: "education",
  school: "education",
  schools: "education",
  experience: "experience",
  work: "experience",
  employment: "experience",
  internships: "internships",
  internship: "internships",
  intern: "internships",
  fieldwork: "fieldwork",
  fieldworks: "fieldwork",
  fieldWork: "fieldwork",
  por: "responsibilities",
  responsibilities: "responsibilities",
  positionsofresponsibility: "responsibilities",
  positionsofresponsibilities: "responsibilities",
  positionofresponsibility: "responsibilities",
  leadership: "responsibilities",
  extracurricular: "extracurricular",
  extracurriculars: "extracurricular",
  extracurricularactivities: "extracurricular",
  activities: "extracurricular",
  projects: "projects",
  project: "projects",
  skills: "skills",
  skill: "skills",
  technicalskills: "skills",
  order: "order",
  sectionorder: "order",
}

export function sectionDef(id) {
  return SECTION_DEFS.find((s) => s.id === id)
}

export function ensureResume(resume) {
  if (!resume.internships) resume.internships = []
  if (!resume.fieldwork) resume.fieldwork = []
  if (!resume.responsibilities) resume.responsibilities = []
  if (!resume.extracurricular) resume.extracurricular = []
  if (!Array.isArray(resume.sectionOrder) || !resume.sectionOrder.length) {
    resume.sectionOrder = [...DEFAULT_ORDER]
  }
  return resume
}

export function sectionHasContent(resume, id) {
  const def = sectionDef(id)
  if (!def) return false
  if (def.kind === "text") return Boolean(resume.summary?.trim())
  if (def.kind === "education") return Boolean(resume.education?.length) || resume.educationLayout === "table"
  const items = resume[id]
  return Array.isArray(items) && items.length > 0
}
