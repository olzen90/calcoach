import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react'

const imgSrc = (path) => path?.startsWith('http') ? path : `/${path}`

export default function PhotoComparison({ onUpload }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLeft, setSelectedLeft] = useState(null)
  const [selectedRight, setSelectedRight] = useState(null)
  const [showComparison, setShowComparison] = useState(false)
  
  useEffect(() => {
    fetchPhotos()
  }, [])
  
  const fetchPhotos = async () => {
    try {
      const response = await fetch('/api/progress/photos?days=365')
      const data = await response.json()
      setPhotos(data)
      
      // Auto-select first and last for comparison
      if (data.length >= 2) {
        setSelectedLeft(data[data.length - 1]) // Oldest
        setSelectedRight(data[0]) // Newest
      }
    } catch (err) {
      console.error('Failed to fetch photos:', err)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }
  
  if (photos.length === 0) {
    return (
      <div className="card text-center py-8">
        <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-600 mb-2">No Progress Photos Yet</h3>
        <p className="text-sm text-gray-400 mb-4">
          Take your first progress photo to track visual changes
        </p>
        <button onClick={onUpload} className="btn-primary">
          Take Photo
        </button>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* Comparison view */}
      {selectedLeft && selectedRight && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Compare</h3>
            <button 
              onClick={() => setShowComparison(true)}
              className="text-sm text-primary-500 font-medium"
            >
              Full Screen
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Before */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {format(new Date(selectedLeft.date), 'MMM d, yyyy')}
              </p>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                {selectedLeft.front_image_path ? (
                  <img 
                    src={imgSrc(selectedLeft.front_image_path)}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                ) : selectedLeft.side_image_path ? (
                  <img 
                    src={imgSrc(selectedLeft.side_image_path)}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
            </div>
            
            {/* After */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {format(new Date(selectedRight.date), 'MMM d, yyyy')}
              </p>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                {selectedRight.front_image_path ? (
                  <img 
                    src={imgSrc(selectedRight.front_image_path)}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                ) : selectedRight.side_image_path ? (
                  <img 
                    src={imgSrc(selectedRight.side_image_path)}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Photo gallery */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">All Photos</h3>
          <button onClick={onUpload} className="text-sm text-primary-500 font-medium">
            + Add
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => {
                if (!selectedLeft || selectedRight) {
                  setSelectedLeft(photo)
                  setSelectedRight(null)
                } else {
                  setSelectedRight(photo)
                }
              }}
              className={`aspect-square rounded-xl overflow-hidden bg-gray-100 relative ${
                (selectedLeft?.id === photo.id || selectedRight?.id === photo.id) 
                  ? 'ring-2 ring-primary-500' 
                  : ''
              }`}
            >
              <img 
                src={imgSrc(photo.front_image_path || photo.side_image_path)}
                alt={format(new Date(photo.date), 'MMM d')}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                <p className="text-white text-xs">
                  {format(new Date(photo.date), 'M/d')}
                </p>
              </div>
              {selectedLeft?.id === photo.id && (
                <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
                  1
                </div>
              )}
              {selectedRight?.id === photo.id && (
                <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">
                  2
                </div>
              )}
            </button>
          ))}
        </div>
        
        <p className="text-xs text-gray-400 mt-3 text-center">
          Tap photos to compare. First tap = before, second tap = after.
        </p>
      </div>
      
      {/* Full screen comparison modal */}
      {showComparison && selectedLeft && selectedRight && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 text-white">
            <button onClick={() => setShowComparison(false)}>
              <X className="w-6 h-6" />
            </button>
            <span className="text-sm">Comparison View</span>
            <div className="w-6" />
          </div>
          
          <div className="flex-1 flex">
            <div className="flex-1 p-2">
              <p className="text-white text-center text-sm mb-2">
                {format(new Date(selectedLeft.date), 'MMM d, yyyy')}
              </p>
              <img 
                src={imgSrc(selectedLeft.front_image_path || selectedLeft.side_image_path)}
                alt="Before"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 p-2">
              <p className="text-white text-center text-sm mb-2">
                {format(new Date(selectedRight.date), 'MMM d, yyyy')}
              </p>
              <img 
                src={imgSrc(selectedRight.front_image_path || selectedRight.side_image_path)}
                alt="After"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
