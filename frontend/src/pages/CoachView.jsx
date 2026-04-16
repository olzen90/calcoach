import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Camera, Mic, MicOff, Send, Sparkles, Scale, Ruler, Dumbbell, CheckCircle, ChevronDown, ChevronUp, MessageCircle, Pencil, X, Plus } from 'lucide-react'
import { useTodayMeals, useApi } from '../hooks/useApi'
import CalorieRing from '../components/CalorieRing'
import ProteinDisplay from '../components/ProteinDisplay'
import MacroChart from '../components/MacroChart'
import CoachChat from '../components/CoachChat'
import VoiceInput from '../components/VoiceInput'
import CameraCapture from '../components/CameraCapture'

export default function CoachView() {
  const { pathname } = useLocation()
  const isVisible = pathname === '/'

  const [searchParams, setSearchParams] = useSearchParams()
  const { meals, loading, error, refresh, setMeals } = useTodayMeals()
  const { uploadFile, get, post } = useApi()
  const [feed, setFeed] = useState(null)
  const [weeklyTrajectory, setWeeklyTrajectory] = useState(null)
  
  const [input, setInput] = useState(() => sessionStorage.getItem('coach_draft') || '')
  const [inputHeight, setInputHeight] = useState(() => parseInt(sessionStorage.getItem('coach_draft_height') || '58', 10))
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [lastEntry, setLastEntry] = useState(null)
  const [showMacros, setShowMacros] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState('en-US')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingEntries, setPendingEntries] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)
  
  const textareaRef = useRef(null)
  const logContainerRef = useRef(null)
  const voiceInputRef = useRef(null)
  
  const fetchFeed = async () => {
    try {
      const data = await get('/meals/feed/today')
      setFeed(data)
    } catch (err) {
      console.error('Failed to fetch feed:', err)
    }
  }
  
  const fetchWeeklyTrajectory = async () => {
    try {
      const data = await get('/stats/weekly-trajectory')
      setWeeklyTrajectory(data)
    } catch (err) {
      console.error('Failed to fetch weekly trajectory:', err)
    }
  }
  
  useEffect(() => {
    const init = async () => {
      const [coachResult, settingsResult] = await Promise.allSettled([
        get('/meals/coach-init'),
        get('/settings/'),
      ])

      if (coachResult.status === 'fulfilled') {
        const data = coachResult.value
        if (data.today) setMeals(data.today)
        if (data.feed) setFeed(data.feed)
        if (data.weekly_trajectory) setWeeklyTrajectory(data.weekly_trajectory)
      } else {
        console.error('Failed to load coach data:', coachResult.reason)
        refresh()
      }

      if (settingsResult.status === 'fulfilled') {
        const settings = settingsResult.value
        if (settings.voice_language) setVoiceLanguage(settings.voice_language)
      }
    }
    init()
  }, [])
  
  // Handle PWA shortcut actions from URL
  useEffect(() => {
    const action = searchParams.get('action')
    if (action) {
      // Clear the action from URL to prevent re-triggering
      setSearchParams({}, { replace: true })
      
      // Set pending action to be executed after component is ready
      setPendingAction(action)
    }
  }, [searchParams, setSearchParams])
  
  // Execute pending action after component is fully mounted
  useEffect(() => {
    if (!pendingAction || loading) return
    
    const executeAction = async () => {
      switch (pendingAction) {
        case 'camera':
          setShowCamera(true)
          break
        case 'voice':
          // Small delay to ensure voice input is ready
          setTimeout(() => {
            setIsRecording(true)
            // Trigger voice recording via the VoiceInput component
            if (voiceInputRef.current) {
              voiceInputRef.current.click()
            }
          }, 500)
          break
        case 'log':
          // Focus the text input
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus()
            }
          }, 300)
          break
      }
      setPendingAction(null)
    }
    
    executeAction()
  }, [pendingAction, loading])
  
  // Detect keyboard opening on mobile (especially Android) using visualViewport API
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return // Not supported (older browsers)
    
    const handleResize = () => {
      // Calculate keyboard height as difference between window height and visual viewport height
      // Add viewport offset to account for any scrolling
      const keyboardH = window.innerHeight - viewport.height - viewport.offsetTop
      // Only set if keyboard is actually showing (threshold to avoid small fluctuations)
      setKeyboardHeight(keyboardH > 50 ? keyboardH : 0)
    }
    
    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)
    
    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
    }
  }, [])
  
  const handleCameraCapture = (file, preview) => {
    setImage(file)
    setImagePreview(preview)
    setShowCamera(false)
  }
  
  const clearImage = () => {
    setImage(null)
    setImagePreview(null)
  }
  
  // Calculate current calorie budget (weekly-adjusted or daily)
  const getCalorieBudget = () => {
    if (weeklyTrajectory?.mode === 'weekly' && weeklyTrajectory?.trajectory) {
      return weeklyTrajectory.trajectory.daily_budget_remaining
    }
    return meals?.calorie_goal || 2000
  }
  
  const getCaloriesRemaining = () => {
    const budget = getCalorieBudget()
    const consumed = meals?.total_calories || 0
    return budget - consumed
  }
  
  // Processes an entry in the background - does not block the input UI.
  // Called without await so the caller returns immediately.
  const processEntry = async (entryId, description, imageFile, confirmedAnalysis = null) => {
    try {
      const formData = new FormData()
      formData.append('description', description || 'Food from image')
      if (imageFile) formData.append('image', imageFile)
      const now = new Date()
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      formData.append('local_time', localTime)

      if (!confirmedAnalysis) {
        formData.append('preview', 'true')
        const preview = await uploadFile('/meals/analyze', formData)

        if (preview.entry_type === 'meal' && preview.preview) {
          const mealCalories = preview.meal?.calories || 0
          const remaining = getCaloriesRemaining()

          if (mealCalories > remaining) {
            setPendingEntries(prev => prev.map(e =>
              e.id === entryId ? {
                ...e,
                status: 'over_budget',
                overBudget: {
                  meal: preview.meal,
                  calories: mealCalories,
                  budgetRemaining: Math.max(0, remaining),
                  imageFile,
                  description,
                  confirmedAnalysis: preview.analysis
                }
              } : e
            ))
            return
          }
        }
        formData.delete('preview')
      } else {
        formData.append('confirmed_analysis', JSON.stringify(confirmedAnalysis))
      }

      const result = await uploadFile('/meals/analyze', formData)

      setPendingEntries(prev => prev.filter(e => e.id !== entryId))

      const entryType = result.entry_type || 'meal'

      if (entryType !== 'question') {
        setLastEntry({
          type: entryType,
          data: result.entry || result.meal,
          analysis: result.analysis
        })
        setTimeout(() => setLastEntry(null), 4000)
      }

      if (entryType === 'meal' || entryType === 'edit' || entryType === 'merge') {
        await refresh()
        fetchWeeklyTrajectory()
      }
      await fetchFeed()

      if (isVisible) {
        setTimeout(() => {
          const sortOrder = localStorage.getItem('coach_sort_order') || 'asc'
          window.scrollTo({
            top: sortOrder === 'desc' ? 0 : document.body.scrollHeight,
            behavior: 'smooth'
          })
        }, 100)
      }
    } catch (err) {
      console.error('Failed to log entry:', err)
      const message = err?.response?.data?.detail || err?.message || 'Failed to analyze meal. Please try again.'
      setPendingEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, status: 'error', errorMsg: message } : e
      ))
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!input.trim() && !image) return

    if (isRecording) setIsRecording(false)

    const entryId = Date.now()
    const submittedInput = input
    const submittedImage = image
    const submittedPreview = imagePreview

    // Clear both text and image immediately so the field is ready for the next entry
    setInput('')
    setInputHeight(58)
    sessionStorage.removeItem('coach_draft')
    sessionStorage.removeItem('coach_draft_height')
    if (textareaRef.current) textareaRef.current.style.height = '58px'
    clearImage()

    // Track this request in the pending queue
    setPendingEntries(prev => [...prev, {
      id: entryId,
      text: submittedInput,
      imagePreview: submittedPreview,
      status: 'analyzing'
    }])

    // Fire and forget - input is unblocked immediately
    processEntry(entryId, submittedInput, submittedImage)
  }

  const handleConfirmOverBudget = (entryId) => {
    const entry = pendingEntries.find(e => e.id === entryId)
    if (!entry?.overBudget) return

    setPendingEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, status: 'analyzing', overBudget: null } : e
    ))
    processEntry(entryId, entry.overBudget.description, entry.overBudget.imageFile, entry.overBudget.confirmedAnalysis)
  }

  const handleDismissEntry = (entryId) => {
    setPendingEntries(prev => prev.filter(e => e.id !== entryId))
  }
  
  const handleVoiceResult = (text) => {
    setInput(prev => {
      const next = prev + (prev ? ' ' : '') + text
      sessionStorage.setItem('coach_draft', next)
      return next
    })
  }
  
  // Auto-resize textarea when input changes (e.g., from voice input)
  useLayoutEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current
      el.style.height = '58px'
      const newHeight = Math.min(el.scrollHeight, 120)
      el.style.height = newHeight + 'px'
      el.scrollTop = el.scrollHeight
      setInputHeight(newHeight)
      if (input) sessionStorage.setItem('coach_draft_height', String(newHeight))
    }
  }, [input])

  // Prevent page scroll when scrolling inside the textarea on mobile
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    const onTouchMove = (e) => {
      if (el.scrollHeight > el.clientHeight) {
        e.stopPropagation()
      }
    }

    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])
  
  if (loading && !meals && isVisible) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-bounce">
          <Sparkles className="w-12 h-12 text-primary-500" />
        </div>
      </div>
    )
  }
  
  return (
    <>
    <div className="max-w-lg mx-auto px-4 py-6 pb-24" ref={logContainerRef}>
        {/* Header with calorie and protein display */}
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-gradient-primary mb-4">
            Today's Progress
          </h1>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Calorie Ring - use weekly adjusted budget if in weekly mode */}
            <div className="card flex flex-col items-center">
              <CalorieRing 
                consumed={meals?.total_calories || 0}
                goal={
                  weeklyTrajectory?.mode === 'weekly' && weeklyTrajectory?.trajectory
                    ? weeklyTrajectory.trajectory.daily_budget_remaining
                    : (meals?.calorie_goal || 2000)
                }
              />
              <p className="text-sm text-gray-500 mt-2">
                {weeklyTrajectory?.mode === 'weekly' ? 'Today\'s Budget' : 'Calories'}
              </p>
            </div>
            
            {/* Protein Priority Display */}
            <div className="card flex flex-col items-center">
              <ProteinDisplay
                consumed={meals?.total_protein_g || 0}
                goal={meals?.protein_goal_g || 150}
              />
              <p className="text-sm text-gray-500 mt-2">Protein</p>
            </div>
          </div>
          
          {/* Macro breakdown - collapsible */}
          <div className="bg-white rounded-3xl shadow-playful mt-4 overflow-hidden">
            <button 
              onClick={() => setShowMacros(!showMacros)}
              className="w-full p-6 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-600">Macro Breakdown</span>
              {showMacros ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {showMacros && (
              <div className="px-6 pb-6">
                <MacroChart
                  protein={meals?.total_protein_g || 0}
                  carbs={meals?.total_carbs_g || 0}
                  fat={meals?.total_fat_g || 0}
                  sugar={meals?.total_sugar_g || 0}
                  fiber={meals?.total_fiber_g || 0}
                  sodium={(meals?.total_sodium_mg || 0) / 1000}
                  proteinGoal={meals?.protein_goal_g || 150}
                  carbsGoal={meals?.carbs_goal_g || 200}
                  fatGoal={meals?.fat_goal_g || 70}
                  sugarGoal={meals?.sugar_goal_g || 50}
                  fiberGoal={meals?.fiber_goal_g || 30}
                  sodiumGoal={(meals?.sodium_goal_mg || 2300) / 1000}
                  showExtended={true}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Meal log / chat */}
        <div>
          <h2 className="text-lg font-display font-semibold text-gray-800 mb-3">
            Today's Log
          </h2>
          <CoachChat 
            feed={feed?.feed || []}
            meals={meals?.meals || []}
            onRefresh={() => { refresh(); fetchFeed(); }}
          />
        </div>
      </div>
      
      {/* Always-visible portal: pending entries banner - shows on any page while processing */}
      {pendingEntries.length > 0 && createPortal(
        <PendingBanner
          entries={pendingEntries}
          onConfirm={handleConfirmOverBudget}
          onDismiss={handleDismissEntry}
          bottomOffset={isVisible
            ? (keyboardHeight > 0 ? `${keyboardHeight + 88}px` : '152px')
            : '80px'
          }
        />,
        document.body
      )}

      {/* Conditional portal: input form, toasts, camera - only when Coach is the active page */}
      {isVisible && createPortal(
        <>
          {/* Entry feedback toast */}
          {lastEntry && (
            <div 
              className="fixed left-4 right-4 max-w-lg mx-auto z-50 animate-scale-in transition-[bottom] duration-150"
              style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight + 80}px` : '144px' }}
            >
          <div className={`rounded-2xl p-4 shadow-lg ${
            lastEntry.type === 'meal' ? 'bg-green-50 border border-green-200' :
            lastEntry.type === 'edit' ? 'bg-yellow-50 border border-yellow-200' :
            lastEntry.type === 'weight' ? 'bg-blue-50 border border-blue-200' :
            lastEntry.type === 'lift' ? 'bg-orange-50 border border-orange-200' :
            'bg-purple-50 border border-purple-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                lastEntry.type === 'meal' ? 'bg-green-100' :
                lastEntry.type === 'edit' ? 'bg-yellow-100' :
                lastEntry.type === 'weight' ? 'bg-blue-100' :
                lastEntry.type === 'lift' ? 'bg-orange-100' :
                'bg-purple-100'
              }`}>
                {lastEntry.type === 'meal' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {lastEntry.type === 'edit' && <Sparkles className="w-5 h-5 text-yellow-600" />}
                {lastEntry.type === 'weight' && <Scale className="w-5 h-5 text-blue-600" />}
                {lastEntry.type === 'lift' && <Dumbbell className="w-5 h-5 text-orange-600" />}
                {lastEntry.type === 'measurement' && <Ruler className="w-5 h-5 text-purple-600" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {lastEntry.type === 'meal' && `Logged: ${lastEntry.analysis?.food_name}`}
                  {lastEntry.type === 'edit' && `Updated: ${lastEntry.data?.description}`}
                  {lastEntry.type === 'weight' && `Weight logged: ${lastEntry.data?.weight_kg} kg`}
                  {lastEntry.type === 'lift' && `${lastEntry.data?.exercise_name}: ${lastEntry.data?.weight_kg}kg × ${lastEntry.data?.reps}`}
                  {lastEntry.type === 'measurement' && `Waist logged: ${lastEntry.data?.waist_cm} cm`}
                </p>
                {lastEntry.analysis?.notes && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{lastEntry.analysis.notes}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Error message toast */}
      {errorMessage && (
        <div 
          className="fixed left-4 right-4 max-w-lg mx-auto z-50 animate-scale-in transition-[bottom] duration-150"
          style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight + 80}px` : '144px' }}
        >
          <div className="rounded-2xl p-4 shadow-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-100">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">Analysis Failed</p>
                <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
              </div>
              <button 
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Blur overlay between input and bottom nav */}
      <div 
        className="fixed left-0 right-0 h-20 pointer-events-none bg-gradient-to-t from-[#f8f4f1] via-[#f8f4f1]/80 to-transparent backdrop-blur-sm transition-[bottom] duration-150" 
        style={{ zIndex: 40, bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '64px' }} 
      />
      
      {/* Input area - floats above keyboard when open */}
      <div 
        className="fixed left-0 right-0 px-4 transition-[bottom] duration-150" 
        style={{ zIndex: 45, bottom: keyboardHeight > 0 ? `${keyboardHeight + 8}px` : '80px' }}
      >
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
          {/* ChatGPT-style unified input field */}
          <div className="relative w-full border rounded-2xl shadow-lg transition-colors bg-white border-gray-200">
            
            {/* Image preview inside input - ChatGPT style */}
            {imagePreview && (
              <div className="p-3 pb-0">
                <div className="relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Food preview" 
                    className="max-w-[200px] max-h-[180px] object-cover rounded-xl border border-gray-200"
                  />
                  {/* Edit and remove buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="w-8 h-8 bg-black/70 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="w-8 h-8 bg-black/70 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Input row with buttons */}
            <div className="relative flex items-center">
              {/* Plus/Camera button - left side */}
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="absolute left-3 p-1 transition-colors text-gray-400 hover:text-gray-600"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              {/* Text input - expandable textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  const val = e.target.value
                  setInput(val)
                  if (val) sessionStorage.setItem('coach_draft', val)
                  else sessionStorage.removeItem('coach_draft')
                  e.target.style.height = '58px'
                  const newHeight = Math.min(e.target.scrollHeight, 120)
                  e.target.style.height = newHeight + 'px'
                  setInputHeight(newHeight)
                  if (val) sessionStorage.setItem('coach_draft_height', String(newHeight))
                  else sessionStorage.removeItem('coach_draft_height')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={imagePreview ? "Ask anything" : "Log or ask anything..."}
                className="w-full resize-none bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 pl-12 pr-24 scrollbar-hide"
                style={{ height: `${inputHeight}px`, minHeight: '58px', maxHeight: '120px', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingTop: '1rem', paddingBottom: '1rem' }}
                rows={1}
              />
              
              {/* Right side buttons */}
              <div className="absolute right-3 flex items-center gap-1">
                {/* Voice input */}
                <VoiceInput 
                  ref={voiceInputRef}
                  onResult={handleVoiceResult}
                  onSendCommand={() => handleSubmit()}
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  language={voiceLanguage}
                />
                
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() && !image}
                  className={`p-1.5 rounded-full transition-colors
                    ${(input.trim() || image)
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'text-gray-300'}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
      
          {/* Camera capture modal */}
          {showCamera && (
            <CameraCapture
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          )}
          
        </>,
        document.body
      )}
    </>
  )
}

function PendingBanner({ entries, onConfirm, onDismiss, bottomOffset }) {
  const overBudgetEntry = entries.find(e => e.status === 'over_budget')
  const errorEntries = entries.filter(e => e.status === 'error')
  const analyzingEntries = entries.filter(e => e.status === 'analyzing')

  return (
    <div
      className="fixed left-4 right-4 max-w-lg mx-auto z-50 space-y-2 pointer-events-none transition-[bottom] duration-150"
      style={{ bottom: bottomOffset }}
    >
      {/* Error cards */}
      {errorEntries.map(entry => (
        <div key={entry.id} className="pointer-events-auto bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-3 shadow-md">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Analysis failed</p>
            <p className="text-xs text-red-600 mt-0.5 line-clamp-2">{entry.errorMsg}</p>
          </div>
          <button onClick={() => onDismiss(entry.id)} className="text-red-400 hover:text-red-600 p-0.5 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Over-budget confirmation card */}
      {overBudgetEntry && (
        <div className="pointer-events-auto bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-md">
          <div className="flex items-start gap-3 mb-3">
            <div className="text-xl leading-none">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Over your calorie budget</p>
              <p className="text-xs text-gray-600 mt-0.5">
                This meal is{' '}
                <span className="font-semibold text-red-600">{Math.round(overBudgetEntry.overBudget.calories)} cal</span>
                {' '}but you only have{' '}
                <span className="font-semibold">{Math.round(overBudgetEntry.overBudget.budgetRemaining)} cal</span> remaining
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onDismiss(overBudgetEntry.id)}
              className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Skip it
            </button>
            <button
              onClick={() => onConfirm(overBudgetEntry.id)}
              className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Log anyway
            </button>
          </div>
        </div>
      )}

      {/* Analyzing indicator */}
      {analyzingEntries.length > 0 && (
        <div className="pointer-events-auto bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-md flex items-center gap-3">
          {analyzingEntries[analyzingEntries.length - 1].imagePreview ? (
            <img
              src={analyzingEntries[analyzingEntries.length - 1].imagePreview}
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              alt=""
            />
          ) : (
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {analyzingEntries[analyzingEntries.length - 1].text && (
              <p className="text-sm text-gray-700 truncate">{analyzingEntries[analyzingEntries.length - 1].text}</p>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin inline-block flex-shrink-0" />
              AI is analyzing{analyzingEntries.length > 1 ? ` · ${analyzingEntries.length} entries` : '...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
