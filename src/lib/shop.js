// Shop (tienda): products, sales, stock and the shop's wallet.
//
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
