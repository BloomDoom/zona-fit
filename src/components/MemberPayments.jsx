import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentMonthISO, formatDate, formatMoney, formatMonth, parseAmount } from '../lib/format.js'
import { METHODS, STATUS_LABELS, activePayments, ensureCharges, withStatus } from '../lib/payments.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'
import PayPanel from './PayPanel.jsx'

async function loadCharges(memberId) {
  await ensureCharges(currentMonthISO()) // so this month's fee shows even if Pagos wasn't opened yet
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, members(id, name, start_date), plans(id, name), payments(*)')
      .eq('member_id', memberId)
      .is('deleted_at', null)
      .order('month', { ascending: false }),
  )
  return charges.map(withStatus)
}

// A member's payment history: one card per monthly fee, newest first.
export default function MemberPayments({ memberId }) {
  const result = useLoad(() => loadCharges(memberId), [memberId])
  const [paying, setPaying] = useState(null) // charge id with the pay panel open
  const [editing, setEditing] = useState(null) // charge id being edited
  const charges = result.data
  const owed = charges?.reduce((sum, c) => sum + c.balance, 0) ?? 0

  return (
    <section className="section">
      <h2>Cuotas</h2>
      <LoadState {...result} />
      {charges && (
        <>
          {charges.length === 0 ? (
            <p className="empty">Todavía no hay cuotas. Aparecen cuando la chica tiene un plan con precio.</p>
          ) : (
            <p className={owed > 0 ? 'error' : 'success'}>{owed > 0 ? `Debe ${formatMoney(owed)} en total` : 'No debe nada ✓'}</p>
          )}
          <ul className="card-list">
            {charges.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                <div className="charge-top">
                  <span className="charge-name">
                    <span className="card-title">{formatMonth(c.month)}</span>
                    <span className="muted">{c.plans.name}</span>
                  </span>
                  <span className="charge-right">
                    <span className={`chip chip-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                    <span>{formatMoney(c.amount)}</span>
                  </span>
                </div>
                {c.note && <p className="muted charge-note">Nota: {c.note}</p>}
                <PaymentLines charge={c} reload={result.reload} />

                {editing === c.id ? (
                  <EditCharge
                    charge={c}
                    onDone={() => {
                      setEditing(null)
                      result.reload()
                    }}
                  />
                ) : paying === c.id ? (
                  <PayPanel
                    charge={c}
                    onCancel={() => setPaying(null)}
                    onSaved={() => {
                      setPaying(null)
                      result.reload()
                    }}
                  />
                ) : (
                  <div className="btn-row">
                    {c.status !== 'paid' && <button className="btn-primary" onClick={() => setPaying(c.id)}>Cobrar</button>}
                    <button className="btn-secondary" onClick={() => setEditing(c.id)}>Cambiar cuota</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// The payments of one fee, each with a Quitar button.
function PaymentLines({ charge, reload }) {
  const showToast = useToast()
  const payments = activePayments(charge).sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  if (payments.length === 0) return null

  async function remove(payment) {
    // Deleting is the one place we ask first (see the UX rules).
    if (!window.confirm(`¿Quitar el pago de ${formatMoney(payment.amount)} del ${formatDate(payment.paid_on)}?`)) return
    try {
      // Never really deleted: marked as removed, so it can be recovered.
      await unwrap(supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', payment.id))
      showToast('Pago quitado')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <ul className="payment-lines">
      {payments.map((p) => (
        <li key={p.id}>
          <span>
            Pagó {formatMoney(p.amount)} · {METHODS[p.method]} · {formatDate(p.paid_on)}
          </span>
          <button className="btn-text" onClick={() => remove(p)}>Quitar</button>
        </li>
      ))}
    </ul>
  )
}

// Change one month's fee (discount, joined mid-month…) with a note.
function EditCharge({ charge, onDone }) {
  const [amount, setAmount] = useState(String(charge.amount))
  const [note, setNote] = useState(charge.note || '')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const value = parseAmount(amount)
    if (value === null) return setError('Escribí la cuota, por ejemplo 20000. Poné 0 si este mes no paga.')
    try {
      // amount_edited = true: price changes won't overwrite it anymore.
      await unwrap(
        supabase.from('charges').update({ amount: value, note: note.trim() || null, amount_edited: true }).eq('id', charge.id),
      )
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        Cuota de {formatMonth(charge.month)}
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </label>
      <label>
        ¿Por qué? <span className="optional">(opcional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. Descuento por pareja" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn-primary">Guardar cuota</button>
      </div>
    </form>
  )
}
