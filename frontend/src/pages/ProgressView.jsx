import { useState, useEffect } from 'react'
import { useProgress, useApi } from '../hooks/useApi'
import { 
  Scale, Ruler, Camera, Dumbbell, TrendingUp, TrendingDown, 
  Minus, Plus, ChevronDown, CheckCircle, AlertCircle, X
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import CombinedProgressChart from '../components/CombinedProgressChart'
import PhotoComparison from '../components/PhotoComparison'
import LiftLogger from '../components/LiftLogger'

export default function ProgressView() {
  const { progress, loading, error, refresh } = useProgress()
  const { post, uploadFile } = useApi()
  
  const [activeSection, setActiveSection] = useState('overview')
  const [timeRange, setTimeRange] = useState(90)
  const [showWeightInput, setShowWeightInput] = useState(false)
  const [showMeasurementInput, setShowMeasurementInput] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [showLiftLog, setShowLiftLog] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [newWaist, setNewWaist] = useState('')
  
  useEffect(() => {
    refresh(timeRange)
  }, [timeRange])
  
  const handleLogWeight = async () => {
    if (!newWeight) return
    try {
      await post('/progress/weight', { weight_kg: parseFloat(newWeight) })
      setNewWeight('')
      setShowWeightInput(false)
      refresh(timeRange)
    } catch (err) {
      console.error('Failed to log weight:', err)
    }
  }
  
  const handleLogMeasurement = async () => {
    if (!newWaist) return
    try {
      await post('/progress/measurement', { waist_cm: parseFloat(newWaist) })
      setNewWaist('')
      setShowMeasurementInput(false)
      refresh(timeRange)
    } catch (err) {
      console.error('Failed to log measurement:', err)
    }
  }
  
  const handlePhotoUpload = async (frontFile, sideFile, notes) => {
    try {
      const formData = new FormData()
      if (frontFile) formData.append('front_image', frontFile)
      if (sideFile) formData.append('side_image', sideFile)
      if (notes) formData.append('notes', notes)
      
      await uploadFile('/progress/photos', formData)
      setShowPhotoUpload(false)
      refresh(timeRange)
    } catch (err) {
      console.error('Failed to upload photos:', err)
    }
  }
  
  if (loading && !progress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  const getTrendIcon = (trend) => {
    if (trend === 'good') return <TrendingDown className="w-4 h-4 text-green-500" />
    if (trend === 'bad') return <TrendingUp className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }
  
  const getOverallStatusConfig = () => {
    switch (progress?.overall_status) {
      case 'on_track':
        return { 
          icon: <CheckCircle className="w-6 h-6" />, 
          label: 'On Track', 
          color: 'text-green-500',
          bg: 'bg-green-50',
          border: 'border-green-200'
        }
      case 'check_this':
        return { 
          icon: <AlertCircle className="w-6 h-6" />, 
          label: 'Check This', 
          color: 'text-yellow-500',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200'
        }
      default:
        return { 
          icon: <AlertCircle className="w-6 h-6" />, 
          label: 'Needs Attention', 
          color: 'text-red-500',
          bg: 'bg-red-50',
          border: 'border-red-200'
        }
    }
  }
  
  const statusConfig = getOverallStatusConfig()
  
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-3xl font-display font-bold text-gradient-primary mb-4">
        Progress
      </h1>
      
      {/* Quick log buttons */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <QuickLogButton
          icon={<Scale className="w-5 h-5" />}
          label="Weight"
          onClick={() => setShowWeightInput(true)}
          color="blue"
        />
        <QuickLogButton
          icon={<Ruler className="w-5 h-5" />}
          label="Waist"
          onClick={() => setShowMeasurementInput(true)}
          color="purple"
        />
        <QuickLogButton
          icon={<Camera className="w-5 h-5" />}
          label="Photo"
          onClick={() => setShowPhotoUpload(true)}
          color="pink"
        />
        <QuickLogButton
          icon={<Dumbbell className="w-5 h-5" />}
          label="Lift"
          onClick={() => setShowLiftLog(true)}
          color="orange"
        />
      </div>
      
      {/* Time range selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {[30, 90, 180, 365].map(days => (
          <button
            key={days}
            onClick={() => setTimeRange(days)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              timeRange === days
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {days === 30 ? '1 Month' : days === 90 ? '3 Months' : days === 180 ? '6 Months' : '1 Year'}
          </button>
        ))}
      </div>
      
      {/* Overall status banner */}
      {progress && (
        <div className={`card ${statusConfig.bg} border ${statusConfig.border} mb-6`}>
          <div className="flex items-center gap-3">
            <div className={statusConfig.color}>{statusConfig.icon}</div>
            <div>
              <p className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</p>
              <p className="text-sm text-gray-500">Based on recent trends</p>
            </div>
          </div>
          
          {/* Trend indicators */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1">
              {getTrendIcon(progress.trends?.weight)}
              <span className="text-sm text-gray-600">Weight</span>
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(progress.trends?.waist)}
              <span className="text-sm text-gray-600">Waist</span>
            </div>
            <div className="flex items-center gap-1">
              {progress.trends?.strength === 'good' 
                ? <TrendingUp className="w-4 h-4 text-green-500" />
                : progress.trends?.strength === 'bad'
                ? <TrendingDown className="w-4 h-4 text-red-500" />
                : <Minus className="w-4 h-4 text-gray-400" />
              }
              <span className="text-sm text-gray-600">Strength</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Combined Progress Chart */}
      <CombinedProgressChart progress={progress} />
      
      {/* Section tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {['overview', 'weight', 'measurements', 'photos', 'lifts'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeSection === section
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Section content */}
      {activeSection === 'overview' && progress && (
        <div className="space-y-4">
          {/* Weight summary */}
          <SummaryCard
            title="Weight"
            current={progress.weight?.current}
            change={progress.weight?.change}
            unit="kg"
            trend={progress.trends?.weight}
            entries={progress.weight?.entries?.length || 0}
          />
          
          {/* Measurement summary */}
          <SummaryCard
            title="Waist"
            current={progress.measurement?.current}
            change={progress.measurement?.change}
            unit="cm"
            trend={progress.trends?.waist}
            entries={progress.measurement?.entries?.length || 0}
          />
          
          {/* Lifts summary */}
          {progress.lifts?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Lift PRs</h3>
              <div className="space-y-2">
                {progress.lifts.map(lift => (
                  <div key={lift.exercise_id} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{lift.exercise_name}</span>
                    <span className="text-sm font-semibold">
                      {lift.all_time_pr_kg}kg × {lift.all_time_pr_reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeSection === 'weight' && progress?.weight && (
        <WeightSection data={progress.weight} onRefresh={() => refresh(timeRange)} />
      )}
      
      {activeSection === 'measurements' && progress?.measurement && (
        <MeasurementSection data={progress.measurement} onRefresh={() => refresh(timeRange)} />
      )}
      
      {activeSection === 'photos' && (
        <PhotoComparison onUpload={() => setShowPhotoUpload(true)} />
      )}
      
      {activeSection === 'lifts' && (
        <LiftLogger lifts={progress?.lifts || []} onRefresh={() => refresh(timeRange)} />
      )}
      
      {/* Weight input modal */}
      {showWeightInput && (
        <InputModal
          title="Log Weight"
          value={newWeight}
          onChange={setNewWeight}
          onSave={handleLogWeight}
          onClose={() => setShowWeightInput(false)}
          unit="kg"
          placeholder="Enter weight"
          type="number"
          step="0.1"
        />
      )}
      
      {/* Measurement input modal */}
      {showMeasurementInput && (
        <InputModal
          title="Log Waist Measurement"
          value={newWaist}
          onChange={setNewWaist}
          onSave={handleLogMeasurement}
          onClose={() => setShowMeasurementInput(false)}
          unit="cm"
          placeholder="Measure at navel"
          type="number"
          step="0.5"
        />
      )}
      
      {/* Photo upload modal */}
      {showPhotoUpload && (
        <PhotoUploadModal
          onUpload={handlePhotoUpload}
          onClose={() => setShowPhotoUpload(false)}
        />
      )}
      
      {/* Lift log modal */}
      {showLiftLog && (
        <LiftLogModal
          onClose={() => setShowLiftLog(false)}
          onSave={() => {
            setShowLiftLog(false)
            refresh(timeRange)
          }}
        />
      )}
    </div>
  )
}

function QuickLogButton({ icon, label, onClick, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
    purple: 'bg-purple-100 text-purple-600 hover:bg-purple-200',
    pink: 'bg-pink-100 text-pink-600 hover:bg-pink-200',
    orange: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
  }
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${colorClasses[color]}`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function SummaryCard({ title, current, change, unit, trend, entries }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">{entries} entries</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-800">
          {current ?? '-'}
        </span>
        <span className="text-gray-500">{unit}</span>
        {change !== null && change !== undefined && (
          <span className={`text-sm font-medium ${
            trend === 'good' ? 'text-green-500' : 
            trend === 'bad' ? 'text-red-500' : 'text-gray-500'
          }`}>
            {change > 0 ? '+' : ''}{change} {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function WeightSection({ data, onRefresh }) {
  const { put, del } = useApi()
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  
  const chartData = data.entries?.map(e => ({
    date: format(new Date(e.date), 'MM/dd'),
    value: e.weight_kg
  })) || []
  
  const handleEdit = (entry) => {
    setEditingId(entry.id)
    setEditValue(entry.weight_kg.toString())
  }
  
  const handleSave = async (id) => {
    try {
      await put(`/progress/weight/${id}`, { weight_kg: parseFloat(editValue) })
      setEditingId(null)
      onRefresh?.()
    } catch (err) {
      console.error('Failed to update weight:', err)
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Delete this weight entry?')) return
    try {
      await del(`/progress/weight/${id}`)
      onRefresh?.()
    } catch (err) {
      console.error('Failed to delete weight:', err)
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Weight Trend</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Current</p>
            <p className="text-xl font-bold">{data.current ?? '-'} kg</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Change</p>
            <p className={`text-xl font-bold ${
              (data.change ?? 0) < 0 ? 'text-green-500' : 
              (data.change ?? 0) > 0 ? 'text-red-500' : ''
            }`}>
              {data.change ? (data.change > 0 ? '+' : '') + data.change : '-'} kg
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">7-Day Avg</p>
            <p className="text-xl font-bold">{data.trend_7day ?? '-'} kg</p>
          </div>
        </div>
        
        {chartData.length > 1 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                />
                {data.trend_7day && (
                  <ReferenceLine y={data.trend_7day} stroke="#9ca3af" strokeDasharray="3 3" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Entry list with edit/delete */}
      {data.entries?.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-gray-800 mb-3">Entries</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.entries.slice().reverse().map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-500">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                {editingId === entry.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 px-2 py-1 text-sm border rounded-lg text-center"
                      autoFocus
                    />
                    <span className="text-sm text-gray-500">kg</span>
                    <button onClick={() => handleSave(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.weight_kg} kg</span>
                    <button onClick={() => handleEdit(entry)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Scale className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MeasurementSection({ data, onRefresh }) {
  const { put, del } = useApi()
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  
  const chartData = data.entries?.map(e => ({
    date: format(new Date(e.date), 'MM/dd'),
    value: e.waist_cm
  })) || []
  
  const handleEdit = (entry) => {
    setEditingId(entry.id)
    setEditValue(entry.waist_cm.toString())
  }
  
  const handleSave = async (id) => {
    try {
      await put(`/progress/measurement/${id}`, { waist_cm: parseFloat(editValue) })
      setEditingId(null)
      onRefresh?.()
    } catch (err) {
      console.error('Failed to update measurement:', err)
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Delete this measurement entry?')) return
    try {
      await del(`/progress/measurement/${id}`)
      onRefresh?.()
    } catch (err) {
      console.error('Failed to delete measurement:', err)
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Waist Measurement Trend</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Current</p>
            <p className="text-xl font-bold">{data.current ?? '-'} cm</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Starting</p>
            <p className="text-xl font-bold">{data.starting ?? '-'} cm</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Change</p>
            <p className={`text-xl font-bold ${
              (data.change ?? 0) < 0 ? 'text-green-500' : 
              (data.change ?? 0) > 0 ? 'text-red-500' : ''
            }`}>
              {data.change ? (data.change > 0 ? '+' : '') + data.change : '-'} cm
            </p>
          </div>
        </div>
        
        {chartData.length > 1 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Entry list with edit/delete */}
      {data.entries?.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-gray-800 mb-3">Entries</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.entries.slice().reverse().map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-500">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                {editingId === entry.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 px-2 py-1 text-sm border rounded-lg text-center"
                      autoFocus
                    />
                    <span className="text-sm text-gray-500">cm</span>
                    <button onClick={() => handleSave(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.waist_cm} cm</span>
                    <button onClick={() => handleEdit(entry)} className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                      <Ruler className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InputModal({ title, value, onChange, onSave, onClose, unit, placeholder, type, step }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <input
            type={type}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input-field text-2xl text-center"
            autoFocus
          />
          <span className="text-gray-500 text-lg">{unit}</span>
        </div>
        
        <button onClick={onSave} className="btn-primary w-full">
          Save
        </button>
      </div>
    </div>
  )
}

function PhotoUploadModal({ onUpload, onClose }) {
  const [frontFile, setFrontFile] = useState(null)
  const [sideFile, setSideFile] = useState(null)
  const [notes, setNotes] = useState('')
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-semibold text-gray-800">Progress Photos</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-500 mb-2">Front View</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFrontFile(e.target.files[0])}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-2">Side View</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setSideFile(e.target.files[0])}
              className="w-full text-sm"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-2">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., End of week 4"
            className="input-field"
          />
        </div>
        
        <button 
          onClick={() => onUpload(frontFile, sideFile, notes)}
          disabled={!frontFile && !sideFile}
          className="btn-primary w-full disabled:opacity-50"
        >
          Upload Photos
        </button>
      </div>
    </div>
  )
}

function LiftLogModal({ onClose, onSave }) {
  const { post, get } = useApi()
  const [exercises, setExercises] = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  
  useEffect(() => {
    fetchExercises()
  }, [])
  
  const fetchExercises = async () => {
    try {
      const data = await get('/progress/exercises')
      setExercises(data)
      if (data.length > 0) {
        setSelectedExercise(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }
  
  const handleSave = async () => {
    if (!selectedExercise || !weight || !reps) return
    
    try {
      await post('/progress/lifts', {
        exercise_id: selectedExercise,
        weight_kg: parseFloat(weight),
        reps: parseInt(reps)
      })
      onSave()
    } catch (err) {
      console.error('Failed to log lift:', err)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-semibold text-gray-800">Log Lift</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {exercises.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-2">No exercises configured</p>
            <p className="text-sm text-gray-400">Add exercises in Settings first</p>
          </div>
        ) : (
          <>
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
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-500 mb-2">Weight (kg)</label>
                <input
                  type="number"
                  step="2.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="input-field text-center text-xl"
                  placeholder="0"
                  autoFocus
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
            
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!weight || !reps}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
