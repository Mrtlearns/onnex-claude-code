import HeroHeader from "./HeroHeader";
import { CurrentRadarChart, ComparisonRadarChart } from "./RadarCharts";
import DimensionScoreCards from "./DimensionScoreCards";
import GapAnalysisTable from "./GapAnalysisTable";
import IndustryBenchmark from "./IndustryBenchmark";
import { TransformationNarrative, RecommendedNextSteps } from "./NarrativeAndSteps";
import ReportFooter from "./ReportFooter";
import type { ReportData } from "@/types";

interface Props {
  report: ReportData;
}

const ClientReport = ({ report }: Props) => {
  return (
    <div className="space-y-8">
      <HeroHeader report={report} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CurrentRadarChart scores={report.dimensionScores} industry={report.industry} />
        <ComparisonRadarChart scores={report.dimensionScores} gaps={report.gapAnalysis} />
      </div>

      <DimensionScoreCards scores={report.dimensionScores} />
      <GapAnalysisTable gaps={report.gapAnalysis} />
      <IndustryBenchmark scores={report.dimensionScores} industry={report.industry} />
      <TransformationNarrative scores={report.dimensionScores} orgName={report.orgName} industry={report.industry} />
      <RecommendedNextSteps gaps={report.gapAnalysis} />
      <ReportFooter report={report} />
    </div>
  );
};

export default ClientReport;
