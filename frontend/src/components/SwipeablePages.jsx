import { useState, useRef, useEffect, createContext, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const PAGES = ['/', '/stats', '/progress', '/settings']
const SWIPE_THRESHOLD = 80 // Minimum distance to trigger navigation
const RESISTANCE = 0.4 // Resistance when at edge (can't swipe further)
const ANIMATION_DURATION = 150 // Faster animation (was 250ms)

// Context to share swipe state with nav
const SwipeContext = createContext({ activeIndex: 0, setActiveIndex: () => {} })

export function useSwipeContext() {
  return useContext(SwipeContext)
}

// Provider component that wraps entire app content
export function SwipeProvider({ children }) {
  const location = useLocation()
  const [swipeActiveIndex, setSwipeActiveIndex] = useState(null)
  
  // Get current index from location
  const currentIndex = PAGES.indexOf(location.pathname)
  
  // Use swipe index if set, otherwise use location-based index
  const activeIndex = swipeActiveIndex !== null ? swipeActiveIndex : currentIndex
  
  // Reset swipe index when location changes
  useEffect(() => {
    setSwipeActiveIndex(null)
  }, [location.pathname])
  
  return (
    <SwipeContext.Provider value={{ activeIndex, setActiveIndex: setSwipeActiveIndex }}>
      {children}
    </SwipeContext.Provider>
  )
}

export default function SwipeablePages({ children, pageComponents }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setActiveIndex } = useSwipeContext()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [nextPageDirection, setNextPageDirection] = useState(null)
  const [showingPreview, setShowingPreview] = useState(false) // Keep preview visible after nav
  const [previewIndex, setPreviewIndex] = useState(null) // Which page to show in preview
  const touchStartRef = useRef(null)
  const containerRef = useRef(null)
  
  const currentIndex = PAGES.indexOf(location.pathname)
  const canSwipeLeft = currentIndex < PAGES.length - 1
  const canSwipeRight = currentIndex > 0
  
  // Update nav highlight based on swipe progress
  useEffect(() => {
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      if (swipeOffset > 0 && canSwipeRight) {
        setActiveIndex(currentIndex - 1)
      } else if (swipeOffset < 0 && canSwipeLeft) {
        setActiveIndex(currentIndex + 1)
      }
    } else if (!isAnimating && !showingPreview) {
      setActiveIndex(null) // Reset to use location-based index
    }
  }, [swipeOffset, canSwipeRight, canSwipeLeft, currentIndex, setActiveIndex, isAnimating, showingPreview])
  
  // Reset animation state on page change - with delay to prevent blink
  useEffect(() => {
    // Delay to let React Router fully render the new page before hiding preview
    // Use requestAnimationFrame + timeout for smoother transition
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        setSwipeOffset(0)
        setIsAnimating(false)
        setNextPageDirection(null)
        setShowingPreview(false)
        setPreviewIndex(null)
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [location.pathname])
  
  const handleTouchStart = (e) => {
    if (isAnimating) return
    
    const target = e.target
    
    // Check if the target or any parent is horizontally scrollable
    const isInHorizontalScroller = (el) => {
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const overflowX = style.getPropertyValue('overflow-x')
        if (
          (overflowX === 'auto' || overflowX === 'scroll') &&
          el.scrollWidth > el.clientWidth
        ) {
          return true
        }
        el = el.parentElement
      }
      return false
    }
    
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.closest('.swipe-ignore') ||
      target.closest('[data-swipe-ignore]') ||
      target.closest('.overflow-x-auto') ||
      target.closest('.scrollbar-hide') ||
      isInHorizontalScroller(target)
    ) {
      touchStartRef.current = null
      return
    }
    
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrolling: null
    }
  }
  
  const handleTouchMove = (e) => {
    if (!touchStartRef.current || isAnimating) return
    
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const deltaX = currentX - touchStartRef.current.x
    const deltaY = currentY - touchStartRef.current.y
    
    if (touchStartRef.current.scrolling === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        touchStartRef.current.scrolling = Math.abs(deltaY) > Math.abs(deltaX)
      }
    }
    
    if (touchStartRef.current.scrolling) return
    
    let offset = deltaX
    if ((deltaX > 0 && !canSwipeRight) || (deltaX < 0 && !canSwipeLeft)) {
      offset = deltaX * RESISTANCE
    }
    
    if (deltaX > 20 && canSwipeRight) {
      setNextPageDirection('right')
    } else if (deltaX < -20 && canSwipeLeft) {
      setNextPageDirection('left')
    } else {
      setNextPageDirection(null)
    }
    
    setSwipeOffset(offset)
  }
  
  const handleTouchEnd = () => {
    if (!touchStartRef.current || isAnimating) {
      touchStartRef.current = null
      return
    }
    
    const shouldNavigate = Math.abs(swipeOffset) > SWIPE_THRESHOLD
    
    if (shouldNavigate) {
      setIsAnimating(true)
      const windowWidth = window.innerWidth
      
      if (swipeOffset > 0 && canSwipeRight) {
        const targetIndex = currentIndex - 1
        setActiveIndex(targetIndex) // Keep highlight on target
        setPreviewIndex(targetIndex) // Store which page to show in preview
        setSwipeOffset(windowWidth)
        setTimeout(() => {
          setShowingPreview(true) // Keep preview visible during nav transition
          navigate(PAGES[targetIndex])
        }, ANIMATION_DURATION)
      } else if (swipeOffset < 0 && canSwipeLeft) {
        const targetIndex = currentIndex + 1
        setActiveIndex(targetIndex) // Keep highlight on target
        setPreviewIndex(targetIndex) // Store which page to show in preview
        setSwipeOffset(-windowWidth)
        setTimeout(() => {
          setShowingPreview(true) // Keep preview visible during nav transition
          navigate(PAGES[targetIndex])
        }, ANIMATION_DURATION)
      } else {
        setSwipeOffset(0)
        setIsAnimating(false)
        setActiveIndex(null)
      }
    } else {
      setIsAnimating(true)
      setSwipeOffset(0)
      setActiveIndex(null) // Reset to current page
      setTimeout(() => {
        setIsAnimating(false)
        setNextPageDirection(null)
      }, ANIMATION_DURATION)
    }
    
    touchStartRef.current = null
  }
  
  const nextPageIndex = nextPageDirection === 'left' ? currentIndex + 1 : 
                        nextPageDirection === 'right' ? currentIndex - 1 : null
  
  const transitionStyle = isAnimating ? `transform ${ANIMATION_DURATION}ms ease-out` : 'none'
  
  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pre-rendered adjacent pages for smooth swiping */}
      {nextPageDirection && nextPageIndex !== null && pageComponents && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 shadow-2xl overflow-auto"
          style={{
            bottom: '64px', // Height of bottom nav bar
            transform: nextPageDirection === 'left' 
              ? `translateX(${100 + (swipeOffset / window.innerWidth * 100)}%)`
              : `translateX(${-100 + (swipeOffset / window.innerWidth * 100)}%)`,
            transition: transitionStyle,
            background: 'linear-gradient(to bottom right, rgb(255, 247, 237), rgb(253, 242, 248), rgb(250, 245, 255))'
          }}
        >
          <div className="pb-20">
            {pageComponents[nextPageIndex]}
          </div>
        </div>
      )}
      
      {/* Keep preview visible during navigation transition to prevent blink */}
      {showingPreview && previewIndex !== null && pageComponents && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 overflow-auto"
          style={{
            bottom: '64px',
            background: 'linear-gradient(to bottom right, rgb(255, 247, 237), rgb(253, 242, 248), rgb(250, 245, 255))'
          }}
        >
          <div className="pb-20">
            {pageComponents[previewIndex]}
          </div>
        </div>
      )}
      
      {/* Current page content - hidden during preview to prevent blink */}
      <div 
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: transitionStyle,
          visibility: showingPreview ? 'hidden' : 'visible'
        }}
      >
        {children}
      </div>
      
      {/* Edge shadows */}
      {swipeOffset !== 0 && (
        <>
          {swipeOffset > 0 && (
            <div 
              className="fixed left-0 top-0 w-8 pointer-events-none z-30"
              style={{
                bottom: '64px', // Above nav bar
                background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)',
                opacity: Math.min(swipeOffset / 100, 0.5)
              }}
            />
          )}
          {swipeOffset < 0 && (
            <div 
              className="fixed right-0 top-0 w-8 pointer-events-none z-30"
              style={{
                bottom: '64px', // Above nav bar
                background: 'linear-gradient(to left, rgba(0,0,0,0.1), transparent)',
                opacity: Math.min(Math.abs(swipeOffset) / 100, 0.5)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
