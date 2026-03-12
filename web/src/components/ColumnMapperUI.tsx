import { ArrowRight, Check } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ColumnMapping {
  source: string
  target: string
}

interface ColumnMapperUIProps {
  sourceColumns: string[]
  targetFields: { key: string; label: string; required?: boolean }[]
  mappings: ColumnMapping[]
  onMappingChange: (mappings: ColumnMapping[]) => void
}

export default function ColumnMapperUI({
  sourceColumns,
  targetFields,
  mappings,
  onMappingChange,
}: ColumnMapperUIProps) {
  const getMapping = (targetKey: string) => mappings.find((m) => m.target === targetKey)?.source || ''

  const handleChange = (targetKey: string, sourceCol: string) => {
    const filtered = mappings.filter((m) => m.target !== targetKey)
    if (sourceCol) {
      filtered.push({ source: sourceCol, target: targetKey })
    }
    onMappingChange(filtered)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>Campo del archivo</span>
        <span />
        <span>Campo destino</span>
      </div>

      {targetFields.map((field) => {
        const mapped = getMapping(field.key)
        return (
          <div
            key={field.key}
            className={cn(
              'grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border p-3 transition-colors',
              mapped ? 'border-success/30 bg-success/5' : 'border-border',
            )}
          >
            <select
              value={mapped}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Sin mapear —</option>
              {sourceColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <div className="flex items-center">
              {mapped ? (
                <Check size={16} className="text-success" />
              ) : (
                <ArrowRight size={16} className="text-muted-foreground" />
              )}
            </div>

            <div>
              <span className="text-sm font-medium">{field.label}</span>
              {field.required && <span className="ml-1 text-xs text-destructive">*</span>}
              <span className="ml-2 text-xs text-muted-foreground">{field.key}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
