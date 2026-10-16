// Adds data-typing to <html> while a text field is focused (the iPhone
// keyboard is open). CSS hides the tab bar then: otherwise it rides up
// on top of the keyboard and covers the field or the Save button.
//
// When the keyboard closes, iOS sometimes leaves the page shifted, so the
// end of the screen can't be reached until you scroll. Scrolling by 0
// makes it measure the page again.
//
// Only fields that open the keyboard count. Lists, dates and times open a
// picker instead, and on the iPhone they can stay focused after choosing,
// which left the tab bar hidden until the app was closed.
const isTextField = (el) =>
  el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=date]):not([type=time]):not([type=month]):not([type=datetime-local]), textarea')

// The keyboard takes at least this much of the screen (px).
const KEYBOARD = 150

export function watchKeyboard() {
  const root = document.documentElement
  const viewport = window.visualViewport
  // Set once the screen has actually shrunk for the keyboard.
  let keyboardSeen = false

  // Turns typing off unless a text field (still on the page) has focus.
  function check() {
    const el = document.activeElement
    if (isTextField(el) && el.isConnected) return
    stopTyping()
  }

  // A field that disappears while focused (e.g. the "Mark paid" panel
  // closes after saving) never fires focusout, and the tab bar stayed
  // hidden until the app was restarted. So while typing, every change to
  // the page checks whether the field is still there.
  const observer = new MutationObserver(check)

  function startTyping() {
    if (root.hasAttribute('data-typing')) return
    keyboardSeen = false
    root.toggleAttribute('data-typing', true)
    observer.observe(document.body, { childList: true, subtree: true })
  }

  function stopTyping() {
    if (!root.hasAttribute('data-typing')) return
    observer.disconnect()
    root.toggleAttribute('data-typing', false)
    window.scrollTo(window.scrollX, window.scrollY)
  }

  // The keyboard can close while the field keeps focus (iOS does this
  // sometimes). When the screen grows back to full size, typing is over:
  // the field lets go of focus so tapping it again opens the keyboard
  // the normal way.
  viewport?.addEventListener('resize', () => {
    if (!root.hasAttribute('data-typing')) return
    const open = window.innerHeight - viewport.height > KEYBOARD
    if (open) keyboardSeen = true
    else if (keyboardSeen) {
      document.activeElement?.blur?.()
      stopTyping()
    }
  })

  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) startTyping()
  })
  document.addEventListener('focusout', () => {
    // Moving from one field to the next fires focusout then focusin: wait
    // a moment so the tab bar doesn't flash in between.
    setTimeout(check, 100)
  })
  // Coming back to the app (e.g. from WhatsApp).
  document.addEventListener('visibilitychange', check)
}
