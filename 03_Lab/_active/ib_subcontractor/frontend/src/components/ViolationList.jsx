export default function ViolationList({ violations }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-ink">Recent OSHA Violations</h3>
      <ul className="space-y-3">
        {violations.map((violation) => (
          <li key={violation.id} className="rounded-xl bg-slate-50 p-3">
            <div className="font-medium capitalize text-ink">{violation.citation_type}</div>
            <div className="text-sm text-slate-600">{violation.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
