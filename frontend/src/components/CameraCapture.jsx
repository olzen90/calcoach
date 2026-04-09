import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X } from 'lucide-react'

export default function CameraCapture({ onCapture, onClose }) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [availableCameras, setAvailableCameras] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  
  // Find the "Back 3" camera (third back camera)
  const findBack3Camera = (cameras) => {
    if (!cameras.length) return null
    
    // Filter to back cameras only
    const backCameras = cameras.filter(c => {
      const label = c.label.toLowerCase()
      return (label.includes('back') || label.includes('rear') || label.includes('environment')) &&
             !label.includes('front')
    })
    
    // If we have back cameras, try to get the third one (index 2)
    if (backCameras.length >= 3) {
      return backCameras[2] // Back 3 (0-indexed)
    }
    
    // Fallback: if less than 3 back cameras, use the last one available
    if (backCameras.length > 0) {
      return backCameras[backCameras.length - 1]
    }
    
    // Last resort: just use first camera
    return cameras[0]
  }
  
  // Get available cameras on mount and start with Back 3
  useEffect(() => {
    const getCamerasAndStart = async () => {
      try {
        // Need to request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(d => d.kind === 'videoinput')
        setAvailableCameras(cameras)
        
        // Find and start with Back 3 camera
        const targetCamera = findBack3Camera(cameras)
        if (targetCamera) {
          startCameraWithDevice(targetCamera.deviceId)
        }
      } catch (err) {
        console.log('Could not enumerate cameras:', err)
        setError('Could not access camera. Please try uploading a photo instead.')
      }
    }
    
    if (!cameraStarted) {
      setCameraStarted(true)
      getCamerasAndStart()
    }
  }, [cameraStarted])
  
  // Start camera stream with specific device
  const startCameraWithDevice = async (deviceId) => {
    try {
      setError(null)
      
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      
      let constraints = {
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1080 }, // 1:1 square aspect ratio
          aspectRatio: { ideal: 1 }
        }
      }
      
      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId }
      }
      
      // Try to set zoom to 1x if supported
      if ('zoom' in navigator.mediaDevices.getSupportedConstraints()) {
        constraints.video.zoom = { ideal: 1 }
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error('Camera access error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else {
        setError('Could not access camera. Please try uploading a photo instead.')
      }
    }
  }
  
  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }, [stream])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])
  
  // Capture photo from video stream - directly sends to parent (no preview step)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    
    // Convert to blob and immediately send to parent
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
        const preview = URL.createObjectURL(blob)
        stopCamera()
        onCapture(file, preview) // Send directly to parent - preview shows in input field
      }
    }, 'image/jpeg', 0.9)
  }
  
  // Handle file upload - directly sends to parent (no preview step)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      stopCamera()
      const preview = URL.createObjectURL(file)
      onCapture(file, preview) // Send directly to parent - preview shows in input field
    }
  }
  
  // Close modal
  const handleClose = () => {
    stopCamera()
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Header - floating over video */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <h3 className="font-bold text-white">
          Take Photo
        </h3>
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>
      
      {error && (
        <div className="absolute top-16 left-4 right-4 z-10 p-3 bg-red-500/90 text-white rounded-xl text-sm">
          {error}
        </div>
      )}
      
      {/* Camera preview - square (1:1), centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full aspect-square bg-gray-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      
      {/* Bottom controls */}
      <div className="pb-safe bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex flex-col items-center gap-4 p-6 pb-8">
          {/* Capture button */}
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white border-4 border-white hover:opacity-90 transition-opacity flex items-center justify-center shadow-lg"
          >
            <div className="w-16 h-16 rounded-full bg-white border-2 border-black/10" />
          </button>
          
          {/* Import photo button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-4 text-white/80 hover:text-white transition-colors text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import from gallery
          </button>
        </div>
      </div>
      
      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
