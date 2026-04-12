import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Edit2, Trash2, Save, X, Bookmark, ChevronDown, ChevronUp, Bot, User, ArrowUpDown, ZoomIn } from 'lucide-react'
import { useApi } from '../hooks/useApi'

export default function CoachChat({ feed, meals, onRefresh }) {
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [expandedDetails, setExpandedDetails] = useState(null)
  const [fullscreenImage, setFullscreenImage] = useState(null) // { src, alt }
  const [templates, setTemplates] = useState([]) // loaded favorites
  const [toast, setToast] = useState(null) // { text, type }
  
  // Lock body scroll when fullscreen image is open
  useEffect(() => {
    if (fullscreenImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [fullscreenImage])
  const [filter, setFilter] = useState(() => 
    localStorage.getItem('coach_filter') || 'all'
  ) // 'all', 'meals', 'chat'
  const [sortOrder, setSortOrder] = useState(() => 
    localStorage.getItem('coach_sort_order') || 'asc'
  ) // 'asc' = oldest first, 'desc' = newest first
  const { get, put, del, post, loading } = useApi()

  const showToast = (text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchTemplates = async () => {
    try {
      const data = await get('/templates/')
      setTemplates(data || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [feed])

  const getTemplateForMeal = (meal) =>
    templates.find(t => t.name === meal.description)

  // Save filter to localStorage when it changes
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter)
    localStorage.setItem('coach_filter', newFilter)
  }
  
  // Save sort order to localStorage when it changes
  const handleSortOrderChange = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
    localStorage.setItem('coach_sort_order', newOrder)
  }
  
  // Use feed if available, otherwise fall back to meals
  const hasFeed = feed && feed.length > 0
  
  // Filter and sort the feed  
  const sortedFeed = hasFeed 
    ? [...feed].sort((a, b) => {
        // Use sort_time (meal's actual time) if available, otherwise fall back to created_at
        const dateA = new Date(a.sort_time || a.created_at)
        const dateB = new Date(b.sort_time || b.created_at)
        
        // Round to seconds for comparison (timestamps within same second should use ID as tiebreaker)
        const secA = Math.floor(dateA.getTime() / 1000)
        const secB = Math.floor(dateB.getTime() / 1000)
        
        // Primary sort by second
        if (secA !== secB) {
          return sortOrder === 'asc' ? secA - secB : secB - secA
        }
        
        // Same second: sort by ID
        // For chat messages: user messages have lower IDs than their assistant responses
        // For 'asc' (oldest first): lower ID first → user then assistant (natural conversation order)
        // For 'desc' (newest first): higher ID first → assistant then user (reverse order)
        const idA = a.id || 0
        const idB = b.id || 0
        
        if (sortOrder === 'asc') {
          return idA - idB  // Lower IDs first
        } else {
          return idB - idA  // Higher IDs first
        }
      })
    : []
  
  const filteredFeed = sortedFeed.filter(item => {
    if (filter === 'all') return true
    if (filter === 'meals') return item.type === 'meal'
    if (filter === 'chat') return item.type === 'chat'
    return true
  })
  
  // Check if there are any chat messages to show the filter
  const hasChatMessages = hasFeed && feed.some(item => item.type === 'chat')
  
  // Parse breakdown JSON
  const parseBreakdown = (breakdownStr) => {
    if (!breakdownStr) return null
    try {
      const parsed = JSON.parse(breakdownStr)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
    } catch {
      return null
    }
  }
  
  // Calculate totals from breakdown ingredients
  const calculateTotalsFromBreakdown = (breakdown) => {
    if (!breakdown || breakdown.length === 0) return null
    return breakdown.reduce((totals, item) => ({
      calories: totals.calories + (item.calories || 0),
      protein_g: totals.protein_g + (item.protein_g || 0),
      carbs_g: totals.carbs_g + (item.carbs_g || 0),
      fat_g: totals.fat_g + (item.fat_g || 0),
      sugar_g: totals.sugar_g + (item.sugar_g || 0),
      fiber_g: totals.fiber_g + (item.fiber_g || 0),
      sodium_mg: totals.sodium_mg + (item.sodium_mg || 0)
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, sodium_mg: 0 })
  }
  
  // Format number with max 1 decimal (removes trailing .0)
  const formatMacro = (value) => {
    const num = value ?? 0
    if (Number.isInteger(num)) return num.toString()
    const rounded = Math.round(num * 10) / 10
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
  }
  
  const formatSodiumG = (mg) => {
    const grams = (mg ?? 0) / 1000
    return grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)
  }
  
  const sodiumMgFromG = (value) => Math.round((parseFloat(value) || 0) * 1000)
  
  const handleEdit = (meal) => {
    setEditingId(meal.id)
    setEditValues({
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      sugar_g: meal.sugar_g || 0,
      fiber_g: meal.fiber_g || 0,
      sodium_mg: meal.sodium_mg || 0
    })
  }
  
  const handleSave = async (mealId) => {
    try {
      await put(`/meals/${mealId}`, editValues)
      setEditingId(null)
      onRefresh()
    } catch (err) {
      console.error('Failed to update meal:', err)
    }
  }
  
  const handleDelete = async (mealId) => {
    if (!confirm('Delete this meal?')) return
    try {
      await del(`/meals/${mealId}`)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete meal:', err)
    }
  }
  
  const handleToggleFavorite = async (meal) => {
    const existing = getTemplateForMeal(meal)
    try {
      if (existing) {
        await del(`/templates/${existing.id}`)
        showToast('Removed from favorites')
      } else {
        await post('/templates/', {
          name: meal.description,
          description: meal.description,
          calories: meal.calories,
          protein_g: meal.protein_g || 0,
          carbs_g: meal.carbs_g || 0,
          fat_g: meal.fat_g || 0,
          sugar_g: meal.sugar_g || 0,
          fiber_g: meal.fiber_g || 0,
          sodium_mg: meal.sodium_mg || 0,
          breakdown: meal.breakdown || null,
          emoji: meal.emoji || null
        })
        showToast('Added to favorites!')
      }
      await fetchTemplates()
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
      showToast('Failed to update favorite', 'error')
    }
  }
  
  const getHungerEmoji = (rating) => {
    if (rating === 1) return '😫'
    if (rating === 2) return '😐'
    if (rating === 3) return '😊'
    return null
  }
  
  const showEmpty = hasFeed ? feed.length === 0 : (!meals || meals.length === 0)
  
  if (showEmpty) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-lg">No activity yet today</p>
        <p className="text-gray-400 text-sm mt-1">
          Log a meal or ask your coach a question!
        </p>
      </div>
    )
  }
  
  // Filter dropdown component
  const FilterTabs = () => (
    <div className="flex items-center justify-between mb-4">
      {/* Filter dropdown */}
      <select
        value={filter}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
      >
        <option value="all">📋 Everything</option>
        <option value="meals">🍽️ Meals</option>
        {hasChatMessages && <option value="chat">💬 Chat</option>}
      </select>
      
      {/* Sort toggle */}
      <button
        onClick={handleSortOrderChange}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title={sortOrder === 'asc' ? 'Showing oldest first' : 'Showing newest first'}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        <span>{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</span>
      </button>
    </div>
  )
  
  // Render a chat message (user question or AI response)
  const renderChatMessage = (item) => {
    const { role, content } = item.data
    const isUser = role === 'user'
    
    return (
      <div 
        key={`chat-${item.id}`} 
        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isUser 
            ? 'bg-primary-100' 
            : 'bg-gradient-to-br from-violet-100 to-purple-100'
        }`}>
          {isUser ? (
            <User className="w-5 h-5 text-primary-600" />
          ) : (
            <Bot className="w-5 h-5 text-violet-600" />
          )}
        </div>
        
        {/* Message bubble */}
        <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-primary-500 text-white rounded-tr-md' 
              : 'bg-violet-50 border border-violet-100 text-gray-800 rounded-tl-md'
          }`}>
            <p className={`whitespace-pre-wrap text-sm text-left ${isUser ? '' : 'leading-relaxed'}`}>
              {content}
            </p>
          </div>
          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'mr-1' : 'ml-1'}`}>
            {format(new Date(item.created_at), 'h:mm a')}
          </p>
        </div>
      </div>
    )
  }
  
  // Render a meal card
  const renderMealCard = (meal, key) => {
    const breakdown = parseBreakdown(meal.breakdown)
    const showDetails = breakdown && breakdown.length > 1
    
    // Use the meal's stored values (breakdown should match these totals)
    const totals = meal
    
    return (
      <div key={key} className="meal-card">
        {/* Top bar: Time + Actions */}
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-gray-400">
            {meal.time && format(new Date(`2000-01-01T${meal.time}`), 'h:mm a')}
            {meal.hunger_rating && (
              <span className="ml-2">{getHungerEmoji(meal.hunger_rating)}</span>
            )}
          </p>
          
          {/* Actions */}
          <div className="flex gap-1">
            {editingId === meal.id ? (
              <>
                <button
                  onClick={() => handleSave(meal.id)}
                  className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                  disabled={loading}
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleToggleFavorite(meal)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    getTemplateForMeal(meal)
                      ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200'
                      : 'hover:bg-yellow-100 text-gray-400 hover:text-yellow-600'
                  }`}
                  title={getTemplateForMeal(meal) ? 'Remove from favorites' : 'Save as favorite'}
                >
                  <Bookmark className={`w-4 h-4 ${getTemplateForMeal(meal) ? 'fill-yellow-400' : ''}`} />
                </button>
                <button
                  onClick={() => handleEdit(meal)}
                  className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(meal.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Meal name - full width */}
        <p className="font-semibold text-gray-800 mb-3">
          {meal.description}
        </p>
        
        <div className="flex gap-3 items-start">
        {/* Image or emoji */}
        {meal.image_path ? (
          <button
            onClick={() => setFullscreenImage({ src: meal.image_path.startsWith('http') ? meal.image_path : `/${meal.image_path}`, alt: meal.description })}
            className="relative group flex-shrink-0"
          >
            <img
              src={meal.image_path.startsWith('http') ? meal.image_path : `/${meal.image_path}`}
              alt={meal.description}
              className="w-14 h-14 rounded-xl object-cover cursor-pointer transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">{meal.emoji || '🍽️'}</span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          
          {/* Macros */}
          {editingId === meal.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Cal</label>
                  <input
                    type="number"
                    value={editValues.calories}
                    onChange={(e) => setEditValues({...editValues, calories: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Protein</label>
                  <input
                    type="number"
                    value={editValues.protein_g}
                    onChange={(e) => setEditValues({...editValues, protein_g: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Carbs</label>
                  <input
                    type="number"
                    value={editValues.carbs_g}
                    onChange={(e) => setEditValues({...editValues, carbs_g: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fat</label>
                  <input
                    type="number"
                    value={editValues.fat_g}
                    onChange={(e) => setEditValues({...editValues, fat_g: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Sugar</label>
                  <input
                    type="number"
                    value={editValues.sugar_g}
                    onChange={(e) => setEditValues({...editValues, sugar_g: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fiber</label>
                  <input
                    type="number"
                    value={editValues.fiber_g}
                    onChange={(e) => setEditValues({...editValues, fiber_g: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Sodium (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formatSodiumG(editValues.sodium_mg)}
                    onChange={(e) => setEditValues({...editValues, sodium_mg: sodiumMgFromG(e.target.value)})}
                    className="w-full px-2 py-1 text-sm border rounded-lg"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <span className="macro-badge calories">{formatMacro(totals.calories)} cal</span>
              <span className="macro-badge protein">{formatMacro(totals.protein_g)}g protein</span>
              <span className="macro-badge carbs">{formatMacro(totals.carbs_g)}g carbs</span>
              <span className="macro-badge fat">{formatMacro(totals.fat_g)}g fat</span>
              <span className="macro-badge sugar">{formatMacro(totals.sugar_g)}g sugar</span>
              <span className="macro-badge fiber">{formatMacro(totals.fiber_g)}g fiber</span>
              <span className="macro-badge sodium">{formatSodiumG(totals.sodium_mg)}g sodium</span>
            </div>
          )}
          
          {/* Details button */}
          {showDetails && (
            <div className="mt-2">
              <button
                onClick={() => setExpandedDetails(expandedDetails === meal.id ? null : meal.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {expandedDetails === meal.id ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>Details</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded details */}
      {showDetails && expandedDetails === meal.id && breakdown && (
        <div className="mt-2 text-xs bg-gray-50 rounded-lg p-3">
          <div className="divide-y divide-gray-200">
            {breakdown.map((item, idx) => (
              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-gray-800 font-semibold text-sm">
                    {item.item}
                  </span>
                  <span className="text-gray-400 text-xs ml-2 font-medium">
                    {item.amount}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">{formatMacro(item.calories)} cal</span>
                  {item.protein_g > 0 && <span className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-600">{formatMacro(item.protein_g)}g protein</span>}
                  {item.carbs_g > 0 && <span className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-600">{formatMacro(item.carbs_g)}g carbs</span>}
                  {item.fat_g > 0 && <span className="px-1.5 py-0.5 bg-purple-100 rounded text-purple-600">{formatMacro(item.fat_g)}g fat</span>}
                  {item.sugar_g > 0 && <span className="px-1.5 py-0.5 bg-pink-100 rounded text-pink-600">{formatMacro(item.sugar_g)}g sugar</span>}
                  {item.fiber_g > 0 && <span className="px-1.5 py-0.5 bg-green-100 rounded text-green-600">{formatMacro(item.fiber_g)}g fiber</span>}
                  {item.sodium_mg > 0 && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{formatSodiumG(item.sodium_mg)}g sodium</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
  }
  
  return (
    <div>
      {/* Favorite toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          <span className="font-medium">{toast.text}</span>
        </div>
      )}

      {/* Filter tabs - only show when there's data */}
      {hasFeed && <FilterTabs />}
      
      <div className="space-y-3">
        {/* Render from filtered feed if available */}
        {hasFeed && filteredFeed.map((item) => (
          item.type === 'chat' 
            ? renderChatMessage(item)
            : renderMealCard(item.data, `meal-${item.id}`)
        ))}
        
        {/* Fallback to meals if no feed */}
        {!hasFeed && meals.map((meal) => renderMealCard(meal, meal.id))}
        
        {/* Empty state for filtered results */}
        {hasFeed && filteredFeed.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-400">
              {filter === 'meals' ? 'No meals logged yet today' : 'No conversations yet today'}
            </p>
          </div>
        )}
      </div>
      
      {/* Fullscreen Image Modal - rendered via portal to avoid transform issues */}
      {fullscreenImage && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFullscreenImage(null)}
        >
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFullscreenImage(null)
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Image */}
          <img
            src={fullscreenImage.src}
            alt={fullscreenImage.alt}
            className="max-w-full max-h-[85vh] object-contain rounded-lg animate-scale-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Caption */}
          {fullscreenImage.alt && (
            <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
              <p className="text-white/80 text-sm bg-black/50 px-4 py-2 rounded-full inline-block">
                {fullscreenImage.alt}
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
