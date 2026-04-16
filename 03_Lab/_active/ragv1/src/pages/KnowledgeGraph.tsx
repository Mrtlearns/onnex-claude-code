import { useEffect, useState, useRef, useCallback } from "react";
import { Network } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getEntities, getEntityRelations } from "@/lib/db/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";

interface GraphNode { id: number; name: string; type: string; x: number; y: number; vx: number; vy: number }
interface GraphEdge { source: number; target: number; label: string }

const typeColor: Record<string, string> = {
  organization: "#4A90D9", person: "#50B86C", product: "#E8943A",
  date: "#9B72CF", concept: "#D94A6E", event: "#40B8B0",
  technology: "#6AAE40", location: "#C4A630", other: "#888",
};

export default function KnowledgeGraph() {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  useEffect(() => {
    if (!selectedProject) return;
    Promise.all([getEntities(selectedProject.id), getEntityRelations(selectedProject.id, 200)])
      .then(([ents, rels]) => { setEntities(ents); setRelations(rels); }).catch(() => {});
  }, [selectedProject]);

  const buildGraph = useCallback(() => {
    let filteredEnts = entities;
    let filteredRels = relations;
    if (selectedEntity !== "all") {
      const id = parseInt(selectedEntity);
      const relatedIds = new Set<number>([id]);
      relations.forEach((r) => {
        if (r.source_entity_id === id) relatedIds.add(r.target_entity_id);
        if (r.target_entity_id === id) relatedIds.add(r.source_entity_id);
      });
      filteredEnts = entities.filter((e) => relatedIds.has(e.id));
      filteredRels = relations.filter((r) => relatedIds.has(r.source_entity_id) && relatedIds.has(r.target_entity_id));
    }
    nodesRef.current = filteredEnts.slice(0, 60).map((e) => ({
      id: e.id, name: e.name, type: e.type,
      x: 400 + (Math.random() - 0.5) * 300, y: 250 + (Math.random() - 0.5) * 200, vx: 0, vy: 0,
    }));
    edgesRef.current = filteredRels
      .filter((r) => nodesRef.current.some((n) => n.id === r.source_entity_id) && nodesRef.current.some((n) => n.id === r.target_entity_id))
      .map((r) => ({ source: r.source_entity_id, target: r.target_entity_id, label: r.relation_type }));
  }, [entities, relations, selectedEntity]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = true;
    const isDark = document.documentElement.classList.contains("dark");
    const simulate = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force; nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force; nodes[j].vy += (dy / dist) * force;
        }
      }
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      edges.forEach((e) => {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.01;
        s.vx += (dx / dist) * force; s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force; t.vy -= (dy / dist) * force;
      });
      nodes.forEach((n) => {
        n.vx += (400 - n.x) * 0.001; n.vy += (250 - n.y) * 0.001;
        n.vx *= 0.9; n.vy *= 0.9; n.x += n.vx; n.y += n.vy;
      });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      edges.forEach((e) => {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) return;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = isDark ? "hsl(0 0% 35%)" : "hsl(0 0% 75%)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = isDark ? "hsl(0 0% 55%)" : "hsl(0 0% 50%)"; ctx.font = "9px system-ui"; ctx.textAlign = "center";
        ctx.fillText(e.label, (s.x + t.x) / 2, (s.y + t.y) / 2 - 4);
      });
      nodes.forEach((n) => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = typeColor[n.type] || typeColor.other; ctx.fill();
        ctx.fillStyle = isDark ? "hsl(0 0% 85%)" : "hsl(0 0% 20%)"; ctx.font = "10px system-ui"; ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, n.y + 18);
      });
      requestAnimationFrame(simulate);
    };
    simulate();
    return () => { running = false; };
  }, [entities, relations, selectedEntity]);

  if (!selectedProject) {
    return <EmptyState icon={Network} title="No project selected" description="Select a project to visualize your knowledge graph." />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Network className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Knowledge Graph</h1>
            <p className="text-sm text-muted-foreground">{entities.length} entities, {relations.length} relations</p>
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Focus entity..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.slice(0, 100).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.type})</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(typeColor).slice(0, 6).map(([t, c]) => (
              <Badge key={t} variant="outline" className="text-[9px] gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{t}
              </Badge>
            ))}
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={160}>
        <Card>
          <CardContent className="p-4">
            {entities.length === 0 ? (
              <EmptyState
                icon={Network}
                title="No entities to visualize"
                description="Upload and process documents with entity extraction enabled to build your knowledge graph."
                action={{ label: "Upload Documents", onClick: () => navigate("/documents") }}
              />
            ) : (
              <canvas ref={canvasRef} width={800} height={500} className="w-full rounded-md" style={{ maxHeight: 500 }} />
            )}
          </CardContent>
        </Card>
      </AnimateIn>
    </div>
  );
}
