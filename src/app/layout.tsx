import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import Navbar from '@/components/layout/navbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <footer className="border-t text-xs text-gray-500 py-4 px-4">© {new Date().getFullYear()} Oh My Girl</footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
