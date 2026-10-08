# Tech Trend Radar: user-flow requirements

Source: a scripted first-visit walkthrough (fresh browser, live data) at 1280×800, 1024×700 and 390×844, plus
a heuristic review against typical readers: CIO (five-minute morning skim), CISO (security only), enterprise
architect (one trend in depth, sources), tech analyst or investor (hot stories, numbers, podcasts).

## Where users got lost (audit, 8 Oct 2026)

| # | Finding | Seen on | Severity |
|---|---|---|---|
| A1 | Browser or Android Back left the site instead of closing the open trend | all | high |
| A2 | Coming back from a trend reset the news list to the top | all | high |
| A3 | A trend page ended in a dead end; no way on to the next trend | all | high |
| A4 | 33 of 99 stories have key points that were never shown; the only way on was leaving to the source | all | high |
| A5 | Laptops 960–1099 px got a one-story news bar instead of the list | laptop | medium |
| A6 | No quick way to see only security, only must-reads or only podcasts | all | medium |
| A7 | Reading did not change the unread count; no sense of progress, no natural end | all | medium |
| A8 | The news list and the radar were not linked on laptops | laptop | medium |
| A9 | No keyboard path from story to story | laptop | low |
| A10 | The briefing ended with a toast and nothing next | all | low |
| A11 | An endless loading shimmer cost about 190 ms of CPU per second while idle | all | NFR |
| A12 | Hover tooltips printed "null" | laptop | bug |

## Functional requirements

- FR1 Every panel page is a browser history entry. Back (browser, Android gesture, Esc, ‹) steps back inside the radar; deep links (#t-…, #news) still work. (A1)
- FR2 Each page remembers its scroll position and restores it on Back. (A2)
- FR3 One feed on phones and laptops (≥960 px): stories new since the last visit first (hot first), an "up to date" divider, then older stories, then earlier months as you scroll. Order and labels stay fixed for the visit. (A5)
- FR4 Tapping a story opens it in place: full summary, key points, "Read at <source> ↗", "N stories more on <trend>". One open at a time. (A4)
- FR5 Every trend page ends with "Next trend with news"; on phones a sideways swipe on the trend header and on laptops ← → move between trends. (A3)
- FR6 One row of controls: Briefing, All, Hot, Podcasts, AI, Security, Data, Frontier. An area filter zooms the radar to that area, and tapping an area on the radar sets the filter. (A6)
- FR7 A new story counts as seen after 60% of it was on screen for 1.5 s, or when opened. The header shows the unread count; the radar's orange dots clear as you read. (A7)
- FR8 The story at the top of the feed lights up its trend on the radar and shows its name; hovering a story highlights its dot. (A8)
- FR9 Keyboard: j and k move story by story, Enter opens the story. (A9)
- FR10 When the briefing ends, the feed is where you left it. (A10)
- FR11 Laptops: if nobody touches anything for 10 s after the radar appears, the briefing starts by itself, once per visit, labelled "Auto-play"; any click, key, scroll or touch before that cancels it.

## Non-functional requirements

- NFR1 Next story or next trend is always one action away (tap, swipe or key).
- NFR2 Reading never rebuilds the list: marking stories as seen updates counts in place, so nothing jumps.
- NFR3 Idle CPU under 25 ms/s on a 4× throttled phone; no endless animations; images lazy-loaded; off-screen cards skipped (content-visibility).
- NFR4 WCAG 2.2 AA: touch targets ≥ 44 px on phones, visible focus, reduced motion respected, every gesture has a button or key, moving content can be paused (2.2.2).
- NFR5 Humane design: no streaks, points, badges or ads; factual labels only; clear stopping points ("You are up to date", "That is everything in the archive").
- NFR6 Lean copy: no explanations of obvious things in the main flow; "How it works" holds the rest.
- NFR7 Runs in a SharePoint/Teams iframe and as a Claude artifact; the History API is optional.

## Principles used

Information foraging (strong scent: source mark, trend chip, one-line take before any click); progressive
disclosure (the quick view instead of leaving); continuity (next trend, endless feed with a natural end);
goal gradient (unread count that moves as you read); recognition over recall (filters as visible chips);
Fitts and Hick (one row of large targets, few choices).

## Interaction cost, before → after

| Task | Before | After |
|---|---|---|
| Next trend after finishing one | back, find a dot, tap (3+) | 1 tap or swipe |
| Back to where you were in the list | 1 tap + scroll to find your place | 1 tap or Back, same place |
| Key facts of a story without leaving | not possible | 1 tap |
| Only security news | search and scan (3+) | 1 tap |
| Browser Back on a trend | left the site | closes the trend |
| See the news list on a 1024 px laptop | 1 click | 0 |
