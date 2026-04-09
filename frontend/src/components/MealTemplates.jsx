import { Zap } from 'lucide-react'

export default function MealTemplates({ templates, onSelect }) {
  if (!templates || templates.length === 0) {
    return null
  }
  
  // Show top 5 most used templates
  const topTemplates = templates.slice(0, 5)
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {topTemplates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100
                     hover:shadow-playful hover:border-primary-200 transition-all duration-200
                     flex items-center gap-2"
        >
          <Zap className="w-4 h-4 text-accent-yellow" />
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">
              {template.name}
            </p>
            <p className="text-xs text-gray-500">
              {template.calories} cal • {template.protein_g}g protein
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
