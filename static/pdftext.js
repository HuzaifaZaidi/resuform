const MIN_CHARS = 80
const MAX_OCR_PAGES = 2
const PDFJS_VER = "3.11.174"
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`
const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"

let pdfjsReady = null
let tesseractReady = null

function usableLen(text) {
  return String(text || "").replace(/[^0-9A-Za-z]/g, "").length
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-pdftext="${src}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)))
      if (existing.dataset.loaded === "1") resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.pdftext = src
    script.onload = () => {
      script.dataset.loaded = "1"
      resolve()
    }
    script.onerror = () => reject(new Error("Could not load a PDF reader from the network."))
    document.head.appendChild(script)
  })
}

async function loadPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = loadScript(PDFJS_SRC).then(() => {
      const lib = window.pdfjsLib
      if (!lib) throw new Error("PDF reader failed to start.")
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
      return lib
    })
  }
  return pdfjsReady
}

async function loadTesseract() {
  if (!tesseractReady) {
    tesseractReady = loadScript(TESSERACT_SRC).then(() => {
      if (!window.Tesseract) throw new Error("Image reader failed to start.")
      return window.Tesseract
    })
  }
  return tesseractReady
}

function linesFromContent(content) {
  const items = (content?.items || []).filter((item) => item && item.str)
  if (!items.length) return ""
  const rows = []
  for (const item of items) {
    const y = item.transform ? Math.round(item.transform[5]) : 0
    const last = rows[rows.length - 1]
    if (!last || Math.abs(last.y - y) > 3) rows.push({ y, parts: [item.str] })
    else last.parts.push(item.str)
  }
  return rows.map((row) => row.parts.join(" ").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n")
}

async function textFromPdfjs(file, onStatus) {
  const lib = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await lib.getDocument({ data, password: "" }).promise
  try {
    const pages = Math.min(doc.numPages || 0, 6)
    const chunks = []
    for (let i = 1; i <= pages; i += 1) {
      onStatus?.(`Reading PDF text (page ${i} of ${pages})…`)
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      chunks.push(linesFromContent(content))
    }
    return { doc, text: chunks.join("\n\n").trim() }
  } catch (err) {
    doc.destroy?.()
    throw err
  }
}

async function ocrPdf(doc, onStatus) {
  const Tesseract = await loadTesseract()
  onStatus?.("This PDF has no selectable text. Reading the page images…")
  const worker = await Tesseract.createWorker("eng", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core.wasm.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  })
  const pages = Math.min(doc.numPages || 0, MAX_OCR_PAGES)
  const chunks = []
  try {
    for (let i = 1; i <= pages; i += 1) {
      onStatus?.(`Reading page image ${i} of ${pages}…`)
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: 1.8 })
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      await page.render({ canvasContext: canvas.getContext("2d"), viewport, intent: "print" }).promise
      const result = await worker.recognize(canvas)
      chunks.push(String(result?.data?.text || "").trim())
    }
  } finally {
    await worker.terminate()
  }
  return chunks.join("\n\n").trim()
}

export async function extractPdfFile(file, { onStatus } = {}) {
  if (!file) throw new Error("Choose a PDF first.")
  onStatus?.("Reading PDF…")
  let doc
  let text = ""
  try {
    const extracted = await textFromPdfjs(file, onStatus)
    doc = extracted.doc
    text = extracted.text
    if (usableLen(text) < MIN_CHARS) {
      text = await ocrPdf(doc, onStatus)
    }
  } finally {
    try {
      doc?.destroy?.()
    } catch {
      /* ignore */
    }
  }
  if (usableLen(text) < MIN_CHARS) {
    throw new Error(
      "Could not read enough text from this PDF. Use Select from Resume Library, or export the resume from Word or Google Docs as a PDF."
    )
  }
  return text
}
