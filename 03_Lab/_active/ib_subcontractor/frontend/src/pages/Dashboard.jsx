import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ComplianceBadge from "../components/ComplianceBadge";
import { listProjects } from "../api/projects";
import { listSubs } from "../api/subcontractors";

function getScore(record, fallback = 100) {
  const score = record?.compliance_score ?? record?.score ?? fallback;
  return Number.isFinite(Number(score)) ? Number(score) : fallback;
}

function scoreToLevel(score) {
  if (score < 60) {
    return "red";
  }
  if (score < 80) {
    return "yellow";
  }
  return "green";
}

function formatProject(project, index) {
  return {
    id: project.id ?? index + 1,
    name: project.name ?? "Untitled project",
    address: project.address ?? project.description ?? "No address provided",
    complianceScore: getScore(project, 92),
    subcontractorCount: project.subcontractors?.length ?? project.subcontractor_count ?? 0
  };
}

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects
  });
  const { data: subcontractors = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: listSubs
  });

  const normalizedProjects = projects.map(formatProject);
  const normalizedSubs = subcontractors.map((sub, index) => ({
    id: sub.id ?? index + 1,
    score: getScore(sub, 76)
  }));
  const atRiskCount = normalizedSubs.filter((sub) => sub.score < 80).length;
  const nonCompliantCount = normalizedSubs.filter((sub) => sub.score < 60).length;

  const stats = [
    { label: "Active Projects", value: normalizedProjects.length, tone: "text-ink" },
    { label: "Subcontractors", value: normalizedSubs.length, tone: "text-ink" },
    { label: "At Risk", value: atRiskCount, tone: "text-amber-700" },
    { label: "Non-Compliant", value: nonCompliantCount, tone: "text-rose-700" }
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-signal">Overview</div>
            <h1 className="mt-3 text-3xl font-semibold text-ink">Compliance at a glance</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Track project health, subcontractor risk, and documentation gaps from one view.
            </p>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Manage projects
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5"
          >
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{stat.label}</div>
            <div className={`mt-4 text-4xl font-semibold ${stat.tone}`}>{stat.value}</div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Recent projects</h2>
            <p className="mt-1 text-sm text-slate-600">
              {loadingProjects || loadingSubs
                ? "Loading live project and subcontractor data..."
                : "Latest project activity and current compliance status."}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-3 font-medium">Project</th>
                <th className="pb-3 font-medium">Address</th>
                <th className="pb-3 font-medium">Subs</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {normalizedProjects.map((project) => (
                <tr key={project.id}>
                  <td className="py-4 font-medium text-ink">
                    <Link className="hover:text-signal" to={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                  </td>
                  <td className="py-4 text-slate-600">{project.address}</td>
                  <td className="py-4 text-slate-600">{project.subcontractorCount}</td>
                  <td className="py-4">
                    <ComplianceBadge level={scoreToLevel(project.complianceScore)} />
                  </td>
                </tr>
              ))}
              {!loadingProjects && normalizedProjects.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan="4">
                    No projects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
