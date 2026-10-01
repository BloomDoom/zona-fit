import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { formatMoney, plural, todayISO } from '../lib/format.js'
import { METHODS, sumByMethod } from '../lib/payments.js'
import {
  isLow, lendProduct, lentByProduct, loadActiveMembers, loadBalance, loadOpenLoans, loadProducts, loadSales, loansByMember,
  recordSale, saleTotal, sortByStock, undoLoanMove, undoSale,
} from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import LoanCard from '../components/LoanCard.jsx'

async function loadShop() {
  const today = todayISO()
  const [products, sales, balance, loans, members] = await Promise.all([
    // open_loans needs the 2026-09-30 migration: until it's run, no loans instead of a broken Tienda
    loadProducts(), loadSales(today, today), loadBalance(), loadOpenLoans().catch(() => []), loadActiveMembers(),
  ])
  return { products, sales, balance, loans, members }
}

export default function Shop() {
  const result = useLoad(loadShop, [])
  const [open, setOpen] = useState(null) // { id, panel: 'sell' | 'lend' }: the product whose panel is open
  const products = result.data?.products
  const active = sortByStock(products?.filter((p) => p.active) ?? [])
  const inactive = products?.filter((p) => !p.active) ?? []
  const low = active.filter(isLow)
  const loans = result.data?.loans ?? []
  const lent = lentByProduct(loans)

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

          <TodaySales sales={result.data.sales} members={result.data.members} reload={result.reload} />

          {loans.length > 0 && (
            <section className="section">
              <h2>Prendas con las chicas</h2>
              <ul className="card-list">
                {loansByMember(loans).map((m) => (
                  <li key={m.member_id}>
                    <LoanCard member={m} reload={result.reload} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {active.length === 0 ? (
            <p className="empty">Todavía no hay productos. Tocá “+ Producto” para cargar lo que vendés (agua, barritas, remeras…).</p>
          ) : (
            <ul className="card-list">
              {active.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    product={p}
                    lent={lent[p.id] || 0}
                    members={result.data.members}
                    panel={open?.id === p.id ? open.panel : null}
                    onOpen={(panel) => setOpen({ id: p.id, panel })}
                    onClose={() => setOpen(null)}
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

// lent = how many are with the chicas (not counted in the stock).
function ProductCard({ product: p, lent, members, panel, onOpen, onClose, reload }) {
  const done = () => { onClose(); reload() }
  return (
    <div className={`card product-card ${p.stock <= 0 ? 'out-of-stock' : ''}`}>
      {/* The whole top (name, price, stock) opens the product to edit it */}
      <Link to={`/shop/${p.id}`} className="product-top">
        <span className="charge-name">
          <span className="card-title">{p.name}</span>
          <span>{formatMoney(p.price)}</span>
          {lent > 0 && <span className="muted">{lent} con chicas</span>}
        </span>
        <span className="charge-right">
          <StockChip product={p} />
        </span>
        <span className="product-chevron" aria-hidden="true">›</span>
      </Link>
      {panel === 'sell' && <SellPanel product={p} onDone={done} onCancel={onClose} />}
      {panel === 'lend' && <LendPanel product={p} members={members} onDone={done} onCancel={onClose} />}
      {!panel && (
        <div className="btn-row">
          <button className="btn-primary" onClick={() => onOpen('sell')}>Vender</button>
          <button className="btn-secondary" onClick={() => onOpen('lend')}>Se lo lleva…</button>
        </div>
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

// A chica takes it to try: who and how many. It leaves the stock until she
// buys it or gives it back (on "Prendas con las chicas").
function LendPanel({ product, members, onDone, onCancel }) {
  const showToast = useToast()
  const [memberId, setMemberId] = useState('')
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function lend() {
    if (!memberId) return setError('Elegí quién se lo lleva.')
    setError('')
    setBusy(true)
    const name = members.find((m) => m.id === Number(memberId))?.name
    try {
      const moveId = await lendProduct(product.id, Number(memberId), qty)
      onDone()
      showToast(`${name} se llevó ${qty} × ${product.name}`, async () => {
        try {
          await undoLoanMove(moveId)
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
      <label>
        ¿Quién se lo lleva?
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Elegí una chica</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <div className="qty-row">
        <button className="btn-secondary qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Uno menos" disabled={qty <= 1}>−</button>
        <span className="qty-value" aria-live="polite">{qty}</span>
        <button className="btn-secondary qty-btn" onClick={() => setQty(qty + 1)} aria-label="Uno más">+</button>
      </div>
      {qty > product.stock && (
        <p className="muted">Según la app quedan {product.stock}. Se guarda igual; después corregí el stock si hace falta.</p>
      )}
      <button className="btn-primary" onClick={lend} disabled={busy}>Se lo lleva a probar</button>
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

function TodaySales({ sales, members, reload }) {
  // Who bought it, for clothes a chica had taken
  const buyer = (sale) => members.find((m) => m.id === sale.member_id)?.name
  const showToast = useToast()
  if (sales.length === 0) return null
  const total = sales.reduce((sum, s) => sum + saleTotal(s), 0)
  const byMethod = sumByMethod(sales.map((s) => ({ method: s.method, amount: saleTotal(s) })))

  async function remove(sale) {
    // Removing is the one place we ask first (see the UX rules).
    if (!window.confirm(`¿Quitar la venta de ${sale.qty} × ${sale.products.name}? ${sale.member_id ? `Vuelve a quedar con ${buyer(sale) || 'la chica que la tenía'}.` : 'El stock vuelve.'}`)) return
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
                {saleTime(s)} · {s.qty} × {s.products.name}{buyer(s) && ` (${buyer(s)})`} · {formatMoney(saleTotal(s))} · {METHODS[s.method]}
              </span>
              <button className="btn-text" onClick={() => remove(s)}>Quitar</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
