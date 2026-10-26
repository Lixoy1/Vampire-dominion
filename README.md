# Vampire Dominion v2.18 — Blood Moon Edition

Калькулятор по игре «Наследие Вампиров» / Game of Vampires.

## Что исправлено после v2.0
- Конклав показывает точный дефицит или остаток баллов совета.
- Наборы на 15 смотрителей: Магия I и Магия II имеют подтверждённые номиналы; Магия III присутствует с вводом фактического номинала из игры.
- Реестр Кровных уз теперь отображает все 64 локальных профиля, включая героев без пары в выбранной публичной выборке; такие строки не трактуются как доказательство отсутствия уз в игре.
- В разделе «Гайды» добавлены поисковые реестры покрытия: все 64 локальных профиля для Кровных уз и уровни Сада 1–140. Записи без игровых подтверждений помечены явно и не влияют на прогноз господства.
- Пользовательские тексты очищены от технических упоминаний Excel/движка.
- Вернуты содержательные игровые гайды: господство, смотрители, таланты, арена, уровень Лорда, близость, влечение.
- Усилен мобильный hero и вампирская стилистика.
- В подвал добавлена благодарность «Девочке моих фантазий».


## v2.2 — Global Dominion Expansion (work in progress)
- Added an initial heir-marriage and ring planning module.
- Ring stock is tracked separately from planned marriages and projected Dominion.
- Dominion gained from a marriage is only included when the player enters a confirmed in-game value; unknown values are never guessed.
- Planned ring shortages and unverified bonuses are highlighted.
- Added a project roadmap and calculation-quality rules in `docs/GLOBAL-DEVELOPMENT-PLAN.md`.
- Existing calculator and source-based regression samples are retained.

## v2.3 — Global Dominion Expansion
- Added a source-by-source fallback for confirmed gains from systems whose full formulas are not yet integrated (Blood Bonds, Garden, skins, familiars, and other sources).
- Included these gains in the global forecast with per-source breakdown.
- Invalid or incomplete values are flagged and not silently counted.
- Added an automated regression check for the existing formulas and new modules.

## v2.6 — Couple illustrations and typography
- Added two optimized WebP illustrations: the footer dedication and the closeness calculator feature panel.
- Fonts: Cormorant Garamond for gothic/display headings and Manrope for clear interface text, with system fallbacks.
- Added a validated image loader and offline cache entries for both illustration files.
- Kept the illustrations separate from the calculator math; no existing calculations were changed.


## v2.7 — Offline reliability
- Versioned asset URLs and the PWA cache now move together.
- Service worker falls back to cached files when a versioned URL is unavailable offline.
- Previous `vd-local-*` caches are removed on activation to avoid stale UI and image assets.
- Existing calculation logic is unchanged by this PWA fix.


## v2.9 — Source-backed game-data registry and guides
- Replaced the in-app guide with source-aware material and clearly marked community claims.
- Added a 64-profile coverage checklist and 513 talent records from the legacy catalog; one incomplete profile is blocked from exact forecasts. The list is not declared complete/current.
- Added structured observations for six Blood Bonds level transitions and seven Garden levels transcribed from user-provided screenshots.
- Community-reported Garden maximum level and total points are recorded as unverified and are not used in calculations.
- Added a source manifest, data-quality rules, and CI checks for registry coverage and evidence status.
- Existing calculator formulas remain unchanged.


## v2.10 — Warden data validation and source audit
- Corrected 16 lowercase Will talent attributes that the case-sensitive calculator was skipping.
- Removed the `новый` placeholder profile from the selectable Warden roster.
- Marked Mara's incomplete talent profile as not eligible for an exact forecast until the missing data is confirmed.
- Added regression tests for Will-attribute normalization, incomplete profiles, and the structure of all 513 legacy talent rows.
- Added an external-data audit with known discrepancies in community Scarlet Bonds, Garden and Conclave tables; no conflicting values were imported into the calculator.
- Updated the guide's source list with official announcements and community reference links.


## v2.11 — Guild experience and workbook audit
- Added a guild-experience calculator for up to 29 participants, based on the formulas in the supplied `счет опыта ги.xlsx` workbook.
- All eight coefficients are tagged as transcribed from a user-supplied workbook and still require independent in-game verification.
- Added total experience, per-participant totals, item totals, validation for whole non-negative quantities, and source-by-source breakdown.
- Audited `БлизостьВлечениеРесурсы.xlsx`: current item ranges and collection-token multipliers match the workbook formulas.
- Added automated regression checks for every workbook-derived coefficient and retained all prior calculator tests.
- Audit report: `docs/UPLOADED-SPREADSHEET-AUDIT.md`.


## v2.12 — Source-led guide update
- Updated the guide with sourced context on Scarlet Bonds, Wardens' Attributes and Courtyard Boons.
- Added the guild-experience workbook values and direct link to the audit report in the guide.
- Clarified that public wiki pages explain system relationships but do not provide complete verified per-level numeric tables.
- Corrected section numbering after adding the guild-experience page and refreshed asset/PWA cache versions.


## v2.13 — Conclave reference audit
- Recorded the published community aggregate checkpoints for one Conclave branch and all four branches without treating them as per-level formulas.
- Added an automated audit comparing the legacy row table against those aggregate checkpoints.
- The current row table does not match: its direct attribute sum is 610,200 versus the community figure 987,000; book bonus sum is 1,092% versus 1,056%; and 50 level costs are missing.
- Exact Conclave gain and Conclave book bonus are now excluded from the global forecast until a complete level table is verified. A separate provisional row remains visible for debugging.
- Added visible status messages to distinguish calculated values from unverified estimates.
- Existing legacy source files and regression fixtures are preserved.


## v2.14 — Blood Bond coverage crosswalk
- Added a source-attributed crosswalk of 43 candidate Partner → Warden links from an older community dataset to all 64 local legacy Warden profiles.
- Kept numerical formulas out of the crosswalk because the public source has no declared licence, predates the 2026-09 update, and contains unresolved numeric discrepancies with in-game observations.
- Marked the local-name candidates Charlemagne ↔ Чарльз and Lorenzo ↔ Лоуренс as unresolved; likely transliterations are also explicitly marked as provisional.
- Linked the crosswalk from the source-led Guide section.
- Updated service-worker cache version and asset query strings so the revised guide is not hidden by stale PWA cache.
- Re-ran syntax, illustration, evidence-registry and calculator regression checks after the data registry changes.

- Source audit clarification: the Russian App Store listing for «Наследие Вампиров: Новолуние» also lists version 1.051.013 at the latest check; the separate international «Game of Vampires: Twilight Sun» listing is not used to infer the Russian client's version.


## v2.15 — Blood Bonds candidate coverage
- Added a searchable list of 43 Partner → Warden candidate links drawn from an older public community index.
- The page labels every entry as unverified; local-name candidates and bond classes are not treated as confirmed gameplay facts.
- Numerical values from that source are not imported into the calculation engine.
- Added the candidate crosswalk to the offline cache.
- Kept the Conclave safeguards in place: its aggregate totals still disagree with the legacy row table, so its preview and book bonus remain excluded from the exact global forecast.
- Existing regression and evidence-registry tests remain the release gate.
- Added a Russian App Store version-history source and explicitly separated its app id from the international Game of Vampires: Twilight Sun listing.
- Garden candidate check: rows 1–140 in the public community table sum to 18,900 `cost`, matching the post, but the candidate table continues to level 291 and its level-112 `points` conflicts with the in-game screenshot; no public numeric rows are imported.


## v2.18 — Blood Bonds and Garden workspaces
- Promoted Blood Bonds and Garden into dedicated top-level sections so the two priority systems are easy to inspect without digging through the guides.
- Blood Bonds page now shows the six actual-screen transitions separately from the 43-pair community crosswalk, plus the unresolved level-131 mismatch (936,020 vs 936,120).
- Garden page compares seven source checkpoints with the seven in-game observations. The level-112 effect mismatch is highlighted; candidate values remain excluded from the account forecast.
- Added the attributed source checkpoints to the evidence JSON and refreshed the offline cache for both priority registers.
- No speculative Garden or Blood Bonds numbers are added to the exact global-dominion forecast. Full level-by-level, per-Warden tables remain open work.
