import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { plural, todayISO } from '../lib/format.js'
import { formatRate, loadAttendance } from '../lib/attendance.js'

// One line on the member screen: "Asistencia este año: 90% (18 de 20 clases)".
export default function MemberAttendance({ member }) {
  // Every class she has been on (by time or whole class), past ones too.
  const groupIds = [
    ...new Set([...member.slot_enrollments.map((e) => e.group_slots.group_id), ...member.enrollments.map((e) => e.group_id)]),
  ]
  const today = todayISO()
  const result = useLoad(
    () => (groupIds.length ? loadAttendance(today.slice(0, 4) + '-01-01', today, groupIds) : Promise.resolve(null)),
    [member.id],
  )
  const mine = result.data?.members.find((m) => m.member.id === member.id)
  if (!mine) return null // no saved classes yet (or still loading): show nothing

  return (
    <p className="attendance-line">
      <strong>Asistencia este año:</strong> {formatRate(mine.rate)} ({mine.classes - mine.absences} de{' '}
      {plural(mine.classes, 'clase', 'clases')}) · <Link to="/insights">Ver todo</Link>
    </p>
  )
}
