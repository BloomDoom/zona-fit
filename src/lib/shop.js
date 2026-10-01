// Shop (tienda): products, sales, stock and the shop's wallet.
//
// products.stock is what's on the rack (perchero); clothes a chica took
// to try are counted apart (see "Clothes with the chicas" below).
// Stock is never changed directly from the app: the database functions
// record_sale, undo_sale, restock, undo_restock and add_stock (see
// schema.sql) change the sale or purchase and the stock together, so
// they can't get out of step.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'

// Each product has its own minimum (min_stock, "avisar cuando queden").
export const isLow = (p) => p.stock <= p.min_stock

export function loadProducts() {
  return unwrap(supabase.from('products').select('*').order('name'))
}

// Products still sold that are at or below their minimum, fewest first.
// (For the warning on Inicio and the dot on the Tienda tab.)
export async function loadLowStock() {
  const products = await unwrap(supabase.from('products').select('id, name, stock, min_stock').eq('active', true))
  return products.filter(isLow).sort((a, b) => a.stock - b.stock)
}

// Sales between two dates (both included), not removed, newest first.
export function loadSales(from, to) {
  return unwrap(
    supabase
      .from('sales')
      .select('*, products(id, name)')
      .gte('sold_on', from)
      .lte('sold_on', to)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  )
}

// Returns the new sale's id (for Undo).
export function recordSale(productId, qty, method) {
  return unwrap(supabase.rpc('record_sale', { p_product: productId, p_qty: qty, p_method: method }))
}

export function undoSale(saleId) {
  return unwrap(supabase.rpc('undo_sale', { p_sale: saleId }))
}

// A correction after counting (qty can be negative). No money moves.
export function addStock(productId, qty) {
  return unwrap(supabase.rpc('add_stock', { p_product: productId, p_qty: qty }))
}

// Stock arrived and she paid `cost` for all of it. Returns the purchase id (for Undo).
export function restock(productId, qty, cost) {
  return unwrap(supabase.rpc('restock', { p_product: productId, p_qty: qty, p_cost: cost }))
}

export function undoRestock(moveId) {
  return unwrap(supabase.rpc('undo_restock', { p_move: moveId }))
}

export const saleTotal = (sale) => sale.qty * sale.unit_price

// Out of stock first, then running low, then the rest; A–Z inside each.
export function sortByStock(products) {
  const rank = (p) => (p.stock <= 0 ? 0 : isLow(p) ? 1 : 2)
  return [...products].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'))
}

// ───────── Wallet (billetera)
// Money in: sales and deposits. Money out: purchases and withdrawals.

export const MOVE_LABELS = {
  purchase: 'Compra de mercadería',
  withdrawal: 'Retiro',
  deposit: 'Ingreso de plata',
}

export function loadBalance() {
  return unwrap(supabase.rpc('shop_balance'))
}

// Purchases, withdrawals and deposits between two dates, newest first.
export function loadMoves(from, to) {
  return unwrap(
    supabase
      .from('shop_moves')
      .select('*, products(id, name)')
      .gte('moved_on', from)
      .lte('moved_on', to)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  )
}

// A withdrawal or a deposit. Returns the new move's id (for Undo).
export async function addMove(kind, amount, note) {
  const move = await unwrap(supabase.from('shop_moves').insert({ kind, amount, note }).select('id').single())
  return move.id
}

// Removes a move. A purchase also takes its stock back.
export function removeMove(move) {
  if (move.kind === 'purchase') return undoRestock(move.id)
  return unwrap(supabase.from('shop_moves').update({ deleted_at: new Date().toISOString() }).eq('id', move.id))
}

// ───────── Clothes with the chicas
// Nadia gives clothes to a chica to try; later she buys them or gives them
// back. products.stock counts only the rack (perchero), so taking one
// lowers it and giving it back raises it; buying leaves it as it is.

// [{ member_id, member_name, product_id, product_name, price, qty, since }]
export function loadOpenLoans() {
  return unwrap(supabase.rpc('open_loans'))
}

// Active members A–Z, for "¿Quién se lo lleva?".
export function loadActiveMembers() {
  return unwrap(supabase.from('members').select('id, name').eq('active', true).order('name'))
}

// She takes qty from the rack. Returns the move id (for Undo).
export function lendProduct(productId, memberId, qty) {
  return unwrap(supabase.rpc('lend_product', { p_product: productId, p_member: memberId, p_qty: qty }))
}

// She gives qty back to the rack. Returns the move id (for Undo).
export function returnLoan(productId, memberId, qty) {
  return unwrap(supabase.rpc('return_loan', { p_product: productId, p_member: memberId, p_qty: qty }))
}

// Undo a "se llevó" or "devolvió".
export function undoLoanMove(moveId) {
  return unwrap(supabase.rpc('undo_loan_move', { p_move: moveId }))
}

// She buys qty of what she has. Returns the sale id (undo with undoSale).
export function sellLoan(productId, memberId, qty, method) {
  return unwrap(supabase.rpc('sell_loan', { p_product: productId, p_member: memberId, p_qty: qty, p_method: method }))
}

// Open loans grouped by chica: [{ member_id, member_name, items: [...] }]
export function loansByMember(loans) {
  const byMember = new Map()
  for (const loan of loans) {
    if (!byMember.has(loan.member_id)) byMember.set(loan.member_id, { member_id: loan.member_id, member_name: loan.member_name, items: [] })
    byMember.get(loan.member_id).items.push(loan)
  }
  return [...byMember.values()]
}

// How many of each product are with the chicas: { productId: qty }
export function lentByProduct(loans) {
  const totals = {}
  for (const loan of loans) totals[loan.product_id] = (totals[loan.product_id] || 0) + loan.qty
  return totals
}
