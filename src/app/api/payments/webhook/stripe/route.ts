import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return new NextResponse('Webhook not configured', { status: 500 })
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' })
    const raw = await request.text()
    const event = stripe.webhooks.constructEvent(raw, sig, secret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const creditsStr = session.metadata?.credits_micro
      const requestId = session.id
      if (!userId || !creditsStr) return NextResponse.json({ ok: true })
      const creditsMicro = parseInt(creditsStr, 10)
      if (!Number.isFinite(creditsMicro) || creditsMicro <= 0) return NextResponse.json({ ok: true })

      // Idempotency: if wallet_txn with this request_id exists, skip
      const { data: existing } = await supabase
        .from('wallet_txn')
        .select('id')
        .eq('user_id', userId)
        .eq('request_id', requestId)
        .maybeSingle()
      if (existing) return NextResponse.json({ ok: true })

      // Update wallet
      let { data: wallet } = await supabase
        .from('wallet')
        .select('balance_microcredits')
        .eq('user_id', userId)
        .maybeSingle()
      if (!wallet) {
        const created = await supabase
          .from('wallet')
          .insert({ user_id: userId, balance_microcredits: 0 })
          .select('balance_microcredits')
          .single()
        wallet = created.data || { balance_microcredits: 0 }
      }
      const newBal = (wallet.balance_microcredits || 0) + creditsMicro
      await supabase
        .from('wallet')
        .update({ balance_microcredits: newBal, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      await supabase
        .from('wallet_txn')
        .insert({ user_id: userId, kind: 'topup', amount_microcredits: creditsMicro, balance_microcredits: newBal, request_id: requestId, note: 'Stripe top-up' })
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}

