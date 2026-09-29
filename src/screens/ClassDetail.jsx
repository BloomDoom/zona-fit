import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatTime } from '../lib/format.js'
import { ensureSaved, loadSession, sessionPath, updateSession } from '../lib/sessions.js'
import { loadSignups, rosterFor } from '../lib/roster.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { useGoBack } from '../components/BackButton.jsx'

// Reached as /class/12 (a saved class) or /class/slot/5/2026-09-29 (a
// weekly class that hasn't been saved yet).
async function loadClass(params) {
  const session = await loadSession(params)
  const [signups, absences] = await Promise.all([
    loadSignups([session.group_id]),
    session.id ? unwrap(supabase.from('absences').select('*').eq('session_id', session.id).is('deleted_at', null)) : [],
  ])
  const absentIds = new Set(absences.map((a) => a.member_id))
  return { session, absentIds, members: rosterFor(session, signups, absentIds) }
}

export default function ClassDetail() {
  const { id, slotId, date } = useParams()
  const result = useLoad(() => loadClass({ id, slotId, date }), [id, slotId, date])
  const session = result.data?.session
  // She can arrive from Inicio or from a class, so "Volver" returns to the previous screen.
  const goBack = useGoBack(session ? `/?date=${session.date}` : '/')

  return (
    <main className="screen">
      <button className="back-link" onClick={goBack}>‹ Volver</button>
      <LoadState {...result} />
      {result.data && (
        <>
          <h1>
            {session.group.name}
            {!session.slot_id && <span className="badge">Extra</span>}
          </h1>
          <p className="class-when">
            {formatDay(session.date)} · {formatTime(session.start_time)} · {session.duration_min} min
          </p>
          {session.original_date && session.original_date !== session.date && (
            <p className="muted">Cambiada de su día de siempre, {formatDay(session.original_date)}.</p>
          )}

          {session.cancelled ? (
            <p className="notice">Esta clase está suspendida.</p>
          ) : (
            // key: start the list fresh from the database whenever the class or its saved attendance changes
            <Attendance key={`${session.id}_${session.attendance_saved_at}`} {...result.data} reload={result.reload} onSaved={goBack} />
          )}
          <ClassOptions session={session} reload={result.reload} />
        </>
      )}
    </main>
  )
}

function Attendance({ session, members, absentIds, reload, onSaved }) {
  const showToast = useToast()
  const [absent, setAbsent] = useState(new Set(absentIds))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function toggle(memberId) {
    const next = new Set(absent)
    next.has(memberId) ? next.delete(memberId) : next.add(memberId)
    setAbsent(next)
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      const saved = await ensureSaved(session)
      const added = [...absent].filter((id) => !absentIds.has(id))
      const removed = [...absentIds].filter((id) => !absent.has(id))
      if (added.length > 0) {
        // upsert: if this member was marked absent before and then
        // un-marked (deleted_at set), bring that row back.
        await unwrap(
          supabase.from('absences').upsert(
            added.map((member_id) => ({ session_id: saved.id, member_id, deleted_at: null })),
            { onConflict: 'session_id,member_id' },
          ),
        )
      }
      if (removed.length > 0) {
        // Never deleted, only marked as removed.
        await unwrap(
          supabase.from('absences').update({ deleted_at: new Date().toISOString() }).eq('session_id', saved.id).in('member_id', removed),
        )
      }
      await unwrap(supabase.from('sessions').update({ attendance_saved_at: new Date().toISOString() }).eq('id', saved.id))
      showToast('Asistencia guardada')
      onSaved()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
      reload()
    }
  }

  if (members.length === 0) {
    return <p className="empty">No hay chicas anotadas en esta clase. Anotalas desde la pestaña Chicas.</p>
  }

  const presentCount = members.length - absent.size
  return (
    <section className="section">
      <p className="hint">
        Todas están <strong>presentes</strong>. Tocá a las que <strong>faltaron</strong>.
      </p>
      <ul className="roster">
        {members.map((m) => {
          const isAbsent = absent.has(m.id)
          return (
            <li key={m.id}>
              <button className={`roster-row ${isAbsent ? 'absent' : ''}`} aria-pressed={isAbsent} onClick={() => toggle(m.id)}>
                <span className="roster-name">{m.name}</span>
                <span className="roster-status">{isAbsent ? '✗ Faltó' : '✓ Vino'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="save-bar">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : `Guardar · ${presentCount} vinieron, ${absent.size} faltaron`}
        </button>
      </div>
    </section>
  )
}

function ClassOptions({ session, reload }) {
  const showToast = useToast()
  const navigate = useNavigate()
  const [moving, setMoving] = useState(false)
  const [newDate, setNewDate] = useState(session.date)
  const [newTime, setNewTime] = useState(formatTime(session.start_time))
  const [error, setError] = useState('')

  // Saves changes, then opens the class by its id: a class that was only
  // calculated before now has a saved row.
  async function change(changes, message, undoChanges) {
    setError('')
    try {
      const saved = await updateSession(session, changes)
      navigate(sessionPath(saved), { replace: true })
      reload()
      showToast(message, undoChanges && (() => change(undoChanges, 'Cambio deshecho')))
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  async function move(e) {
    e.preventDefault()
    const ok = await change(
      { date: newDate, start_time: newTime },
      `Clase pasada al ${formatDay(newDate)} a las ${newTime}`,
      { date: session.date, start_time: session.start_time },
    )
    if (ok) setMoving(false)
  }

  return (
    <section className="section">
      <h2>Cambiar solo esta clase</h2>
      <p className="muted">El horario semanal de siempre no cambia.</p>

      {session.cancelled ? (
        <button className="btn-secondary" onClick={() => change({ cancelled: false }, 'La clase vuelve a estar')}>
          Volver a dar esta clase
        </button>
      ) : moving ? (
        <form onSubmit={move} className="slot-box">
          <div className="slot-fields two-equal">
            <label>
              Nuevo día
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            </label>
            <label>
              Nueva hora
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
            </label>
          </div>
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setMoving(false)}>Cancelar</button>
            <button className="btn-primary">Cambiar clase</button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <button className="btn-secondary" onClick={() => setMoving(true)}>Pasar a otro día u hora</button>
          <button className="btn-secondary" onClick={() => change({ cancelled: true }, 'Clase suspendida', { cancelled: false })}>
            Suspender esta clase
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
