import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, AlertTriangle } from 'lucide-react'
import type { Rule } from '@/lib/ut/types-rules'

interface Props {
  rules: Rule[]
  onChange: (rules: Rule[]) => void
  readOnly: boolean
}

export default function CodeEditor({ rules, onChange, readOnly }: Props) {
  const [jsonText, setJsonText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    setJsonText(JSON.stringify(rules, null, 2))
    setParseError(null)
    setIsValid(true)
  }, [rules])

  function handleChange(text: string) {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Root must be an array of rules')
      for (const rule of parsed) {
        if (!rule.category || !rule.label || !rule.definition) {
          throw new Error('Each rule must have category, label, and definition')
        }
      }
      setParseError(null)
      setIsValid(true)
      onChange(parsed as Rule[])
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
      setIsValid(false)
    }
  }

  function handleValidate() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!Array.isArray(parsed)) throw new Error('Root must be an array')
      setParseError(null)
      setIsValid(true)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
      setIsValid(false)
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed, null, 2))
      setParseError(null)
      setIsValid(true)
    } catch {
      // Can't format invalid JSON
    }
  }

  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            JSON Editor
            {isValid ? (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                <Check className="h-2.5 w-2.5 mr-0.5" /> Valid
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Invalid
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleFormat}>
              Format
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleValidate}>
              Validate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <textarea
          className="w-full h-[500px] font-mono text-xs p-4 bg-muted/30 border-t resize-none focus:outline-none"
          value={jsonText}
          onChange={e => handleChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
        />
        {parseError && (
          <div className="px-4 py-2 text-xs text-destructive bg-destructive/5 border-t">
            {parseError}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
