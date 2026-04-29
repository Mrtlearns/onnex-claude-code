import { useEffect, useState } from "react";
import { Cookie, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "vci.cookie";

export const CookieBanner = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  const choose = (v: "accept" | "decline") => {
    localStorage.setItem(KEY, v);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-card border border-border p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="rounded-full bg-accent-soft p-2 mt-0.5">
            <Cookie className="h-4 w-4 text-accent" strokeWidth={2} />
          </div>
          <h2 className="font-sans font-semibold text-base text-foreground">
            Cookie &amp; Analytics Notice
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          We use a single cookie to remember your session across visits so we can understand how
          the course is used — like which lessons are popular and where people get stuck.
        </p>
        <div className="flex items-start gap-2 mb-5 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold text-foreground">Fully anonymous</span> — no personal
            data, no accounts, no third-party trackers. Just a random ID stored in a cookie for up
            to 1 year.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => choose("accept")} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-accent">
            Accept
          </Button>
          <Button variant="outline" onClick={() => choose("decline")}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
};
