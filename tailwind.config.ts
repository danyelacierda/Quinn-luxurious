import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        ivory: "#FFFCF7",
        paper: "#FBF6EF",
        "paper-dim": "#F4ECE0",
        cream: "#F6EEE1",
        beige: "#E7DECB",
        blush: "#E7C7C2",
        rose: {
          DEFAULT: "#D9A7A0",
          light: "#E7C7C2",
          dark: "#B6837B",
        },
        gold: {
          DEFAULT: "#B6874F",
          light: "#E8D3B3",
          pale: "#E8D3B3",
          dark: "#8C6339",
        },
        ink: {
          DEFAULT: "#1C1613",
          soft: "#4A413B",
        },
        border: "#E7DECB",
        background: "#FBF6EF",
        foreground: "#1C1613",
        primary: {
          DEFAULT: "#B6874F",
          foreground: "#FBF6EF",
        },
        secondary: {
          DEFAULT: "#E7C7C2",
          foreground: "#1C1613",
        },
        muted: {
          DEFAULT: "#F4ECE0",
          foreground: "#4A413B",
        },
        accent: {
          DEFAULT: "#D9A7A0",
          foreground: "#FBF6EF",
        },
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "serif"],
        body: ["var(--font-jost)", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(28, 22, 19, 0.08)",
        card: "0 20px 45px -12px rgba(182, 135, 79, 0.20), 0 8px 16px -8px rgba(28,22,19,0.06)",
        gold: "0 10px 30px -8px rgba(182, 135, 79, 0.45)",
        signature: "0 20px 45px -25px rgba(28,22,19,0.35)",
      },
      transitionTimingFunction: {
        signature: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out forwards",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
