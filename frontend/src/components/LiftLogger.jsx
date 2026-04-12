import { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { Dumbbell, Plus, Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, X, CheckCircle, Pencil } from 'lucide-react'
import { LineChart, Line, XAxis, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

export default function LiftLogger({ lifts, onRefresh }) {
  const { post, get, put, del } = useApi()
  const [exercises, setExercises] = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [sessionLifts, setSessionLifts] = useState([]) // lifts logged in this session
  
  useEffect(() => {
    fetchExercises()
  }, [])
  
  const fetchExercises = async () => {
    try {
      const data = await get('/progress/exercises')
      setExercises(data)
      if (data.length > 0 && !selectedExercise) {
        setSelectedExercise(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }
  
  const handleLogLift = async () => {
    if (!selectedExercise || !weight || !reps) return
    
    try {
      await post('/progress/lifts', {
        exercise_id: selectedExercise,
        weight_kg: parseFloat(weight),
        reps: parseInt(reps)
      })

      const exerciseName = exercises.find(ex => ex.id === selectedExercise)?.name || ''
      setSessionLifts(prev => [...prev, {
        exercise: exerciseName,
        weight: parseFloat(weight),
        reps: parseInt(reps)
      }])
      setWeight('')
      setReps('')
      onRefresh()
    } catch (err) {
      console.error('Failed to log lift:', err)
    }
  }

  const handleCloseLog = () => {
    setShowLog(false)
    setSessionLifts([])
  }
  
  const handleEditLift = (entry) => {
    setEditingId(entry.id)
    setEditWeight(entry.weight_kg.toString())
    setEditReps(entry.reps.toString())
  }
  
  const handleSaveEdit = async (id) => {
    try {
      await put(`/progress/lifts/${id}`, {
        weight_kg: parseFloat(editWeight),
        reps: parseInt(editReps)
      })
      setEditingId(null)
      onRefresh()
    } catch (err) {
      console.error('Failed to update lift:', err)
    }
  }
  
  const handleDeleteLift = async (id) => {
    if (!confirm('Delete this lift entry?')) return
    try {
      await del(`/progress/lifts/${id}`)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete lift:', err)
    }
  }
  
  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }
  
  return (
    <div className="space-y-4">
      {/* Log modal */}
      {showLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-scale-in">
            <h3 className="text-lg font-display font-semibold text-gray-800 mb-4">
              Log Lifts
            </h3>
            
            {/* Exercise selector */}
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2">Exercise</label>
              <select
                value={selectedExercise || ''}
                onChange={(e) => setSelectedExercise(parseInt(e.target.value))}
                className="input-field"
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            
            {/* Weight and reps */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">Weight (kg)</label>
                <input
                  type="number"
                  step="2.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="input-field text-center text-xl"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">Reps</label>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="input-field text-center text-xl"
                  placeholder="0"
                />
              </div>
            </div>

            <button
              onClick={handleLogLift}
              disabled={!weight || !reps}
              className="btn-primary w-full disabled:opacity-50 mb-4"
            >
              + Add Lift
            </button>

            {/* Session lifts logged so far */}
            {sessionLifts.length > 0 && (
              <div className="mb-4 bg-gray-50 rounded-2xl p-3 space-y-1">
                <p className="text-xs text-gray-400 mb-2">Logged this session</p>
                {sessionLifts.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{l.exercise}</span>
                    <span className="font-medium text-gray-800">{l.weight} kg × {l.reps}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleCloseLog}
              className="btn-secondary w-full"
            >
              {sessionLifts.length > 0 ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
      
      {/* Exercise list with stats */}
      {lifts.length > 0 ? (
        <div className="space-y-3">
          {lifts.map(lift => (
            <div key={lift.exercise_id} className="card">
              <button
                onClick={() => setExpandedExercise(
                  expandedExercise === lift.exercise_id ? null : lift.exercise_id
                )}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-xl">
                    <Dumbbell className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">{lift.exercise_name}</p>
                    <p className="text-sm text-gray-500">
                      PR: {lift.all_time_pr_kg}kg × {lift.all_time_pr_reps}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getTrendIcon(lift.recent_trend)}
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedExercise === lift.exercise_id ? 'rotate-180' : ''
                  }`} />
                </div>
              </button>
              
              {/* Expanded content */}
              {expandedExercise === lift.exercise_id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Current</p>
                      <p className="font-bold">{lift.current_max_kg || '-'} kg</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <p className="text-sm text-gray-500">PR</p>
                      </div>
                      <p className="font-bold">{lift.all_time_pr_kg} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Trend</p>
                      <div className="flex items-center justify-center gap-1 font-bold">
                        {getTrendIcon(lift.recent_trend)}
                        <span className="capitalize">{lift.recent_trend}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mini chart */}
                  {lift.entries?.length > 1 && (
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lift.entries.map(e => ({
                          date: format(new Date(e.date), 'M/d'),
                          weight: e.weight_kg
                        }))}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                          <Line 
                            type="monotone" 
                            dataKey="weight" 
                            stroke="#f97316" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {/* Recent entries */}
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">Recent Entries</p>
                    <div className="space-y-2">
                      {lift.entries?.slice(-5).reverse().map(entry => (
                        <div key={entry.id} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-gray-400">
                            {format(new Date(entry.date), 'MMM d')}
                          </span>
                          {editingId === entry.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="2.5"
                                value={editWeight}
                                onChange={(e) => setEditWeight(e.target.value)}
                                className="w-16 px-2 py-1 text-xs border rounded-lg text-center"
                              />
                              <span className="text-xs text-gray-400">kg ×</span>
                              <input
                                type="number"
                                value={editReps}
                                onChange={(e) => setEditReps(e.target.value)}
                                className="w-12 px-2 py-1 text-xs border rounded-lg text-center"
                              />
                              <button onClick={() => handleSaveEdit(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {entry.weight_kg}kg × {entry.reps} reps
                              </span>
                              <button onClick={() => handleEditLift(entry)} className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteLift(entry.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-8">
          <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-600 mb-2">No Lifts Logged Yet</h3>
          <p className="text-sm text-gray-400">
            Start tracking your strength progress
          </p>
        </div>
      )}
    </div>
  )
}
