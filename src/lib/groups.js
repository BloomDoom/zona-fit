// Small helpers about classes ("groups") and plans, used by several screens.
import { currentMonthISO, formatTime, weekdayName } from './format.js'

// Active weekly times, sorted Monday→Sunday, then by time.
export function activeSlots(slots) {
  return slots
    .filter((s) => s.active)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
}

// A class's TURNOS: its active times grouped by hour. Clase 1 at 8:30 on
// Monday, Wednesday and Friday is one turno with three days.
//   [{ time: '08:30:00', slots: [Mon slot, Wed slot, Fri slot] }, ...]  earliest first
export function turnos(slots) {
  const byTime = new Map()
  for (const slot of activeSlots(slots)) {
    if (!byTime.has(slot.start_time)) byTime.set(slot.start_time, [])
    byTime.get(slot.start_time).push(slot)
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, list]) => ({ time, slots: list }))
}

// "Lu Mi Vi"
export const daysShort = (slots) => slots.map((s) => weekdayName(s.weekday).slice(0, 2)).join(' ')

// "Lu Mi Vi 8:30 · 16:30 · 19:00", or one line per different set of days:
// "Lu Mi 19:00 · Sá 10:00"
export function slotsSummary(slots) {
  const list = turnos(slots)
  if (list.length === 0) return 'Todavía sin horarios'
  const byDays = new Map()
  for (const t of list) {
    const days = daysShort(t.slots)
    byDays.set(days, [...(byDays.get(days) || []), formatTime(t.time)])
  }
  return [...byDays.entries()].map(([days, times]) => `${days} ${times.join(' · ')}`).join(' / ')
}

// Everyone currently in a class (any of its active times, or signed up
// to the whole class with times still to choose), active only, A–Z.
// `group` needs group_slots(slot_enrollments(end_date, members)) and
// enrollments(end_date, members).
export function classMembers(group) {
  const byId = new Map()
  const signups = [...activeSlots(group.group_slots).flatMap((s) => s.slot_enrollments), ...group.enrollments]
  for (const e of signups) {
    if (!e.end_date && e.members.active) byId.set(e.members.id, e.members)
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// "Lun 8:30 · Clase 1"
export const slotLabel = (slot, groupName) =>
  `${weekdayName(slot.weekday).slice(0, 3)} ${formatTime(slot.start_time)} · ${groupName}`

// A plan IS how many classes a week it includes; its name is made from
// that number, never typed: 2 → "2 veces por semana".
export const planName = (timesPerWeek) => (timesPerWeek === 1 ? '1 vez por semana' : `${timesPerWeek} veces por semana`)

// The number in a plan name typed by hand ("3 veces x semana" → 3), or null.
export function timesFromName(name) {
  const n = Number(name.match(/\d+/)?.[0])
  return n >= 1 && n <= 7 ? n : null
}

// The price row that applies to a month: the latest one starting on or
// before that month. null if the plan has no price for it yet.
export function priceForMonth(prices, month = currentMonthISO()) {
  return (
    prices
      .filter((p) => p.effective_month <= month)
      .sort((a, b) => b.effective_month.localeCompare(a.effective_month))[0] || null
  )
}


// For searching: lowercase and without accents, so "jose" finds "José".
export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
