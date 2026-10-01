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
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) root.toggleAttribute('data-typing', true)
  })
  document.addEventListener('focusout', () => {
    // Moving from one field to the next fires focusout then focusin: wait
    // a moment so the tab bar doesn't flash in between.
    setTimeout(() => {
      if (isTextField(document.activeElement)) return
      root.toggleAttribute('data-typing', false)
      window.scrollTo(window.scrollX, window.scrollY)
    }, 100)
  })
}
