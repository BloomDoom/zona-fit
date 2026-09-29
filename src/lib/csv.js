// A small CSV reader. Returns one object per row, using the header row
// as keys (lowercase, spaces → _):   name,Group → { name: …, group: … }
//
// Handles quoted fields ("Pérez, Juan") and both separators: Google
// Sheets uses commas, but Excel in Spanish uses semicolons.
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '') // invisible mark Excel adds at the start
  const firstLine = text.split(/\r?\n/, 1)[0]
  const count = (char) => firstLine.split(char).length - 1
  const separator = count(';') > count(',') ? ';' : ','

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"' // "" inside quotes means one "
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === separator) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field)
  rows.push(row)

  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim() !== '')) // skip blank lines
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return body.map((r) => Object.fromEntries(keys.map((key, i) => [key, (r[i] ?? '').trim()])))
}
