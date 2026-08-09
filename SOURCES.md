# Источники и архитектурные ориентиры

Проект написан с опорой на официальную документацию Telegram Mini Apps и открытые исходники.

## Telegram

- Telegram Mini Apps / Web Apps: https://core.telegram.org/bots/webapps
- Main Mini Apps: https://core.telegram.org/api/bots/webapps

Используемые практики:

- официальный `telegram-web-app.js` подключается до кода приложения;
- вызываются `Telegram.WebApp.ready()` и `expand()`;
- интерфейс mobile-first;
- bot token не хранится в клиентском коде;
- `initDataUnsafe` не используется для серверной авторизации.

## Open source примеры

- Telegram Mini Apps community organization: https://github.com/telegram-mini-apps
- Sample bot + mini app: https://github.com/tamimattafi/telegram-mini-app
- HyperFormula: https://github.com/handsontable/hyperformula

Мы не копировали чужой UI или бизнес-логику. Открытые проекты использованы как ориентир по структуре Telegram WebApp, отделению frontend/backend и безопасному обращению с токенами.

## Расчётное ядро

HyperFormula 3.3.0: https://hyperformula.handsontable.com/

В исходном Excel-калькуляторе найдено 806 формул. Набор функций ограничен 12 функциями Excel-совместимого синтаксиса:

`AVERAGE`, `EXP`, `IF`, `IFERROR`, `INDEX`, `INT`, `MATCH`, `MOD`, `ROUNDDOWN`, `SUM`, `SUMIF`, `VLOOKUP`.

HyperFormula поддерживает Excel/Google Sheets-совместимый синтаксис, включая INDEX/MATCH, VLOOKUP, SUMIF, IF и IFERROR.
