import { useEffect, useState, useCallback } from "react";
import { FileText, Upload, Trash2, RotateCcw, Search, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { getDocuments, createDocument, deleteDocument, uploadDocumentFile, getDocumentChunks, updateDocument } from "@/lib/db/documents";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const statusColor = (s: string) =>
  s === "processed" ? "default" : s === "error" ? "destructive" : s === "processing" ? "outline" : "secondary";

export default function Documents() {
  const { selectedProject } = useProject();
  const [docs, setDocs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [dragging, setDragging] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const data = await getDocuments(selectedProject.id);
      setDocs(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (files: FileList | File[]) => {
    if (!selectedProject) return;
    for (const file of Array.from(files)) {
      try {
        const path = await uploadDocumentFile(selectedProject.id, file);
        const doc = await createDocument(selectedProject.id, file.name, file.type || "application/octet-stream", path);
        toast.success(`Uploaded ${file.name}`);
        supabase.functions.invoke("ragv1-process-document", {
          body: { document_id: doc.id },
        }).then(({ error }) => {
          if (error) toast.error(`Processing failed for ${file.name}: ${error.message}`);
          else toast.success(`Processed ${file.name}`);
          fetchDocs();
        });
      } catch (e: any) {
        toast.error(`Failed to upload ${file.name}: ${e.message}`);
      }
    }
    fetchDocs();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteDocument(id);
      toast.success("Document deleted");
      fetchDocs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleExpand = async (docId: number) => {
    if (expandedDoc === docId) { setExpandedDoc(null); return; }
    setExpandedDoc(docId);
    try { setChunks(await getDocumentChunks(docId)); } catch { setChunks([]); }
  };

  const openEditDialog = (doc: any) => {
    setEditDoc(doc);
    setEditName(doc.name);
    setEditMeta(JSON.stringify(doc.global_metadata ?? {}, null, 2));
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    try {
      let meta = {};
      try { meta = JSON.parse(editMeta); } catch { toast.error("Invalid JSON metadata"); return; }
      await updateDocument(editDoc.id, { name: editName, global_metadata: meta });
      toast.success("Document updated");
      setEditDoc(null);
      fetchDocs();
    } catch (e: any) { toast.error(e.message); }
  };

  const retryFailed = async (doc: any) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ragv1-process-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ document_id: doc.id, retry_failed_only: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Retry started for ${doc.name}`);
      fetchDocs();
    } catch (e: any) {
      toast.error(`Retry failed: ${e.message}`);
    }
  };

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  if (!selectedProject) {
    return <EmptyState icon={FileText} title="No project selected" description="Select a project from the sidebar to manage documents." />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">Documents</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <label>
            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
            <Button asChild size="sm" className="active:scale-[0.97] transition-transform">
              <span><Upload className="h-4 w-4 mr-2" /> Upload</span>
            </Button>
          </label>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-muted-foreground/30"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="rounded-2xl bg-muted/60 p-4 w-fit mx-auto mb-3">
            <Upload className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Drag & drop files here, or click Upload</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Supports PDF, TXT, DOCX, and more</p>
        </div>
      </AnimateIn>

      <AnimateIn delay={160}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </AnimateIn>

      <AnimateIn delay={240}>
        {loading ? (
          <Card><CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </CardContent></Card>
        ) : filtered.length === 0 && docs.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload your first document to start building your knowledge base."
            />
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No documents match your search</TableCell>
                    </TableRow>
                  ) : filtered.map((doc) => (
                    <>
                      <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => toggleExpand(doc.id)}>
                        <TableCell>
                          {expandedDoc === doc.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell><Badge variant={statusColor(doc.status) as any} className="text-[10px]">{doc.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.mime_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 active:scale-95" onClick={() => openEditDialog(doc)} title="Edit"><FileText className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 active:scale-95" title="Reprocess" onClick={() => {
                              supabase.functions.invoke("ragv1-process-document", { body: { document_id: doc.id } }).then(({ error }) => {
                                if (error) toast.error(`Reprocessing failed: ${error.message}`);
                                else { toast.success("Reprocessing started"); fetchDocs(); }
                              });
                            }}><RotateCcw className="h-3.5 w-3.5" /></Button>
                            {doc.status === "error" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 active:scale-95" title="Retry Failed Chunks" onClick={() => retryFailed(doc)}><AlertCircle className="h-3.5 w-3.5" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive active:scale-95" onClick={() => handleDelete(doc.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedDoc === doc.id && (
                        <TableRow key={`${doc.id}-chunks`}>
                          <TableCell colSpan={6} className="bg-muted/30 px-8 py-4">
                            <h4 className="text-sm font-medium mb-2">Chunks ({chunks.length})</h4>
                            {chunks.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No chunks processed yet</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-auto">
                                {chunks.map((c) => (
                                  <div key={c.id} className="flex items-start gap-3 p-2 rounded-md border bg-background text-xs">
                                    <span className="font-mono text-muted-foreground shrink-0">#{c.chunk_index}</span>
                                    {c.page_number != null && <Badge variant="outline" className="text-[9px] shrink-0">p.{c.page_number}</Badge>}
                                    <span className="line-clamp-2 flex-1">{c.content}</span>
                                    <Badge variant={c.status === "processed" ? "default" : "destructive"} className="text-[9px] shrink-0">{c.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </AnimateIn>

      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Global Metadata (JSON)</Label><Textarea value={editMeta} onChange={(e) => setEditMeta(e.target.value)} rows={5} className="font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
