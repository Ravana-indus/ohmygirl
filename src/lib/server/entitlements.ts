import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_TRIAL_DAYS, DEFAULT_TRIAL_PLAN_ID } from '@/lib/constants'

export interface PlanEntitlements {
  max_story_per_day: number
  max_story_minutes: number
  max_rp_turns_per_day: number
  max_rp_characters: number
  max_tokens_per_call: number
}

const PLAN_LIMITS: Record<string, PlanEntitlements> = {
  trial: {
    max_story_per_day: 3,
    max_story_minutes: 5,
    max_rp_turns_per_day: 10,
    max_rp_characters: 1,
    max_tokens_per_call: 800,
  },
  basic: {
    max_story_per_day: 10,
    max_story_minutes: 15,
    max_rp_turns_per_day: 40,
    max_rp_characters: 3,
    max_tokens_per_call: 1200,
  },
  premium: {
    max_story_per_day: -1,
    max_story_minutes: 60,
    max_rp_turns_per_day: -1,
    max_rp_characters: 10,
    max_tokens_per_call: 8192,
  },
}

async function ensurePlanSubscription(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('plan_subscription')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load plan subscription: ${error.message}`)
  }

  if (data) {
    return data
  }

  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + DEFAULT_TRIAL_DAYS)
  const payload = {
    user_id: userId,
    plan_id: DEFAULT_TRIAL_PLAN_ID,
    status: 'trial',
    trial_ends_at: trialEnds.toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnds.toISOString(),
  }

  const { data: inserted, error: insertError } = await supabase
    .from('plan_subscription')
    .insert(payload)
    .select('*')
    .single()

  if (insertError || !inserted) {
    throw new Error('Failed to create plan subscription')
  }

  return inserted
}

export async function getUserPlanEntitlements(
  supabase: SupabaseClient,
  userId: string
) {
  const plan = await ensurePlanSubscription(supabase, userId)
  const planKey = plan.plan_id || plan.plan || DEFAULT_TRIAL_PLAN_ID
  const entitlements =
    PLAN_LIMITS[planKey] || PLAN_LIMITS[DEFAULT_TRIAL_PLAN_ID]

  if (
    planKey === DEFAULT_TRIAL_PLAN_ID &&
    plan.trial_ends_at &&
    new Date(plan.trial_ends_at) < new Date()
  ) {
    throw new Error('Trial has expired')
  }

  return {
    plan: planKey,
    status: plan.status,
    trial_ends_at: plan.trial_ends_at,
    entitlements,
  }
}

