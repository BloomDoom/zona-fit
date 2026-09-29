// Small helpers about classes ("groups") and plans, used by several screens.
import { currentMonthISO, formatTime, weekdayName } from './format.js'

// Active weekly times, sorted Monday→Sunday, then by time.
export function activeSlots(slots) {
  return slots
    .filter((s) => s.active)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
}

// "Mar 19:00 · Jue 19:00"
export function slotsSummary(slots) {
  const active = activeSlots(slots)
  if (active.length === 0) return 'Todavía sin horarios'
  return active.map((s) => `${weekdayName(s.weekday).slice(0, 3)} ${formatTime(s.start_time)}`).join(' · ')
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

// Enrollments that are still going (the member hasn't left the class).
export function currentEnrollments(enrollments) {
  return enrollments.filter((e) => !e.end_date)
}

// For searching: lowercase and without accents, so "jose" finds "José".
export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
