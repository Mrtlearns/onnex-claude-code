import { useState, useRef, useEffect } from "react";
import { FlaskConical, Play, Trash2, ChevronDown, ChevronRight, BarChart2 } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createChatSession } from "@/lib/db/chat";
import { getEvalResults, triggerEvalScoring, type EvalResultRow } from "@/lib/db/eval";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { AnimateIn } from "@/components/AnimateIn";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const RETRIEVAL_MODES = [
  { value: "hybrid", label: "Hybrid (BM25 + Vector + RRF)" },
  { value: "mix", label: "Mix (Vector + Graph)" },
  { value: "global", label: "Global (Broad Vector)" },
  { value: "relation_only", label: "Relation Only (Graph)" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ragv1-chat`;

type EvalChunk = {
  id: number;
  content: string;
  chunk_index: number;
  document_id: number;
};

type EvalScores = {
  faithfulness: number | null;
  relevance: number | null;
  groundedness: number | null;
  faithfulness_reason?: string | null;
  relevance_reason?: string | null;
  groundedness_reason?: string | null;
};

type EvalRun = {
  id: number;
  query: string;
  mode: string;
  answer: string;
  chunks: EvalChunk[];
  timestamp: string;
  durationMs: number;
  retrievalEventId?: number;
  scores?: EvalScores;
  scoringState?: "pending" | "done" | "error";
};

function scoreBadgeVariant(score: number | null): string {
  if (score === null) return "outline";
  if (score >= 0.7) return "default";
  if (score >= 0.4) return "secondary";
  return "destructive";
}

function ScoreBadge({ label, score }: { label: string; score: number | null }) {
  const display = score !== null ? score.toFixed(2) : "—";
  return (
    <Badge variant={scoreBadgeVariant(score) as any} className="text-xs font-mono">
      {label}: {display}
    </Badge>
  );
}

export default function Evaluation() {
  const { selectedProject } = useProject();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("run");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const evalSessionRef = useRef<number | null>(null);
  const runCounter = useRef(0);

  // Metrics tab state
  const [evalResults, setEvalResults] = useState<EvalResultRow[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Reset eval session when project changes
  useEffect(() => {
    evalSessionRef.current = null;
  }, [selectedProject?.id]);

  // Fetch metrics when Metrics tab becomes active
  useEffect(() => {
    if (activeTab !== "metrics" || !selectedProject) return;
    setMetricsLoading(true);
    getEvalResults(selectedProject.id)
      .then(setEvalResults)
      .catch((e) => toast.error("Failed to load eval results: " + e.message))
      .finally(() => setMetricsLoading(false));
  }, [activeTab, selectedProject?.id]);

  const getOrCreateEvalSession = async (projectId: number): Promise<number> => {
    if (evalSessionRef.current) return evalSessionRef.current;
    const s = await createChatSession(projectId, "RAG Evaluation");
    evalSessionRef.current = s.id;
    return s.id;
  };

  const handleRun = async () => {
    if (!query.trim() || !selectedProject) return;
    setRunning(true);
    const startMs = Date.now();
    const currentQuery = query.trim();

    try {
      const sessionId = await getOrCreateEvalSession(selectedProject.id);
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, message: currentQuery, retrieval_mode: mode }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limited — try again in a moment.");
        else if (resp.status === 402) toast.error("Credits exhausted — add funds in Settings.");
        else toast.error(err.error || "Evaluation run failed");
        return;
      }

      // Stream response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) answer += content;
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      // Short delay to allow the edge function to write the retrieval event
      await new Promise((r) => setTimeout(r, 600));

      // Fetch retrieval event (including id for eval scoring)
      const { data: events } = await supabase
        .from("chat_retrieval_events")
        .select("id, selected_chunk_ids")
        .eq("chat_session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1);

      const event = events?.[0] as any;
      const retrievalEventId: number | undefined = event?.id;
      const chunkIds: number[] = event?.selected_chunk_ids ?? [];
      let chunks: EvalChunk[] = [];

      if (chunkIds.length > 0) {
        const { data: chunkData } = await supabase
          .from("document_chunks")
          .select("id, content, chunk_index, document_id")
          .in("id", chunkIds);
        chunks = (chunkData ?? []) as EvalChunk[];
        chunks.sort((a, b) => chunkIds.indexOf(a.id) - chunkIds.indexOf(b.id));
      }

      runCounter.current += 1;
      const runId = runCounter.current;

      setRuns((prev) => [
        {
          id: runId,
          query: currentQuery,
          mode,
          answer,
          chunks,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startMs,
          retrievalEventId,
          scoringState: retrievalEventId ? "pending" : undefined,
        },
        ...prev,
      ]);
      setExpandedRuns((prev) => new Set([...prev, runId]));

      // Trigger eval scoring asynchronously (non-blocking)
      if (retrievalEventId && token) {
        triggerEvalScoring(retrievalEventId, token)
          .then((result) => {
            setRuns((prev) =>
              prev.map((r) =>
                r.id === runId
                  ? {
                      ...r,
                      scoringState: "done",
                      scores: {
                        faithfulness: result.faithfulness_score,
                        relevance: result.relevance_score,
                        groundedness: result.groundedness_score,
                        faithfulness_reason: result.faithfulness_reason,
                        relevance_reason: result.relevance_reason,
                        groundedness_reason: result.groundedness_reason,
                      },
                    }
                  : r
              )
            );
          })
          .catch((e) => {
            console.warn("Eval scoring failed (non-critical):", e);
            setRuns((prev) =>
              prev.map((r) => (r.id === runId ? { ...r, scoringState: "error" } : r))
            );
          });
      }
    } catch (e: any) {
      toast.error(e.message || "Evaluation failed");
    } finally {
      setRunning(false);
    }
  };

  const toggleRun = (id: number) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!selectedProject) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No project selected"
        description="Select a project to run RAG evaluations."
      />
    );
  }

  // Metrics computations
  const avgScore = (key: keyof Pick<EvalResultRow, "faithfulness_score" | "relevance_score" | "groundedness_score">) => {
    const vals = evalResults.map((r) => r[key]).filter((v) => v !== null) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const timelineData = evalResults
    .slice()
    .reverse()
    .map((r) => ({
      date: new Date(r.created_at).toLocaleDateString(),
      Faithfulness: r.faithfulness_score,
      Relevance: r.relevance_score,
      Groundedness: r.groundedness_score,
    }));

  const modeGroups = evalResults.reduce<Record<string, number[][]>>((acc, r) => {
    const m = r.retrieval_mode ?? "unknown";
    if (!acc[m]) acc[m] = [[], [], []];
    if (r.faithfulness_score !== null) acc[m][0].push(r.faithfulness_score);
    if (r.relevance_score !== null) acc[m][1].push(r.relevance_score);
    if (r.groundedness_score !== null) acc[m][2].push(r.groundedness_score);
    return acc;
  }, {});
  const byModeData = Object.entries(modeGroups).map(([mode, [f, rel, g]]) => ({
    mode,
    Faithfulness: f.length ? +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(3) : null,
    Relevance: rel.length ? +(rel.reduce((a, b) => a + b, 0) / rel.length).toFixed(3) : null,
    Groundedness: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(3) : null,
  }));

  const avgF = avgScore("faithfulness_score");
  const avgRel = avgScore("relevance_score");
  const avgG = avgScore("groundedness_score");
  const radarData = [
    { subject: "Faithfulness", score: avgF ?? 0 },
    { subject: "Relevance", score: avgRel ?? 0 },
    { subject: "Groundedness", score: avgG ?? 0 },
  ];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">RAG Evaluation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run test queries and measure retrieval quality metrics.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="metrics" className="gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Metrics
          </TabsTrigger>
        </TabsList>

        {/* ── Run Tab ── */}
        <TabsContent value="run" className="space-y-4 mt-4">
          {/* Query Input */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <Textarea
                placeholder="Enter a test query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) handleRun();
                }}
              />
              <div className="flex items-center gap-3">
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETRIEVAL_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRun}
                  disabled={running || !query.trim()}
                  className="gap-2 active:scale-95"
                >
                  <Play className="h-4 w-4" />
                  {running ? "Running..." : "Run"}
                </Button>
                {runs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-2 text-muted-foreground active:scale-95"
                    onClick={() => { setRuns([]); setExpandedRuns(new Set()); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Tip: Cmd/Ctrl+Enter to run</p>
            </CardContent>
          </Card>

          {runs.length === 0 && !running && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Run a query to see results
            </div>
          )}

          <div className="space-y-4">
            {runs.map((run) => (
              <AnimateIn key={run.id} animation="fade-in">
                <Card>
                  <CardHeader
                    className="cursor-pointer select-none pb-3"
                    onClick={() => toggleRun(run.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {expandedRuns.has(run.id)
                          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        }
                        <p className="text-sm font-medium truncate">{run.query}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <Badge variant="secondary" className="text-xs">{run.mode}</Badge>
                        <Badge variant="outline" className="text-xs">{run.chunks.length} chunks</Badge>
                        <span className="text-xs text-muted-foreground">{(run.durationMs / 1000).toFixed(1)}s</span>
                        {/* Eval score badges */}
                        {run.scoringState === "pending" && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Scoring…</Badge>
                        )}
                        {run.scoringState === "done" && run.scores && (
                          <>
                            <ScoreBadge label="F" score={run.scores.faithfulness} />
                            <ScoreBadge label="R" score={run.scores.relevance} />
                            <ScoreBadge label="G" score={run.scores.groundedness} />
                          </>
                        )}
                        {run.scoringState === "error" && (
                          <Badge variant="destructive" className="text-xs">Score failed</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {expandedRuns.has(run.id) && (
                    <CardContent className="pt-0 space-y-3">
                      {/* Score reasons */}
                      {run.scoringState === "done" && run.scores && (
                        <div className="rounded-md bg-muted/40 p-3 space-y-1 text-xs text-muted-foreground">
                          {run.scores.faithfulness_reason && <p><span className="font-medium text-foreground">Faithfulness:</span> {run.scores.faithfulness_reason}</p>}
                          {run.scores.relevance_reason && <p><span className="font-medium text-foreground">Relevance:</span> {run.scores.relevance_reason}</p>}
                          {run.scores.groundedness_reason && <p><span className="font-medium text-foreground">Groundedness:</span> {run.scores.groundedness_reason}</p>}
                        </div>
                      )}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Retrieved Chunks */}
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                            Retrieved Chunks ({run.chunks.length})
                          </p>
                          {run.chunks.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No chunks retrieved</p>
                          ) : (
                            <ScrollArea className="h-72">
                              <div className="space-y-2 pr-2">
                                {run.chunks.map((chunk, i) => (
                                  <div
                                    key={chunk.id}
                                    className="rounded-md border bg-muted/30 p-3 text-xs space-y-1"
                                  >
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span className="font-medium text-foreground">#{i + 1}</span>
                                      <span>doc {chunk.document_id}</span>
                                      <span>·</span>
                                      <span>chunk {chunk.chunk_index}</span>
                                    </div>
                                    <p className="line-clamp-4 text-foreground/80 leading-relaxed">
                                      {chunk.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>

                        {/* Generated Answer */}
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                            Generated Answer
                          </p>
                          <ScrollArea className="h-72">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-2">
                              {run.answer || <span className="text-muted-foreground italic">No answer generated</span>}
                            </p>
                          </ScrollArea>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </AnimateIn>
            ))}
          </div>
        </TabsContent>

        {/* ── Metrics Tab ── */}
        <TabsContent value="metrics" className="space-y-6 mt-4">
          {metricsLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading metrics…</div>
          ) : evalResults.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No evaluation data yet"
              description="Run queries in the Run tab to generate evaluation scores."
            />
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Avg Faithfulness", value: avgF },
                  { label: "Avg Relevance", value: avgRel },
                  { label: "Avg Groundedness", value: avgG },
                  { label: "Total Evals", value: evalResults.length, raw: true },
                ].map(({ label, value, raw }) => (
                  <Card key={label} className="bg-muted/30 border-0 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {raw ? value : value !== null ? (value as number).toFixed(2) : "—"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Scores over time */}
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Scores Over Time</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={timelineData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Faithfulness" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="Relevance" stroke="hsl(var(--chart-2, 200 80% 50%))" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="Groundedness" stroke="hsl(var(--chart-3, 140 60% 45%))" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scores by retrieval mode */}
                {byModeData.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Avg Score by Mode</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={byModeData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="mode" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Faithfulness" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Relevance" fill="hsl(var(--chart-2, 200 80% 50%))" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Groundedness" fill="hsl(var(--chart-3, 140 60% 45%))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Quality radar */}
                <Card>
                  <CardHeader><CardTitle className="text-sm font-medium">Quality Triangle</CardTitle></CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <RadarChart width={220} height={200} data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
                      <Radar name="Avg" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                    </RadarChart>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
