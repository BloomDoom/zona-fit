import { formatTime, plural, weekdayName } from '../lib/format.js'
import { slotLabel, turnos } from '../lib/groups.js'

// Pick the weekly times a member goes to. Each class shows its turnos
// (same hour on its days); tap single days, or "Todo el turno" for all
// the days of that turno (the usual case). Days of different classes can
// be mixed: Lunes 8:30 in Clase 1 + Jueves 16:30 in Clase 5.
//   groups       = active classes with group_slots
//   value        = chosen slot ids
//   onChange     = gets the new list of ids
//   timesPerWeek = her plan's classes per week (null = don't compare)
//   firstGroupId = show this class first (coming from a class screen)
export default function SlotPicker({ groups, value, onChange, timesPerWeek = null, firstGroupId = null }) {
  const chosen = new Set(value)
  const toggle = (ids, on) => {
    const next = new Set(chosen)
    for (const id of ids) on ? next.add(id) : next.delete(id)
    onChange([...next])
  }

  const ordered = [...groups].sort((a, b) => (b.id === firstGroupId) - (a.id === firstGroupId))
  const labels = []
  for (const g of ordered) {
    for (const s of g.group_slots) if (chosen.has(s.id)) labels.push({ slot: s, text: slotLabel(s, g.name) })
  }
  labels.sort((a, b) => a.slot.weekday - b.slot.weekday || a.slot.start_time.localeCompare(b.slot.start_time))

  return (
    <fieldset className="slot-picker">
      <legend>Horarios</legend>
      {groups.length === 0 && <p className="muted">Todavía no hay clases.</p>}

      {ordered.map((g) => {
        const list = turnos(g.group_slots)
        if (list.length === 0) return null
        return (
          <section key={g.id} className="picker-class" aria-label={g.name}>
            <h3>{g.name}</h3>
            {list.map((t) => {
              const ids = t.slots.map((s) => s.id)
              const all = ids.every((id) => chosen.has(id))
              return (
                <div key={t.time} className="picker-turno">
                  <span className="picker-time">{formatTime(t.time)}</span>
                  <span className="picker-days">
                    {t.slots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={chosen.has(s.id)}
                        aria-label={`${weekdayName(s.weekday)} ${formatTime(s.start_time)}, ${g.name}`}
                        onClick={() => toggle([s.id], !chosen.has(s.id))}
                      >
                        {weekdayName(s.weekday).slice(0, 2)}
                      </button>
                    ))}
                  </span>
                  {ids.length > 1 && (
                    <button type="button" className="picker-all" aria-pressed={all} onClick={() => toggle(ids, !all)}>
                      {all ? 'Quitar turno' : 'Todo el turno'}
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      <p className="picker-summary" aria-live="polite">
        {labels.length === 0
          ? 'Todavía no elegiste horarios.'
          : `Elegiste ${plural(labels.length, 'horario', 'horarios')}: ${labels.map((l) => l.text).join(' / ')}`}
      </p>
      {timesPerWeek && labels.length > 0 && labels.length !== timesPerWeek && (
        <p className="stock-warning">
          Su plan es de {timesPerWeek} {timesPerWeek === 1 ? 'vez' : 'veces'} por semana y elegiste {labels.length}.
          Se puede guardar igual.
        </p>
      )}
    </fieldset>
  )
}
