import { useEffect, useState } from "react";

const THEME_KEY = "theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // Set theme on mount
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (saved === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      // Default: use system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    if (isDark) {
      localStorage.setItem(THEME_KEY, "light");
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      localStorage.setItem(THEME_KEY, "dark");
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="bg-muted rounded-full border border-gray-300 p-2 transition-colors dark:border-gray-600 dark:bg-gray-800"
      style={{ fontSize: 20 }}
    >
      {isDark ? "🌙" : "🔆"}
    </button>
  );
}
