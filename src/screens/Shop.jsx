import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { formatMoney, plural, todayISO } from '../lib/format.js'
import { METHODS, sumByMethod } from '../lib/payments.js'
import { isLow, loadBalance, loadProducts, loadSales, recordSale, saleTotal, sortByStock, undoSale } from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

async function loadShop() {
  const today = todayISO()
  const [products, sales, balance] = await Promise.all([loadProducts(), loadSales(today, today), loadBalance()])
  return { products, sales, balance }
}

export default function Shop() {
  const result = useLoad(loadShop, [])
  const [openId, setOpenId] = useState(null) // the product whose "Vender" panel is open
  const products = result.data?.products
  const active = sortByStock(products?.filter((p) => p.active) ?? [])
  const inactive = products?.filter((p) => !p.active) ?? []
  const low = active.filter(isLow)

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Tienda</h1>
        <Link to="/shop/new" className="btn-primary btn-add">+ Producto</Link>
      </header>
      <LoadState {...result} />

      {products && (
        <>
          <Link to="/shop/wallet" className="card wallet-card">
            <span>
              <span className="muted">Billetera de la tienda</span>
              <span className="big-number">{formatMoney(result.data.balance)}</span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>

          {low.length > 0 && (
            <p className="stock-warning" role="status">
              <strong>Poco stock:</strong> {low.map((p) => `${p.name} (${p.stock})`).join(', ')}
            </p>
          )}

          <TodaySales sales={result.data.sales} reload={result.reload} />

          {active.length === 0 ? (
            <p className="empty">Todavía no hay productos. Tocá “+ Producto” para cargar lo que vendés (agua, barritas, remeras…).</p>
          ) : (
            <ul className="card-list">
              {active.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    product={p}
                    open={openId === p.id}
                    onOpen={() => setOpenId(p.id)}
                    onClose={() => setOpenId(null)}
                    reload={result.reload}
                  />
                </li>
              ))}
            </ul>
          )}

          {inactive.length > 0 && (
            <details className="section">
              <summary>Productos que ya no vendés ({inactive.length})</summary>
              <ul className="row-list">
                {inactive.map((p) => (
                  <li key={p.id}>
                    <Link to={`/shop/${p.id}`} className="row-link">{p.name} ›</Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  )
}

// "Sin stock" / "Quedan 2" / "12 en stock"
function StockChip({ product }) {
  if (product.stock <= 0) return <span className="chip chip-overdue">Sin stock</span>
  if (isLow(product)) return <span className="chip chip-partial">Quedan {product.stock}</span>
  return <span className="chip chip-paid">{product.stock} en stock</span>
}

function ProductCard({ product: p, open, onOpen, onClose, reload }) {
  return (
    <div className={`card product-card ${p.stock <= 0 ? 'out-of-stock' : ''}`}>
      {/* The whole top (name, price, stock) opens the product to edit it */}
      <Link to={`/shop/${p.id}`} className="product-top">
        <span className="charge-name">
          <span className="card-title">{p.name}</span>
          <span>{formatMoney(p.price)}</span>
        </span>
        <span className="charge-right">
          <StockChip product={p} />
        </span>
        <span className="product-chevron" aria-hidden="true">›</span>
      </Link>
      {open ? (
        <SellPanel product={p} onDone={() => { onClose(); reload() }} onCancel={onClose} />
      ) : (
        <button className="btn-primary" onClick={onOpen}>Vender</button>
      )}
    </div>
  )
}

// How many (default 1) and how they paid. Tapping the payment method
// records the sale, like "Cobrar" on Pagos.
function SellPanel({ product, onDone, onCancel }) {
  const showToast = useToast()
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sell(method) {
    setError('')
    setBusy(true)
    try {
      const saleId = await recordSale(product.id, qty, method)
      onDone()
      showToast(`Vendido: ${qty} × ${product.name}`, async () => {
        try {
          await undoSale(saleId)
          onDone()
        } catch (err) {
          showToast(saveErrorMessage(err))
        }
      })
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="pay-panel">
      <div className="qty-row">
        <button className="btn-secondary qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Uno menos" disabled={qty <= 1}>−</button>
        <span className="qty-value" aria-live="polite">
          {qty} <span className="muted">· {formatMoney(qty * product.price)}</span>
        </span>
        <button className="btn-secondary qty-btn" onClick={() => setQty(qty + 1)} aria-label="Uno más">+</button>
      </div>
      {qty > product.stock && (
        <p className="muted">Según la app quedan {product.stock}. Se vende igual; después corregí el stock si hace falta.</p>
      )}
      <p className="pay-question">¿Cómo pagó?</p>
      <div className="method-buttons">
        {Object.entries(METHODS).map(([key, label]) => (
          <button key={key} className="btn-primary" onClick={() => sell(key)} disabled={busy}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-text btn-cancel" onClick={onCancel}>Cancelar</button>
    </div>
  )
}

// The time a sale was recorded, in Argentina: "19:05"
const saleTime = (sale) =>
  new Date(sale.created_at).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires',
  })

function TodaySales({ sales, reload }) {
  const showToast = useToast()
  if (sales.length === 0) return null
  const total = sales.reduce((sum, s) => sum + saleTotal(s), 0)
  const byMethod = sumByMethod(sales.map((s) => ({ method: s.method, amount: saleTotal(s) })))

  async function remove(sale) {
    // Removing is the one place we ask first (see the UX rules).
    if (!window.confirm(`¿Quitar la venta de ${sale.qty} × ${sale.products.name}? El stock vuelve.`)) return
    try {
      await undoSale(sale.id)
      showToast('Venta quitada')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <section className="summary">
      <p className="big-number">
        {formatMoney(total)} <span className="muted">vendido hoy</span>
      </p>
      <ul className="method-totals" aria-label="Vendido hoy por forma de pago">
        {byMethod.map(([method, amount]) => (
          <li key={method}>
            <span>{METHODS[method]}</span>
            <strong>{formatMoney(amount)}</strong>
          </li>
        ))}
      </ul>
      <details>
        <summary>Ver las ventas de hoy ({plural(sales.length, 'venta', 'ventas')})</summary>
        <ul className="payment-lines">
          {sales.map((s) => (
            <li key={s.id}>
              <span>
                {saleTime(s)} · {s.qty} × {s.products.name} · {formatMoney(saleTotal(s))} · {METHODS[s.method]}
              </span>
              <button className="btn-text" onClick={() => remove(s)}>Quitar</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
