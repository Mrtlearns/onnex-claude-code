import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ANIMATION_MAP = {
  "fade-in-up": "animate-fade-in-up",
  "fade-in": "animate-fade-in",
  "scale-in": "animate-scale-in",
} as const;

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animation?: keyof typeof ANIMATION_MAP;
}

export function AnimateIn({ children, className, delay = 0, animation = "fade-in-up" }: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        visible ? ANIMATION_MAP[animation] : "opacity-0",
        className
      )}
      style={{ animationDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

/** Wraps children with staggered AnimateIn. Each direct child gets a delay offset. */
export function StaggerIn({
  children,
  className,
  stagger = 80,
  animation = "fade-in-up",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  animation?: AnimateInProps["animation"];
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) => (
        <AnimateIn key={i} delay={i * stagger} animation={animation}>
          {child}
        </AnimateIn>
      ))}
    </div>
  );
}
