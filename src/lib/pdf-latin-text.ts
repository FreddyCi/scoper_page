/** Replace common Unicode punctuation and drop chars WinAnsi Helvetica cannot encode. */
export function toPdfLatinText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\u0020-\u00FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
