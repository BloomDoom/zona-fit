// Links for the Call and WhatsApp buttons.

export function callLink(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

// WhatsApp needs the full international number: 54 (Argentina) + 9
// (mobile) + area code + number, e.g. 5491155551234. People write local
// numbers like "11 5555-1234" or "011 15 5555-1234", so we convert them.
// "11 5555-1234" → "+5491155551234": the full number, for saving
// contacts that WhatsApp recognizes. null if the number can't be read.
export function internationalNumber(phone) {
  const link = whatsappLink(phone)
  return link && '+' + link.replace('https://wa.me/', '')
}

// Returns null if we can't make sense of the number.
// `text` (optional) is a message already typed in when WhatsApp opens.
export function whatsappLink(phone, text) {
  let digits = phone.replace(/\D/g, '')

  if (digits.startsWith('549')) {
    // already international
  } else if (digits.startsWith('54')) {
    digits = '549' + digits.slice(2)
  } else {
    digits = digits.replace(/^0/, '') // 011... → 11...
    // Old mobile format puts "15" after the area code (2 to 4 digits):
    // 11 15 5555-1234. The number is 10 digits without it.
    if (digits.length === 12) {
      for (const areaLength of [2, 3, 4]) {
        if (digits.slice(areaLength, areaLength + 2) === '15') {
          digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2)
          break
        }
      }
    }
    if (digits.length !== 10) return null
    digits = '549' + digits
  }

  return `https://wa.me/${digits}` + (text ? `?text=${encodeURIComponent(text)}` : '')
}
