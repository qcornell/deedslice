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
          bg: "#F6F9FC",
          card: "#ffffff",
          border: "#E3E8EF",
          "border-light": "#EEF1F6",
          accent: "#0ab4aa",
          "accent-hover": "#089991",
          "accent-light": "#F0FDFA",
          "accent-text": "#0D9488",
          "accent-dim": "rgba(13,148,136,0.06)",
          navy: "#1a2332",
          "navy-light": "#2d3b4e",
          orange: "#e17055",
          green: "#0ACF83",
          red: "#DF1B41",
          muted: "#8792A2",
          text: "#1A1F36",
          "text-secondary": "#697386",
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
