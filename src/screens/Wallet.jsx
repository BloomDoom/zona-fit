import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { addDays, addMonths, currentMonthISO, formatDate, formatMoney, formatMonth, parseAmount } from '../lib/format.js'
import { MOVE_LABELS, addMove, loadBalance, loadMoves, loadSales, removeMove, saleTotal } from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

async function loadWallet(month) {
  const monthEnd = addDays(addMonths(month, 1), -1)
  const [balance, sales, moves] = await Promise.all([loadBalance(), loadSales(month, monthEnd), loadMoves(month, monthEnd)])
  const sum = (kind) => moves.filter((m) => m.kind === kind).reduce((total, m) => total + m.amount, 0)
  const sold = sales.reduce((total, s) => total + saleTotal(s), 0)
  const bought = sum('purchase')
  return {
    balance,
    moves,
    month: { sold, bought, profit: sold - bought, withdrawn: sum('withdrawal'), deposited: sum('deposit') },
  }
}

// The shop's own money, apart from the monthly fees:
//   in  = sales + money put in
//   out = stock bought + money taken out
export default function Wallet() {
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  const month = params.get('month') || thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  const result = useLoad(() => loadWallet(month), [month])
  const data = result.data

  return (
    <main className="screen">
      <Link to="/shop" className="back-link">‹ Tienda</Link>
      <h1>Billetera de la tienda</h1>
      <LoadState {...result} />

      {data && (
        <>
          <section className="summary">
            <p className="muted">Hay en la tienda</p>
            <p className={`big-number ${data.balance < 0 ? 'error' : ''}`}>{formatMoney(data.balance)}</p>
            <p className="muted">Lo vendido y lo que pusiste, menos las compras de mercadería y los retiros.</p>
          </section>

          <MoveForms reload={result.reload} />

          <header className="day-nav">
            <button className="btn-icon" onClick={() => goTo(addMonths(month, -1))} aria-label="Mes anterior">‹</button>
            <h2>{formatMonth(month)}</h2>
            <button className="btn-icon" onClick={() => goTo(addMonths(month, 1))} aria-label="Mes siguiente" disabled={month >= thisMonth}>›</button>
          </header>

          <ul className="method-totals wallet-month" aria-label={`Resumen de ${formatMonth(month)}`}>
            <li><span>Vendido</span><strong>{formatMoney(data.month.sold)}</strong></li>
            <li><span>Compras de mercadería</span><strong>− {formatMoney(data.month.bought)}</strong></li>
            <li className="wallet-profit"><span>Ganancia</span><strong>{formatMoney(data.month.profit)}</strong></li>
            {data.month.withdrawn > 0 && <li><span>Retiros</span><strong>− {formatMoney(data.month.withdrawn)}</strong></li>}
            {data.month.deposited > 0 && <li><span>Ingresos de plata</span><strong>{formatMoney(data.month.deposited)}</strong></li>}
          </ul>

          <MoveList moves={data.moves} reload={result.reload} />
        </>
      )}
    </main>
  )
}

// "Sacar plata" and "Poner plata": an amount and an optional note.
function MoveForms({ reload }) {
  const showToast = useToast()
  const [kind, setKind] = useState(null) // null, 'withdrawal' or 'deposit'
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function close() {
    setKind(null)
    setAmount('')
    setNote('')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!value) return setError('Escribí el monto, por ejemplo 20000.')
    setError('')
    setBusy(true)
    try {
      const id = await addMove(kind, value, note.trim() || null)
      close()
      reload()
      showToast(`${MOVE_LABELS[kind]}: ${formatMoney(value)}`, async () => {
        try {
          await removeMove({ id, kind })
          reload()
        } catch (err) {
          showToast(saveErrorMessage(err))
        }
      })
    } catch (err) {
      setError(saveErrorMessage(err))
    }
    setBusy(false)
  }

  if (kind === null) {
    return (
      <div className="btn-row">
        <button className="btn-secondary" onClick={() => setKind('withdrawal')}>Sacar plata</button>
        <button className="btn-secondary" onClick={() => setKind('deposit')}>Poner plata</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        {kind === 'withdrawal' ? '¿Cuánto sacaste?' : '¿Cuánto pusiste?'}
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
      </label>
      <label>
        Nota <span className="optional">(opcional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={kind === 'withdrawal' ? 'ej. Para pagar la luz' : 'ej. Cambio para arrancar'}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

// This month's purchases, withdrawals and deposits (sales are on Tienda).
function MoveList({ moves, reload }) {
  const showToast = useToast()
  if (moves.length === 0) return <p className="empty">Este mes no hubo compras de mercadería, retiros ni ingresos de plata.</p>

  async function remove(move) {
    const what = move.kind === 'purchase' ? `la compra de ${move.qty} × ${move.products.name}? El stock se descuenta` : `este ${MOVE_LABELS[move.kind].toLowerCase()}?`
    // Removing is the one place we ask first (like sales on Tienda).
    if (!window.confirm(`¿Quitar ${what}`)) return
    try {
      await removeMove(move)
      showToast('Quitado')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>Movimientos</h2>
      <ul className="payment-lines">
        {moves.map((m) => (
          <li key={m.id}>
            <span>
              {formatDate(m.moved_on).slice(0, 5)} ·{' '}
              {m.kind === 'purchase' ? `${m.qty} × ${m.products.name}` : MOVE_LABELS[m.kind]}
              {m.note && <span className="muted"> ({m.note})</span>} ·{' '}
              <strong>{m.kind === 'deposit' ? '' : '− '}{formatMoney(m.amount)}</strong>
            </span>
            <button className="btn-text" onClick={() => remove(m)}>Quitar</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
