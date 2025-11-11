import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    // Ensure wallet row exists
    let { data: wallet, error: wErr } = await supabase
      .from('wallet')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (wErr || !wallet) {
      const { data: created, error: cErr } = await supabase
        .from('wallet')
        .insert({ user_id: user.id, balance_microcredits: 0 })
        .select('*')
        .single()
      if (cErr) return NextResponse.json({ success: false, message: 'Failed to initialize wallet' }, { status: 500 })
      wallet = created
    }

    // Recent transactions
    const { data: txns, error: tErr } = await supabase
      .from('wallet_txn')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (tErr) return NextResponse.json({ success: false, message: 'Failed to load transactions' }, { status: 500 })

    return NextResponse.json({ success: true, data: { wallet, transactions: txns || [] } })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}

