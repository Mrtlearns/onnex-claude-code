import { useEffect, useState } from "react";
import { Box, Search } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getEntities } from "@/lib/db/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";

const ENTITY_TYPES = ["all", "organization", "person", "product", "date", "concept", "event", "technology", "location", "other"];

export default function Entities() {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    getEntities(selectedProject.id, typeFilter === "all" ? undefined : typeFilter)
      .then(setEntities).catch(() => setEntities([])).finally(() => setLoading(false));
  }, [selectedProject, typeFilter]);

  const filtered = entities.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!selectedProject) {
    return <EmptyState icon={Box} title="No project selected" description="Select a project to view extracted entities." />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Box className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Entities</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} entit{filtered.length !== 1 ? "ies" : "y"} found</p>
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search entities..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </AnimateIn>

      <AnimateIn delay={160}>
        {loading ? (
          <Card><CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </CardContent></Card>
        ) : entities.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Box}
              title="No entities yet"
              description="Entities are automatically extracted when documents are processed. Upload some documents to get started."
              action={{ label: "Upload Documents", onClick: () => navigate("/documents") }}
            />
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Metadata</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No entities match your search</TableCell></TableRow>
                  ) : paginated.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{e.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{JSON.stringify(e.metadata)}</TableCell>
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
