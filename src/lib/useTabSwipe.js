// Swiping sideways with the thumb on a main tab screen moves to the tab
// next to it: right to left goes to the tab on the right, left to right
// to the one on the left (like turning pages).
// Only on the tab screens themselves, not on a student or group, and
// never while typing or when the swipe starts on a field.
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const MIN_DISTANCE = 70 // px the thumb must travel sideways

export function useTabSwipe(tabPaths) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const index = tabPaths.indexOf(pathname)
    if (index === -1) return
    let start = null

    function onStart(e) {
      const ignore =
        e.touches.length > 1 ||
        document.documentElement.hasAttribute('data-typing') ||
        e.target.closest?.('input, select, textarea, [data-no-swipe]')
      start = ignore ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    function onEnd(e) {
      if (!start) return
      const dx = e.changedTouches[0].clientX - start.x
      const dy = e.changedTouches[0].clientY - start.y
      start = null
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return
      const next = tabPaths[index + (dx < 0 ? 1 : -1)]
      if (!next) return
      // Tells the CSS which side the new screen slides in from.
      document.documentElement.dataset.swipe = dx < 0 ? 'left' : 'right'
      navigate(next, { replace: true })
      setTimeout(() => delete document.documentElement.dataset.swipe, 400)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [pathname, navigate, tabPaths])
}
