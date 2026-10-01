import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, formatTime, todayISO, weekdayName } from '../lib/format.js'
import { current } from '../lib/roster.js'
import { callLink, whatsappLink } from '../lib/phone.js'
import { ageOn, loadMemberOptions, timesPerWeek } from '../lib/members.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import MemberFields, { cleanMember } from '../components/MemberFields.jsx'
import SlotPicker from '../components/SlotPicker.jsx'
import MemberPayments from '../components/MemberPayments.jsx'
import MemberAttendance from '../components/MemberAttendance.jsx'
import BackButton from '../components/BackButton.jsx'
import LoanCard from '../components/LoanCard.jsx'
import { loadOpenLoans, loansByMember } from '../lib/shop.js'

const MEMBER_FIELDS = `*, plans(id, name, times_per_week),
  slot_enrollments(id, slot_id, end_date, group_slots(id, weekday, start_time, group_id, groups(id, name))),
  enrollments(id, group_id, end_date, groups(id, name))`

async function loadMember(id) {
  const [member, options] = await Promise.all([
    unwrap(supabase.from('members').select(MEMBER_FIELDS).eq('id', id).single()),
    loadMemberOptions(),
  ])
  return { member, ...options }
}

// Her current times, Monday first: [{ id, slot_id, group_slots: { weekday, start_time, groups } }]
const currentTimes = (member) =>
  current(member.slot_enrollments).sort(
    (a, b) => a.group_slots.weekday - b.group_slots.weekday || a.group_slots.start_time.localeCompare(b.group_slots.start_time),
  )

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
  const times = currentTimes(member)
  const pending = current(member.enrollments) // whole classes, times not chosen yet
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
      <div className="group-links">
        <strong>Horarios:</strong>
        {times.length === 0 && pending.length === 0 && ' ninguno'}
        {times.length > 0 && (
          <ul className="time-list">
            {times.map((e) => (
              <li key={e.id}>
                {weekdayName(e.group_slots.weekday)} {formatTime(e.group_slots.start_time)} ·{' '}
                <Link to={`/groups/${e.group_slots.groups.id}`}>{e.group_slots.groups.name}</Link>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className="stock-warning">
            <strong>Falta elegir horarios</strong> en {pending.map((e) => e.groups.name).join(', ')}. Mientras tanto
            aparece en todas las listas de esa clase. Tocá “Editar datos”.
          </p>
        )}
      </div>

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
      <MemberLoans memberId={member.id} />

      {member.notes && (
        <section className="section">
          <h2>Notas</h2>
          <p className="notes">{member.notes}</p>
        </section>
      )}
      <p className="muted">
        Empezó el {formatDate(member.start_date)} · su cuota vence el {Number(member.start_date.slice(8, 10))} de cada mes
      </p>

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

// The shop's clothes she took to try and hasn't bought or given back.
// Only a reminder: if it can't load, the rest of her page still works.
function MemberLoans({ memberId }) {
  const result = useLoad(() => loadOpenLoans().catch(() => []), [memberId])
  const mine = loansByMember((result.data ?? []).filter((l) => l.member_id === memberId))[0]
  if (!mine) return null
  return (
    <section className="section">
      <h2>Prendas de la tienda</h2>
      <LoanCard member={mine} reload={result.reload} showName={false} />
    </section>
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
  const times = currentTimes(member)
  const pending = current(member.enrollments)
  const [slotIds, setSlotIds] = useState(times.map((e) => e.slot_id))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const today = todayISO()
    try {
      await unwrap(supabase.from('members').update(cleanMember(values)).eq('id', member.id))

      // Times she unticked: end them today (keeps the attendance history).
      const removed = times.filter((e) => !slotIds.includes(e.slot_id)).map((e) => e.id)
      if (removed.length > 0) {
        await unwrap(supabase.from('slot_enrollments').update({ end_date: today }).in('id', removed))
      }
      // Times she ticked: start today.
      const added = slotIds.filter((id) => !times.some((e) => e.slot_id === id))
      if (added.length > 0) {
        await unwrap(
          supabase.from('slot_enrollments').insert(added.map((slot_id) => ({ member_id: member.id, slot_id, start_date: today }))),
        )
      }
      // Her times are chosen now, so the old whole-class sign-ups end.
      if (pending.length > 0 && slotIds.length > 0) {
        await unwrap(supabase.from('enrollments').update({ end_date: today }).in('id', pending.map((e) => e.id)))
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

      {pending.length > 0 && (
        <p className="stock-warning">
          Elegí sus horarios en {pending.map((e) => e.groups.name).join(', ')}. Al guardar, deja de aparecer en todas
          las listas de esa clase y queda solo en los horarios que elijas.
        </p>
      )}
      <SlotPicker
        groups={groups}
        value={slotIds}
        onChange={setSlotIds}
        timesPerWeek={timesPerWeek(planChoices, values.plan_id)}
        firstGroupId={pending[0]?.group_id ?? null}
      />

      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
