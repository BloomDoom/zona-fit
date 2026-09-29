import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addMonths, currentMonthISO, formatMoney, formatMonth } from '../lib/format.js'
import { METHODS, STATUS_LABELS, ensureCharges, loadSettings, sortByStatus, totalsByMethod, withStatus } from '../lib/payments.js'
import LoadState from '../components/LoadState.jsx'
import PayPanel from '../components/PayPanel.jsx'

async function loadMonth(month) {
  const settings = await loadSettings()
  const skipped = settings.skip_months.includes(Number(month.slice(5, 7)))
  await ensureCharges(month) // creates the month's charges the first time
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, members(id, name), plans(id, name), payments(*)')
      .eq('month', month)
      .is('deleted_at', null),
  )
  return { skipped, charges: sortByStatus(charges.map((c) => withStatus(c, settings.due_day))) }
}

export default function Payments() {
  // Month in the URL (/payments?month=2026-09-01), like the day on Inicio.
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  const month = params.get('month') || thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  // Next month is allowed, for people who pay in advance.
  const canGoForward = month < addMonths(thisMonth, 1)

  const result = useLoad(() => loadMonth(month), [month])
  const [openId, setOpenId] = useState(null) // the charge whose "Cobrar" panel is open

  const charges = result.data?.charges
  const expected = charges?.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const collected = charges?.reduce((sum, c) => sum + Math.min(c.paid, c.amount), 0) ?? 0
  const owing = charges?.filter((c) => c.status !== 'paid').length ?? 0
  const byMethod = charges ? totalsByMethod(charges) : []

  return (
    <main className="screen">
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(addMonths(month, -1))} aria-label="Mes anterior">‹</button>
        <div>
          <h1>Pagos</h1>
          <p className="muted">{formatMonth(month)}</p>
        </div>
        <button
          className="btn-icon"
          onClick={() => goTo(addMonths(month, 1))}
          aria-label="Mes siguiente"
          disabled={!canGoForward}
        >›</button>
      </header>
      {month !== thisMonth && (
        <button className="btn-secondary" onClick={() => goTo(thisMonth)}>Volver a este mes</button>
      )}

      <LoadState {...result} />

      {result.data?.skipped && (
        <p className="empty">En {formatMonth(month)} no hay cuota. Lo podés cambiar en Ajustes.</p>
      )}

      {charges && !result.data.skipped && (
        <>
          {charges.length === 0 ? (
            <p className="empty">
              Todavía no hay cuotas este mes. Aparecen para las chicas que tienen un plan con precio.
            </p>
          ) : (
            <section className="summary">
              <p className="big-number">
                {formatMoney(collected)} <span className="muted">de {formatMoney(expected)}</span>
              </p>
              <div className="progress" aria-hidden="true">
                <div style={{ width: `${expected ? (collected / expected) * 100 : 0}%` }} />
              </div>
              <p>{owing === 0 ? '¡Pagaron todas! 🎉' : owing === 1 ? 'Falta que pague 1 chica' : `Faltan que paguen ${owing} chicas`}</p>
              {byMethod.length > 0 && (
                <ul className="method-totals" aria-label="Cobrado por forma de pago">
                  {byMethod.map(([method, total]) => (
                    <li key={method}>
                      <span>{METHODS[method]}</span>
                      <strong>{formatMoney(total)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <ul className="card-list">
            {charges.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                <div className="charge-top">
                  <Link to={`/members/${c.members.id}`} className="charge-name">
                    <span className="card-title">{c.members.name} ›</span>
                    <span className="muted">{c.plans.name}</span>
                  </Link>
                  <span className="charge-right">
                    <span className={`chip chip-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                    <span>{c.status === 'paid' ? formatMoney(c.amount) : `Debe ${formatMoney(c.balance)}`}</span>
                  </span>
                </div>

                {c.status !== 'paid' &&
                  (openId === c.id ? (
                    <PayPanel
                      charge={c}
                      onCancel={() => setOpenId(null)}
                      onSaved={() => {
                        setOpenId(null)
                        result.reload()
                      }}
                    />
                  ) : (
                    <button className="btn-primary" onClick={() => setOpenId(c.id)}>Cobrar</button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
