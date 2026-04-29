import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, ArrowLeft } from "lucide-react";
// Import markdown source-of-truth at build time so the in-app docs and the
// repo docs never drift. Add a new entry below to surface a new file.
import readme from "../../docs/README.md?raw";
import testPlan from "../../docs/TEST_PLAN.md?raw";
import schema from "../../docs/SUPABASE_SCHEMA.md?raw";
import claudeMd from "../../CLAUDE.md?raw";
import { cn } from "@/lib/utils";

interface Doc {
  slug: string;
  title: string;
  source: string;
  body: string;
}

const DOCS: Doc[] = [
  { slug: "readme", title: "App Overview", source: "docs/README.md", body: readme },
  { slug: "claude", title: "Claude Pickup Brief", source: "CLAUDE.md", body: claudeMd },
  { slug: "test-plan", title: "Test Plan", source: "docs/TEST_PLAN.md", body: testPlan },
  { slug: "supabase-schema", title: "Supabase Schema", source: "docs/SUPABASE_SCHEMA.md", body: schema },
];

export const DocsPage = () => {
  const [params, setParams] = useSearchParams();
  const slug = params.get("d") ?? DOCS[0].slug;
  const doc = useMemo(() => DOCS.find((d) => d.slug === slug) ?? DOCS[0], [slug]);

  const setDoc = (s: string) => setParams({ d: s }, { replace: true });

  return (
    <main className="min-h-svh px-4 sm:px-6 pt-24 pb-20 bg-background text-foreground">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/lessons"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lessons
        </Link>

        <header className="mb-8">
          <p className="text-accent text-xs font-semibold tracking-wider mb-2">DOCUMENTATION</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
            Repository docs
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Versioned with the source. Edit the underlying <code className="px-1 py-0.5 rounded bg-muted text-foreground">.md</code> file to update this page.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
          <nav aria-label="Docs navigation" className="md:sticky md:top-24 md:self-start space-y-1">
            {DOCS.map((d) => (
              <button
                key={d.slug}
                onClick={() => setDoc(d.slug)}
                className={cn(
                  "w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  d.slug === doc.slug
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-current={d.slug === doc.slug ? "page" : undefined}
              >
                <FileText className="h-4 w-4" />
                {d.title}
              </button>
            ))}
          </nav>

          <article>
            <div
              key={doc.slug}
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-headings:text-foreground prose-h1:text-3xl prose-h2:text-2xl prose-p:text-foreground/85 prose-a:text-accent prose-code:text-accent prose-code:bg-accent-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-foreground prose-pre:text-background prose-strong:text-foreground prose-table:text-sm"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
            </div>
            <p className="mt-12 text-xs text-muted-foreground border-t border-border pt-4">
              Source: <code className="text-foreground">{doc.source}</code>
            </p>
          </article>
        </div>
      </div>
    </main>
  );
};
