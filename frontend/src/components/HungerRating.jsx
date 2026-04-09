import { X } from 'lucide-react'

export default function HungerRating({ onRate, onSkip }) {
  const options = [
    { value: 1, emoji: '😫', label: 'Still hungry' },
    { value: 2, emoji: '😐', label: 'Satisfied' },
    { value: 3, emoji: '😊', label: 'Very full' }
  ]
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-semibold text-gray-800">
            How do you feel?
          </h3>
          <button 
            onClick={onSkip}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Rate how full you feel after this meal
        </p>
        
        <div className="grid grid-cols-3 gap-3">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onRate(option.value)}
              className="flex flex-col items-center p-4 rounded-2xl border-2 border-gray-100
                         hover:border-primary-300 hover:bg-primary-50 transition-all duration-200
                         active:scale-95"
            >
              <span className="text-4xl mb-2">{option.emoji}</span>
              <span className="text-xs font-medium text-gray-600">{option.label}</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={onSkip}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
