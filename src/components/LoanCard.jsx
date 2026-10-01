import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatMoney } from '../lib/format.js'
import { METHODS } from '../lib/payments.js'
import { returnLoan, sellLoan, undoLoanMove, undoSale } from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'

// One chica and the clothes she has from the shop. Each item can be
// "Compró" (she pays, like Vender) or "Devolvió" (back on the rack).
// showName: false on her own page, where the name is already the title.
export default function LoanCard({ member, reload, showName = true }) {
  const [open, setOpen] = useState(null) // { productId, action: 'buy' | 'return' }
  const total = member.items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="card loan-card">
      {showName && (
        <Link to={`/members/${member.member_id}`} className="loan-name">
          <span className="card-title">{member.member_name}</span>
          <span className="muted">{total === 1 ? '1 prenda' : `${total} prendas`}</span>
        </Link>
      )}
      <ul className="loan-items">
        {member.items.map((item) => (
          <li key={item.product_id}>
            <p className="loan-item">
              <strong>{item.qty} × {item.product_name}</strong>
              <span className="muted">
                {formatMoney(item.price)} c/u · desde el {formatDate(item.since)}
              </span>
            </p>
            {open?.productId === item.product_id ? (
              <LoanPanel
                item={item}
                action={open.action}
                onDone={() => { setOpen(null); reload() }}
                onCancel={() => setOpen(null)}
              />
            ) : (
              <div className="btn-row">
                <button className="btn-primary" onClick={() => setOpen({ productId: item.product_id, action: 'buy' })}>Compró</button>
                <button className="btn-secondary" onClick={() => setOpen({ productId: item.product_id, action: 'return' })}>Devolvió</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// How many (starts at all she has) and then how she paid, or "Devolver".
function LoanPanel({ item, action, onDone, onCancel }) {
  const showToast = useToast()
  const [qty, setQty] = useState(item.qty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const who = item.member_name

  async function save(method) {
    setError('')
    setBusy(true)
    try {
      if (action === 'buy') {
        const saleId = await sellLoan(item.product_id, item.member_id, qty, method)
        onDone()
        showToast(`${who} compró ${qty} × ${item.product_name}`, () => undo(() => undoSale(saleId)))
      } else {
        const moveId = await returnLoan(item.product_id, item.member_id, qty)
        onDone()
        showToast(`${who} devolvió ${qty} × ${item.product_name}`, () => undo(() => undoLoanMove(moveId)))
      }
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  async function undo(action) {
    try {
      await action()
      onDone()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <div className="pay-panel">
      {item.qty > 1 && (
        <div className="qty-row">
          <button className="btn-secondary qty-btn" onClick={() => setQty(qty - 1)} aria-label="Uno menos" disabled={qty <= 1}>−</button>
          <span className="qty-value" aria-live="polite">
            {qty} <span className="muted">de {item.qty}{action === 'buy' && ` · ${formatMoney(qty * item.price)}`}</span>
          </span>
          <button className="btn-secondary qty-btn" onClick={() => setQty(qty + 1)} aria-label="Uno más" disabled={qty >= item.qty}>+</button>
        </div>
      )}
      {action === 'buy' ? (
        <>
          <p className="pay-question">
            {item.qty === 1 && `${formatMoney(item.price)} · `}¿Cómo pagó?
          </p>
          <div className="method-buttons">
            {Object.entries(METHODS).map(([key, label]) => (
              <button key={key} className="btn-primary" onClick={() => save(key)} disabled={busy}>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className="btn-primary" onClick={() => save()} disabled={busy}>
          Vuelve al perchero
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-text btn-cancel" onClick={onCancel}>Cancelar</button>
    </div>
  )
}
