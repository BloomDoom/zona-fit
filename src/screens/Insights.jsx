import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addDays, addMonths, currentMonthISO, formatMoney, formatMonth, plural, todayISO } from '../lib/format.js'
import { formatRate, loadAttendance } from '../lib/attendance.js'
import { loadSales, saleTotal } from '../lib/shop.js'
import LoadState from '../components/LoadState.jsx'
import BackButton from '../components/BackButton.jsx'

// Last day of a month: the day before the 1st of the next month.
const monthEnd = (month) => addDays(addMonths(month, 1), -1)

// Money that came in during the month: fee payments (by the day they were
// paid, whatever month the fee was for) and shop sales.
async function loadIncome(from, to) {
  const [payments, sales] = await Promise.all([
    unwrap(supabase.from('payments').select('amount').gte('paid_on', from).lte('paid_on', to).is('deleted_at', null)),
    loadSales(from, to),
  ])
  const fees = payments.reduce((sum, p) => sum + p.amount, 0)
  const shop = sales.reduce((sum, s) => sum + saleTotal(s), 0)
  return { fees, shop, total: fees + shop }
}

async function loadMonth(month, to) {
  const [attendance, income] = await Promise.all([loadAttendance(month, to), loadIncome(month, to)])
  return { attendance, income }
}

export default function Insights() {
  // Month in the URL, like on Pagos.
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  const month = params.get('month') || thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  const to = month === thisMonth ? todayISO() : monthEnd(month)

  const result = useLoad(() => loadMonth(month, to), [month])
  const data = result.data?.attendance
  const income = result.data?.income

  return (
    <main className="screen">
      <BackButton fallback="/members" />
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(addMonths(month, -1))} aria-label="Mes anterior">‹</button>
        <div>
          <h1>Resumen</h1>
          <p className="muted">{formatMonth(month)}</p>
        </div>
        <button className="btn-icon" onClick={() => goTo(addMonths(month, 1))} aria-label="Mes siguiente" disabled={month >= thisMonth}>›</button>
      </header>

      <LoadState {...result} />

      {income && (
        <section className="summary">
          <p className="big-number">
            {formatMoney(income.total)} <span className="muted">entraron</span>
          </p>
          <ul className="method-totals" aria-label="Ingresos del mes">
            <li>
              <span>Cuotas</span>
              <strong>{formatMoney(income.fees)}</strong>
            </li>
            <li>
              <span>Tienda</span>
              <strong>{formatMoney(income.shop)}</strong>
            </li>
          </ul>
        </section>
      )}

      {data && (
        <>
          <h2>Asistencia</h2>
          {data.overall.expected === 0 ? (
            <p className="empty">Todavía no hay asistencia guardada en {formatMonth(month)}. Los números aparecen cuando guardás la asistencia de las clases.</p>
          ) : (
            <>
              <section className="summary">
                <p className="big-number">
                  {formatRate(data.overall.rate)} <span className="muted">vino a clase</span>
                </p>
                <p className="muted">Solo cuentan las clases donde guardaste la asistencia.</p>
              </section>

              <section className="section">
                <h2>Por clase</h2>
                <ul className="card-list">
                  {data.groups.map((g) => (
                    <li key={g.group.id}>
                      <Link to={`/groups/${g.group.id}`} className="card">
                        <span className="card-title">{g.group.name}</span>
                        <span>
                          <strong>{formatRate(g.rate)}</strong> · {plural(g.classes, 'clase', 'clases')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="section">
                <h2>Por chica</h2>
                <p className="muted">Las que más faltaron, primero.</p>
                <ul className="card-list">
                  {data.members
                    .filter((m) => m.member.active)
                    .map((m) => (
                      <li key={m.member.id}>
                        <Link to={`/members/${m.member.id}`} className={`card attendance-row ${m.absences > 0 ? 'has-absences' : ''}`}>
                          <span className="card-title">{m.member.name}</span>
                          <span>
                            {m.absences === 0
                              ? `Vino a ${m.classes === 1 ? 'la única clase' : `las ${m.classes} clases`} ✓`
                              : `Faltó a ${m.absences} de ${plural(m.classes, 'clase', 'clases')} · ${formatRate(m.rate)}`}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}
