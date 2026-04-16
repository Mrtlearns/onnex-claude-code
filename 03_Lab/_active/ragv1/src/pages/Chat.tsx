import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, Plus, Trash2, ChevronLeft, Sparkles } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { getChatSessions, createChatSession, deleteChatSession, getChatMessages } from "@/lib/db/chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/EmptyState";
import { AnimateIn } from "@/components/AnimateIn";
import { toast } from "sonner";

const RETRIEVAL_MODES = [
  { value: "mix", label: "Mix", desc: "Vector + Graph" },
  { value: "hybrid", label: "Hybrid", desc: "BM25 + Vector + RRF" },
  { value: "relation_only", label: "Relation Only", desc: "Graph-based retrieval" },
  { value: "global", label: "Global", desc: "Broad vector search" },
  { value: "human_in_the_loop", label: "Human in Loop", desc: "Manual chunk selection" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ragv1-chat`;

type Msg = { id?: number; role: string; content: string; created_at?: string };

export default function Chat() {
  const { selectedProject } = useProject();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("mix");
  const [sending, setSending] = useState(false);
  const [showSessions, setShowSessions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedProject) return;
    getChatSessions(selectedProject.id).then((s) => {
      setSessions(s);
      if (s.length > 0 && !activeSession) setActiveSession(s[0].id);
    }).catch(() => {});
  }, [selectedProject]);

  useEffect(() => {
    if (!activeSession) return;
    getChatMessages(activeSession).then(setMessages).catch(() => setMessages([]));
  }, [activeSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleNewSession = async () => {
    if (!selectedProject) return;
    try {
      const s = await createChatSession(selectedProject.id);
      setSessions((prev) => [s, ...prev]);
      setActiveSession(s.id);
      setMessages([]);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteSession = async (id: number) => {
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession === id) { setActiveSession(null); setMessages([]); }
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession) return;
    const userMessage = input.trim();
    setSending(true);
    setInput("");
    const userMsg: Msg = { role: "user", content: userMessage, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ session_id: activeSession, message: userMessage, retrieval_mode: mode }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limited — please try again in a moment.");
        else if (resp.status === 402) toast.error("Credits exhausted — add funds in Settings.");
        else toast.error(err.error || "Chat request failed");
        setSending(false);
        return;
      }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = "";
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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.id) return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                return [...prev, { role: "assistant", content: assistantSoFar, created_at: new Date().toISOString() }];
              });
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
      if (selectedProject) getChatSessions(selectedProject.id).then(setSessions).catch(() => {});
    } catch (e: any) { toast.error(e.message || "Failed to send message"); } finally { setSending(false); }
  };

  if (!selectedProject) {
    return <EmptyState icon={MessageSquare} title="No project selected" description="Select a project to start chatting with your documents." />;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {showSessions && (
        <AnimateIn animation="fade-in" className="w-64 shrink-0 flex flex-col border-r pr-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions</h3>
            <Button size="icon" variant="ghost" className="h-7 w-7 active:scale-95" onClick={handleNewSession}><Plus className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors ${activeSession === s.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                  onClick={() => setActiveSession(s.id)}
                >
                  <span className="truncate flex-1">{s.title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No sessions yet</p>
              )}
            </div>
          </ScrollArea>
        </AnimateIn>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <AnimateIn>
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setShowSessions(!showSessions)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-lg bg-primary/10 p-1.5"><MessageSquare className="h-4 w-4 text-primary" /></div>
            <h2 className="text-lg font-semibold">Chat</h2>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-40 ml-auto h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETRIEVAL_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground ml-1">— {m.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              ${Number(selectedProject.current_spend_usd).toFixed(2)} / ${Number(selectedProject.spending_cap_usd).toFixed(2)}
            </Badge>
          </div>
        </AnimateIn>

        {!activeSession ? (
          <Card className="flex-1 flex items-center justify-center border-dashed">
            <CardContent className="text-center">
              <div className="rounded-2xl bg-muted/60 p-5 w-fit mx-auto mb-4">
                <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-medium mb-1.5">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-[240px] mx-auto">Ask questions about your uploaded documents using RAG retrieval.</p>
              <Button onClick={handleNewSession} variant="outline" size="sm" className="active:scale-[0.97]">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-auto space-y-3 pb-4 px-1">
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.created_at && <p className="text-[10px] opacity-40 mt-1.5">{new Date(msg.created_at).toLocaleTimeString()}</p>}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-16 text-muted-foreground text-sm">Send a message to begin</div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={sending}
                className="rounded-xl"
              />
              <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="rounded-xl shrink-0 active:scale-95">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
