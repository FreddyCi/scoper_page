import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

type DocumentPickerSelectProps = {
  id: string
  value: string | null
  onChange: (docId: string | null) => void
  placeholder: string
  items: DocumentMeta[]
  className?: string
}

/** Simple doc picker — avoids object-valued combobox showing JSON in the input */
export function DocumentPickerSelect({
  id,
  value,
  onChange,
  placeholder,
  items,
  className,
}: DocumentPickerSelectProps) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value ? event.target.value : null)}
      className={cn(
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]',
        !value && 'text-muted-foreground',
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {items.map((doc) => (
        <option key={doc.doc_id} value={doc.doc_id}>
          {doc.filename}
        </option>
      ))}
    </select>
  )
}
