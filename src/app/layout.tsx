import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import Navbar from '@/components/layout/navbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Navbar />
          {/* Offset content below sticky navbar (h-14 = 3.5rem) */}
          <main className="pt-14 min-h-[calc(100vh-3.5rem)] bg-white text-gray-900 dark:bg-neutral-950 dark:text-gray-100">{children}</main>
          <footer className="border-t text-xs text-gray-500 dark:text-gray-400 dark:border-neutral-800 py-4 px-4">© {new Date().getFullYear()} Oh My Girl</footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
