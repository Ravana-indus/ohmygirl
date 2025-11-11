import { MICROCREDITS_PER_LKR } from './constants'

export interface TokenEstimationOptions { language: 'tamil' | 'thanglish'; readMinutes?: number; text?: string; feature: 'story' | 'rp' }
export interface TokenEstimationResult { estimatedTokens: number; estimatedInputTokens: number; estimatedOutputTokens: number; readMinutes: number; language: string; feature: string }

// Tuned up to produce longer stories per displayed read time
const TOKENS_PER_MINUTE = { tamil: 220, thanglish: 260 }
const TOKEN_DISTRIBUTION = { story: { input_ratio: 0.3, output_ratio: 0.7 }, rp: { input_ratio: 0.4, output_ratio: 0.6 } }

const TAMIL_CHAR_TOKEN_RATIO = 0.8
const THANGLISH_CHAR_TOKEN_RATIO = 1.2

export function estimateTokensByReadTime(readMinutes: number, language: 'tamil' | 'thanglish', feature: 'story' | 'rp'): TokenEstimationResult {
  const tokensPerMinute = TOKENS_PER_MINUTE[language]
  const totalTokens = Math.ceil(readMinutes * tokensPerMinute)
  const d = TOKEN_DISTRIBUTION[feature]
  return { estimatedTokens: totalTokens, estimatedInputTokens: Math.ceil(totalTokens * d.input_ratio), estimatedOutputTokens: Math.ceil(totalTokens * d.output_ratio), readMinutes, language, feature }
}

export function estimateTokensByText(text: string, language: 'tamil' | 'thanglish', feature: 'story' | 'rp'): TokenEstimationResult {
  const charCount = text.length
  const ratio = language === 'tamil' ? TAMIL_CHAR_TOKEN_RATIO : THANGLISH_CHAR_TOKEN_RATIO
  const totalTokens = Math.ceil(charCount * ratio)
  const tokensPerMinute = TOKENS_PER_MINUTE[language]
  const readMinutes = Math.ceil(totalTokens / tokensPerMinute)
  const d = TOKEN_DISTRIBUTION[feature]
  return { estimatedTokens: totalTokens, estimatedInputTokens: Math.ceil(totalTokens * d.input_ratio), estimatedOutputTokens: Math.ceil(totalTokens * d.output_ratio), readMinutes, language, feature }
}

export function estimateTokens(options: TokenEstimationOptions): TokenEstimationResult {
  const { language, readMinutes, text, feature } = options
  if (text && text.trim()) return estimateTokensByText(text, language, feature)
  if (readMinutes && readMinutes > 0) return estimateTokensByReadTime(readMinutes, language, feature)
  return estimateTokensByReadTime(feature === 'story' ? 2 : 1, language, feature)
}

export interface ModelPricing { code: string; input_ppm_usd: number; output_ppm_usd: number; max_output_tokens: number }
export interface CostEstimation { estimatedCostUSD: number; estimatedCostLKR: number; estimatedMicrocredits: number; inputTokens: number; outputTokens: number; totalTokens: number }

export function estimateCost(tokenEstimation: TokenEstimationResult, modelPricing: ModelPricing, usdToLkrRate: number = 320, marginPct: number = 20, creditPriceLkrToMicrocredits: number = MICROCREDITS_PER_LKR): CostEstimation {
  const { estimatedInputTokens, estimatedOutputTokens } = tokenEstimation
  const inputCostUSD = (estimatedInputTokens / 1_000_000) * modelPricing.input_ppm_usd
  const outputCostUSD = (estimatedOutputTokens / 1_000_000) * modelPricing.output_ppm_usd
  const totalCostUSD = inputCostUSD + outputCostUSD
  const baseCostLKR = totalCostUSD * usdToLkrRate
  const finalCostLKR = baseCostLKR * (1 + marginPct / 100)
  const microcredits = Math.ceil(finalCostLKR * creditPriceLkrToMicrocredits)
  return { estimatedCostUSD: totalCostUSD, estimatedCostLKR: finalCostLKR, estimatedMicrocredits: microcredits, inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens, totalTokens: tokenEstimation.estimatedTokens }
}

export function validateTokenLimits(tokenEstimation: TokenEstimationResult, modelPricing: ModelPricing): { valid: boolean; reason?: string } {
  const { estimatedOutputTokens } = tokenEstimation
  const { max_output_tokens } = modelPricing
  if (estimatedOutputTokens > max_output_tokens) return { valid: false, reason: `Estimated output tokens (${estimatedOutputTokens}) exceed model limit (${max_output_tokens})` }
  return { valid: true }
}

export function getRecommendedMaxTokens(feature: 'story' | 'rp', language: 'tamil' | 'thanglish', intensity?: number): number {
  const tokensPerMinute = TOKENS_PER_MINUTE[language]
  if (feature === 'story') {
    const baseMinutes = 3
    const multiplier = intensity ? 1 + (intensity - 1) * 0.2 : 1
    return Math.ceil(baseMinutes * tokensPerMinute * multiplier)
  }
  const baseMinutes = 1
  const multiplier = intensity ? 1 + (intensity - 1) * 0.15 : 1
  return Math.ceil(baseMinutes * tokensPerMinute * multiplier)
}

export function formatTokenCount(tokens: number): string { return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString() }
export function formatCostLKR(costLKR: number): string { return `₹${costLKR.toFixed(2)}` }
export function formatMicrocredits(microcredits: number): string { const credits = microcredits / MICROCREDITS_PER_LKR; return `${credits.toFixed(2)} credits` }
