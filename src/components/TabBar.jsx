import { NavLink } from 'react-router-dom'

// Simple line icons (from the Lucide icon set), drawn inline so we
// don't need an icon library.
const icons = {
  home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  payments: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  members: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  // a dumbbell
  classes: <><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" /></>,
  // a shopping bag
  shop: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
}

// Inicio sits in the middle as a raised round button (like a floating
// action button), with two normal tabs on each side.
const tabs = [
  { to: '/payments', label: 'Pagos', icon: 'payments' },
  { to: '/members', label: 'Socios', icon: 'members' },
  { to: '/', label: 'Inicio', icon: 'home', home: true },
  { to: '/groups', label: 'Clases', icon: 'classes' },
  { to: '/shop', label: 'Tienda', icon: 'shop' },
]

export default function TabBar() {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        // "end" makes "/" only active on the Inicio screen itself.
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={tab.home ? 'tab tab-home' : 'tab'}>
          {tab.home ? (
            <span className="home-circle">
              <svg viewBox="0 0 24 24" aria-hidden="true">{icons[tab.icon]}</svg>
            </span>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">{icons[tab.icon]}</svg>
          )}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
