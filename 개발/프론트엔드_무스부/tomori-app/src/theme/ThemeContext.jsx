import React, { createContext, useContext } from 'react';
import { getTheme } from './tokens';

const ThemeContext = createContext({ t: getTheme('light'), mode: 'light' });

export function ThemeProvider({ mode, children }) {
  const t = getTheme(mode);
  return <ThemeContext.Provider value={{ t, mode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
