# Ranking: heat, Hot, Top, momentum and My focus

Everything here is computed in the browser from the published data (`src/app/05b-signals.js`,
`src/app/12c-focus.js`). The same story gets the same heat for every reader; only My focus is personal.

## Heat (0 to 100) for every story

| Part | Points |
|---|---|
| Base | The scan's score (decision relevance, evidence, novelty, timeliness; see SOURCING.md). Older stories without a score get an estimate: 40 + evidence by kind (rule or paper 18, advisory 16, report 14, podcast or video 10, announcement 8) + 4 for regulators, journals and labs, −2 for vendors. A scan `hot` flag lifts the base to 88; the legacy `big` flag to 80. |
| Corroboration | +3 per other publisher on the same trend within ±7 days (follow-ups stored with `dup` count too), up to +9. |
| Urgency | +6 if the trend is in Act now, +3 in Prepare; +3 for a high-impact trend (weight 3). |
| Age | × 1 up to 3 days, × 0.95 up to 7, × 0.85 up to 14, × 0.6 up to 30, × 0.3 after that. Dated by publication day; when the source gives only a month, by the day the scan found it. |

## Hot

At most six stories, all from the last 14 days with heat 75 or more, and only the strongest one per trend.
Hot stays scarce on purpose: it is the "read or listen to this today" signal, not a category. The pill's
tooltip says why (scan score, number of sources, act-now trend).

## Top

The Top chip lists the last 30 days by heat. Hot stories come first by construction.

## Momentum per trend

Stories (including follow-ups) per week for the last eight weeks. Last four weeks against the four before:

- **Rising**: at least 3 stories recently and at least 1.5 × the earlier count + 1
- **Cooling**: at least 3 stories earlier and at most half of that recently
- **Steady**: everything else
- **Few signals yet**: fewer than 3 stories in eight weeks

Shown as eight weekly bars on the trend page, in the radar tooltip, as a Rising pill in the list, and in
"Gaining momentum" at the top of All trends. Momentum is about attention, not rating: rings move only at the
quarterly review (or with two top-tier sources), shown by the chevron next to a dot.

The radar started collecting in late September 2026, so momentum becomes meaningful from about November 2026,
when eight weeks of scans exist.

## My focus

The reader types terms (industry, systems, rules, priorities) or pastes a short strategy text. Pasted prose is
reduced to acronyms and longer words that appear in the radar's own trends or stories, minus words that match more
than a sixth of them (like "AI"). A few business words expand to the words sources use (bank → banking, financial,
DORA; manufacturing → industrial, factory; Mittelstand → SME; and so on).

My focus is a lens, not one more filter: while it is on, All, Top, Audio, the news bar, the briefing, the unread
count and the orange dots show only stories in focus.

Matching is strict on purpose. Terms match whole words with common endings (bank, banks, banking), never parts of
other words ("cloud" does not match "Cloudflare"). Synonyms are limited to exact equivalents (insurer and insurance,
PQC and post-quantum), never broader topics. A story is in focus when its title or summary names a term; a mention
only in its key points or source name counts when its trend is itself relevant. Pasted prose is reduced to the
two-word phrases the radar's own texts use ("sovereign cloud"), acronyms (NIS2, DORA) and specific longer words;
words that appear in more than one text in twelve are dropped as too general.

Trends light up when their definition names a term (4 points per term) or their stories name it in a title or
summary; trends with at least a third of the best score light up, the rest dim. Terms with no match are struck
through.
Focus terms are stored in the reader's browser only (never in the shared database).
