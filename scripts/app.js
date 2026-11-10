/**
 * VAMPIRE DOMINION v3.0 — ГЛАВНОЕ ПРИЛОЖЕНИЕ КАЛЬКУЛЯТОРА (БЕЗ VIP-ОГРАНИЧЕНИЙ)
 * Объединяет базу данных (data.js) и расчётное ядро (engine.js) со всеми вкладками.
 */
import { GAME_DB, getIconUrl } from './data.js';
import {
  ATTRIBUTES,
  FABRIC_COST_BY_QUALITY,
  calcAuraPercent,
  buildPresenceCurvesMap,
  calcPresencePercents,
  calcBagPoints,
  calcGuildExp,
  calcWardenBaseTalentStars,
  calcWardenTalentSum,
  calcWardenLevelMultiplier,
  calcLoverBonds,
  calcPromoteBonusExp,
  calcAchievableExpTalentPoints,
  calcConclaveBranch,
  autoDistributeConclave,
  calcCourtyardUpgrade,
  calcMaxCourtyardLevel,
  calcWardenLevelsUpgrade,
  getSummonCandidates,
  summarizeBag,
  calculateTotalDominanceReport,
} from './engine.js';

const STORAGE_KEY = 'vampire_dominion_v3_state';

const presenceCurvesMap = buildPresenceCurvesMap(GAME_DB.lover_presence_levels);

function createDefaultState() {
  const ownedWardens = {};
  // По умолчанию открыты стартовые смотрители
  for (const w of GAME_DB.wardens.slice(0, 12)) {
    ownedWardens[w.id] = { level: 100, promoteId: 1, exp: 0, talents: {}, auras: {} };
  }
  const ownedLovers = {};
  for (const l of GAME_DB.lovers.slice(0, 10)) {
    ownedLovers[l.id] = { affinity: 500, closeness: 50, sex: l.fixed_sex || 'female', presences: {} };
  }
  return {
    lang: 'ru',
    theme: 'dark',
    preferLocalIcons: true,
    activeTab: 'dominance',
    bagFilter: 'all',
    searchQuery: '',
    account: {
      blood: 50000000,
      conclaveExp: 500000,
      courtyardExp: 500,
      courtyardLvl: 10,
      lordName: 'Оптимист',
      serverId: 'EU S-629',
      avatarWardenId: 10230,
      partnerDefaultSex: 'female',
      conclave: { strength: 10, allure: 10, intellect: 10, spirit: 10 },
      ownedWardens,
      ownedLovers,
      skins: {},
      bag: {
        4421: 500,  // Атлас (A)
        4422: 300,  // Кашемир (S)
        4423: 200,  // Шёлк (SS)
        4175: 25,   // Свиток 1*
        4176: 20,   // Свиток 2*
        4177: 15,   // Свиток 3*
        4178: 10,   // Свиток 4*
        4179: 8,    // Свиток 5*
        4180: 5,    // Свиток 6*
        4005: 4,    // Большое вложение гильдии
        4824: 10,   // Сундук капитала 500
        4230: 10,   // Шкатулка близости 4-50
        4235: 10,   // Шкатулка влечения 4-50
      },
    },
    plan: {
      conclave: { strength: 10, allure: 10, intellect: 10, spirit: 10 },
      courtyardToLvl: 10,
      levels: {},
      bonds: {},
      skins: {},
      summons: { wardens: [], lovers: [] },
    },
  };
}

let state = loadState();

function applyTheme() {
  document.documentElement.classList.toggle('light-theme', state.theme === 'light');
}

function normalizeState(parsed = {}) {
  const base = createDefaultState();
  const incoming = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    ...base,
    ...incoming,
    lang: incoming.lang === 'en' ? 'en' : 'ru',
    theme: incoming.theme === 'light' ? 'light' : 'dark',
    account: {
      ...base.account,
      ...(incoming.account || {}),
      conclave: { ...base.account.conclave, ...(incoming.account?.conclave || {}) },
      bag: { ...base.account.bag, ...(incoming.account?.bag || {}) },
      // Preserve explicit empty collections: deleting a character must stay deleted.
      ownedWardens: incoming.account?.ownedWardens ?? base.account.ownedWardens,
      ownedLovers: incoming.account?.ownedLovers ?? base.account.ownedLovers,
    },
    plan: {
      ...base.plan,
      ...(incoming.plan || {}),
      conclave: { ...base.plan.conclave, ...(incoming.plan?.conclave || {}) },
      levels: { ...(incoming.plan?.levels || {}) },
      bonds: { ...(incoming.plan?.bonds || {}) },
      summons: { ...base.plan.summons, ...(incoming.plan?.summons || {}) },
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.warn('Не удалось прочитать сохранение, создаём новый профиль:', e);
  }
  return createDefaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function tName(type, key) {
  if (key === null || key === undefined || key === '') return '';
  const enumRu = { aura_type: { not_updatable: 'Статичный', updatable: 'Улучшаемый', collection: 'Коллекционный' }, presence_type: { not_updatable: 'Статичный', updatable: 'Улучшаемый', collection: 'Коллекционный' }, bonus_type: { talent: 'к талантам', book: 'к книгам', both: 'к талантам и книгам' } };
  const enumEn = { aura_type: { not_updatable: 'Static', updatable: 'Upgradeable', collection: 'Collection' }, presence_type: { not_updatable: 'Static', updatable: 'Upgradeable', collection: 'Collection' }, bonus_type: { talent: 'to talents', book: 'to books', both: 'to talents and books' } };
  const enumValue = (state.lang === 'en' ? enumEn : enumRu)[type]?.[key];
  if (enumValue) return enumValue;
  const dict = state.lang === 'en' ? (GAME_DB.names_en || {}) : (GAME_DB.names_ru || {});
  const translated = dict[type]?.[key];
  if (translated) return translated;
  if (state.lang === 'en') return String(key).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  return GAME_DB.names_ru?.[type]?.[key] || String(key).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function tUi(key) {
  const dict = state.lang === 'en' ? (GAME_DB.names_en || {}) : (GAME_DB.names_ru || {});
  return dict.ui?.[key] ?? GAME_DB.names_ru?.ui?.[key] ?? String(key).replace(/_/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function fmt(num) {
  return Number(num || 0).toLocaleString(state.lang === 'en' ? 'en-US' : 'ru-RU');
}

function attrDotsHtml(attrs = []) {
  return `<span class="attr-dots">${attrs.map(a => `<i class="dot ${a}" title="${tName('attribute', a)}"></i>`).join('')}</span>`;
}

function getDbContext() {
  return {
    wardens: GAME_DB.wardens,
    lovers: GAME_DB.lovers,
    items: GAME_DB.items,
    promotes: GAME_DB.warden_promotes,
    conclaveLevels: GAME_DB.conclave_levels,
    courtyardLevels: GAME_DB.courtyard_levels,
    presenceCurvesMap,
  };
}

function getWardenBaseAttributes(wardenId) {
  const warden = GAME_DB.wardens.find(w => w.id === Number(wardenId));
  const owned = state.account.ownedWardens[wardenId];
  const result = { strength: 0, allure: 0, intellect: 0, spirit: 0 };
  if (!warden || !owned) return result;
  const multiplier = calcWardenLevelMultiplier(owned.level || 1);
  warden.talents.forEach((talent, index) => {
    const level = Number(owned.talents?.[index] ?? 1);
    result[talent.attribute] += level * talent.stars * multiplier;
  });
  return result;
}

function getBondPlan(lover, owned) {
  const plan = state.plan.bonds[lover.id] || (state.plan.bonds[lover.id] = {});
  plan.wardenBaseAttrs = getWardenBaseAttributes(lover.warden_id);
  for (const bond of lover.scarlet_bonds || []) {
    const current = owned.bonds?.[bond.attribute] || { level: 0, percentLevel: 0 };
    plan[bond.attribute] ||= {
      level: current.level || 0,
      targetLevel: current.level || 0,
      percentLevel: current.percentLevel || 0,
      targetPercentLevel: current.percentLevel || 0,
    };
  }
  return plan;
}

function getLoverIconPath(lover, owned = null) {
  const sex = owned?.sex || lover.fixed_sex || 'female';
  return sex === 'male' ? (lover.icon_path_male || lover.icon_path_female) : (lover.icon_path_female || lover.icon_path_male);
}

// Автоматический "Быстрый подсчёт" (ранее платный Plus) по всем веткам!
function runFullAutoDistribute() {
  const db = getDbContext();
  const acc = state.account;

  // 1. Автораспределение Конклава
  const wardensByAttr = {};
  for (const attr of ATTRIBUTES) {
    wardensByAttr[attr] = db.wardens.filter(w => acc.ownedWardens[w.id] && w.attributes.includes(attr)).length || 1;
  }
  const concRes = autoDistributeConclave(db.conclaveLevels, acc.conclave, acc.conclaveExp, wardensByAttr);
  state.plan.conclave = concRes.levels;

  // 2. Автораспределение Сада
  const courtRes = calcMaxCourtyardLevel(db.courtyardLevels, acc.courtyardLvl, acc.courtyardExp);
  state.plan.courtyardToLvl = courtRes.toLvl;

  // 3. Автораспределение Уровней смотрителей за Кровь (жадный алгоритм по КПД: прирост / цена крови)
  let bloodLeft = acc.blood;
  const nextLevels = {};
  for (const [wIdStr, wData] of Object.entries(acc.ownedWardens)) {
    nextLevels[wIdStr] = wData.level;
  }

  while (bloodLeft > 0) {
    let bestWId = null;
    let bestEfficiency = 0;
    let bestStepCost = 0;

    for (const [wIdStr, wData] of Object.entries(acc.ownedWardens)) {
      const w = db.wardens.find(x => x.id === Number(wIdStr));
      if (!w) continue;
      const curLvl = nextLevels[wIdStr] ?? wData.level;
      const maxCap = db.promotes.find(p => p.id === (wData.promoteId || 1))?.max_warden_lvl ?? 100;
      if (curLvl >= maxCap) continue;

      const stepCheck = calcWardenLevelsUpgrade(w, curLvl, curLvl + 1, wData.promoteId || 1, db.promotes, acc.bag, wData.talents);
      if (stepCheck.bloodSpent <= bloodLeft && stepCheck.bloodSpent > 0) {
        const eff = stepCheck.baseGain / stepCheck.bloodSpent;
        if (eff > bestEfficiency) {
          bestEfficiency = eff;
          bestWId = wIdStr;
          bestStepCost = stepCheck.bloodSpent;
        }
      }
    }

    if (!bestWId) break;
    nextLevels[bestWId]++;
    bloodLeft -= bestStepCost;
  }
  state.plan.levels = nextLevels;

  // 4. Автоподбор доступных бесплатных/платных призывов
  const cands = getSummonCandidates(
    db.wardens,
    db.lovers,
    new Set(Object.keys(acc.ownedWardens).map(Number)),
    new Set(Object.keys(acc.ownedLovers).map(Number)),
    acc.bag
  );
  state.plan.summons.wardens = cands.wardens.filter(c => c.canSummon && c.cost > 0).map(c => c.id);

  saveState();
  render();
}

// Применение плана в профиль ("Записать в аккаунт")
function commitPlanToAccount() {
  const report = calculateTotalDominanceReport({ db: getDbContext(), account: state.account, plan: state.plan });
  for (const [lId, bondPlan] of Object.entries(state.plan.bonds || {})) {
    const owned = state.account.ownedLovers[lId];
    const lover = GAME_DB.lovers.find(l => l.id === Number(lId));
    if (!owned || !lover) continue;
    const cost = calcLoverBonds(lover, owned.affinity || 0, bondPlan, bondPlan.wardenBaseAttrs, owned.closeness || 0).spentAffinity;
    if (cost > (owned.affinity || 0)) {
      alert(`Недостаточно очков Доверия у ${tName('lover', lover.name)}: нужно ${fmt(cost)}, есть ${fmt(owned.affinity || 0)}.`);
      return;
    }
  }
  state.account.conclave = { ...state.plan.conclave };
  state.account.conclaveExp = Math.max(0, state.account.conclaveExp - report.spent.conclaveExp);
  state.account.courtyardLvl = state.plan.courtyardToLvl;
  state.account.courtyardExp = Math.max(0, state.account.courtyardExp - report.spent.courtyardExp);
  state.account.blood = Math.max(0, state.account.blood - report.spent.blood);

  for (const [lId, bondPlan] of Object.entries(state.plan.bonds || {})) {
    const owned = state.account.ownedLovers[lId];
    if (!owned) continue;
    owned.affinity = Math.max(0, (owned.affinity || 0) - calcLoverBonds(GAME_DB.lovers.find(l => l.id === Number(lId)), owned.affinity || 0, bondPlan, bondPlan.wardenBaseAttrs, owned.closeness || 0).spentAffinity);
    owned.bonds ||= {};
    for (const bond of GAME_DB.lovers.find(l => l.id === Number(lId))?.scarlet_bonds || []) {
      const target = bondPlan[bond.attribute];
      if (!target) continue;
      owned.bonds[bond.attribute] = { level: target.targetLevel, percentLevel: target.targetPercentLevel };
    }
  }
  state.plan.bonds = {};

  for (const [wId, tgtLvl] of Object.entries(state.plan.levels)) {
    if (state.account.ownedWardens[wId] && tgtLvl > state.account.ownedWardens[wId].level) {
      state.account.ownedWardens[wId].level = tgtLvl;
    }
  }
  for (const wId of state.plan.summons.wardens) {
    state.account.ownedWardens[wId] = { level: 1, promoteId: 1, exp: 0, talents: {}, auras: {} };
  }
  state.plan.summons = { wardens: [], lovers: [] };
  saveState();
  render();
}

// Главный рендер вкладок
function render() {
  applyTheme();
  const root = document.getElementById('app');
  if (!root) return;

  const db = getDbContext();
  const report = calculateTotalDominanceReport({ db, account: state.account, plan: state.plan });

  const lordName = String(state.account.lordName || 'Оптимист').trim() || 'Оптимист';
  const serverId = String(state.account.serverId || 'EU S-629').trim() || 'EU S-629';
  const avatarWardenId = Number(state.account.avatarWardenId || 10230);
  const wardenObj = db.wardens.find(w => w.id === avatarWardenId) || db.wardens[0];
  const navScrollLeft = document.getElementById('main-nav-tabs')?.scrollLeft ?? 0;

  const tabs = [
    ['dominance', `👑 ${tUi('title_dominance')}`],
    ['conclave', `🏛 ${tUi('conclave')} & ${tUi('courtyard')}`],
    ['levels', `🩸 ${tUi('levels')}`],
    ['talents', `📜 ${tUi('talents_title')}`],
    ['auras', `✨ ${tUi('auras_title')} & ${tUi('presences_title')}`],
    ['bonds', `🔗 ${tUi('bonds_title')}`],
    ['skins', `🎭 ${tUi('skins_title')}`],
    ['summon', `➕ ${tUi('summon_title')}`],
    ['bag', `🎒 ${tUi('bag_inventory')}`],
  ];

  root.innerHTML = `
    <div class="app-shell">
      <section class="hero-panel" aria-label="Наследие вампиров">
        <img class="hero-art" src="./assets/brand-hero.png" alt="Наследие вампиров — готический замок, вампиры и полная луна" />
        <div class="hero-ribbon"><span>VAMPIRE DOMINION</span><i></i><span>BLOOD MOON EDITION</span></div>
      </section>
      <header class="lord-header">
        <button class="lord-avatar-button" id="btn-open-settings" type="button" aria-label="${tUi('settings')}" title="${tUi('settings')}">
          <img class="lord-avatar" src="${getIconUrl(wardenObj.icon_path)}" alt="${escapeHtml(tName('warden', wardenObj.name))}" />
          <span class="lord-avatar-crown" aria-hidden="true">✦</span>
        </button>
        <div class="lord-profile-copy">
          <div class="lord-overline"><span class="lord-overline-mark">✦</span> Vampire Dominion · Blood Moon</div>
          <div class="lord-greeting">${tUi('greeting')}</div>
          <div class="lord-name-line"><strong class="lord-name">${escapeHtml(lordName)}</strong><span class="lord-server"><span aria-hidden="true">🌐</span> ${escapeHtml(serverId)}</span></div>
          <div class="lord-profile-note">${tUi('local_profile')}</div>
        </div>
        <div class="lord-header-actions">
          <button class="btn btn-gold lord-auto-button" id="btn-auto-all" type="button"><span aria-hidden="true">⚡</span> ${tUi('auto_all')}</button>
          <button class="lord-settings-button" id="btn-open-settings-secondary" type="button" aria-label="${tUi('settings')}" title="${tUi('settings')}">⚙</button>
        </div>
      </header>

      <section class="profile-actions" aria-label="${state.lang === 'en' ? 'Calculation actions' : 'Действия с расчётом'}">
        <button class="btn btn-gold" id="btn-reset-plan-toolbar" type="button">↺ ${state.lang === 'en' ? 'Reset plan' : 'Сбросить план'}</button>
        <button class="btn btn-primary" id="btn-save-calculation" type="button">✓ ${state.lang === 'en' ? 'Save calculation' : 'Сохранить расчёт'}</button>
        <button class="btn" id="btn-export" type="button">📤 ${state.lang === 'en' ? 'Export' : 'Экспорт'}</button>
        <button class="btn" id="btn-import" type="button">📂 ${state.lang === 'en' ? 'Import' : 'Импорт'}</button>
        <span class="profile-save-status" id="profile-save-status" role="status" aria-live="polite"></span>
      </section>

      <div class="nav-tabs-shell" aria-label="Разделы калькулятора">
        <button class="nav-scroll-btn" type="button" data-nav-scroll="-1" aria-label="Прокрутить вкладки влево">‹</button>
        <nav class="nav-tabs" id="main-nav-tabs">
          ${tabs.map(([id, label]) => `
            <button class="tab-btn ${state.activeTab === id ? 'active' : ''}" data-tab="${id}" type="button">${label}</button>
          `).join('')}
        </nav>
        <button class="nav-scroll-btn" type="button" data-nav-scroll="1" aria-label="Прокрутить вкладки вправо">›</button>
      </div>

      <main id="tab-view">
        ${renderActiveTab(db, report)}
      </main>
      <footer class="credit-card">
        <img class="credit-sticker" src="./assets/brand-sticker.png" alt="Романтический вампирский стикер" loading="lazy" />
        <div class="credit-copy">
          <span class="credit-kicker">СОЗДАНО С ЛЮБОВЬЮ</span>
          <strong>Создано с любовью при поддержке</strong>
          <div class="credit-support">«Девочки моих фантазий» <span>♥ ♥ ♥</span></div>
        </div>
      </footer>
      <div class="settings-overlay" id="settings-overlay" hidden>
        <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <div class="settings-modal-head">
            <div><div class="settings-kicker">✦ BLOOD MOON EDITION</div><h2 id="settings-modal-title">${tUi('settings')}</h2><p>${tUi('settings_subtitle')}</p></div>
            <button class="settings-close" id="btn-close-settings" type="button" aria-label="${tUi('close')}">×</button>
          </div>
          <div class="settings-grid">
            <section class="settings-section">
              <h3>♛ ${tUi('profile_settings')}</h3>
              <label class="settings-field"><span>${tUi('profile_name')}</span><input class="input" id="setting-lord-name" type="text" maxlength="30" value="${escapeHtml(lordName)}" autocomplete="nickname" /></label>
              <label class="settings-field"><span>${tUi('server')}</span><input class="input" id="setting-server-id" type="text" maxlength="24" value="${escapeHtml(serverId)}" placeholder="EU S-629" /></label>
              <label class="settings-field"><span>${tUi('avatar')}</span><select class="select" id="setting-avatar-warden">${db.wardens.map(w => `<option value="${w.id}" ${w.id === wardenObj.id ? 'selected' : ''}>${escapeHtml(tName('warden', w.name))}</option>`).join('')}</select></label>
              <div class="settings-avatar-preview"><img id="setting-avatar-preview" src="${getIconUrl(wardenObj.icon_path)}" alt="" /><span>${escapeHtml(tName('warden', wardenObj.name))}</span></div>
            </section>
            <section class="settings-section">
              <h3>☾ ${tUi('appearance')}</h3>
              <label class="settings-field"><span>${tUi('language')}</span><select class="select" id="setting-language"><option value="ru" ${state.lang === 'ru' ? 'selected' : ''}>Русский · RU</option><option value="en" ${state.lang === 'en' ? 'selected' : ''}>English · EN</option></select></label>
              <label class="settings-field"><span>${tUi('theme')}</span><select class="select" id="setting-theme"><option value="dark" ${state.theme !== 'light' ? 'selected' : ''}>${tUi('dark_theme')}</option><option value="light" ${state.theme === 'light' ? 'selected' : ''}>${tUi('light_theme')}</option></select></label>
              <label class="settings-field"><span>${tUi('partner_gender')}</span><select class="select" id="setting-partner-sex"><option value="female" ${(state.account.partnerDefaultSex || 'female') === 'female' ? 'selected' : ''}>${tUi('female')}</option><option value="male" ${state.account.partnerDefaultSex === 'male' ? 'selected' : ''}>${tUi('male')}</option></select></label>
              <div class="settings-local-note"><span aria-hidden="true">🔒</span><div><strong>${tUi('account_linking')}</strong><p>${tUi('local_profile_note')}</p></div></div>
            </section>
          </div>
          <div class="settings-modal-actions">
            <button class="btn btn-primary" id="btn-save-settings" type="button">✦ ${tUi('save_settings')}</button>
            <button class="btn" id="btn-reset-plan-top" type="button">↺ ${tUi('reset_plan')}</button>
            <button class="btn btn-danger-soft" id="btn-reset-account" type="button">⟲ ${tUi('reset_account')}</button>
          </div>
        </section>
      </div>
    </div>
  `;

  bindEvents(db);
  const nav = document.getElementById('main-nav-tabs');
  if (nav) nav.scrollLeft = navScrollLeft;
}

function renderActiveTab(db, report) {
  switch (state.activeTab) {
    case 'dominance': return renderDominanceTab(db, report);
    case 'conclave': return renderConclaveGardenTab(db, report);
    case 'levels': return renderLevelsTab(db, report);
    case 'talents': return renderTalentsTab(db);
    case 'auras': return renderAurasPresencesTab(db);
    case 'bonds': return renderBondsTab(db);
    case 'skins': return renderSkinsTab(db);
    case 'summon': return renderSummonTab(db);
    case 'bag': return renderBagTab(db, report);
    default: return renderDominanceTab(db, report);
  }
}

function renderDominanceTab(db, report) {
  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">Сводный прирост Господства</div>
          <div class="row-sub">Автоматический расчёт по всем 8 веткам прокачки</div>
        </div>
        <div class="gain-pill">+${fmt(report.gain.total)}</div>
      </div>
      <div class="grid-4" style="margin-bottom: 12px;">
        <div class="card" style="margin:0; padding:10px;">
          <div class="row-sub">Конклав</div>
          <div class="row-name" style="color:var(--ok)">+${fmt(report.gain.conclave)}</div>
        </div>
        <div class="card" style="margin:0; padding:10px;">
          <div class="row-sub">Сад (Двор)</div>
          <div class="row-name" style="color:var(--ok)">+${fmt(report.gain.courtyard)}</div>
        </div>
        <div class="card" style="margin:0; padding:10px;">
          <div class="row-sub">Уровни смотрителей</div>
          <div class="row-name" style="color:var(--ok)">+${fmt(report.gain.levels)}</div>
        </div>
        <div class="card" style="margin:0; padding:10px;">
          <div class="row-sub">Кровные узы и Призыв</div>
          <div class="row-name" style="color:var(--ok)">+${fmt(report.gain.bonds + report.gain.summon)}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-gold" id="btn-quick-run">⚡ Распределить все ресурсы оптимально</button>
        <button class="btn btn-primary" id="btn-commit-plan">✅ Применить план и списать ресурсы</button>
        <button class="btn" id="btn-reset-plan">↺ Сбросить план</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <span class="card-title">Ресурсы аккаунта</span>
        <span class="badge badge-gold">Локальное сохранение активно</span>
      </div>
      <div class="grid-2">
        <div>
          <label class="row-sub">🩸 Кровь аккаунта</label>
          <input type="number" class="input res-input" data-res="blood" value="${state.account.blood}" />
        </div>
        <div>
          <label class="row-sub">🏛 Очки Конклава</label>
          <input type="number" class="input res-input" data-res="conclaveExp" value="${state.account.conclaveExp}" />
        </div>
        <div>
          <label class="row-sub">🌿 Очки Сада</label>
          <input type="number" class="input res-input" data-res="courtyardExp" value="${state.account.courtyardExp}" />
        </div>
        <div>
          <label class="row-sub">🌿 Текущий уровень Сада (1–210)</label>
          <input type="number" class="input res-input" data-res="courtyardLvl" min="0" max="210" value="${state.account.courtyardLvl}" />
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <span class="card-title">Калькуляторы событий (из Сумки)</span>
      </div>
      <div class="grid-2">
        <div class="item-row">
          <div class="row-info">
            <div class="row-name">💖 Близость (в среднем)</div>
            <div class="row-sub">Минимум: ${fmt(report.bagCalculators.intimacy.minimum)} · Максимум: ${fmt(report.bagCalculators.intimacy.maximum)}</div>
          </div>
          <div class="gain-pill">${fmt(report.bagCalculators.intimacy.expected)}</div>
        </div>
        <div class="item-row">
          <div class="row-info">
            <div class="row-name">🌹 Влечение (в среднем)</div>
            <div class="row-sub">Минимум: ${fmt(report.bagCalculators.attraction.minimum)} · Максимум: ${fmt(report.bagCalculators.attraction.maximum)}</div>
          </div>
          <div class="gain-pill">${fmt(report.bagCalculators.attraction.expected)}</div>
        </div>
        <div class="item-row">
          <div class="row-info">
            <div class="row-name">🛡 Опыт Гильдии (с лимитом 3 дня вложений)</div>
            <div class="row-sub">Вёдра, сундуки и 3 лучших вложения</div>
          </div>
          <div class="gain-pill">${fmt(report.bagCalculators.guildExp.expected)}</div>
        </div>
      </div>
    </section>
  `;
}

function renderConclaveGardenTab(db, report) {
  const courtUpgrade = calcCourtyardUpgrade(db.courtyardLevels, state.account.courtyardLvl, state.plan.courtyardToLvl);
  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">🏛 Конклав (180 уровней)</div>
          <div class="row-sub">Потрачено: ${fmt(report.spent.conclaveExp)} из ${fmt(state.account.conclaveExp)} очков</div>
        </div>
        <button class="btn btn-gold btn-sm" id="btn-auto-conclave">⚡ Распределить Конклав</button>
      </div>
      ${ATTRIBUTES.map(attr => {
        const cur = state.account.conclave[attr] ?? 0;
        const tgt = Math.max(cur, state.plan.conclave[attr] ?? cur);
        const wCount = db.wardens.filter(w => state.account.ownedWardens[w.id] && w.attributes.includes(attr)).length || 1;
        const br = calcConclaveBranch(db.conclaveLevels, cur, tgt, wCount);
        return `
          <div class="item-row">
            <span class="dot ${attr}" style="width:14px;height:14px;"></span>
            <div class="row-info">
              <div class="row-name">${tName('attribute', attr)} (ур. ${cur} → ${tgt})</div>
              <div class="row-sub">Бонус смотрителям: +${fmt(br.flatBonusDelta)} · Книги: +${br.bookPercentDelta.toFixed(1)}% · Цена: ${fmt(br.spent)}</div>
            </div>
            <div class="row-controls">
              <span class="badge badge-ok">+${fmt(br.directAttributeGain)}</span>
              <input type="number" class="input stepper-input conc-target" data-attr="${attr}" min="${cur}" max="180" value="${tgt}" />
            </div>
          </div>
        `;
      }).join('')}
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <div class="card-title">🌿 Сад / Двор (210 уровней)</div>
          <div class="row-sub">Потрачено: ${fmt(courtUpgrade.spent)} из ${fmt(state.account.courtyardExp)} очков сада</div>
        </div>
        <div class="row-controls">
          <span class="gain-pill">+${fmt(courtUpgrade.totalGain)}</span>
          <input type="number" class="input stepper-input" id="inp-courtyard-target" min="${state.account.courtyardLvl}" max="210" value="${state.plan.courtyardToLvl}" />
        </div>
      </div>
      <div class="row-sub">
        Сила: +${fmt(courtUpgrade.gain.strength)} · Харизма: +${fmt(courtUpgrade.gain.allure)} · Интеллект: +${fmt(courtUpgrade.gain.intellect)} · Воля: +${fmt(courtUpgrade.gain.spirit)}
      </div>
    </section>
  `;
}

function renderLevelsTab(db, report) {
  const ownedIds = Object.keys(state.account.ownedWardens).map(Number);
  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">🩸 Уровни и Прорывы смотрителей (${ownedIds.length} из ${db.wardens.length})</div>
          <div class="row-sub">Расход Крови: ${fmt(report.spent.blood)} из ${fmt(state.account.blood)}</div>
        </div>
        <div class="gain-pill">+${fmt(report.gain.levels)}</div>
      </div>
      ${db.wardens.filter(w => state.account.ownedWardens[w.id]).map(w => {
        const ow = state.account.ownedWardens[w.id];
        const tgt = Math.max(ow.level, state.plan.levels[w.id] ?? ow.level);
        const upg = calcWardenLevelsUpgrade(w, ow.level, tgt, ow.promoteId || 1, db.promotes, state.account.bag, ow.talents);
        const prom = db.promotes.find(p => p.id === (ow.promoteId || 1));
        return `
          <div class="item-row">
            <img class="avatar" src="${getIconUrl(w.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
            <div class="row-info">
              <div class="row-name">${tName('warden', w.name)} ${attrDotsHtml(w.attributes)}</div>
              <div class="row-sub">
                Ступень: ${tName('warden_promote', prom?.name)} (до ${prom?.max_warden_lvl} ур.) · Кровь: ${fmt(upg.bloodSpent)}
                ${!upg.canPromote ? `<span style="color:var(--warn)"> · Нужны предметы прорыва</span>` : ''}
              </div>
            </div>
            <div class="row-controls">
              ${upg.baseGain > 0 ? `<span class="badge badge-ok">+${fmt(upg.baseGain)}</span>` : ''}
              <select class="select promote-select" data-wid="${w.id}" style="width:125px;">
                ${db.promotes.map(p => `<option value="${p.id}" ${p.id === (ow.promoteId || 1) ? 'selected' : ''}>${tName('warden_promote', p.name)}</option>`).join('')}
              </select>
              <input type="number" class="input stepper-input lvl-target" data-wid="${w.id}" min="${ow.level}" max="450" value="${tgt}" />
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderTalentsTab(db) {
  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">📜 Таланты, Рукописи и Опыт смотрителей</div>
          <div class="row-sub">200 опыта = 1 очко таланта · Расчёт Subset Sum DP для прорывов</div>
        </div>
      </div>
      ${db.wardens.map(w => {
        const isOwned = !!state.account.ownedWardens[w.id];
        const owned = state.account.ownedWardens[w.id];
        const baseStars = calcWardenBaseTalentStars(w);
        const promId = owned?.promoteId || 1;
        const bonusExp = calcPromoteBonusExp(db.promotes, promId);
        const maxTalentLvl = db.promotes.find(p => p.id === promId)?.max_talent_lvl ?? 40;
        const dpPoints = calcAchievableExpTalentPoints(w, maxTalentLvl, bonusExp);
        const trainedStars = owned ? calcWardenTalentSum(w, owned.talents || {}) : 0;
        return `
          <div class="item-row">
            <img class="avatar" src="${getIconUrl(w.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
            <div class="row-info">
              <div class="row-name">${tName('warden', w.name)} ${attrDotsHtml(w.attributes)} ${isOwned ? '<span class="badge badge-ok">В профиле</span>' : '<span class="badge">Не призван</span>'}</div>
              <div class="row-sub">
                Талантов: ${w.talents.length} · Звёзды: <b>${baseStars}★</b> · Текущий вес: <b>${owned ? trainedStars : '—'}</b> · Бонус опыта за прорывы: ${fmt(bonusExp)} (+${dpPoints} очк.)
              </div>
            </div>
            <div class="row-controls">
              <button class="btn btn-sm toggle-owned-warden" data-wid="${w.id}">${isOwned ? 'Убрать' : 'В профиль'}</button>
            </div>
          </div>
          ${owned ? `<details class="talent-editor"><summary>Настроить уровни талантов · ${tName('warden', w.name)}</summary>
            <div class="talent-grid">${w.talents.map((talent, index) => {
              const lvl = owned.talents?.[index] ?? 1;
              return `<label class="talent-control"><span>${tName('attribute', talent.attribute)} · ${talent.stars}★</span><input class="input talent-level" type="number" min="1" max="${maxTalentLvl}" step="1" data-wid="${w.id}" data-pos="${index}" value="${lvl}" /></label>`;
            }).join('')}</div>
          </details>` : ''}
        `;
      }).join('')}
    </section>
  `;
}

function renderAurasPresencesTab(db) {
  const wardensWithAuras = db.wardens.filter(w => w.auras && w.auras.length > 0);
  const loversWithPresences = db.lovers.filter(l => l.presences && l.presences.length > 0);

  return `
    <section class="card card-gold">
      <div class="card-head">
        <div class="card-title">✨ Вдохновения смотрителей (${wardensWithAuras.length})</div>
      </div>
      ${wardensWithAuras.map(w => `
        <div class="item-row">
          <img class="avatar" src="${getIconUrl(w.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
          <div class="row-info">
            <div class="row-name">${tName('warden', w.name)} ${attrDotsHtml(w.attributes)}</div>
            ${w.auras.map(a => {
              const curLvl = state.account.ownedWardens[w.id]?.auras?.[a.id] ?? (a.min_lvl || 0);
              const pct = calcAuraPercent(a, curLvl);
              return `<div class="row-sub">• [${tName('aura_type', a.aura_type)}] Бонус ${tName('bonus_type', a.bonus_type)}: <b>${pct.toFixed(1)}%</b> (ур. ${curLvl}${a.max_lvl ? '/' + a.max_lvl : ''})</div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title">💫 Веяния партнёров (${loversWithPresences.length})</div>
      </div>
      ${loversWithPresences.map(l => `
        <div class="item-row">
          <img class="avatar" src="${getIconUrl(getLoverIconPath(l, state.account.ownedLovers[l.id]), true)}" alt="" loading="lazy" />
          <div class="row-info">
            <div class="row-name">${tName('lover', l.name)} ${attrDotsHtml(l.attributes)}</div>
            ${l.presences.map(p => {
              const curLvl = state.account.ownedLovers[l.id]?.presences?.[p.id] ?? (p.min_lvl || 0);
              const percs = calcPresencePercents(p, curLvl, presenceCurvesMap);
              return `<div class="row-sub">• [${tName('presence_type', p.presence_type)}] Ур. ${curLvl}/${p.max_lvl}: Сила ${percs.strength}% · Хар. ${percs.allure}% · Инт. ${percs.intellect}% · Воля ${percs.spirit}%</div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderBondsTab(db) {
  const owned = state.account.ownedLovers;
  const ownedCount = Object.keys(owned).length;
  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">🔗 Кровные узы и спутники (${ownedCount} в профиле)</div>
          <div class="row-sub">Близость открывает ветви уз; очки Доверия расходуются на уровни. План считается локально.</div>
        </div>
      </div>
      ${db.lovers.map(l => {
        const current = owned[l.id];
        if (!current) return `
          <div class="item-row">
            <img class="avatar" src="${getIconUrl(getLoverIconPath(l), true)}" alt="" loading="lazy" />
            <div class="row-info"><div class="row-name">${tName('lover', l.name)}</div><div class="row-sub">${tName('warden', db.wardens.find(w => w.id === l.warden_id)?.name || '—')} · Не добавлен в профиль</div></div>
            <button class="btn btn-sm toggle-owned-lover" data-lid="${l.id}">Добавить</button>
          </div>`;
        const bondPlan = getBondPlan(l, current);
        const result = calcLoverBonds(l, current.affinity || 0, bondPlan, bondPlan.wardenBaseAttrs, current.closeness || 0);
        const warden = db.wardens.find(w => w.id === l.warden_id);
        return `
          <details class="lover-panel" open>
            <summary>
              <img class="avatar" src="${getIconUrl(getLoverIconPath(l, current), true)}" alt="" loading="lazy" />
              <span class="lover-summary-name">${tName('lover', l.name)}</span>
              <span class="badge badge-gold">${result.totalGain.toLocaleString('ru-RU')} госп.</span>
            </summary>
            <div class="lover-panel-body">
              <div class="row-sub">Смотритель: ${warden ? tName('warden', warden.name) : '—'} · Прогноз прироста по текущим талантам и уровню</div>
              <div class="grid-2 lover-stats">
                <label><span class="row-sub">Очки Доверия (ресурс)</span><input class="input lover-stat-input" type="number" min="0" data-lid="${l.id}" data-field="affinity" value="${current.affinity || 0}" /></label>
                <label><span class="row-sub">Близость (открывает ветви)</span><input class="input lover-stat-input" type="number" min="0" max="200" data-lid="${l.id}" data-field="closeness" value="${current.closeness || 0}" /></label>
              </div>
              <div class="row-sub bond-summary">Потратится: <b>${fmt(result.spentAffinity)}</b> · Останется: <b>${fmt(result.leftAffinity)}</b> · Прирост: <b>+${fmt(result.totalGain)}</b></div>
              ${result.spentAffinity > (current.affinity || 0) ? '<div class="bond-warning">Недостаточно очков Доверия. Уменьши цели, прежде чем применять план.</div>' : ''}
              <div class="bond-list">
                ${(l.scarlet_bonds || []).map(b => {
                  const st = bondPlan[b.attribute];
                  const detail = result.details.find(x => x.attribute === b.attribute);
                  return `<div class="bond-row">
                    <div class="bond-head"><strong>${tName('attribute', b.attribute)}${b.is_advantage ? ' ★' : ''}</strong><span class="row-sub">${fmt(detail?.totalAttrGain || 0)} госп.</span></div>
                    <div class="grid-2 bond-inputs">
                      <label><span class="row-sub">Уровень ${detail?.unlockedFlat ? '' : `· закрыто до близости ${b.unlock_closeness}`}</span><input class="input bond-target" type="number" min="${st.level}" max="600" data-lid="${l.id}" data-attr="${b.attribute}" data-kind="flat" value="${st.targetLevel}" ${detail?.unlockedFlat ? '' : 'disabled'} /></label>
                      <label><span class="row-sub">Процент ${detail?.unlockedPct ? '' : `· закрыто до близости ${b.unlock_closeness_percent}`}</span><input class="input bond-target" type="number" min="${st.percentLevel}" max="600" data-lid="${l.id}" data-attr="${b.attribute}" data-kind="percent" value="${st.targetPercentLevel}" ${detail?.unlockedPct ? '' : 'disabled'} /></label>
                    </div>
                    <div class="row-sub">Цена: ${fmt((detail?.costFlat || 0) + (detail?.costPct || 0))} · Бонус: +${fmt(detail?.totalAttrGain || 0)}</div>
                  </div>`;
                }).join('')}
              </div>
              <div class="lover-actions"><button class="btn btn-sm toggle-owned-lover" data-lid="${l.id}">Убрать из профиля</button></div>
            </div>
          </details>`;
      }).join('')}
    </section>
  `;
}

function renderSkinsTab(db) {
  const allWardenSkins = db.wardens.flatMap(w => (w.skins || []).map(s => ({ ...s, ownerType: 'warden', ownerName: tName('warden', w.name) })));
  const allLoverSkins = db.lovers.flatMap(l => (l.skins || []).map(s => ({ ...s, ownerType: 'lover', ownerName: tName('lover', l.name) })));
  const allSkins = [...allWardenSkins, ...allLoverSkins];

  return `
    <section class="card card-gold">
      <div class="card-head">
        <div>
          <div class="card-title">🎭 Облики и Магазин обликов (${allSkins.length})</div>
          <div class="row-sub">Стоимость уровня в ткани: A = 50 (Атлас) · S = 100 (Кашемир) · SS = 200 (Шёлк)</div>
        </div>
      </div>
      ${allSkins.map(s => `
        <div class="item-row">
          <img class="avatar" src="${getIconUrl(s.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
          <div class="row-info">
            <div class="row-name">${s.ownerName} · <span class="badge badge-gold">${s.quality.toUpperCase()}</span></div>
            <div class="row-sub">Опыт магазину: +${s.store_exp} · Расход ткани: ${FABRIC_COST_BY_QUALITY[s.quality]}/ур. · ${s.purchasable ? 'Доступен за ткань' : 'Нужна карточка'}</div>
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderSummonTab(db) {
  const cands = getSummonCandidates(
    db.wardens,
    db.lovers,
    new Set(Object.keys(state.account.ownedWardens).map(Number)),
    new Set(Object.keys(state.account.ownedLovers).map(Number)),
    state.account.bag
  );

  return `
    <section class="card card-gold">
      <div class="card-head">
        <div class="card-title">➕ Доступные для призыва Смотрители (${cands.wardens.length})</div>
      </div>
      ${cands.wardens.map(c => {
        const w = db.wardens.find(x => x.id === c.id);
        const itemObj = c.itemId ? db.items.find(i => i.id === c.itemId) : null;
        return `
          <div class="item-row">
            <img class="avatar" src="${getIconUrl(w?.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
            <div class="row-info">
              <div class="row-name">${tName('warden', c.name)} (${c.baseTalentStars}★)</div>
              <div class="row-sub">
                ${itemObj ? `Нужно: ${c.cost} × ${tName('item', itemObj.name)} (в сумке: ${c.have})` : 'Бесплатный призыв (Сюжет / VIP / Событие)'}
              </div>
            </div>
            <button class="btn btn-sm btn-primary toggle-owned-warden" data-wid="${c.id}">Призвать</button>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderBagTab(db, report) {
  const categories = summarizeBag(db.items, state.account.bag);
  const catNames = {
    all: 'Все (237)',
    coins: 'Печати и Жетоны',
    talent: 'Таланты и Рукописи',
    book: 'Книги',
    guild_exp: 'Гильдия',
    clothes: 'Экипировка прорыва',
    intimacy: 'Близость',
    attraction: 'Влечение',
    skin: 'Облики и Ткань',
    league: 'Лига',
  };

  const filteredItems = db.items.filter(it =>
    (state.bagFilter === 'all' || it.category === state.bagFilter) &&
    (!state.searchQuery || tName('item', it.name).toLowerCase().includes(state.searchQuery.toLowerCase()))
  );

  return `
    <section class="card">
      <div class="card-head">
        <div class="card-title">🎒 Инвентарь Сумки <span id="bag-result-count">(${filteredItems.length} предм.)</span></div>
      </div>
      <div class="nav-tabs" style="margin-bottom: 10px;">
        ${Object.entries(catNames).map(([k, label]) => `
          <button class="tab-btn bag-cat-btn ${state.bagFilter === k ? 'active' : ''}" data-cat="${k}">${label}</button>
        `).join('')}
      </div>
      <div style="margin-bottom: 10px;">
        <input type="text" class="input" id="inp-bag-search" placeholder="Поиск предмета по названию..." value="${state.searchQuery}" />
      </div>
      ${filteredItems.map(it => {
        const count = state.account.bag[it.id] ?? 0;
        return `
          <div class="item-row bag-item-row">
            <img class="avatar" src="${getIconUrl(it.icon_path, state.preferLocalIcons)}" alt="" loading="lazy" />
            <div class="row-info">
              <div class="row-name">${tName('item', it.name)}</div>
              <div class="row-sub">ID: ${it.id} · Категория: ${catNames[it.category] || it.category}</div>
            </div>
            <div class="row-controls">
              <input type="number" class="input stepper-input bag-item-input" data-iid="${it.id}" min="0" value="${count}" />
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function bindEvents(db) {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      saveState();
      render();
    });
  });

  document.querySelectorAll('[data-nav-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = document.getElementById('main-nav-tabs');
      if (!nav) return;
      nav.scrollBy({ left: Number(btn.dataset.navScroll) * Math.max(180, nav.clientWidth * 0.72), behavior: 'smooth' });
    });
  });

  document.getElementById('btn-save-calculation')?.addEventListener('click', () => {
    saveState();
    const status = document.getElementById('profile-save-status');
    if (status) {
      status.textContent = state.lang === 'en' ? 'Calculation saved locally' : 'Расчёт сохранён на этом устройстве';
      status.classList.add('is-visible');
      window.setTimeout(() => status.classList.remove('is-visible'), 2200);
    }
  });

  document.getElementById('btn-reset-plan-toolbar')?.addEventListener('click', () => {
    const message = state.lang === 'en' ? 'Reset the current calculation plan?' : 'Сбросить текущий расчёт? Данные аккаунта и ресурсы останутся без изменений.';
    if (!confirm(message)) return;
    state.plan = {
      conclave: { ...state.account.conclave },
      courtyardToLvl: state.account.courtyardLvl,
      levels: {},
      bonds: {},
      skins: {},
      summons: { wardens: [], lovers: [] },
    };
    saveState();
    render();
  });

  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = () => {
    if (settingsOverlay) settingsOverlay.hidden = true;
    document.body?.classList.remove('settings-open');
  };
  const openSettings = () => {
    if (settingsOverlay) settingsOverlay.hidden = false;
    document.body?.classList.add('settings-open');
  };
  document.getElementById('btn-open-settings')?.addEventListener('click', openSettings);
  document.getElementById('btn-open-settings-secondary')?.addEventListener('click', openSettings);
  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettings);
  settingsOverlay?.addEventListener('click', event => { if (event.target === settingsOverlay) closeSettings(); });
  document.getElementById('setting-avatar-warden')?.addEventListener('change', event => {
    const selected = db.wardens.find(w => w.id === Number(event.target.value));
    const preview = document.getElementById('setting-avatar-preview');
    if (selected && preview) { preview.src = getIconUrl(selected.icon_path); preview.alt = tName('warden', selected.name); }
  });
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    state.account.lordName = (document.getElementById('setting-lord-name')?.value || '').trim().slice(0, 30) || 'Оптимист';
    state.account.serverId = (document.getElementById('setting-server-id')?.value || '').trim().slice(0, 24) || 'EU S-629';
    state.account.avatarWardenId = Number(document.getElementById('setting-avatar-warden')?.value) || 10230;
    state.lang = document.getElementById('setting-language')?.value === 'en' ? 'en' : 'ru';
    state.theme = document.getElementById('setting-theme')?.value === 'light' ? 'light' : 'dark';
    state.account.partnerDefaultSex = document.getElementById('setting-partner-sex')?.value === 'male' ? 'male' : 'female';
    saveState(); closeSettings(); render();
  });
  document.getElementById('btn-reset-plan-top')?.addEventListener('click', () => {
    state.plan = { conclave: { ...state.account.conclave }, courtyardToLvl: state.account.courtyardLvl, levels: {}, bonds: {}, skins: {}, summons: { wardens: [], lovers: [] } };
    saveState(); closeSettings(); render();
  });
  document.getElementById('btn-reset-account')?.addEventListener('click', () => {
    const message = state.lang === 'en' ? 'Reset the entire account, progress, and plan? Export a backup first if you may need it.' : 'Сбросить весь аккаунт, прогресс и план? Если данные могут понадобиться, сначала экспортируйте копию.';
    if (!confirm(message)) return;
    localStorage.removeItem(STORAGE_KEY); state = createDefaultState(); saveState(); closeSettings(); render();
  });

  document.getElementById('btn-auto-all')?.addEventListener('click', runFullAutoDistribute);
  document.getElementById('btn-quick-run')?.addEventListener('click', runFullAutoDistribute);
  document.getElementById('btn-commit-plan')?.addEventListener('click', commitPlanToAccount);

  document.getElementById('btn-reset-plan')?.addEventListener('click', () => {
    state.plan = {
      conclave: { ...state.account.conclave },
      courtyardToLvl: state.account.courtyardLvl,
      levels: {},
      bonds: {},
      skins: {},
      summons: { wardens: [], lovers: [] },
    };
    saveState();
    render();
  });

  document.getElementById('btn-auto-conclave')?.addEventListener('click', () => {
    const wardensByAttr = {};
    for (const attr of ATTRIBUTES) {
      wardensByAttr[attr] = db.wardens.filter(w => state.account.ownedWardens[w.id] && w.attributes.includes(attr)).length || 1;
    }
    const res = autoDistributeConclave(db.conclaveLevels, state.account.conclave, state.account.conclaveExp, wardensByAttr);
    state.plan.conclave = res.levels;
    saveState();
    render();
  });

  document.querySelectorAll('.res-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const k = inp.dataset.res;
      state.account[k] = Math.max(0, Number(inp.value) || 0);
      saveState();
      render();
    });
  });

  document.querySelectorAll('.conc-target').forEach(inp => {
    inp.addEventListener('change', () => {
      const attr = inp.dataset.attr;
      state.plan.conclave[attr] = Math.min(180, Math.max(state.account.conclave[attr] || 0, Number(inp.value) || 0));
      saveState();
      render();
    });
  });

  document.getElementById('inp-courtyard-target')?.addEventListener('change', e => {
    state.plan.courtyardToLvl = Math.min(210, Math.max(state.account.courtyardLvl, Number(e.target.value) || 0));
    saveState();
    render();
  });

  document.querySelectorAll('.lvl-target').forEach(inp => {
    inp.addEventListener('change', () => {
      const wId = inp.dataset.wid;
      state.plan.levels[wId] = Math.min(450, Math.max(state.account.ownedWardens[wId]?.level || 1, Number(inp.value) || 1));
      saveState();
      render();
    });
  });

  document.querySelectorAll('.promote-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const wId = sel.dataset.wid;
      if (state.account.ownedWardens[wId]) {
        state.account.ownedWardens[wId].promoteId = Number(sel.value);
        saveState();
        render();
      }
    });
  });

  document.querySelectorAll('.toggle-owned-warden').forEach(btn => {
    btn.addEventListener('click', () => {
      const wId = Number(btn.dataset.wid);
      if (state.account.ownedWardens[wId]) {
        delete state.account.ownedWardens[wId];
      } else {
        state.account.ownedWardens[wId] = { level: 1, promoteId: 1, exp: 0, talents: {}, auras: {} };
      }
      saveState();
      render();
    });
  });


  document.querySelectorAll('.talent-level').forEach(inp => {
    inp.addEventListener('change', () => {
      const wid = Number(inp.dataset.wid);
      const pos = Number(inp.dataset.pos);
      const owned = state.account.ownedWardens[wid];
      if (!owned) return;
      const w = db.wardens.find(x => x.id === wid);
      const cap = db.warden_promotes.find(p => p.id === (owned.promoteId || 1))?.max_talent_lvl ?? 40;
      owned.talents ||= {};
      owned.talents[pos] = Math.min(cap, Math.max(1, Number(inp.value) || 1));
      saveState();
      render();
    });
  });

  document.querySelectorAll('.toggle-owned-lover').forEach(btn => {
    btn.addEventListener('click', () => {
      const lid = Number(btn.dataset.lid);
      const lover = db.lovers.find(x => x.id === lid);
      if (!lover) return;
      if (state.account.ownedLovers[lid]) {
        delete state.account.ownedLovers[lid];
        delete state.plan.bonds[lid];
      } else {
        state.account.ownedLovers[lid] = { affinity: 0, closeness: 0, sex: lover.fixed_sex || state.account.partnerDefaultSex || 'female', presences: {}, bonds: {} };
      }
      saveState();
      render();
    });
  });

  document.querySelectorAll('.lover-stat-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const lid = Number(inp.dataset.lid);
      const field = inp.dataset.field;
      const owned = state.account.ownedLovers[lid];
      if (!owned || !['affinity', 'closeness'].includes(field)) return;
      owned[field] = Math.max(0, Number(inp.value) || 0);
      saveState();
      render();
    });
  });

  document.querySelectorAll('.bond-target').forEach(inp => {
    inp.addEventListener('change', () => {
      const lid = Number(inp.dataset.lid);
      const attr = inp.dataset.attr;
      const kind = inp.dataset.kind;
      const lover = db.lovers.find(x => x.id === lid);
      const owned = state.account.ownedLovers[lid];
      if (!lover || !owned) return;
      const bond = (lover.scarlet_bonds || []).find(x => x.attribute === attr);
      if (!bond) return;
      const plan = getBondPlan(lover, owned);
      const value = Math.min(600, Math.max(0, Number(inp.value) || 0));
      const unlocked = kind === 'flat' ? owned.closeness >= bond.unlock_closeness : owned.closeness >= bond.unlock_closeness_percent;
      if (!unlocked) return;
      if (kind === 'flat') plan[attr].targetLevel = Math.max(plan[attr].level, value);
      else plan[attr].targetPercentLevel = Math.max(plan[attr].percentLevel, value);
      saveState();
      render();
    });
  });

  document.querySelectorAll('.bag-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bagFilter = btn.dataset.cat;
      render();
    });
  });

  document.getElementById('inp-bag-search')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    const query = state.searchQuery.trim().toLocaleLowerCase();
    let visible = 0;
    document.querySelectorAll('.bag-item-row').forEach(row => {
      const title = row.querySelector('.row-name')?.textContent?.toLocaleLowerCase() || '';
      const show = !query || title.includes(query);
      row.hidden = !show;
      if (show) visible++;
    });
    const count = document.getElementById('bag-result-count');
    if (count) count.textContent = `(${visible} предм.)`;
  });

  document.querySelectorAll('.bag-item-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const iId = Number(inp.dataset.iid);
      state.account.bag[iId] = Math.max(0, Number(inp.value) || 0);
      saveState();
      render();
    });
  });

  // Экспорт и Импорт JSON-профиля
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vampire_dominion_profile.json';
    a.click();
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        state = normalizeState(parsed);
        saveState();
        render();
      } catch (err) {
        alert('Ошибка чтения JSON файла профиля');
      }
    };
    inp.click();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  render();
});
