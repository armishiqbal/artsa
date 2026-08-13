/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Brand ──────────────────────────────────────────────── */
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          subtle: "hsl(var(--brand-subtle))",
          muted: "hsl(var(--brand-muted))",
          ring: "hsl(var(--brand-ring))",
        },

        /* ── Surface ─────────────────────────────────────────────── */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /* ── Interactive ─────────────────────────────────────────── */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle: "hsl(var(--destructive-subtle))",
          border: "hsl(var(--destructive-border))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* ── Severity ────────────────────────────────────────────── */
        severity: {
          critical: "hsl(var(--severity-critical))",
          "critical-subtle": "hsl(var(--severity-critical-subtle))",
          "critical-border": "hsl(var(--severity-critical-border))",
          high: "hsl(var(--severity-high))",
          "high-subtle": "hsl(var(--severity-high-subtle))",
          "high-border": "hsl(var(--severity-high-border))",
          medium: "hsl(var(--severity-medium))",
          "medium-subtle": "hsl(var(--severity-medium-subtle))",
          "medium-border": "hsl(var(--severity-medium-border))",
          low: "hsl(var(--severity-low))",
          "low-subtle": "hsl(var(--severity-low-subtle))",
          "low-border": "hsl(var(--severity-low-border))",
          info: "hsl(var(--severity-info))",
          "info-subtle": "hsl(var(--severity-info-subtle))",
          "info-border": "hsl(var(--severity-info-border))",
        },

        /* ── Status ──────────────────────────────────────────────── */
        status: {
          success: "hsl(var(--status-success))",
          "success-subtle": "hsl(var(--status-success-subtle))",
          "success-border": "hsl(var(--status-success-border))",
          warning: "hsl(var(--status-warning))",
          "warning-subtle": "hsl(var(--status-warning-subtle))",
          "warning-border": "hsl(var(--status-warning-border))",
          error: "hsl(var(--status-error))",
          "error-subtle": "hsl(var(--status-error-subtle))",
          "error-border": "hsl(var(--status-error-border))",
        },

        /* ── Chart ───────────────────────────────────────────────── */
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },

      boxShadow: {
        glow: "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
        "glow-lg": "var(--shadow-glow-lg)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "brand-pulse": {
          "0%, 100%": { boxShadow: "var(--shadow-glow)" },
          "50%": { boxShadow: "var(--shadow-glow-lg)" },
        },
      },

      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        shimmer: "shimmer 2s infinite",
        "brand-pulse": "brand-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
