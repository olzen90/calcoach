import { useState } from 'react'
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

const presets = [
  { label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: 'Last 14 days', getValue: () => ({ start: subDays(new Date(), 13), end: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: 'Last week', getValue: () => ({ start: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }) }) },
  { label: 'Last month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'All time', getValue: () => ({ start: new Date(2020, 0, 1), end: new Date() }) },
]

export default function DateRangePicker({ startDate, endDate, onChange, onClose }) {
  const [viewMonth, setViewMonth] = useState(endDate || new Date())
  const [selecting, setSelecting] = useState('start') // 'start' or 'end'
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)

  const handlePreset = (preset) => {
    const { start, end } = preset.getValue()
    setTempStart(start)
    setTempEnd(end)
    onChange(start, end)
    onClose()
  }

  const handleDayClick = (day) => {
    if (selecting === 'start') {
      setTempStart(day)
      if (tempEnd && day > tempEnd) {
        setTempEnd(null)
      }
      setSelecting('end')
    } else {
      if (tempStart && day < tempStart) {
        setTempStart(day)
        setTempEnd(null)
        setSelecting('end')
      } else {
        setTempEnd(day)
        if (tempStart) {
          onChange(tempStart, day)
          onClose()
        }
        setSelecting('start')
      }
    }
  }

  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Start from Monday of the first week
    const startOffset = (firstDay.getDay() + 6) % 7 // Convert to Monday-start
    const start = new Date(year, month, 1 - startOffset)
    
    const days = []
    let current = new Date(start)
    
    // Generate 6 weeks worth of days
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }

  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false
    return day >= tempStart && day <= tempEnd
  }

  const isStart = (day) => tempStart && day.toDateString() === tempStart.toDateString()
  const isEnd = (day) => tempEnd && day.toDateString() === tempEnd.toDateString()
  const isToday = (day) => day.toDateString() === new Date().toDateString()
  const isCurrentMonth = (day) => day.getMonth() === viewMonth.getMonth()

  const days = generateCalendarDays()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Select Date Range</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="p-4 border-b">
          <p className="text-sm text-gray-500 mb-2">Quick Select</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected range display */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-4">
            <div 
              className={`flex-1 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                selecting === 'start' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
              }`}
              onClick={() => setSelecting('start')}
            >
              <p className="text-xs text-gray-500 mb-1">Start Date</p>
              <p className="font-semibold text-gray-800">
                {tempStart ? format(tempStart, 'MMM d, yyyy') : 'Select...'}
              </p>
            </div>
            <div 
              className={`flex-1 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                selecting === 'end' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
              }`}
              onClick={() => setSelecting('end')}
            >
              <p className="text-xs text-gray-500 mb-1">End Date</p>
              <p className="font-semibold text-gray-800">
                {tempEnd ? format(tempEnd, 'MMM d, yyyy') : 'Select...'}
              </p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h3 className="font-semibold text-gray-800">
              {format(viewMonth, 'MMMM yyyy')}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const inRange = isInRange(day)
              const start = isStart(day)
              const end = isEnd(day)
              const today = isToday(day)
              const currentMonth = isCurrentMonth(day)
              
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  disabled={day > new Date()}
                  className={`
                    relative py-2 text-sm rounded-lg transition-colors
                    ${!currentMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${day > new Date() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}
                    ${inRange && !start && !end ? 'bg-primary-100' : ''}
                    ${start || end ? 'bg-primary-500 text-white hover:bg-primary-600' : ''}
                    ${today && !start && !end ? 'font-bold ring-2 ring-primary-300' : ''}
                  `}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (tempStart && tempEnd) {
                onChange(tempStart, tempEnd)
                onClose()
              }
            }}
            disabled={!tempStart || !tempEnd}
            className="flex-1 py-3 px-4 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
