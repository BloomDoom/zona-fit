import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addDays, formatDay, formatDuration, formatTime, todayISO, weekdayName } from '../lib/format.js'
import { loadSessions, sessionPath } from '../lib/sessions.js'
import { activeSlots, currentEnrollments } from '../lib/groups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import SlotFields, { NEW_SLOT, slotRows } from '../components/SlotFields.jsx'

function loadGroup(id) {
  return unwrap(
    supabase
      .from('groups')
      .select('*, group_slots(*), enrollments(id, end_date, members(id, name, active))')
      .eq('id', id)
      .single(),
  )
}

export default function GroupDetail() {
  const { id } = useParams()
  const result = useLoad(() => loadGroup(id), [id])
  const group = result.data

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Clases</Link>
      <LoadState {...result} />
      {group && (
        <>
          <h1>
            {group.name}
            {!group.active && <span className="badge">Ya no se da</span>}
          </h1>
          <ClassTimes group={group} reload={result.reload} />
          {group.active && <NextClasses group={group} />}
          <Members group={group} />
          <Details group={group} reload={result.reload} />
          <Deactivate group={group} reload={result.reload} />
        </>
      )}
    </main>
  )
}

// Runs a save, shows the error or a toast, then reloads the screen data.
// Returns true if it worked.
async function save(action, { reload, showToast, message, onUndo, setError }) {
  try {
    await action()
    reload()
    if (message) showToast(message, onUndo)
    return true
  } catch (err) {
    setError(saveErrorMessage(err))
    return false
  }
}

function ClassTimes({ group, reload }) {
  const showToast = useToast()
  const [adding, setAdding] = useState(false)
  const [newSlot, setNewSlot] = useState(NEW_SLOT)
  const [error, setError] = useState('')
  const slots = activeSlots(group.group_slots)

  // Removing only switches the time off (active = false), so Undo can
  // switch it back on, and past classes keep their link to it.
  const setActive = (slot, active) => unwrap(supabase.from('group_slots').update({ active }).eq('id', slot.id))

  function remove(slot) {
    setError('')
    save(() => setActive(slot, false), {
      reload, showToast, setError,
      message: `${weekdayName(slot.weekday)} ${formatTime(slot.start_time)} quitado`,
      onUndo: () => save(() => setActive(slot, true), { reload, showToast, setError }),
    })
  }

  async function add(e) {
    e.preventDefault()
    setError('')
    if (newSlot.weekdays.length === 0) return setError('Elegí al menos un día.')
    const ok = await save(
      () => unwrap(supabase.from('group_slots').insert(slotRows(newSlot, group.id))),
      { reload, showToast, setError, message: newSlot.weekdays.length > 1 ? 'Horarios agregados' : 'Horario agregado' },
    )
    if (ok) {
      setAdding(false)
      setNewSlot(NEW_SLOT)
    }
  }

  return (
    <section className="section">
      <h2>Horarios</h2>
      {slots.length === 0 && <p className="empty">Todavía no hay horarios. Agregá el día y la hora de esta clase.</p>}
      <ul className="row-list">
        {slots.map((slot) => (
          <li key={slot.id}>
            <span>
              <strong>{weekdayName(slot.weekday)} {formatTime(slot.start_time)}</strong>
              <span className="muted"> · {formatDuration(slot.duration_min)}</span>
            </span>
            <button className="btn-text" onClick={() => remove(slot)}>Quitar</button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={add} className="slot-box">
          <SlotFields slot={newSlot} onChange={setNewSlot} />
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ Agregar horario</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// The class's sessions for the next 3 weeks. Tap one to cancel or move
// it (e.g. for a holiday), without changing the weekly schedule.
function NextClasses({ group }) {
  const today = todayISO()
  // group_slots is a dependency so the list updates after adding/removing a time.
  const result = useLoad(() => loadSessions(today, addDays(today, 20), group.id), [group.id, group.group_slots])
  const sessions = result.data?.filter((s) => !s.movedAway)

  return (
    <section className="section">
      <h2>Próximas clases</h2>
      <LoadState {...result} />
      {sessions && sessions.length === 0 && <p className="empty">No hay clases en las próximas 3 semanas.</p>}
      {sessions && (
        <ul className="row-list">
          {sessions.map((s) => (
            <li key={`${s.id ?? 'slot' + s.slot_id}_${s.date}`}>
              <Link to={sessionPath(s)} className={`row-link ${s.cancelled ? 'dimmed' : ''}`}>
                {formatDay(s.date)} · {formatTime(s.start_time)}
                {s.cancelled && ' · Suspendida'}
                {!s.slot_id && ' · Extra'}
                {s.original_date && s.original_date !== s.date && ' · Cambiada'}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/class/new?group=${group.id}`} className="btn-secondary">+ Agregar clase extra</Link>
    </section>
  )
}

function Members({ group }) {
  const members = currentEnrollments(group.enrollments)
    .map((e) => e.members)
    .filter((m) => m.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <section className="section">
      <h2>Chicas ({members.length})</h2>
      {members.length === 0 && <p className="empty">Todavía no hay chicas en esta clase.</p>}
      <ul className="row-list">
        {members.map((m) => (
          <li key={m.id}>
            <Link to={`/members/${m.id}`} className="row-link">{m.name} ›</Link>
          </li>
        ))}
      </ul>
      {members.length > 0 && (
        <Link to={`/groups/${group.id}/message`} className="btn-primary">Mandar mensaje a la clase</Link>
      )}
      <Link to={`/members/new?group=${group.id}`} className="btn-secondary">+ Agregar chicas a esta clase</Link>
    </section>
  )
}

function Details({ group, reload }) {
  const showToast = useToast()
  const [name, setName] = useState(group.name)
  const [notes, setNotes] = useState(group.notes || '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    save(
      () => unwrap(supabase.from('groups').update({ name: name.trim(), notes: notes.trim() || null }).eq('id', group.id)),
      { reload, showToast, setError, message: 'Guardado' },
    )
  }

  return (
    <section className="section">
      <h2>Nombre y notas</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre de la clase
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Notas <span className="optional">(opcional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-secondary">Guardar cambios</button>
      </form>
    </section>
  )
}

function Deactivate({ group, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')
  const setActive = (active) => unwrap(supabase.from('groups').update({ active }).eq('id', group.id))

  function toggle() {
    setError('')
    const active = !group.active
    save(() => setActive(active), {
      reload, showToast, setError,
      message: active ? 'La clase vuelve a estar activa' : 'Clase dada de baja',
      onUndo: () => save(() => setActive(!active), { reload, showToast, setError }),
    })
  }

  return (
    <section className="section">
      {group.active && <p className="muted">Si esta clase deja de darse, dala de baja. Su historial se guarda.</p>}
      <button className="btn-secondary" onClick={toggle}>
        {group.active ? 'Dar de baja la clase' : 'Volver a dar esta clase'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
