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

// Adds paid, balance and status to a charge. `charge.payments` must be loaded.
//   paid    = total paid so far
//   balance = what's still owed
//   status  = 'paid' | 'partial' | 'unpaid' | 'overdue'
// Overdue = not fully paid and today is after the due day of that month.
export function withStatus(charge, dueDay) {
  const paid = activePayments(charge).reduce((sum, p) => sum + p.amount, 0)
  const balance = Math.max(charge.amount - paid, 0)
  const dueDate = charge.month.slice(0, 8) + String(dueDay).padStart(2, '0')

  let status = 'paid'
  if (balance > 0) {
    if (todayISO() > dueDate) status = 'overdue'
    else status = paid > 0 ? 'partial' : 'unpaid'
  }
  return { ...charge, paid, balance, status }
}

export function sortByStatus(charges) {
  return [...charges].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.members.name.localeCompare(b.members.name, 'es'),
  )
}
