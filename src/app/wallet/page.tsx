"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import supabase from '@/lib/supabase-browser'
import { CreditPackages } from '@/components/wallet/packages'

interface WalletRow { id: string; user_id: string; balance_microcredits: number; created_at?: string; updated_at?: string }
interface WalletTxn { id: string; user_id: string; kind: string; amount_microcredits: number; balance_microcredits: number; request_id?: string | null; note?: string | null; created_at: string }

export default function WalletPage() {
  const search = useSearchParams()
  const [wallet, setWallet] = useState<WalletRow | null>(null)
  const [txns, setTxns] = useState<WalletTxn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topupUSD, setTopupUSD] = useState<number>(10)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in to view your wallet.')
      const res = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load wallet')
      setWallet(json.data.wallet)
      setTxns(json.data.transactions || [])
    } catch (e: any) { setError(e?.message || 'Failed to load wallet') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const ok = search?.get('success') === '1'
    const canceled = search?.get('canceled') === '1'
    if (ok) setNotice('Payment successful. Credits will reflect shortly.')
    else if (canceled) setNotice('Checkout canceled.')
  }, [search])

  const balanceLKR = wallet ? wallet.balance_microcredits / 1_000_000 : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <button onClick={load} className="px-3 py-2 rounded-md border text-sm">Refresh</button>
      </div>

      {notice && (
        <div className="text-sm border rounded-md p-3 bg-green-50 border-green-200 text-green-800">
          {notice}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          <section className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Balance</h2>
            <div className="text-3xl font-bold">LKR {balanceLKR.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-gray-500">{wallet?.balance_microcredits?.toLocaleString()} microcredits</p>
          </section>

          <section className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Top up</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm">Amount (USD)</label>
              <input type="number" min={1} step="1" value={topupUSD} onChange={(e) => setTopupUSD(parseInt(e.target.value || '0'))} className="w-28 border rounded-md p-2 text-sm" />
              <button className="px-3 py-2 rounded-md border text-sm" onClick={async () => {
                try {
                  const { data: session } = await supabase.auth.getSession()
                  const token = session.session?.access_token
                  if (!token) throw new Error('Please sign in to top up.')
                  const res = await fetch('/api/payments/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount_usd: Math.max(1, topupUSD||0) }) })
                  const json = await res.json()
                  if (!res.ok || !json.success || !json.url) throw new Error(json.message || 'Failed to start checkout')
                  window.location.href = json.url
                } catch (e: any) { alert(e?.message || 'Failed to start checkout') }
              }}>Pay with Stripe</button>
              <p className="text-xs text-gray-500">Credits added after payment. Rate: $1 ≈ LKR 320.</p>
            </div>
            <div className="mt-4">
              <CreditPackages compact />
            </div>
          </section>

          <section className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Transactions</h2>
              <span className="text-xs text-gray-500">Latest 100</span>
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-gray-500">No transactions yet.</p>
            ) : (
              <div className="divide-y">
                {txns.map((t) => (
                  <div key={t.id} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {formatKind(t.kind)} {t.request_id ? <span className="text-gray-400">· {t.request_id.slice(0,8)}</span> : null}
                      </div>
                      {t.note && <div className="text-gray-500 truncate">{t.note}</div>}
                      <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-right sm:w-40">
                      <div className={t.amount_microcredits >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {t.amount_microcredits >= 0 ? '+' : ''}{(t.amount_microcredits / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} LKR
                      </div>
                      <div className="text-xs text-gray-500">bal {(t.balance_microcredits / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} LKR</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function formatKind(kind: string) {
  switch (kind) {
    case 'escrow_hold': return 'Escrow hold'
    case 'escrow_release': return 'Escrow release'
    case 'topup': return 'Top-up'
    case 'purchase': return 'Purchase'
    default: return kind
  }
}
