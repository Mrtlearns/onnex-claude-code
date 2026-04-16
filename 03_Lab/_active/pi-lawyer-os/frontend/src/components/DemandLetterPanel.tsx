import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Copy, Check, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemandLetter, useGenerateDemandLetter, useUpdateDemandLetter } from '@/hooks/useDemandLetter';

interface DemandLetterPanelProps {
  caseId: string;
}

export default function DemandLetterPanel({ caseId }: DemandLetterPanelProps) {
  const { data: letter, isLoading } = useDemandLetter(caseId);
  const generate = useGenerateDemandLetter();
  const update = useUpdateDemandLetter();

  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync editor to loaded letter
  useEffect(() => {
    if (letter?.content) {
      setDraft(letter.content);
      setIsDirty(false);
    }
  }, [letter?.content]);

  function handleEdit(value: string) {
    setDraft(value);
    setIsDirty(value !== (letter?.content ?? ''));
  }

  async function handleGenerate() {
    await generate.mutateAsync({ case_id: caseId });
  }

  async function handleSave() {
    await update.mutateAsync({ case_id: caseId, content: draft });
    setIsDirty(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading demand letter…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Demand Letter Draft</h3>
        <div className="flex items-center gap-2">
          {letter?.generated_at && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Generated {new Date(letter.generated_at).toLocaleDateString()}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="gap-1.5"
          >
            {generate.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : letter ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {letter ? 'Regenerate' : 'Generate with AI'}
          </Button>
        </div>
      </div>

      {generate.isError && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">
          {generate.error?.message}
        </p>
      )}

      {!letter && !generate.isPending && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No demand letter yet.</p>
          <p className="text-xs text-gray-400">
            Click "Generate with AI" to create a draft from case facts and medical summaries.
          </p>
        </div>
      )}

      {generate.isPending && (
        <div className="border border-gray-200 rounded-lg p-8 text-center">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Generating demand letter…</p>
          <p className="text-xs text-gray-400 mt-1">This may take 15–30 seconds.</p>
        </div>
      )}

      {draft && !generate.isPending && (
        <>
          <textarea
            className="w-full h-96 rounded-lg border border-gray-200 p-4 text-sm font-mono text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
            value={draft}
            onChange={(e) => handleEdit(e.target.value)}
            spellCheck
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{draft.length.toLocaleString()} characters</span>
            <div className="flex gap-2">
              {isDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={update.isPending}
                >
                  {update.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? (
                  <><Check className="w-3.5 h-3.5 text-green-500" />Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" />Copy</>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
