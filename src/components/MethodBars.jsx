import { formatMoney } from '../lib/format.js'
import { METHODS } from '../lib/payments.js'

// How the money came in: one bar per payment method (the longest is the
// one that brought the most), with its share and amount written above.
// `totals` = [['cash', 50000], ...] from sumByMethod / totalsByMethod.
export default function MethodBars({ totals, label }) {
  const total = totals.reduce((sum, [, amount]) => sum + amount, 0)
  if (total === 0) return null
  const percent = (amount) => Math.round((amount / total) * 100)

  return (
    <ul className="method-bars" aria-label={label}>
      {totals.map(([method, amount]) => (
        <li key={method}>
          <div className="method-bars-label">
            <span>{METHODS[method]}</span>
            <strong>{percent(amount)}%</strong>
            <span className="muted">{formatMoney(amount)}</span>
          </div>
          <div className="method-bars-track" aria-hidden="true">
            <div style={{ width: `${(amount / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
