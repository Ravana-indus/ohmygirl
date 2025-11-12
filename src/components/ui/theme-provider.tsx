'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext<{ theme: 'light' | 'dark'; toggleTheme: () => void }>({ theme: 'dark', toggleTheme: () => {} })

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved === 'light' || saved === 'dark') return saved
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme())

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.toggle('dark', theme === 'dark')
      window.localStorage.setItem('theme', theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
