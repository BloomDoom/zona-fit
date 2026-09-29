// Who is on a class's attendance list.
//
// Members sign up to weekly TIMES (slot_enrollments: one day + hour of a
// class). Someone on "Lunes 8:30" of Clase 1 is only on that list, not on
// Wednesday's or on the 16:30 one.
//
// Members loaded before times existed still have a sign-up to the WHOLE
// class (enrollments) and show as "Falta elegir horarios". Until her
// times are chosen, she's on every list of that class, as before.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { membersOn } from './sessions.js'

const MEMBER = 'members(id, name, active)'

// All sign-ups (current and past, for old attendance) of some classes.
//   bySlot: [{ slot_id, start_date, end_date, members, group_slots: { group_id } }]
//   whole:  [{ group_id, start_date, end_date, members }]
export async function loadSignups(groupIds) {
  if (groupIds.length === 0) return { bySlot: [], whole: [] }
  const [bySlot, whole] = await Promise.all([
    unwrap(
      supabase
        .from('slot_enrollments')
        .select(`slot_id, start_date, end_date, ${MEMBER}, group_slots!inner(group_id)`)
        .in('group_slots.group_id', groupIds),
    ),
    unwrap(supabase.from('enrollments').select(`group_id, start_date, end_date, ${MEMBER}`).in('group_id', groupIds)),
  ])
  return { bySlot, whole }
}

// The members on one class's list that day (see membersOn for who counts).
// A weekly class uses its time's sign-ups. An extra class (no weekly
// time) has everyone signed up to any time of that class.
export function rosterFor(session, signups, keepIds) {
  const bySlot = signups.bySlot.filter((e) =>
    session.slot_id ? e.slot_id === session.slot_id : e.group_slots.group_id === session.group_id,
  )
  const whole = signups.whole.filter((e) => e.group_id === session.group_id)
  return membersOn([...bySlot, ...whole], session.date, keepIds)
}

// Sign-ups that are still going (not ended).
export const current = (signups) => signups.filter((e) => !e.end_date)
