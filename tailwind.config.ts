import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        moss: "#4f6b57",
        trail: "#e8dece",
        clay: "#b4573f",
        skyglass: "#d8efea",
        oat: "#f6f0e7",
        fog: "#eef3ef",
        plum: "#5a4356"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(37, 42, 36, 0.08)",
        soft: "0 1px 0 rgba(255, 255, 255, 0.75) inset, 0 16px 40px rgba(23, 32, 28, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
