const styles = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700"
};

export default function ComplianceBadge({ level }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles[level]}`}>
      {level}
    </span>
  );
}
