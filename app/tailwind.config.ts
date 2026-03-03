import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ds: {
          bg: "#f8fafc",
          card: "#ffffff",
          border: "#d8dce3",
          "border-light": "#e8ebf0",
          accent: "#0D9488",
          "accent-hover": "#0F766E",
          "accent-light": "#F0FDFA",       // bg tint only — never use as text!
          "accent-text": "#0D9488",         // readable teal for text on light bg
          "accent-dim": "rgba(13,148,136,0.06)",
          navy: "#0F172A",
          "navy-light": "#1E293B",
          orange: "#e17055",
          green: "#22C55E",
          red: "#EF4444",
          muted: "#94A3B8",
          text: "#0F172A",
          "text-secondary": "#475569",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
