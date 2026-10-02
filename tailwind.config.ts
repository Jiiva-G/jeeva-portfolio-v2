import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        ink: token("ink"),
        muted: token("muted"),
        accent: { DEFAULT: token("accent"), bright: token("accent-bright") },
        line: { DEFAULT: "rgb(var(--line) / 0.1)", strong: "rgb(var(--line) / 0.2)" },
      },
    },
  },
  plugins: [],
} satisfies Config;
