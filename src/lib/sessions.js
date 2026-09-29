// Classes on a given day ("sessions"): working out which happen when.
//
// Regular classes are NOT stored in advance. For any date range we:
//   1. take every weekly time (group_slots) that falls on each day, and
//   2. mix in the rows saved in `sessions`: classes that were cancelled,
//      moved, had attendance saved, or are one-off extra classes.
// A saved row replaces the calculated class for the same slot + week
// (slot_id + original_date). That's what makes a single class changeable
// without touching the weekly pattern.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { datesBetween, isoWeekday } from './format.js'

const SESSION_FIELDS = '*, groups(id, name)'

// All classes between two dates (both included), sorted by date and time.
// Pass groupId to get only one class's sessions.
//
// Each one looks like a `sessions` row plus `group: { id, name }`.
// Calculated classes have id = null. A class moved to another day also
// appears on its original day with `movedAway: { date, start_time }`, so
// that day can say "Pasada al viernes".
export async function loadSessions(from, to, groupId = null) {
  let slotsQuery = supabase
    .from('group_slots')
    .select('*, groups!inner(id, name, active)') // !inner = only slots whose class matches the filter below
    .eq('active', true)
    .eq('groups.active', true)
  let storedQuery = supabase
    .from('sessions')
    .select(SESSION_FIELDS)
    .or(`and(date.gte.${from},date.lte.${to}),and(original_date.gte.${from},original_date.lte.${to})`)
  if (groupId) {
    slotsQuery = slotsQuery.eq('group_id', groupId)
    storedQuery = storedQuery.eq('group_id', groupId)
  }
  const [slots, stored] = await Promise.all([unwrap(slotsQuery), unwrap(storedQuery)])
  return mergeSessions(slots, stored, from, to)
}

// The pure logic of loadSessions (no database), kept separate so it can be tested.
export function mergeSessions(slots, stored, from, to) {
  const storedKeys = new Set(stored.filter((s) => s.slot_id).map((s) => `${s.slot_id}_${s.original_date}`))
  const list = []

  // 1. calculated weekly classes, unless a saved row replaces them
  for (const date of datesBetween(from, to)) {
    const weekday = isoWeekday(date)
    for (const slot of slots) {
      if (slot.weekday === weekday && !storedKeys.has(`${slot.id}_${date}`)) {
        list.push(fromSlot(slot, date))
      }
    }
  }

  // 2. saved classes
  for (const s of stored) {
    const session = { ...s, group: s.groups }
    if (s.date >= from && s.date <= to) list.push(session)
    const movedAway = s.original_date && s.original_date !== s.date
    if (movedAway && s.original_date >= from && s.original_date <= to) {
      const usualTime = slots.find((slot) => slot.id === s.slot_id)?.start_time ?? s.start_time
      list.push({ ...session, date: s.original_date, start_time: usualTime, movedAway: { date: s.date, start_time: s.start_time } })
    }
  }

  return list.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
}

// A calculated (not yet saved) class for a weekly slot on a date.
function fromSlot(slot, date) {
  return {
    id: null,
    group_id: slot.group_id,
    group: { id: slot.groups.id, name: slot.groups.name },
    slot_id: slot.id,
    original_date: date,
    date,
    start_time: slot.start_time,
    duration_min: slot.duration_min,
    cancelled: false,
    attendance_saved_at: null,
  }
}

// One class, for the class screen. Either by id, or by slot + date for a
// calculated class (which may have been saved in the meantime).
export async function loadSession({ id, slotId, date }) {
  if (id) {
    const s = await unwrap(supabase.from('sessions').select(SESSION_FIELDS).eq('id', id).single())
    return { ...s, group: s.groups }
  }
  const saved = await unwrap(
    supabase.from('sessions').select(SESSION_FIELDS).eq('slot_id', slotId).eq('original_date', date).maybeSingle(),
  )
  if (saved) return { ...saved, group: saved.groups }
  const slot = await unwrap(supabase.from('group_slots').select('*, groups(id, name)').eq('id', slotId).single())
  return fromSlot(slot, date)
}

// Makes sure a class has a row in `sessions` (needed before saving
// attendance, cancelling or moving it) and returns that row.
export async function ensureSaved(session) {
  if (session.id) return session
  const row = {
    group_id: session.group_id,
    slot_id: session.slot_id,
    original_date: session.original_date,
    date: session.date,
    start_time: session.start_time,
    duration_min: session.duration_min,
  }
  // ignoreDuplicates: if it was saved meanwhile (e.g. on another phone), keep that one.
  await unwrap(supabase.from('sessions').upsert(row, { onConflict: 'slot_id,original_date', ignoreDuplicates: true }))
  return loadSession({ slotId: session.slot_id, date: session.original_date })
}

export async function updateSession(session, changes) {
  const saved = await ensureSaved(session)
  await unwrap(supabase.from('sessions').update(changes).eq('id', saved.id))
  return { ...saved, ...changes }
}

// Link to a class screen. Calculated classes have no id yet, so their
// link says which weekly slot and date they are.
export function sessionPath(session) {
  return session.id ? `/class/${session.id}` : `/class/slot/${session.slot_id}/${session.date}`
}

// Members in a class on a given date: enrolled then, and still active
// (or absent from that class, so old attendance still shows them).
// `enrollments` rows need start_date, end_date and members(id, name, active).
export function membersOn(enrollments, date, keepIds = new Set()) {
  const byId = new Map()
  for (const e of enrollments) {
    const enrolled = e.start_date <= date && (!e.end_date || e.end_date > date)
    if (enrolled && (e.members.active || keepIds.has(e.members.id))) byId.set(e.members.id, e.members)
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
