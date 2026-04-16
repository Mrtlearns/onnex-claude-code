import { BookOpen, Copy } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimateIn } from "@/components/AnimateIn";
import { toast } from "sonner";

const copyCode = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };

export default function ApiDocs() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id ?? "<PROJECT_ID>";

  const curlChat = `curl -X POST \\
  'https://cnpwjnmopjotgvthgenx.supabase.co/functions/v1/chat' \\
  -H 'Authorization: Bearer <YOUR_ANON_KEY>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "project_id": ${projectId},
    "session_id": 1,
    "message": "What is RAG?",
    "retrieval_mode": "mix"
  }'`;

  const curlUpload = `curl -X POST \\
  'https://cnpwjnmopjotgvthgenx.supabase.co/functions/v1/upload' \\
  -H 'Authorization: Bearer <YOUR_ANON_KEY>' \\
  -F 'file=@document.pdf' \\
  -F 'project_id=${projectId}'`;

  const jsExample = `import { supabase } from './supabase-client';

// Upload a document
const { data, error } = await supabase.storage
  .from('documents')
  .upload(\`\${projectId}/my-doc.pdf\`, file);

// Create document record
await supabase.from('documents').insert({
  project_id: ${projectId},
  name: 'my-doc.pdf',
  mime_type: 'application/pdf',
  source_path: data.path,
});

// Query chat
const { data: response } = await supabase.functions.invoke('chat', {
  body: { project_id: ${projectId}, session_id: 1, message: 'Summarize the document', retrieval_mode: 'global' },
});`;

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><BookOpen className="h-5 w-5 text-primary" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">API Documentation</h1>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The RAG Platform exposes its functionality via Supabase Edge Functions and direct database access through the Supabase client SDK.</p>
            <div className="flex gap-2"><Badge>REST API</Badge><Badge variant="outline">Supabase SDK</Badge><Badge variant="outline">Edge Functions</Badge></div>
          </CardContent>
        </Card>
      </AnimateIn>

      <AnimateIn delay={160}>
        <Tabs defaultValue="curl">
          <TabsList><TabsTrigger value="curl">cURL</TabsTrigger><TabsTrigger value="javascript">JavaScript</TabsTrigger></TabsList>
          <TabsContent value="curl" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Chat Endpoint</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 active:scale-95" onClick={() => copyCode(curlChat)}><Copy className="h-3.5 w-3.5" /></Button>
              </CardHeader>
              <CardContent><pre className="bg-muted p-4 rounded-md text-xs overflow-auto font-mono">{curlChat}</pre></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Upload Endpoint</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 active:scale-95" onClick={() => copyCode(curlUpload)}><Copy className="h-3.5 w-3.5" /></Button>
              </CardHeader>
              <CardContent><pre className="bg-muted p-4 rounded-md text-xs overflow-auto font-mono">{curlUpload}</pre></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="javascript" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">JavaScript / TypeScript</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 active:scale-95" onClick={() => copyCode(jsExample)}><Copy className="h-3.5 w-3.5" /></Button>
              </CardHeader>
              <CardContent><pre className="bg-muted p-4 rounded-md text-xs overflow-auto font-mono">{jsExample}</pre></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </AnimateIn>

      <AnimateIn delay={240}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Retrieval Modes</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { mode: "mix", desc: "Combines vector similarity search with entity-graph retrieval for comprehensive results." },
                { mode: "relation_only", desc: "Uses only entities and relations to resolve context via knowledge graph." },
                { mode: "global", desc: "Broad vector search over all chunks, ignoring graph signals." },
                { mode: "human_in_the_loop", desc: "Returns candidate chunks for manual selection before generating answer." },
              ].map((m) => (
                <div key={m.mode} className="p-3.5 border rounded-lg hover:bg-muted/30 transition-colors">
                  <Badge className="mb-1.5">{m.mode}</Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AnimateIn>
    </div>
  );
}
