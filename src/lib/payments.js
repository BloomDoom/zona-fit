// Payment helpers: statuses, balances and loading the settings.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

// Also used by the shop (sales have the same methods).
export const METHODS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  cuenta_dni: 'Cuenta DNI',
}

// Adds up amounts per payment method, biggest first: [['cash', 50000], ...]
// `items` = [{ method, amount }]
export function sumByMethod(items) {
  const totals = {}
  for (const { method, amount } of items) totals[method] = (totals[method] || 0) + amount
  return Object.entries(totals).sort((a, b) => b[1] - a[1])
}

// Total collected per payment method for a list of charges.
export function totalsByMethod(charges) {
  return sumByMethod(charges.flatMap(activePayments))
}

export const STATUS_LABELS = {
  overdue: 'Vencida',
  unpaid: 'Sin pagar',
  partial: 'Parcial',
  paid: 'Pagada',
}

// Order on the Pagos screen: what needs attention first.
const STATUS_ORDER = ['overdue', 'unpaid', 'partial', 'paid']

export function loadSettings() {
  return unwrap(supabase.from('settings').select('*').eq('id', 1).single())
}

// Creates the month's charges if they don't exist yet (see schema.sql).
export function ensureCharges(month) {
  return unwrap(supabase.rpc('ensure_charges', { p_month: month }))
}

// Payments that weren't removed.
export function activePayments(charge) {
  return (charge.payments || []).filter((p) => !p.deleted_at)
}

// Each member's fee is due on the day of the month she started: started
// on the 15th → due on the 15th of every month. A 31st becomes the last
// day of shorter months (30 Apr, 28 Feb).
export function dueDate(month, startDate) {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const day = Math.min(Number(startDate.slice(8, 10)), lastDay)
  return month.slice(0, 8) + String(day).padStart(2, '0')
}

// Adds paid, balance, due and status to a charge. `charge.payments` and
// `charge.members.start_date` must be loaded.
//   paid    = total paid so far
//   balance = what's still owed
//   due     = the date it's due (YYYY-MM-DD)
//   status  = 'paid' | 'partial' | 'unpaid' | 'overdue'
// Overdue = not fully paid and today is after its due date.
export function withStatus(charge) {
  const paid = activePayments(charge).reduce((sum, p) => sum + p.amount, 0)
  const balance = Math.max(charge.amount - paid, 0)
  const due = dueDate(charge.month, charge.members.start_date)

  let status = 'paid'
  if (balance > 0) {
    if (todayISO() > due) status = 'overdue'
    else status = paid > 0 ? 'partial' : 'unpaid'
  }
  return { ...charge, paid, balance, due, status }
}

// Inside each status, the earliest due date first.
export function sortByStatus(charges) {
  return [...charges].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.due.localeCompare(b.due) ||
      a.members.name.localeCompare(b.members.name, 'es'),
  )
}
