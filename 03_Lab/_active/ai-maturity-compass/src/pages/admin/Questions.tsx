import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { QUESTIONS as DEFAULT_QUESTIONS, DIMENSIONS } from "@/config/questions";
import type { Question, QuestionOption } from "@/types";
import { generateAIQuestion, improveQuestion } from "@/lib/ai-mock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Pencil, Eye, ArrowUp, ArrowDown, Plus, Trash2, Save, X, ArrowLeft, ArrowRight, Sparkles, Wand2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Questions = () => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>(() => JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Question | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCurrent, setPreviewCurrent] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, number>>({});
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenDimension, setAiGenDimension] = useState<string>(DIMENSIONS[0]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<Question | null>(null);
  const [aiImproving, setAiImproving] = useState<number | null>(null);

  // --- Editor handlers ---
  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditDraft(JSON.parse(JSON.stringify(q)));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editDraft) return;
    setQuestions((prev) => prev.map((q) => (q.id === editDraft.id ? editDraft : q)));
    setEditingId(null);
    setEditDraft(null);
    toast({ title: "Question updated" });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const arr = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    arr.forEach((q, i) => (q.id = i + 1));
    setQuestions(arr);
  };

  const deleteQuestion = (id: number) => {
    setQuestions((prev) => {
      const arr = prev.filter((q) => q.id !== id);
      arr.forEach((q, i) => (q.id = i + 1));
      return arr;
    });
    toast({ title: "Question deleted" });
  };

  const addQuestion = () => {
    const newQ: Question = {
      id: questions.length + 1,
      dimension: DIMENSIONS[0],
      questionText: "New question — click edit to customize",
      options: [
        { score: 1, label: "A", text: "Option A" },
        { score: 2, label: "B", text: "Option B" },
        { score: 3, label: "C", text: "Option C" },
        { score: 4, label: "D", text: "Option D" },
        { score: 5, label: "E", text: "Option E" },
      ],
    };
    setQuestions((prev) => [...prev, newQ]);
    toast({ title: "Question added — click edit to customize" });
  };

  const updateDraftOption = (idx: number, field: keyof QuestionOption, value: string | number) => {
    if (!editDraft) return;
    const opts = [...editDraft.options];
    opts[idx] = { ...opts[idx], [field]: value };
    setEditDraft({ ...editDraft, options: opts });
  };

  // --- AI handlers ---
  const handleAIGenerate = () => {
    setAiGenerating(true);
    setAiPreview(null);
    setTimeout(() => {
      const q = generateAIQuestion(aiGenDimension);
      q.id = questions.length + 1;
      setAiPreview(q);
      setAiGenerating(false);
    }, 1000);
  };

  const acceptAIQuestion = () => {
    if (!aiPreview) return;
    setQuestions((prev) => [...prev, { ...aiPreview, id: prev.length + 1 }]);
    setAiGenOpen(false);
    setAiPreview(null);
    toast({ title: "AI-generated question added!" });
  };

  const handleAIImprove = (q: Question) => {
    setAiImproving(q.id);
    setTimeout(() => {
      const improved = improveQuestion(q);
      setEditDraft(improved);
      setEditingId(q.id);
      setAiImproving(null);
      toast({ title: "AI improved — review the changes", description: "Edit or save the improved question." });
    }, 800);
  };

  // --- Preview handlers ---
  const previewQ = questions[previewCurrent];
  const previewProgress = previewOpen && questions.length > 0 ? ((Object.keys(previewAnswers).length) / questions.length) * 100 : 0;

  return (
    <AdminLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Survey Questions</h1>
            <p className="text-muted-foreground mt-1">Edit, reorder, and preview the AI maturity assessment questions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setPreviewCurrent(0); setPreviewAnswers({}); setPreviewOpen(true); }}>
              <Eye className="w-4 h-4" /> Preview
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setAiGenOpen(true); setAiPreview(null); }}>
              <Sparkles className="w-4 h-4" /> Generate with AI
            </Button>
            <Button className="gap-2" onClick={addQuestion}>
              <Plus className="w-4 h-4" /> Add Question
            </Button>
          </div>
        </div>

        <Tabs defaultValue="editor">
          <TabsList className="mb-6">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="summary">Summary Table</TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card key={q.id} className="shadow-card border-border/50">
                  <CardContent className="p-5">
                    {editingId === q.id && editDraft ? (
                      /* --- Inline edit form --- */
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">#{editDraft.id}</Badge>
                          <Select value={editDraft.dimension} onValueChange={(v) => setEditDraft({ ...editDraft, dimension: v })}>
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          value={editDraft.questionText}
                          onChange={(e) => setEditDraft({ ...editDraft, questionText: e.target.value })}
                          className="font-medium"
                          rows={2}
                        />
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Answer Options</p>
                          {editDraft.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-sm font-bold">{opt.label}</span>
                              <Input className="text-sm flex-1" value={opt.text} onChange={(e) => updateDraftOption(oi, "text", e.target.value)} />
                              <Input type="number" min={1} max={5} className="w-16 text-sm" value={opt.score} onChange={(e) => updateDraftOption(oi, "score", parseInt(e.target.value) || 1)} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                          <Button size="sm" onClick={saveEdit}><Save className="w-4 h-4 mr-1" /> Save</Button>
                        </div>
                      </div>
                    ) : (
                      /* --- Read-only card --- */
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-display font-bold text-muted-foreground">{q.id}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}>
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{q.dimension}</Badge>
                          </div>
                          <p className="font-medium text-foreground mb-2">{q.questionText}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {q.options.map((opt) => (
                              <span key={opt.label} className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                                <span className="font-bold">{opt.label}.</span> {opt.text.slice(0, 40)}{opt.text.length > 40 ? "…" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-accent"
                            onClick={() => handleAIImprove(q)}
                            disabled={aiImproving === q.id}
                            title="AI Improve"
                          >
                            {aiImproving === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(q)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteQuestion(q.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summary">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Dimension</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Options</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-display font-bold">{q.id}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{q.dimension}</Badge></TableCell>
                        <TableCell className="text-sm">{q.questionText}</TableCell>
                        <TableCell className="text-right">{q.options.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* --- Employee Preview Dialog --- */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" /> Employee Preview
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-sm font-medium text-foreground">
                  Question {previewCurrent + 1} of {questions.length}
                </span>
                <Badge variant="secondary" className="text-xs">{previewQ?.dimension}</Badge>
              </div>
              <Progress value={previewProgress} className="h-1.5 mt-2" />
            </div>
            {previewQ && (
              <div className="px-6 py-6">
                <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">
                  {previewQ.dimension}
                </p>
                <h2 className="text-xl font-display font-bold text-foreground mb-6 leading-tight">
                  {previewQ.questionText}
                </h2>
                <div className="space-y-3">
                  {previewQ.options.map((opt) => {
                    const isSelected = previewAnswers[previewQ.id] === opt.score;
                    return (
                      <button
                        key={opt.score}
                        onClick={() => setPreviewAnswers((prev) => ({ ...prev, [previewQ.id]: opt.score }))}
                        className={cn(
                          "w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150",
                          isSelected
                            ? "border-accent bg-accent/5 shadow-card"
                            : "border-border hover:border-accent/40 hover:bg-secondary/50"
                        )}
                      >
                        <span className={cn(
                          "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm",
                          isSelected ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                        )}>
                          {opt.label}
                        </span>
                        <span className={cn("text-sm pt-1.5", isSelected ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-between">
              <Button variant="outline" onClick={() => setPreviewCurrent(Math.max(0, previewCurrent - 1))} disabled={previewCurrent === 0} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Previous
              </Button>
              <Button
                onClick={() => {
                  if (previewCurrent < questions.length - 1) {
                    setPreviewCurrent(previewCurrent + 1);
                  } else {
                    setPreviewOpen(false);
                    toast({ title: "Preview complete!", description: `${Object.keys(previewAnswers).length}/${questions.length} questions answered.` });
                  }
                }}
                disabled={!previewAnswers[previewQ?.id]}
                className="gap-2"
              >
                {previewCurrent === questions.length - 1 ? "Finish Preview" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* --- AI Generate Dialog --- */}
        <Dialog open={aiGenOpen} onOpenChange={setAiGenOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Generate Question with AI
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dimension</label>
                <Select value={aiGenDimension} onValueChange={setAiGenDimension}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full gap-2">
                {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiGenerating ? "Generating..." : "Generate Question"}
              </Button>
              {aiPreview && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardContent className="p-4 space-y-3">
                    <Badge variant="secondary" className="text-xs">{aiPreview.dimension}</Badge>
                    <p className="font-medium text-foreground text-sm">{aiPreview.questionText}</p>
                    <div className="space-y-1.5">
                      {aiPreview.options.map((opt) => (
                        <div key={opt.label} className="text-xs px-3 py-2 rounded-lg bg-secondary text-secondary-foreground">
                          <span className="font-bold">{opt.label}.</span> {opt.text}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={handleAIGenerate} className="gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Regenerate
                      </Button>
                      <Button size="sm" onClick={acceptAIQuestion} className="gap-1.5 flex-1">
                        <Plus className="w-3.5 h-3.5" /> Add to Survey
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Questions;
