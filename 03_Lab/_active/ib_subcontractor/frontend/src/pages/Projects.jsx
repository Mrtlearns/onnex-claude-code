import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ComplianceBadge from "../components/ComplianceBadge";
import { createProject, listProjects } from "../api/projects";

function getProjectScore(project) {
  const score = project?.compliance_score ?? project?.score ?? 90;
  return Number.isFinite(Number(score)) ? Number(score) : 90;
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

export default function Projects() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      toast.success("Project created");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsOpen(false);
      setName("");
      setAddress("");
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    createMutation.mutate({
      name,
      address,
      description: address,
      organization_id: 1
    });
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-signal">Projects</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Project portfolio</h1>
          <p className="mt-2 text-sm text-slate-600">Create projects and monitor subcontractor compliance by site.</p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          New Project
        </button>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Address</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project, index) => {
                const score = getProjectScore(project);
                return (
                  <tr key={project.id ?? index}>
                    <td className="py-4 font-medium text-ink">
                      <Link className="hover:text-signal" to={`/projects/${project.id ?? index + 1}`}>
                        {project.name ?? "Untitled project"}
                      </Link>
                    </td>
                    <td className="py-4 text-slate-600">
                      {project.address ?? project.description ?? "No address provided"}
                    </td>
                    <td className="py-4">
                      <ComplianceBadge level={scoreToLevel(score)} />
                    </td>
                  </tr>
                );
              })}
              {!isLoading && projects.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan="3">
                    No projects found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">New Project</h2>
                <p className="mt-1 text-sm text-slate-600">Add a site and start inviting subcontractors.</p>
              </div>
              <button className="text-slate-500 hover:text-ink" type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-steel">Project Name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-orange-200"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-steel">Address</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-orange-200"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </label>
              <button
                className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
