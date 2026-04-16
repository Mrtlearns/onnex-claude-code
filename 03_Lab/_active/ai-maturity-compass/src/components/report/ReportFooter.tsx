import type { ReportData } from "@/types";

interface Props {
  report: ReportData;
}

const ReportFooter = ({ report }: Props) => {
  return (
    <div className="bg-secondary/50 rounded-2xl p-8 mt-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium border border-border">
            Your Logo
          </div>
          <div>
            <p className="font-display font-bold text-foreground">
              Powered by Your Agency
            </p>
            <p className="text-sm text-muted-foreground">
              AI Maturity Assessment Platform
            </p>
          </div>
        </div>
        <div className="text-center md:text-right text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Confidential — Prepared exclusively for {report.orgName}
          </p>
          <p>{report.versionLabel} • {new Date(report.date).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default ReportFooter;
