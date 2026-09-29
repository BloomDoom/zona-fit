import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments, normalize } from '../lib/groups.js'
import LoadState from '../components/LoadState.jsx'

async function loadMembers() {
  const [members, groups, plans] = await Promise.all([
    unwrap(supabase.from('members').select('*, plans(name), enrollments(group_id, end_date, groups(name))')),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    unwrap(supabase.from('plans').select('id, name').eq('active', true).order('name')),
  ])
  members.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { members, groups, plans }
}

// [['A', [Ana, Andrés]], ['B', [Beto]], ...]. Accents don't matter (Á → A).
function byLetter(members) {
  const groups = new Map()
  for (const m of members) {
    const letter = normalize(m.name).charAt(0).toUpperCase() || '#'
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter).push(m)
  }
  return [...groups.entries()]
}

export default function Members() {
  const result = useLoad(loadMembers, [])
  const [search, setSearch] = useState('')
  // "active" = all active members, "inactive", "g12" = class 12, "p3" = plan 3
  const [filter, setFilter] = useState('active')

  let members = []
  if (result.data) {
    members = result.data.members.filter((m) => {
      if (filter === 'inactive') return !m.active
      if (!m.active) return false
      if (filter === 'active') return true
      const id = filter.slice(1)
      if (filter.startsWith('p')) return String(m.plan_id) === id
      return currentEnrollments(m.enrollments).some((e) => String(e.group_id) === id)
    })
    if (search) members = members.filter((m) => normalize(m.name).includes(normalize(search)))
  }

  return (
    <main className="screen">
      <h1>Chicas</h1>
      <LoadState {...result} />

      {result.data && (
        <>
          <Link to="/insights" className="info-banner">
            <span><strong>Resumen del mes</strong> · ingresos y asistencia</span>
            <span aria-hidden="true">›</span>
          </Link>

          {/* Pinned at the top while scrolling, so search and "+ Agregar" are always at hand */}
          <div className="filters">
            <div className="filters-row">
              <input
                type="search"
                placeholder="Buscar por nombre"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar por nombre"
              />
              <Link to="/members/new" className="btn-primary btn-add" aria-label="Agregar chicas">+ Agregar</Link>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Qué chicas mostrar">
              <option value="active">Todas las chicas ({result.data.members.filter((m) => m.active).length})</option>
              {result.data.plans.length > 0 && (
                <optgroup label="Por plan">
                  {result.data.plans.map((p) => (
                    <option key={p.id} value={`p${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {result.data.groups.length > 0 && (
                <optgroup label="Por clase">
                  {result.data.groups.map((g) => (
                    <option key={g.id} value={`g${g.id}`}>{g.name}</option>
                  ))}
                </optgroup>
              )}
              <option value="inactive">Dadas de baja</option>
            </select>
          </div>

          {result.data.members.length === 0 ? (
            <p className="empty">Todavía no hay chicas. Tocá “+ Agregar” para cargar las primeras.</p>
          ) : members.length === 0 ? (
            <p className="empty">Nadie coincide. Probá con otro nombre o filtro.</p>
          ) : (
            // Grouped by first letter (A, B, C…) so the list is easy to scan.
            byLetter(members).map(([letter, list]) => (
              <section key={letter} aria-label={letter}>
                <h2 className="letter-header">{letter}</h2>
                <ul className="card-list">
                  {list.map((m) => (
                    <li key={m.id}>
                      <Link to={`/members/${m.id}`} className="card">
                        <span className="card-title">{m.name}</span>
                        <span className="muted">
                          {[m.plans?.name || 'Sin plan', ...currentEnrollments(m.enrollments).map((e) => e.groups.name)].join(' · ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </main>
  )
}
