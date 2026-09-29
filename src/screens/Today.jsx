import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addDays, formatDate, formatDay, formatTime, isoWeekday, plural, todayISO, weekdayName } from '../lib/format.js'
import { loadSessions, membersOn, sessionPath, updateSession } from '../lib/sessions.js'
import { birthdaysBetween } from '../lib/members.js'
import { loadSettings } from '../lib/payments.js'
import { loadLowStock } from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import Birthdays from '../components/Birthdays.jsx'

async function loadDay(date) {
  const sessions = await loadSessions(date, date)
  const groupIds = [...new Set(sessions.map((s) => s.group_id))]
  const savedIds = sessions.filter((s) => s.id).map((s) => s.id)
  const [enrollments, absences, withBirthday, settings, lowStock] = await Promise.all([
    groupIds.length
      ? unwrap(supabase.from('enrollments').select('group_id, start_date, end_date, members(id, name, active)').in('group_id', groupIds))
      : [],
    savedIds.length
      ? unwrap(supabase.from('absences').select('session_id').in('session_id', savedIds).is('deleted_at', null))
      : [],
    unwrap(supabase.from('members').select('id, name, phone, birth_date').eq('active', true).not('birth_date', 'is', null)),
    loadSettings(),
    loadLowStock().catch(() => []), // only a reminder: never let it break Inicio
  ])
  return {
    lowStock,
    // birthdays on this day and the 6 days after it
    birthdays: birthdaysBetween(withBirthday, date, addDays(date, 6)),
    birthdayMessage: settings.birthday_message,
    sessions: sessions.map((s) => ({
      ...s,
      memberCount: membersOn(enrollments.filter((e) => e.group_id === s.group_id), s.date).length,
      absentCount: absences.filter((a) => a.session_id === s.id).length,
    })),
  }
}

// The day's name for the big title.
function dayTitle(date) {
  const today = todayISO()
  if (date === today) return 'Hoy'
  if (date === addDays(today, 1)) return 'Mañana'
  if (date === addDays(today, -1)) return 'Ayer'
  return weekdayName(isoWeekday(date))
}

export default function Today() {
  // The day being shown lives in the URL (/?date=2026-09-29), so coming
  // back from a class returns to the same day.
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayISO()
  const goTo = (newDate) => setParams(newDate === todayISO() ? {} : { date: newDate }, { replace: true })

  const result = useLoad(() => loadDay(date), [date])
  const sessions = result.data?.sessions

  return (
    <main className="screen">
      <header className="home-header">
        <div className="title">
          <h1>{dayTitle(date)}</h1>
          <p className="muted">{weekdayName(isoWeekday(date))} {formatDate(date)}</p>
        </div>
        <div className="home-arrows">
          <button className="btn-icon round-btn" onClick={() => goTo(addDays(date, -1))} aria-label="Día anterior">‹</button>
          <button className="btn-icon round-btn" onClick={() => goTo(addDays(date, 1))} aria-label="Día siguiente">›</button>
        </div>
      </header>
      {date !== todayISO() && (
        <button className="btn-secondary" onClick={() => goTo(todayISO())}>Volver a hoy</button>
      )}

      <LoadState {...result} />
      {result.data && <Birthdays birthdays={result.data.birthdays} date={date} message={result.data.birthdayMessage} />}
      {result.data?.lowStock.length > 0 && (
        <Link to="/shop" className="stock-warning">
          <strong>Poco stock en la tienda:</strong>{' '}
          {result.data.lowStock.map((p) => `${p.name} (${p.stock})`).join(', ')} ›
        </Link>
      )}

      {sessions && (
        <>
          {sessions.length === 0 ? (
            <p className="empty">No hay clases este día. Usá las flechas para ver otros días.</p>
          ) : (
            <ul className="card-list">
              {sessions.map((s) => (
                <li key={`${s.id ?? 'slot' + s.slot_id}_${s.date}`}>
                  <SessionCard session={s} />
                </li>
              ))}
            </ul>
          )}

          <Link to={`/class/new?date=${date}`} className="btn-secondary">+ Agregar clase extra</Link>
          <CancelDay sessions={sessions} reload={result.reload} />
        </>
      )}
    </main>
  )
}

function SessionCard({ session: s }) {
  let status = null
  if (s.movedAway) status = <span className="status muted">Pasada al {formatDay(s.movedAway.date)} a las {formatTime(s.movedAway.start_time)}</span>
  else if (s.cancelled) status = <span className="status status-cancelled">Suspendida</span>
  else if (s.attendance_saved_at) {
    status = (
      <span className="status status-done">
        ✓ Asistencia guardada{s.absentCount > 0 && ` · ${plural(s.absentCount, 'ausente', 'ausentes')}`}
      </span>
    )
  }

  const dimmed = s.cancelled || s.movedAway
  return (
    <Link to={sessionPath(s)} className={`card session-card ${dimmed ? 'dimmed' : ''}`}>
      <span className="session-time">{formatTime(s.start_time)}</span>
      <span className="session-info">
        <span className="card-title">
          {s.group.name}
          {!s.slot_id && <span className="badge">Extra</span>}
        </span>
        <span className="muted">{plural(s.memberCount, 'chica', 'chicas')}</span>
        {status}
      </span>
    </Link>
  )
}

// For holidays: cancel every class of the day in one tap (with Undo).
function CancelDay({ sessions, reload }) {
  const showToast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toCancel = sessions.filter((s) => !s.cancelled && !s.movedAway)
  if (toCancel.length < 2) return null // for one class, use the class screen

  // Returns the saved rows (with ids), or null if it failed.
  async function setCancelled(list, cancelled) {
    setError('')
    setBusy(true)
    try {
      const saved = []
      for (const s of list) saved.push(await updateSession(s, { cancelled }))
      return saved
    } catch (err) {
      setError(saveErrorMessage(err))
      return null
    } finally {
      setBusy(false)
      reload()
    }
  }

  async function cancelAll() {
    const saved = await setCancelled(toCancel, true)
    if (saved) showToast(`${plural(saved.length, 'clase suspendida', 'clases suspendidas')}`, () => setCancelled(saved, false))
  }

  return (
    <section className="section">
      <button className="btn-secondary" onClick={cancelAll} disabled={busy}>
        {busy ? 'Suspendiendo…' : 'Suspender todas las clases de este día'}
      </button>
      <p className="muted">Para feriados. Lo podés deshacer enseguida.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
