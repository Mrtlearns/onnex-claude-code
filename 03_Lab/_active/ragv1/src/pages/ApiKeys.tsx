import { useEffect, useState } from "react";
import { Key, Plus, Trash2 } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getApiKeys, upsertApiKey, deleteApiKey } from "@/lib/db/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const PROVIDERS = ["openai", "anthropic", "google", "local", "other"];

export default function ApiKeys() {
  const { selectedProject } = useProject();
  const [keys, setKeys] = useState<any[]>([]);
  const [dialog, setDialog] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const refresh = () => { if (selectedProject) getApiKeys(selectedProject.id).then(setKeys).catch(() => setKeys([])); };
  useEffect(refresh, [selectedProject]);

  const handleAdd = async () => {
    if (!selectedProject || !apiKey || !model) return;
    try {
      await upsertApiKey(selectedProject.id, provider, apiKey, model, isDefault);
      toast.success("API key added"); setDialog(false); setApiKey(""); setModel(""); refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteApiKey(id); toast.success("Removed"); refresh(); } catch (e: any) { toast.error(e.message); }
  };

  if (!selectedProject) {
    return <EmptyState icon={Key} title="No project selected" description="Select a project to manage API keys." />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Key className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">API Keys</h1>
              <p className="text-sm text-muted-foreground">{keys.length} key{keys.length !== 1 ? "s" : ""} configured</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setDialog(true)} className="active:scale-[0.97] transition-transform"><Plus className="h-4 w-4 mr-2" /> Add Key</Button>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Configured Providers</CardTitle><CardDescription>API keys for LLM providers used in this project</CardDescription></CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <EmptyState
                icon={Key}
                title="No API keys configured"
                description="Add an API key for an LLM provider to enable chat and document processing."
                action={{ label: "Add your first key", onClick: () => setDialog(true), icon: Plus }}
                className="py-10"
              />
            ) : (
              <Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Key</TableHead><TableHead>Default</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{keys.map((k) => (
                  <TableRow key={k.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell><Badge variant="outline">{k.provider}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{k.model_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">••••{k.api_key.slice(-4)}</TableCell>
                    <TableCell>{k.is_default && <Badge className="text-[10px]">Default</Badge>}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive active:scale-95" onClick={() => handleDelete(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </AnimateIn>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent><DialogHeader><DialogTitle>Add API Key</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Provider</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>API Key</Label><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." /></div>
            <div className="space-y-2"><Label>Model Name</Label><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" /></div>
            <div className="flex items-center gap-2"><Switch checked={isDefault} onCheckedChange={setIsDefault} /><Label>Set as default</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button><Button onClick={handleAdd} disabled={!apiKey || !model}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
