import { Link } from 'react-router-dom'
import { formatDay } from '../lib/format.js'
import { fillMessage } from '../lib/members.js'
import { whatsappLink } from '../lib/phone.js'

// Birthdays on the Inicio screen: today's with a "Mandar saludo" button,
// and the rest of the week as a short list.
// `birthdays` = birthdaysBetween(...) for the day shown + the next 6 days.
export default function Birthdays({ birthdays, date, message }) {
  const today = birthdays.filter((b) => b.date === date)
  const soon = birthdays.filter((b) => b.date !== date)
  if (birthdays.length === 0) return null

  return (
    <section className="birthdays">
      {today.map(({ member, turning }) => {
        const link = member.phone && whatsappLink(member.phone, fillMessage(message, member))
        return (
          <div key={member.id} className="card birthday-card">
            <span className="card-title">
              🎂 Cumple de <Link to={`/members/${member.id}`}>{member.name}</Link>
            </span>
            <span>Hoy cumple {turning}</span>
            {link ? (
              <a className="btn-primary" href={link} target="_blank" rel="noreferrer">
                Mandar saludo por WhatsApp
              </a>
            ) : (
              <span className="muted">No tiene teléfono guardado, así que no se puede mandar el saludo.</span>
            )}
          </div>
        )
      })}

      {soon.length > 0 && (
        <p className="muted birthdays-soon">
          <strong>Cumples de esta semana:</strong>{' '}
          {soon.map((b) => `${b.member.name} (${formatDay(b.date)}, cumple ${b.turning})`).join(' · ')}
        </p>
      )}
    </section>
  )
}
