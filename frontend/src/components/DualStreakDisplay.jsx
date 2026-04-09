import { Flame, Target, AlertTriangle, Trophy } from 'lucide-react'

export default function DualStreakDisplay({ streaks }) {
  if (!streaks) return null
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Tracking Streak */}
      <StreakCard
        type="tracking"
        count={streaks.tracking_streak_count}
        best={streaks.best_tracking_streak}
        atRisk={streaks.tracking_at_risk}
        color="purple"
        icon={<Flame className="w-6 h-6" />}
        label="Tracking"
        description="Days logged"
      />
      
      {/* Goal Streak */}
      <StreakCard
        type="goal"
        count={streaks.goal_streak_count}
        best={streaks.best_goal_streak}
        atRisk={streaks.goal_at_risk}
        color="green"
        icon={<Target className="w-6 h-6" />}
        label="On Target"
        description="Days on goal"
      />
    </div>
  )
}

function StreakCard({ type, count, best, atRisk, color, icon, label, description }) {
  const colorClasses = {
    purple: {
      bg: 'bg-gradient-to-br from-purple-500 to-pink-500',
      light: 'bg-purple-100',
      text: 'text-purple-600',
      glow: 'shadow-glow-purple'
    },
    green: {
      bg: 'bg-gradient-to-br from-green-500 to-teal-500',
      light: 'bg-green-100',
      text: 'text-green-600',
      glow: 'shadow-glow-green'
    }
  }
  
  const colors = colorClasses[color]
  const isOnFire = count >= 7
  
  return (
    <div className={`card-gradient ${colors.bg} text-white relative overflow-hidden`}>
      {/* Background flame effect for high streaks */}
      {isOnFire && (
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -bottom-4 -right-4 w-32 h-32 blur-xl bg-white rounded-full" />
        </div>
      )}
      
      <div className="relative">
        {/* Icon */}
        <div className={`inline-flex p-2 rounded-xl ${isOnFire ? 'animate-flame' : ''} bg-white/20 mb-3`}>
          {icon}
        </div>
        
        {/* Count */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-bold">{count}</span>
          <span className="text-lg opacity-80">days</span>
        </div>
        
        {/* Label */}
        <p className="font-semibold">{label}</p>
        <p className="text-sm opacity-80">{description}</p>
        
        {/* Best record */}
        {best > 0 && (
          <div className="flex items-center gap-1 mt-3 text-sm opacity-80">
            <Trophy className="w-4 h-4" />
            <span>Best: {best} days</span>
          </div>
        )}
        
        {/* At risk warning */}
        {atRisk && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              At risk
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
