module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        "primary-foreground": "#fff",
        secondary: "#64748b",
        "secondary-foreground": "#fff",
        muted: "#f3f4f6",
        "muted-foreground": "#6b7280",
      },
    },
  },
  safelist: [
    "border-primary",
    "bg-primary",
    "bg-primary-hover",
    "text-primary-foreground",
    "bg-secondary",
    "bg-secondary/80",
    "text-secondary-foreground",
    "text-muted-foreground",
    "text-secondary",
    "text-md",
    "bg-muted",
    "text",
    "keychainify-checked",
  ],
  plugins: [],
};
