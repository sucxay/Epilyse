import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        mist: "#f5f7fa",
        accent: "#e15c3b",
      },
      boxShadow: {
        panel: "0 10px 35px rgba(25, 38, 51, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
