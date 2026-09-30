import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap } from '../lib/useLoad.js'
import { parseCsv } from '../lib/csv.js'
import { currentMonthISO, formatMoney, parseAmount, parseDate, todayISO } from '../lib/format.js'
import { normalize, planName, timesFromName } from '../lib/groups.js'
import { loadErrorMessage, saveErrorMessage } from '../lib/errors.js'

// Bulk import of plans, classes and members from CSV files, for loading
// Nadia's lists once. Flow: pick a file → check every row → preview →
// import only the rows without problems.

const KINDS = {
  plans: { label: 'Planes', plural: 'planes', see: 'Verlos' },
  groups: { label: 'Clases', plural: 'clases', see: 'Verlas' },
  members: { label: 'Chicas', plural: 'chicas', see: 'Verlas' },
}

const EXAMPLES = {
  plans: `nombre,precio
2 veces por semana,22000
3 veces por semana,28000
Libre,35000`,
  groups: `nombre,horarios,notas
Funcional,Lun 19:00 60 / Mie 19:00 60,
Spinning,Mar 8:00 45 / Jue 8:00 45,Traer toalla`,
  members: `nombre,telefono,plan,clase,nacimiento,empezo,emergencia_nombre,emergencia_telefono,notas
Sofía Pérez,11 5555-1234,3 veces por semana,Funcional,12/03/1995,01/03/2026,Laura (mamá),11 5555-9876,
Martín Gómez,11 4444-9876,Libre,,04/07/1990,15/03/2026,,,Lesión de rodilla`,
}

// First three letters of the day, in Spanish or English (no accents).
const DAYS = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 7, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }

// "Lun 19:00 60 / Mie 19:00" → [{ weekday: 1, start_time: '19:00', duration_min: 60 }, …]
// The length in minutes is optional (60 if missing). Throws if unreadable.
function parseSchedule(text) {
  return text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = normalize(part).match(/^([a-z]+)\s+(\d{1,2})[:.](\d{2})(?:\s+(\d+))?/)
      const weekday = match && DAYS[match[1].slice(0, 3)]
      if (!weekday || Number(match[2]) > 23 || Number(match[3]) > 59) {
        throw new Error(`no se entiende el horario "${part}" (escribilo como "Lun 19:00 60")`)
      }
      return {
        weekday,
        start_time: `${match[2].padStart(2, '0')}:${match[3]}`,
        duration_min: match[4] ? Number(match[4]) : 60,
      }
    })
}

// Each checked row: { line, title, detail, problem, skip, data }
// `seenNames` = names already in the database (normalized), to skip repeats.
function checkRows(rows, seenNames, check) {
  const seen = new Set(seenNames.map(normalize))
  return rows.map((row, i) => {
    const item = { line: i + 2, title: row.nombre || '(sin nombre)' } // +2: the header is line 1
    try {
      if (!row.nombre) throw new Error('falta el nombre')
      Object.assign(item, check(row))
      if (seen.has(normalize(row.nombre))) item.skip = 'ya existe'
      seen.add(normalize(row.nombre))
    } catch (err) {
      item.problem = err.message
    }
    return item
  })
}

async function checkPlans(rows) {
  const existing = await unwrap(supabase.from('plans').select('name'))
  return checkRows(rows, existing.map((p) => p.name), (row) => {
    const price = parseAmount(row.precio || '')
    if (price === null) throw new Error(`no se entiende el precio "${row.precio || ''}"`)
    return { detail: formatMoney(price), data: { name: row.nombre, price } }
  })
}

async function checkGroups(rows) {
  const existing = await unwrap(supabase.from('groups').select('name'))
  return checkRows(rows, existing.map((g) => g.name), (row) => ({
    detail: row.horarios || 'sin horarios',
    data: { name: row.nombre, notes: row.notas || null, slots: parseSchedule(row.horarios || '') },
  }))
}

async function checkMembers(rows) {
  const [plans, groups, existing] = await Promise.all([
    unwrap(supabase.from('plans').select('id, name, times_per_week').eq('active', true)),
    unwrap(supabase.from('groups').select('id, name')),
    unwrap(supabase.from('members').select('name')),
  ])
  const planIds = new Map(plans.map((p) => [normalize(p.name), p.id]))
  const planByTimes = new Map(plans.filter((p) => p.times_per_week).map((p) => [p.times_per_week, p.id]))
  const groupIds = new Map(groups.map((g) => [normalize(g.name), g.id]))

  return checkRows(rows, existing.map((m) => m.name), (row) => {
    // "3", "3 veces x semana" or the exact name all find the 3-a-week plan
    const planId = row.plan ? planIds.get(normalize(row.plan)) ?? planByTimes.get(timesFromName(row.plan)) : null
    if (row.plan && !planId) throw new Error(`no hay un plan de "${row.plan}" (creá los planes primero)`)
    const groupId = row.clase ? groupIds.get(normalize(row.clase)) : null
    if (row.clase && !groupId) throw new Error(`no hay una clase que se llame "${row.clase}" (importá las clases primero)`)
    const startDate = row.empezo ? parseDate(row.empezo) : todayISO()
    if (!startDate) throw new Error(`no se entiende la fecha "${row.empezo}" (escribila como 01/03/2026)`)
    const birthDate = row.nacimiento ? parseDate(row.nacimiento) : null
    if (row.nacimiento && !birthDate) throw new Error(`no se entiende la fecha de nacimiento "${row.nacimiento}" (escribila como 12/03/1995)`)
    return {
      detail: [row.plan || 'Sin plan', row.clase, !row.telefono && 'sin teléfono'].filter(Boolean).join(' · '),
      data: {
        groupId,
        member: {
          name: row.nombre,
          phone: row.telefono || null,
          plan_id: planId,
          birth_date: birthDate,
          start_date: startDate,
          emergency_name: row.emergencia_nombre || null,
          emergency_phone: row.emergencia_telefono || null,
          notes: row.notas || null,
        },
      },
    }
  })
}

const CHECK = { plans: checkPlans, groups: checkGroups, members: checkMembers }

const IMPORT = {
  async plans({ name, price }) {
    // A plan is its "veces por semana": "3 veces x semana" is saved as 3,
    // named "3 veces por semana".
    const times = timesFromName(name)
    const plan = await unwrap(
      supabase.from('plans').insert({ name: times ? planName(times) : name, times_per_week: times }).select().single(),
    )
    await unwrap(supabase.from('plan_prices').insert({ plan_id: plan.id, amount: price, effective_month: currentMonthISO() }))
  },
  async groups({ name, notes, slots }) {
    const group = await unwrap(supabase.from('groups').insert({ name, notes }).select().single())
    if (slots.length > 0) {
      await unwrap(supabase.from('group_slots').insert(slots.map((s) => ({ ...s, group_id: group.id }))))
    }
  },
  async members({ member, groupId }) {
    const saved = await unwrap(supabase.from('members').insert(member).select().single())
    if (groupId) {
      await unwrap(supabase.from('enrollments').insert({ member_id: saved.id, group_id: groupId, start_date: member.start_date }))
    }
  },
}

export default function Import() {
  const [kind, setKind] = useState('plans')
  const [items, setItems] = useState(null)
  const [progress, setProgress] = useState(null) // { done, total }
  const [finished, setFinished] = useState(null) // number imported
  const [error, setError] = useState('')

  const ready = items?.filter((it) => !it.problem && !it.skip) ?? []
  const problems = items?.filter((it) => it.problem) ?? []
  const skipped = items?.filter((it) => it.skip) ?? []
  const words = KINDS[kind].plural

  function choose(newKind) {
    setKind(newKind)
    setItems(null)
    setFinished(null)
    setError('')
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // lets you pick the same file again after fixing it
    if (!file) return
    setError('')
    setFinished(null)
    try {
      const rows = parseCsv(await file.text())
      if (rows.length === 0) return setError('El archivo no tiene filas. Fijate que tenga una fila de títulos y datos.')
      setItems(await CHECK[kind](rows))
    } catch (err) {
      setError(loadErrorMessage(err))
    }
  }

  async function runImport() {
    setError('')
    setProgress({ done: 0, total: ready.length })
    let done = 0
    try {
      // One at a time, so if the internet drops we know exactly what got in.
      for (const item of ready) {
        await IMPORT[kind](item.data)
        done++
        setProgress({ done, total: ready.length })
      }
      setFinished(done)
      setItems(null)
    } catch (err) {
      setError(`${saveErrorMessage(err)} Se importaron ${done} de ${ready.length}. Elegí el archivo de nuevo para cargar el resto; los que ya están se saltean.`)
      setItems(null)
    }
    setProgress(null)
  }

  const seeLink = { plans: '/plans', groups: '/groups', members: '/members' }[kind]

  return (
    <main className="screen">
      <Link to="/settings" className="back-link">‹ Ajustes</Link>
      <h1>Importar desde una planilla</h1>
      <p>
        Guardá la planilla como archivo CSV (Google Sheets: Archivo → Descargar → CSV. Excel: Guardar como → CSV).
        Importá en este orden: primero planes, después clases, después chicas.
      </p>

      <div className="btn-row">
        {Object.entries(KINDS).map(([key, { label }]) => (
          <button key={key} className={kind === key ? 'btn-primary' : 'btn-secondary'} onClick={() => choose(key)}>{label}</button>
        ))}
      </div>

      <section className="section">
        <h2>El archivo tiene que verse así</h2>
        <pre className="example">{EXAMPLES[kind]}</pre>
        {kind === 'plans' && <p className="muted">El precio empieza a correr este mes.</p>}
        {kind === 'groups' && <p className="muted">Horarios: día, hora y minutos; si son varios, separalos con “/”.</p>}
        {kind === 'members' && (
          <>
            <p className="muted">Plan y clase tienen que coincidir con un nombre que ya exista. Fechas como DD/MM/AAAA. Las columnas vacías están bien.</p>
            <p className="muted">Las que tengan clase quedan con “Falta elegir horarios”: después le elegís a cada una sus días y turnos.</p>
          </>
        )}
        <label className="btn-secondary file-button">
          Elegir archivo CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {finished !== null && (
        <p className="success" role="status">
          ¡Listo! Se importaron {finished} {words}. <Link to={seeLink}>{KINDS[kind].see}</Link>
        </p>
      )}

      {items && (
        <section className="section">
          <h2>Revisá antes de importar</h2>
          <p>
            <strong>{ready.length} listos</strong>
            {problems.length > 0 && <> · <span className="error">{problems.length} con problemas</span></>}
            {skipped.length > 0 && <> · {skipped.length} ya existen (se saltean)</>}
          </p>
          <ul className="row-list import-list">
            {[...problems, ...ready, ...skipped].map((it) => (
              <li key={it.line} className={it.problem ? 'has-problem' : ''}>
                <span>
                  <strong>{it.problem ? '✗' : it.skip ? '–' : '✓'} {it.title}</strong>
                  <br />
                  <span className="muted">
                    Fila {it.line}: {it.problem || it.skip || it.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {problems.length > 0 && <p className="muted">Las filas con problemas no se importan. Corregilas en el archivo y elegilo de nuevo.</p>}
          {ready.length > 0 && (
            <button className="btn-primary" onClick={runImport} disabled={progress !== null}>
              {progress ? `Importando ${progress.done} de ${progress.total}…` : `Importar ${ready.length} ${words}`}
            </button>
          )}
        </section>
      )}
    </main>
  )
}
