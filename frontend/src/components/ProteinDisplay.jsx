import { useMemo } from 'react'

export default function ProteinDisplay({ consumed, goal, size = 120 }) {
  const percentage = useMemo(() => {
    return Math.min((consumed / goal) * 100, 100)
  }, [consumed, goal])
  
  const remaining = Math.max(0, goal - consumed)
  
  // Color based on progress - protein priority colors
  const getColor = () => {
    if (percentage >= 90) return '#22c55e' // Green
    if (percentage >= 50) return '#f59e0b' // Orange
    return '#ef4444' // Red
  }
  
  const color = getColor()
  
  // Circle math
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
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
          stroke={color}
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
        <span className="text-2xl font-bold" style={{ color }}>
          {Math.round(remaining)}g
        </span>
        <span className="text-xs text-gray-400">
          {Math.round(consumed)}g eaten
        </span>
      </div>
    </div>
  )
}
