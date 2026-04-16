import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { updateProject, getProject } from "@/lib/db/projects";
import { getRagSettings, updateRagSettings, getApiKeys, upsertApiKey, deleteApiKey } from "@/lib/db/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const PROCESSING_PRESETS = {
  budget: { chunking_strategy: "standard", enable_deep_extract: false, enable_chunk_context: false, enable_entity_extraction: false },
  standard: { chunking_strategy: "semantic", enable_deep_extract: true, enable_chunk_context: false, enable_entity_extraction: false },
  full: { chunking_strategy: "page_based", enable_deep_extract: true, enable_chunk_context: true, enable_entity_extraction: true },
  custom: null,
} as const;
type PresetKey = keyof typeof PROCESSING_PRESETS;

const CHUNKING_STRATEGIES = [
  { value: "standard", label: "Standard", desc: "Fixed-size chunks by token count" },
  { value: "contextual", label: "Contextual", desc: "Context-aware splitting with overlap" },
  { value: "semantic", label: "Semantic", desc: "Splits at semantic boundaries" },
  { value: "pro_contextual", label: "Pro Contextual", desc: "Advanced contextual with LLM enrichment" },
  { value: "ai_smart", label: "AI Smart", desc: "AI-guided chunking with custom description" },
  { value: "page_based", label: "Page Based", desc: "Chunk by page boundaries" },
];
const COST_MODES = [
  { value: "basic", label: "Basic", desc: "~$0.001/doc — fast, minimal enrichment" },
  { value: "balanced", label: "Balanced", desc: "~$0.01/doc — good quality, moderate cost" },
  { value: "premium", label: "Premium", desc: "~$0.05/doc — best quality, full enrichment" },
];
const PROVIDERS = ["openai", "anthropic", "google", "local", "other"];

export default function Settings() {
  const { selectedProject, refreshProjects } = useProject();
  const [tab, setTab] = useState("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [memoryWindow, setMemoryWindow] = useState(5);
  const [spendingCap, setSpendingCap] = useState(10);
  const [ragSettings, setRagSettingsState] = useState<any>(null);
  const [apiKeys, setApiKeysState] = useState<any[]>([]);
  const [keyDialog, setKeyDialog] = useState(false);
  const [newProvider, setNewProvider] = useState("openai");
  const [newKey, setNewKey] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newDefault, setNewDefault] = useState(false);
  const [processingPreset, setProcessingPreset] = useState<PresetKey>("custom");

  useEffect(() => {
    if (!selectedProject) return;
    setName(selectedProject.name);
    setDescription(selectedProject.description ?? "");
    setSpendingCap(Number(selectedProject.spending_cap_usd));
    const pid = selectedProject.id;
    getProject(pid).then((p) => { setSystemPrompt(p.default_system_prompt); setMemoryWindow(p.conversation_memory_window); });
    getRagSettings(pid).then(setRagSettingsState).catch(() => {});
    getApiKeys(pid).then(setApiKeysState).catch(() => setApiKeysState([]));
  }, [selectedProject]);

  const saveGeneral = async () => {
    if (!selectedProject) return;
    try {
      await updateProject(selectedProject.id, { name, description: description || null, default_system_prompt: systemPrompt, conversation_memory_window: memoryWindow, spending_cap_usd: spendingCap });
      await refreshProjects();
      toast.success("Settings saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const saveRag = async () => {
    if (!selectedProject || !ragSettings) return;
    try {
      const updated = await updateRagSettings(selectedProject.id, {
        chunking_strategy: ragSettings.chunking_strategy, chunk_token_size: ragSettings.chunk_token_size,
        pages_per_chunk: ragSettings.pages_per_chunk, ai_smart_description: ragSettings.ai_smart_description,
        enable_entity_extraction: ragSettings.enable_entity_extraction, enable_relation_extraction: ragSettings.enable_relation_extraction,
        enable_ai_vision: ragSettings.enable_ai_vision, cost_mode: ragSettings.cost_mode,
        human_in_the_loop_enabled: ragSettings.human_in_the_loop_enabled, agentic_enabled: ragSettings.agentic_enabled,
        agentic_max_rounds: ragSettings.agentic_max_rounds,
        enable_deep_extract: ragSettings.enable_deep_extract, enable_chunk_context: ragSettings.enable_chunk_context,
        custom_metadata_schema: ragSettings.custom_metadata_schema ?? null,
        enable_reranking: (ragSettings as any).enable_reranking ?? false,
        reranking_top_k: (ragSettings as any).reranking_top_k ?? 5,
      });
      setRagSettingsState(updated);
      toast.success("RAG settings saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const addApiKey = async () => {
    if (!selectedProject || !newKey || !newModel) return;
    try {
      await upsertApiKey(selectedProject.id, newProvider, newKey, newModel, newDefault);
      setApiKeysState(await getApiKeys(selectedProject.id));
      setKeyDialog(false); setNewKey(""); setNewModel("");
      toast.success("API key added");
    } catch (e: any) { toast.error(e.message); }
  };

  const removeApiKey = async (id: number) => {
    try {
      await deleteApiKey(id);
      setApiKeysState(await getApiKeys(selectedProject!.id));
      toast.success("API key removed");
    } catch (e: any) { toast.error(e.message); }
  };

  const updateRag = (key: string, val: any) => setRagSettingsState((prev: any) => ({ ...prev, [key]: val }));

  if (!selectedProject) {
    return <EmptyState icon={SettingsIcon} title="No project selected" description="Select a project to configure its settings." />;
  }

  const spend = Number(selectedProject.current_spend_usd);
  const pct = spendingCap > 0 ? Math.min(100, (spend / spendingCap) * 100) : 0;

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><SettingsIcon className="h-5 w-5 text-primary" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="rag">RAG</TabsTrigger><TabsTrigger value="budget">Budget</TabsTrigger><TabsTrigger value="models">Models</TabsTrigger></TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Project Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Project Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                <Separator />
                <div className="space-y-2"><Label>Default System Prompt</Label><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} className="font-mono text-xs" /></div>
                <div className="space-y-2"><Label>Conversation Memory Window</Label><Input type="number" value={memoryWindow} onChange={(e) => setMemoryWindow(parseInt(e.target.value) || 5)} className="w-32" /></div>
                <Button onClick={saveGeneral} size="sm" className="active:scale-[0.97]"><Save className="h-4 w-4 mr-2" /> Save</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rag" className="space-y-4 mt-4">
            {ragSettings && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">RAG Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Processing Mode</Label>
                    <Select value={processingPreset} onValueChange={(v) => {
                      const key = v as PresetKey;
                      setProcessingPreset(key);
                      const preset = PROCESSING_PRESETS[key];
                      if (preset) setRagSettingsState((prev: any) => ({ ...prev, ...preset }));
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget"><span className="font-medium">Budget</span> <span className="text-xs text-muted-foreground ml-1">Fast, minimal enrichment</span></SelectItem>
                        <SelectItem value="standard"><span className="font-medium">Standard</span> <span className="text-xs text-muted-foreground ml-1">Good quality, moderate cost</span></SelectItem>
                        <SelectItem value="full"><span className="font-medium">Full</span> <span className="text-xs text-muted-foreground ml-1">Best quality, all enrichment</span></SelectItem>
                        <SelectItem value="custom"><span className="font-medium">Custom</span> <span className="text-xs text-muted-foreground ml-1">Configure manually below</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-2"><Label>Chunking Strategy</Label>
                    <Select value={ragSettings.chunking_strategy} onValueChange={(v) => updateRag("chunking_strategy", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHUNKING_STRATEGIES.map((s) => <SelectItem key={s.value} value={s.value}><span className="font-medium">{s.label}</span> <span className="text-xs text-muted-foreground ml-1">{s.desc}</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {ragSettings.chunking_strategy === "ai_smart" && <div className="space-y-2"><Label>AI Smart Description</Label><Textarea value={ragSettings.ai_smart_description ?? ""} onChange={(e) => updateRag("ai_smart_description", e.target.value)} rows={2} /></div>}
                  {ragSettings.chunking_strategy === "page_based" && <div className="space-y-2"><Label>Pages per Chunk</Label><Input type="number" value={ragSettings.pages_per_chunk ?? 1} onChange={(e) => updateRag("pages_per_chunk", parseInt(e.target.value) || 1)} className="w-32" /></div>}
                  {ragSettings.chunking_strategy !== "page_based" && <div className="space-y-2"><Label>Chunk Token Size</Label><Input type="number" value={ragSettings.chunk_token_size ?? 512} onChange={(e) => updateRag("chunk_token_size", parseInt(e.target.value) || 512)} className="w-32" /></div>}
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { key: "enable_entity_extraction", label: "Entity Extraction" },
                      { key: "enable_relation_extraction", label: "Relation Extraction" },
                      { key: "enable_ai_vision", label: "AI Vision" },
                      { key: "human_in_the_loop_enabled", label: "Human in the Loop" },
                      { key: "enable_deep_extract", label: "Deep Extract (Docling)" },
                      { key: "enable_chunk_context", label: "AI Context per Chunk" },
                      { key: "enable_reranking", label: "Re-ranking (LLM Relevance Scoring)" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                        <Label className="text-sm">{label}</Label>
                        <Switch checked={ragSettings[key]} onCheckedChange={(c) => updateRag(key, c)} />
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-2"><Label>Cost Mode</Label>
                    <Select value={ragSettings.cost_mode} onValueChange={(v) => updateRag("cost_mode", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{COST_MODES.map((m) => <SelectItem key={m.value} value={m.value}><span className="font-medium">{m.label}</span> <span className="text-xs text-muted-foreground ml-1">{m.desc}</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label>Agentic Mode</Label>
                    <Switch checked={ragSettings.agentic_enabled} onCheckedChange={(c) => updateRag("agentic_enabled", c)} />
                  </div>
                  {ragSettings.agentic_enabled && <div className="space-y-2"><Label>Max Agentic Rounds</Label><Input type="number" value={ragSettings.agentic_max_rounds} onChange={(e) => updateRag("agentic_max_rounds", parseInt(e.target.value) || 3)} className="w-32" /></div>}
                  {ragSettings.enable_reranking && <div className="space-y-2"><Label>Re-ranking Top-K</Label><Input type="number" value={(ragSettings as any).reranking_top_k ?? 5} onChange={(e) => updateRag("reranking_top_k" as any, parseInt(e.target.value) || 5)} className="w-32" min={1} max={20} /></div>}
                  <Separator />
                  <div className="space-y-2">
                    <Label>Custom Metadata Schema (JSON)</Label>
                    <p className="text-xs text-muted-foreground">{"Define fields to extract from each chunk. Example: {\"date\": \"string\", \"parties\": \"array\"}"}</p>
                    <Textarea
                      value={ragSettings.custom_metadata_schema ? JSON.stringify(ragSettings.custom_metadata_schema, null, 2) : ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === "") {
                          updateRag("custom_metadata_schema", null);
                        } else {
                          try {
                            const parsed = JSON.parse(val);
                            updateRag("custom_metadata_schema", parsed);
                          } catch {
                            toast.error("Invalid JSON in Custom Metadata Schema");
                          }
                        }
                      }}
                      rows={4}
                      className="font-mono text-xs"
                      placeholder='{"date": "string", "parties": "array"}'
                    />
                  </div>
                  <Button onClick={saveRag} size="sm" className="active:scale-[0.97]"><Save className="h-4 w-4 mr-2" /> Save RAG Settings</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="budget" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Budget & Cost Control</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2"><Label>Spending Cap (USD)</Label><Input type="number" step="0.01" value={spendingCap} onChange={(e) => setSpendingCap(parseFloat(e.target.value) || 0)} className="w-40" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-muted/30 border-0 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Current Spend</p><p className="text-2xl font-bold tabular-nums">${spend.toFixed(4)}</p></CardContent></Card>
                  <Card className="bg-muted/30 border-0 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Remaining Budget</p><p className="text-2xl font-bold tabular-nums">${Math.max(0, spendingCap - spend).toFixed(4)}</p></CardContent></Card>
                </div>
                <div>
                  <Progress value={pct} className="h-2.5" />
                  <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">{pct.toFixed(1)}% used</p>
                </div>
                <Button onClick={saveGeneral} size="sm" className="active:scale-[0.97]"><Save className="h-4 w-4 mr-2" /> Save</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-4 mt-4">
            <Card>
              <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">API Keys & Models</CardTitle><Button size="sm" onClick={() => setKeyDialog(true)}>Add Key</Button></div><CardDescription>Configure LLM providers for this project</CardDescription></CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No API keys configured</p> : (
                  <Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Default</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>{apiKeys.map((k) => (
                      <TableRow key={k.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell><Badge variant="outline">{k.provider}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{k.model_name}</TableCell>
                        <TableCell>{k.is_default && <Badge className="text-[10px]">Default</Badge>}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeApiKey(k.id)}>Remove</Button></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Dialog open={keyDialog} onOpenChange={setKeyDialog}>
              <DialogContent><DialogHeader><DialogTitle>Add API Key</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Provider</Label><Select value={newProvider} onValueChange={setNewProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>API Key</Label><Input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sk-..." /></div>
                  <div className="space-y-2"><Label>Model Name</Label><Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="gpt-4o" /></div>
                  <div className="flex items-center gap-2"><Switch checked={newDefault} onCheckedChange={setNewDefault} /><Label>Set as default</Label></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setKeyDialog(false)}>Cancel</Button><Button onClick={addApiKey} disabled={!newKey || !newModel}>Add</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}
