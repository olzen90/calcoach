import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const PAGES = ['/', '/stats', '/progress', '/settings']
const SWIPE_THRESHOLD = 50 // Minimum distance for a swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3 // Minimum velocity for a swipe

export function useSwipeNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const touchStartRef = useRef(null)
  const touchStartTimeRef = useRef(null)
  
  useEffect(() => {
    const handleTouchStart = (e) => {
      // Don't interfere with scrollable elements or form inputs
      const target = e.target
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('.swipe-ignore') ||
        target.closest('[data-swipe-ignore]')
      ) {
        touchStartRef.current = null
        return
      }
      
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      }
      touchStartTimeRef.current = Date.now()
    }
    
    const handleTouchEnd = (e) => {
      if (!touchStartRef.current || !touchStartTimeRef.current) return
      
      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      }
      
      const deltaX = touchEnd.x - touchStartRef.current.x
      const deltaY = touchEnd.y - touchStartRef.current.y
      const deltaTime = Date.now() - touchStartTimeRef.current
      
      // Check if horizontal swipe (not vertical scroll)
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const velocity = Math.abs(deltaX) / deltaTime
        
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && velocity > SWIPE_VELOCITY_THRESHOLD) {
          const currentIndex = PAGES.indexOf(location.pathname)
          
          if (deltaX > 0 && currentIndex > 0) {
            // Swipe right - go to previous page
            navigate(PAGES[currentIndex - 1])
          } else if (deltaX < 0 && currentIndex < PAGES.length - 1) {
            // Swipe left - go to next page
            navigate(PAGES[currentIndex + 1])
          }
        }
      }
      
      touchStartRef.current = null
      touchStartTimeRef.current = null
    }
    
    // Only add listeners on touch devices
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [navigate, location.pathname])
}
