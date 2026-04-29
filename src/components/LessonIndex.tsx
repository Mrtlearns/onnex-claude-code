import { Link } from "react-router-dom";
import { BookOpen, Download, Plug, Puzzle, Sparkles, Wrench } from "lucide-react";
import { lessons, TOTAL_LESSONS, type Lesson, type LessonIcon } from "@/content/lessons";
import { cn } from "@/lib/utils";

const ICONS: Record<LessonIcon, typeof BookOpen> = {
  download: Download,
  book: BookOpen,
  puzzle: Puzzle,
  plug: Plug,
  wrench: Wrench,
  sparkles: Sparkles,
};

export const LessonIndex = () => {
  const preWork = lessons.filter((l) => l.kind === "pre-work");
  const main = lessons.filter((l) => l.kind === "lesson");

  return (
    <main className="min-h-svh px-4 sm:px-6 pt-24 pb-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-accent text-sm font-medium mb-2">Claude Code Workshop</p>
          <p className="uppercase tracking-widest text-xs text-muted-foreground mb-6">
            Vibe Coding Incubator
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-3">
            Choose a Lesson
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Pick up where you left off or start a new lesson.
          </p>
        </div>

        <div className="space-y-4">
          {preWork.map((l) => (
            <LessonCard key={l.slug} lesson={l} highlighted />
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {main.map((l) => (
              <LessonCard key={l.slug} lesson={l} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

const LessonCard = ({ lesson, highlighted }: { lesson: Lesson; highlighted?: boolean }) => {
  const Icon = ICONS[lesson.icon];
  const eyebrow =
    lesson.kind === "pre-work"
      ? "PRE-WORK"
      : `LESSON ${lesson.number} OF ${TOTAL_LESSONS}`;
  return (
    <Link
      to={`/lessons/${lesson.slug}`}
      className={cn(
        "block rounded-2xl border p-5 sm:p-6 transition-all hover:border-accent hover:shadow-card",
        highlighted
          ? "bg-card border-accent/30 ring-1 ring-accent/20"
          : "bg-card border-border"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
            highlighted ? "bg-accent-soft text-accent" : "bg-secondary text-foreground"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold tracking-wider mb-1",
              highlighted ? "text-accent" : "text-muted-foreground"
            )}
          >
            {eyebrow}
          </p>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground mb-1.5">
            {lesson.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{lesson.summary}</p>
        </div>
      </div>
    </Link>
  );
};
