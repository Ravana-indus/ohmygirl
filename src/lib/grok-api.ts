export interface GrokMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface GrokStreamChunk { choices: { delta?: { content?: string }, finish_reason?: string }[]; usage?: { prompt_tokens: number, completion_tokens: number } }

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

export class GrokClient {
  constructor(private apiKey: string = process.env.XAI_API_KEY || '') {
    if (!this.apiKey) throw new Error('xAI API key is required')
  }
  async *chatStream(req: { model: 'grok-4' | 'grok-4-fast', messages: GrokMessage[], max_tokens?: number, temperature?: number }) {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, stream: true })
    })
    if (!res.ok || !res.body) throw new Error('Grok API error')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        idx = buffer.indexOf('\n\n')
        const line = block.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.replace(/^data:\s*/, '')
        if (payload === '[DONE]') break
        try { yield JSON.parse(payload) as GrokStreamChunk } catch {}
      }
    }
  }
}

export function createGrokClient(apiKey?: string) { return new GrokClient(apiKey) }

export function extractStreamContent(chunk: GrokStreamChunk): string | null { return chunk.choices?.[0]?.delta?.content || null }
export function isStreamComplete(chunk: GrokStreamChunk): boolean { return ['stop','length'].includes(chunk.choices?.[0]?.finish_reason || '') }

export const SYSTEM_PROMPTS = {
  story: {
    tamil: `Write tamil sex story based on user request keep the stories Explicit erotic, use Explicit language like molai, pundai, saaman, sunni . சிறுவர்கள்/rape/forced/சட்டவிரோத உள்ளடக்கம் வேண்டாம். {LANGUAGE}. {MAX_TOKENS} டோக்கன்களுக்கு உட்பட்டு.`,
    thanglish: `Write tamil sex story based on user request keep the stories Explicit erotic in thanglish. use Explicit language like moola, maarpu, pundai, saman, sunni. Never include minors, non-consent or illegal content. Respect {LANGUAGE}. Stay within {MAX_TOKENS} tokens.`
  }
}

export function createStoryPrompt(params: { language: 'tamil' | 'thanglish', readMinutes: number, situation: string, characters: any[], relationships: any[], tone?: string, maxTokens: number }): GrokMessage[] {
  const { language, readMinutes, situation, characters, relationships, tone, maxTokens } = params
  const system = SYSTEM_PROMPTS.story[language].replace('{LANGUAGE}', language).replace('{MAX_TOKENS}', String(maxTokens))
  const user = `Mode: Story (Adult Erotic Allowed)
Language: ${language}
Read Time: ${readMinutes} minutes (~${maxTokens} tokens)
Situation: ${situation}
Characters: ${JSON.stringify(characters)}
Relationships: ${JSON.stringify(relationships)}
Tone: ${tone || 'romantic'}

Constraints:
- Adults only; no minors; no illegal content, no froce or rape content
- Consent must be explicit and continuous
- Explicit erotic description is allowed when consensual
- Coherent flow; vary paragraph length; no filler
- Include a complete narrative arc: setup, conflict, twist, climax, resolution`
  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}
