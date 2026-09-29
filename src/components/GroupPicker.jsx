// Tick the class(es) a member goes to. Most go to one, but some come to
// different times (e.g. Funcional on Monday, Localizada on Thursday):
// ticking both puts her on both attendance lists.
//   groups   = active classes [{ id, name }]
//   value    = ticked class ids
//   onChange = gets the new list of ids
export default function GroupPicker({ groups, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((g) => g !== id) : [...value, id])

  return (
    <fieldset>
      <legend>
        Clases <span className="optional">(para la lista de asistencia; puede ser más de una)</span>
      </legend>
      {groups.length === 0 && <p className="muted">Todavía no hay clases.</p>}
      {groups.map((g) => (
        <label key={g.id} className="checkbox-row">
          <input type="checkbox" checked={value.includes(g.id)} onChange={() => toggle(g.id)} />
          {g.name}
        </label>
      ))}
    </fieldset>
  )
}
