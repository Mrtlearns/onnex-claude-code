import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TOTAL_LESSONS } from "@/content/lessons";
import { useLessons, bodyFor } from "@/content/contentStore";
import { useResolvedMarkdown } from "@/hooks/useResolvedMarkdown";
import { useOS } from "@/context/OSContext";

export const LessonPage = () => {
  const { slug = "" } = useParams();
  const { os } = useOS();
  const lessons = useLessons();
  const lesson = lessons.find((l) => l.slug === slug);

  if (!lesson || !os) {
    return (
      <main className="min-h-svh px-4 pt-24 pb-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Lesson not found.</p>
          <Link to="/lessons" className="text-accent underline">Back to lessons</Link>
        </div>
      </main>
    );
  }

  const idx = lessons.findIndex((l) => l.slug === slug);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const eyebrow =
    lesson.kind === "pre-work" ? "PRE-WORK" : `LESSON ${lesson.number} OF ${TOTAL_LESSONS}`;
  const resolvedBody = useResolvedMarkdown(bodyFor(lesson.body, os));

  return (
    <main className="min-h-svh px-4 sm:px-6 pt-24 pb-20">
      <article className="mx-auto max-w-3xl">
        <Link
          to="/lessons"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          All lessons
        </Link>

        <p className="text-accent text-xs font-semibold tracking-wider mb-2">{eyebrow}</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-3">
          {lesson.title}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-10">{lesson.summary}</p>

        <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-foreground prose-h1:text-3xl prose-h2:text-2xl prose-p:text-foreground/85 prose-a:text-accent prose-img:rounded-lg prose-code:text-accent prose-code:bg-accent-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-foreground prose-pre:text-background prose-strong:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolvedBody}</ReactMarkdown>
        </div>

        <nav className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              to={`/lessons/${prev.slug}`}
              className="rounded-xl border border-border bg-card p-4 hover:border-accent transition-colors"
            >
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3" /> Previous
              </span>
              <div className="font-serif font-bold text-foreground mt-1">{prev.title}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link
              to={`/lessons/${next.slug}`}
              className="rounded-xl border border-border bg-card p-4 text-right hover:border-accent transition-colors sm:col-start-2"
            >
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground justify-end w-full">
                Next <ArrowRight className="h-3 w-3" />
              </span>
              <div className="font-serif font-bold text-foreground mt-1">{next.title}</div>
            </Link>
          ) : <div />}
        </nav>
      </article>
    </main>
  );
};
