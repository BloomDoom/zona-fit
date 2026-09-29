import { NavLink, useLocation } from 'react-router-dom'
import { asset } from '../lib/asset.js'
import { useLoad } from '../lib/useLoad.js'
import { loadLowStock } from '../lib/shop.js'

// Simple line icons (from the Lucide icon set), drawn inline so we
// don't need an icon library.
const icons = {
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
  { to: '/members', label: 'Chicas', icon: 'members' },
  { to: '/', label: 'Inicio', home: true },
  { to: '/groups', label: 'Clases', icon: 'classes' },
  { to: '/shop', label: 'Tienda', icon: 'shop' },
]

export default function TabBar() {
  // Checked again on every screen change, so the dot goes away after restocking.
  const { pathname } = useLocation()
  const lowStock = useLoad(loadLowStock, [pathname])
  const shopWarning = lowStock.data?.length > 0

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        // "end" makes "/" only active on the Inicio screen itself.
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={tab.home ? 'tab tab-home' : 'tab'}>
          {tab.home ? (
            // The woman from Zona Fit's logo instead of a house icon
            <span className="home-circle">
              <img className="logo-mark" src={asset('logo-mark.png')} alt="" />
            </span>
          ) : (
            <span className="tab-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">{icons[tab.icon]}</svg>
              {tab.to === '/shop' && shopWarning && <span className="tab-dot" />}
            </span>
          )}
          {tab.label}
          {tab.to === '/shop' && shopWarning && <span className="visually-hidden"> (hay productos con poco stock)</span>}
        </NavLink>
      ))}
    </nav>
  )
}
