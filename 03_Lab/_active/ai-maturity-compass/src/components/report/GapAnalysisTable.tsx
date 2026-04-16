import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMaturityStage } from "@/lib/mock-data";
import type { GapAnalysisItem } from "@/types";

interface Props {
  gaps: GapAnalysisItem[];
}

const priorityClasses: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const GapAnalysisTable = ({ gaps }: Props) => {
  return (
    <div>
      <h3 className="text-xl font-display font-bold text-foreground mb-5">
        Gap Analysis
      </h3>
      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary">
              <TableHead className="text-primary-foreground font-display">Dimension</TableHead>
              <TableHead className="text-primary-foreground font-display text-center">Current</TableHead>
              <TableHead className="text-primary-foreground font-display text-center">Stage</TableHead>
              <TableHead className="text-primary-foreground font-display text-center">Target</TableHead>
              <TableHead className="text-primary-foreground font-display text-center">Gap</TableHead>
              <TableHead className="text-primary-foreground font-display text-center">Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((g, i) => (
              <TableRow key={g.dimension} className={i % 2 === 0 ? "bg-card" : "bg-secondary/30"}>
                <TableCell className="font-medium">{g.dimension}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-10 h-7 rounded-md bg-accent/15 text-accent font-bold text-sm">
                    {g.current.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {getMaturityStage(g.current)}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-10 h-7 rounded-md bg-accent/15 text-accent font-bold text-sm">
                    {g.target.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center font-medium">{g.gap.toFixed(1)}</TableCell>
                <TableCell className="text-center">
                  <Badge className={`border font-semibold hover:opacity-100 ${priorityClasses[g.priority]}`}>
                    {g.priority}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default GapAnalysisTable;
