import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import LoadState from '../components/LoadState.jsx'
import MemberFields, { EMPTY_MEMBER, cleanMember } from '../components/MemberFields.jsx'
import GroupPicker from '../components/GroupPicker.jsx'

async function loadOptions() {
  const [groups, plans] = await Promise.all([
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    unwrap(supabase.from('plans').select('id, name').eq('active', true).order('name')),
  ])
  return { groups, plans }
}

// Quick-add: after saving, the form clears but stays open (keeping the
// plan, classes and start date), so she can type many members in a row.
// Only the basics are asked here; emergency contact and notes are on Edit.
export default function MemberNew() {
  const [params] = useSearchParams()
  const result = useLoad(loadOptions, [])
  const [values, setValues] = useState({ ...EMPTY_MEMBER, start_date: todayISO() })
  const [groupIds, setGroupIds] = useState(params.get('group') ? [Number(params.get('group'))] : [])
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
      if (groupIds.length > 0) {
        await unwrap(
          supabase
            .from('enrollments')
            .insert(groupIds.map((group_id) => ({ member_id: member.id, group_id, start_date: values.start_date }))),
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
      <Link to="/members" className="back-link">‹ Chicas</Link>
      <h1>Agregar chicas</h1>
      <LoadState {...result} />

      {added.length > 0 && (
        <p className="success" role="status">
          ✓ {added[0].name} agregada{added.length > 1 && ` (van ${added.length})`}. Escribí la siguiente.
        </p>
      )}

      {result.data && (
        <form onSubmit={handleSubmit}>
          {result.data.plans.length === 0 && (
            <p className="notice">
              Todavía no hay planes. <Link to="/plans">Creá los planes</Link> primero para que se generen las cuotas.
            </p>
          )}
          <MemberFields values={values} onChange={setValues} plans={result.data.plans} nameRef={nameRef} short />
          <GroupPicker groups={result.data.groups} value={groupIds} onChange={setGroupIds} />
          <p className="muted">Contacto de emergencia y notas se pueden agregar después, en “Editar datos”.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar y agregar otra'}
          </button>
        </form>
      )}

      {added.length > 0 && (
        <section className="section">
          <h2>Recién agregadas ({added.length})</h2>
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
