import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import type { RuleSetVersion } from '@/lib/ut/types-rules'

interface Props {
  versions: RuleSetVersion[]
  activeVersionId: string | null
  onSelectVersion: (versionId: string) => void
}

export default function VersionHistory({ versions, activeVersionId, onSelectVersion }: Props) {
  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Version History
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0">
        <div className="space-y-0.5 max-h-96 overflow-y-auto">
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => onSelectVersion(v.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                v.id === activeVersionId
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">v{v.version}</span>
                {v.is_latest && (
                  <Badge variant="default" className="text-[9px] h-4 px-1">latest</Badge>
                )}
              </div>
              {v.notes && (
                <p className="text-muted-foreground mt-0.5 truncate">{v.notes}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(v.created_at).toLocaleString()} by {v.created_by}
              </p>
            </button>
          ))}
          {versions.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4">No versions yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
