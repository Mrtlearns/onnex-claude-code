import { Badge } from "@/components/ui/badge";
import { getMaturityBadgeClasses } from "@/lib/mock-data";
import type { ReportData } from "@/types";

interface HeroHeaderProps {
  report: ReportData;
}

const HeroHeader = ({ report }: HeroHeaderProps) => {
  return (
    <div className="gradient-navy rounded-2xl p-8 md:p-12 text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-accent blur-3xl" />
        <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-gold blur-3xl" />
      </div>
      <div className="relative z-10">
        <p className="text-sm uppercase tracking-widest text-primary-foreground/50 mb-2">
          AI Maturity Assessment Report
        </p>
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
          {report.orgName}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span className="text-accent font-medium">{report.versionLabel}</span>
          <span className="text-primary-foreground/40">•</span>
          <span className="text-primary-foreground/70">
            {new Date(report.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p className="text-sm text-primary-foreground/50 mb-1">Overall Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-display font-black text-gold">
                {report.overallScore.toFixed(1)}
              </span>
              <span className="text-2xl text-primary-foreground/40 font-display">/ 5.0</span>
            </div>
          </div>

          <div className="mb-2">
            <Badge className={`text-sm px-3 py-1 border font-semibold ${getMaturityBadgeClasses(report.maturityStage)}`}>
              {report.maturityStage}
            </Badge>
          </div>

          <div className="mb-2 text-sm text-primary-foreground/60">
            {report.respondentCount} respondents
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroHeader;
