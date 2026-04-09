import { useState, useEffect } from 'react'
import { useSettings, useApi } from '../hooks/useApi'
import { 
  User, Target, Brain, Database, Calculator, Save, 
  ChevronDown, Trash2, Plus, AlertCircle, CheckCircle, Mic
} from 'lucide-react'

export default function SettingsView() {
  const { settings, loading, error, refresh } = useSettings()
  const { put, post, get, del } = useApi()
  
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const formatSodiumG = (mg) => {
    const grams = (mg ?? 0) / 1000
    return grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)
  }
  
  const sodiumMgFromG = (value) => Math.round((parseFloat(value) || 0) * 1000)
  
  // Form states
  const [profile, setProfile] = useState({
    name: '',
    age: '',
    weight_kg: '',
    gender: ''
  })
  
  const [goals, setGoals] = useState({
    daily_calorie_goal: '',
    calorie_focus_mode: 'daily',
    protein_goal_g: '',
    carbs_goal_g: '',
    fat_goal_g: '',
    sugar_goal_g: '',
    fiber_goal_g: '',
    sodium_goal_mg: ''
  })
  
  const [aiSettings, setAiSettings] = useState({
    base_prompt: ''
  })
  
  const [exercises, setExercises] = useState([])
  const [newExercise, setNewExercise] = useState('')
  const [storage, setStorage] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [voiceLanguage, setVoiceLanguage] = useState(() => 
    localStorage.getItem('voice_language') || 'en-US'
  )
  const [showAddFavorite, setShowAddFavorite] = useState(false)
  const [newFavorite, setNewFavorite] = useState({
    name: '',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
    auto_log: false
  })
  
  // TDEE calculator state
  const [tdeeForm, setTdeeForm] = useState({
    height_cm: '',
    activity_level: 'moderate',
    goal: 'cut'
  })
  const [tdeeResult, setTdeeResult] = useState(null)
  
  useEffect(() => {
    refresh()
    fetchExercises()
    fetchStorage()
    fetchFavorites()
  }, [])
  
  useEffect(() => {
    if (settings) {
      setProfile({
        name: settings.name || '',
        age: settings.age || '',
        weight_kg: settings.weight_kg || '',
        gender: settings.gender || ''
      })
      setGoals({
        daily_calorie_goal: settings.daily_calorie_goal || '',
        calorie_focus_mode: settings.calorie_focus_mode || 'daily',
        protein_goal_g: settings.protein_goal_g || '',
        carbs_goal_g: settings.carbs_goal_g || '',
        fat_goal_g: settings.fat_goal_g || '',
        sugar_goal_g: settings.sugar_goal_g || 50,
        fiber_goal_g: settings.fiber_goal_g || 30,
        sodium_goal_mg: settings.sodium_goal_mg || 2300
      })
      setAiSettings({
        base_prompt: settings.base_prompt || ''
      })
    }
  }, [settings])
  
  const fetchExercises = async () => {
    try {
      const data = await get('/progress/exercises')
      setExercises(data)
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }
  
  const fetchStorage = async () => {
    try {
      const data = await get('/settings/storage')
      setStorage(data)
    } catch (err) {
      console.error('Failed to fetch storage:', err)
    }
  }
  
  const fetchFavorites = async () => {
    try {
      const data = await get('/templates/')
      setFavorites(data)
    } catch (err) {
      console.error('Failed to fetch favorites:', err)
    }
  }
  
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }
  
  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await put('/settings/profile', profile)
      showMessage('Profile saved!')
      refresh()
    } catch (err) {
      showMessage('Failed to save profile', 'error')
    }
    setSaving(false)
  }
  
  const handleSaveGoals = async () => {
    setSaving(true)
    try {
      await put('/settings/goals', {
        ...goals,
        daily_calorie_goal: parseInt(goals.daily_calorie_goal),
        protein_goal_g: parseInt(goals.protein_goal_g),
        carbs_goal_g: parseInt(goals.carbs_goal_g),
        fat_goal_g: parseInt(goals.fat_goal_g)
      })
      showMessage('Goals saved!')
      refresh()
    } catch (err) {
      showMessage('Failed to save goals', 'error')
    }
    setSaving(false)
  }
  
  const handleSaveAI = async () => {
    setSaving(true)
    try {
      await put('/settings/ai', aiSettings)
      showMessage('AI settings saved!')
      refresh()
    } catch (err) {
      showMessage('Failed to save AI settings', 'error')
    }
    setSaving(false)
  }
  
  const handleCalculateTDEE = async () => {
    try {
      const result = await post('/settings/calculate-tdee', {
        age: parseInt(profile.age),
        weight_kg: parseFloat(profile.weight_kg),
        height_cm: parseFloat(tdeeForm.height_cm),
        gender: profile.gender || 'male',
        activity_level: tdeeForm.activity_level,
        goal: tdeeForm.goal
      })
      setTdeeResult(result)
    } catch (err) {
      showMessage('Failed to calculate TDEE', 'error')
    }
  }
  
  const handleApplyTDEE = () => {
    if (tdeeResult) {
      setGoals({
        ...goals,
        daily_calorie_goal: tdeeResult.recommended_calories,
        protein_goal_g: tdeeResult.recommended_protein_g,
        carbs_goal_g: tdeeResult.recommended_carbs_g,
        fat_goal_g: tdeeResult.recommended_fat_g,
        sugar_goal_g: tdeeResult.recommended_sugar_g,
        fiber_goal_g: tdeeResult.recommended_fiber_g,
        sodium_goal_mg: tdeeResult.recommended_sodium_mg
      })
      setTdeeResult(null)
      showMessage('TDEE recommendations applied!')
    }
  }
  
  const handleAddExercise = async () => {
    if (!newExercise.trim()) return
    try {
      await post('/progress/exercises', { name: newExercise })
      setNewExercise('')
      fetchExercises()
      showMessage('Exercise added!')
    } catch (err) {
      showMessage('Failed to add exercise', 'error')
    }
  }
  
  const handleDeleteExercise = async (id) => {
    if (!confirm('Delete this exercise and all its logs?')) return
    try {
      await del(`/progress/exercises/${id}`)
      fetchExercises()
      showMessage('Exercise deleted')
    } catch (err) {
      showMessage('Failed to delete exercise', 'error')
    }
  }
  
  const handleClearPhotos = async (type) => {
    const days = type === 'meals' ? 30 : 90
    if (!confirm(`Delete ${type} photos older than ${days} days?`)) return
    try {
      await del(`/settings/photos/${type}?older_than_days=${days}`)
      fetchStorage()
      showMessage('Photos cleared!')
    } catch (err) {
      showMessage('Failed to clear photos', 'error')
    }
  }
  
  const handleDeleteFavorite = async (id) => {
    if (!confirm('Delete this favorite?')) return
    try {
      await del(`/templates/${id}`)
      fetchFavorites()
      showMessage('Favorite deleted')
    } catch (err) {
      showMessage('Failed to delete favorite', 'error')
    }
  }
  
  const handleUpdateFavorite = async (id, updates) => {
    try {
      await put(`/templates/${id}`, updates)
      fetchFavorites()
      showMessage('Favorite updated')
    } catch (err) {
      showMessage('Failed to update favorite', 'error')
    }
  }
  
  const handleAddFavorite = async () => {
    if (!newFavorite.name.trim()) {
      showMessage('Please enter a name', 'error')
      return
    }
    try {
      await post('/templates/', newFavorite)
      fetchFavorites()
      showMessage('Favorite added!')
      setNewFavorite({
        name: '',
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        sugar_g: 0,
        fiber_g: 0,
        sodium_mg: 0,
        auto_log: false
      })
      setShowAddFavorite(false)
    } catch (err) {
      showMessage('Failed to add favorite', 'error')
    }
  }
  
  const handleToggleAutoLog = async (id, currentValue) => {
    try {
      await put(`/templates/${id}`, { auto_log: !currentValue })
      fetchFavorites()
      showMessage(!currentValue ? 'Auto-log enabled' : 'Auto-log disabled')
    } catch (err) {
      showMessage('Failed to update auto-log setting', 'error')
    }
  }
  
  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'ai', label: 'AI Coach', icon: Brain },
    { id: 'exercises', label: 'Exercises', icon: Target },
    { id: 'storage', label: 'Storage', icon: Database }
  ]
  
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-3xl font-display font-bold text-gradient-primary mb-6">
        Settings
      </h1>
      
      {/* Message toast */}
      {message && (
        <div className={`fixed top-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
          message.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {message.type === 'error' 
            ? <AlertCircle className="w-5 h-5" />
            : <CheckCircle className="w-5 h-5" />
          }
          {message.text}
        </div>
      )}
      
      {/* Section tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeSection === section.id
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>
      
      {/* Profile section */}
      {activeSection === 'profile' && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
          
          <div>
            <label className="block text-sm text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({...profile, name: e.target.value})}
              className="input-field"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Age</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({...profile, age: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={profile.weight_kg}
                onChange={(e) => setProfile({...profile, weight_kg: e.target.value})}
                className="input-field"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-500 mb-1">Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => setProfile({...profile, gender: e.target.value})}
              className="input-field"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary w-full">
            <Save className="w-4 h-4 mr-2 inline" />
            Save Profile
          </button>
          
          {/* Voice Language Setting */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Mic className="w-4 h-4" />
              Voice Input
            </h3>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Voice Language</label>
              <select
                value={voiceLanguage}
                onChange={(e) => {
                  setVoiceLanguage(e.target.value)
                  localStorage.setItem('voice_language', e.target.value)
                  showMessage('Voice language updated!')
                }}
                className="input-field"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="da-DK">Danish (Dansk)</option>
                <option value="de-DE">German (Deutsch)</option>
                <option value="es-ES">Spanish (Español)</option>
                <option value="fr-FR">French (Français)</option>
                <option value="it-IT">Italian (Italiano)</option>
                <option value="nl-NL">Dutch (Nederlands)</option>
                <option value="nb-NO">Norwegian (Norsk)</option>
                <option value="sv-SE">Swedish (Svenska)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Select the language for voice input dictation
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Goals section */}
      {activeSection === 'goals' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Calorie & Macro Goals</h2>
            
            <div>
              <label className="block text-sm text-gray-500 mb-1">Daily Calorie Goal</label>
              <input
                type="number"
                value={goals.daily_calorie_goal}
                onChange={(e) => setGoals({...goals, daily_calorie_goal: e.target.value})}
                className="input-field"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-500 mb-1">Calorie Focus Mode</label>
              <select
                value={goals.calorie_focus_mode}
                onChange={(e) => setGoals({...goals, calorie_focus_mode: e.target.value})}
                className="input-field"
              >
                <option value="daily">Daily (strict daily targets)</option>
                <option value="weekly">Weekly (flexible, balance across week)</option>
              </select>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Protein (g)</label>
                <input
                  type="number"
                  value={goals.protein_goal_g}
                  onChange={(e) => setGoals({...goals, protein_goal_g: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={goals.carbs_goal_g}
                  onChange={(e) => setGoals({...goals, carbs_goal_g: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Fat (g)</label>
                <input
                  type="number"
                  value={goals.fat_goal_g}
                  onChange={(e) => setGoals({...goals, fat_goal_g: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Sugar (g)</label>
                <input
                  type="number"
                  value={goals.sugar_goal_g}
                  onChange={(e) => setGoals({...goals, sugar_goal_g: e.target.value})}
                  className="input-field"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Fiber (g)</label>
                <input
                  type="number"
                  value={goals.fiber_goal_g}
                  onChange={(e) => setGoals({...goals, fiber_goal_g: e.target.value})}
                  className="input-field"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Sodium (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formatSodiumG(goals.sodium_goal_mg)}
                  onChange={(e) => setGoals({...goals, sodium_goal_mg: sodiumMgFromG(e.target.value)})}
                  className="input-field"
                  placeholder="2.3"
                />
              </div>
            </div>
            
            <button onClick={handleSaveGoals} disabled={saving} className="btn-primary w-full">
              <Save className="w-4 h-4 mr-2 inline" />
              Save Goals
            </button>
          </div>
          
          {/* TDEE Calculator */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              TDEE Calculator
            </h2>
            <p className="text-sm text-gray-500">
              Calculate recommended targets based on your stats
            </p>
            
            <div>
              <label className="block text-sm text-gray-500 mb-1">Height (cm)</label>
              <input
                type="number"
                value={tdeeForm.height_cm}
                onChange={(e) => setTdeeForm({...tdeeForm, height_cm: e.target.value})}
                className="input-field"
                placeholder="175"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-500 mb-1">Activity Level</label>
              <select
                value={tdeeForm.activity_level}
                onChange={(e) => setTdeeForm({...tdeeForm, activity_level: e.target.value})}
                className="input-field"
              >
                <option value="sedentary">Sedentary (desk job)</option>
                <option value="light">Light (1-2x/week)</option>
                <option value="moderate">Moderate (3-5x/week)</option>
                <option value="active">Active (6-7x/week)</option>
                <option value="very_active">Very Active (2x/day)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-500 mb-1">Goal</label>
              <select
                value={tdeeForm.goal}
                onChange={(e) => setTdeeForm({...tdeeForm, goal: e.target.value})}
                className="input-field"
              >
                <option value="cut">Cut (lose fat)</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk (gain muscle)</option>
              </select>
            </div>
            
            <button 
              onClick={handleCalculateTDEE}
              disabled={!profile.age || !profile.weight_kg || !tdeeForm.height_cm}
              className="btn-secondary w-full disabled:opacity-50"
            >
              Calculate
            </button>
            
            {tdeeResult && (
              <div className="bg-green-50 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">BMR</p>
                    <p className="font-bold">{tdeeResult.bmr} cal</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">TDEE</p>
                    <p className="font-bold">{tdeeResult.tdee} cal</p>
                  </div>
                </div>
                
                <div className="border-t border-green-200 pt-3">
                  <p className="text-sm text-gray-500 mb-2">Recommended for {tdeeForm.goal}:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Calories:</strong> {tdeeResult.recommended_calories}</p>
                    <p><strong>Protein:</strong> {tdeeResult.recommended_protein_g}g</p>
                    <p><strong>Carbs:</strong> {tdeeResult.recommended_carbs_g}g</p>
                    <p><strong>Fat:</strong> {tdeeResult.recommended_fat_g}g</p>
                    <p><strong>Sugar:</strong> {tdeeResult.recommended_sugar_g}g</p>
                    <p><strong>Fiber:</strong> {tdeeResult.recommended_fiber_g}g</p>
                    <p><strong>Sodium:</strong> {formatSodiumG(tdeeResult.recommended_sodium_mg)}g</p>
                  </div>
                </div>
                
                <button onClick={handleApplyTDEE} className="btn-primary w-full">
                  Apply These Goals
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* AI section */}
      {activeSection === 'ai' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">AI Coach Settings</h2>

            <div>
              <label className="block text-sm text-gray-500 mb-1">Base Prompt</label>
              <textarea
                value={aiSettings.base_prompt}
                onChange={(e) => setAiSettings({...aiSettings, base_prompt: e.target.value})}
                className="input-field min-h-[200px] text-sm"
                placeholder="Instructions for the AI coach..."
              />
            </div>
            
            <button onClick={handleSaveAI} disabled={saving} className="btn-primary w-full">
              <Save className="w-4 h-4 mr-2 inline" />
              Save AI Settings
            </button>
            
            <button 
              onClick={async () => {
                await post('/settings/reset-base-prompt')
                refresh()
                showMessage('Prompt reset to default')
              }}
              className="text-sm text-gray-500 hover:text-gray-700 w-full"
            >
              Reset to default prompt
            </button>
          </div>
          
          {/* Favorites section */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Saved Favorites</h2>
              <button
                onClick={() => setShowAddFavorite(!showAddFavorite)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <p className="text-sm text-gray-500">
              These foods are added to the AI's knowledge. When you mention them, the AI uses these exact values.
            </p>
            
            {/* Add new favorite form */}
            {showAddFavorite && (
              <div className="bg-primary-50 rounded-xl p-4 space-y-3 border border-primary-200">
                <h3 className="font-medium text-gray-800">New Favorite</h3>
                <input
                  type="text"
                  placeholder="Name (e.g., Protein Bar)"
                  value={newFavorite.name}
                  onChange={(e) => setNewFavorite({...newFavorite, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-gray-500">Calories</label>
                    <input
                      type="number"
                      value={newFavorite.calories}
                      onChange={(e) => setNewFavorite({...newFavorite, calories: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Protein</label>
                    <input
                      type="number"
                      value={newFavorite.protein_g}
                      onChange={(e) => setNewFavorite({...newFavorite, protein_g: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Carbs</label>
                    <input
                      type="number"
                      value={newFavorite.carbs_g}
                      onChange={(e) => setNewFavorite({...newFavorite, carbs_g: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Fat</label>
                    <input
                      type="number"
                      value={newFavorite.fat_g}
                      onChange={(e) => setNewFavorite({...newFavorite, fat_g: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-gray-500">Sugar</label>
                    <input
                      type="number"
                      value={newFavorite.sugar_g}
                      onChange={(e) => setNewFavorite({...newFavorite, sugar_g: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Fiber</label>
                    <input
                      type="number"
                      value={newFavorite.fiber_g}
                      onChange={(e) => setNewFavorite({...newFavorite, fiber_g: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Sodium (mg)</label>
                    <input
                      type="number"
                      value={newFavorite.sodium_mg}
                      onChange={(e) => setNewFavorite({...newFavorite, sodium_mg: parseInt(e.target.value) || 0})}
                      className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-1"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFavorite.auto_log}
                    onChange={(e) => setNewFavorite({...newFavorite, auto_log: e.target.checked})}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  Auto-log daily (automatically add this to today's log)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddFavorite}
                    className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                  >
                    Save Favorite
                  </button>
                  <button
                    onClick={() => setShowAddFavorite(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {favorites.length === 0 && !showAddFavorite ? (
              <p className="text-sm text-gray-400 italic">
                No favorites saved yet. Click "Add" above or save meals from the Coach view.
              </p>
            ) : favorites.length > 0 && (
              <div className="space-y-3">
                {favorites.map(fav => (
                  <div key={fav.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={fav.name}
                        onChange={(e) => {
                          const updated = favorites.map(f => 
                            f.id === fav.id ? {...f, name: e.target.value} : f
                          )
                          setFavorites(updated)
                        }}
                        onBlur={() => handleUpdateFavorite(fav.id, { name: fav.name })}
                        className="flex-1 text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleDeleteFavorite(fav.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Primary macros row */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-gray-400">Calories</label>
                        <input
                          type="number"
                          value={fav.calories}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, calories: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { calories: fav.calories })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400">Protein</label>
                        <input
                          type="number"
                          value={fav.protein_g}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, protein_g: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { protein_g: fav.protein_g })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400">Carbs</label>
                        <input
                          type="number"
                          value={fav.carbs_g}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, carbs_g: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { carbs_g: fav.carbs_g })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400">Fat</label>
                        <input
                          type="number"
                          value={fav.fat_g}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, fat_g: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { fat_g: fav.fat_g })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                    </div>
                    {/* Secondary macros row */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-gray-400">Sugar</label>
                        <input
                          type="number"
                          value={fav.sugar_g || 0}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, sugar_g: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { sugar_g: fav.sugar_g || 0 })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400">Fiber</label>
                        <input
                          type="number"
                          value={fav.fiber_g || 0}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, fiber_g: parseInt(e.target.value) || 0} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { fiber_g: fav.fiber_g || 0 })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-gray-400">Sodium (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formatSodiumG(fav.sodium_mg || 0)}
                          onChange={(e) => {
                            const updated = favorites.map(f => 
                              f.id === fav.id ? {...f, sodium_mg: sodiumMgFromG(e.target.value)} : f
                            )
                            setFavorites(updated)
                          }}
                          onBlur={() => handleUpdateFavorite(fav.id, { sodium_mg: fav.sodium_mg || 0 })}
                          className="w-full text-center font-medium bg-white border border-gray-200 rounded px-1 py-0.5"
                        />
                      </div>
                    </div>
                    {/* Auto-log toggle */}
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pt-1 border-t border-gray-200">
                      <input
                        type="checkbox"
                        checked={fav.auto_log || false}
                        onChange={() => handleToggleAutoLog(fav.id, fav.auto_log)}
                        className="w-3.5 h-3.5 text-primary-500 rounded"
                      />
                      <span className={fav.auto_log ? 'text-primary-600 font-medium' : ''}>
                        🔄 Auto-log daily
                      </span>
                      {fav.auto_log && <span className="text-primary-500 text-[10px]">(logged at start of each day)</span>}
                    </label>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <strong>How it works:</strong> When you log a meal, the AI sees this list and uses these exact values when it recognizes a food name. Just type the name (e.g., "proteinbar") and it knows the macros!
            </div>
          </div>
        </div>
      )}
      
      {/* Exercises section */}
      {activeSection === 'exercises' && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Tracked Exercises</h2>
          <p className="text-sm text-gray-500">
            Configure which exercises to track for strength progress
          </p>
          
          {/* Add new exercise */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newExercise}
              onChange={(e) => setNewExercise(e.target.value)}
              className="input-field flex-1"
              placeholder="New exercise name..."
            />
            <button onClick={handleAddExercise} className="btn-primary px-4">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Exercise list */}
          <div className="space-y-2">
            {exercises.map(ex => (
              <div 
                key={ex.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <span className="font-medium">{ex.name}</span>
                <button
                  onClick={() => handleDeleteExercise(ex.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Storage section */}
      {activeSection === 'storage' && storage && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Storage Management</h2>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Total Storage</span>
              <span className="font-bold">{storage.total_size_mb} MB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full"
                style={{ width: `${Math.min(storage.total_size_mb / 100 * 100, 100)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium">Meal Photos</p>
                <p className="text-sm text-gray-500">
                  {storage.meal_photos_count} photos • {storage.meal_photos_size_mb} MB
                </p>
              </div>
              <button
                onClick={() => handleClearPhotos('meals')}
                className="text-sm text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg"
              >
                Clear old
              </button>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium">Progress Photos</p>
                <p className="text-sm text-gray-500">
                  {storage.progress_photos_count} photos • {storage.progress_photos_size_mb} MB
                </p>
              </div>
              <button
                onClick={() => handleClearPhotos('progress')}
                className="text-sm text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg"
              >
                Clear old
              </button>
            </div>
          </div>
          
          <p className="text-xs text-gray-400">
            Photos are automatically converted to WebP format to save space.
            Clearing removes photos older than 30 days (meals) or 90 days (progress).
          </p>
        </div>
      )}
    </div>
  )
}
