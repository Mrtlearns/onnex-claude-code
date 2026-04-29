import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { History, RotateCcw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  getHistory, subscribeDraftHistory, type Snapshot,
} from "@/lib/draftHistory";
import { bodyFor, type LessonBody } from "@/content/lessons";
import { useResolvedMarkdown } from "@/hooks/useResolvedMarkdown";
import { cn } from "@/lib/utils";

const relTime = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

interface Props {
  slug: string;
  currentTitle: string;
  currentSummary: string;
  currentBody: LessonBody;
  onRestore: (snap: Snapshot) => void;
}

export const VersionHistoryDialog = ({
  slug, currentTitle, currentSummary, currentBody, onRestore,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => getHistory(slug));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const refresh = () => setSnapshots(getHistory(slug));
    refresh();
    const off = subscribeDraftHistory(refresh);
    return off;
  }, [open, slug]);

  useEffect(() => {
    if (snapshots.length > 0 && !selectedId) setSelectedId(snapshots[0].id);
  }, [snapshots, selectedId]);

  const selected = snapshots.find((s) => s.id === selectedId) ?? snapshots[0];
  const count = snapshots.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" /> History {count > 0 && `(${count})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Draft history</DialogTitle>
          <DialogDescription>
            Showing the {count} most recent autosaved snapshot{count === 1 ? "" : "s"} (oldest are pruned beyond 20).
          </DialogDescription>
        </DialogHeader>

        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No snapshots yet — keep editing and they'll appear here.
          </p>
        ) : (
          <div className="grid grid-cols-[220px_1fr] gap-4 max-h-[60vh]">
            <ul className="border-r border-border pr-2 overflow-y-auto space-y-0.5">
              {snapshots.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs",
                      selected?.id === s.id ? "bg-accent-soft text-accent" : "hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {s.publishedMarker && <Rocket className="h-3 w-3 text-accent" />}
                      <span className="font-medium truncate flex-1">{s.title || "(untitled)"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground" title={new Date(s.at).toLocaleString()}>
                      {relTime(s.at)}
                      {s.publishedMarker && " · published"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="overflow-y-auto pr-1">
                <SnapshotPreview snapshot={selected} current={{ title: currentTitle, summary: currentSummary, body: currentBody }} />
                <div className="sticky bottom-0 bg-background pt-3 mt-3 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      onRestore(selected);
                      setOpen(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> Restore this version
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const SnapshotPreview = ({
  snapshot, current,
}: {
  snapshot: Snapshot;
  current: { title: string; summary: string; body: LessonBody };
}) => {
  const md = useMemo(() => bodyFor(snapshot.body, "mac"), [snapshot]);
  const resolved = useResolvedMarkdown(md);
  const titleChanged = snapshot.title !== current.title;
  const summaryChanged = snapshot.summary !== current.summary;
  const bodyChanged = JSON.stringify(snapshot.body) !== JSON.stringify(current.body);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {titleChanged && <Badge variant="outline">title differs</Badge>}
        {summaryChanged && <Badge variant="outline">summary differs</Badge>}
        {bodyChanged && <Badge variant="outline">body differs</Badge>}
        {!titleChanged && !summaryChanged && !bodyChanged && (
          <Badge variant="secondary">matches current draft</Badge>
        )}
      </div>
      <div>
        <p className="text-[10px] tracking-wider text-muted-foreground">TITLE</p>
        <p className={cn("text-sm font-semibold", titleChanged && "text-accent")}>{snapshot.title}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-wider text-muted-foreground">SUMMARY</p>
        <p className={cn("text-xs", summaryChanged && "text-accent")}>{snapshot.summary}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-wider text-muted-foreground mb-1">BODY PREVIEW</p>
        <div className="prose prose-sm prose-neutral max-w-none border border-border rounded p-3 bg-muted/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolved}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
