'use client'

import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext<{ theme: 'light' | 'dark'; toggleTheme: () => void }>({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }

