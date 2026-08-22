import { DEFAULT_ORDER } from "./sections.js"

export const SAMPLE_TEXT = `NAME
John Doe

HEADLINE
Software Engineer

CONTACT
phone: +1 (415) 555-0134
email: john.doe@email.com
location: San Francisco, CA
linkedin: linkedin.com/in/johndoexyzabc
github: github.com/johndoexyzabc
website: johndoexyzabc.dev

ORDER
summary, education, internships, experience, projects, skills

SUMMARY
Backend-leaning engineer who likes making messy systems feel simple. Recently shipped query and ranking work that cut latency without growing the machine budget.

EDUCATION
Stanford University | M.S. Computer Science | Stanford, CA | 2024 – 2026
GPA: 3.91 / 4.00
Coursework: Distributed Systems, Machine Learning Systems, Program Analysis

IIT Delhi | B.Tech Computer Science | New Delhi, India | 2020 – 2024
GPA: 8.74 / 10
Thesis: Cost-based planning for streaming joins

INTERNSHIPS
Amazon | SDE Intern | Hyderabad, India | May 2023 – Jul 2023
- Shipped a warehouse slotting service in Java that raised pick density 11% in a pilot site
- Added contract tests around a legacy SOAP boundary so downstream teams could migrate safely

Google Summer of Code | Student Developer | Remote | May 2022 – Aug 2022
- Extended a static analysis pass in LLVM to flag unchecked status codes across 12k call sites

EXPERIENCE
Stripe | Software Engineer | San Francisco, CA | Jul 2024 – Present
- Built a retry-aware query planner for internal analytics, cutting p95 dashboard load time by 32%
- Designed a typed feature store client used by 4 ranking teams; removed a class of silent schema drift
- On-call owner for the payments insights path; wrote runbooks that halved night-time pages

PROJECTS
Pica | TypeScript, Python, LaTeX | github.com/johndoexyzabc/pica | 2026
- Plain-text resume compositor that typesets Jake-style LaTeX without the user writing TeX

Queryfold | Rust, Apache Arrow | github.com/johndoexyzabc/queryfold | 2025
- Vectorized mini-engine for filter-project-join over Parquet; 4x faster than a naive Python baseline on 8GB traces

SKILLS
Languages: Python, TypeScript, Rust, Java, SQL
Systems: PostgreSQL, Redis, Kafka, Docker, Kubernetes
Practice: System design, testing, technical writing
`

export const FORMAT_GUIDE = `NAME
Your Name

HEADLINE
Role or one-line pitch

CONTACT
phone: ...
email: ...
location: ...
linkedin: ...
github: ...
website: ...

SUMMARY
A short paragraph. Optional.

EDUCATION
School | Degree | Location | Dates
GPA, coursework, or extra lines

Or as a table:
EDUCATION
TABLE
Course | Institute | Year | CGPA/%
B.Tech CSE | IIT Delhi | 2020 – 2024 | 8.74/10

EXPERIENCE
Company | Title | Location | Dates
- Bullet
- Bullet

INTERNSHIPS
Organization | Role | Location | Dates
- Bullet

FIELDWORK
Organization | Role | Location | Dates
- Bullet

POSITIONS OF RESPONSIBILITY
Organization | Position | Location | Dates
- Bullet

EXTRA CURRICULAR
Activity | Role | Location | Dates
- Bullet

PROJECTS
Name | Tech stack | link | Dates
- Bullet

SKILLS
Category: item, item, item

Or in two columns (no table):
SKILLS
COLUMNS
Category: item, item, item

RELEVANT COURSEWORK
Core: Data Structures, Algorithms, Operating Systems
Electives: Machine Learning, Compilers

ONLINE CERTIFICATIONS
AWS Cloud Practitioner | Amazon | credential-url | 2024
- Optional detail

ORDER
education, internships, experience, projects, skills

Use Up/Down in Fields, or an ORDER line, to rearrange sections. Internships, Fieldwork, Positions of Responsibility, Extra Curricular, Relevant Coursework, and Online Certifications are optional.

BOLD
Wrap any keyword in double asterisks: **Python**, **query planner**`

export function emptyResume() {
  return {
    name: "",
    headline: "",
    phone: "",
    email: "",
    location: "",
    website: "",
    linkedin: "",
    github: "",
    summary: "",
    education: [],
    educationLayout: "list",
    experience: [],
    internships: [],
    fieldwork: [],
    responsibilities: [],
    extracurricular: [],
    coursework: [],
    projects: [],
    skills: [],
    skillsLayout: "list",
    onlineCerts: [],
    sectionOrder: [...DEFAULT_ORDER],
  }
}
