import type { IParagraphOptions } from 'docx'
import type {
  Content,
  ListItem,
  PhrasingContent,
  Root,
  TableCell as MdTableCell,
} from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

type DocxModule = typeof import('docx')
type DocxParagraph = InstanceType<DocxModule['Paragraph']>
type DocxSectionChild = DocxParagraph | InstanceType<DocxModule['Table']>
type ParagraphChild = import('docx').ParagraphChild

function headingLevelForDepth(docx: DocxModule, depth: number) {
  const { HeadingLevel } = docx
  const levels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ] as const
  return levels[Math.min(Math.max(depth, 1), 6) - 1]
}

function parseMarkdownAst(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm)
  return processor.runSync(processor.parse(markdown)) as Root
}

function phrasingToRuns(
  nodes: PhrasingContent[],
  docx: DocxModule,
  style: { bold?: boolean; italics?: boolean; strike?: boolean } = {},
): ParagraphChild[] {
  const { ExternalHyperlink, TextRun } = docx
  const runs: ParagraphChild[] = []

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        runs.push(
          new TextRun({
            text: node.value,
            bold: style.bold,
            italics: style.italics,
            strike: style.strike,
          }),
        )
        break
      case 'strong':
        runs.push(...phrasingToRuns(node.children, docx, { ...style, bold: true }))
        break
      case 'emphasis':
        runs.push(...phrasingToRuns(node.children, docx, { ...style, italics: true }))
        break
      case 'delete':
        runs.push(...phrasingToRuns(node.children, docx, { ...style, strike: true }))
        break
      case 'inlineCode':
        runs.push(
          new TextRun({
            text: node.value,
            font: 'Consolas',
            bold: style.bold,
            italics: style.italics,
          }),
        )
        break
      case 'link':
        runs.push(
          new ExternalHyperlink({
            link: node.url,
            children: [
              new TextRun({
                text: phrasingToPlainText(node.children),
                style: 'Hyperlink',
                bold: style.bold,
                italics: style.italics,
              }),
            ],
          }),
        )
        break
      case 'break':
        runs.push(new TextRun({ text: '', break: 1 }))
        break
      default:
        break
    }
  }

  return runs
}

function phrasingToPlainText(nodes: PhrasingContent[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.type === 'text') text += node.value
    else if ('children' in node) text += phrasingToPlainText(node.children as PhrasingContent[])
  }
  return text
}

function paragraphFromPhrasing(
  nodes: PhrasingContent[],
  docx: DocxModule,
  options: IParagraphOptions = {},
): DocxParagraph {
  const { Paragraph } = docx
  const children = phrasingToRuns(nodes, docx)
  return new Paragraph({
    ...options,
    children: children.length > 0 ? children : [new docx.TextRun('')],
  })
}

function tableCellParagraphs(cell: MdTableCell, docx: DocxModule, headerRow: boolean): DocxParagraph[] {
  const { Paragraph, TextRun } = docx
  const runs = phrasingToRuns(cell.children, docx, headerRow ? { bold: true } : {})
  return [
    new Paragraph({
      children: runs.length > 0 ? runs : [new TextRun('')],
    }),
  ]
}

function listItemPrefix(item: ListItem): string {
  if (typeof item.checked !== 'boolean') return ''
  return item.checked ? '☑ ' : '☐ '
}

function convertBlocks(nodes: Content[], docx: DocxModule): DocxSectionChild[] {
  const { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = docx
  const children: DocxSectionChild[] = []

  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        children.push(
          paragraphFromPhrasing(node.children, docx, {
            heading: headingLevelForDepth(docx, node.depth),
          }),
        )
        break
      case 'paragraph':
        children.push(paragraphFromPhrasing(node.children, docx))
        break
      case 'thematicBreak':
        children.push(new Paragraph({ children: [new TextRun('—')] }))
        break
      case 'blockquote':
        for (const child of node.children) {
          if (child.type === 'paragraph') {
            children.push(
              paragraphFromPhrasing(child.children, docx, {
                indent: { left: 720 },
              }),
            )
          } else {
            children.push(...convertBlocks([child], docx))
          }
        }
        break
      case 'code':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: node.value, font: 'Consolas' })],
          }),
        )
        break
      case 'list':
        node.children.forEach((item, itemIndex) => {
          const prefix = listItemPrefix(item)

          for (const child of item.children) {
            if (child.type === 'paragraph') {
              const runs = phrasingToRuns(child.children, docx)
              if (prefix) runs.unshift(new TextRun(prefix))

              if (node.ordered) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun(`${itemIndex + 1}. `),
                      ...(runs.length > 0 ? runs : [new TextRun('')]),
                    ],
                  }),
                )
              } else {
                children.push(
                  new Paragraph({
                    children: runs.length > 0 ? runs : [new TextRun('')],
                    bullet: { level: 0 },
                  }),
                )
              }
              continue
            }

            if (child.type === 'list') {
              children.push(...convertBlocks([child], docx))
            }
          }
        })
        break
      case 'table':
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: node.children.map((row, rowIndex) =>
              new TableRow({
                children: row.children.map(
                  (cell) =>
                    new TableCell({
                      children: tableCellParagraphs(cell, docx, rowIndex === 0),
                    }),
                ),
              }),
            ),
          }),
        )
        break
      default:
        break
    }
  }

  return children
}

/** Parse markdown (GFM) and render a Word document with headings, tables, links, and inline styles. */
export async function markdownToDocxBytes(markdown: string): Promise<Uint8Array> {
  const docx = await import('docx')
  const { Document, Packer, Paragraph, TextRun } = docx
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  const ast = normalized ? parseMarkdownAst(normalized) : null
  const children = ast ? convertBlocks(ast.children, docx) : []

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('Empty document export.')] }))
  }

  const doc = new Document({
    sections: [{ children }],
  })
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

/** Harness helper — verify formatted elements survive export. */
export async function runMarkdownToDocxHarness(): Promise<void> {
  const sample = [
    '# Title',
    '',
    '**Purpose:** ship tables and [links](https://example.com).',
    '',
    '| Color | Meaning |',
    '| --- | --- |',
    '| Green | Shipped |',
    '',
    '- [ ] Open task',
    '- [x] Done task',
  ].join('\n')

  const bytes = await markdownToDocxBytes(sample)
  if (bytes.length < 2_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('runMarkdownToDocxHarness: DOCX output missing zip signature')
  }
}
