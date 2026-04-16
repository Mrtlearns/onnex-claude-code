import { useEffect, useState } from "react";
import { GitBranch, Search } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getEntityRelations } from "@/lib/db/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";

export default function Relations() {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const [relations, setRelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    getEntityRelations(selectedProject.id, 500).then(setRelations).catch(() => setRelations([])).finally(() => setLoading(false));
  }, [selectedProject]);

  const filtered = relations.filter((r) =>
    r.relation_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.source?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.target?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!selectedProject) {
    return <EmptyState icon={GitBranch} title="No project selected" description="Select a project to view entity relations." />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><GitBranch className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Relations</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} relation{filtered.length !== 1 ? "s" : ""} found</p>
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search relations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={160}>
        {loading ? (
          <Card><CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </CardContent></Card>
        ) : relations.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={GitBranch}
              title="No relations yet"
              description="Relations are extracted from documents during processing. Enable relation extraction in Settings."
              action={{ label: "Go to Settings", onClick: () => navigate("/settings") }}
            />
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Relation</TableHead><TableHead>Target</TableHead><TableHead>Metadata</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No relations match your search</TableCell></TableRow>
                  ) : paginated.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell><div className="flex items-center gap-1.5"><span className="font-medium text-sm">{r.source?.name}</span><Badge variant="outline" className="text-[9px]">{r.source?.type}</Badge></div></TableCell>
                      <TableCell><Badge className="text-[10px]">{r.relation_type}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-1.5"><span className="font-medium text-sm">{r.target?.name}</span><Badge variant="outline" className="text-[9px]">{r.target?.type}</Badge></div></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{JSON.stringify(r.metadata)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </AnimateIn>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Prev</Button>
          <span className="text-sm text-muted-foreground tabular-nums">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  );
}
