import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { normalize } from '../lib/groups.js'
import { current } from '../lib/roster.js'
import { formatTime, weekdayName } from '../lib/format.js'
import LoadState from '../components/LoadState.jsx'

async function loadMembers() {
  const [members, groups, plans] = await Promise.all([
    unwrap(
      supabase
        .from('members')
        .select('*, plans(name), slot_enrollments(end_date, group_slots(group_id, weekday, start_time)), enrollments(group_id, end_date)'),
    ),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    unwrap(supabase.from('plans').select('id, name').eq('active', true).order('name')),
  ])
  members.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { members: members.map(withTimes), groups, plans }
}

// Adds her current times (Monday first), the classes she's in, and
// `pending` = still signed up to a whole class, times not chosen yet.
function withTimes(m) {
  const times = current(m.slot_enrollments)
    .map((e) => e.group_slots)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
  const pendingIds = current(m.enrollments).map((e) => e.group_id)
  return { ...m, times, pending: pendingIds.length > 0, groupIds: new Set([...times.map((t) => t.group_id), ...pendingIds]) }
}

// "Lun 8:30 · Jue 16:30"
const timesText = (times) => times.map((t) => `${weekdayName(t.weekday).slice(0, 3)} ${formatTime(t.start_time)}`).join(' · ')

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
  // "active" = all active members, "inactive", "pending" = times not chosen,
  // "g12" = class 12, "p3" = plan 3
  const [filter, setFilter] = useState('active')

  let members = []
  if (result.data) {
    members = result.data.members.filter((m) => {
      if (filter === 'inactive') return !m.active
      if (!m.active) return false
      if (filter === 'active') return true
      if (filter === 'pending') return m.pending
      const id = filter.slice(1)
      if (filter.startsWith('p')) return String(m.plan_id) === id
      return m.groupIds.has(Number(id))
    })
    if (search) members = members.filter((m) => normalize(m.name).includes(normalize(search)))
  }
  const pendingCount = result.data?.members.filter((m) => m.active && m.pending).length ?? 0

  return (
    <main className="screen">
      <h1>Chicas</h1>
      <LoadState {...result} />

      {result.data && (
        <>
          {pendingCount > 0 && filter !== 'pending' && (
            <button type="button" className="stock-warning pending-banner" onClick={() => setFilter('pending')}>
              <strong>Falta elegir horarios</strong> a {pendingCount === 1 ? '1 chica' : `${pendingCount} chicas`}. Tocá para verlas.
            </button>
          )}

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
              {pendingCount > 0 && <option value="pending">Falta elegir horarios ({pendingCount})</option>}
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
                        <span className="muted">{m.plans?.name || 'Sin plan'}</span>
                        {m.times.length > 0 && <span className="muted">{timesText(m.times)}</span>}
                        {m.pending && <span className="pending-chip">Falta elegir horarios</span>}
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
