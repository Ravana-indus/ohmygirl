'use client'

import { useState } from 'react'
import supabase from '@/lib/supabase-browser'
import Link from 'next/link'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setMessage('Check your email to confirm your account, then sign in.')
    } catch (e: any) {
      setError(e?.message || 'Failed to sign up')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-md p-2" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-md p-2" required />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <button className="w-full border rounded-md p-2 bg-black text-white" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="text-sm">Already have an account? <Link className="underline" href="/auth/signin">Sign in</Link></p>
    </div>
  )
}

