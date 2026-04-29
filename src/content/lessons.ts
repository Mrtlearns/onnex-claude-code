import type { OS } from "@/context/OSContext";

/**
 * Lesson content lives here. Edit freely.
 *
 * - `summary` and `title` are short and shown on the lesson index.
 * - `body` is the long-form lesson content. It accepts an object keyed by OS,
 *   or a single string if the lesson is OS-agnostic.
 * - Markdown is supported in `body` (rendered with react-markdown).
 */

export type LessonKind = "pre-work" | "lesson";
export type LessonIcon = "download" | "book" | "puzzle" | "plug" | "wrench" | "sparkles";

export type LessonBody = string | Partial<Record<OS, string>>;

export interface Lesson {
  slug: string;
  kind: LessonKind;
  /** Lesson number for "LESSON N OF 12"; null for pre-work. */
  number: number | null;
  icon: LessonIcon;
  title: string;
  summary: string;
  body: LessonBody;
}

export const TOTAL_LESSONS = 12;

export const lessons: Lesson[] = [
  {
    slug: "getting-ready",
    kind: "pre-work",
    number: null,
    icon: "download",
    title: "Getting Ready",
    summary:
      "Install Claude Desktop, learn essential shortcuts, and get comfortable with the terminal before diving in.",
    body: {
      mac: `# Getting Ready (macOS)\n\nWrite the pre-work content here. The shell, design and routing are already wired — this file is the only thing you need to edit to publish a lesson.`,
      windows: `# Getting Ready (Windows)\n\nWrite the pre-work content here.`,
      linux: `# Getting Ready (Linux)\n\nWrite the pre-work content here.`,
    },
  },
  {
    slug: "installing-claude-code",
    kind: "lesson",
    number: 1,
    icon: "download",
    title: "Installing Claude Code",
    summary: "Get your AI coding assistant set up and ready for Lesson 2.",
    body: {
      mac: `# Installing Claude Code\n\nLesson body goes here.`,
      windows: `# Installing Claude Code\n\nLesson body goes here.`,
      linux: `# Installing Claude Code\n\nLesson body goes here.`,
    },
  },
  {
    slug: "claude-md-playbook",
    kind: "lesson",
    number: 2,
    icon: "book",
    title: "The CLAUDE.md Playbook",
    summary: "Give Claude persistent memory. Stop repeating yourself every session.",
    body: `# The CLAUDE.md Playbook\n\nLesson body goes here.`,
  },
  {
    slug: "skills-portable-ai-expertise",
    kind: "lesson",
    number: 3,
    icon: "puzzle",
    title: "Skills: Portable AI Expertise",
    summary:
      "Install and create skills — portable AI expertise that follows you across projects.",
    body: `# Skills: Portable AI Expertise\n\nLesson body goes here.`,
  },
  {
    slug: "mcp-servers-and-tool-connections",
    kind: "lesson",
    number: 4,
    icon: "plug",
    title: "MCP Servers & Tool Connections",
    summary: "Connect Claude Code to the outside world with MCP servers.",
    body: `# MCP Servers & Tool Connections\n\nLesson body goes here.`,
  },
  {
    slug: "building-your-first-project",
    kind: "lesson",
    number: 5,
    icon: "wrench",
    title: "Building Your First Project",
    summary: "Build something real, end-to-end, to lock in everything you've learned.",
    body: `# Building Your First Project\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-6",
    kind: "lesson",
    number: 6,
    icon: "book",
    title: "Lesson 6",
    summary: "Short summary for Lesson 6.",
    body: `# Lesson 6\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-7",
    kind: "lesson",
    number: 7,
    icon: "book",
    title: "Lesson 7",
    summary: "Short summary for Lesson 7.",
    body: `# Lesson 7\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-8",
    kind: "lesson",
    number: 8,
    icon: "book",
    title: "Lesson 8",
    summary: "Short summary for Lesson 8.",
    body: `# Lesson 8\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-9",
    kind: "lesson",
    number: 9,
    icon: "book",
    title: "Lesson 9",
    summary: "Short summary for Lesson 9.",
    body: `# Lesson 9\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-10",
    kind: "lesson",
    number: 10,
    icon: "book",
    title: "Lesson 10",
    summary: "Short summary for Lesson 10.",
    body: `# Lesson 10\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-11",
    kind: "lesson",
    number: 11,
    icon: "book",
    title: "Lesson 11",
    summary: "Short summary for Lesson 11.",
    body: `# Lesson 11\n\nLesson body goes here.`,
  },
  {
    slug: "lesson-12",
    kind: "lesson",
    number: 12,
    icon: "sparkles",
    title: "Lesson 12",
    summary: "Short summary for Lesson 12.",
    body: `# Lesson 12\n\nLesson body goes here.`,
  },
];

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);

export const bodyFor = (body: LessonBody, os: OS): string => {
  if (typeof body === "string") return body;
  return body[os] ?? body.mac ?? body.linux ?? body.windows ?? "";
};
