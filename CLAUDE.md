# DarcVoyd: notes for working on this repo

## Version notes (every push)

Every update pushed to the game's branch adds an entry at the top of
`src/core/changelog.ts` (`CHANGES`): bump the version (0.40 → 0.41 …), today's
date, and a few plain-English lines for the player about what changed. The
game shows the version on the main menu and a "What's new" list the first
time it's opened after an update.
