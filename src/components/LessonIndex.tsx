import { Link } from "react-router-dom";
import { BookOpen, Download, Plug, Puzzle, Sparkles, Wrench } from "lucide-react";
import { TOTAL_LESSONS, type Lesson, type LessonIcon } from "@/content/lessons";
import { useLessons } from "@/content/contentStore";
import { BRAND } from "@/lib/brand";
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
  const lessons = useLessons();
  const preWork = lessons.filter((l) => l.kind === "pre-work");
  const main = lessons.filter((l) => l.kind === "lesson");

  return (
    <main className="min-h-svh px-4 sm:px-6 pt-24 pb-20 bg-foreground text-background">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-accent text-sm font-medium mb-2">Claude Code Workshop</p>
          <p className="uppercase tracking-widest text-xs text-background/60 mb-6">
            {BRAND.name}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-background mb-3">
            Choose a Lesson
          </h1>
          <p className="text-background/70 text-base sm:text-lg">
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
        "block rounded-2xl border p-5 sm:p-6 transition-all hover:border-accent",
        highlighted
          ? "bg-background/[0.04] border-accent/40 ring-1 ring-accent/30"
          : "bg-background/[0.04] border-background/10 hover:bg-background/[0.07]"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
            highlighted ? "bg-accent-soft text-accent" : "bg-background/[0.06] text-background/80"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold tracking-wider mb-1",
              highlighted ? "text-accent" : "text-background/50"
            )}
          >
            {eyebrow}
          </p>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-background mb-1.5">
            {lesson.title}
          </h2>
          <p className="text-sm text-background/60 leading-relaxed">{lesson.summary}</p>
        </div>
      </div>
    </Link>
  );
};
