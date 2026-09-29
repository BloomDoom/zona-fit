import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import LoadState from '../components/LoadState.jsx'
import MemberFields, { EMPTY_MEMBER, cleanMember } from '../components/MemberFields.jsx'

async function loadOptions() {
  const [groups, plans] = await Promise.all([
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    unwrap(supabase.from('plans').select('id, name').eq('active', true).order('name')),
  ])
  return { groups, plans }
}

// Quick-add: after saving, the form clears but stays open (keeping the
// plan, class and start date), so she can type many members in a row.
export default function MemberNew() {
  const [params] = useSearchParams()
  const result = useLoad(loadOptions, [])
  const [values, setValues] = useState({ ...EMPTY_MEMBER, start_date: todayISO() })
  const [groupId, setGroupId] = useState(params.get('group') || '')
  const [added, setAdded] = useState([]) // members saved on this visit
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const member = await unwrap(supabase.from('members').insert(cleanMember(values)).select().single())
      if (groupId) {
        await unwrap(
          supabase.from('enrollments').insert({ member_id: member.id, group_id: Number(groupId), start_date: values.start_date }),
        )
      }
      setAdded([member, ...added])
      setValues({ ...EMPTY_MEMBER, start_date: values.start_date, plan_id: values.plan_id })
      nameRef.current?.focus()
      window.scrollTo(0, 0)
    } catch (err) {
      setError(saveErrorMessage(err))
    }
    setBusy(false)
  }

  return (
    <main className="screen">
      <Link to="/members" className="back-link">‹ Socios</Link>
      <h1>Agregar socios</h1>
      <LoadState {...result} />

      {added.length > 0 && (
        <p className="success" role="status">
          ✓ {added[0].name} agregado{added.length > 1 && ` (van ${added.length})`}. Escribí el siguiente.
        </p>
      )}

      {result.data && (
        <form onSubmit={handleSubmit}>
          {result.data.plans.length === 0 && (
            <p className="notice">
              Todavía no hay planes. <Link to="/plans">Creá los planes</Link> primero para que se generen las cuotas.
            </p>
          )}
          <MemberFields values={values} onChange={setValues} plans={result.data.plans} nameRef={nameRef} />
          <label>
            Clase <span className="optional">(para la lista de asistencia)</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Ninguna</option>
              {result.data.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar y agregar otro'}
          </button>
        </form>
      )}

      {added.length > 0 && (
        <section className="section">
          <h2>Recién agregados ({added.length})</h2>
          <ul className="row-list">
            {added.map((m) => (
              <li key={m.id}>
                <Link to={`/members/${m.id}`} className="row-link">✓ {m.name}</Link>
              </li>
            ))}
          </ul>
          <Link to="/members" className="btn-secondary">Listo</Link>
        </section>
      )}
    </main>
  )
}
