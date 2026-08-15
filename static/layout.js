const TEMPLATE_MARGIN = {
  classic: 0.5,
  modern: 0.55,
  compact: 0.4,
  two_column: 0.48,
  modern_photo: 0.55,
  two_column_photo: 0.48,
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100
}

export function defaultMargins(template) {
  const v = TEMPLATE_MARGIN[template] ?? 0.5
  return { top: v, right: v, bottom: v, left: v }
}

export function normalizeMargins(raw, template = "classic") {
  const fallback = defaultMargins(template)
  const src = raw && typeof raw === "object" ? raw : {}
  return {
    top: clamp(src.top, 0.15, 1.75, fallback.top),
    right: clamp(src.right, 0.15, 1.75, fallback.right),
    bottom: clamp(src.bottom, 0.15, 1.75, fallback.bottom),
    left: clamp(src.left, 0.15, 1.75, fallback.left),
  }
}

export function normalizeLineSpacing(raw) {
  return clamp(raw, 0.8, 1.8, 1)
}

export function marginsMatchTemplate(margins, template) {
  const expected = defaultMargins(template)
  const actual = normalizeMargins(margins, template)
  return ["top", "right", "bottom", "left"].every((side) => Math.abs(actual[side] - expected[side]) < 0.001)
}

export function geometryPackage(resume, template = "classic") {
  const m = normalizeMargins(resume?.margins, template)
  return `\\usepackage[top=${m.top}in,bottom=${m.bottom}in,left=${m.left}in,right=${m.right}in]{geometry}`
}

export function spacingCommands(resume) {
  const v = normalizeLineSpacing(resume?.lineSpacing)
  return `\\linespread{${v}}\\selectfont`
}

export function proofPageStyle(resume, template = "classic") {
  const m = normalizeMargins(resume?.margins, template)
  const v = normalizeLineSpacing(resume?.lineSpacing)
  return `padding: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; line-height: ${(1.25 * v).toFixed(3)};`
}
