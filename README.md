# Vampire Dominion v2.12 — Blood Moon Edition

Калькулятор по игре «Наследие Вампиров» / Game of Vampires.

## Что исправлено после v2.0
- Конклав показывает точный дефицит или остаток баллов совета.
- Наборы на 15 смотрителей: Магия I и Магия II имеют подтверждённые номиналы; Магия III присутствует с вводом фактического номинала из игры.
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
