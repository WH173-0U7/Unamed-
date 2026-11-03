# DarcVoyd: notes for working on this repo

## Version notes (every push)

Every update pushed to the game's branch (`main`) adds an entry at the top of
`src/core/changelog.ts` (`CHANGES`): bump the version (0.40 → 0.41 …), today's
date, and a few plain-English lines for the player about what changed. The
game shows the version on the main menu and a "What's new" list the first
time it's opened after an update.

## Layout rule: no sideways scrolling

Menus, shops and sheets only ever scroll up and down. Nothing may be wider
than the screen or scroll on the x axis, at any phone size (check 320×568,
375×667 and 667×375 landscape). Rows with buttons use the `li()` helper in
game.ts, which wraps buttons in `.li-btns` so they drop onto their own line
when there isn't room. Before pushing a UI change, open the affected screens
at those sizes and check that no element's right edge passes the viewport
and no scroll container has `scrollWidth > clientWidth`.
