import { useEffect, useState } from "react";
import { resolveMarkdownImages } from "@/lib/imageStore";

/** Returns markdown with any `lov-img://<id>` refs swapped for blob URLs. */
export const useResolvedMarkdown = (md: string): string => {
  const [out, setOut] = useState(md);
  useEffect(() => {
    let cancelled = false;
    resolveMarkdownImages(md).then((resolved) => {
      if (!cancelled) setOut(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [md]);
  return out;
};
