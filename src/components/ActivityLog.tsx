import { useEffect, useMemo, useState } from "react";
import { Clock, Trash2, ChevronDown, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getActivity, clearActivity, subscribeActivity, type ActivityEntry,
} from "@/lib/activityLog";
import { cn } from "@/lib/utils";

const dayKey = (ts: number) => new Date(ts).toLocaleDateString(undefined, {
  weekday: "long", month: "short", day: "numeric", year: "numeric",
});
const timeStr = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

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

export const ActivityLog = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>(() => getActivity());

  useEffect(() => {
    const off = subscribeActivity(() => setEntries(getActivity()));
    return off;
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const e of entries) {
      const k = dayKey(e.at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Publish history</h2>
          <p className="text-sm text-muted-foreground">
            {entries.length} event{entries.length === 1 ? "" : "s"} recorded.
          </p>
        </div>
        {entries.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4" /> Clear log
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all {entries.length} publish records from this browser.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearActivity}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No publish events yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, rows]) => (
            <section key={day}>
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">
                {day.toUpperCase()}
              </h3>
              <ul className="rounded-md border border-border divide-y divide-border">
                {rows.map((e) => (
                  <ActivityRow key={e.id} entry={e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityRow = ({ entry }: { entry: ActivityEntry }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-3 py-2.5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-3 text-left">
          <Rocket className="h-4 w-4 text-accent shrink-0" />
          <span className="font-medium text-foreground truncate flex-1">{entry.title}</span>
          <ScopeBadge entry={entry} />
          <span
            className="text-xs text-muted-foreground shrink-0"
            title={new Date(entry.at).toLocaleString()}
          >
            {timeStr(entry.at)} · {relTime(entry.at)}
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 pl-7 space-y-1.5">
          {entry.summary && (
            <p className="text-xs text-muted-foreground italic">{entry.summary}</p>
          )}
          <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted/50 rounded p-2 text-foreground/80 max-h-40 overflow-auto">
            {entry.bodyPreview || "(empty body)"}
          </pre>
          <p className="text-[10px] text-muted-foreground font-mono">{entry.slug}</p>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};

const ScopeBadge = ({ entry }: { entry: ActivityEntry }) => {
  if (entry.scope === "all")
    return <Badge variant="secondary" className="text-[10px]">Publish all · {entry.count ?? 0}</Badge>;
  if (entry.scope === "batch-item")
    return <Badge variant="outline" className="text-[10px]">in batch</Badge>;
  return <Badge variant="outline" className="text-[10px]">single</Badge>;
};
