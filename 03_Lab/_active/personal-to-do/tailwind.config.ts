import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        fresh: "#4ade80",
        aging: "#facc15",
        urgent: "#f97316",
        catchall: "#94a3b8",
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
