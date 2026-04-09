export default function MacroChart({ 
  protein, carbs, fat, sugar, fiber, sodium,
  proteinGoal, carbsGoal, fatGoal, sugarGoal, fiberGoal, sodiumGoal,
  showExtended = false
}) {
  const mainMacros = [
    { 
      name: 'Protein', 
      value: protein, 
      goal: proteinGoal, 
      color: '#3b82f6',
      bgColor: '#dbeafe',
      unit: 'g'
    },
    { 
      name: 'Carbs', 
      value: carbs, 
      goal: carbsGoal, 
      color: '#f59e0b',
      bgColor: '#fef3c7',
      unit: 'g'
    },
    { 
      name: 'Fat', 
      value: fat, 
      goal: fatGoal, 
      color: '#a855f7',
      bgColor: '#f3e8ff',
      unit: 'g'
    }
  ]
  
  const extendedMacros = [
    { 
      name: 'Sugar', 
      value: sugar || 0, 
      goal: sugarGoal || 50, 
      color: '#ec4899',
      bgColor: '#fce7f3',
      unit: 'g',
      warnOver: true  // Sugar: want to stay under
    },
    { 
      name: 'Fiber', 
      value: fiber || 0, 
      goal: fiberGoal || 30, 
      color: '#22c55e',
      bgColor: '#dcfce7',
      unit: 'g',
      warnOver: false  // Fiber: want to meet/exceed
    },
    { 
      name: 'Sodium', 
      value: sodium || 0, 
      goal: sodiumGoal || 2.3, 
      color: '#64748b',
      bgColor: '#f1f5f9',
      unit: 'g',
      warnOver: true  // Sodium: want to stay under
    }
  ]
  
  const macros = showExtended ? [...mainMacros, ...extendedMacros] : mainMacros
  
  return (
    <div className="space-y-3">
      {macros.map((macro) => {
        const percentage = Math.min((macro.value / macro.goal) * 100, 100)
        const isOver = macro.value > macro.goal
        // For sugar/sodium (warnOver=true), going over is bad (red)
        // For fiber (warnOver=false), going over is good (keep color)
        const showWarning = macro.warnOver ? isOver : false
        
        return (
          <div key={macro.name}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-600">
                {macro.name}
              </span>
              <span className="text-sm font-semibold" style={{ color: showWarning ? '#ef4444' : macro.color }}>
                {macro.value}{macro.unit} / {macro.goal}{macro.unit}
              </span>
            </div>
            <div 
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: macro.bgColor }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: showWarning ? '#ef4444' : macro.color
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
