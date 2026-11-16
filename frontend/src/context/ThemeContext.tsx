import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('itam_theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    // first visit: follow the device setting
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('itam_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    // animate colours only during the switch (a permanent global transition makes every interaction sluggish)
    const root = document.documentElement;
    root.classList.add('theme-switching');
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    window.setTimeout(() => root.classList.remove('theme-switching'), 300);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
