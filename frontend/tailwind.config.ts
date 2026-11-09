import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#111318",
        surface: "#161b22",
        "surface-raised": "#1c2128",
        sidebar: "#0d1117",
        accent: "#4f7cff",
        "accent-hover": "#6690ff",
        success: "#3fb950",
        warning: "#d29922",
        danger: "#f85149",
        ink: "#e6edf3",
        muted: "#7d8590",
        "muted-dark": "#484f58",
      },
      borderColor: {
        DEFAULT: "rgba(255, 255, 255, 0.08)",
        subtle: "rgba(255, 255, 255, 0.06)",
        strong: "rgba(255, 255, 255, 0.14)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
