import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react'

export default function WeeklyTrajectory({ data: trajectory }) {
  if (!trajectory || trajectory.mode !== 'weekly') return null
  
  const { trajectory: data } = trajectory
  if (!data) return null
  
  const getStatusConfig = () => {
    switch (data.status) {
      case 'ahead':
        return {
          icon: <TrendingDown className="w-5 h-5" />,
          label: 'Under Budget',
          color: 'text-green-500',
          bg: 'bg-green-50',
          border: 'border-green-200'
        }
      case 'behind':
        return {
          icon: <TrendingUp className="w-5 h-5" />,
          label: 'Over Budget',
          color: 'text-red-500',
          bg: 'bg-red-50',
          border: 'border-red-200'
        }
      default:
        return {
          icon: <Minus className="w-5 h-5" />,
          label: 'On Track',
          color: 'text-blue-500',
          bg: 'bg-blue-50',
          border: 'border-blue-200'
        }
    }
  }
  
  const config = getStatusConfig()
  const progressPercent = Math.min((data.calories_so_far / data.weekly_goal) * 100, 100)
  const expectedPercent = (data.expected_by_now / data.weekly_goal) * 100
  
  return (
    <div className={`card ${config.bg} border ${config.border} mb-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${config.bg} ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <p className={`font-semibold ${config.color}`}>{config.label}</p>
            <p className="text-xs text-gray-500">Weekly calorie tracking</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-500">Day {data.days_elapsed} of 7</p>
          <p className="text-xs text-gray-400">{data.days_remaining} days left</p>
        </div>
      </div>
      
      {/* Progress bar with expected marker */}
      <div className="relative mb-4">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              data.status === 'behind' ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Expected position marker */}
        <div 
          className="absolute top-0 w-0.5 h-4 bg-gray-600"
          style={{ left: `${expectedPercent}%`, transform: 'translateX(-50%)' }}
        />
        <div 
          className="absolute -top-1 text-xs text-gray-500"
          style={{ left: `${expectedPercent}%`, transform: 'translateX(-50%)' }}
        >
          ▼
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-gray-800">
            {data.calories_so_far.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Eaten</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${config.color}`}>
            {data.difference > 0 ? '+' : ''}{data.difference.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">vs Expected</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">
            {data.daily_budget_remaining.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Per Day Left</p>
        </div>
      </div>
      
      {/* Advice */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        {data.status === 'behind' ? (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>You'll need to stay under {data.daily_budget_remaining.toLocaleString()} cal/day to hit your weekly goal</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>Great job! You have {data.daily_budget_remaining.toLocaleString()} cal/day budget remaining</p>
          </div>
        )}
      </div>
    </div>
  )
}
