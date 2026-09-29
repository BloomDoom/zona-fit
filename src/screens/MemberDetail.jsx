import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, todayISO } from '../lib/format.js'
import { currentEnrollments } from '../lib/groups.js'
import { callLink, whatsappLink } from '../lib/phone.js'
import { ageOn } from '../lib/members.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import MemberFields, { cleanMember } from '../components/MemberFields.jsx'
import MemberPayments from '../components/MemberPayments.jsx'
import MemberAttendance from '../components/MemberAttendance.jsx'
import BackButton from '../components/BackButton.jsx'

async function loadMember(id) {
  const [member, groups, plans] = await Promise.all([
    unwrap(
      supabase.from('members').select('*, plans(id, name), enrollments(id, group_id, end_date, groups(id, name))').eq('id', id).single(),
    ),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    unwrap(supabase.from('plans').select('id, name').eq('active', true).order('name')),
  ])
  return { member, groups, plans }
}

export default function MemberDetail() {
  const { id } = useParams()
  const result = useLoad(() => loadMember(id), [id])
  const [editing, setEditing] = useState(false)

  return (
    <main className="screen">
      <BackButton fallback="/members" />
      <LoadState {...result} />
      {result.data &&
        (editing ? (
          <EditMember
            {...result.data}
            onDone={() => {
              setEditing(false)
              result.reload()
            }}
          />
        ) : (
          <>
            <ViewMember member={result.data.member} onEdit={() => setEditing(true)} reload={result.reload} />
            {/* key: reload the fees after editing (e.g. a new plan) */}
            <MemberPayments key={result.data.member.plan_id} memberId={result.data.member.id} />
          </>
        ))}
    </main>
  )
}

function ViewMember({ member, onEdit, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')
  const groups = currentEnrollments(member.enrollments).map((e) => e.groups)
  const age = ageOn(member.birth_date)

  async function setActive(active) {
    setError('')
    try {
      await unwrap(supabase.from('members').update({ active }).eq('id', member.id))
      reload()
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  async function toggleActive() {
    const active = !member.active
    if (await setActive(active)) {
      showToast(active ? `${member.name} volvió a estar activa` : `${member.name} dada de baja`, () => setActive(!active))
    }
  }

  return (
    <>
      <h1>
        {member.name}
        {!member.active && <span className="badge">De baja</span>}
      </h1>

      <p>
        <strong>Plan:</strong> {member.plans?.name || 'Sin plan (no paga cuota)'}
      </p>
      <p className="group-links">
        <strong>Clases:</strong>{' '}
        {groups.length === 0
          ? 'ninguna'
          : groups.map((g, i) => (
              <span key={g.id}>
                {i > 0 && ', '}
                <Link to={`/groups/${g.id}`}>{g.name}</Link>
              </span>
            ))}
      </p>

      {age !== null && <p>{age} años (nació el {formatDate(member.birth_date)})</p>}

      {member.phone ? (
        <Contact label="Teléfono" phone={member.phone} />
      ) : (
        <p className="empty">Sin teléfono. Tocá “Editar datos” para agregarlo.</p>
      )}
      {member.emergency_phone && (
        <Contact label={`Emergencia: ${member.emergency_name || 'contacto'}`} phone={member.emergency_phone} />
      )}

      <MemberAttendance member={member} />

      {member.notes && (
        <section className="section">
          <h2>Notas</h2>
          <p className="notes">{member.notes}</p>
        </section>
      )}
      <p className="muted">Empezó el {formatDate(member.start_date)}</p>

      <section className="section stack">
        <button className="btn-secondary" onClick={onEdit}>Editar datos</button>
        <button className="btn-secondary" onClick={toggleActive}>
          {member.active ? 'Dar de baja' : 'Volver a darla de alta'}
        </button>
        {member.active && <p className="muted">Dá de baja a quien deja de venir. Su historial se guarda.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </>
  )
}

// A phone number with big Llamar and WhatsApp buttons.
function Contact({ label, phone }) {
  const whatsapp = whatsappLink(phone)
  return (
    <section className="contact">
      <p>
        <strong>{label}</strong>
        <span className="muted"> · {phone}</span>
      </p>
      <div className="btn-row">
        <a className="btn-secondary" href={callLink(phone)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
          Llamar
        </a>
        {whatsapp && (
          <a className="btn-secondary" href={whatsapp} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.8A8.4 8.4 0 1 1 21 11.5z" /></svg>
            WhatsApp
          </a>
        )}
      </div>
    </section>
  )
}

function EditMember({ member, groups, plans, onDone }) {
  const [values, setValues] = useState({
    name: member.name,
    phone: member.phone,
    plan_id: member.plan_id ?? '',
    birth_date: member.birth_date,
    start_date: member.start_date,
    emergency_name: member.emergency_name,
    emergency_phone: member.emergency_phone,
    notes: member.notes,
  })
  // Keep showing the member's current plan even if it was turned off.
  const planChoices = member.plans && !plans.some((p) => p.id === member.plan_id) ? [...plans, member.plans] : plans
  const current = currentEnrollments(member.enrollments)
  const [groupIds, setGroupIds] = useState(current.map((e) => e.group_id))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleGroup = (id) =>
    setGroupIds(groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(supabase.from('members').update(cleanMember(values)).eq('id', member.id))

      // Classes she unticked: end the enrollment today (keeps the history).
      const removed = current.filter((e) => !groupIds.includes(e.group_id)).map((e) => e.id)
      if (removed.length > 0) {
        await unwrap(supabase.from('enrollments').update({ end_date: todayISO() }).in('id', removed))
      }
      // Classes she ticked: start a new enrollment today.
      const added = groupIds.filter((id) => !current.some((e) => e.group_id === id))
      if (added.length > 0) {
        await unwrap(
          supabase.from('enrollments').insert(added.map((group_id) => ({ member_id: member.id, group_id, start_date: todayISO() }))),
        )
      }
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Editar a {member.name}</h1>
      <MemberFields values={values} onChange={setValues} plans={planChoices} />
      <p className="muted">Si cambiás el plan, la cuota de este mes cambia (si todavía no pagó). Los meses anteriores quedan igual.</p>

      <fieldset>
        <legend>Clases</legend>
        {groups.length === 0 && <p className="muted">Todavía no hay clases.</p>}
        {groups.map((g) => (
          <label key={g.id} className="checkbox-row">
            <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
            {g.name}
          </label>
        ))}
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
