import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useGoBack } from './BackButton.jsx'

// The five tab bar screens: nothing to go back to from these.
const TAB_SCREENS = ['/', '/payments', '/members', '/groups', '/shop']

// Where "Volver" goes when the app was opened straight on a screen:
// /shop/new → /shop, /members/12 → /members, /class/… → Inicio.
function parentOf(pathname) {
  const first = '/' + pathname.split('/')[1]
  return TAB_SCREENS.includes(first) ? first : '/'
}

// The end of every screen: "‹ Volver" and "↑ Arriba", and the space that
// keeps the last button above the tab bar. Arriba only shows when the
// screen is long enough to scroll.
export default function ScreenFooter() {
  const { pathname } = useLocation()
  const goBack = useGoBack(parentOf(pathname))
  const long = useIsLong()
  const showBack = !TAB_SCREENS.includes(pathname)

  return (
    <footer className="screen-footer">
      {(showBack || long) && (
        <div className="btn-row">
          {showBack && <button className="btn-secondary" onClick={goBack}>‹ Volver</button>}
          {long && (
            <button className="btn-secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              ↑ Arriba
            </button>
          )}
        </div>
      )}
    </footer>
  )
}

// True when the page is taller than the screen (checked again whenever
// its size changes, e.g. after the data loads).
function useIsLong() {
  const [long, setLong] = useState(false)
  useEffect(() => {
    const check = () => setLong(document.documentElement.scrollHeight > window.innerHeight * 1.5)
    const observer = new ResizeObserver(check)
    observer.observe(document.getElementById('root'))
    return () => observer.disconnect()
  }, [])
  return long
}
