import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { DURATIONS } from '../components/SlotFields.jsx'

function loadGroups() {
  return unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name'))
}

// A one-off extra class (e.g. to make up a cancelled one). It's saved
// straight into `sessions` with no weekly slot.
export default function ClassNew() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const result = useLoad(loadGroups, [])
  const [groupId, setGroupId] = useState(params.get('group') || '')
  const [date, setDate] = useState(params.get('date') || todayISO())
  const [time, setTime] = useState('19:00')
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(
        supabase.from('sessions').insert({ group_id: Number(groupId), date, start_time: time, duration_min: duration }),
      )
      showToast(`Clase extra agregada el ${formatDay(date)}`)
      navigate(`/?date=${date}`)
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <Link to={`/?date=${date}`} className="back-link">‹ Inicio</Link>
      <h1>Clase extra</h1>
      <p className="muted">Una clase por única vez, por ejemplo para recuperar una suspendida.</p>
      <LoadState {...result} />

      {result.data && (
        <form onSubmit={handleSubmit}>
          <label>
            Clase
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
              <option value="" disabled>Elegí una clase</option>
              {result.data.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label>
            Día
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div className="slot-fields two-equal">
            <label>
              Hora
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
            <label>
              Duración
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Agregar clase extra'}</button>
        </form>
      )}
    </main>
  )
}
