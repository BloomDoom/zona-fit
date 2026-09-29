import { WEEKDAYS } from '../lib/format.js'

export const DURATIONS = [30, 45, 50, 60, 75, 90, 120]

export const NEW_SLOT = { weekday: 1, start_time: '19:00', duration_min: 60 }

// The three fields for one weekly class time: day, time, length.
// `slot` is { weekday, start_time, duration_min }; onChange gets the new one.
export default function SlotFields({ slot, onChange }) {
  const set = (field, value) => onChange({ ...slot, [field]: value })

  return (
    <div className="slot-fields">
      <label>
        Día
        <select value={slot.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
          {WEEKDAYS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
      </label>
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
