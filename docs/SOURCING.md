# How the radar finds its news

Goal: each run should be worth more than an hour of searching. Five discovery channels feed one candidate list;
every candidate is read at the source, scored, and only the best eight survive under fixed diversity rules.
The source registry (database collection `sources`, about 150 entries) records for each source its `watch` URL
(newsroom, list or feed), `type`, `lang` (de or en), `tier` and `paywall`.

## 1. Discover (about 40 page reads per run)

| Channel | What | How |
|---|---|---|
| Watchlist sweep | Newsrooms, publication lists, feeds | Every run: all tier-1 regulators and security bodies (BSI, BMDS, Bundesnetzagentur, ENISA, CISA, NCSC, NIST, EU Commission). Plus a rotating quarter of all other sources (`meta/status.sweep` cursor), so every source is checked every two days. |
| Trend queries | Fresh coverage per trend | Six trends per run, chosen by: fewest stories in the last 14 days, then weight 3, then oldest search. Two searches each, one in English and one in German (e.g. "agentic AI enterprise 2026" and "KI-Agenten Unternehmen 2026"), limited to the past week. |
| Deep documents | Reports and papers that rarely reach the news | One trend per run: `filetype:pdf` searches for studies, surveys and reports (English and German: "Studie", "Umfrage", "Lagebild") on tier-1/2 domains; journal searches on nature.com, science.org, pnas.org, nber.org, arxiv.org (named labs), MIS Quarterly Executive, IEEE. |
| Audio and video | Podcasts, keynotes, lectures | Episode lists of the registry's podcasts and video channels. Only items with show notes or a transcript are used, and only what those texts say. |
| Market signals | Numbers | Analyst newsrooms (Gartner, IDC, Forrester, Bitkom Research, Lünendonk) and data sources (Synergy, Omdia, TOP500, MLCommons, Artificial Analysis, Cloudflare Radar). |

## 2. Verify

Open the primary source (the report, the law, the paper, the vendor page), not a write-up of it. Extract the one
fact that matters: a number, a deadline, a decision, a measured result. Dates come from the source. Unreviewed
claims are labelled "claims". Paywalled sources are used only for what is publicly readable.

## 3. Score (0 to 100; keep 55 and above)

| Factor | Points |
|---|---|
| Decision relevance for a CIO or CISO | 30 forces a decision, deadline or budget; 25 could move a ring; 15 a useful benchmark or number; 5 interesting only |
| Evidence | 20 primary data or legal text; 18 peer reviewed; 14 analyst with numbers; 8 vendor claim; 6 press report |
| Novelty | 20 a new fact; 8 an update to a known story (stored with `dup`); 0 a repeat (dropped) |
| Timeliness | 10 within 3 days; 6 within 7; 3 within 30; reports and papers count from publication |
| Coverage | +5 when the trend had fewer than two stories in 14 days; +5 for a German source |
| Format | +10 when the run has no report, paper, podcast or video yet |

## 4. Select (at most 8 per run)

- At least 2 German sources when any scored 55 or more.
- At least 1 primary document (report, paper, PDF, legal text).
- At least 1 podcast or video every other run.
- At most 2 per trend, 2 per source organisation, 1 vendor claim (unless it is a major release).
- `hot` only for a score of 85 or more, at most 1 per run.

## 5. Write and learn

Titles and takes are in English; German sources get `lang: "de"` and show "in German". Each item stores `score`
and `via` (which channel found it). The scan note records candidates found, kept, and the split by channel and
language. Every Monday the first run reviews the last 14 days (coverage by trend, area, language and format),
shifts the rotation towards gaps, and proposes new sources in the note; sources are added only after they have
been opened and checked.
