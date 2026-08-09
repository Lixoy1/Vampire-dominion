(() => {
  'use strict';

  const DATA = window.VD_DATA;
  const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  let hf = null;
  let sheetId = null;
  let updateTimer = null;
  const boundInputs = new Map();
  const covered = new Set();
  const THEME_KEY = 'vd-theme';
  const EXCEL_EXPECTED_FORMULAS = 806;
  const EXCEL_EXPECTED_INPUTS = 314;
  const DERIVED_INPUTS = new Set(['AU7','AU25','AU43','AU62','AU81']);

  function preferredTheme(){
    try {
      const saved=localStorage.getItem(THEME_KEY);
      if(saved==='light'||saved==='dark') return saved;
    } catch(_) {}
    if(TG && (TG.colorScheme==='light'||TG.colorScheme==='dark')) return TG.colorScheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme, persist=true){
    const next=theme==='light'?'light':'dark';
    document.documentElement.dataset.theme=next;
    const meta=document.querySelector('meta[name="theme-color"]');
    const bg=next==='light'?'#efe6dc':'#070506', header=next==='light'?'#f5eee6':'#090608';
    if(meta) meta.setAttribute('content',header);
    const btn=document.getElementById('themeBtn');
    if(btn){ btn.setAttribute('aria-pressed',String(next==='light')); btn.querySelector('span').textContent=next==='light'?'☀':'☾'; btn.title=next==='light'?'Включить тёмную тему':'Включить светлую тему'; }
    if(persist){ try{localStorage.setItem(THEME_KEY,next);}catch(_){} }
    if(TG){ try{ if(TG.setHeaderColor)TG.setHeaderColor(header); if(TG.setBackgroundColor)TG.setBackgroundColor(bg); if(TG.setBottomBarColor)TG.setBottomBarColor(header); }catch(_){} }
  }

  function toggleTheme(){
    const current=document.documentElement.dataset.theme||preferredTheme();
    applyTheme(current==='light'?'dark':'light',true);
    if(TG?.HapticFeedback)try{TG.HapticFeedback.selectionChanged();}catch(_){}
  }

  function excelCoverage(){
    let formulaCount=0; const functions=new Set();
    for(const rows of Object.values(DATA.sheets||{})){
      for(const row of rows||[]){
        for(const value of row||[]){
          if(typeof value==='string' && value.startsWith('=')){
            formulaCount++;
            for(const m of value.matchAll(/(?<![A-Z0-9_])([A-Z][A-Z0-9_.]*)\s*\(/g)) functions.add(m[1]);
          }
        }
      }
    }
    return {formulaCount,inputCount:(DATA.manualCells||[]).length,functions:[...functions].sort()};
  }

  function renderExcelCoverage(){
    const c=excelCoverage();
    const formulaOk=c.formulaCount===EXCEL_EXPECTED_FORMULAS;
    const inputOk=c.inputCount===EXCEL_EXPECTED_INPUTS;
    const boundCount=[...DATA.manualCells].filter(a=>boundInputs.has(a)||DERIVED_INPUTS.has(a)).length;
    const boundOk=boundCount===EXCEL_EXPECTED_INPUTS;
    const f=document.getElementById('formulaCoverage'), i=document.getElementById('inputCoverage'), fn=document.getElementById('functionCoverage'), list=document.getElementById('functionList');
    if(f)f.textContent=`${c.formulaCount}/${EXCEL_EXPECTED_FORMULAS} ${formulaOk?'✓':'!'}`;
    if(i)i.textContent=`${boundCount}/${c.inputCount} ${inputOk&&boundOk?'✓':'!'}`;
    if(fn)fn.textContent=`${c.functions.length} функций ✓`;
    if(list)list.textContent=c.functions.join(' • ');
    return formulaOk&&inputOk&&boundOk;
  }

  const keeperBlocks = [
    {n:1, header:6, sub:7, talents:[8,19], exp:20},
    {n:2, header:24, sub:25, talents:[26,37], exp:38},
    {n:3, header:42, sub:43, talents:[44,55], exp:56},
    {n:4, header:61, sub:62, talents:[63,74], exp:75},
    {n:5, header:80, sub:81, talents:[82,93], exp:94}
  ];
  const conclave = [
    ['Сила','S7','T7','U7','V7'],
    ['Харизма','S8','T8','U8','V8'],
    ['Интеллект','S9','T9','U9','V9'],
    ['Воля','S10','T10','U10','V10']
  ];

  function parseAddress(a) {
    const m = /^([A-Z]+)(\d+)$/.exec(a);
    if (!m) throw new Error('Некорректный адрес: ' + a);
    let col = 0;
    for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
    return {sheet: sheetId, col: col - 1, row: Number(m[2]) - 1};
  }

  function cell(a, engine = hf) {
    try {
      const v = engine.getCellValue(parseAddressForEngine(a, engine));
      if (v && typeof v === 'object' && v.type) return null;
      return v;
    } catch (_) { return null; }
  }

  function parseAddressForEngine(a, engine) {
    const m = /^([A-Z]+)(\d+)$/.exec(a);
    let col = 0;
    for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
    return {sheet: engine.getSheetId('Господство'), col: col - 1, row: Number(m[2]) - 1};
  }

  function normalizeInput(raw, kind='number') {
    if (raw === '' || raw === null || raw === undefined) return null;
    if (kind === 'text') return String(raw);
    const n = Number(String(raw).replace(',', '.').replace(/\s/g,''));
    return Number.isFinite(n) ? n : null;
  }

  function setCell(a, value, kind='number', engine=hf) {
    const addr = parseAddressForEngine(a, engine);
    engine.setCellContents(addr, [[normalizeInput(value, kind)]]);
  }

  function fmt(v, unit='') {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string') return v;
    if (!Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    const digits = Math.abs(n) >= 100 ? 1 : Math.abs(n) >= 10 ? 2 : 3;
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(n) + (unit ? ' ' + unit : '');
  }

  function inputField(label, addr, opts={}) {
    covered.add(addr);
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const title = document.createElement('span');
    title.textContent = label;
    wrap.appendChild(title);
    const input = opts.select ? document.createElement('select') : document.createElement('input');
    input.dataset.cell = addr;
    input.dataset.kind = opts.kind || (opts.select ? 'text' : 'number');
    if (opts.select) {
      const empty = document.createElement('option'); empty.value=''; empty.textContent='— не выбран —'; input.appendChild(empty);
      for (const x of opts.options || []) { const o=document.createElement('option'); o.value=x; o.textContent=x; input.appendChild(o); }
    } else {
      input.type = opts.type || 'number'; input.inputMode = 'decimal'; input.step = opts.step || 'any';
      if (opts.min !== undefined) input.min = opts.min;
    }
    if (opts.placeholder) input.placeholder = opts.placeholder;
    const initial = getStored(addr);
    if (initial !== null && initial !== undefined) input.value = initial;
    input.addEventListener('input', onInput);
    input.addEventListener('change', onInput);
    wrap.appendChild(input);
    if (opts.help) { const small=document.createElement('small'); small.textContent=opts.help; wrap.appendChild(small); }
    boundInputs.set(addr,input);
    return wrap;
  }

  function onInput(e) {
    const el=e.currentTarget, addr=el.dataset.cell, kind=el.dataset.kind;
    setCell(addr, el.value, kind);
    saveStored(addr, el.value);
    validateField(el);
    clearTimeout(updateTimer);
    updateTimer=setTimeout(refresh,35);
  }

  function validateField(el) {
    el.parentElement.classList.remove('invalid');
    const val=el.value;
    if (val==='' || el.dataset.kind==='text') return true;
    const n=Number(String(val).replace(',','.'));
    if (!Number.isFinite(n) || n<0) { el.parentElement.classList.add('invalid'); return false; }
    return true;
  }

  function storageKey(addr){ return 'vd01:' + addr; }
  function getStored(addr){ try{return localStorage.getItem(storageKey(addr));}catch(_){return null;} }
  function saveStored(addr,val){ try{ if(val==='')localStorage.removeItem(storageKey(addr)); else localStorage.setItem(storageKey(addr),val);}catch(_){} }
  function vKey(key){ return 'vd05:' + key; }
  function getVirtual(key){ try{return localStorage.getItem(vKey(key));}catch(_){return null;} }
  function setVirtual(key,val){ try{ if(val===''||val===null||val===undefined)localStorage.removeItem(vKey(key)); else localStorage.setItem(vKey(key),String(val)); }catch(_){} }
  function clearStorage(){ try{ Object.keys(localStorage).filter(k=>k.startsWith('vd01:')||k.startsWith('vd05:')).forEach(k=>localStorage.removeItem(k)); }catch(_){} }

  function migrateV10(){
    try{
      if(localStorage.getItem('vd10:migrated')==='1') return;
      // До v0.5 поле AU+1 показывалось как «Прирост уровня», и его легко было принять за целевой уровень.
      // Старые значения нельзя безопасно интерпретировать — удаляем только эти 5 полей и просим ввести цель заново.
      ['AU7','AU25','AU43','AU62','AU81'].forEach(a=>localStorage.removeItem(storageKey(a)));
      // v1.0 начинает универсальный расчёт без скрытых ресурсов из демонстрационного примера.
      ['BD2','BE5','BE6','BE7','BE8','BE9','BE10','BE11','BE12','BE13','BE14'].forEach(a=>localStorage.removeItem(storageKey(a)));
      localStorage.setItem('vd10:migrated','1');
    }catch(_){}
  }

  function initializeTelegram() {
    if (!TG) return;
    try {
      TG.ready(); TG.expand();
      applyTheme(document.documentElement.dataset.theme||preferredTheme(),false);
      if (TG.enableClosingConfirmation) TG.enableClosingConfirmation();
    } catch (_) {}
  }

  function buildEngine() {
    if (!window.HyperFormula) throw new Error('HyperFormula не загрузилась. Проверьте HTTPS/интернет.');
    hf = HyperFormula.buildFromSheets(DATA.sheets, {licenseKey:'gpl-v3'});
    sheetId = hf.getSheetId('Господство');
    // В engine-data лежит заполненный контрольный пример. Он нужен только для self-test.
    // Пользовательский движок всегда стартует с ЧИСТЫХ ручных ячеек.
    for (const addr of DATA.manualCells) setCell(addr, null, isTextCell(addr)?'text':'number');
    // Затем восстанавливаем только то, что действительно вводил пользователь.
    for (const addr of DATA.manualCells) {
      const v=getStored(addr);
      if (v!==null) setCell(addr,v, isTextCell(addr)?'text':'number');
    }
  }

  function isTextCell(addr){
    if(/^AJ(6|24|42|61|80)$/.test(addr) || addr==='AG29') return true;
    return /^(T|V|X|Z|AB)(22|23|24|25)$/.test(addr);
  }

  function buildProfile() {
    const box=document.getElementById('profileFields');
    box.append(
      inputField('Текущее господство','S2',{help:'Посмотри текущее значение господства в игре. Вводи в M: например 274,86.'}),
      inputField('Количество смотрителей','S1',{step:'1',min:0,help:'Сколько смотрителей сейчас принадлежит аккаунту.'}),
      inputField('Кровь в запасе','AK1',{help:'Вводи в B (миллиардах): например 69,9.'}),
      inputField('Баллы совета','T14',{help:'Вводи в M: приложение сравнит запас со стоимостью Конклава.'})
    );

    const cc=document.getElementById('conclaveFields');
    for (const [name,current,plus] of conclave) {
      const card=document.createElement('div'); card.className='keeper-card';
      card.innerHTML=`<div class="keeper-head"><strong>${name}</strong><span class="keeper-summary" id="summary-${current}">—</span></div>`;
      const grid=document.createElement('div'); grid.className='grid two';
      grid.append(inputField('Текущий уровень',current,{step:'1',min:0}),inputField('Повысить на',plus,{step:'1',min:0}));
      card.appendChild(grid); cc.appendChild(card);
    }

    const inspiration=document.getElementById('inspirationFields');
    for(let r=4;r<=17;r++){
      const name1=cellStatic(`Z${r}`), type1=cellStatic(`Y${r}`);
      const name2=cellStatic(`AC${r}`), type2=cellStatic(`AF${r}`);
      if(name1){const row=document.createElement('div');row.className='grid two';row.append(inputField(`${name1} • ${type1||''} • текущий`,`AA${r}`),inputField(`${name1} • прирост`,`AB${r}`));inspiration.appendChild(row);}
      if(name2){const row=document.createElement('div');row.className='grid two';row.append(inputField(`${name2} • ${type2||''} • текущий`,`AD${r}`),inputField(`${name2} • прирост`,`AE${r}`));inspiration.appendChild(row);}
    }
  }

  function cellStatic(addr){
    const m=/^([A-Z]+)(\d+)$/.exec(addr); let col=0; for(const ch of m[1]) col=col*26+ch.charCodeAt(0)-64;
    return DATA.sheets['Господство'][Number(m[2])-1]?.[col-1] ?? null;
  }

  function buildKeepers() {
    const host=document.getElementById('keeperCards');
    for(const b of keeperBlocks){
      const card=document.createElement('article');card.className='keeper-card';card.dataset.block=b.n;
      const head=document.createElement('div');head.className='keeper-head';head.innerHTML=`<strong>Смотритель ${b.n}</strong><span class="keeper-summary" id="keeperSummary${b.n}">пустой слот</span>`;card.appendChild(head);
      const top=document.createElement('div');top.className='grid two';
      const keeper=inputField('Смотритель',`AJ${b.header}`,{select:true,options:DATA.keepers});
      const current=inputField('Текущий уровень',`AU${b.header}`,{step:'1',min:1,help:'Уровень смотрителя сейчас.'});
      covered.add(`AU${b.sub}`);
      const targetWrap=document.createElement('label');targetWrap.className='field';
      targetWrap.innerHTML='<span>Целевой уровень</span>';
      const target=document.createElement('input');target.type='number';target.inputMode='numeric';target.step='1';target.min='1';target.placeholder='например 124';target.dataset.targetBlock=String(b.n);
      const savedTarget=getVirtual(`keeper-target-${b.n}`); if(savedTarget!==null)target.value=savedTarget;
      const targetHelp=document.createElement('small');targetHelp.textContent='Вводи итоговый уровень, а не количество уровней. Приложение само вычислит прирост.';
      targetWrap.append(target,targetHelp);
      const exp=inputField('Очки таланта / опыт',`AO${b.exp}`,{step:'1',min:0,help:'Текущее число очков таланта у этого смотрителя из экрана роста таланта.'});
      const syncTarget=()=>{
        const cur=numFrom(current.querySelector('input')); const tar=numFrom(target);
        targetWrap.classList.remove('invalid');
        if(!target.value){ setCell(`AU${b.sub}`,null); setVirtual(`keeper-target-${b.n}`,null); refresh(); return; }
        if(tar<cur){ targetWrap.classList.add('invalid'); setCell(`AU${b.sub}`,0); } else setCell(`AU${b.sub}`,tar-cur);
        setVirtual(`keeper-target-${b.n}`,target.value); refresh();
      };
      target.addEventListener('input',syncTarget);
      current.querySelector('input').addEventListener('input',()=>{ if(target.value)syncTarget(); });
      top.append(keeper,current,targetWrap,exp);
      card.appendChild(top);
      const calc=document.createElement('div');calc.className='keeper-live';calc.id=`keeperLive${b.n}`;calc.innerHTML='<div><span>Итоговый уровень</span><strong>—</strong></div><div><span>Нужно крови</span><strong>—</strong></div><div><span>Прирост господства</span><strong>—</strong></div>';card.appendChild(calc);
      const hint=document.createElement('div');hint.className='notice subtle';hint.innerHTML='<strong>Как вводить таланты:</strong> «Текущий ур.» — уровень таланта в игре; «Рукописи» — сколько рукописей планируешь потратить; «100%» — гарантированные повышения таланта. Ожидаемые повышения от рукописей считаются по шансу звёздности.';card.appendChild(hint);
      const labels=document.createElement('div');labels.className='talent-labels v05';labels.innerHTML='<span>Талант</span><span>Текущий ур.</span><span>Рукописи</span><span>100%</span><span>Прирост</span><span>Итог</span>';card.appendChild(labels);
      const list=document.createElement('div');list.className='talent-table'; list.id=`talents${b.n}`;
      for(let r=b.talents[0];r<=b.talents[1];r++){
        const row=document.createElement('div');row.className='talent-row v05';
        const name=document.createElement('div');name.className='talent-name';name.id=`talentName-${r}`;name.textContent='—';
        const level=inputFieldMini(`AL${r}`), manuscript=inputFieldMini(`AM${r}`), guaranteed=inputFieldMini(`AN${r}`);
        const growth=document.createElement('strong');growth.className='talent-calc';growth.id=`talentGrowth-${r}`;growth.textContent='—';
        const projected=document.createElement('strong');projected.className='talent-calc';projected.id=`talentProjected-${r}`;projected.textContent='—';
        row.append(name,level,manuscript,guaranteed,growth,projected);list.appendChild(row);
      }
      card.appendChild(list);host.appendChild(card);
      if(target.value) syncTarget(); else setCell(`AU${b.sub}`,null);
      if(!target.value){ const curStored=getStored(`AU${b.header}`); if(curStored!==null) target.placeholder=`текущий ${curStored}`; }
    }
  }

  function inputFieldMini(addr){
    covered.add(addr);
    const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.step='1';input.min='0';input.dataset.cell=addr;input.dataset.kind='number';
    const stored=getStored(addr);if(stored!==null)input.value=stored;input.addEventListener('input',onInput);boundInputs.set(addr,input);return input;
  }

  function buildResources(){
    // Кровь / сборы: эти значения в старых версиях ошибочно оставались из контрольного примера.
    const blood=document.getElementById('bloodGatherFields');
    const bloodInputs=[
      ['Кровь за 1 сбор (M)','BD2','Сколько крови получаешь за один обычный сбор в замке.'],
      ['Карты сбора','BE5','Каждая карта = 1 обычный сбор.'],
      ['Жетон ×0,1','BE6','Количество жетонов с коэффициентом 0,1.'],
      ['Жетон ×0,5','BE7','Количество жетонов с коэффициентом 0,5.'],
      ['Жетон ×1','BE8','Количество жетонов с коэффициентом 1.'],
      ['Жетон ×2','BE9','Количество жетонов с коэффициентом 2.'],
      ['Жетон ×3','BE10','Количество жетонов с коэффициентом 3.'],
      ['Жетон ×5','BE11','Количество жетонов с коэффициентом 5.'],
      ['Жетон ×10','BE12','Количество жетонов с коэффициентом 10.'],
      ['Флакон крови ×0,1B','BE13','Фиксированный объём крови, не зависит от обычного сбора.'],
      ['Бутыль крови ×5B','BE14','Фиксированный объём крови, не зависит от обычного сбора.']
    ];
    for(const [label,addr,help] of bloodInputs) blood.appendChild(inputField(label,addr,{min:0,help}));

    const books=document.getElementById('booksFields');
    const headers=['V ×10 000','IV ×5 000','III ×1 000','II ×400','I ×100','×15 (100)','×15 (1 000)'];
    const h=document.createElement('div');h.className='book-row book-head';h.innerHTML='<span></span>'+headers.map(x=>`<span>${x}</span>`).join('');books.appendChild(h);
    const labels={31:'Универсальные «?»',32:'Сила • красные',33:'Харизма • фиолетовые',34:'Интеллект • зелёные',35:'Воля • синие'};
    const cols=['S','T','U','V','W','X','Y'];
    for(let r=31;r<=35;r++){
      const row=document.createElement('div');row.className='book-row';const lab=document.createElement('label');lab.textContent=labels[r];row.appendChild(lab);
      for(const c of cols){const inp=inputFieldMini(`${c}${r}`);row.appendChild(inp);} books.appendChild(row);
    }

    // Точное распределение книжного прироста по 5 смотрителям.
    const alloc=document.getElementById('bookAllocationFields');
    const attrs=[['Сила',22],['Харизма',23],['Интеллект',24],['Воля',25]];
    const valueCols=['S','U','W','Y','AA'], unitCols=['T','V','X','Z','AB'];
    for(const [attr,row] of attrs){
      const card=document.createElement('div');card.className='keeper-card allocation-card';
      card.innerHTML=`<div class="keeper-head"><strong>${attr}</strong><span class="keeper-summary">до 5 смотрителей</span></div>`;
      const grid=document.createElement('div');grid.className='allocation-grid';
      for(let i=0;i<5;i++){
        const pair=document.createElement('div');pair.className='allocation-pair';
        pair.appendChild(inputField(`Смотритель ${i+1}`,`${valueCols[i]}${row}`,{min:0,help:'Прибавка атрибута от книг.'}));
        covered.add(`${unitCols[i]}${row}`);
        const ul=document.createElement('label');ul.className='field unit-field';ul.innerHTML='<span>Ед.</span>';
        const sel=document.createElement('select');sel.dataset.cell=`${unitCols[i]}${row}`;sel.dataset.kind='text';
        for(const u of ['K','M']){const o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);}
        const stored=getStored(`${unitCols[i]}${row}`); sel.value=stored||'K';
        if(stored===null) setCell(`${unitCols[i]}${row}`,'K','text');
        sel.addEventListener('change',onInput);ul.appendChild(sel);boundInputs.set(`${unitCols[i]}${row}`,sel);pair.appendChild(ul);
        grid.appendChild(pair);
      }
      card.appendChild(grid);alloc.appendChild(card);
    }

    const tasting=document.getElementById('tastingFields');
    [['Знак винодельни ×250','S42'],['Знак винодельни I ×500','S43'],['Знак винодельни II ×1 200','S44'],['Знак винодельни III ×6 000','S45']].forEach(([l,a])=>tasting.appendChild(inputField(l,a,{step:'1',min:0})));
    const partners=document.getElementById('partnerFields');
    for(let r=40;r<=67;r++) partners.appendChild(inputField(`Партнёр ${r-39}: доверие`,`Y${r}`,{min:0,help:'Вводи текущее доверие только тех партнёров, которых учитываешь.'}));
    const other=document.getElementById('otherResourceFields');
    const labelsOther={51:'Плазма ×200',52:'Вито ×400',54:'Наследники рубин/бронза ×75 000',55:'Наследники золото/платина ×17 000',56:'Наследники серебро ×7 500'};
    for(const r of [51,52,54,55,56]) other.appendChild(inputField(labelsOther[r],`S${r}`,{min:0}));
    const trust=document.createElement('div');trust.className='notice subtle';trust.textContent='Доверие партнёров считается автоматически из значений выше по коэффициенту исходной таблицы.';
    other.appendChild(trust);
  }

  function buildOthers(){
    const host=document.getElementById('otherKeepersFields');
    for(let r=30;r<=67;r++){
      const row=document.createElement('div');row.className='other-keeper-row';const lab=document.createElement('div');lab.innerHTML=`<strong>Смотритель ${r-29}</strong><small>не дублируй тех, кто уже в основных слотах</small>`;
      const a=inputField(`Уровень`,`AC${r}`,{step:'1',min:0});const b=inputField('Очки талантов',`AD${r}`,{step:'1',min:0});row.append(lab,a,b);host.appendChild(row);
    }
    // Everything not represented elsewhere remains editable here.
    const adv=document.getElementById('advancedFields');
    for(const addr of DATA.manualCells){
      if(covered.has(addr)) continue;
      adv.appendChild(inputField(`Ячейка ${addr}`,addr,{kind:isTextCell(addr)?'text':'number',type:isTextCell(addr)?'text':'number'}));
    }
  }

  function restoreUIToEngine(){
    for(const [addr,el] of boundInputs){
      if(el.value!=='') setCell(addr,el.value,el.dataset.kind);
    }
  }

  function toM(value,unit){
    const n=Number(value||0); if(!Number.isFinite(n))return 0;
    if(unit==='B') return n*1000;
    if(unit==='M') return n;
    if(unit==='K') return n/1000;
    return n/1000000;
  }
  function refresh(){
    if(!hf)return;
    const hasBase = getStored('S2') !== null && getStored('S2') !== '';
    const selectedKeepers=keeperBlocks.filter(b=>cell(`AJ${b.header}`)).length;
    const readiness=document.getElementById('calcReadiness');
    if(readiness){
      if(!hasBase) readiness.innerHTML='<strong>Шаг 1:</strong> введи текущее господство. Смотрителей можно заполнять параллельно — их расчёты появятся прямо в карточках.';
      else readiness.innerHTML=`<strong>Расчёт активен.</strong> Текущее господство введено. Заполнено смотрителей: ${selectedKeepers}/5. Все изменения пересчитываются сразу.`;
    }
    const resultBox=document.querySelector('.result-hero');
    if(resultBox) resultBox.classList.toggle('empty-result',!hasBase);
    document.getElementById('finalDominion').textContent=hasBase?fmt(cell('T73'),cell('U73')||''):'—';
    document.getElementById('gainDominion').textContent=hasBase?fmt(cell('T72'),cell('U72')||''):'Введите текущее господство';
    document.getElementById('bloodStatus').textContent=hasBase?fmt(cell('AW1')):'—';
    document.getElementById('councilNeeded').textContent=fmt(cell('T15'),cell('U15')||'M');
    document.getElementById('councilStatus').textContent=fmt(cell('S17'));
    document.getElementById('auditGain').textContent=hasBase?fmt(cell('T72'),cell('U72')||''):'—';
    document.getElementById('auditFinal').textContent=hasBase?fmt(cell('T73'),cell('U73')||''):'—';
    document.getElementById('auditBloodNeed').textContent=fmt(cell('AS1'),cell('AT1')||'B');
    document.getElementById('auditBloodHave').textContent=fmt(cell('AO1'),cell('AT1')||'B');
    for(const [name,current,plus,out,bonus] of conclave){
      const el=document.getElementById(`summary-${current}`);if(el)el.textContent=`+${fmt(cell(out))} • книги +${fmt(cell(bonus)*100,'%')}`;
    }
    for(const b of keeperBlocks){
      const selected=cell(`AJ${b.header}`);
      const summary=document.getElementById(`keeperSummary${b.n}`);
      const totalRow=b.header+12, bloodRow=b.header+3;
      const targetLevel=cell(`AW${b.sub}`);
      const keeperGain=cell(`AW${totalRow}`);
      const bloodNeed=cell(`AU${bloodRow}`);
      if(summary) summary.textContent=selected?`${selected} • ${fmt(targetLevel)} ур. • +${fmt(keeperGain)}`:'пустой слот';
      const live=document.getElementById(`keeperLive${b.n}`);
      if(live){const vals=live.querySelectorAll('strong'); if(vals[0])vals[0].textContent=selected?fmt(targetLevel):'—'; if(vals[1])vals[1].textContent=selected?fmt(bloodNeed,'B'):'—'; if(vals[2])vals[2].textContent=selected?fmt(keeperGain):'—';}
      for(let r=b.talents[0];r<=b.talents[1];r++){
        const n=document.getElementById(`talentName-${r}`);if(n){const talent=cell(`AJ${r}`),mult=cell(`AK${r}`);n.textContent=talent?`${talent} ×${mult||1}`:'—';}
        const g=document.getElementById(`talentGrowth-${r}`); if(g)g.textContent=cell(`AJ${r}`)?fmt(cell(`AP${r}`)):'—';
        const pr=document.getElementById(`talentProjected-${r}`); if(pr)pr.textContent=cell(`AJ${r}`)?fmt(cell(`AS${r}`)):'—';
      }
    }

    // Детальная раскладка общего прироста — ровно те компоненты, которые входят в T72.
    const conclaveM=toM(cell('U12'),cell('W12'));
    const booksM=toM(cell('Z37'),'raw');
    const tastingM=toM(cell('T46'),'raw');
    const otherM=toM(cell('U57'),'raw');
    const keeperM=['18','36','54','73','92','112','132','152'].reduce((s,r)=>s+toM(cell('AW'+r),cell('AX'+r)),0);
    let othersM=0; for(let r=30;r<=68;r++) othersM+=toM(cell('AF'+r),cell('AG'+r));
    const put=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=hasBase?fmt(v,'M'):'—';};
    put('bdConclave',conclaveM);put('bdBooks',booksM);put('bdTasting',tastingM);put('bdOther',otherM);put('bdKeepers',keeperM);put('bdOthers',othersM);
    const bg=document.getElementById('booksGain'); if(bg)bg.textContent=fmt(booksM,'M');

    const bloodNow=Number(cell('AK1')||0), bloodTotal=Number(cell('AO1')||0), bloodNeed=Number(cell('AS1')||0), bloodExtra=Math.max(0,bloodTotal-bloodNow), balance=bloodTotal-bloodNeed;
    const setText=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
    setText('bloodNow',fmt(bloodNow,'B'));
    setText('bloodExtra',fmt(bloodExtra,'B'));
    setText('bloodTotal',fmt(bloodTotal,'B'));
    setText('bloodNeed',fmt(bloodNeed,'B'));
    setText('bloodBalance',(balance>=0?'+':'')+fmt(balance,'B'));
  }

  // ---------- Дополнительные калькуляторы из загруженных Excel ----------
  const TALENT_THRESHOLDS={6:1200,5:1000,4:800,3:600,2:400,1:200};
  let talentKeeperCounter=0;
  let affinityMode='closeness';
  const AFFINITY_ITEMS={
    closeness:[
      ['Обычный подарок',1,1],['Большой подарок',2,2],['Роскошный подарок',5,5],
      ['Чертова монета',1,1],['Бронзовая чертова монета',2,2],['Серебряная чертова монета',5,5],['Золотая чертова монета',25,25],
      ['Сумочка близости',1,4],['Мешок близости',5,8],['Шкатулка близости',4,50]
    ],
    attraction:[
      ['Алый букет',1,1],['Синий букет',2,2],['Лиловый букет',5,5],
      ['Бирюзовая записка',1,1],['Индиговая записка',2,2],['Багровая записка',5,5],['Потальная записка',25,25],
      ['Пиала влечения',1,4],['Бутыль влечения',5,8],['Шкатулка влечения',4,50]
    ]
  };
  const GATHER_ITEMS=[['Жетон 1',0.1],['Жетон 2',0.5],['Жетон 3',1],['Жетон 4',2],['Жетон 5',3],['Жетон 6',5],['Жетон 7',10],['Карта сбора',1]];

  function numFrom(el){
    if(!el)return 0;
    const n=Number(String(el.value||'').replace(',','.').replace(/\s/g,''));
    return Number.isFinite(n)&&n>=0?n:0;
  }
  function toolInput(label,id){
    const lab=document.createElement('label');lab.className='field';
    const sp=document.createElement('span');sp.textContent=label;
    const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='any';inp.inputMode='decimal';inp.placeholder='0';inp.id=id;
    lab.append(sp,inp);return lab;
  }
  function addTalentKeeperRow(name=''){
    talentKeeperCounter++;
    const row=document.createElement('div');row.className='talent-tool-row';row.dataset.row=String(talentKeeperCounter);
    const nameLab=document.createElement('label');nameLab.className='field';nameLab.innerHTML='<span>Смотритель</span>';
    const nameInput=document.createElement('input');nameInput.type='text';nameInput.placeholder='Имя';nameInput.value=name;nameLab.appendChild(nameInput);
    const multLab=document.createElement('label');multLab.className='field';multLab.innerHTML='<span>Высшая ×</span>';
    const sel=document.createElement('select');
    for(const m of [6,5,4,3,2,1]){const o=document.createElement('option');o.value=m;o.textContent=`×${m} / ${TALENT_THRESHOLDS[m]}`;sel.appendChild(o);} multLab.appendChild(sel);
    const ptsLab=document.createElement('label');ptsLab.className='field';ptsLab.innerHTML='<span>Очки у смотрителя</span>';
    const pts=document.createElement('input');pts.type='number';pts.min='0';pts.step='any';pts.inputMode='decimal';pts.placeholder='0';ptsLab.appendChild(pts);
    const out=document.createElement('div');out.className='talent-tool-gain';out.innerHTML='<span>Рейтинг</span><strong>0</strong>';
    const del=document.createElement('button');del.type='button';del.className='row-delete';del.textContent='×';del.title='Удалить';
    row.append(nameLab,multLab,ptsLab,out,del);
    row.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',refreshTalentTool));
    del.addEventListener('click',()=>{row.remove();refreshTalentTool();});
    document.getElementById('talentKeeperRows').appendChild(row);refreshTalentTool();
  }
  function refreshTalentTool(){
    let keeperTotal=0;
    document.querySelectorAll('.talent-tool-row').forEach(row=>{
      const sel=row.querySelector('select'),pts=row.querySelector('input[type="number"]');
      const m=Number(sel.value),threshold=TALENT_THRESHOLDS[m],gain=Math.floor(numFrom(pts)/threshold)*m;
      keeperTotal+=gain;row.querySelector('.talent-tool-gain strong').textContent=fmt(gain);
      const rem=numFrom(pts)%threshold; const need=rem===0?0:threshold-rem;
      row.querySelector('.talent-tool-gain span').textContent=need?`Рейтинг • до след. ${fmt(need)} оч.`:'Рейтинг • порог закрыт';
    });
    const scrollPts=numFrom(document.getElementById('talScrollHigh'))*200+numFrom(document.getElementById('talScrollMid'))*100+numFrom(document.getElementById('talScrollLow'))*50;
    const manuscriptTotal=['manStrength','manCharisma','manIntellect','manWill'].reduce((a,id)=>a+numFrom(document.getElementById(id)),0);
    document.getElementById('talScrollPoints').textContent=fmt(scrollPts);
    document.getElementById('talScrollGain').textContent='Это запас очков для распределения по смотрителям; в рейтинг он попадёт после распределения.';
    document.getElementById('talentTotal').textContent=fmt(keeperTotal+manuscriptTotal);
    document.getElementById('talentBreakdown').textContent=`По введённым очкам смотрителей ${fmt(keeperTotal)} • рукописи 100% ${fmt(manuscriptTotal)} • нераспределённые очки свитков ${fmt(scrollPts)}`;
  }

  function renderAffinityInputs(){
    const host=document.getElementById('affinityInputs');host.innerHTML='';
    AFFINITY_ITEMS[affinityMode].forEach((item,i)=>{const el=toolInput(`${item[0]} ×${item[1]}–×${item[2]}`,`aff-${i}`);host.appendChild(el);el.querySelector('input').addEventListener('input',refreshAffinityTool);});
    refreshAffinityTool();
  }
  function refreshAffinityTool(){
    let min=0,max=0;
    AFFINITY_ITEMS[affinityMode].forEach((item,i)=>{const q=numFrom(document.getElementById(`aff-${i}`));min+=q*item[1];max+=q*item[2];});
    document.getElementById('affinityMin').textContent=fmt(min);document.getElementById('affinityMax').textContent=fmt(max);document.getElementById('affinityAvg').textContent=fmt((min+max)/2);
  }
  function renderGatherInputs(){
    const host=document.getElementById('gatherInputs');
    GATHER_ITEMS.forEach((item,i)=>{const el=toolInput(`${item[0]} ×${item[1]}`,`gather-${i}`);host.appendChild(el);el.querySelector('input').addEventListener('input',refreshGatherTool);});
  }
  function refreshGatherTool(){
    const base=numFrom(document.getElementById('gatherBase'));let total=0;
    GATHER_ITEMS.forEach((item,i)=>total+=numFrom(document.getElementById(`gather-${i}`))*base*item[1]);
    document.getElementById('gatherTotal').textContent=fmt(total);
  }
  function buildTools(){
    addTalentKeeperRow();addTalentKeeperRow();addTalentKeeperRow();
    ['talScrollHigh','talScrollMid','talScrollLow','manStrength','manCharisma','manIntellect','manWill'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshTalentTool));
    document.getElementById('talScrollMultiplier')?.addEventListener('change',refreshTalentTool);
    document.getElementById('addTalentKeeper')?.addEventListener('click',()=>addTalentKeeperRow());
    document.querySelectorAll('[data-affinity-mode]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-affinity-mode]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');affinityMode=btn.dataset.affinityMode;renderAffinityInputs();}));
    renderAffinityInputs();renderGatherInputs();document.getElementById('gatherBase')?.addEventListener('input',refreshGatherTool);refreshGatherTool();refreshTalentTool();
  }

  function resetAll(){
    if(!confirm('Очистить все введённые значения?'))return;
    clearStorage();
    for(const [addr,el] of boundInputs){el.value='';setCell(addr,null,el.dataset.kind);}
    refresh();
  }

  function runSelfTest(){
    const log=document.getElementById('testLog');
    log.textContent='Запуск контрольного примера «Надя 495»…\n';
    try{
      const test=HyperFormula.buildFromSheets(DATA.sheets,{licenseKey:'gpl-v3'});
      for(const [addr,value] of Object.entries(DATA.fixture)) setCell(addr,value,isTextCell(addr)?'text':'number',test);
      const got={}; for(const k of Object.keys(DATA.expected))got[k]=cell(k,test);
      const lines=[];let ok=true;
      for(const [k,expected] of Object.entries(DATA.expected)){
        const actual=got[k];
        const pass=typeof expected==='number'?Math.abs(Number(actual)-expected)<1e-6:String(actual)===String(expected);
        ok=ok&&pass;lines.push(`${pass?'✅':'❌'} ${k}: ${actual} | эталон ${expected}`);
      }
      lines.push(ok?'\n✅ Контрольный пример совпал с исходной книгой.':'\n❌ Есть расхождение. Публикацию лучше остановить и проверить формулы.');
      log.textContent=lines.join('\n');
      setBanner(ok?'Самотест пройден: движок совпал с эталонным расчётом.':'Самотест обнаружил расхождение.',ok?'ok':'bad');
      test.destroy();
    }catch(e){log.textContent+='\n❌ '+e.message;setBanner('Ошибка самотеста: '+e.message,'bad');}
  }

  function setBanner(text,type){const b=document.getElementById('engineBanner');b.textContent=text;b.className='banner '+type;}

  function activateTab(name){
    const btn=document.querySelector(`.tab[data-tab="${name}"]`); if(!btn)return;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');document.getElementById('tab-'+name)?.classList.add('active');
  }
  function wireTabs(){
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      if(TG?.HapticFeedback)try{TG.HapticFeedback.selectionChanged();}catch(_){}
    }));
    document.querySelectorAll('[data-go-tab]').forEach(btn=>btn.addEventListener('click',()=>activateTab(btn.dataset.goTab)));
  }

  function boot(){
    migrateV10();
    applyTheme(preferredTheme(),false);
    initializeTelegram(); wireTabs();
    try{
      buildEngine();
      buildProfile(); buildKeepers(); buildResources(); buildOthers(); buildTools();
      restoreUIToEngine(); refresh();
      document.getElementById('runSelfTest').addEventListener('click',runSelfTest);
      document.getElementById('selfTestBtn').addEventListener('click',()=>{document.querySelector('[data-tab="audit"]').click();runSelfTest();});
      document.getElementById('resetBtn').addEventListener('click',resetAll);
      document.getElementById('themeBtn').addEventListener('click',toggleTheme);
      document.getElementById('toggleExtraKeepers')?.addEventListener('click',()=>{
        alert('В точной формуле исходной таблицы пользовательский мастер рассчитан на 5 основных прокачиваемых смотрителей. Остальных добавляй во вкладке «Остальные» — там они учитываются отдельно и не дублируются.');
      });
      const coverageOk=renderExcelCoverage();
      setBanner(coverageOk?'Расчётное ядро готово. Ввод связан с формулами Excel; результаты пересчитываются в реальном времени.':'Внимание: проверка комплектации Excel-калькулятора не пройдена.',coverageOk?'ok':'bad');
      setTimeout(runSelfTest,120);
    }catch(e){setBanner('Не удалось запустить приложение: '+e.message,'bad');console.error(e);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
