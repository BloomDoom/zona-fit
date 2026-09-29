import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap } from '../lib/useLoad.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import SlotFields, { NEW_SLOT, slotRows } from '../components/SlotFields.jsx'

export default function GroupNew() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState([NEW_SLOT])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (slots.some((s) => s.weekdays.length === 0)) return setError('Elegí al menos un día en cada horario.')
    setBusy(true)
    try {
      // 1. the class itself; .select().single() gives us back its new id
      const group = await unwrap(
        supabase.from('groups').insert({ name: name.trim(), notes: notes.trim() || null }).select().single(),
      )
      // 2. its weekly times: one row per day
      await unwrap(supabase.from('group_slots').insert(slots.flatMap((s) => slotRows(s, group.id))))
      showToast(`${group.name} creada`)
      navigate(`/groups/${group.id}`, { replace: true })
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Clases</Link>
      <h1>Nueva clase</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Nombre de la clase
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Funcional" required />
        </label>

        <h2>Horarios</h2>
        {slots.map((slot, i) => (
          <div key={i} className="slot-box">
            <SlotFields slot={slot} onChange={(s) => setSlots(slots.map((old, j) => (j === i ? s : old)))} />
            {slots.length > 1 && (
              <button type="button" className="btn-text" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                Quitar este horario
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setSlots([...slots, NEW_SLOT])}>
          + Otro horario (si algún día es a otra hora)
        </button>

        <label className="section">
          Notas <span className="optional">(opcional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Crear clase'}
        </button>
      </form>
    </main>
  )
}
