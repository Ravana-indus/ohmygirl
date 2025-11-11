'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Character { id: string; name: string; role?: string; gender?: 'female' | 'male' | 'non-binary' | 'custom'; traits: Record<string, any> }
interface Relationship { id: string; a: string; b: string; relation_type: string; tension_level: number }

export function StoryComposer({ onSaveBlueprint, onGenerateStory, initialBlueprints = [] }: { onSaveBlueprint: (b: any) => void; onGenerateStory: (b: any) => void; initialBlueprints?: any[] }) {
  const [situation, setSituation] = useState('')
  // Phase is implicit (stories include full arc). We keep a default for storage compatibility.
  const [phase] = useState<'setup' | 'conflict' | 'twist' | 'climax' | 'resolution'>('setup')
  const [readMinutes, setReadMinutes] = useState(5)
  const [language, setLanguage] = useState<'tamil' | 'thanglish'>('tamil')
  const toneOptions = ['romantic','spicy','playful','dramatic','wholesome','dark'] as const
  const [selectedTone, setSelectedTone] = useState<string>('romantic')
  const [customTone, setCustomTone] = useState<string>('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [savedBlueprints, setSavedBlueprints] = useState<any[]>(initialBlueprints)

  useEffect(() => { if (Array.isArray(initialBlueprints)) setSavedBlueprints(initialBlueprints) }, [initialBlueprints])

  const roleOptions = ['girlfriend','lover','wife','teacher','nurse','colleague','neighbor','boss'] as const
  const addCharacter = () => setCharacters([...characters, { id: Date.now().toString(), name: '', role: 'girlfriend', gender: 'female', traits: {} }])
  const removeCharacter = (id: string) => { setCharacters(characters.filter(c => c.id !== id)); setRelationships(relationships.filter(r => r.a !== id && r.b !== id)) }
  const updateCharacter = (id: string, field: string, value: any) => setCharacters(characters.map(c => c.id === id ? { ...c, [field]: value } : c))
  const addRelationship = () => { if (characters.length < 2) return; const a = characters[0].id, b = characters[1].id; setRelationships([...relationships, { id: Date.now().toString(), a, b, relation_type: 'romantic', tension_level: 5 }]) }
  const removeRelationship = (id: string) => setRelationships(relationships.filter(r => r.id !== id))
  const updateRelationship = (id: string, field: string, value: any) => setRelationships(relationships.map(r => r.id === id ? { ...r, [field]: value } : r))

  const effectiveTone = ((): string => selectedTone === 'custom' ? (customTone.trim() || 'custom') : selectedTone)()

  const handleSaveBlueprint = () => {
    const blueprint = { id: Date.now().toString(), situation, phase, read_minutes: readMinutes, language, tone: effectiveTone, characters, relationships, created_at: new Date().toISOString() }
    setSavedBlueprints([...savedBlueprints, blueprint])
    onSaveBlueprint(blueprint)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Story Composer</h1>
          <p className="text-sm text-gray-500">Create personalized romantic stories</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSaveBlueprint} variant="outline">Save Blueprint</Button>
          <Button onClick={() => onGenerateStory({ id: Date.now().toString(), situation, phase, read_minutes: readMinutes, language, tone: effectiveTone, characters, relationships, created_at: new Date().toISOString() })}>Generate Story</Button>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Situation / Setting</label>
          <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={3} className="w-full border rounded-md p-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="w-full border rounded-md p-2">
              <option value="tamil">Tamil</option>
              <option value="thanglish">Thanglish</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tone</label>
            <div className="flex gap-2">
              <select value={selectedTone} onChange={(e) => setSelectedTone(e.target.value)} className="w-full border rounded-md p-2">
                {toneOptions.map(t => (<option key={t} value={t}>{t}</option>))}
                <option value="custom">Custom…</option>
              </select>
            </div>
            {selectedTone === 'custom' && (
              <input value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder="Enter custom tone" className="mt-2 w-full border rounded-md p-2" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Read Minutes: {readMinutes}</label>
            <input type="range" min={1} max={20} value={readMinutes} onChange={(e) => setReadMinutes(parseInt(e.target.value))} className="w-full" />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Characters</h2>
          <Button variant="outline" onClick={addCharacter}>Add</Button>
        </div>
        <div className="space-y-3">
          {characters.map((c, idx) => (
            <div key={c.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between"><h3 className="font-medium">Character {idx+1}</h3><Button variant="ghost" onClick={() => removeCharacter(c.id)}>Remove</Button></div>
              <input value={c.name} onChange={(e) => updateCharacter(c.id, 'name', e.target.value)} placeholder="Name" className="w-full border rounded-md p-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Role</label>
                  {(() => {
                    const current = (c.role || '').toLowerCase()
                    const isPreset = roleOptions.includes(current as any)
                    const selected = isPreset ? current : 'custom'
                    return (
                      <>
                        <select
                          value={selected}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === 'custom') {
                              // keep existing custom value or blank; input below will update
                              updateCharacter(c.id, 'role', c.role || '')
                            } else {
                              updateCharacter(c.id, 'role', val)
                            }
                          }}
                          className="w-full border rounded-md p-2"
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                          <option value="custom">Custom…</option>
                        </select>
                        {selected === 'custom' && (
                          <input
                            className="mt-2 w-full border rounded-md p-2"
                            placeholder="Enter custom role (e.g., nurse, model)"
                            value={c.role || ''}
                            onChange={(e) => updateCharacter(c.id, 'role', e.target.value)}
                          />
                        )}
                      </>
                    )
                  })()}
                </div>
                <div>
                  <label className="block text-sm mb-1">Gender</label>
                  <select value={c.gender || 'female'} onChange={(e) => updateCharacter(c.id, 'gender', e.target.value)} className="w-full border rounded-md p-2">
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="custom">Custom / In traits</option>
                  </select>
                </div>
              </div>
              <textarea value={c.traits?.description || ''} onChange={(e) => updateCharacter(c.id, 'traits', { description: e.target.value })} placeholder="Traits" className="w-full border rounded-md p-2" rows={2} />
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Relationships</h2>
          <Button variant="outline" onClick={addRelationship} disabled={characters.length < 2}>Add</Button>
        </div>
        <div className="space-y-3">
          {relationships.map((r) => (
            <div key={r.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{characters.find(c => c.id === r.a)?.name || 'A'} — {characters.find(c => c.id === r.b)?.name || 'B'}</span>
                <Button variant="ghost" onClick={() => removeRelationship(r.id)}>Remove</Button>
              </div>
              <select value={r.relation_type} onChange={(e) => updateRelationship(r.id, 'relation_type', e.target.value)} className="w-full border rounded-md p-2">
                <option value="romantic">Romantic</option>
                <option value="family">Family</option>
                <option value="rivals">Rivals</option>
                <option value="colleagues">Colleagues</option>
              </select>
              <label className="block text-sm">Tension: {r.tension_level}/10</label>
              <input type="range" min={1} max={10} value={r.tension_level} onChange={(e) => updateRelationship(r.id, 'tension_level', parseInt(e.target.value))} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-medium mb-2">Saved Blueprints</h2>
        {savedBlueprints.length === 0 ? (
          <p className="text-sm text-gray-500">No saved blueprints yet</p>
        ) : (
          <div className="space-y-2">
            {savedBlueprints.map((b) => (
              <div key={b.id} className="border rounded-md p-2 flex items-center justify-between">
                <div className="text-sm truncate">{b.situation?.slice(0,60) || 'Untitled'}…</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => {
                    setSituation(b.situation)
                    // phase is implicit; keep default 'setup' for storage compatibility
                    setReadMinutes(b.read_minutes)
                    setLanguage(b.language)
                    if (toneOptions.includes(b.tone)) { setSelectedTone(b.tone) } else { setSelectedTone('custom'); setCustomTone(b.tone || '') }
                    setCharacters(b.characters || [])
                    setRelationships(b.relationships || [])
                  }}>Load</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
