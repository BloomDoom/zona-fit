// Attendance insights (asistencia): % per member and per class.
//
// Only classes where attendance was SAVED count. A class nobody saved
// tells us nothing (we don't know who came), so it's left out instead of
// being counted as "everyone present".
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { loadSignups, rosterFor } from './roster.js'

// Loads and calculates attendance between two dates.
// Pass groupIds to only look at some classes (e.g. one member's classes).
export async function loadAttendance(from, to, groupIds = null) {
  let query = supabase
    .from('sessions')
    .select('id, group_id, slot_id, date, groups(id, name)')
    .not('attendance_saved_at', 'is', null)
    .eq('cancelled', false)
    .gte('date', from)
    .lte('date', to)
  if (groupIds) query = query.in('group_id', groupIds)
  const sessions = await unwrap(query)
  if (sessions.length === 0) return computeAttendance([], { bySlot: [], whole: [] }, [])

  const ids = [...new Set(sessions.map((s) => s.group_id))]
  const [signups, absences] = await Promise.all([
    loadSignups(ids),
    unwrap(supabase.from('absences').select('session_id, member_id').in('session_id', sessions.map((s) => s.id)).is('deleted_at', null)),
  ])
  return computeAttendance(sessions, signups, absences)
}

// The pure calculation (no database), so it can be tested.
// Returns:
//   members: [{ member, classes, absences, rate }]  most absences first
//   groups:  [{ group, classes, attended, expected, rate }]
//   overall: { attended, expected, rate }
// rate = share of classes attended, 0–1 (null if there were no classes).
export function computeAttendance(sessions, signups, absences) {
  const byMember = new Map()
  const byGroup = new Map()

  for (const session of sessions) {
    const absentIds = new Set(absences.filter((a) => a.session_id === session.id).map((a) => a.member_id))
    const roster = rosterFor(session, signups, absentIds)
    const g = byGroup.get(session.group_id) || { group: session.groups, classes: 0, attended: 0, expected: 0 }
    g.classes++

    for (const member of roster) {
      const m = byMember.get(member.id) || { member, classes: 0, absences: 0 }
      m.classes++
      g.expected++
      if (absentIds.has(member.id)) m.absences++
      else g.attended++
      byMember.set(member.id, m)
    }
    byGroup.set(session.group_id, g)
  }

  const rate = (attended, total) => (total > 0 ? attended / total : null)
  const members = [...byMember.values()]
    .map((m) => ({ ...m, rate: rate(m.classes - m.absences, m.classes) }))
    .sort((a, b) => b.absences - a.absences || a.rate - b.rate || a.member.name.localeCompare(b.member.name, 'es'))
  const groups = [...byGroup.values()]
    .map((g) => ({ ...g, rate: rate(g.attended, g.expected) }))
    .sort((a, b) => a.group.name.localeCompare(b.group.name, 'es'))
  const attended = groups.reduce((sum, g) => sum + g.attended, 0)
  const expected = groups.reduce((sum, g) => sum + g.expected, 0)

  return { members, groups, overall: { attended, expected, rate: rate(attended, expected) } }
}

// 0.9 → "90%"
export function formatRate(rate) {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`
}
