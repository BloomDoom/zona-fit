// Shop (tienda): products, sales and stock.
//
// Stock is never changed directly from the app: the database functions
// record_sale, undo_sale and add_stock (see schema.sql) change the sale
// and the stock together, so they can't get out of step.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'

// At or below this, a product shows as "running low".
export const LOW_STOCK = 3

export function loadProducts() {
  return unwrap(supabase.from('products').select('*').order('name'))
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

// qty can be negative, to correct a count.
export function addStock(productId, qty) {
  return unwrap(supabase.rpc('add_stock', { p_product: productId, p_qty: qty }))
}

export const saleTotal = (sale) => sale.qty * sale.unit_price

// Out of stock first, then running low, then the rest; A–Z inside each.
export function sortByStock(products) {
  const rank = (p) => (p.stock <= 0 ? 0 : p.stock <= LOW_STOCK ? 1 : 2)
  return [...products].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'))
}
