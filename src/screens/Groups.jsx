import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { plural } from '../lib/format.js'
import { currentEnrollments, slotsSummary } from '../lib/groups.js'
import LoadState from '../components/LoadState.jsx'

async function loadGroups() {
  const [groups, plans] = await Promise.all([
    unwrap(supabase.from('groups').select('*, group_slots(*), enrollments(end_date, members(active))').order('name')),
    unwrap(supabase.from('plans').select('id').eq('active', true)),
  ])
  return { groups, planCount: plans.length }
}

export default function Groups() {
  const result = useLoad(loadGroups, [])
  const groups = result.data?.groups

  const active = groups?.filter((g) => g.active) ?? []
  const inactive = groups?.filter((g) => !g.active) ?? []

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Clases</h1>
        <Link to="/settings" className="btn-icon" aria-label="Ajustes">
          {/* Gear icon (Lucide) */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      </header>

      <LoadState {...result} />

      {groups && (
        <>
          {/* Plans live here too: they're about what members pay, not a class,
              but prices change often and this keeps them one tap away. */}
          <Link to="/plans" className="info-banner">
            <span>
              <strong>Planes y precios</strong> · {plural(result.data.planCount, 'plan', 'planes')}
            </span>
            <span aria-hidden="true">›</span>
          </Link>

          {active.length === 0 ? (
            <p className="empty">Todavía no hay clases. Tocá “Agregar clase” para crear la primera.</p>
          ) : (
            <GroupList groups={active} />
          )}

          <Link to="/groups/new" className="btn-primary">+ Agregar clase</Link>

          {inactive.length > 0 && (
            <details className="section">
              <summary>Clases que ya no se dan ({inactive.length})</summary>
              <GroupList groups={inactive} />
            </details>
          )}
        </>
      )}
    </main>
  )
}

function GroupList({ groups }) {
  return (
    <ul className="card-list">
      {groups.map((group) => {
        const memberCount = currentEnrollments(group.enrollments).filter((e) => e.members.active).length
        return (
          <li key={group.id}>
            <Link to={`/groups/${group.id}`} className="card">
              <span className="card-title">{group.name}</span>
              <span>{slotsSummary(group.group_slots)}</span>
              <span className="muted">{plural(memberCount, 'chica', 'chicas')}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
