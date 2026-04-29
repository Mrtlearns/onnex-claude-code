import { useEffect, useMemo, useState } from "react";
import { FileText, ImageOff, Trash2, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  listAssets, deleteAsset, deleteAssets, resolveImageUrl, subscribeAssets,
  type AssetMeta,
} from "@/lib/imageStore";
import { computeAssetUsage } from "@/lib/assetUsage";
import { subscribe as subscribeContent } from "@/content/contentStore";
import { cn } from "@/lib/utils";

type Filter = "all" | "unused" | "images" | "pdfs";

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const AssetManager = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [usage, setUsage] = useState<Map<string, Set<string>>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listAssets();
    setAssets(list);
    setUsage(computeAssetUsage());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    const offA = subscribeAssets(() => void refresh());
    const offC = subscribeContent(() => setUsage(computeAssetUsage()));
    return () => {
      offA();
      offC();
    };
  }, []);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (filter === "images") return a.type.startsWith("image/");
      if (filter === "pdfs") return a.type === "application/pdf";
      if (filter === "unused") return !usage.has(a.id);
      return true;
    });
  }, [assets, usage, filter]);

  const totalBytes = assets.reduce((sum, a) => sum + a.size, 0);
  const unusedAssets = assets.filter((a) => !usage.has(a.id));
  const unusedBytes = unusedAssets.reduce((sum, a) => sum + a.size, 0);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allOnPageSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const togglePage = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      filtered.forEach((a) => next.delete(a.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((a) => next.add(a.id));
      setSelected(next);
    }
  };

  const onDeleteSelected = async () => {
    const ids = Array.from(selected);
    await deleteAssets(ids);
    setSelected(new Set());
    toast({ title: "Deleted", description: `Removed ${ids.length} asset${ids.length === 1 ? "" : "s"}.` });
  };

  const onDeleteUnused = async () => {
    const ids = unusedAssets.map((a) => a.id);
    await deleteAssets(ids);
    setSelected(new Set());
    toast({ title: "Cleanup complete", description: `Removed ${ids.length} unused asset${ids.length === 1 ? "" : "s"}.` });
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Assets</h2>
          <p className="text-sm text-muted-foreground">
            {assets.length} file{assets.length === 1 ? "" : "s"} · {fmtBytes(totalBytes)} total ·{" "}
            <span className="text-accent">
              {unusedAssets.length} unused ({fmtBytes(unusedBytes)})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <ConfirmDelete
              count={selected.size}
              label="Delete selected"
              onConfirm={onDeleteSelected}
            />
          )}
          {unusedAssets.length > 0 && (
            <ConfirmDelete
              count={unusedAssets.length}
              label="Delete all unused"
              variant="outline"
              onConfirm={onDeleteUnused}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(["all", "unused", "images", "pdfs"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              filter === f
                ? "bg-accent-soft border-accent text-accent"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f === "all" ? `All (${assets.length})`
              : f === "unused" ? `Unused (${unusedAssets.length})`
              : f === "images" ? "Images"
              : "PDFs"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <ImageOff className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No assets match this filter.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-[40px_60px_1fr_90px_90px_140px_120px] items-center gap-3 bg-muted/40 px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={togglePage}
              className="accent-accent"
              aria-label="Select all"
            />
            <span>PREVIEW</span>
            <span>NAME</span>
            <span>TYPE</span>
            <span>SIZE</span>
            <span>USAGE</span>
            <span className="text-right">ACTIONS</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((a) => (
              <AssetRow
                key={a.id}
                asset={a}
                used={usage.get(a.id)}
                checked={selected.has(a.id)}
                onToggle={() => toggle(a.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Files live in this browser (IndexedDB). Deleting an asset is permanent — links in lessons that point to it will stop rendering.
      </p>
    </div>
  );
};

const AssetRow = ({
  asset, used, checked, onToggle,
}: {
  asset: AssetMeta;
  used?: Set<string>;
  checked: boolean;
  onToggle: () => void;
}) => {
  const { toast } = useToast();
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (asset.type.startsWith("image/")) {
      void resolveImageUrl(asset.id).then((url) => {
        if (active) setThumb(url);
      });
    }
    return () => {
      active = false;
    };
  }, [asset.id, asset.type]);

  const usedCount = used?.size ?? 0;

  return (
    <li className="grid grid-cols-[40px_60px_1fr_90px_90px_140px_120px] items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-accent"
        aria-label={`Select ${asset.name}`}
      />
      <div className="h-10 w-12 rounded bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <span className="truncate" title={asset.name}>{asset.name}</span>
      <span className="text-xs text-muted-foreground truncate">{asset.type || "—"}</span>
      <span className="text-xs text-muted-foreground">{fmtBytes(asset.size)}</span>
      <div>
        {usedCount === 0 ? (
          <Badge variant="outline" className="text-accent border-accent">Unused</Badge>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs text-foreground/80 hover:text-accent inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> Used in {usedCount}
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-xs w-64">
              <p className="font-semibold mb-1">Referenced in</p>
              <ul className="space-y-0.5 list-disc pl-4">
                {Array.from(used ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="flex justify-end gap-1 text-xs text-muted-foreground">
        <span title={fmtDate(asset.createdAt)}>{new Date(asset.createdAt).toLocaleDateString()}</span>
        <ConfirmDelete
          count={1}
          label=""
          iconOnly
          onConfirm={async () => {
            await deleteAsset(asset.id);
            toast({ title: "Deleted", description: asset.name });
          }}
        />
      </div>
    </li>
  );
};

const ConfirmDelete = ({
  count, label, onConfirm, variant = "destructive", iconOnly = false,
}: {
  count: number;
  label: string;
  onConfirm: () => void | Promise<void>;
  variant?: "destructive" | "outline";
  iconOnly?: boolean;
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      {iconOnly ? (
        <button
          className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button size="sm" variant={variant}>
          <Trash2 className="h-4 w-4" /> {label}
        </Button>
      )}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {count} asset{count === 1 ? "" : "s"}?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the file{count === 1 ? "" : "s"} from this browser. Any lessons still linking to {count === 1 ? "it" : "them"} will show broken references.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={() => void onConfirm()}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
