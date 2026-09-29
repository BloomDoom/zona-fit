import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments } from '../lib/groups.js'
import { internationalNumber, whatsappLink } from '../lib/phone.js'
import { buildVcard } from '../lib/vcard.js'
import { saveFiles } from '../lib/backup.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import BackButton from '../components/BackButton.jsx'

async function loadGroup(id) {
  const group = await unwrap(
    supabase.from('groups').select('id, name, enrollments(end_date, members(id, name, phone, active))').eq('id', id).single(),
  )
  const members = currentEnrollments(group.enrollments)
    .map((e) => e.members)
    .filter((m) => m.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { group, members }
}

// Small things remembered on this phone (drafts, "list already made").
function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode etc.: it just isn't remembered
  }
}

// Sending to the whole class uses a WhatsApp BROADCAST LIST (lista de
// difusión): one send reaches every member privately. (A web app can't
// send to many people by itself; only WhatsApp's paid business service can.)
// She makes the list once per class in WhatsApp; after that, each message
// is: write it here → "Copiar y abrir WhatsApp" → pick the list → send.
export default function GroupMessage() {
  const { id } = useParams()
  const showToast = useToast()
  const result = useLoad(() => loadGroup(id), [id])
  const [text, setText] = useState(() => readLocal(`group-message-${id}`, ''))
  const [listMade, setListMade] = useState(() => readLocal(`broadcast-list-${id}`, '') === 'yes')
  const [sent, setSent] = useState(new Set()) // member ids sent one by one on this visit

  function changeText(value) {
    setText(value)
    saveLocal(`group-message-${id}`, value)
  }

  function markListMade(made) {
    setListMade(made)
    saveLocal(`broadcast-list-${id}`, made ? 'yes' : '')
  }

  // Runs when she taps "Copiar y abrir WhatsApp". The link itself opens
  // WhatsApp with the text ready to send to any chat or list; the copy is
  // there in case she opens the list by hand and needs to paste.
  function copyForWhatsApp() {
    navigator.clipboard?.writeText(text.trim()).catch(() => {})
  }

  if (!result.data) {
    return (
      <main className="screen">
        <BackButton fallback={`/groups/${id}`} />
        <LoadState {...result} />
      </main>
    )
  }

  const { group, members } = result.data
  const withNumbers = members.map((m) => ({ member: m, number: m.phone && internationalNumber(m.phone) }))

  async function saveContacts() {
    const entries = withNumbers
      .filter((w) => w.number)
      .map(({ member, number }) => ({ name: `${member.name} · ${group.name}`, phone: number }))
    try {
      await saveFiles([new File([buildVcard(entries)], `${group.name}.vcf`, { type: 'text/vcard' })])
    } catch (err) {
      if (err.name !== 'AbortError') showToast('No se pudieron guardar los contactos. Probá de nuevo.')
    }
  }

  const missing = withNumbers.filter((w) => !w.number)

  return (
    <main className="screen">
      <BackButton fallback={`/groups/${id}`} />
      <h1>Mensaje a {group.name}</h1>

      <label>
        Tu mensaje
        <textarea
          rows={5}
          value={text}
          onChange={(e) => changeText(e.target.value)}
          placeholder="ej. ¡Hola! Este jueves no hay clase por el feriado."
        />
      </label>

      {text.trim() ? (
        <a
          className="btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(text.trim())}`}
          target="_blank"
          rel="noreferrer"
          onClick={copyForWhatsApp}
        >
          Copiar y abrir WhatsApp
        </a>
      ) : (
        <button className="btn-primary" disabled>Copiar y abrir WhatsApp</button>
      )}
      <p className="muted">
        En WhatsApp elegí la lista de difusión <strong>“{group.name}”</strong> y mandalo: le llega a todos a la vez.
        Si no aparece la lista, abrila vos y pegá el mensaje.
      </p>

      <details className="section setup-box" open={!listMade}>
        <summary>{listMade ? 'Lista de difusión: cómo armarla de nuevo' : 'La primera vez: armar la lista de difusión'}</summary>
        <ol className="setup-steps">
          <li>
            Si hay socios que no están en los contactos del iPhone, guardalos:
            <button className="btn-secondary" onClick={saveContacts}>
              Guardar {withNumbers.filter((w) => w.number).length} contactos en el iPhone
            </button>
            <span className="muted">Después elegí “Agregar todos los contactos”. Saltá los que ya tenés, para no duplicarlos.</span>
          </li>
          <li>
            En WhatsApp abrí <strong>Listas de difusión → Nueva lista</strong>, elegí a los socios de {group.name} y creala.
            Ponele de nombre <strong>{group.name}</strong>.
          </li>
          <li>
            Los mensajes de difusión solo les llegan a quienes tienen <strong>tu número guardado</strong> en su teléfono.
          </li>
        </ol>
        {missing.length > 0 && (
          <p className="error">
            Sin teléfono guardado: {missing.map((w) => w.member.name).join(', ')}.
          </p>
        )}
        {listMade ? (
          <button className="btn-text" onClick={() => markListMade(false)}>Mostrar estos pasos abiertos la próxima vez</button>
        ) : (
          <button className="btn-primary" onClick={() => markListMade(true)}>Listo, ya armé la lista</button>
        )}
      </details>

      <details className="section">
        <summary>O mandarlo a cada socio uno por uno</summary>
        <ul className="card-list">
          {members.map((m) => {
            const link = m.phone && text.trim() && whatsappLink(m.phone, text.trim())
            const done = sent.has(m.id)
            return (
              <li key={m.id} className={`card send-row ${done ? 'sent' : ''}`}>
                <span className="charge-name">
                  <span className="card-title">{m.name}</span>
                  <span className="muted">{m.phone || 'Sin teléfono guardado'}</span>
                </span>
                {m.phone &&
                  (link ? (
                    <a
                      className={done ? 'btn-secondary' : 'btn-primary'}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setSent(new Set(sent).add(m.id))}
                    >
                      {done ? 'Enviado ✓' : 'Enviar'}
                    </a>
                  ) : (
                    <button className="btn-primary" disabled>Enviar</button>
                  ))}
              </li>
            )
          })}
        </ul>
      </details>
    </main>
  )
}
