import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, GitCompare } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface SimilarCase {
  case_id: string;
  case_number: string | null;
  case_type: string;
  status: string;
  similarity_pct: number;
  gross_settlement: number | null;
}

interface Props {
  caseId: string;
}

export default function SimilarCasesPanel({ caseId }: Props) {
  const [cases, setCases] = useState<SimilarCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<{ similar: SimilarCase[] }>(`/ai/similar-cases/${caseId}`)
      .then((data) => setCases(data.similar))
      .catch(() => setError('Could not load similar cases'))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading similar cases…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-gray-400 py-2">{error}</p>;
  }

  if (cases.length === 0) {
    return <p className="text-sm text-gray-400 py-2">No similar cases found yet. Embed more cases to improve results.</p>;
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => (
        <div key={c.case_id} className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
          <GitCompare className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <Link
              to={`/cases/${c.case_id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {c.case_number ?? c.case_id.slice(0, 8)}
            </Link>
            <span className="ml-2 text-gray-500 capitalize">{c.case_type.replace(/-/g, ' ')}</span>
            {c.gross_settlement && (
              <span className="ml-2 text-green-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(c.gross_settlement)}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-gray-500">{c.similarity_pct}% match</span>
        </div>
      ))}
    </div>
  );
}
