'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ui/theme-provider'
import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase-browser'

const items = [
  { name: 'Home', href: '/' },
  { name: 'Chat', href: '/chat' },
  { name: 'Stories', href: '/stories' },
  { name: 'Library', href: '/library' },
  { name: 'Wallet', href: '/wallet' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [signedIn, setSignedIn] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSignedIn(!!data.session)
    }).catch(() => setSignedIn(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session))
    return () => { mounted = false; sub?.subscription?.unsubscribe() }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Oh My Girl</Link>
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {items.map(it => (
            <Link
              key={it.href}
              href={it.href}
              className={`px-3 py-1.5 rounded-md border ${pathname === it.href ? 'border-black' : 'border-transparent hover:border-gray-300'}`}
            >
              {it.name}
            </Link>
          ))}
          <button onClick={toggleTheme} className="ml-2 px-3 py-1.5 rounded-md border hover:border-gray-300">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {signedIn ? (
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
              className="px-3 py-1.5 rounded-md border hover:border-gray-300"
            >
              Sign out
            </button>
          ) : (
            <>
              <Link href="/auth/signin" className="px-3 py-1.5 rounded-md border hover:border-gray-300">Sign in</Link>
              <Link href="/auth/signup" className="px-3 py-1.5 rounded-md border hover:border-gray-300">Sign up</Link>
            </>
          )}
        </nav>
        <div className="md:hidden">
          <button onClick={() => setMobileOpen(v => !v)} className="px-3 py-1.5 rounded-md border hover:border-gray-300">Menu</button>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="px-3 py-1.5 rounded-md border text-sm">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {items.map(it => (
                <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded-md border ${pathname === it.href ? 'border-black' : 'hover:border-gray-300'}`}>{it.name}</Link>
              ))}
            </div>
            <div className="pt-2 border-t">
              {signedIn ? (
                <button
                  onClick={async () => { await supabase.auth.signOut(); setMobileOpen(false); window.location.href = '/' }}
                  className="w-full px-3 py-2 rounded-md border text-sm"
                >Sign out</button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/auth/signin" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md border text-center text-sm">Sign in</Link>
                  <Link href="/auth/signup" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md border text-center text-sm">Sign up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
