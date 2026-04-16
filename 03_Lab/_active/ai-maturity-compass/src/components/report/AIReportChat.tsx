import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Sparkles, Bot, User } from "lucide-react";
import { getModel, withFallback, AI_MODELS } from "@/lib/claude";
import type { ReportData } from "@/types";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  report: ReportData;
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <span>
      {content.split("\n").map((line, i, arr) => (
        <span key={i}>
          {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
      {streaming && <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse ml-0.5" />}
    </span>
  );
}

const quickQuestions = [
  "What's our weakest area?",
  "What should we improve?",
  "How do we compare to industry?",
  "Show me the gaps",
];

function buildSystemPrompt(report: ReportData): string {
  return `You are an expert AI strategy consultant and report analyst. You are answering questions about a specific AI maturity assessment report. Be concise (under 200 words unless a detailed breakdown is requested), direct, and actionable. Use **bold** for key terms.

Report data:
- Organization: ${report.orgName} (${report.industry})
- Assessment: ${report.versionLabel} | Respondents: ${report.respondentCount}
- Overall: ${report.overallScore.toFixed(1)}/5.0 | Stage: ${report.maturityStage}
- Scores: ${report.dimensionScores.map((d) => `${d.dimension} ${d.weighted.toFixed(1)}`).join(", ")}
- Top gaps: ${[...report.gapAnalysis].sort((a, b) => b.gap - a.gap).slice(0, 3).map((g) => `${g.dimension} (gap ${g.gap.toFixed(1)}, ${g.priority})`).join(", ")}`;
}

export default function AIReportChat({ report }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setInput("");
    setTyping(true);

    try {
      const systemPrompt = buildSystemPrompt(report);
      const history = messages
        .filter((m) => !m.streaming && m.content)
        .map((m) => ({
          role: m.role === "user" ? "user" as const : "model" as const,
          parts: [{ text: m.content }],
        }));

      const accumulated = await withFallback(async (modelId) => {
        const model = getModel(modelId, systemPrompt);
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(text.trim());
        let out = "";
        for await (const chunk of result.stream) {
          out += chunk.text();
          const snapshot = out;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: snapshot, streaming: true } : m)
          );
        }
        return out;
      });

      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m)
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errMsg}. Check your GEMINI_KEY.`, streaming: false }
            : m
        )
      );
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          open
            ? "bg-muted text-muted-foreground rotate-0"
            : "gradient-teal text-accent-foreground hover:scale-105"
        )}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-h-[560px] bg-card rounded-2xl shadow-2xl border border-border/50 flex flex-col animate-scale-in overflow-hidden">
          <div className="gradient-navy px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-display font-bold text-primary-foreground text-sm">AI Report Assistant</h4>
              <p className="text-primary-foreground/50 text-xs">Ask anything about this assessment</p>
            </div>
            <Badge className="bg-accent/20 text-accent border-accent/30 text-[9px]">AI</Badge>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Ask me about {report.orgName}'s AI maturity assessment
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-muted-foreground hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary/70 text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <AssistantMessage content={msg.content} streaming={msg.streaming} />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about the report..."
              className="text-sm"
              disabled={typing}
            />
            <Button size="icon" onClick={() => send(input)} disabled={!input.trim() || typing} className="flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
