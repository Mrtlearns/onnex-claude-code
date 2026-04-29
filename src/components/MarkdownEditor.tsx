import { useCallback, useImperativeHandle, useRef, forwardRef, useState } from "react";
import {
  Bold, Italic, Heading1, Heading2, Heading3, Link as LinkIcon,
  Code, Code2, List, ListOrdered, Image as ImageIcon, Undo2, Redo2, Quote, Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { saveImage } from "@/lib/imageStore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface MarkdownEditorHandle {
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  className?: string;
  minHeight?: number;
}

type Selection = { start: number; end: number };

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(
  ({ value, onChange, onUndo, onRedo, canUndo, canRedo, className, minHeight = 400 }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    const getSel = (): Selection => {
      const ta = textareaRef.current;
      if (!ta) return { start: value.length, end: value.length };
      return { start: ta.selectionStart, end: ta.selectionEnd };
    };

    const apply = useCallback(
      (mutate: (s: { value: string; sel: Selection }) => { value: string; sel: Selection }) => {
        const sel = getSel();
        const result = mutate({ value, sel });
        onChange(result.value);
        requestAnimationFrame(() => {
          const ta = textareaRef.current;
          if (!ta) return;
          ta.focus();
          ta.setSelectionRange(result.sel.start, result.sel.end);
        });
      },
      [onChange, value],
    );

    const wrap = (left: string, right = left, placeholder = "text") =>
      apply(({ value: v, sel }) => {
        const selected = v.slice(sel.start, sel.end) || placeholder;
        const before = v.slice(0, sel.start);
        const after = v.slice(sel.end);
        const newValue = `${before}${left}${selected}${right}${after}`;
        const start = before.length + left.length;
        return { value: newValue, sel: { start, end: start + selected.length } };
      });

    const linePrefix = (prefix: string) =>
      apply(({ value: v, sel }) => {
        const lineStart = v.lastIndexOf("\n", sel.start - 1) + 1;
        const lineEnd = v.indexOf("\n", sel.end);
        const segEnd = lineEnd === -1 ? v.length : lineEnd;
        const segment = v.slice(lineStart, segEnd);
        const lines = segment.split("\n").map((l) => (l.startsWith(prefix) ? l : prefix + l));
        const replaced = lines.join("\n");
        const newValue = v.slice(0, lineStart) + replaced + v.slice(segEnd);
        return { value: newValue, sel: { start: lineStart, end: lineStart + replaced.length } };
      });

    const insertAtCursor = (text: string) =>
      apply(({ value: v, sel }) => {
        const before = v.slice(0, sel.start);
        const after = v.slice(sel.end);
        const newValue = before + text + after;
        const caret = before.length + text.length;
        return { value: newValue, sel: { start: caret, end: caret } };
      });

    const insertLink = () => {
      const url = window.prompt("Link URL", "https://");
      if (!url) return;
      apply(({ value: v, sel }) => {
        const selected = v.slice(sel.start, sel.end) || "link text";
        const md = `[${selected}](${url})`;
        const before = v.slice(0, sel.start);
        const after = v.slice(sel.end);
        return {
          value: before + md + after,
          sel: { start: before.length + 1, end: before.length + 1 + selected.length },
        };
      });
    };

    const insertCodeBlock = () =>
      apply(({ value: v, sel }) => {
        const selected = v.slice(sel.start, sel.end) || "code";
        const md = `\n\`\`\`\n${selected}\n\`\`\`\n`;
        const before = v.slice(0, sel.start);
        const after = v.slice(sel.end);
        const start = before.length + 5;
        return { value: before + md + after, sel: { start, end: start + selected.length } };
      });

    const handleFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      const inserts: string[] = [];
      try {
        for (const file of Array.from(files)) {
          try {
            const url = await saveImage(file);
            const baseName = file.name.replace(/\.[^.]+$/, "") || "file";
            if (file.type.startsWith("image/")) {
              inserts.push(`![${baseName}](${url})`);
            } else {
              inserts.push(`[${file.name}](${url})`);
            }
          } catch (err) {
            toast({
              title: "Upload failed",
              description: `${file.name}: ${err instanceof Error ? err.message : "unknown error"}`,
              variant: "destructive",
            });
          }
        }
        if (inserts.length > 0) insertAtCursor(`\n${inserts.join("\n")}\n`);
      } finally {
        setUploading(false);
      }
    };

    const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        void handleFiles(dt.files);
      }
    };

    const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
      if (e.dataTransfer.files?.length) {
        e.preventDefault();
        void handleFiles(e.dataTransfer.files);
      }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); wrap("**", "**", "bold text"); }
      else if (k === "i") { e.preventDefault(); wrap("*", "*", "italic text"); }
      else if (k === "k") { e.preventDefault(); insertLink(); }
      else if (k === "z" && !e.shiftKey) { e.preventDefault(); onUndo?.(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); onRedo?.(); }
    };

    return (
      <div className={cn("rounded-md border border-border bg-background", className)}>
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-border">
          <ToolBtn label="Bold (⌘B)" onClick={() => wrap("**", "**", "bold text")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Italic (⌘I)" onClick={() => wrap("*", "*", "italic text")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <Sep />
          <ToolBtn label="Heading 1" onClick={() => linePrefix("# ")}><Heading1 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Heading 2" onClick={() => linePrefix("## ")}><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Heading 3" onClick={() => linePrefix("### ")}><Heading3 className="h-3.5 w-3.5" /></ToolBtn>
          <Sep />
          <ToolBtn label="Bulleted list" onClick={() => linePrefix("- ")}><List className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Numbered list" onClick={() => linePrefix("1. ")}><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Quote" onClick={() => linePrefix("> ")}><Quote className="h-3.5 w-3.5" /></ToolBtn>
          <Sep />
          <ToolBtn label="Inline code" onClick={() => wrap("`", "`", "code")}><Code className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Code block" onClick={insertCodeBlock}><Code2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn label="Link (⌘K)" onClick={insertLink}><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
          <label
            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            title="Insert image or file"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <div className="ml-auto flex items-center gap-0.5">
            <ToolBtn label="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn label="Redo (⌘⇧Z)" onClick={onRedo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDrop={onDrop}
          className="font-mono text-sm border-0 rounded-none rounded-b-md focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
          style={{ minHeight }}
          placeholder="Write Markdown… drop or paste images directly."
        />
      </div>
    );
  },
);
MarkdownEditor.displayName = "MarkdownEditor";

const ToolBtn = ({
  children, onClick, label, disabled,
}: { children: React.ReactNode; onClick?: () => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
  >
    {children}
  </button>
);

const Sep = () => <span className="mx-0.5 h-5 w-px bg-border" />;
