'use client'

import { useState, useEffect, useRef } from 'react'
import supabase from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ui/theme-provider'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyChat } from '@/components/ui/empty-state'
import { Send, Mic, MicOff, Volume2, Settings, User, MessageSquare, Sparkles, Globe, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  speaker: 'user' | 'ai'
  content: string
  timestamp: Date
}

interface CharacterData {
  id: string
  name: string
  role: string
  gender?: string | null
  traits: Record<string, any>
}

interface RPChatProps {
  sessionId: string
  aiCharacter: CharacterData
  userCharacter: CharacterData
  sessionLanguage: 'tamil' | 'thanglish'
  onHistoryChanged?: () => void
}

export function RPChat({
  sessionId,
  aiCharacter,
  userCharacter,
  sessionLanguage,
  onHistoryChanged,
}: RPChatProps) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [language, setLanguage] = useState<'tamil' | 'thanglish'>(sessionLanguage)
  const [isRecording, setIsRecording] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [sendingError, setSendingError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLanguage(sessionLanguage)
  }, [sessionLanguage])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [inputMessage])

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current && !loadingHistory) {
      inputRef.current.focus()
    }
  }, [loadingHistory])

  useEffect(() => {
    const loadHistory = async () => {
      if (!sessionId) return
      setLoadingHistory(true)
      setHistoryError(null)
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        if (!token) {
          setHistoryError('Please sign in to view chat history.')
          setLoadingHistory(false)
          return
        }
        const res = await fetch(`/api/rp/turns?session_id=${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load history')
        }
        const mapped: Message[] = (json.data || []).map((turn: any) => ({
          id: turn.id,
          speaker: turn.speaker,
          content: turn.content,
          timestamp: new Date(turn.created_at),
        }))
        setMessages(mapped)
      } catch (e: any) {
        setHistoryError(e.message)
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [sessionId])

  const readAssistantResponse = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let content = ''

    const processEvent = (eventBlock: string) => {
      const dataLines = eventBlock
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.replace(/^data:\s*/, ''))

      if (dataLines.length === 0) return
      const payload = dataLines.join('\n').trim()
      if (!payload || payload === '[DONE]') return
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          content += delta
        }
      } catch (err) {
        console.error('Failed to parse SSE chunk', err)
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const eventBlock = buffer.slice(0, boundary)
        processEvent(eventBlock)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    }

    if (buffer.trim().length > 0) {
      processEvent(buffer)
    }

    return content.trim()
  }

  const buildContextFromMessages = (history: Message[]) => {
    const recent = history.slice(-10)
    return recent
      .map((msg) => {
        const speakerName = msg.speaker === 'user' ? userCharacter.name : aiCharacter.name
        return `${speakerName}: ${msg.content}`
      })
      .join('\n')
  }

  const saveTurn = async (speaker: 'user' | 'ai', content: string) => {
    if (!userCharacter?.id || !aiCharacter?.id) {
      throw new Error('Character data not ready. Please reload the session.')
    }
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) {
      throw new Error('Please sign in to continue.')
    }
    const res = await fetch('/api/rp/turns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        speaker,
        content,
        character_id: speaker === 'user' ? userCharacter.id : aiCharacter.id,
        language,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to save turn')
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      speaker: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)
    setSendingError(null)

    try {
      await saveTurn('user', userMessage.content)

      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const context = buildContextFromMessages([...messages, userMessage])

      const body = {
        feature: 'rp',
        model_code: 'grok-4-fast',
        prompt_inputs: {
          language,
          category: aiCharacter?.traits?.category || 'romance',
          intensity: aiCharacter?.traits?.intensity || 2,
          user_character: userCharacter,
          ai_character: aiCharacter,
          context,
          user_message: userMessage.content,
        },
        max_tokens: 800,
        session_id: sessionId,
      }

      const res = await fetch('/api/start', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let errorMessage = 'Failed to start chat response'
        try {
          const errorJson = await res.json()
          if (errorJson?.message) {
            errorMessage = errorJson.message
          }
        } catch (_) {
          // ignore parse errors
        }
        throw new Error(errorMessage)
      }

      if (!res.body) {
        throw new Error('Chat response stream missing body')
      }

      const assistantContent = await readAssistantResponse(res.body)

      const assistantMessage: Message = {
        id: `ai-${Date.now()}`,
        speaker: 'ai',
        content: assistantContent || '... (no response)',
        timestamp: new Date(),
      }

      await saveTurn('ai', assistantMessage.content)
      setMessages(prev => [...prev, assistantMessage])
      onHistoryChanged?.()
    } catch (e: any) {
      console.error('Streaming error', e)
      setSendingError(e?.message || 'Something went wrong. Please try again.')
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, speaker: 'ai', content: e?.message || 'Sorry, something went wrong.', timestamp: new Date() }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // In a real implementation, this would start/stop voice recording
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'tamil' ? 'thanglish' : 'tamil'
    setLanguage(newLanguage)
  }

  const formatMessage = (message: string) => {
    // In a real implementation, this would format Tamil/Thanglish text properly
    return message
  }

  const chatBackgroundStyle = {
    backgroundColor: '#0b141a',
    backgroundImage:
      'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.04) 2px, transparent 0), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.025) 3px, transparent 0)',
    backgroundSize: '160px 160px',
  }

  return (
    <div className={`flex flex-col h-full bg-[#0b141a] text-[#e9edef] ${theme} animate-fade-in`}>
      {/* Header: fixed on mobile, sticky on md+ */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-[#1f2a30] bg-[#202c33] shadow-sm md:sticky md:inset-auto md:top-0 md:z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-[#25d366]/10 border border-[#25d366]/40 flex items-center justify-center shadow">
              <span className="text-[#25d366] font-semibold text-sm">AI</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#e9edef]">{aiCharacter.name}</h3>
              <p className="text-xs text-[#b9c3c8]">
                {aiCharacter.role}
                {aiCharacter.gender ? ` • ${aiCharacter.gender}` : ''}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-border" />

          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-[#d1f4cc]/10 border border-[#d1f4cc]/30 flex items-center justify-center shadow">
              <span className="text-[#d1f4cc] font-semibold text-sm">U</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#e9edef]">{userCharacter.name}</h3>
              <p className="text-xs text-[#b9c3c8]">
                {userCharacter.role}
                {userCharacter.gender ? ` • ${userCharacter.gender}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="hover:bg-[#111b21] text-[#25d366]"
          >
            <Globe className="h-4 w-4 mr-1" />
            {language === 'tamil' ? 'தமிழ்' : 'Thanglish'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="hover:bg-[#111b21] text-[#d1d7db]"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-4 md:pb-28 space-y-4 scrollbar-hide"
        style={chatBackgroundStyle}
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-sm text-[#9aa6ab]">
            Loading conversation…
          </div>
        ) : historyError ? (
          <div className="flex items-center justify-center h-full text-sm text-destructive">
            {historyError}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <EmptyChat />
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.speaker === 'user' ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-up'}`}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 shadow-sm border border-transparent relative',
                  message.speaker === 'user'
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-br-sm'
                    : 'bg-[#202c33] text-[#e9edef] rounded-bl-sm border border-[#1f2a30]'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words font-tamil">
                  {formatMessage(message.content)}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/70">
                  <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {message.speaker === 'user' && (
                    <span className="text-emerald-200">✓✓</span>
                  )}
                </div>
                {message.speaker === 'user' ? (
                  <span className="absolute -right-1 top-2 text-[#005c4b]">▾</span>
                ) : (
                  <span className="absolute -left-1 top-2 text-[#202c33]">▾</span>
                )}
                {index === messages.length - 1 && message.speaker === 'user' && (
                  <div className="absolute -bottom-4 right-0 text-[10px] text-[#9aa6ab]">
                    Sent via Oh My Girl
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex justify-start animate-slide-up">
            <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-[#202c33] border border-[#1f2a30] text-[#e9edef]">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{aiCharacter.name}</span>
                <div className="typing-indicator text-[#9aa6ab]">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar: fixed on mobile (like WhatsApp), sticky on md+ */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1f2a30] bg-[#202c33] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4 md:sticky md:bottom-0">
        {sendingError && (
          <p className="text-sm text-destructive mb-2">{sendingError}</p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Type your message in ${language === 'tamil' ? 'Tamil' : 'Thanglish'}...`}
              className="w-full resize-none rounded-2xl border border-[#0b141a] bg-[#111b21] p-3 pr-28 focus:ring-2 focus:ring-[#25d366]/60 focus:border-[#25d366]/60 text-sm font-tamil text-[#e9edef] placeholder:text-[#6a7378] transition-all"
              rows={1}
              disabled={loadingHistory}
            />

            <div className="absolute right-2 bottom-2 flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRecording}
                disabled={loadingHistory}
                className={cn(
                  'hover:bg-[#0b141a]',
                  isRecording ? 'text-destructive' : 'text-[#9aa6ab]'
                )}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                disabled={loadingHistory}
                className="text-[#9aa6ab] hover:bg-[#0b141a]"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || loadingHistory}
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl bg-[#25d366] text-[#0b141a] disabled:bg-[#3c5248]"
          >
            {loadingHistory ? (
              <LoadingSpinner size="sm" className="border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="fixed inset-0" onClick={() => setSettingsOpen(false)} />
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Chat Settings</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Language</h3>
                <div className="flex space-x-2">
                  <Button
                    variant={language === 'tamil' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setLanguage('tamil')
                    }}
                    className="flex-1"
                  >
                    தமிழ்
                  </Button>
                  <Button
                    variant={language === 'thanglish' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setLanguage('thanglish')
                    }}
                    className="flex-1"
                  >
                    Thanglish
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Character Traits</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Character</span>
                    <span className="text-sm text-muted-foreground">{aiCharacter.name}</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(aiCharacter.traits).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
