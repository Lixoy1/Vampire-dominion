# Vampire Dominion v2.3 — Blood Moon Edition

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
