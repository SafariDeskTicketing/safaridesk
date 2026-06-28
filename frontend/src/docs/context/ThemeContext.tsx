import React from 'react';
import { useUIStore } from '../../stores/uiStore';

type ThemeValue = {
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
};

export const useTheme = (): ThemeValue => {
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  return { theme, toggleTheme };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
