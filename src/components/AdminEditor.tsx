import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Save, RotateCcw, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useOS, type OS, OS_LABELS } from "@/context/OSContext";
import {
  useLessons,
  setLessonOverride,
  clearLessonOverride,
  exportOverrides,
  importOverrides,
  bodyFor,
} from "@/content/contentStore";
import type { LessonBody } from "@/content/lessons";
import { TOTAL_LESSONS } from "@/content/lessons";

type EditorMode = "single" | "perOS";

export const AdminEditor = () => {
  const lessons = useLessons();
  const { os: activeOS } = useOS();
  const { toast } = useToast();
  const [selectedSlug, setSelectedSlug] = useState(lessons[0]?.slug ?? "");
  const [previewOS, setPreviewOS] = useState<OS>(activeOS ?? "mac");

  const lesson = lessons.find((l) => l.slug === selectedSlug);

  const initialMode: EditorMode = useMemo(
    () => (lesson && typeof lesson.body === "string" ? "single" : "perOS"),
    [lesson],
  );
  const [mode, setMode] = useState<EditorMode>(initialMode);

  if (!lesson) {
    return (
      <main className="min-h-svh px-4 pt-24 pb-20">
        <p className="text-muted-foreground">No lessons found.</p>
      </main>
    );
  }

  // Local working copy keyed by slug — re-derived when slug changes.
  return (
    <EditorBody
      key={lesson.slug}
      lessonSlug={lesson.slug}
      lessonTitle={lesson.title}
      lessonSummary={lesson.summary}
      lessonBody={lesson.body}
      lessonNumber={lesson.number}
      lessonKind={lesson.kind}
      lessons={lessons.map((l) => ({ slug: l.slug, title: l.title, kind: l.kind, number: l.number }))}
      onSelect={setSelectedSlug}
      mode={mode}
      setMode={setMode}
      previewOS={previewOS}
      setPreviewOS={setPreviewOS}
      onSaved={() => toast({ title: "Saved", description: `Updated "${lesson.title}".` })}
      onReset={() => {
        clearLessonOverride(lesson.slug);
        toast({ title: "Reverted", description: "Restored from source file." });
      }}
      onExport={() => {
        const blob = new Blob([exportOverrides()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "content-overrides.json";
        a.click();
        URL.revokeObjectURL(url);
      }}
      onImport={(file) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            importOverrides(String(reader.result));
            toast({ title: "Imported", description: "Overrides loaded." });
          } catch (e) {
            toast({
              title: "Import failed",
              description: e instanceof Error ? e.message : "Invalid file",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }}
    />
  );
};

type EditorBodyProps = {
  lessonSlug: string;
  lessonTitle: string;
  lessonSummary: string;
  lessonBody: LessonBody;
  lessonNumber: number | null;
  lessonKind: "lesson" | "pre-work";
  lessons: { slug: string; title: string; kind: string; number: number | null }[];
  onSelect: (slug: string) => void;
  mode: EditorMode;
  setMode: (m: EditorMode) => void;
  previewOS: OS;
  setPreviewOS: (os: OS) => void;
  onSaved: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

const EditorBody = ({
  lessonSlug,
  lessonTitle,
  lessonSummary,
  lessonBody,
  lessonNumber,
  lessonKind,
  lessons,
  onSelect,
  mode,
  setMode,
  previewOS,
  setPreviewOS,
  onSaved,
  onReset,
  onExport,
  onImport,
}: EditorBodyProps) => {
  const [title, setTitle] = useState(lessonTitle);
  const [summary, setSummary] = useState(lessonSummary);
  const [bodySingle, setBodySingle] = useState(
    typeof lessonBody === "string" ? lessonBody : bodyFor(lessonBody, previewOS),
  );
  const [bodyMac, setBodyMac] = useState(
    typeof lessonBody === "string" ? lessonBody : lessonBody.mac ?? "",
  );
  const [bodyWin, setBodyWin] = useState(
    typeof lessonBody === "string" ? lessonBody : lessonBody.windows ?? "",
  );
  const [bodyLinux, setBodyLinux] = useState(
    typeof lessonBody === "string" ? lessonBody : lessonBody.linux ?? "",
  );

  const previewBody =
    mode === "single"
      ? bodySingle
      : previewOS === "mac"
        ? bodyMac
        : previewOS === "windows"
          ? bodyWin
          : bodyLinux;

  const eyebrow =
    lessonKind === "pre-work" ? "PRE-WORK" : `LESSON ${lessonNumber} OF ${TOTAL_LESSONS}`;

  const handleSave = () => {
    const body: LessonBody =
      mode === "single"
        ? bodySingle
        : { mac: bodyMac, windows: bodyWin, linux: bodyLinux };
    setLessonOverride(lessonSlug, { title, summary, body });
    onSaved();
  };

  return (
    <main className="min-h-svh pt-20 pb-10">
      {/* Toolbar */}
      <div className="sticky top-16 z-20 bg-background/90 backdrop-blur border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 justify-between">
          <Link
            to="/lessons"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit admin
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              <Upload className="h-4 w-4" />
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4" /> Revert
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-0 min-h-[calc(100svh-9rem)]">
        {/* Lesson list */}
        <aside className="border-b lg:border-b-0 lg:border-r border-border p-3 overflow-y-auto max-h-[40vh] lg:max-h-none">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground px-2 py-1.5">
            CONTENT
          </p>
          <ul className="space-y-0.5">
            {lessons.map((l) => (
              <li key={l.slug}>
                <button
                  onClick={() => onSelect(l.slug)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                    l.slug === lessonSlug
                      ? "bg-accent-soft text-accent"
                      : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <span className="block text-[10px] tracking-wider text-muted-foreground">
                    {l.kind === "pre-work" ? "PRE-WORK" : `LESSON ${l.number}`}
                  </span>
                  <span className="block truncate">{l.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <section className="border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Summary</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Body (Markdown)</label>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                onClick={() => setMode("single")}
                className={`px-2 py-1 rounded ${mode === "single" ? "bg-muted" : ""}`}
              >
                Single
              </button>
              <button
                onClick={() => setMode("perOS")}
                className={`px-2 py-1 rounded ${mode === "perOS" ? "bg-muted" : ""}`}
              >
                Per-OS
              </button>
            </div>
          </div>

          {mode === "single" ? (
            <Textarea
              value={bodySingle}
              onChange={(e) => setBodySingle(e.target.value)}
              className="min-h-[420px] font-mono text-sm"
            />
          ) : (
            <Tabs value={previewOS} onValueChange={(v) => setPreviewOS(v as OS)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="mac">macOS</TabsTrigger>
                <TabsTrigger value="windows">Windows</TabsTrigger>
                <TabsTrigger value="linux">Linux</TabsTrigger>
              </TabsList>
              <TabsContent value="mac">
                <Textarea
                  value={bodyMac}
                  onChange={(e) => setBodyMac(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="windows">
                <Textarea
                  value={bodyWin}
                  onChange={(e) => setBodyWin(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="linux">
                <Textarea
                  value={bodyLinux}
                  onChange={(e) => setBodyLinux(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
          )}

          <p className="text-xs text-muted-foreground">
            Tip: edits are stored locally as overrides. Use Export to save them, Revert to restore
            the source file version.
          </p>
        </section>

        {/* Preview */}
        <section className="p-4 sm:p-6 overflow-y-auto bg-background">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">PREVIEW</p>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              {(["mac", "windows", "linux"] as OS[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setPreviewOS(o)}
                  className={`px-2 py-1 rounded ${previewOS === o ? "bg-muted" : ""}`}
                >
                  {OS_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <p className="text-accent text-xs font-semibold tracking-wider mb-2">{eyebrow}</p>
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
              {title || "Untitled"}
            </h1>
            <p className="text-muted-foreground mb-6">{summary}</p>
            <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-foreground prose-h1:text-2xl prose-h2:text-xl prose-p:text-foreground/85 prose-a:text-accent prose-code:text-accent prose-code:bg-accent-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-foreground prose-pre:text-background prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewBody}</ReactMarkdown>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
};
