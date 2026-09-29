import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { MONTH_NAMES, capitalize } from '../lib/format.js'
import { loadSettings } from '../lib/payments.js'
import { loadErrorMessage, saveErrorMessage } from '../lib/errors.js'
import { buildBackupFiles, saveFiles } from '../lib/backup.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

export default function Settings() {
  const result = useLoad(loadSettings, [])

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Clases</Link>
      <h1>Ajustes</h1>
      <LoadState {...result} />
      {result.data && (
        <>
          <PaymentSettings settings={result.data} reload={result.reload} />
          <BirthdayMessage settings={result.data} reload={result.reload} />
        </>
      )}

      <Backup />

      <section className="section">
        <h2>Cargar datos</h2>
        <ul className="card-list">
          <li>
            <Link to="/settings/import" className="card">
              <span className="card-title">Importar desde una planilla</span>
              <span className="muted">Cargar muchos planes, clases o chicas de una vez con un archivo CSV</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="section">
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}

// The text of the birthday button on Inicio.
function BirthdayMessage({ settings, reload }) {
  const showToast = useToast()
  const [text, setText] = useState(settings.birthday_message)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    if (!text.trim()) return setError('Primero escribí un mensaje.')
    try {
      await unwrap(supabase.from('settings').update({ birthday_message: text.trim() }).eq('id', 1))
      reload()
      showToast('Saludo guardado')
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>Saludo de cumpleaños</h2>
      <form onSubmit={save}>
        <label>
          Mensaje
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="muted">{'{name}'} se reemplaza por el nombre de la chica. Igual podés cambiar el texto en WhatsApp antes de mandarlo.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-secondary" disabled={text.trim() === settings.birthday_message}>Guardar saludo</button>
      </form>
    </section>
  )
}

// Two steps because of an iPhone rule: the Share sheet only opens right
// after a tap, and reading all the data takes a few seconds. So: tap 1
// reads the data, tap 2 opens the Share sheet.
function Backup() {
  const [files, setFiles] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function prepare() {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      setFiles(await buildBackupFiles())
    } catch (err) {
      setError(loadErrorMessage(err))
    }
    setBusy(false)
  }

  async function save() {
    setError('')
    try {
      await saveFiles(files)
      setFiles(null)
      setMessage('Copia de seguridad lista ✓')
    } catch (err) {
      if (err.name === 'AbortError') return // she closed the Share sheet
      console.error(err)
      setError('No se pudieron guardar los archivos. Probá de nuevo.')
    }
  }

  return (
    <section className="section">
      <h2>Copia de seguridad</h2>
      <p className="muted">
        Guarda una copia de todo (chicas, clases, pagos, tienda) en archivos de planilla. Hacela una vez por mes y
        guardá los archivos en un lugar seguro, como Google Drive o tu mail.
      </p>
      {files ? (
        <button className="btn-primary" onClick={save}>Guardar archivos</button>
      ) : (
        <button className="btn-secondary" onClick={prepare} disabled={busy}>
          {busy ? 'Preparando…' : 'Hacer copia de seguridad'}
        </button>
      )}
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// Changes save straight away (no Save button) and show a short message.
function PaymentSettings({ settings, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')

  async function save(changes, message) {
    setError('')
    try {
      await unwrap(supabase.from('settings').update(changes).eq('id', 1))
      reload()
      showToast(message)
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  function toggleMonth(n) {
    const skipped = settings.skip_months.includes(n)
    const months = skipped ? settings.skip_months.filter((m) => m !== n) : [...settings.skip_months, n].sort((a, b) => a - b)
    save({ skip_months: months }, skipped ? `Hay cuota en ${MONTH_NAMES[n - 1]}` : `Sin cuota en ${MONTH_NAMES[n - 1]}`)
  }

  return (
    <>
      <section className="section">
        <h2>Cuotas</h2>
        <p className="muted">
          Cada chica paga el mismo día del mes en que empezó (si empezó el 15, le vence el 15). Después de ese
          día, si no pagó, su cuota aparece como Vencida. Para cambiarlo, editá su fecha de inicio.
        </p>
      </section>

      <section className="section">
        <h2>Meses sin cuota</h2>
        <p className="muted">Por ejemplo enero, si el gimnasio cierra.</p>
        <div className="month-grid">
          {MONTH_NAMES.map((name, i) => (
            <label key={name} className="checkbox-row">
              <input type="checkbox" checked={settings.skip_months.includes(i + 1)} onChange={() => toggleMonth(i + 1)} />
              {capitalize(name)}
            </label>
          ))}
        </div>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}
