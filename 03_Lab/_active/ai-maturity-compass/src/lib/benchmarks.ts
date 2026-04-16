import { DIMENSIONS } from "@/config/questions";

export const INDUSTRY_BENCHMARKS: Record<string, Record<string, number>> = {
  "Financial Services": {
    "Strategy & Vision": 3.4,
    "Leadership & Culture": 3.1,
    "Current AI Usage": 2.9,
    "Skills & Talent": 2.5,
    "Data & Infrastructure": 3.8,
    "Governance & Ethics": 3.6,
    "Process & Integration": 2.8,
    "Innovation & Scaling": 2.3,
  },
  "Healthcare": {
    "Strategy & Vision": 2.8,
    "Leadership & Culture": 2.6,
    "Current AI Usage": 2.4,
    "Skills & Talent": 2.2,
    "Data & Infrastructure": 3.2,
    "Governance & Ethics": 3.4,
    "Process & Integration": 2.3,
    "Innovation & Scaling": 2.0,
  },
  "Technology": {
    "Strategy & Vision": 4.1,
    "Leadership & Culture": 3.8,
    "Current AI Usage": 3.9,
    "Skills & Talent": 3.6,
    "Data & Infrastructure": 4.2,
    "Governance & Ethics": 3.2,
    "Process & Integration": 3.5,
    "Innovation & Scaling": 3.7,
  },
  "Retail": {
    "Strategy & Vision": 2.9,
    "Leadership & Culture": 2.7,
    "Current AI Usage": 2.6,
    "Skills & Talent": 2.3,
    "Data & Infrastructure": 3.0,
    "Governance & Ethics": 2.5,
    "Process & Integration": 2.8,
    "Innovation & Scaling": 2.4,
  },
  "Energy": {
    "Strategy & Vision": 2.7,
    "Leadership & Culture": 2.5,
    "Current AI Usage": 2.2,
    "Skills & Talent": 2.1,
    "Data & Infrastructure": 3.1,
    "Governance & Ethics": 3.0,
    "Process & Integration": 2.4,
    "Innovation & Scaling": 1.9,
  },
};

const industryAliases: Record<string, string> = {
  "finance": "Financial Services",
  "financial": "Financial Services",
  "banking": "Financial Services",
  "fintech": "Financial Services",
  "health": "Healthcare",
  "medical": "Healthcare",
  "pharma": "Healthcare",
  "tech": "Technology",
  "software": "Technology",
  "it": "Technology",
  "ecommerce": "Retail",
  "e-commerce": "Retail",
  "oil": "Energy",
  "utilities": "Energy",
  "power": "Energy",
};

export function getIndustryBenchmark(industry: string): Record<string, number> | null {
  // Direct match
  if (INDUSTRY_BENCHMARKS[industry]) return INDUSTRY_BENCHMARKS[industry];

  // Fuzzy match
  const lower = industry.toLowerCase();
  for (const [alias, canonical] of Object.entries(industryAliases)) {
    if (lower.includes(alias)) return INDUSTRY_BENCHMARKS[canonical];
  }

  // Partial match on keys
  for (const key of Object.keys(INDUSTRY_BENCHMARKS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return INDUSTRY_BENCHMARKS[key];
    }
  }

  return null;
}

export function getIndustryName(industry: string): string {
  if (INDUSTRY_BENCHMARKS[industry]) return industry;
  const lower = industry.toLowerCase();
  for (const [alias, canonical] of Object.entries(industryAliases)) {
    if (lower.includes(alias)) return canonical;
  }
  for (const key of Object.keys(INDUSTRY_BENCHMARKS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return key;
  }
  return industry;
}

export function estimatePercentile(orgAvg: number, industryBenchmark: Record<string, number>): number {
  const industryAvg = Object.values(industryBenchmark).reduce((a, b) => a + b, 0) / DIMENSIONS.length;
  const diff = orgAvg - industryAvg;
  // Rough percentile estimation: each 0.5 points ≈ 15 percentile points from 50th
  const percentile = Math.round(50 + diff * 30);
  return Math.max(5, Math.min(95, percentile));
}
