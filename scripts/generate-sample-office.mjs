/**
 * Generate minimal Word / Excel fixtures for ingest harnesses (BDA-080, BDA-081).
 */
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [join(root, 'sample'), join(root, 'public/sample')]

function writeToBoth(filename, bytes) {
  for (const dir of targets) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, filename), bytes)
  }
}

function buildMinimalXlsx() {
  const rows = [
    ['Requirement', 'Status', 'Notes'],
    ['CMMI Level 3', 'Required', 'Must be current at award'],
    ['Insurance $2M', 'Required', 'Certificate of insurance'],
    ['Fixed pricing', 'Preferred', 'No T&M without approval'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'RFP Checklist')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

function buildMinimalDocx() {
  const tempDir = mkdtempSync(join(tmpdir(), 'scoper-docx-'))
  const wordDir = join(tempDir, 'word')
  const relsDir = join(tempDir, '_rels')
  const wordRelsDir = join(wordDir, '_rels')

  mkdirSync(wordRelsDir, { recursive: true })
  mkdirSync(relsDir, { recursive: true })

  writeFileSync(
    join(tempDir, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  )

  writeFileSync(
    join(relsDir, '.rels'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )

  writeFileSync(
    join(wordRelsDir, 'document.xml.rels'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  )

  writeFileSync(
    join(wordDir, 'styles.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
  </w:style>
</w:styles>`,
  )

  writeFileSync(
    join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Statement of Work</w:t></w:r></w:p>
    <w:p><w:r><w:t>Vendor shall deliver platform migration services per the RFP.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Deliverables</w:t></w:r></w:p>
    <w:p><w:r><w:t>Phase 1 discovery and Phase 2 implementation milestones.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  )

  const outputPath = join(tempDir, 'minimal.docx')
  execSync(`cd "${tempDir}" && zip -qr "${outputPath}" "[Content_Types].xml" _rels word`, {
    stdio: 'pipe',
  })

  const bytes = readFileSync(outputPath)
  rmSync(tempDir, { recursive: true, force: true })
  return bytes
}

writeToBoth('minimal.xlsx', buildMinimalXlsx())
console.log('[generate-sample-office] wrote minimal.xlsx')

writeToBoth('minimal.docx', buildMinimalDocx())
console.log('[generate-sample-office] wrote minimal.docx')
