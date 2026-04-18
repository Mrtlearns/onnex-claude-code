export default function CertCard({ certification }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm uppercase tracking-wide text-slate-500">Certification</div>
      <h3 className="mt-2 text-lg font-semibold text-ink">{certification.name}</h3>
      <p className="mt-2 text-sm text-slate-600">Expires on {certification.expiry_date}</p>
    </article>
  );
}
