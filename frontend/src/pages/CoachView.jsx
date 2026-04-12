import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Camera, Mic, MicOff, Send, Sparkles, Scale, Ruler, Dumbbell, CheckCircle, ChevronDown, ChevronUp, MessageCircle, Pencil, X, Plus } from 'lucide-react'
import { useTodayMeals, useApi } from '../hooks/useApi'
import CalorieRing from '../components/CalorieRing'
import ProteinDisplay from '../components/ProteinDisplay'
import MacroChart from '../components/MacroChart'
import CoachChat from '../components/CoachChat'
import VoiceInput from '../components/VoiceInput'
import CameraCapture from '../components/CameraCapture'

export default function CoachView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { meals, loading, error, refresh, setMeals } = useTodayMeals()
  const { uploadFile, get, post, loading: submitting } = useApi()
  const [feed, setFeed] = useState(null)
  const [weeklyTrajectory, setWeeklyTrajectory] = useState(null)
  
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [lastEntry, setLastEntry] = useState(null)
  const [showMacros, setShowMacros] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState('en-US')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [pendingAction, setPendingAction] = useState(null)
  const [overBudgetWarning, setOverBudgetWarning] = useState(null) // { meal, calories, budgetRemaining }
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
      try {
        const data = await get('/meals/coach-init')
        if (data.today) setMeals(data.today)
        if (data.feed) setFeed(data.feed)
        if (data.weekly_trajectory) setWeeklyTrajectory(data.weekly_trajectory)
      } catch (err) {
        console.error('Failed to load coach data:', err)
        refresh()
      }
      // Load voice language from settings
      try {
        const settings = await get('/settings/')
        if (settings.voice_language) setVoiceLanguage(settings.voice_language)
      } catch {
        // fall back to default
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
  
  const handleSubmit = async (e, skipBudgetCheck = false) => {
    e?.preventDefault()
    if (!input.trim() && !image) return
    
    try {
      const formData = new FormData()
      formData.append('description', input || 'Food from image')
      if (image) {
        formData.append('image', image)
      }
      // Send user's local time (for meals without explicit time in description)
      const now = new Date()
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      formData.append('local_time', localTime)
      
      // First, preview the meal to check calories (only for potential meal entries)
      if (!skipBudgetCheck) {
        formData.append('preview', 'true')
        const preview = await uploadFile('/meals/analyze', formData)
        
        // If it's a meal entry, check if it would exceed budget
        if (preview.entry_type === 'meal' && preview.preview) {
          const mealCalories = preview.meal?.calories || 0
          const remaining = getCaloriesRemaining()
          
          if (mealCalories > remaining) {
            // Show over-budget warning modal
            setOverBudgetWarning({
              meal: preview.meal,
              calories: mealCalories,
              budgetRemaining: Math.max(0, remaining),
              // Store input state for re-submission
              savedInput: input,
              savedImage: image,
              // Store the full analysis so we can save it directly on confirm
              confirmedAnalysis: preview.analysis
            })
            return
          }
        }
        
        // Not a meal or not over budget - continue to actual save
        formData.delete('preview')
      }
      
      // Actually save the entry
      const result = await uploadFile('/meals/analyze', formData)
      
      // Show feedback based on entry type
      const entryType = result.entry_type || 'meal'
      
      // For questions, we don't show a toast - just refresh feed
      if (entryType !== 'question') {
        setLastEntry({
          type: entryType,
          data: result.entry || result.meal,
          analysis: result.analysis
        })
        
        // Auto-hide feedback after 4 seconds
        setTimeout(() => setLastEntry(null), 4000)
      }
      
      setInput('')
      clearImage()
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '58px'
      }
      
      // Refresh data
      if (entryType === 'meal' || entryType === 'edit' || entryType === 'merge') {
        await refresh()
        // Also refresh weekly trajectory for updated budget
        fetchWeeklyTrajectory()
      }
      // Always refresh feed to include chat messages
      await fetchFeed()
      
      // Scroll to show the new entry based on sort order
      setTimeout(() => {
        const sortOrder = localStorage.getItem('coach_sort_order') || 'asc'
        window.scrollTo({
          top: sortOrder === 'desc' ? 0 : document.body.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    } catch (err) {
      console.error('Failed to log entry:', err)
      // Extract error message from API response
      const message = err?.response?.data?.detail || err?.message || 'Failed to analyze meal. Please try again.'
      setErrorMessage(message)
      // Auto-hide error after 6 seconds
      setTimeout(() => setErrorMessage(null), 6000)
    }
  }
  
  const handleConfirmOverBudget = async () => {
    if (!overBudgetWarning) return
    
    // Restore input state and submit without budget check
    setInput(overBudgetWarning.savedInput)
    if (overBudgetWarning.savedImage) {
      setImage(overBudgetWarning.savedImage)
    }
    setOverBudgetWarning(null)
    
    // Create new FormData and submit directly, passing the already-analyzed data
    // to avoid a second AI call that could return different calorie estimates
    const formData = new FormData()
    formData.append('description', overBudgetWarning.savedInput || 'Food from image')
    if (overBudgetWarning.savedImage) {
      formData.append('image', overBudgetWarning.savedImage)
    }
    // Send user's local time
    const now = new Date()
    const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    formData.append('local_time', localTime)
    if (overBudgetWarning.confirmedAnalysis) {
      formData.append('confirmed_analysis', JSON.stringify(overBudgetWarning.confirmedAnalysis))
    }
    
    try {
      const result = await uploadFile('/meals/analyze', formData)
      
      const entryType = result.entry_type || 'meal'
      
      if (entryType !== 'question') {
        setLastEntry({
          type: entryType,
          data: result.entry || result.meal,
          analysis: result.analysis
        })
        setTimeout(() => setLastEntry(null), 4000)
      }
      
      setInput('')
      clearImage()
      if (textareaRef.current) {
        textareaRef.current.style.height = '58px'
      }
      
      if (entryType === 'meal' || entryType === 'edit' || entryType === 'merge') {
        await refresh()
        fetchWeeklyTrajectory()
      }
      await fetchFeed()
      
      setTimeout(() => {
        const sortOrder = localStorage.getItem('coach_sort_order') || 'asc'
        window.scrollTo({
          top: sortOrder === 'desc' ? 0 : document.body.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    } catch (err) {
      console.error('Failed to log entry:', err)
      const message = err?.response?.data?.detail || err?.message || 'Failed to analyze meal. Please try again.'
      setErrorMessage(message)
      setTimeout(() => setErrorMessage(null), 6000)
    }
  }
  
  const handleCancelOverBudget = () => {
    setOverBudgetWarning(null)
    // Keep the input so user can modify it
  }
  
  const handleVoiceResult = (text) => {
    setInput(prev => prev + (prev ? ' ' : '') + text)
  }
  
  // Auto-resize textarea when input changes (e.g., from voice input)
  useLayoutEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current
      el.style.height = '58px'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
      el.scrollTop = el.scrollHeight
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
  
  if (loading && !meals) {
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
      
      {/* Portal for fixed elements - renders outside SwipeablePages transform */}
      {createPortal(
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
          <div className={`relative w-full border rounded-2xl shadow-lg transition-colors ${submitting ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}>
            
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
                disabled={submitting}
                className={`absolute left-3 p-1 transition-colors ${submitting ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Plus className="w-5 h-5" />
              </button>
              
              {/* Text input - expandable textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = '58px'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={imagePreview ? "Ask anything" : "Log or ask anything..."}
                className="w-full resize-none bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 pl-12 pr-24 scrollbar-hide"
                style={{ minHeight: '58px', maxHeight: '120px', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingTop: '1rem', paddingBottom: '1rem' }}
                disabled={submitting}
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
                  disabled={submitting || (!input.trim() && !image)}
                  className={`p-1.5 rounded-full transition-colors
                    ${submitting 
                      ? 'bg-primary-500 text-white'
                      : (input.trim() || image)
                        ? 'bg-primary-500 text-white hover:bg-primary-600' 
                        : 'text-gray-300'}`}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
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
          
          {/* Over-budget warning modal */}
          {overBudgetWarning && (
            <div 
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
              onClick={handleCancelOverBudget}
            >
              <div 
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-900">Over Budget</h3>
                </div>
                
                <div className="text-center mb-6">
                  <p className="text-gray-600 mb-3">
                    This meal is <span className="font-semibold text-red-600">{Math.round(overBudgetWarning.calories)} cal</span>
                  </p>
                  <p className="text-gray-600">
                    You only have <span className="font-semibold text-gray-900">{Math.round(overBudgetWarning.budgetRemaining)} cal</span> remaining today
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Logging this will put you{' '}
                    <span className="font-medium text-red-600">
                      {Math.round(overBudgetWarning.calories - overBudgetWarning.budgetRemaining)} cal
                    </span>{' '}
                    over budget
                  </p>
                </div>
                
                <p className="text-center text-gray-700 font-medium mb-4">
                  Are you sure you want to eat this?
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelOverBudget}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    No, skip it
                  </button>
                  <button
                    onClick={handleConfirmOverBudget}
                    className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                  >
                    Yes, log it
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  )
}
