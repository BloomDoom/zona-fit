import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'

// Members still signed up to a whole class, sorted into:
//   ready  = her plan's times a week equals the days of her class(es), so
//            her times are obvious: all of them (3 a week in a Lu Mi Vi class)
//   manual = anything else (e.g. 2 a week in a Lu Mi Vi class): she picks
async function loadCandidates() {
  const [members, groups] = await Promise.all([
    unwrap(
      supabase
        .from('members')
        .select('id, name, plans(times_per_week), enrollments(id, group_id, start_date, end_date), slot_enrollments(slot_id, end_date)')
        .eq('active', true),
    ),
    unwrap(supabase.from('groups').select('id, group_slots(id, active)')),
  ])
  const slotsOf = new Map(groups.map((g) => [g.id, g.group_slots.filter((s) => s.active).map((s) => s.id)]))
  const ready = []
  const manual = []
  for (const m of members) {
    const pending = m.enrollments.filter((e) => !e.end_date)
    if (pending.length === 0) continue
    const has = new Set(m.slot_enrollments.filter((e) => !e.end_date).map((e) => e.slot_id))
    // She keeps her class start date, so her past attendance still counts.
    const slots = pending.flatMap((e) => (slotsOf.get(e.group_id) || []).map((slot_id) => ({ slot_id, start_date: e.start_date })))
    if (m.plans?.times_per_week && slots.length === m.plans.times_per_week) {
      ready.push({
        enrollmentIds: pending.map((e) => e.id),
        rows: slots.filter((s) => !has.has(s.slot_id)).map((s) => ({ ...s, member_id: m.id })),
      })
    } else {
      manual.push(m)
    }
  }
  return { ready, manual }
}

// On Chicas, above the "Falta elegir horarios" list.
export default function AutoFillTimes({ onDone }) {
  const showToast = useToast()
  const result = useLoad(loadCandidates, [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const data = result.data
  if (!data || data.ready.length === 0) return null

  async function fill() {
    setError('')
    setBusy(true)
    try {
      const rows = data.ready.flatMap((r) => r.rows)
      if (rows.length > 0) await unwrap(supabase.from('slot_enrollments').insert(rows))
      await unwrap(
        supabase.from('enrollments').update({ end_date: todayISO() }).in('id', data.ready.flatMap((r) => r.enrollmentIds)),
      )
      showToast(`Listo: ${data.ready.length} chicas con sus horarios`)
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <section className="summary">
      <p>
        <strong>{data.ready.length} se pueden completar solas:</strong> su plan coincide con los días de su clase (por
        ejemplo, 3 veces por semana en una clase de Lu Mi Vi), así que quedan anotadas en todos esos días.
      </p>
      {data.manual.length > 0 && (
        <p className="muted">
          Las otras {data.manual.length} no coinciden (o su plan no dice cuántas veces): esas las elegís a mano.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-primary" onClick={fill} disabled={busy}>
        {busy ? 'Completando…' : `Completar ${data.ready.length} chicas`}
      </button>
    </section>
  )
}
