import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripeSecret = process.env.STRIPE_SECRET_KEY as string
if (!stripeSecret) {
  console.warn('STRIPE_SECRET_KEY is not set; payments will not work.')
}
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' }) : (null as any)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    if (!stripe) return NextResponse.json({ success: false, message: 'Stripe not configured' }, { status: 500 })
    const body = await request.json()
    const { amount_usd, amount_lkr, credits } = body || {}

    // Authenticate user
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = auth.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    // Compute target USD and credits (microcredits)
    const USD_TO_LKR = 320
    const MICROCREDITS_PER_LKR = 1_000_000

    let usd = 0
    if (typeof amount_usd === 'number' && amount_usd > 0) usd = amount_usd
    else if (typeof amount_lkr === 'number' && amount_lkr > 0) usd = amount_lkr / USD_TO_LKR
    else if (typeof credits === 'number' && credits > 0) usd = (credits / MICROCREDITS_PER_LKR) / USD_TO_LKR

    usd = Math.max(1, Math.round(usd * 100) / 100) // min $1, 2 decimals
    const unitAmountCents = Math.round(usd * 100)
    const creditsMicro = Math.round(usd * USD_TO_LKR * MICROCREDITS_PER_LKR)

    const origin = request.headers.get('origin') || ''
    const successUrl = origin ? `${origin}/wallet?success=1` : 'https://example.com'
    const cancelUrl = origin ? `${origin}/wallet?canceled=1` : 'https://example.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Oh My Girl Credits' },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        credits_micro: String(creditsMicro),
      },
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create checkout session' }, { status: 500 })
  }
}

