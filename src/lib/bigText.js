// Adds data-big-text to <html> when the iPhone text size is large
// (Settings → Display & Text Size → Larger Text). CSS uses it to stack
// side-by-side fields and un-stick things that would cover the screen.
//
// Why JavaScript: CSS can't ask "how big is the user's text?" directly,
// but we can measure the font size the iPhone gave the page.
const BIG = 22 // px; the default iPhone text size is 17px

export function watchTextSize() {
  const update = () => {
    const size = parseFloat(getComputedStyle(document.documentElement).fontSize)
    document.documentElement.toggleAttribute('data-big-text', size > BIG)
  }
  update()
  // She might change the text size in Settings and come back to the app.
  document.addEventListener('visibilitychange', update)
  window.addEventListener('resize', update)
}
