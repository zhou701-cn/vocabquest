import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Play, 
  Save, 
  X, 
  Upload, 
  Download,
  BookOpen,
  Volume2,
  Eye,
  Check,
  AlertCircle,
  Loader
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import { VocabularyWord, VocabularyList } from '../types'

interface WordFormData {
  word: string
  part_of_speech: string
  definition: string
  example_sentence: string
  synonyms: string[]
  antonyms: string[]
  difficulty_level: number
  ssat_importance: number
  pronunciation_guide?: string
  usage_notes?: string
  frequency_score: number
}

interface GeneratedWordData {
  word: string
  part_of_speech: string
  definition: string
  example_sentence: string
  synonyms: string[]
  antonyms: string[]
  difficulty_level: number
  ssat_importance: number
  pronunciation_guide?: string
  usage_notes?: string
  frequency_score: number
}

export function AdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('words')
  const [words, setWords] = useState<VocabularyWord[]>([])
  const [vocabularyLists, setVocabularyLists] = useState<VocabularyList[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null)
  const [newWord, setNewWord] = useState('')
  const [generatingAI, setGeneratingAI] = useState(false)
  const [generatedData, setGeneratedData] = useState<GeneratedWordData | null>(null)
  const [formData, setFormData] = useState<WordFormData>({
    word: '',
    part_of_speech: 'noun',
    definition: '',
    example_sentence: '',
    synonyms: [],
    antonyms: [],
    difficulty_level: 3,
    ssat_importance: 3,
    pronunciation_guide: '',
    usage_notes: '',
    frequency_score: 3
  })
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [bulkImportText, setBulkImportText] = useState('')
  const [bulkImportFormat, setBulkImportFormat] = useState('simple') // 'simple' or 'csv'
  
  // Tense checking function
  const checkTenseMismatch = (word: VocabularyWord) => {
    console.log(`🔍 Checking word: "${word.word}" (${word.part_of_speech})`)
    console.log(`📝 Example sentence: "${word.example_sentence}"`)
    
    if (!word.example_sentence || word.part_of_speech !== 'verb') {
      console.log(`⏭️ Skipping - not a verb or no example sentence`)
      return null
    }
    
    // Use word boundary regex to check for exact word match
    const wordRegex = new RegExp(`\\b${word.word.toLowerCase()}\\b`, 'g')
    const wordInSentence = wordRegex.test(word.example_sentence.toLowerCase())
    console.log(`🔎 Word "${word.word}" in sentence (exact match): ${wordInSentence}`)
    
    if (wordInSentence) {
      console.log(`✅ Word found correctly`)
      return null // Word is found correctly
    }
    
    // Check for common tense variations
    const tenseVariations = getTenseVariations(word.word)
    console.log(`🔄 Checking variations:`, tenseVariations)
    
    const foundVariation = tenseVariations.find(variation => 
      word.example_sentence.toLowerCase().includes(variation.toLowerCase())
    )
    
    console.log(`🎯 Found variation:`, foundVariation)
    
    return foundVariation || 'not_found'
  }
  
  const getTenseVariations = (word: string): string[] => {
    const variations = []
    const lowerWord = word.toLowerCase()
    
    // Common verb tense variations
    if (lowerWord.endsWith('e')) {
      variations.push(lowerWord + 'd', lowerWord + 's', lowerWord + 'ing')
    } else if (lowerWord.endsWith('y')) {
      variations.push(lowerWord.slice(0, -1) + 'ied', lowerWord + 's', lowerWord + 'ing')
    } else if (lowerWord.match(/[bcdfghjklmnpqrstvwxyz]$/)) {
      variations.push(lowerWord + 'ed', lowerWord + 's', lowerWord + 'ing')
    }
    
    // Irregular verbs (common ones)
    const irregularVerbs: { [key: string]: string[] } = {
      'go': ['went', 'goes', 'going'], 'come': ['came', 'comes', 'coming'],
      'see': ['saw', 'sees', 'seeing'], 'take': ['took', 'takes', 'taking'],
      'make': ['made', 'makes', 'making'], 'get': ['got', 'gets', 'getting'],
      'give': ['gave', 'gives', 'giving'], 'find': ['found', 'finds', 'finding'],
      'think': ['thought', 'thinks', 'thinking'], 'know': ['knew', 'knows', 'knowing'],
      'look': ['looked', 'looks', 'looking'], 'use': ['used', 'uses', 'using'],
      'work': ['worked', 'works', 'working'], 'call': ['called', 'calls', 'calling'],
      'try': ['tried', 'tries', 'trying'], 'ask': ['asked', 'asks', 'asking'],
      'need': ['needed', 'needs', 'needing'], 'feel': ['felt', 'feels', 'feeling'],
      'become': ['became', 'becomes', 'becoming'], 'leave': ['left', 'leaves', 'leaving'],
      'put': ['put', 'puts', 'putting'], 'mean': ['meant', 'means', 'meaning'],
      'keep': ['kept', 'keeps', 'keeping'], 'let': ['let', 'lets', 'letting'],
      'begin': ['began', 'begins', 'beginning'], 'seem': ['seemed', 'seems', 'seeming'],
      'help': ['helped', 'helps', 'helping'], 'show': ['showed', 'shows', 'showing'],
      'hear': ['heard', 'hears', 'hearing'], 'play': ['played', 'plays', 'playing'],
      'run': ['ran', 'runs', 'running'], 'move': ['moved', 'moves', 'moving'],
      'live': ['lived', 'lives', 'living'], 'believe': ['believed', 'believes', 'believing'],
      'hold': ['held', 'holds', 'holding'], 'bring': ['brought', 'brings', 'bringing'],
      'happen': ['happened', 'happens', 'happening'], 'write': ['wrote', 'writes', 'writing'],
      'provide': ['provided', 'provides', 'providing'], 'sit': ['sat', 'sits', 'sitting'],
      'stand': ['stood', 'stands', 'standing'], 'lose': ['lost', 'loses', 'losing'],
      'pay': ['paid', 'pays', 'paying'], 'meet': ['met', 'meets', 'meeting'],
      'include': ['included', 'includes', 'including'], 'continue': ['continued', 'continues', 'continuing'],
      'set': ['set', 'sets', 'setting'], 'learn': ['learned', 'learns', 'learning'],
      'change': ['changed', 'changes', 'changing'], 'lead': ['led', 'leads', 'leading'],
      'understand': ['understood', 'understands', 'understanding'], 'watch': ['watched', 'watches', 'watching'],
      'follow': ['followed', 'follows', 'following'], 'stop': ['stopped', 'stops', 'stopping'],
      'create': ['created', 'creates', 'creating'], 'speak': ['spoke', 'speaks', 'speaking'],
      'read': ['read', 'reads', 'reading'], 'allow': ['allowed', 'allows', 'allowing'],
      'add': ['added', 'adds', 'adding'], 'spend': ['spent', 'spends', 'spending'],
      'grow': ['grew', 'grows', 'growing'], 'open': ['opened', 'opens', 'opening'],
      'walk': ['walked', 'walks', 'walking'], 'win': ['won', 'wins', 'winning'],
      'offer': ['offered', 'offers', 'offering'], 'remember': ['remembered', 'remembers', 'remembering'],
      'love': ['loved', 'loves', 'loving'], 'consider': ['considered', 'considers', 'considering'],
      'appear': ['appeared', 'appears', 'appearing'], 'buy': ['bought', 'buys', 'buying'],
      'wait': ['waited', 'waits', 'waiting'], 'serve': ['served', 'serves', 'serving'],
      'die': ['died', 'dies', 'dying'], 'send': ['sent', 'sends', 'sending'],
      'expect': ['expected', 'expects', 'expecting'], 'build': ['built', 'builds', 'building'],
      'stay': ['stayed', 'stays', 'staying'], 'fall': ['fell', 'falls', 'falling'],
      'cut': ['cut', 'cuts', 'cutting'], 'reach': ['reached', 'reaches', 'reaching'],
      'kill': ['killed', 'kills', 'killing'], 'remain': ['remained', 'remains', 'remaining'],
      'approach': ['approached', 'approaches', 'approaching']
    }
    
    if (irregularVerbs[lowerWord]) {
      variations.push(...irregularVerbs[lowerWord])
    }
    
    return variations
  }

  useEffect(() => {
    loadVocabularyLists()
  }, [])

  useEffect(() => {
    if (selectedListId) {
      loadWords()
    }
  }, [selectedListId])

  const loadVocabularyLists = async () => {
    try {
      const data = await apiFetch<VocabularyList[]>('/vocabulary/lists')

      setVocabularyLists(data || [])
      if (data && data.length > 0 && !selectedListId) {
        setSelectedListId(data[0].id)
      }
    } catch (error) {
      console.error('Error loading vocabulary lists:', error)
      showNotification('error', 'Failed to load vocabulary lists')
    }
  }

  const loadWords = async () => {
    if (!selectedListId) return
    
    setIsLoading(true)
    try {
      const data = await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'get_words',
          data: {
            list_id: selectedListId,
            limit: 10000, // Increased limit to ensure all words are displayed
            offset: 0,
            sort_by: 'word',
            sort_order: 'asc'
          }
        }
      })

      if (data?.data?.words) {
        setWords(data.data.words)
      }
    } catch (error) {
      console.error('Error loading words:', error)
      showNotification('error', 'Failed to load words')
    } finally {
      setIsLoading(false)
    }
  }

  const searchWords = async () => {
    if (!searchQuery.trim() || !selectedListId) return
    
    setIsLoading(true)
    try {
      const data = await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'search_words',
          data: {
            query: searchQuery.trim(),
            list_id: selectedListId,
            limit: 1000
          }
        }
      })

      if (data?.data?.words) {
        setWords(data.data.words)
      }
    } catch (error) {
      console.error('Error searching words:', error)
      showNotification('error', 'Failed to search words')
    } finally {
      setIsLoading(false)
    }
  }

  const generateAIContent = async () => {
    if (!newWord.trim()) {
      showNotification('error', 'Please enter a word first')
      return
    }

    setGeneratingAI(true)
    try {
      const data = await apiFetch('/ai/generate-word', {
        method: 'POST',
        body: {
          word: newWord.trim(),
          targetGrade: 4
        }
      })

      if (data?.data) {
        setGeneratedData(data.data)
        setFormData({
          word: data.data.word,
          part_of_speech: data.data.part_of_speech,
          definition: data.data.definition,
          example_sentence: data.data.example_sentence,
          synonyms: data.data.synonyms || [],
          antonyms: data.data.antonyms || [],
          difficulty_level: data.data.difficulty_level,
          ssat_importance: data.data.ssat_importance,
          pronunciation_guide: data.data.pronunciation_guide || '',
          usage_notes: data.data.usage_notes || '',
          frequency_score: data.data.frequency_score
        })
        showNotification('success', 'AI content generated successfully!')
      }
    } catch (error) {
      console.error('Error generating AI content:', error)
      showNotification('error', 'Failed to generate AI content')
    } finally {
      setGeneratingAI(false)
    }
  }

  const addWord = async () => {
    if (!selectedListId || !formData.word.trim()) {
      showNotification('error', 'Please select a list and enter a word')
      return
    }

    setIsLoading(true)
    try {
      // Generate audio URL
      const audioResponse = await apiFetch('/ai/word-audio', {
        method: 'POST',
        body: {
          word: formData.word,
          wordId: Date.now()
        }
      })

      let audioUrl = '';
      if (audioResponse.data?.data?.audio_url) {
        audioUrl = audioResponse.data.data.audio_url
      }

      const wordData = {
        ...formData,
        audio_url: audioUrl,
        synonyms: formData.synonyms.filter(s => s.trim()),
        antonyms: formData.antonyms.filter(s => s.trim())
      }

      await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'add_word',
          data: {
            list_id: selectedListId,
            word_data: wordData
          }
        }
      })

      showNotification('success', 'Word added successfully!')
      setShowAddModal(false)
      resetForm()
      loadWords()
    } catch (error) {
      console.error('Error adding word:', error)
      showNotification('error', 'Failed to add word')
    } finally {
      setIsLoading(false)
    }
  }

  const updateWord = async () => {
    if (!editingWord || !formData.word.trim()) {
      showNotification('error', 'Please enter valid word data')
      return
    }

    setIsLoading(true)
    try {
      const wordData = {
        ...formData,
        synonyms: formData.synonyms.filter(s => s.trim()),
        antonyms: formData.antonyms.filter(s => s.trim())
      }

      await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'update_word',
          data: {
            word_id: editingWord.id,
            word_data: wordData
          }
        }
      })

      showNotification('success', 'Word updated successfully!')
      setShowEditModal(false)
      setEditingWord(null)
      resetForm()
      loadWords()
    } catch (error) {
      console.error('Error updating word:', error)
      showNotification('error', 'Failed to update word')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteWord = async (wordId: string) => {
    if (!confirm('Are you sure you want to delete this word?')) return

    setIsLoading(true)
    try {
      await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'delete_word',
          data: {
            word_id: wordId,
            list_id: selectedListId
          }
        }
      })

      showNotification('success', 'Word deleted successfully!')
      loadWords()
    } catch (error) {
      console.error('Error deleting word:', error)
      showNotification('error', 'Failed to delete word')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      word: '',
      part_of_speech: 'noun',
      definition: '',
      example_sentence: '',
      synonyms: [],
      antonyms: [],
      difficulty_level: 3,
      ssat_importance: 3,
      pronunciation_guide: '',
      usage_notes: '',
      frequency_score: 3
    })
    setNewWord('')
    setGeneratedData(null)
  }

  const openEditModal = (word: VocabularyWord) => {
    setEditingWord(word)
    setFormData({
      word: word.word,
      part_of_speech: word.part_of_speech,
      definition: word.definition,
      example_sentence: word.example_sentence,
      synonyms: word.synonyms || [],
      antonyms: word.antonyms || [],
      difficulty_level: word.difficulty_level,
      ssat_importance: word.ssat_importance,
      pronunciation_guide: word.pronunciation_guide || '',
      usage_notes: word.usage_notes || '',
      frequency_score: word.frequency_score
    })
    setShowEditModal(true)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchWords()
    }
  }

  const addSynonym = () => {
    setFormData(prev => ({ ...prev, synonyms: [...prev.synonyms, ''] }))
  }

  const removeSynonym = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      synonyms: prev.synonyms.filter((_, i) => i !== index)
    }))
  }

  const updateSynonym = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      synonyms: prev.synonyms.map((syn, i) => i === index ? value : syn)
    }))
  }

  const addAntonym = () => {
    setFormData(prev => ({ ...prev, antonyms: [...prev.antonyms, ''] }))
  }

  const removeAntonym = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      antonyms: prev.antonyms.filter((_, i) => i !== index)
    }))
  }

  const updateAntonym = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      antonyms: prev.antonyms.map((ant, i) => i === index ? value : ant)
    }))
  }

  const processBulkImport = async () => {
    if (!bulkImportText.trim() || !selectedListId) {
      showNotification('error', 'Please enter words and select a vocabulary list')
      return
    }

    setIsLoading(true)
    try {
      let wordsToImport: any[] = []
      
      if (bulkImportFormat === 'simple') {
        // Simple format: one word per line
        const words = bulkImportText.trim().split('\n').filter(line => line.trim())
        
        for (const word of words) {
          const cleanWord = word.trim()
          if (cleanWord) {
            // Generate AI content for each word
            const aiData = await apiFetch('/ai/generate-word', {
              method: 'POST',
              body: { word: cleanWord, targetGrade: 4 }
            })

            if (aiData?.data) {
              const audioResponse = await apiFetch('/ai/word-audio', {
                method: 'POST',
                body: { word: cleanWord, wordId: Date.now() + Math.random() }
              })
              
              wordsToImport.push({
                word: aiData.data.word,
                part_of_speech: aiData.data.part_of_speech,
                definition: aiData.data.definition,
                example_sentence: aiData.data.example_sentence,
                synonyms: aiData.data.synonyms || [],
                antonyms: aiData.data.antonyms || [],
                difficulty_level: aiData.data.difficulty_level,
                ssat_importance: aiData.data.ssat_importance,
                frequency_score: aiData.data.frequency_score,
                pronunciation_guide: aiData.data.pronunciation_guide || '',
                usage_notes: aiData.data.usage_notes || '',
                audio_url: audioResponse.data?.data?.audio_url || ''
              })
            }
          }
        }
      } else {
        // CSV format: word,part_of_speech,definition,example
        const lines = bulkImportText.trim().split('\n')
        for (const line of lines) {
          const parts = line.split(',')
          if (parts.length >= 2) {
            const [word, pos, definition, example] = parts.map(p => p.trim())
            wordsToImport.push({
              word,
              part_of_speech: pos || 'noun',
              definition: definition || `Definition for ${word}`,
              example_sentence: example || `Example sentence using ${word}.`,
              synonyms: [],
              antonyms: [],
              difficulty_level: 3,
              ssat_importance: 3,
              frequency_score: 3,
              pronunciation_guide: '',
              usage_notes: ''
            })
          }
        }
      }

      if (wordsToImport.length === 0) {
        throw new Error('No valid words found to import')
      }

      // Import words using the bulk import function
      await apiFetch('/admin/word-manager', {
        method: 'POST',
        body: {
          action: 'bulk_import',
          data: {
            list_id: selectedListId,
            words: wordsToImport
          }
        }
      })

      showNotification('success', `Successfully imported ${wordsToImport.length} words!`)
      setShowBulkImportModal(false)
      setBulkImportText('')
      loadWords()
    } catch (error) {
      console.error('Error importing words:', error)
      showNotification('error', 'Failed to import words: ' + (error as any).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <Settings className="w-6 h-6 text-gray-600" />
              <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
            </div>
            
            <div className="w-32" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            notification.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('words')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'words'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              Word Management
            </button>
          </div>
        </div>

        {/* Word Management */}
        {activeTab === 'words' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Vocabulary List Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vocabulary List
                    </label>
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a list</option>
                      {vocabularyLists.map(list => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.word_count} words)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Words
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleSearchKeyPress}
                        placeholder="Search words, definitions..."
                        className="border border-gray-300 rounded-lg px-3 py-2 pl-10 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={searchQuery ? searchWords : loadWords}
                    disabled={isLoading || !selectedListId}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {searchQuery ? 'Search' : 'Refresh'}
                  </button>
                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    disabled={!selectedListId}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Bulk Import
                  </button>
                  <button
                    onClick={() => {
                      resetForm()
                      setShowAddModal(true)
                    }}
                    disabled={!selectedListId}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Word
                  </button>
                </div>
              </div>
            </div>

            {/* Words List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Words ({words.length})
                  </h2>
                  {words.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {(() => {
                        console.log(`📊 Processing ${words.length} words for tense issues`)
                        const tenseIssues = words.filter(word => {
                          const result = checkTenseMismatch(word)
                          return result !== null
                        })
                        console.log(`🎯 Found ${tenseIssues.length} tense issues:`, tenseIssues.map(w => w.word))
                        return tenseIssues.length > 0 ? (
                          <span className="text-orange-600 font-medium">
                            ⚠️ {tenseIssues.length} tense issue{tenseIssues.length !== 1 ? 's' : ''} found
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">
                            ✅ All sentences are correct
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading words...</span>
                </div>
              ) : words.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {words.map((word) => {
                    console.log(`🎨 Rendering word: "${word.word}"`)
                    const tenseIssue = checkTenseMismatch(word)
                    const hasTenseIssue = tenseIssue !== null
                    console.log(`🎨 Has tense issue: ${hasTenseIssue}, issue: ${tenseIssue}`)
                    
                    return (
                      <div 
                        key={word.id} 
                        className={`p-6 hover:bg-gray-50/50 transition-colors ${
                          hasTenseIssue ? 'border-l-4 border-orange-400 bg-orange-50/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{word.word}</h3>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                {word.part_of_speech}
                              </span>
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Level {word.difficulty_level}
                              </span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                                SSAT {word.ssat_importance}
                              </span>
                              {hasTenseIssue && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                  ⚠️ Tense Issue
                                </span>
                              )}
                            </div>
                            
                            <p className="text-gray-700 mb-2">
                              <span className="font-medium">Definition:</span> {word.definition}
                            </p>
                            
                            <div className="text-gray-600 mb-3">
                              <span className="font-medium">Example:</span> 
                              {hasTenseIssue ? (
                                <div className="mt-1">
                                  <p className="italic">{word.example_sentence}</p>
                                  <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
                                    <p className="text-yellow-800">
                                      <span className="font-medium">⚠️ Tense Mismatch:</span> 
                                      {tenseIssue === 'not_found' 
                                        ? ` Word "${word.word}" not found in sentence`
                                        : ` Found "${tenseIssue}" instead of "${word.word}"`
                                      }
                                    </p>
                                    <p className="text-yellow-700 text-xs mt-1">
                                      This will cause issues with fill-in-the-blank questions.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="italic"> {word.example_sentence}</span>
                              )}
                            </div>
                          
                          {(word.synonyms && word.synonyms.length > 0) && (
                            <p className="text-gray-600 mb-1">
                              <span className="font-medium">Synonyms:</span> {word.synonyms.join(', ')}
                            </p>
                          )}
                          
                          {(word.antonyms && word.antonyms.length > 0) && (
                            <p className="text-gray-600 mb-1">
                              <span className="font-medium">Antonyms:</span> {word.antonyms.join(', ')}
                            </p>
                          )}
                          
                          {word.pronunciation_guide && (
                            <p className="text-gray-600 mb-1">
                              <span className="font-medium">Pronunciation:</span> {word.pronunciation_guide}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {word.audio_url && (
                            <button className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors">
                              <Volume2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(word)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteWord(word.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {selectedListId ? 'No words found' : 'Please select a vocabulary list'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Word Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">Add New Word</h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* AI Generation */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">🤖 Smart Word Generation</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      placeholder="Enter a word..."
                      className="flex-1 border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={generateAIContent}
                      disabled={generatingAI || !newWord.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {generatingAI ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Generate
                    </button>
                  </div>
                  <p className="text-blue-700 text-sm mt-2">
                    Enter any word and we'll automatically generate age-appropriate definitions, examples, and more!
                  </p>
                </div>

                {/* Word Form */}
                <WordForm
                  formData={formData}
                  setFormData={setFormData}
                  addSynonym={addSynonym}
                  removeSynonym={removeSynonym}
                  updateSynonym={updateSynonym}
                  addAntonym={addAntonym}
                  removeAntonym={removeAntonym}
                  updateAntonym={updateAntonym}
                />

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addWord}
                    disabled={isLoading || !formData.word.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Add Word
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Word Modal */}
        {showEditModal && editingWord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">Edit Word: {editingWord.word}</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingWord(null)
                      resetForm()
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <WordForm
                  formData={formData}
                  setFormData={setFormData}
                  addSynonym={addSynonym}
                  removeSynonym={removeSynonym}
                  updateSynonym={updateSynonym}
                  addAntonym={addAntonym}
                  removeAntonym={removeAntonym}
                  updateAntonym={updateAntonym}
                />

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingWord(null)
                      resetForm()
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateWord}
                    disabled={isLoading || !formData.word.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Update Word
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">Bulk Import Words</h2>
                  <button
                    onClick={() => {
                      setShowBulkImportModal(false)
                      setBulkImportText('')
                      setBulkImportFormat('simple')
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Import Format</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="simple"
                        checked={bulkImportFormat === 'simple'}
                        onChange={(e) => setBulkImportFormat(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Simple (One word per line + AI generation)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="csv"
                        checked={bulkImportFormat === 'csv'}
                        onChange={(e) => setBulkImportFormat(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">CSV Format</span>
                    </label>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">📋 Import Instructions</h3>
                  {bulkImportFormat === 'simple' ? (
                    <div className="text-blue-700 text-sm space-y-1">
                      <p><strong>Simple Format:</strong> Enter one word per line. AI will automatically generate:</p>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Age-appropriate definition</li>
                        <li>Educational example sentence</li>
                        <li>Part of speech</li>
                        <li>Difficulty level & SSAT importance</li>
                        <li>Synonyms, antonyms, and pronunciation</li>
                      </ul>
                      <p className="mt-2"><strong>Example:</strong></p>
                      <pre className="bg-blue-100 p-2 rounded text-xs">collaborate\nexplore\ninvestigate\ndemonstrate</pre>
                    </div>
                  ) : (
                    <div className="text-blue-700 text-sm space-y-1">
                      <p><strong>CSV Format:</strong> word,part_of_speech,definition,example_sentence</p>
                      <p><strong>Example:</strong></p>
                      <pre className="bg-blue-100 p-2 rounded text-xs">collaborate,verb,to work together with others,Students collaborate on science projects.\nexplore,verb,to search and discover,We will explore the forest trail.</pre>
                    </div>
                  )}
                </div>

                {/* Text Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {bulkImportFormat === 'simple' ? 'Words to Import (one per line)' : 'CSV Data'}
                  </label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    rows={12}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                    placeholder={bulkImportFormat === 'simple' 
                      ? 'collaborate\nexplore\ninvestigate\ndemonstrate'
                      : 'collaborate,verb,to work together with others,Students collaborate on science projects.\nexplore,verb,to search and discover,We will explore the forest trail.'
                    }
                  />
                </div>

                {/* Preview */}
                {bulkImportText.trim() && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-700 mb-2">Preview</h3>
                    <p className="text-sm text-gray-600">
                      {bulkImportFormat === 'simple' 
                        ? `${bulkImportText.trim().split('\n').filter(line => line.trim()).length} words will be processed with AI generation`
                        : `${bulkImportText.trim().split('\n').length} CSV entries detected`
                      }
                    </p>
                    {bulkImportFormat === 'simple' && (
                      <p className="text-xs text-yellow-600 mt-1">
                        ⚠️ AI generation may take a few moments for each word
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowBulkImportModal(false)
                      setBulkImportText('')
                      setBulkImportFormat('simple')
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processBulkImport}
                    disabled={isLoading || !bulkImportText.trim()}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        {bulkImportFormat === 'simple' ? 'Generating with AI...' : 'Importing...'}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import Words
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Word Form Component
interface WordFormProps {
  formData: WordFormData
  setFormData: React.Dispatch<React.SetStateAction<WordFormData>>
  addSynonym: () => void
  removeSynonym: (index: number) => void
  updateSynonym: (index: number, value: string) => void
  addAntonym: () => void
  removeAntonym: (index: number) => void
  updateAntonym: (index: number, value: string) => void
}

function WordForm({ 
  formData, 
  setFormData,
  addSynonym,
  removeSynonym,
  updateSynonym,
  addAntonym,
  removeAntonym,
  updateAntonym
}: WordFormProps) {
  return (
    <div className="space-y-4">
      {/* Basic Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Word</label>
          <input
            type="text"
            value={formData.word}
            onChange={(e) => setFormData(prev => ({ ...prev, word: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter the word"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Part of Speech</label>
          <select
            value={formData.part_of_speech}
            onChange={(e) => setFormData(prev => ({ ...prev, part_of_speech: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="noun">Noun</option>
            <option value="verb">Verb</option>
            <option value="adjective">Adjective</option>
            <option value="adverb">Adverb</option>
            <option value="pronoun">Pronoun</option>
            <option value="preposition">Preposition</option>
            <option value="conjunction">Conjunction</option>
            <option value="interjection">Interjection</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Definition</label>
        <textarea
          value={formData.definition}
          onChange={(e) => setFormData(prev => ({ ...prev, definition: e.target.value }))}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Age-appropriate definition (8-12 years old)"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Example Sentence</label>
        <textarea
          value={formData.example_sentence}
          onChange={(e) => setFormData(prev => ({ ...prev, example_sentence: e.target.value }))}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Educational and contextual example sentence"
        />
      </div>
      
      {/* Synonyms */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Synonyms</label>
          <button
            onClick={addSynonym}
            type="button"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Add Synonym
          </button>
        </div>
        <div className="space-y-2">
          {formData.synonyms.map((synonym, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={synonym}
                onChange={(e) => updateSynonym(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Synonym"
              />
              <button
                onClick={() => removeSynonym(index)}
                type="button"
                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Antonyms */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Antonyms</label>
          <button
            onClick={addAntonym}
            type="button"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Add Antonym
          </button>
        </div>
        <div className="space-y-2">
          {formData.antonyms.map((antonym, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={antonym}
                onChange={(e) => updateAntonym(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Antonym"
              />
              <button
                onClick={() => removeAntonym(index)}
                type="button"
                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Difficulty and Importance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
          <select
            value={formData.difficulty_level}
            onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: parseInt(e.target.value) }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 - Very Easy</option>
            <option value={2}>2 - Easy</option>
            <option value={3}>3 - Moderate</option>
            <option value={4}>4 - Challenging</option>
            <option value={5}>5 - Very Difficult</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SSAT Importance</label>
          <select
            value={formData.ssat_importance}
            onChange={(e) => setFormData(prev => ({ ...prev, ssat_importance: parseInt(e.target.value) }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 - Low</option>
            <option value={2}>2 - Moderate</option>
            <option value={3}>3 - Common</option>
            <option value={4}>4 - High</option>
            <option value={5}>5 - Essential</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frequency Score</label>
          <select
            value={formData.frequency_score}
            onChange={(e) => setFormData(prev => ({ ...prev, frequency_score: parseInt(e.target.value) }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 - Rare</option>
            <option value={2}>2 - Uncommon</option>
            <option value={3}>3 - Common</option>
            <option value={4}>4 - Frequent</option>
            <option value={5}>5 - Very Frequent</option>
          </select>
        </div>
      </div>
      
      {/* Optional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pronunciation Guide</label>
          <input
            type="text"
            value={formData.pronunciation_guide}
            onChange={(e) => setFormData(prev => ({ ...prev, pronunciation_guide: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., KOL-ab-uh-rate"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Usage Notes</label>
          <input
            type="text"
            value={formData.usage_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, usage_notes: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional usage tips"
          />
        </div>
      </div>
    </div>
  )
}