/**
 * Generate minimal text PDFs for the demo corpus (BDA-091).
 * Pure PDF 1.4 — no external PDF library required.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sampleDir = join(root, 'sample')
const publicSampleDir = join(root, 'public/sample')

const CORPUS = [
  {
    filename: 'rfp-it-services.pdf',
    lines: [
      'REQUEST FOR PROPOSAL — IT Services Platform',
      '',
      '1. Scope',
      'Vendor shall provide cloud migration and managed support services.',
      '',
      '2. Mandatory requirements',
      'Bidder must hold CMMI Level 3 certification or equivalent.',
      'Bidder shall maintain commercial general liability insurance of at least $2M.',
      'Pricing must be submitted as a fixed-fee schedule with no hidden uplifts.',
      '',
      '3. Legal',
      'Contractor shall indemnify the client against third-party IP claims.',
      'Proposal must include termination for convenience within ninety (90) days notice.',
    ],
  },
  {
    filename: 'bidder-acme-response.pdf',
    lines: [
      'Acme Systems — Proposal Response',
      '',
      'Company: Acme Systems Inc.',
      'Contact: Jordan Lee, Proposal Manager',
      '',
      'Certifications: CMMI Level 3 appraised; ISO 27001 accredited.',
      'Insurance: Commercial general liability coverage of $2M per occurrence.',
      'Pricing: Fixed-fee subscription at $48,000 per year for three years.',
      '',
      'Indemnification: Acme agrees to indemnify Client per Section 3 of the RFP.',
      'We accept termination for convenience with ninety (90) days written notice.',
    ],
  },
  {
    filename: 'bidder-contoso-response.pdf',
    lines: [
      'Contoso Ltd — Technical Proposal',
      '',
      'Company: Contoso Ltd.',
      'Contact: Sam Rivera, Sales Director',
      '',
      'Certifications: Internal quality program; CMMI assessment scheduled next quarter.',
      'Insurance: General liability policy renewal pending — current certificate attached separately.',
      'Pricing: Time and materials estimate with optional 15% annual uplift for expanded scope.',
      '',
      'Legal: Standard limitation of liability applies; indemnification subject to negotiation.',
    ],
  },
]

function escapePdfText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildTextPdf(lines) {
  const contentLines = []
  let y = 740

  for (const line of lines) {
    const safe = escapePdfText(line)
    contentLines.push(`BT /F1 11 Tf 56 ${y} Td (${safe}) Tj ET`)
    y -= line.trim() === '' ? 10 : 16
  }

  const stream = `${contentLines.join('\n')}\n`
  const streamLength = Buffer.byteLength(stream, 'utf8')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += object
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'utf8')
}

mkdirSync(sampleDir, { recursive: true })
mkdirSync(publicSampleDir, { recursive: true })

for (const doc of CORPUS) {
  const bytes = buildTextPdf(doc.lines)
  writeFileSync(join(sampleDir, doc.filename), bytes)
  writeFileSync(join(publicSampleDir, doc.filename), bytes)
  console.log(`[generate-sample-pdfs] wrote ${doc.filename}`)
}

console.log('[generate-sample-pdfs] corpus ready in sample/ and public/sample/')
