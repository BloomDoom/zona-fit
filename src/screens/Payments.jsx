import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addMonths, currentMonthISO, formatDate, formatMoney, formatMonth } from '../lib/format.js'
import { STATUS_LABELS, ensureCharges, loadSettings, sortByStatus, totalsByMethod, withStatus } from '../lib/payments.js'
import LoadState from '../components/LoadState.jsx'
import PayPanel from '../components/PayPanel.jsx'
import MethodBars from '../components/MethodBars.jsx'
import { normalize } from '../lib/groups.js'

async function loadMonth(month) {
  const settings = await loadSettings()
  const skipped = settings.skip_months.includes(Number(month.slice(5, 7)))
  await ensureCharges(month) // creates the month's charges the first time
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, members(id, name, start_date, deleted_at), plans(id, name), payments(*)')
      .eq('month', month)
      .is('deleted_at', null),
  )
  // A deleted chica ("Borrar") isn't listed and owes nothing; what she
  // already paid still counts in the total.
  const kept = charges.map(withStatus).filter((c) => !c.members.deleted_at || c.paid > 0)
  return { skipped, charges: sortByStatus(kept) }
}

export default function Payments() {
  // Month in the URL (/payments?month=2026-09-01), like the day on Inicio.
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  // No future months: nobody pays ahead, and seeing them was confusing.
  const asked = params.get('month')
  const month = asked && asked < thisMonth ? asked : thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  const canGoForward = month < thisMonth

  const result = useLoad(() => loadMonth(month), [month])
  const [openId, setOpenId] = useState(null) // the charge whose "Cobrar" panel is open
  const [search, setSearch] = useState('')

  const charges = result.data?.charges
  const expected = charges?.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const collected = charges?.reduce((sum, c) => sum + Math.min(c.paid, c.amount), 0) ?? 0
  const listed = charges?.filter((c) => !c.members.deleted_at)
  const owing = listed?.filter((c) => c.status !== 'paid').length ?? 0
  const byMethod = charges ? totalsByMethod(charges) : []
  const shown = search ? listed?.filter((c) => normalize(c.members.name).includes(normalize(search))) : listed

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
              {/* Right under the total, so she doesn't have to scroll to find a chica */}
              <input
                type="search"
                className="payments-search"
                placeholder="Buscar chica por nombre"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar chica por nombre"
              />
              {byMethod.length > 0 && <MethodBars totals={byMethod} label="Cobrado por forma de pago" />}
            </section>
          )}

          {search && shown.length === 0 && <p className="empty">Nadie con “{search.trim()}” tiene cuota este mes.</p>}

          <ul className="card-list">
            {shown.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                <div className="charge-top">
                  <Link to={`/members/${c.members.id}`} className="charge-name">
                    <span className="card-title">{c.members.name} ›</span>
                    <span className="muted">
                      {c.plans.name}
                      {c.status !== 'paid' && ` · vence el ${formatDate(c.due).slice(0, 5)}`}
                    </span>
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
