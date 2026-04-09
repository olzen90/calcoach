import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function CombinedProgressChart({ progress }) {
  // Combine all metrics into one chart
  const chartData = useMemo(() => {
    if (!progress) return []
    
    // Create a map of dates to values
    const dateMap = new Map()
    
    // Add weight data
    progress.weight?.entries?.forEach(e => {
      const dateKey = e.date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey })
      }
      dateMap.get(dateKey).weight = e.weight_kg
    })
    
    // Add measurement data
    progress.measurement?.entries?.forEach(e => {
      const dateKey = e.date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey })
      }
      dateMap.get(dateKey).waist = e.waist_cm
    })
    
    // Add lift data (just the most recent PR)
    progress.lifts?.forEach(lift => {
      lift.entries?.forEach(e => {
        const dateKey = e.date
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { date: dateKey })
        }
        // Use weight * reps as a "strength score"
        const score = e.weight_kg * Math.log(e.reps + 1)
        const current = dateMap.get(dateKey).strength || 0
        dateMap.get(dateKey).strength = Math.max(current, score)
      })
    })
    
    // Sort by date and format
    return Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({
        ...d,
        date: format(new Date(d.date), 'MM/dd'),
        displayDate: format(new Date(d.date), 'MMM d')
      }))
  }, [progress])
  
  if (!progress || chartData.length < 2) {
    return (
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Combined Progress</h3>
        <p className="text-gray-400 text-center py-8">
          Log more data to see your progress chart
        </p>
      </div>
    )
  }
  
  const getTrendColor = (trend) => {
    if (trend === 'good') return 'text-green-500'
    if (trend === 'bad') return 'text-red-500'
    return 'text-gray-400'
  }
  
  const getTrendIcon = (trend, reverse = false) => {
    if (trend === 'good') return reverse 
      ? <TrendingDown className="w-4 h-4" /> 
      : <TrendingUp className="w-4 h-4" />
    if (trend === 'bad') return reverse 
      ? <TrendingUp className="w-4 h-4" /> 
      : <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }
  
  return (
    <div className="card mb-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-gray-800">Combined Progress</h3>
        
        {/* Legend with trends */}
        <div className="flex gap-3 text-xs">
          <div className={`flex items-center gap-1 ${getTrendColor(progress.trends?.weight)}`}>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Weight
            {getTrendIcon(progress.trends?.weight, true)}
          </div>
          <div className={`flex items-center gap-1 ${getTrendColor(progress.trends?.waist)}`}>
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Waist
            {getTrendIcon(progress.trends?.waist, true)}
          </div>
          <div className={`flex items-center gap-1 ${getTrendColor(progress.trends?.strength)}`}>
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            Strength
            {getTrendIcon(progress.trends?.strength)}
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="left" hide domain={['dataMin - 2', 'dataMax + 2']} />
            <YAxis yAxisId="right" orientation="right" hide domain={['auto', 'auto']} />
            
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.displayDate
                }
                return label
              }}
            />
            
            {/* Weight line (want it down = green segments when going down) */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="weight" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
              connectNulls
              name="Weight (kg)"
            />
            
            {/* Waist line (want it down = green segments when going down) */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="waist" 
              stroke="#a855f7" 
              strokeWidth={2}
              dot={{ fill: '#a855f7', r: 3 }}
              connectNulls
              name="Waist (cm)"
            />
            
            {/* Strength line (want it up = green segments when going up) */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="strength" 
              stroke="#f97316" 
              strokeWidth={2}
              dot={{ fill: '#f97316', r: 3 }}
              connectNulls
              name="Strength"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Interpretation help */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Reading the chart:</span> Weight & waist going down + strength going up = great recomp progress!
        </p>
      </div>
    </div>
  )
}
