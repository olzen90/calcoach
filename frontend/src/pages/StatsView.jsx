import { useState, useEffect } from 'react'
import { useStats, useCustomRangeStats } from '../hooks/useApi'
import { Flame, TrendingUp, TrendingDown, Calendar, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { format, subDays } from 'date-fns'
import DualStreakDisplay from '../components/DualStreakDisplay'
import WeeklyTrajectory from '../components/WeeklyTrajectory'
import DateRangePicker from '../components/DateRangePicker'

export default function StatsView() {
  const { stats, loading, error, refresh } = useStats()
  const { customStats, loading: customLoading, fetchRange, clear: clearCustom } = useCustomRangeStats()
  const [activeTab, setActiveTab] = useState('today')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  
  useEffect(() => {
    refresh()
  }, [])

  const mgToG = (value) => Math.round(((value || 0) / 1000) * 10) / 10

  const handleDateRangeChange = async (start, end) => {
    setDateRange({ start, end })
    await fetchRange(start, end)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    if (tabId === 'custom') {
      if (!dateRange.start || !dateRange.end) {
        // Default to last 7 days if no range selected
        const end = new Date()
        const start = subDays(end, 6)
        setDateRange({ start, end })
        fetchRange(start, end)
      }
    } else {
      clearCustom()
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
  
  // Prepare chart data from daily history
  const chartData = stats?.daily_history?.map(day => ({
    date: format(new Date(day.date), 'EEE'),
    calories: day.total_calories,
    goal: day.calorie_goal,
    onTarget: day.total_calories <= day.calorie_goal * 1.1
  })) || []

  // Prepare custom range chart data
  const customChartData = customStats?.daily_breakdown?.map(day => ({
    date: format(new Date(day.date), 'M/d'),
    calories: day.total_calories,
    goal: day.calorie_goal,
    onTarget: day.total_calories <= day.calorie_goal * 1.1
  })) || []
  
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-3xl font-display font-bold text-gradient-primary mb-6">
        Statistics
      </h1>
      
      {/* Streaks */}
      <div className="mb-6">
        <DualStreakDisplay streaks={stats?.streaks} />
      </div>
      
      {/* Weekly trajectory (if in weekly mode) */}
      <WeeklyTrajectory />
      
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
      
      {/* Stats based on active tab */}
      {activeTab === 'today' && stats?.today && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <StatCard
                  label="Calories"
                  value={stats.today.total_calories}
                  goal={stats.today.calorie_goal}
                  unit="cal"
                  fullWidth
                />
              </div>
              <StatCard
                label="Protein"
                value={stats.today.total_protein_g}
                goal={stats.today.protein_goal_g}
                unit="g"
              />
              <StatCard
                label="Carbs"
                value={stats.today.total_carbs_g}
                goal={0}
                unit="g"
                hideGoal
              />
              <StatCard
                label="Fat"
                value={stats.today.total_fat_g}
                goal={0}
                unit="g"
                hideGoal
              />
              <StatCard
                label="Sugar"
                value={stats.today.total_sugar_g || 0}
                goal={stats.today.sugar_goal_g || 50}
                unit="g"
                invert
              />
              <StatCard
                label="Fiber"
                value={stats.today.total_fiber_g || 0}
                goal={stats.today.fiber_goal_g || 30}
                unit="g"
              />
              <StatCard
                label="Sodium"
                value={mgToG(stats.today.total_sodium_mg)}
                goal={mgToG(stats.today.sodium_goal_mg || 2300)}
                unit="g"
                invert
              />
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'week' && stats?.this_week && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">This Week</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <StatCard
                  label="Total Calories"
                  value={stats.this_week.total_calories}
                  goal={stats.this_week.calorie_goal_weekly}
                  unit="cal"
                  fullWidth
                />
              </div>
              <StatCard
                label="Avg Daily"
                value={stats.this_week.avg_daily_calories}
                goal={stats.today?.calorie_goal || 2000}
                unit="cal"
              />
              <StatCard
                label="Days Tracked"
                value={stats.this_week.days_tracked}
                goal={7}
                unit="days"
              />
              <StatCard
                label="Days On Goal"
                value={stats.this_week.days_on_goal}
                goal={stats.this_week.days_tracked}
                unit="days"
              />
              <StatCard
                label="Avg Sugar"
                value={stats.this_week.avg_daily_sugar_g || 0}
                goal={stats.this_week.sugar_goal_g || 50}
                unit="g"
                invert
              />
              <StatCard
                label="Avg Fiber"
                value={stats.this_week.avg_daily_fiber_g || 0}
                goal={stats.this_week.fiber_goal_g || 30}
                unit="g"
              />
              <StatCard
                label="Avg Sodium"
                value={mgToG(stats.this_week.avg_daily_sodium_mg)}
                goal={mgToG(stats.this_week.sodium_goal_mg || 2300)}
                unit="g"
                invert
              />
            </div>
            
            {/* Weekly chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Bar dataKey="calories" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={index}
                        fill={entry.onTarget ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'month' && stats?.this_month && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {stats.this_month.month} {stats.this_month.year}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <StatCard
                  label="Total Calories"
                  value={stats.this_month.total_calories}
                  goal={0}
                  unit="cal"
                  hideGoal
                  fullWidth
                />
              </div>
              <StatCard
                label="Avg Daily"
                value={stats.this_month.avg_daily_calories}
                goal={stats.today?.calorie_goal || 2000}
                unit="cal"
              />
              <StatCard
                label="Days Tracked"
                value={stats.this_month.days_tracked}
                goal={0}
                unit="days"
                hideGoal
              />
              <StatCard
                label="Days On Goal"
                value={stats.this_month.days_on_goal}
                goal={stats.this_month.days_tracked}
                unit="days"
              />
              <StatCard
                label="Avg Sugar"
                value={stats.this_month.avg_daily_sugar_g || 0}
                goal={stats.this_month.sugar_goal_g || 50}
                unit="g"
                invert
              />
              <StatCard
                label="Avg Fiber"
                value={stats.this_month.avg_daily_fiber_g || 0}
                goal={stats.this_month.fiber_goal_g || 30}
                unit="g"
              />
              <StatCard
                label="Avg Sodium"
                value={mgToG(stats.this_month.avg_daily_sodium_mg)}
                goal={mgToG(stats.this_month.sodium_goal_mg || 2300)}
                unit="g"
                invert
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom date range */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {/* Date range selector */}
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

          {/* Custom stats display */}
          {customLoading ? (
            <div className="card flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : customStats ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {customStats.total_days} Day Summary
                </h3>
                <span className="text-sm text-gray-500">
                  {customStats.days_tracked} days tracked
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2">
                  <StatCard
                    label="Total Calories"
                    value={customStats.total_calories}
                    goal={customStats.calorie_goal * customStats.days_tracked}
                    unit="cal"
                    fullWidth
                  />
                </div>
                <StatCard
                  label="Avg Daily"
                  value={customStats.avg_daily_calories}
                  goal={customStats.calorie_goal}
                  unit="cal"
                />
                <StatCard
                  label="Days On Goal"
                  value={customStats.days_on_goal}
                  goal={customStats.days_tracked}
                  unit="days"
                />
                <StatCard
                  label="Avg Protein"
                  value={customStats.avg_daily_protein_g}
                  goal={customStats.protein_goal_g}
                  unit="g"
                />
                <StatCard
                  label="Avg Carbs"
                  value={customStats.avg_daily_carbs_g}
                  goal={0}
                  unit="g"
                  hideGoal
                />
                <StatCard
                  label="Avg Fat"
                  value={customStats.avg_daily_fat_g}
                  goal={0}
                  unit="g"
                  hideGoal
                />
                <StatCard
                  label="Avg Sugar"
                  value={customStats.avg_daily_sugar_g || 0}
                  goal={customStats.sugar_goal_g || 50}
                  unit="g"
                  invert
                />
                <StatCard
                  label="Avg Fiber"
                  value={customStats.avg_daily_fiber_g || 0}
                  goal={customStats.fiber_goal_g || 30}
                  unit="g"
                />
                <StatCard
                  label="Avg Sodium"
                  value={mgToG(customStats.avg_daily_sodium_mg)}
                  goal={mgToG(customStats.sodium_goal_mg || 2300)}
                  unit="g"
                  invert
                />
              </div>

              {/* Chart for custom range */}
              {customChartData.length > 0 && customChartData.length <= 31 && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customChartData}>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={customChartData.length > 14 ? 2 : 0}
                      />
                      <YAxis hide />
                      <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                        {customChartData.map((entry, index) => (
                          <Cell 
                            key={index}
                            fill={entry.onTarget ? '#22c55e' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Totals breakdown */}
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
      
      {/* Hunger patterns */}
      {stats?.hunger_patterns?.total_ratings > 0 && activeTab !== 'custom' && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Hunger Patterns
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 mb-2">By Protein Content</p>
              <div className="flex gap-2">
                <PatternBadge 
                  label="High protein" 
                  value={stats.hunger_patterns.avg_rating_by_protein.high}
                />
                <PatternBadge 
                  label="Medium" 
                  value={stats.hunger_patterns.avg_rating_by_protein.medium}
                />
                <PatternBadge 
                  label="Low" 
                  value={stats.hunger_patterns.avg_rating_by_protein.low}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Based on {stats.hunger_patterns.total_ratings} rated meals
            </p>
          </div>
        </div>
      )}

      {/* Date picker modal */}
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

function StatCard({ label, value, goal, unit, hideGoal = false, invert = false }) {
  const percentage = goal > 0 ? (value / goal) * 100 : 0
  // For inverted values (sugar, sodium), being under the goal is good
  // For normal values (fiber, protein), meeting the goal is good
  const isGood = invert 
    ? percentage <= 100  // Under goal is good for sugar/sodium
    : percentage <= 110 && percentage >= 0  // Within 110% of goal is good for calories/protein
  
  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">
        {value.toLocaleString()}
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
