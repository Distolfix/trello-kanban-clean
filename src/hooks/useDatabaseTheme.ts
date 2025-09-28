import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

type Theme = "dark" | "light" | "system";

export function useDatabaseTheme() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Initialize theme from database or localStorage
    const initTheme = async () => {
      try {
        const dbTheme = await apiClient.getSetting('theme');
        if (dbTheme && dbTheme.value) {
          setTheme(dbTheme.value as Theme);
          return;
        }
      } catch {}

      // Fallback to localStorage
      const localTheme = localStorage.getItem("theme") as Theme;
      if (localTheme) {
        setTheme(localTheme);
      }
    };

    initTheme();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const setThemeValue = async (newTheme: Theme) => {
    try {
      // Save to database
      await apiClient.setSetting('theme', newTheme);
      setTheme(newTheme);

      // Also update localStorage for backward compatibility
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
      // Fallback to localStorage only
      localStorage.setItem('theme', newTheme);
      setTheme(newTheme);
    }
  };

  return {
    theme,
    setTheme: setThemeValue,
  };
}