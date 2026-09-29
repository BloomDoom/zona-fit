// The fields of a member, shared by the quick-add and edit screens.
//   values = { name, phone, plan_id, birth_date, start_date,
//              emergency_name, emergency_phone, notes }
//   plans  = active plans for the Plan select
//   short  = leave out the emergency contact and notes (quick-add only
//            asks for the basics; they can be filled in later when editing)

export const EMPTY_MEMBER = {
  name: '', phone: '', plan_id: '', birth_date: '', emergency_name: '', emergency_phone: '', notes: '',
}

// Ready for the database: empty text becomes null, the plan a number.
export function cleanMember(values) {
  const clean = {}
  for (const [key, value] of Object.entries(values)) {
    clean[key] = typeof value === 'string' ? value.trim() || null : value
  }
  clean.plan_id = clean.plan_id ? Number(clean.plan_id) : null
  return clean
}

export default function MemberFields({ values, onChange, plans, nameRef, short = false }) {
  const field = (key) => ({
    value: values[key] ?? '',
    onChange: (e) => onChange({ ...values, [key]: e.target.value }),
  })

  return (
    <>
      <label>
        Nombre y apellido
        <input {...field('name')} ref={nameRef} autoCapitalize="words" required />
      </label>
      <label>
        Teléfono / WhatsApp
        <input {...field('phone')} type="tel" placeholder="ej. 11 5555-1234" />
      </label>
      <label>
        Fecha de nacimiento <span className="optional">(para los cumples)</span>
        <input {...field('birth_date')} type="date" />
      </label>
      <label>
        Empezó el <span className="optional">(su cuota vence ese día de cada mes)</span>
        <input {...field('start_date')} type="date" required />
      </label>
      <label>
        Plan
        <select {...field('plan_id')}>
          <option value="">Sin plan (no paga cuota)</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      {!short && <MoreFields field={field} />}
    </>
  )
}

function MoreFields({ field }) {
  return (
    <>
      <fieldset>
        <legend>
          Contacto de emergencia <span className="optional">(opcional)</span>
        </legend>
        <label>
          Nombre
          <input {...field('emergency_name')} autoCapitalize="words" placeholder="ej. Laura (mamá)" />
        </label>
        <label>
          Teléfono
          <input {...field('emergency_phone')} type="tel" placeholder="ej. 11 5555-9876" />
        </label>
      </fieldset>
      <label>
        Notas <span className="optional">(lesiones, aptos médicos…)</span>
        <textarea {...field('notes')} rows={2} />
      </label>
    </>
  )
}
