import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendDataPoint {
  version: string;
  scores: Record<string, number>;
}

interface Props {
  data: TrendDataPoint[];
}

const COLORS = [
  "hsl(174, 100%, 35%)",   // teal
  "hsl(217, 72%, 45%)",    // navy-light
  "hsl(41, 100%, 47%)",    // gold
  "hsl(142, 71%, 45%)",    // success
  "hsl(0, 84%, 60%)",      // danger
  "hsl(38, 92%, 50%)",     // warning
  "hsl(262, 83%, 58%)",    // purple
  "hsl(199, 89%, 48%)",    // blue
];

const TrendChart = ({ data }: Props) => {
  if (data.length < 2) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
        <p className="text-muted-foreground text-sm py-8">
          At least 2 evaluation cycles are required to show trends.
        </p>
      </div>
    );
  }

  const dimensions = Object.keys(data[0].scores);
  const chartData = data.map((d) => ({
    version: d.version,
    ...d.scores,
  }));

  return (
    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
      <h3 className="text-xl font-display font-bold text-foreground mb-1">
        Score Trends Across Evaluations
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tracking maturity progression over time
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="version"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 5]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickCount={6}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              fontSize: 13,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          {dimensions.map((dim, i) => (
            <Line
              key={dim}
              type="monotone"
              dataKey={dim}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS[i % COLORS.length] }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
