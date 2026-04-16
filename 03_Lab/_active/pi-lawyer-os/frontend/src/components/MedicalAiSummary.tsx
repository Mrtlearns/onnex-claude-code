import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { MedicalAnalysis } from '@/types';

interface MedicalAiSummaryProps {
  analysis: MedicalAnalysis;
}

export default function MedicalAiSummary({ analysis }: MedicalAiSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-6 mb-2 bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-purple-700 font-medium w-full text-left"
      >
        <Brain className="w-3.5 h-3.5 shrink-0" />
        AI Medical Summary
        {expanded ? (
          <ChevronUp className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 text-gray-700">
          {analysis.injuries_described && (
            <div>
              <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Injuries</span>
              <p className="mt-0.5">{analysis.injuries_described}</p>
            </div>
          )}
          {analysis.diagnoses && analysis.diagnoses.length > 0 && (
            <div>
              <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Diagnoses</span>
              <ul className="mt-0.5 list-disc ml-3">
                {analysis.diagnoses.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {analysis.treatment_provided && (
            <div>
              <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Treatment</span>
              <p className="mt-0.5">{analysis.treatment_provided}</p>
            </div>
          )}
          {analysis.dates_of_treatment && analysis.dates_of_treatment.length > 0 && (
            <div>
              <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Dates</span>
              <p className="mt-0.5">{analysis.dates_of_treatment.join(', ')}</p>
            </div>
          )}
          <div className="flex gap-4 pt-1 border-t border-purple-100">
            {analysis.total_bill > 0 && (
              <div>
                <span className="text-gray-500">Total Bill: </span>
                <span className="font-semibold text-gray-900">
                  ${Number(analysis.total_bill).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {analysis.lien_amount > 0 && (
              <div>
                <span className="text-gray-500">Lien: </span>
                <span className="font-semibold text-gray-900">
                  ${Number(analysis.lien_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
