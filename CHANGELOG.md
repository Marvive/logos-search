# Logos Search Changelog

## [Unreleased]

- Added a Reading Plans command that lists every Logos plan and opens today's assignment via its deep link.
- Added an Open Logos Layout command that filters saved layouts and loads the selected workspace immediately.
- Reading plans and layouts now read directly from `ReadingPlan/ReadingPlan.db` and `LayoutManager/layouts.db`, so the commands work out of the box on current Logos installs (Logos/Verbum, any account folder).
- Added a Bible Word Study command that streams lemmas/senses from Logos' AutoComplete database, then fires Logos' `bws …` command (with multiple URI fallbacks) so the correct study opens every time.

## [0.1.0] - {PR_MERGE_DATE}

- Added "Open Verse in Logos" command with version aliases and ref.ly opening.
- Added "Search Library" command that indexes Logos catalog.db and opens resources.
