import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addMonths, currentMonthISO, formatMoney, formatMonth, parseAmount, plural } from '../lib/format.js'
import { priceForMonth } from '../lib/groups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

// Plans = what members pay each month ("3 veces por semana", "Libre").
// Each plan has a price history, like the school's group prices: a new
// price starts from a month she picks, and earlier months keep theirs.
async function loadPlans() {
  const [plans, members] = await Promise.all([
    unwrap(supabase.from('plans').select('*, plan_prices(*)').order('name')),
    unwrap(supabase.from('members').select('plan_id').eq('active', true)),
  ])
  return plans.map((p) => ({ ...p, memberCount: members.filter((m) => m.plan_id === p.id).length }))
}

// Runs a save, shows the error or a toast, then reloads. Returns true if it worked.
async function save(action, { reload, showToast, message, onUndo, setError }) {
  try {
    await action()
    reload()
    if (message) showToast(message, onUndo)
    return true
  } catch (err) {
    setError(saveErrorMessage(err))
    return false
  }
}

export default function Plans() {
  const result = useLoad(loadPlans, [])
  const plans = result.data
  const active = plans?.filter((p) => p.active) ?? []
  const inactive = plans?.filter((p) => !p.active) ?? []

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Clases</Link>
      <h1>Planes y precios</h1>
      <p className="muted">Lo que paga cada chica por mes. Cuando sube un precio, cambialo acá.</p>
      <LoadState {...result} />

      {plans && (
        <>
          {active.length === 0 && (
            <p className="empty">Todavía no hay planes. Creá el primero abajo, por ejemplo “3 veces por semana”.</p>
          )}
          <ul className="card-list">
            {active.map((plan) => (
              <li key={plan.id}>
                <PlanCard plan={plan} reload={result.reload} />
              </li>
            ))}
          </ul>

          <NewPlan reload={result.reload} />

          {inactive.length > 0 && (
            <details className="section">
              <summary>Planes que ya no se ofrecen ({inactive.length})</summary>
              <ul className="card-list">
                {inactive.map((plan) => (
                  <li key={plan.id}>
                    <PlanCard plan={plan} reload={result.reload} />
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

function PlanCard({ plan, reload }) {
  const showToast = useToast()
  const thisMonth = currentMonthISO()
  const [changing, setChanging] = useState(null) // null, 'price' or 'name'
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(thisMonth)
  const [name, setName] = useState(plan.name)
  const [error, setError] = useState('')

  const current = priceForMonth(plan.plan_prices, thisMonth)
  const upcoming = plan.plan_prices
    .filter((p) => p.effective_month > thisMonth)
    .sort((a, b) => a.effective_month.localeCompare(b.effective_month))
  const history = [...plan.plan_prices].sort((a, b) => b.effective_month.localeCompare(a.effective_month))
  // She can pick from 2 months back to 3 months ahead.
  const monthChoices = [-2, -1, 0, 1, 2, 3].map((n) => addMonths(thisMonth, n))
  const opts = { reload, showToast, setError }

  async function savePrice(e) {
    e.preventDefault()
    setError('')
    const value = parseAmount(amount)
    if (value === null) return setError('Escribí el precio nuevo, por ejemplo 28000.')
    // "upsert" = insert, or update if this plan already has a price
    // starting that same month. Earlier months are never touched.
    const ok = await save(
      () =>
        unwrap(
          supabase
            .from('plan_prices')
            .upsert({ plan_id: plan.id, amount: value, effective_month: month }, { onConflict: 'plan_id,effective_month' }),
        ),
      { ...opts, message: `Precio nuevo desde ${formatMonth(month)}` },
    )
    if (ok) {
      setChanging(null)
      setAmount('')
      setMonth(thisMonth)
    }
  }

  async function saveName(e) {
    e.preventDefault()
    setError('')
    const ok = await save(() => unwrap(supabase.from('plans').update({ name: name.trim() }).eq('id', plan.id)), {
      ...opts,
      message: 'Nombre guardado',
    })
    if (ok) setChanging(null)
  }

  function toggleActive() {
    setError('')
    const setActive = (active) => unwrap(supabase.from('plans').update({ active }).eq('id', plan.id))
    save(() => setActive(!plan.active), {
      ...opts,
      message: plan.active ? `${plan.name} dado de baja` : `${plan.name} vuelve a estar`,
      onUndo: () => save(() => setActive(plan.active), opts),
    })
  }

  return (
    <div className={`card plan-card ${plan.active ? '' : 'dimmed'}`}>
      <span className="card-title">{plan.name}</span>
      {current ? (
        <p className="big-number">
          {formatMoney(current.amount)}
          <span className="muted"> por mes, desde {formatMonth(current.effective_month)}</span>
        </p>
      ) : (
        <p className="error">Sin precio todavía: sus chicas no generan cuota.</p>
      )}
      {upcoming.map((p) => (
        <p key={p.id}>Desde {formatMonth(p.effective_month)}: <strong>{formatMoney(p.amount)}</strong></p>
      ))}
      <p className="muted">{plural(plan.memberCount, 'chica activa', 'chicas activas')}</p>
      {plan.active && (
        <TimesPerWeekField
          value={plan.times_per_week}
          onChange={(n) =>
            save(() => unwrap(supabase.from('plans').update({ times_per_week: n }).eq('id', plan.id)), {
              ...opts,
              message: n ? `${plan.name}: ${n} por semana` : 'Guardado',
            })
          }
        />
      )}

      {changing === 'price' && (
        <form onSubmit={savePrice} className="slot-box">
          <label>
            Precio nuevo
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ej. 28000" autoFocus />
          </label>
          <label>
            ¿Desde qué mes?
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthChoices.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </label>
          <p className="muted">Los meses anteriores quedan con el precio viejo.</p>
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setChanging(null)}>Cancelar</button>
            <button className="btn-primary">Guardar precio</button>
          </div>
        </form>
      )}

      {changing === 'name' && (
        <form onSubmit={saveName} className="slot-box">
          <label>
            Nombre del plan
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setChanging(null)}>Cancelar</button>
            <button className="btn-primary">Guardar nombre</button>
          </div>
        </form>
      )}

      {changing === null && (
        <div className="stack">
          {plan.active && <button className="btn-primary" onClick={() => setChanging('price')}>Cambiar precio</button>}
          <details>
            <summary>Más opciones</summary>
            <div className="stack">
              {history.length > 0 && (
                <ul className="row-list">
                  {history.map((p) => (
                    <li key={p.id}>
                      <span>Desde {formatMonth(p.effective_month)}</span>
                      <strong>{formatMoney(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn-secondary" onClick={() => setChanging('name')}>Cambiar nombre</button>
              <button className="btn-secondary" onClick={toggleActive}>
                {plan.active ? 'Dar de baja este plan' : 'Volver a ofrecer este plan'}
              </button>
              {plan.active && (
                <p className="muted">Un plan dado de baja deja de generar cuotas desde el mes que viene. El historial se guarda.</p>
              )}
            </div>
          </details>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

// How many classes a week the plan includes. Used to warn when a
// member's chosen times don't match her plan (it never blocks saving).
function TimesPerWeekField({ value, onChange }) {
  return (
    <label className={value ? '' : 'needs-value'}>
      Clases por semana <span className="optional">(para avisar si sus horarios no coinciden)</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Sin definir</option>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  )
}

function NewPlan({ reload }) {
  const showToast = useToast()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [timesPerWeek, setTimesPerWeek] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const amount = parseAmount(price)
    if (amount === null) return setError('Escribí el precio por mes, por ejemplo 25000.')
    setBusy(true)
    try {
      const plan = await unwrap(
        supabase.from('plans').insert({ name: name.trim(), times_per_week: timesPerWeek }).select().single(),
      )
      await unwrap(supabase.from('plan_prices').insert({ plan_id: plan.id, amount, effective_month: currentMonthISO() }))
      showToast(`${plan.name} creado`)
      setName('')
      setPrice('')
      setTimesPerWeek(null)
      reload()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="section slot-box">
      <h2>Nuevo plan</h2>
      <label>
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. 3 veces por semana" required />
      </label>
      <label>
        Precio por mes
        <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ej. 25000" required />
      </label>
      <TimesPerWeekField value={timesPerWeek} onChange={setTimesPerWeek} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Crear plan'}</button>
    </form>
  )
}
