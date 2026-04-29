import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Save, Trash2, Download, Upload, Rocket, CircleDot, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOS, type OS, OS_LABELS } from "@/context/OSContext";
import {
  useDraftLessons, setDraft, setManyDrafts, discardDraft,
  exportPublished, importPublished, publishDraft, usePendingSlugs, bodyFor,
} from "@/content/contentStore";
import type { LessonBody } from "@/content/lessons";
import { TOTAL_LESSONS } from "@/content/lessons";
import { useHistory } from "@/hooks/useHistory";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { useResolvedMarkdown } from "@/hooks/useResolvedMarkdown";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { cn } from "@/lib/utils";

type EditorMode = "single" | "perOS";
type ViewMode = "single" | "bulk";

export const AdminEditor = () => {
  const lessons = useDraftLessons();
  const { os: activeOS } = useOS();
  const pendingSlugs = usePendingSlugs();
  const [view, setView] = useState<ViewMode>("single");
  const [selectedSlug, setSelectedSlug] = useState(lessons[0]?.slug ?? "");
  const [previewOS, setPreviewOS] = useState<OS>(activeOS ?? "mac");

  const lesson = lessons.find((l) => l.slug === selectedSlug) ?? lessons[0];

  return (
    <main className="min-h-svh pt-20 pb-10">
      <Toolbar view={view} setView={setView} pendingCount={pendingSlugs.size} />
      {view === "single" && lesson ? (
        <SingleEditor
          key={lesson.slug}
          lesson={lesson}
          lessons={lessons}
          pendingSlugs={pendingSlugs}
          previewOS={previewOS}
          setPreviewOS={setPreviewOS}
          onSelect={setSelectedSlug}
        />
      ) : (
        <BulkEditor lessons={lessons} pendingSlugs={pendingSlugs} />
      )}
    </main>
  );
};

// =====================================================================
// Toolbar
// =====================================================================

const Toolbar = ({
  view, setView, pendingCount,
}: { view: ViewMode; setView: (v: ViewMode) => void; pendingCount: number }) => {
  const { toast } = useToast();

  const onExport = () => {
    const blob = new Blob([exportPublished()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-published.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPublished(String(reader.result));
        toast({ title: "Imported", description: "Published content replaced." });
      } catch (e) {
        toast({
          title: "Import failed",
          description: e instanceof Error ? e.message : "Invalid file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="sticky top-16 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/lessons"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Exit admin
          </Link>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              onClick={() => setView("single")}
              className={cn("px-2.5 py-1 rounded", view === "single" && "bg-muted")}
            >
              Single
            </button>
            <button
              onClick={() => setView("bulk")}
              className={cn("px-2.5 py-1 rounded", view === "bulk" && "bg-muted")}
            >
              Bulk
            </button>
          </div>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <CircleDot className="h-3 w-3" />
              {pendingCount} draft{pendingCount === 1 ? "" : "s"} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            <Upload className="h-4 w-4" /> Import
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
          <PublishAllButton pendingCount={pendingCount} />
        </div>
      </div>
    </div>
  );
};

const PublishAllButton = ({ pendingCount }: { pendingCount: number }) => {
  const { toast } = useToast();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="default" disabled={pendingCount === 0}>
          <Rocket className="h-4 w-4" /> Publish all{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish all drafts?</AlertDialogTitle>
          <AlertDialogDescription>
            Promote {pendingCount} pending draft{pendingCount === 1 ? "" : "s"} to the live site.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              publishDraft();
              toast({ title: "Published", description: "All drafts are now live." });
            }}
          >
            Publish all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// =====================================================================
// Single editor
// =====================================================================

interface SingleProps {
  lesson: ReturnType<typeof useDraftLessons>[number];
  lessons: ReturnType<typeof useDraftLessons>;
  pendingSlugs: Set<string>;
  previewOS: OS;
  setPreviewOS: (os: OS) => void;
  onSelect: (slug: string) => void;
}

const SingleEditor = ({
  lesson, lessons, pendingSlugs, previewOS, setPreviewOS, onSelect,
}: SingleProps) => {
  const { toast } = useToast();
  const initialMode: EditorMode = useMemo(
    () => (typeof lesson.body === "string" ? "single" : "perOS"),
    [lesson],
  );
  const [mode, setMode] = useState<EditorMode>(initialMode);

  const title = useHistory(lesson.title);
  const summary = useHistory(lesson.summary);
  const bodySingle = useHistory(
    typeof lesson.body === "string" ? lesson.body : bodyFor(lesson.body, previewOS),
  );
  const bodyMac = useHistory(typeof lesson.body === "string" ? lesson.body : lesson.body.mac ?? "");
  const bodyWin = useHistory(
    typeof lesson.body === "string" ? lesson.body : lesson.body.windows ?? "",
  );
  const bodyLinux = useHistory(
    typeof lesson.body === "string" ? lesson.body : lesson.body.linux ?? "",
  );

  // Detect dirty: working copy vs the current draft+published merge
  const dirty =
    title.value !== lesson.title ||
    summary.value !== lesson.summary ||
    (mode === "single"
      ? bodySingle.value !== (typeof lesson.body === "string" ? lesson.body : bodyFor(lesson.body, previewOS))
      : bodyMac.value !== (typeof lesson.body === "string" ? lesson.body : lesson.body.mac ?? "") ||
        bodyWin.value !== (typeof lesson.body === "string" ? lesson.body : lesson.body.windows ?? "") ||
        bodyLinux.value !== (typeof lesson.body === "string" ? lesson.body : lesson.body.linux ?? ""));

  useUnsavedChangesPrompt(dirty);

  const previewBody =
    mode === "single"
      ? bodySingle.value
      : previewOS === "mac" ? bodyMac.value
      : previewOS === "windows" ? bodyWin.value
      : bodyLinux.value;

  const eyebrow =
    lesson.kind === "pre-work" ? "PRE-WORK" : `LESSON ${lesson.number} OF ${TOTAL_LESSONS}`;

  const handleSaveDraft = () => {
    const body: LessonBody =
      mode === "single"
        ? bodySingle.value
        : { mac: bodyMac.value, windows: bodyWin.value, linux: bodyLinux.value };
    setDraft(lesson.slug, { title: title.value, summary: summary.value, body });
    toast({ title: "Draft saved", description: `"${title.value}" staged for publish.` });
  };

  const handlePublish = () => {
    handleSaveDraft();
    publishDraft(lesson.slug);
    toast({ title: "Published", description: `"${title.value}" is now live.` });
  };

  const handleDiscard = () => {
    discardDraft(lesson.slug);
    title.reset(lesson.title);
    summary.reset(lesson.summary);
    if (typeof lesson.body === "string") {
      bodySingle.reset(lesson.body);
    } else {
      bodyMac.reset(lesson.body.mac ?? "");
      bodyWin.reset(lesson.body.windows ?? "");
      bodyLinux.reset(lesson.body.linux ?? "");
    }
    toast({ title: "Discarded", description: "Draft removed." });
  };

  // Confirm before switching lessons while dirty
  const handleSelect = (slug: string) => {
    if (slug === lesson.slug) return;
    if (dirty && !window.confirm("Unsaved changes will be lost. Continue?")) return;
    onSelect(slug);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-0 min-h-[calc(100svh-9rem)]">
      <LessonList
        lessons={lessons}
        currentSlug={lesson.slug}
        pendingSlugs={pendingSlugs}
        onSelect={handleSelect}
      />

      {/* Editor pane */}
      <section className="border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <CircleDot className="h-3 w-3 animate-pulse" /> Unsaved changes
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved.</span>
          )}
          <div className="flex items-center gap-2">
            {pendingSlugs.has(lesson.slug) && (
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                <Trash2 className="h-4 w-4" /> Discard
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={!dirty}>
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <Rocket className="h-4 w-4" /> Publish
            </Button>
          </div>
        </div>

        <FieldWithHistory label="Title" hist={title}>
          <Input value={title.value} onChange={(e) => title.set(e.target.value)} className="mt-1" />
        </FieldWithHistory>

        <FieldWithHistory label="Summary" hist={summary}>
          <Textarea
            value={summary.value}
            onChange={(e) => summary.set(e.target.value)}
            className="mt-1 min-h-[80px]"
          />
        </FieldWithHistory>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Body (Markdown)</label>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              onClick={() => setMode("single")}
              className={cn("px-2 py-1 rounded", mode === "single" && "bg-muted")}
            >
              Single
            </button>
            <button
              onClick={() => setMode("perOS")}
              className={cn("px-2 py-1 rounded", mode === "perOS" && "bg-muted")}
            >
              Per-OS
            </button>
          </div>
        </div>

        {mode === "single" ? (
          <MarkdownEditor
            value={bodySingle.value}
            onChange={bodySingle.set}
            onUndo={bodySingle.undo}
            onRedo={bodySingle.redo}
            canUndo={bodySingle.canUndo}
            canRedo={bodySingle.canRedo}
          />
        ) : (
          <Tabs value={previewOS} onValueChange={(v) => setPreviewOS(v as OS)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="mac">macOS</TabsTrigger>
              <TabsTrigger value="windows">Windows</TabsTrigger>
              <TabsTrigger value="linux">Linux</TabsTrigger>
            </TabsList>
            <TabsContent value="mac">
              <MarkdownEditor
                value={bodyMac.value} onChange={bodyMac.set}
                onUndo={bodyMac.undo} onRedo={bodyMac.redo}
                canUndo={bodyMac.canUndo} canRedo={bodyMac.canRedo}
              />
            </TabsContent>
            <TabsContent value="windows">
              <MarkdownEditor
                value={bodyWin.value} onChange={bodyWin.set}
                onUndo={bodyWin.undo} onRedo={bodyWin.redo}
                canUndo={bodyWin.canUndo} canRedo={bodyWin.canRedo}
              />
            </TabsContent>
            <TabsContent value="linux">
              <MarkdownEditor
                value={bodyLinux.value} onChange={bodyLinux.set}
                onUndo={bodyLinux.undo} onRedo={bodyLinux.redo}
                canUndo={bodyLinux.canUndo} canRedo={bodyLinux.canRedo}
              />
            </TabsContent>
          </Tabs>
        )}

        <p className="text-xs text-muted-foreground">
          Drafts stay private until you Publish. Drop or paste images directly into the editor.
        </p>
      </section>

      {/* Preview pane */}
      <section className="p-4 sm:p-6 overflow-y-auto bg-background">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">PREVIEW</p>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            {(["mac", "windows", "linux"] as OS[]).map((o) => (
              <button
                key={o}
                onClick={() => setPreviewOS(o)}
                className={cn("px-2 py-1 rounded", previewOS === o && "bg-muted")}
              >
                {OS_LABELS[o]}
              </button>
            ))}
          </div>
        </div>
        <PreviewCard
          eyebrow={eyebrow}
          title={title.value}
          summary={summary.value}
          body={previewBody}
        />
      </section>
    </div>
  );
};

const FieldWithHistory = <T,>({
  label, hist, children,
}: {
  label: string;
  hist: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; value: T };
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={hist.undo}
          disabled={!hist.canUndo}
          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          undo
        </button>
        <button
          type="button"
          onClick={hist.redo}
          disabled={!hist.canRedo}
          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          redo
        </button>
      </div>
    </div>
    {children}
  </div>
);

const PreviewCard = ({
  eyebrow, title, summary, body,
}: { eyebrow: string; title: string; summary: string; body: string }) => {
  const resolved = useResolvedMarkdown(body);
  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <p className="text-accent text-xs font-semibold tracking-wider mb-2">{eyebrow}</p>
      <h1 className="font-serif text-3xl font-bold text-foreground mb-2">{title || "Untitled"}</h1>
      <p className="text-muted-foreground mb-6">{summary}</p>
      <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-foreground prose-h1:text-2xl prose-h2:text-xl prose-p:text-foreground/85 prose-a:text-accent prose-img:rounded-lg prose-code:text-accent prose-code:bg-accent-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-foreground prose-pre:text-background prose-strong:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolved}</ReactMarkdown>
      </div>
    </article>
  );
};

// =====================================================================
// Lesson list
// =====================================================================

const LessonList = ({
  lessons, currentSlug, pendingSlugs, onSelect,
}: {
  lessons: ReturnType<typeof useDraftLessons>;
  currentSlug: string;
  pendingSlugs: Set<string>;
  onSelect: (slug: string) => void;
}) => (
  <aside className="border-b lg:border-b-0 lg:border-r border-border p-3 overflow-y-auto max-h-[40vh] lg:max-h-none">
    <p className="text-xs font-semibold tracking-wider text-muted-foreground px-2 py-1.5">CONTENT</p>
    <ul className="space-y-0.5">
      {lessons.map((l) => (
        <li key={l.slug}>
          <button
            onClick={() => onSelect(l.slug)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
              l.slug === currentSlug
                ? "bg-accent-soft text-accent"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="block text-[10px] tracking-wider text-muted-foreground">
                {l.kind === "pre-work" ? "PRE-WORK" : `LESSON ${l.number}`}
              </span>
              {pendingSlugs.has(l.slug) && (
                <CircleDot className="h-2.5 w-2.5 text-accent" />
              )}
            </span>
            <span className="block truncate">{l.title}</span>
          </button>
        </li>
      ))}
    </ul>
  </aside>
);

// =====================================================================
// Bulk editor
// =====================================================================

type BulkMode = "sameBody" | "perSlug";

const BulkEditor = ({
  lessons, pendingSlugs,
}: { lessons: ReturnType<typeof useDraftLessons>; pendingSlugs: Set<string> }) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<BulkMode>("sameBody");
  const [text, setText] = useState("");
  const [targetOS, setTargetOS] = useState<OS | "all">("all");

  const toggle = (slug: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  const selectAll = () => setSelected(new Set(lessons.map((l) => l.slug)));
  const selectNone = () => setSelected(new Set());
  const selectKind = (kind: "pre-work" | "lesson") =>
    setSelected(new Set(lessons.filter((l) => l.kind === kind).map((l) => l.slug)));

  // Parse per-slug blocks: ---slug: foo---\n<body>\n---slug: bar---\n<body>
  const parseBlocks = (raw: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /^---slug:\s*([a-z0-9-]+)\s*---\s*$/gim;
    const matches = Array.from(raw.matchAll(re));
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const slug = m[1];
      const start = m.index! + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
      out[slug] = raw.slice(start, end).trim();
    }
    return out;
  };

  const blocks = mode === "perSlug" ? parseBlocks(text) : {};
  const blockSlugs = Object.keys(blocks);

  const updateCount =
    mode === "sameBody" ? selected.size : blockSlugs.filter((s) => lessons.some((l) => l.slug === s)).length;

  const buildBody = (current: LessonBody, newBody: string): LessonBody => {
    if (typeof current === "string" || targetOS === "all") {
      // If current is per-OS and we picked "all", overwrite all OS variants
      if (typeof current === "string") return newBody;
      return { mac: newBody, windows: newBody, linux: newBody };
    }
    // current is per-OS, single OS selected
    return { ...current, [targetOS]: newBody };
  };

  const applyToDrafts = () => {
    const patches: Record<string, { body: LessonBody }> = {};
    if (mode === "sameBody") {
      for (const slug of selected) {
        const lesson = lessons.find((l) => l.slug === slug);
        if (!lesson) continue;
        patches[slug] = { body: buildBody(lesson.body, text) };
      }
    } else {
      for (const [slug, body] of Object.entries(blocks)) {
        const lesson = lessons.find((l) => l.slug === slug);
        if (!lesson) continue;
        patches[slug] = { body: buildBody(lesson.body, body) };
      }
    }
    if (Object.keys(patches).length === 0) {
      toast({ title: "Nothing to apply", variant: "destructive" });
      return;
    }
    setManyDrafts(patches);
    toast({
      title: "Drafts staged",
      description: `Updated body for ${Object.keys(patches).length} lesson${Object.keys(patches).length === 1 ? "" : "s"}.`,
    });
  };

  const publishStaged = () => {
    publishDraft();
    toast({ title: "Published", description: "All drafts are live." });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 min-h-[calc(100svh-9rem)]">
      <aside className="border-b lg:border-b-0 lg:border-r border-border p-3 overflow-y-auto max-h-[50vh] lg:max-h-none">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">SELECT LESSONS</p>
          <span className="text-[10px] text-muted-foreground">{selected.size} chosen</span>
        </div>
        <div className="flex flex-wrap gap-1 px-2 mb-2">
          <PillBtn onClick={selectAll}>All</PillBtn>
          <PillBtn onClick={() => selectKind("pre-work")}>Pre-work</PillBtn>
          <PillBtn onClick={() => selectKind("lesson")}>Lessons</PillBtn>
          <PillBtn onClick={selectNone}>None</PillBtn>
        </div>
        <ul className="space-y-0.5">
          {lessons.map((l) => {
            const checked = selected.has(l.slug);
            return (
              <li key={l.slug}>
                <label
                  className={cn(
                    "flex items-start gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                    checked ? "bg-accent-soft text-accent" : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(l.slug)}
                    className="mt-1 accent-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between">
                      <span className="block text-[10px] tracking-wider text-muted-foreground">
                        {l.kind === "pre-work" ? "PRE-WORK" : `LESSON ${l.number}`}
                      </span>
                      {pendingSlugs.has(l.slug) && (
                        <CircleDot className="h-2.5 w-2.5 text-accent" />
                      )}
                    </span>
                    <span className="block truncate">{l.title}</span>
                    <span className="block text-[10px] text-muted-foreground/70 font-mono">
                      {l.slug}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="p-4 sm:p-6 space-y-4 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              onClick={() => setMode("sameBody")}
              className={cn("px-2.5 py-1 rounded", mode === "sameBody" && "bg-muted")}
            >
              Same body to selected
            </button>
            <button
              onClick={() => setMode("perSlug")}
              className={cn("px-2.5 py-1 rounded", mode === "perSlug" && "bg-muted")}
            >
              Per-slug blocks
            </button>
          </div>
          <div className="inline-flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Apply to:</span>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {(["all", "mac", "windows", "linux"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setTargetOS(o)}
                  className={cn("px-2 py-1 rounded", targetOS === o && "bg-muted")}
                >
                  {o === "all" ? "All OS" : OS_LABELS[o]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === "perSlug" && (
          <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
            Format each block with a separator line:
            <pre className="mt-1 font-mono text-[11px] text-foreground">{`---slug: getting-ready---
Body markdown here…

---slug: claude-md-playbook---
Another lesson body…`}</pre>
            {blockSlugs.length > 0 && (
              <p className="mt-2">
                Detected {blockSlugs.length} block{blockSlugs.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono">{blockSlugs.join(", ")}</span>
              </p>
            )}
          </div>
        )}

        <MarkdownEditor value={text} onChange={setText} minHeight={420} />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            Will update body for <span className="font-semibold text-foreground">{updateCount}</span>{" "}
            lesson{updateCount === 1 ? "" : "s"}
            {targetOS !== "all" && <> (target: {OS_LABELS[targetOS]})</>}.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={applyToDrafts} disabled={updateCount === 0}>
              <Save className="h-4 w-4" /> Stage as drafts
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={pendingSlugs.size === 0}>
                  <Rocket className="h-4 w-4" /> Publish all drafts ({pendingSlugs.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish all drafts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Promote {pendingSlugs.size} pending draft
                    {pendingSlugs.size === 1 ? "" : "s"} to the live site.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={publishStaged}>Publish</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>
    </div>
  );
};

const PillBtn = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-[11px] px-2 py-0.5 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
  >
    {children}
  </button>
);
