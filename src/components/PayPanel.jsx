import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { unwrap } from '../lib/useLoad.js'
import { formatMoney, parseAmount, todayISO } from '../lib/format.js'
import { METHODS } from '../lib/payments.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'

// Recording a payment: the amount is already filled in with what's owed
// and the date is today, so she only taps how they paid. Changing the
// amount makes it a partial payment.
// `charge` needs id, balance and members.name.
export default function PayPanel({ charge, onSaved, onCancel }) {
  const showToast = useToast()
  const [amount, setAmount] = useState(String(charge.balance))
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pay(method) {
    setError('')
    const value = parseAmount(amount)
    if (!value) return setError('Escribí cuánto pagó.')
    if (value > charge.balance) return setError(`Es más de lo que debe (${formatMoney(charge.balance)}).`)

    setBusy(true)
    try {
      const payment = await unwrap(
        supabase.from('payments').insert({ charge_id: charge.id, amount: value, paid_on: date, method }).select().single(),
      )
      onSaved()
      showToast(`${formatMoney(value)} de ${charge.members.name} guardado`, async () => {
        // Undo: payments are never deleted, only marked as removed.
        try {
          await unwrap(supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', payment.id))
          onSaved()
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
      <div className="slot-fields two-equal">
        <label>
          Monto
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <p className="pay-question">¿Cómo pagó?</p>
      <div className="method-buttons">
        {Object.entries(METHODS).map(([key, label]) => (
          <button key={key} className="btn-primary" onClick={() => pay(key)} disabled={busy}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-text btn-cancel" onClick={onCancel}>Cancelar</button>
    </div>
  )
}
