/** Accepted upload types — PDF, Word, Markdown, Excel per PRD §5.2 */
export const UPLOAD_ACCEPT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.md',
  '.markdown',
  '.xls',
  '.xlsx',
] as const

export const UPLOAD_ACCEPT_STRING = UPLOAD_ACCEPT_EXTENSIONS.join(',')

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
  markdown: 'text/markdown',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export function getFileExtension(filename: string): string | null {
  const match = /\.([^.]+)$/.exec(filename.trim())
  return match ? match[1].toLowerCase() : null
}

export function isAcceptedUploadFile(file: File): boolean {
  const extension = getFileExtension(file.name)
  if (!extension) return false
  if (extension in EXTENSION_MIME) return true
  return UPLOAD_ACCEPT_EXTENSIONS.some(
    (value) => value.slice(1) === extension,
  )
}

export function isMarkdownFile(file: File): boolean {
  const extension = getFileExtension(file.name)
  return file.type === 'text/markdown' || extension === 'md' || extension === 'markdown'
}

export function mimeFromFilename(filename: string): string {
  const extension = getFileExtension(filename)
  if (extension && extension in EXTENSION_MIME) {
    return EXTENSION_MIME[extension]
  }
  return 'application/octet-stream'
}

export function formatUploadFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
