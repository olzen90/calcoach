import { useMemo } from 'react'

export default function CalorieRing({ consumed, goal, size = 120 }) {
  const percentage = useMemo(() => {
    const pct = Math.min((consumed / goal) * 100, 100)
    return Math.round(pct)
  }, [consumed, goal])
  
  const remaining = Math.max(0, goal - consumed)
  const isOver = consumed > goal
  
  // Circle math
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  // Color based on progress
  const getColor = () => {
    if (isOver) return '#ef4444' // Red
    if (percentage >= 90) return '#f59e0b' // Orange/yellow
    if (percentage >= 50) return '#22c55e' // Green
    return '#3b82f6' // Blue
  }
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="progress-ring" width={size} height={size}>
        {/* Background circle */}
        <circle
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>
          {isOver ? `+${Math.round(consumed - goal).toLocaleString()}` : Math.round(remaining).toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">
          {isOver ? 'over' : `${Math.round(consumed).toLocaleString()} eaten`}
        </span>
      </div>
    </div>
  )
}
