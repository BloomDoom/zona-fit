// Dates, months, times and money, formatted the Argentine way.
//
// Dates are passed around as ISO strings ("2026-09-28") because that's
// what Postgres uses. They're only turned into "28/09/2026" for display.
// Months are the 1st of the month: "2026-09-01" = September 2026.

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

// Today's date in Argentina, as "2026-09-28".
// ("en-CA" happens to format dates as YYYY-MM-DD.)
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function currentMonthISO() {
  return todayISO().slice(0, 8) + '01'
}

// "2026-09-28" → "28/09/2026"
export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// "28/09/2026" (or 28-9-2026) → "2026-09-28". Returns null if invalid.
export function parseDate(text) {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match.map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null // e.g. 31/02
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// "2026-09-01" → "Septiembre 2026"
export function formatMonth(iso) {
  const [y, m] = iso.split('-').map(Number)
  return `${capitalize(MONTH_NAMES[m - 1])} ${y}`
}

// "septiembre" → "Septiembre"
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// A JavaScript Date (local, no time zone math) → "2026-09-28"
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// addMonths("2026-11-01", 2) → "2027-01-01"
export function addMonths(monthIso, n) {
  const [y, m] = monthIso.split('-').map(Number)
  return toISO(new Date(y, m - 1 + n, 1))
}

// addDays("2026-09-30", 1) → "2026-10-01"
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + n))
}

// Every date from `from` to `to`, both included.
export function datesBetween(from, to) {
  const dates = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

// "2026-09-29" → 2 (Tuesday). 1 = Monday ... 7 = Sunday, like the database.
export function isoWeekday(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() || 7 // getDay() says 0 for Sunday
}

// "2026-09-29" → "Martes 29/09"
export function formatDay(iso) {
  return `${weekdayName(isoWeekday(iso))} ${formatDate(iso).slice(0, 5)}`
}

// 25000 → "$ 25.000"
const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
export function formatMoney(amount) {
  return money.format(amount)
}

// "$ 25.000" or "25000" → 25000. Returns null if there's no number.
export function parseAmount(text) {
  const withoutCents = String(text).trim().replace(/,\d{1,2}$/, '')
  const digits = withoutCents.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

// Weekday numbers follow the database: 1 = Monday ... 7 = Sunday.
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function weekdayName(n) {
  return WEEKDAYS[n - 1]
}

// Postgres returns times as "18:00:00"; show "18:00".
export function formatTime(time) {
  return time.slice(0, 5)
}

// 60 → "60 min"
export function formatDuration(minutes) {
  return `${minutes} min`
}

// plural(1, 'socio', 'socios') → "1 socio", plural(3, …) → "3 socios"
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}
