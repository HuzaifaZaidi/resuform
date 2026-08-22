const TEMPLATE_MARGIN = {
  classic: 0.5,
  modern: 0.55,
  compact: 0.4,
  two_column: 0.48,
  modern_photo: 0.55,
  two_column_photo: 0.48,
}

export const PAPER_PRESETS = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
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

export function defaultPaperSize(page = "letter") {
  return { ...(PAPER_PRESETS[page] || PAPER_PRESETS.letter) }
}

export function normalizePaperSize(raw, page = "letter") {
  const fallback = defaultPaperSize(page)
  const src = raw && typeof raw === "object" ? raw : {}
  return {
    width: clamp(src.width, 7, 14, fallback.width),
    height: clamp(src.height, 8, 20, fallback.height),
  }
}

export function pageFromSize(size, page = "letter") {
  const s = normalizePaperSize(size, page)
  const letter = PAPER_PRESETS.letter
  const a4 = PAPER_PRESETS.a4
  if (Math.abs(s.width - letter.width) < 0.02 && Math.abs(s.height - letter.height) < 0.02) return "letter"
  if (Math.abs(s.width - a4.width) < 0.03 && Math.abs(s.height - a4.height) < 0.03) return "a4"
  return "custom"
}

export function marginsMatchTemplate(margins, template) {
  const expected = defaultMargins(template)
  const actual = normalizeMargins(margins, template)
  return ["top", "right", "bottom", "left"].every((side) => Math.abs(actual[side] - expected[side]) < 0.001)
}

export function geometryPackage(resume, template = "classic") {
  const m = normalizeMargins(resume?.margins, template)
  const s = normalizePaperSize(resume?.paperSize, resume?.page)
  return `\\usepackage[paperwidth=${s.width}in,paperheight=${s.height}in,top=${m.top}in,bottom=${m.bottom}in,left=${m.left}in,right=${m.right}in]{geometry}`
}

export function spacingCommands(resume) {
  const v = normalizeLineSpacing(resume?.lineSpacing)
  return `\\linespread{${v}}\\selectfont`
}

export function proofPageStyle(resume, template = "classic") {
  const m = normalizeMargins(resume?.margins, template)
  const v = normalizeLineSpacing(resume?.lineSpacing)
  const s = normalizePaperSize(resume?.paperSize, resume?.page)
  return `width: ${s.width}in; min-height: ${s.height}in; padding: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; line-height: ${(1.25 * v).toFixed(3)};`
}
