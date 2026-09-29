import { WEEKDAYS } from '../lib/format.js'

export const DURATIONS = [30, 45, 50, 60, 75, 90, 120]

// Days are picked all at once: Monday + Wednesday + Friday at 19:00 is one
// choice here, and becomes one group_slots row per day when saved.
export const NEW_SLOT = { weekdays: [], start_time: '19:00', duration_min: 60 }

// One database row per chosen day, ready to insert.
export const slotRows = (slot, groupId) =>
  slot.weekdays.map((weekday) => ({
    group_id: groupId, weekday, start_time: slot.start_time, duration_min: slot.duration_min,
  }))

// The fields for the class's weekly time: days, time, length.
// `slot` is { weekdays, start_time, duration_min }; onChange gets the new one.
export default function SlotFields({ slot, onChange }) {
  const set = (field, value) => onChange({ ...slot, [field]: value })
  const toggleDay = (day) =>
    set('weekdays', slot.weekdays.includes(day) ? slot.weekdays.filter((d) => d !== day) : [...slot.weekdays, day].sort())

  return (
    <div className="slot-fields">
      <fieldset className="day-picker">
        <legend>Días</legend>
        {WEEKDAYS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={slot.weekdays.includes(i + 1)}
            aria-label={name}
            onClick={() => toggleDay(i + 1)}
          >
            {name.slice(0, 2)}
          </button>
        ))}
      </fieldset>
      <label>
        Hora
        <input
          type="time"
          value={slot.start_time}
          onChange={(e) => set('start_time', e.target.value)}
          required
        />
      </label>
      <label>
        Duración
        <select value={slot.duration_min} onChange={(e) => set('duration_min', Number(e.target.value))}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>{m} min</option>
          ))}
        </select>
      </label>
    </div>
  )
}
