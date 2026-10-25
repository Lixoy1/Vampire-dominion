# Vampire Dominion v2.7 — Blood Moon Edition

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
