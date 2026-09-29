// Member helpers: age and birthdays.
import { todayISO } from './format.js'

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// The date of someone's birthday in a given year. Born on Feb 29 → their
// birthday is Feb 28 in years without a Feb 29.
export function birthdayIn(birthDate, year) {
  const [, m, d] = birthDate.split('-')
  if (m === '02' && d === '29' && !isLeapYear(year)) return `${year}-02-28`
  return `${year}-${m}-${d}`
}

// Birthdays between two dates (both included, less than a year apart),
// sorted by date: [{ member, date, turning }]. `turning` = the new age.
export function birthdaysBetween(members, from, to) {
  const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])]
  const list = []
  for (const member of members) {
    if (!member.birth_date) continue
    for (const year of years) {
      const date = birthdayIn(member.birth_date, year)
      if (date >= from && date <= to) {
        list.push({ member, date, turning: year - Number(member.birth_date.slice(0, 4)) })
      }
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.member.name.localeCompare(b.member.name, 'es'))
}

// A message template with {name} replaced by the member's first name.
export function fillMessage(template, member) {
  return template.replaceAll('{name}', firstName(member))
}

export function firstName(member) {
  return member.name.trim().split(/\s+/)[0]
}

// Age in whole years on a date (today by default). null without a birth date.
export function ageOn(birthDate, date = todayISO()) {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const hadBirthday = m > bm || (m === bm && d >= bd)
  return y - by - (hadBirthday ? 0 : 1)
}
