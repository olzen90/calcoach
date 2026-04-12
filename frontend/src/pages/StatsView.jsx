import { useState, useEffect } from 'react'
import { useStats, useCustomRangeStats, useFoodFrequency, useHealthAssessment } from '../hooks/useApi'
import { Flame, Calendar, Leaf, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts'
import { format, subDays } from 'date-fns'
import DualStreakDisplay from '../components/DualStreakDisplay'
import WeeklyTrajectory from '../components/WeeklyTrajectory'
import DateRangePicker from '../components/DateRangePicker'

export default function StatsView() {
  const { stats, loading, error, refresh } = useStats()
  const { customStats, loading: customLoading, fetchRange, clear: clearCustom } = useCustomRangeStats()
  const foodFreq = useFoodFrequency()
  const healthAssessment = useHealthAssessment()
  const [activeTab, setActiveTab] = useState('today')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: null, end: null })

  useEffect(() => {
    refresh()
  }, [])

  // Load food frequency for today on mount
  useEffect(() => {
    foodFreq.fetch('today')
  }, [])

  const mgToG = (value) => Math.round(((value || 0) / 1000) * 10) / 10

  const toDateStr = (d) => d instanceof Date ? d.toISOString().split('T')[0] : String(d)

  const handleDateRangeChange = async (start, end) => {
    setDateRange({ start, end })
    const startStr = toDateStr(start)
    const endStr = toDateStr(end)
    await fetchRange(start, end)
    foodFreq.fetch('custom', startStr, endStr)
    healthAssessment.fetch('custom', startStr, endStr)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    if (tabId === 'custom') {
      if (!dateRange.start || !dateRange.end) {
        const end = new Date()
        const start = subDays(end, 6)
        setDateRange({ start, end })
        const startStr = toDateStr(start)
        const endStr = toDateStr(end)
        fetchRange(start, end)
        foodFreq.fetch('custom', startStr, endStr)
        healthAssessment.fetch('custom', startStr, endStr)
      }
    } else {
      clearCustom()
      foodFreq.fetch(tabId)
      if (tabId !== 'today') {
        healthAssessment.fetch(tabId)
      }
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load stats</p>
          <button onClick={refresh} className="btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'custom', label: 'Custom', icon: Calendar }
  ]

  const chartData = stats?.daily_history?.map(day => ({
    date: format(new Date(day.date), 'EEE'),
    calories: day.total_calories,
    goal: day.calorie_goal,
    onTarget: day.total_calories <= day.calorie_goal * 1.1
  })) || []

  const customChartData = customStats?.daily_breakdown?.map(day => ({
    date: format(new Date(day.date), 'M/d'),
    calories: day.total_calories,
    goal: day.calorie_goal,
    onTarget: day.total_calories <= day.calorie_goal * 1.1
  })) || []

  // Helper to get macro data for current tab
  const getMacroData = () => {
    if (activeTab === 'today' && stats?.today) {
      return { protein: stats.today.total_protein_g, carbs: stats.today.total_carbs_g, fat: stats.today.total_fat_g }
    }
    if (activeTab === 'week' && stats?.this_week) {
      return { protein: stats.this_week.avg_daily_protein_g, carbs: stats.this_week.avg_daily_carbs_g, fat: stats.this_week.avg_daily_fat_g }
    }
    if (activeTab === 'month' && stats?.this_month) {
      return { protein: stats.this_month.avg_daily_protein_g, carbs: stats.this_month.avg_daily_carbs_g, fat: stats.this_month.avg_daily_fat_g }
    }
    if (activeTab === 'custom' && customStats) {
      return { protein: customStats.avg_daily_protein_g, carbs: customStats.avg_daily_carbs_g, fat: customStats.avg_daily_fat_g }
    }
    return null
  }

  const macroData = getMacroData()

  // Protein per kg: use week avg protein / latest weight
  const latestWeightKg = stats?.latest_weight_kg
  const proteinPerKg = latestWeightKg && macroData
    ? Math.round((macroData.protein / latestWeightKg) * 100) / 100
    : stats?.protein_per_kg ?? null

  // Food variety target based on period
  const varietyTarget = activeTab === 'today' ? 5 : activeTab === 'week' ? 30 : activeTab === 'month' ? 50 : 30
  const uniqueFoodCount = foodFreq.data?.unique_food_count ?? null

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-3xl font-display font-bold text-gradient-primary mb-6">
        Statistics
      </h1>

      {/* Streaks */}
      <div className="mb-6">
        <DualStreakDisplay streaks={stats?.streaks} />
      </div>

      {/* Weekly trajectory */}
      <WeeklyTrajectory data={stats?.weekly_trajectory} />

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TODAY ── */}
      {activeTab === 'today' && stats?.today && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <StatCard label="Calories" value={stats.today.total_calories} goal={stats.today.calorie_goal} unit="cal" fullWidth />
              </div>
              <StatCard label="Protein" value={stats.today.total_protein_g} goal={stats.today.protein_goal_g} unit="g" />
              <StatCard label="Carbs" value={stats.today.total_carbs_g} goal={0} unit="g" hideGoal />
              <StatCard label="Fat" value={stats.today.total_fat_g} goal={0} unit="g" hideGoal />
              <StatCard label="Sugar" value={stats.today.total_sugar_g || 0} goal={stats.today.sugar_goal_g || 50} unit="g" invert />
              <StatCard label="Fiber" value={stats.today.total_fiber_g || 0} goal={stats.today.fiber_goal_g || 30} unit="g" />
              <StatCard label="Sodium" value={mgToG(stats.today.total_sodium_mg)} goal={mgToG(stats.today.sodium_goal_mg || 2300)} unit="g" invert />
            </div>
          </div>
        </div>
      )}

      {/* ── WEEK ── */}
      {activeTab === 'week' && stats?.this_week && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">This Week</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <StatCard label="Total Calories" value={stats.this_week.total_calories} goal={stats.this_week.calorie_goal_weekly} unit="cal" fullWidth />
              </div>
              <StatCard label="Avg Daily" value={stats.this_week.avg_daily_calories} goal={stats.today?.calorie_goal || 2000} unit="cal" />
              <StatCard label="Days Tracked" value={stats.this_week.days_tracked} goal={7} unit="days" />
              <StatCard label="Days On Goal" value={stats.this_week.days_on_goal} goal={stats.this_week.days_tracked} unit="days" />
              <StatCard label="Avg Protein" value={stats.this_week.avg_daily_protein_g || 0} goal={stats.this_week.protein_goal_g || 150} unit="g" />
              <StatCard label="Avg Carbs" value={stats.this_week.avg_daily_carbs_g || 0} goal={0} unit="g" hideGoal />
              <StatCard label="Avg Fat" value={stats.this_week.avg_daily_fat_g || 0} goal={0} unit="g" hideGoal />
              <StatCard label="Avg Sugar" value={stats.this_week.avg_daily_sugar_g || 0} goal={stats.this_week.sugar_goal_g || 50} unit="g" invert />
              <StatCard label="Avg Fiber" value={stats.this_week.avg_daily_fiber_g || 0} goal={stats.this_week.fiber_goal_g || 30} unit="g" />
              <StatCard label="Avg Sodium" value={mgToG(stats.this_week.avg_daily_sodium_mg)} goal={mgToG(stats.this_week.sodium_goal_mg || 2300)} unit="g" invert />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Bar dataKey="calories" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.onTarget ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTH ── */}
      {activeTab === 'month' && stats?.this_month && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {stats.this_month.month} {stats.this_month.year}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <StatCard label="Total Calories" value={stats.this_month.total_calories} goal={0} unit="cal" hideGoal fullWidth />
              </div>
              <StatCard label="Avg Daily" value={stats.this_month.avg_daily_calories} goal={stats.today?.calorie_goal || 2000} unit="cal" />
              <StatCard label="Days Tracked" value={stats.this_month.days_tracked} goal={0} unit="days" hideGoal />
              <StatCard label="Days On Goal" value={stats.this_month.days_on_goal} goal={stats.this_month.days_tracked} unit="days" />
              <StatCard label="Avg Protein" value={stats.this_month.avg_daily_protein_g || 0} goal={stats.this_month.protein_goal_g || 150} unit="g" />
              <StatCard label="Avg Carbs" value={stats.this_month.avg_daily_carbs_g || 0} goal={0} unit="g" hideGoal />
              <StatCard label="Avg Fat" value={stats.this_month.avg_daily_fat_g || 0} goal={0} unit="g" hideGoal />
              <StatCard label="Avg Sugar" value={stats.this_month.avg_daily_sugar_g || 0} goal={stats.this_month.sugar_goal_g || 50} unit="g" invert />
              <StatCard label="Avg Fiber" value={stats.this_month.avg_daily_fiber_g || 0} goal={stats.this_month.fiber_goal_g || 30} unit="g" />
              <StatCard label="Avg Sodium" value={mgToG(stats.this_month.avg_daily_sodium_mg)} goal={mgToG(stats.this_month.sodium_goal_mg || 2300)} unit="g" invert />
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM ── */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowDatePicker(true)}
            className="w-full card flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-left">
                <p className="text-sm text-gray-500">Date Range</p>
                <p className="font-semibold text-gray-800">
                  {dateRange.start && dateRange.end
                    ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
                    : 'Select dates...'}
                </p>
              </div>
            </div>
            <span className="text-primary-500 text-sm font-medium">Change</span>
          </button>

          {customLoading ? (
            <div className="card flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : customStats ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{customStats.total_days} Day Summary</h3>
                <span className="text-sm text-gray-500">{customStats.days_tracked} days tracked</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2">
                  <StatCard label="Total Calories" value={customStats.total_calories} goal={customStats.calorie_goal * customStats.days_tracked} unit="cal" fullWidth />
                </div>
                <StatCard label="Avg Daily" value={customStats.avg_daily_calories} goal={customStats.calorie_goal} unit="cal" />
                <StatCard label="Days On Goal" value={customStats.days_on_goal} goal={customStats.days_tracked} unit="days" />
                <StatCard label="Avg Protein" value={customStats.avg_daily_protein_g} goal={customStats.protein_goal_g} unit="g" />
                <StatCard label="Avg Carbs" value={customStats.avg_daily_carbs_g} goal={0} unit="g" hideGoal />
                <StatCard label="Avg Fat" value={customStats.avg_daily_fat_g} goal={0} unit="g" hideGoal />
                <StatCard label="Avg Sugar" value={customStats.avg_daily_sugar_g || 0} goal={customStats.sugar_goal_g || 50} unit="g" invert />
                <StatCard label="Avg Fiber" value={customStats.avg_daily_fiber_g || 0} goal={customStats.fiber_goal_g || 30} unit="g" />
                <StatCard label="Avg Sodium" value={mgToG(customStats.avg_daily_sodium_mg)} goal={mgToG(customStats.sodium_goal_mg || 2300)} unit="g" invert />
              </div>

              {customChartData.length > 0 && customChartData.length <= 31 && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customChartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={customChartData.length > 14 ? 2 : 0} />
                      <YAxis hide />
                      <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                        {customChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.onTarget ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-600 mb-3">Period Totals</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-gray-800">{customStats.total_protein_g.toLocaleString()}g</p>
                    <p className="text-xs text-gray-500">Protein</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-gray-800">{customStats.total_carbs_g.toLocaleString()}g</p>
                    <p className="text-xs text-gray-500">Carbs</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-gray-800">{customStats.total_fat_g.toLocaleString()}g</p>
                    <p className="text-xs text-gray-500">Fat</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-8 text-gray-500">
              Select a date range to view statistics
            </div>
          )}
        </div>
      )}

      {/* ── MACRO RATIO CHART (all tabs when data available) ── */}
      {macroData && (macroData.protein + macroData.carbs + macroData.fat) > 0 && (
        <MacroRatioChart protein={macroData.protein} carbs={macroData.carbs} fat={macroData.fat} />
      )}

      {/* ── PROTEIN PER KG (all tabs when weight logged) ── */}
      {macroData && (
        <ProteinPerKg proteinPerKg={proteinPerKg} weightKg={latestWeightKg} />
      )}

      {/* ── FOOD VARIETY SCORE (all tabs) ── */}
      {uniqueFoodCount !== null && (
        <FoodVarietyScore count={uniqueFoodCount} target={varietyTarget} period={activeTab} loading={foodFreq.loading} />
      )}

      {/* ── MOST EATEN FOODS (all tabs) ── */}
      {(foodFreq.data || foodFreq.loading) && (
        <FoodFrequency data={foodFreq.data} loading={foodFreq.loading} />
      )}

      {/* ── DIET HEALTH ASSESSMENT (week / month / custom) ── */}
      {activeTab !== 'today' && (
        <DietHealth data={healthAssessment.data} loading={healthAssessment.loading} error={healthAssessment.error} />
      )}

      {/* ── HUNGER PATTERNS ── */}
      {stats?.hunger_patterns?.total_ratings > 0 && activeTab !== 'custom' && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Hunger Patterns</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 mb-2">By Protein Content</p>
              <div className="flex gap-2">
                <PatternBadge label="High protein" value={stats.hunger_patterns.avg_rating_by_protein.high} />
                <PatternBadge label="Medium" value={stats.hunger_patterns.avg_rating_by_protein.medium} />
                <PatternBadge label="Low" value={stats.hunger_patterns.avg_rating_by_protein.low} />
              </div>
            </div>
            <p className="text-xs text-gray-400">Based on {stats.hunger_patterns.total_ratings} rated meals</p>
          </div>
        </div>
      )}

      {showDatePicker && (
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={handleDateRangeChange}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  )
}

// ── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function StatCard({ label, value, goal, unit, hideGoal = false, invert = false, fullWidth = false }) {
  const percentage = goal > 0 ? (value / goal) * 100 : 0
  const isGood = invert
    ? percentage <= 100
    : percentage <= 110 && percentage >= 0

  return (
    <div className={`bg-gray-50 rounded-2xl p-4 ${fullWidth ? 'col-span-2' : ''}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
      {!hideGoal && goal > 0 && (
        <p className={`text-xs mt-1 ${isGood ? 'text-green-500' : 'text-red-500'}`}>
          {percentage.toFixed(0)}% of {goal.toLocaleString()} {invert ? 'limit' : 'goal'}
        </p>
      )}
    </div>
  )
}

function MacroRatioChart({ protein, carbs, fat }) {
  const proteinCal = Math.round(protein * 4)
  const carbsCal = Math.round(carbs * 4)
  const fatCal = Math.round(fat * 9)
  const total = proteinCal + carbsCal + fatCal
  if (total === 0) return null

  const pPct = Math.round((proteinCal / total) * 100)
  const cPct = Math.round((carbsCal / total) * 100)
  const fPct = 100 - pPct - cPct

  const pieData = [
    { name: 'Protein', value: proteinCal, color: '#8b5cf6' },
    { name: 'Carbs', value: carbsCal, color: '#f59e0b' },
    { name: 'Fat', value: fatCal, color: '#ef4444' },
  ]

  return (
    <div className="card mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Macro Ratio</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <PieChart width={128} height={128}>
            <Pie data={pieData} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(v) => `${Math.round((v / total) * 100)}%`} />
          </PieChart>
        </div>
        <div className="flex-1 space-y-2">
          {[
            { label: 'Protein', pct: pPct, color: 'bg-purple-500', target: '25-35%' },
            { label: 'Carbs', pct: cPct, color: 'bg-amber-400', target: '40-55%' },
            { label: 'Fat', pct: fPct, color: 'bg-red-400', target: '20-35%' },
          ].map(({ label, pct, color, target }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="text-gray-400">{pct}% <span className="text-gray-300">/ {target}</span></span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">Reference ranges for strength training</p>
        </div>
      </div>
    </div>
  )
}

function ProteinPerKg({ proteinPerKg, weightKg }) {
  if (!weightKg) {
    return (
      <div className="card mt-6 flex items-center gap-3 text-gray-400">
        <span className="text-2xl">⚖️</span>
        <p className="text-sm">Log your weight to see protein per kg bodyweight</p>
      </div>
    )
  }

  const status = proteinPerKg < 1.6 ? 'low' : proteinPerKg > 2.2 ? 'high' : 'good'
  const color = status === 'good' ? 'text-green-500' : status === 'high' ? 'text-amber-500' : 'text-red-500'
  const bgColor = status === 'good' ? 'bg-green-50' : status === 'high' ? 'bg-amber-50' : 'bg-red-50'
  const message = status === 'good'
    ? 'Great for muscle growth'
    : status === 'high'
    ? 'Above typical range'
    : 'Increase protein for muscle growth'

  return (
    <div className={`card mt-6 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">Protein per kg bodyweight</p>
          <p className={`text-3xl font-bold ${color}`}>
            {proteinPerKg?.toFixed(2) ?? '—'}
            <span className="text-base font-normal text-gray-400 ml-1">g/kg</span>
          </p>
          <p className={`text-xs mt-1 ${color}`}>{message}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Target range</p>
          <p className="text-sm font-semibold text-gray-600">1.6 – 2.2 g/kg</p>
          <p className="text-xs text-gray-400 mt-1">{weightKg} kg bodyweight</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2 bg-white/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${status === 'good' ? 'bg-green-400' : status === 'high' ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min((proteinPerKg / 2.5) * 100, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
        <span>0</span>
        <span className="text-gray-400">1.6</span>
        <span className="text-gray-400">2.2</span>
        <span>2.5+</span>
      </div>
    </div>
  )
}

function FoodVarietyScore({ count, target, period, loading }) {
  if (loading) return null
  const pct = Math.min(Math.round((count / target) * 100), 100)
  const status = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'low'
  const color = status === 'good' ? 'text-green-500' : status === 'ok' ? 'text-amber-500' : 'text-red-500'
  const barColor = status === 'good' ? 'bg-green-400' : status === 'ok' ? 'bg-amber-400' : 'bg-red-400'
  const periodLabel = period === 'today' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'this period'

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Food Variety</h3>
          <p className="text-xs text-gray-400">Diversity = better micronutrient coverage</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${color}`}>{count}</p>
          <p className="text-xs text-gray-400">of {target}+ target {periodLabel}</p>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FoodFrequency({ data, loading }) {
  if (loading) {
    return (
      <div className="card mt-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded-xl" />)}</div>
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded-xl" />)}</div>
        </div>
      </div>
    )
  }

  if (!data || (!data.keep_eating?.length && !data.eat_less?.length)) return null

  return (
    <div className="card mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Most Eaten Foods</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Keep eating */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Leaf className="w-4 h-4 text-green-500" />
            <p className="text-sm font-semibold text-green-700">Keep eating</p>
          </div>
          <div className="space-y-2">
            {data.keep_eating.length > 0 ? data.keep_eating.map((food, i) => (
              <div key={i} className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                <span className="text-base">{food.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate capitalize">{food.name}</p>
                  <p className="text-xs text-gray-400">×{food.count}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-gray-400 italic">Not enough data</p>
            )}
          </div>
        </div>

        {/* Eat less */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold text-orange-700">Eat less</p>
          </div>
          <div className="space-y-2">
            {data.eat_less.length > 0 ? data.eat_less.map((food, i) => (
              <div key={i} className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2">
                <span className="text-base">{food.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate capitalize">{food.name}</p>
                  <p className="text-xs text-gray-400">×{food.count}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-gray-400 italic">No concerns found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DietHealth({ data, loading, error }) {
  if (loading) {
    return (
      <div className="card mt-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-4 bg-gray-200 rounded-full" />
          <div className="h-5 bg-gray-200 rounded w-1/3" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (!data || data.status === 'no_data') {
    return (
      <div className="card mt-6 text-center py-6">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Log meals to get an AI diet assessment</p>
      </div>
    )
  }

  if (error) return null

  const statusConfig = {
    on_track: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', label: 'On Track' },
    needs_attention: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Needs Attention' },
    off_track: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', label: 'Off Track' },
  }
  const cfg = statusConfig[data.status] || statusConfig.needs_attention

  return (
    <div className={`card mt-6 border ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${cfg.dot} flex-shrink-0`} />
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Diet Assessment</h3>
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-4">{data.summary}</p>

      <div className="space-y-4">
        {data.strengths?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-sm font-semibold text-green-700">What you're doing well</p>
            </div>
            <ul className="space-y-1.5">
              {data.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.improvements?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-amber-700">What to improve</p>
            </div>
            <ul className="space-y-1.5">
              {data.improvements.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.micronutrient_flags?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Potential micronutrient gaps</p>
            <div className="space-y-2">
              {data.micronutrient_flags.map((flag, i) => (
                <div key={i} className="bg-white/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-700">{flag.nutrient}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      flag.concern === 'low' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>{flag.concern}</span>
                  </div>
                  <p className="text-xs text-gray-500">{flag.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PatternBadge({ label, value }) {
  const getEmoji = (val) => {
    if (val >= 2.5) return '😊'
    if (val >= 1.5) return '😐'
    return '😫'
  }
  return (
    <div className="bg-gray-100 rounded-xl px-3 py-2 text-center">
      <p className="text-lg">{value > 0 ? getEmoji(value) : '-'}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
