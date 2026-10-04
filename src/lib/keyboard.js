// Adds data-typing to <html> while a text field is focused (the iPhone
// keyboard is open). CSS hides the tab bar then: otherwise it rides up
// on top of the keyboard and covers the field or the Save button.
//
// When the keyboard closes, iOS sometimes leaves the page shifted, so the
// end of the screen can't be reached until you scroll. Scrolling by 0
// makes it measure the page again.
const isTextField = (el) =>
  el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select')

export function watchKeyboard() {
  const root = document.documentElement

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
    root.toggleAttribute('data-typing', true)
    observer.observe(document.body, { childList: true, subtree: true })
  }

  function stopTyping() {
    if (!root.hasAttribute('data-typing')) return
    observer.disconnect()
    root.toggleAttribute('data-typing', false)
    window.scrollTo(window.scrollX, window.scrollY)
  }

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
