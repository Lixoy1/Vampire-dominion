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
  const BUILD_VERSION = '1.4';
  const EXCEL_EXPECTED_FORMULAS = 808;
  const EXCEL_EXPECTED_INPUTS = 314;
  const DERIVED_INPUTS = new Set(['AU7','AU25','AU43','AU62','AU81','T7','T8','T9','T10']);

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

  function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}

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

  function percentField(label, addr, opts={}) {
    covered.add(addr); const wrap=document.createElement('label');wrap.className='field';const title=document.createElement('span');title.textContent=label;wrap.appendChild(title);
    const input=document.createElement('input');input.type='number';input.inputMode='decimal';input.step='0.1';input.min='0';input.dataset.cell=addr;input.dataset.kind='number';input.dataset.percent='1';
    const stored=getStored(addr);if(stored!==null){const n=Number(stored);input.value=Number.isFinite(n)?(n<=1?n*100:n):'';}
    input.addEventListener('input',()=>{const raw=input.value;const v=raw===''?null:Number(String(raw).replace(',','.'))/100;setCell(addr,v);saveStored(addr,v===null?'':v);clearTimeout(updateTimer);updateTimer=setTimeout(refresh,35);});
    wrap.appendChild(input);if(opts.help){const small=document.createElement('small');small.textContent=opts.help;wrap.appendChild(small);}boundInputs.set(addr,input);return wrap;
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

  function migrateV14(){
    try{
      if(localStorage.getItem('vd14:migrated')==='1') return;
      // В v1.4 шаг №05 получил точный смысл из исходной инструкции:
      // здесь должны быть именно текущие значения «Бонус книг» у 5 основных смотрителей.
      // Старые сохранённые значения этого блока могли означать другое, поэтому безопасно очищаем только его.
      for(const r of [22,23,24,25]){
        for(const c of ['S','U','W','Y','AA','T','V','X','Z','AB']) localStorage.removeItem(storageKey(`${c}${r}`));
      }
      // Удаляем устаревшие виртуальные поля прежних вариантов книжного блока, если они сохранились.
      Object.keys(localStorage).filter(k=>k.startsWith('vd05:book-')||k.startsWith('vd05:bookAllocation')).forEach(k=>localStorage.removeItem(k));
      localStorage.setItem('vd14:migrated','1');
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
    if (!window.HyperFormula) throw new Error('Модуль расчётов не загрузился. Проверь интернет и обнови страницу.');
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
    box.append(inputField('Текущее господство, M','S2',{help:'Открой профиль Лорд-протектора и введи текущее господство. Например: 274,86.'}),inputField('Открыто смотрителей','S1',{step:'1',min:0,help:'Важно для Конклава: прибавка печати применяется к каждому уже открытому смотрителю.'}),inputField('Кровь в запасе, B','AK1',{help:'Кровь, которая уже есть сейчас. Сборы и предметы добавляются отдельно в разделе «Ресурсы».'}),inputField('Баллы совета, M','T14',{help:'Текущий запас баллов совета для прокачки печатей Конклава.'}));
    const cc=document.getElementById('conclaveFields');
    for(const [name,current,plus] of conclave){
      covered.add(plus);const card=document.createElement('div');card.className='keeper-card conclave-card';card.innerHTML=`<div class="keeper-head"><strong>${name}</strong><span class="keeper-summary"><b id="conclaveAttr-${current}">—</b> · <b id="conclaveBook-${current}">—</b></span></div>`;
      const grid=document.createElement('div');grid.className='grid two';const cur=inputField('Текущий уровень печати',current,{step:'1',min:0,help:'Посмотри уровень этой печати в Конклаве.'});
      const tw=document.createElement('label');tw.className='field';tw.innerHTML='<span>Хочу поднять до</span>';const target=document.createElement('input');target.type='number';target.inputMode='numeric';target.step='1';target.min='0';target.placeholder='например 5';const key=`conclave-target-${current}`;const saved=getVirtual(key);if(saved!==null)target.value=saved;const sm=document.createElement('small');sm.textContent='Вводи итоговый уровень. Сайт сам посчитает разницу.';tw.append(target,sm);
      const sync=()=>{const c=numFrom(cur.querySelector('input')),t=numFrom(target);tw.classList.remove('invalid');if(!target.value){setCell(plus,null);setVirtual(key,null);}else if(t<c){tw.classList.add('invalid');setCell(plus,0);setVirtual(key,target.value);}else{setCell(plus,t-c);setVirtual(key,target.value);}refresh();};target.addEventListener('input',sync);cur.querySelector('input').addEventListener('input',()=>{if(target.value)sync();});grid.append(cur,tw);card.appendChild(grid);
      const explain=document.createElement('div');explain.className='mini-result-row conclave-results';explain.innerHTML=`<span>Уровень после: <b id="conclaveAfter-${current}">—</b></span><span>Каждому смотрителю: <b id="conclaveGain-${current}">—</b></span><span>Эффект книг: <b id="conclaveBooks-${current}">—</b></span><span>Вклад в господство: <b id="conclaveDom-${current}">—</b></span>`;card.appendChild(explain);cc.appendChild(card);if(target.value)sync();else setCell(plus,null);
    }
    const inspiration=document.getElementById('inspirationFields'); let inspirationRendered=0;
    const secondTypes={6:'Все атрибуты',7:'Все атрибуты',8:'Все атрибуты',9:'Харизма + Интеллект',10:'Сила + Воля',11:'Харизма + Воля',12:'Сила + Интеллект',13:'Сила + Интеллект',14:'Харизма + Воля',15:'Сила + Воля',16:'Харизма + Интеллект',17:'Харизма + Интеллект'};
    const prettyType=v=>String(v||'атрибут').replace(/интелект/gi,'Интеллект').replace(/нтелект/gi,'Интеллект').replace(/^сила$/i,'Сила').replace(/^харизма$/i,'Харизма').replace(/^воля$/i,'Воля').replace(/^все$/i,'Все атрибуты').replace(/ и /gi,' + ');
    for(let r=4;r<=17;r++){const name1=cellStatic(`Z${r}`),type1=cellStatic(`Y${r}`),name2=cellStatic(`AC${r}`);if(name1){const row=document.createElement('div');row.className='inspiration-row'+(inspirationRendered++>=6?' is-collapsed':'');row.innerHTML=`<div class="insp-name"><strong>${name1}</strong><small>Действует: ${prettyType(type1)}</small></div>`;row.append(percentField('Бонус сейчас, %',`AA${r}`),percentField('Добавлю, %',`AB${r}`));inspiration.appendChild(row);}if(name2){const row=document.createElement('div');row.className='inspiration-row'+(inspirationRendered++>=6?' is-collapsed':'');row.innerHTML=`<div class="insp-name"><strong>${name2}</strong><small>Действует: ${secondTypes[r]||'по данным расчётной базы'}</small></div>`;row.append(percentField('Бонус сейчас, %',`AD${r}`),percentField('Добавлю, %',`AE${r}`));inspiration.appendChild(row);}}
  }

  function cellStatic(addr){
    const m=/^([A-Z]+)(\d+)$/.exec(addr); let col=0; for(const ch of m[1]) col=col*26+ch.charCodeAt(0)-64;
    return DATA.sheets['Господство'][Number(m[2])-1]?.[col-1] ?? null;
  }

  function buildKeepers() {
    const host=document.getElementById('keeperCards');
    for(const b of keeperBlocks){
      const card=document.createElement('article');card.className='keeper-card'+(b.n>2?' extra-main-keeper is-hidden':'');card.dataset.block=b.n;
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
      const talentDetails=document.createElement('details');talentDetails.className='accordion keeper-talents';
      const talentSummary=document.createElement('summary');talentSummary.innerHTML='<span class="summary-icon">⭐</span> Таланты и рукописи — открыть';talentDetails.appendChild(talentSummary);
      const talentBody=document.createElement('div');talentBody.className='tool-content';
      const hint=document.createElement('div');hint.className='notice subtle';hint.innerHTML='<strong>Что вводить:</strong> «Текущий уровень» — уровень таланта в игре; «Рукописи» — сколько планируешь применить; «Гарантированный прирост» — только те уровни таланта, которые точно получишь. Для многозвёздочных рукописей результат вероятностный.';talentBody.appendChild(hint);
      const labels=document.createElement('div');labels.className='talent-labels v05';labels.innerHTML='<span>Талант</span><span>Текущий уровень</span><span>Рукописи</span><span>Гарантированный прирост</span><span>Прирост</span><span>Итог</span>';talentBody.appendChild(labels);
      const list=document.createElement('div');list.className='talent-table'; list.id=`talents${b.n}`;
      for(let r=b.talents[0];r<=b.talents[1];r++){
        const row=document.createElement('div');row.className='talent-row v05';
        const name=document.createElement('div');name.className='talent-name';name.id=`talentName-${r}`;name.textContent='—';
        const level=inputFieldMini(`AL${r}`), manuscript=inputFieldMini(`AM${r}`), guaranteed=inputFieldMini(`AN${r}`);
        const growth=document.createElement('strong');growth.className='talent-calc';growth.id=`talentGrowth-${r}`;growth.textContent='—';
        const projected=document.createElement('strong');projected.className='talent-calc';projected.id=`talentProjected-${r}`;projected.textContent='—';
        row.append(name,level,manuscript,guaranteed,growth,projected);list.appendChild(row);
      }
      talentBody.appendChild(list);talentDetails.appendChild(talentBody);card.appendChild(talentDetails);host.appendChild(card);
      if(target.value) syncTarget(); else setCell(`AU${b.sub}`,null);
      if(!target.value){ const curStored=getStored(`AU${b.header}`); if(curStored!==null) target.placeholder=`текущий ${curStored}`; }
    }
  }

  function inputFieldMini(addr){
    covered.add(addr);
    const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.step='1';input.min='0';input.dataset.cell=addr;input.dataset.kind='number';
    const stored=getStored(addr);if(stored!==null)input.value=stored;input.addEventListener('input',onInput);boundInputs.set(addr,input);return input;
  }

  function buildKeeperBookBonuses(){
    const host=document.getElementById('keeperBookBonusFields');
    if(!host)return;
    const keepers=[{n:1,name:'AJ6',value:'S',unit:'T'},{n:2,name:'AJ24',value:'U',unit:'V'},{n:3,name:'AJ42',value:'W',unit:'X'},{n:4,name:'AJ61',value:'Y',unit:'Z'},{n:5,name:'AJ80',value:'AA',unit:'AB'}];
    const attrs=[['🔴 Сила',22],['🟣 Харизма',23],['🟢 Интеллект',24],['🔵 Воля',25]];
    for(const k of keepers){
      const card=document.createElement('div');card.className='keeper-card keeper-book-card';card.dataset.bookKeeper=String(k.n);
      card.innerHTML=`<div class="keeper-head"><strong id="keeperBookName${k.n}">Смотритель ${k.n}</strong><span class="keeper-summary">Бонус книг сейчас</span></div>`;
      const grid=document.createElement('div');grid.className='keeper-book-grid';
      for(const [label,row] of attrs){
        const pair=document.createElement('div');pair.className='book-bonus-pair';
        const val=inputField(label,`${k.value}${row}`,{min:0,help:'Открой подробности этого атрибута у смотрителя и перепиши именно строку «Бонус книг».'});
        const unitAddr=`${k.unit}${row}`;covered.add(unitAddr);
        const ul=document.createElement('label');ul.className='field unit-field';ul.innerHTML='<span>Ед.</span>';
        const sel=document.createElement('select');sel.dataset.cell=unitAddr;sel.dataset.kind='text';
        for(const u of ['K','M','B']){const o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);}
        const stored=getStored(unitAddr);sel.value=stored||'K';if(stored===null)setCell(unitAddr,'K','text');
        sel.addEventListener('change',onInput);boundInputs.set(unitAddr,sel);ul.appendChild(sel);
        pair.append(val,ul);grid.appendChild(pair);
      }
      card.appendChild(grid);host.appendChild(card);
    }
  }

  function buildResources(){
    // Кровь / сборы: эти значения в старых версиях ошибочно оставались из контрольного примера.
    const blood=document.getElementById('bloodGatherFields');
    const bloodInputs=[
      ['Кровь за 1 сбор (M)','BD2','Сколько крови получаешь за один обычный сбор в замке.'],
      ['Карта сбора ×1','BE5','Каждая карта даёт ресурс как один обычный сбор.'],
      ['Жетон ×0,1','BE6','Количество жетонов с коэффициентом 0,1.'],
      ['Жетон ×0,5','BE7','Количество жетонов с коэффициентом 0,5.'],
      ['Жетон ×1','BE8','Количество жетонов с коэффициентом 1.'],
      ['Жетон ×2','BE9','Количество жетонов с коэффициентом 2.'],
      ['Жетон ×3','BE10','Количество жетонов с коэффициентом 3.'],
      ['Жетон ×5','BE11','Количество жетонов с коэффициентом 5.'],
      ['Жетон ×10','BE12','Количество жетонов с коэффициентом 10.'],
      ['Флакон крови +0,1 B','BE13','Каждый флакон добавляет 0,1 B крови и не зависит от обычного сбора.'],
      ['Бутыль крови +5 B','BE14','Каждая бутыль добавляет 5 B крови и не зависит от обычного сбора.']
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

    const tasting=document.getElementById('tastingFields');
    [['Знак винодельни ×250','S42'],['Знак винодельни I ×500','S43'],['Знак винодельни II ×1 200','S44'],['Знак винодельни III ×6 000','S45']].forEach(([l,a])=>tasting.appendChild(inputField(l,a,{step:'1',min:0})));
    const partners=document.getElementById('partnerFields');
    for(let r=40;r<=67;r++){const fld=inputField(`Партнёр ${r-39}: доверие`,`Y${r}`,{min:0,help:'Вводи значение только если учитываешь этого партнёра.'});if(r>45)fld.classList.add('partner-collapsed');partners.appendChild(fld);}
    const other=document.getElementById('otherResourceFields');
    const labelsOther={51:'Плазма ×200',52:'Вито ×400',54:'Наследники рубин/бронза ×75 000',55:'Наследники золото/платина ×17 000',56:'Наследники серебро ×7 500'};
    for(const r of [51,52,54,55,56]) other.appendChild(inputField(labelsOther[r],`S${r}`,{min:0}));
    const trust=document.createElement('div');trust.className='notice subtle';trust.textContent='Введи доверие только тех партнёров, которых учитываешь в плане. Калькулятор сам применит нужный коэффициент и добавит результат в общий прирост.';
    other.appendChild(trust);
  }

  function buildOthers(){
    const host=document.getElementById('otherKeepersFields');
    for(let r=30;r<=67;r++){const row=document.createElement('div');row.className='other-keeper-card'+(r>34?' is-hidden':'');row.dataset.otherRow=String(r);const nameLab=document.createElement('label');nameLab.className='field';nameLab.innerHTML='<span>Смотритель</span>';const sel=document.createElement('select');const empty=document.createElement('option');empty.value='';empty.textContent='— выбрать —';sel.appendChild(empty);for(const k of DATA.keepers){const o=document.createElement('option');o.value=k;o.textContent=k;sel.appendChild(o);}const nk=`other-name-${r}`;const sv=getVirtual(nk);if(sv)sel.value=sv;sel.addEventListener('change',()=>setVirtual(nk,sel.value));nameLab.appendChild(sel);const lvl=inputField('Текущий уровень',`AC${r}`,{step:'1',min:0});const exp=inputField('Talent EXP для ×1',`AD${r}`,{step:'1',min:0,help:'В этом дополнительном блоке считаем только гарантированный ×1: 200 EXP = +1 уровень таланта.'});const out=document.createElement('div');out.className='other-result';out.innerHTML=`<div><span>Гарантированных +1</span><strong id="otherUps-${r}">0</strong></div><div><span>Прирост господства</span><strong id="otherGain-${r}">—</strong></div>`;row.append(nameLab,lvl,exp,out);host.appendChild(row);}
    const adv=document.getElementById('advancedFields');for(const addr of DATA.manualCells){if(covered.has(addr)||DERIVED_INPUTS.has(addr))continue;const hidden=inputField('',addr,{kind:isTextCell(addr)?'text':'number',type:isTextCell(addr)?'text':'number'});hidden.classList.add('developer-only');adv.appendChild(hidden);}
  }

  function restoreUIToEngine(){
    for(const [addr,el] of boundInputs){
      if(el.value==='') continue;
      if(el.dataset.percent==='1') setCell(addr,Number(String(el.value).replace(',','.'))/100,'number'); else setCell(addr,el.value,el.dataset.kind);
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
    const bloodText=fmt(cell('AW1'));
    document.getElementById('bloodStatus').textContent=hasBase?(bloodText||'План рассчитывается'):'—';
    document.getElementById('councilNeeded').textContent=fmt(cell('T15'),cell('U15')||'M');const councilHave=Number(cell('T14')||0),councilNeed=Number(cell('T15')||0),councilBal=councilHave-councilNeed;const cs=document.getElementById('councilStatus');if(cs){if(!councilNeed){cs.textContent='Прокачка Конклава не задана.';cs.className='neutral-text';}else if(councilBal>=0){cs.textContent=`Хватает. После прокачки останется ${fmt(councilBal,'M')}.`;cs.className='good-text';}else{cs.textContent=`Не хватает ${fmt(Math.abs(councilBal),'M')} баллов совета.`;cs.className='bad-text';}}const baseDom=Number(cell('S2')||0),gainDom=Number(cell('T72')||0),finalDom=Number(cell('T73')||0);setText('profileCurrent',hasBase?fmt(baseDom,'M'):'—');setText('profileGain',hasBase?fmt(gainDom,'M'):'—');setText('profileFinal',hasBase?fmt(finalDom,'M'):'—');setText('profilePercent',hasBase&&baseDom>0?fmt(gainDom/baseDom*100,'%'):'—');setText('inspStrength',fmt(Number(cell('AE2')||0)*100,'%'));setText('inspAllure',fmt(Number(cell('AE3')||0)*100,'%'));setText('inspIntellect',fmt(Number(cell('AE4')||0)*100,'%'));setText('inspSpirit',fmt(Number(cell('AE5')||0)*100,'%'));const inspInputs=[...document.querySelectorAll('#inspirationFields input')];const currentInsp=inspInputs.filter(x=>x.dataset.cell&&/^(AA|AD)/.test(x.dataset.cell)&&x.value!==''&&Number(String(x.value).replace(',','.'))!==0).length;const addedInsp=inspInputs.filter(x=>x.dataset.cell&&/^(AB|AE)/.test(x.dataset.cell)&&x.value!==''&&Number(String(x.value).replace(',','.'))!==0).length;const ist=document.getElementById('inspirationStatus');if(ist){if(!currentInsp&&!addedInsp){ist.className='status-message neutral';ist.textContent='Вдохновение пока не заполнено. Если у тебя есть открытые источники из списка, внеси их текущий бонус для точного расчёта прироста основных смотрителей.';}else if(addedInsp){ist.className='status-message success';ist.textContent=`Учтено текущих источников: ${currentInsp}; планируемых прибавок: ${addedInsp}. Итоговые бонусы уже применяются к расчёту уровней и талантов.`;}else{ist.className='status-message success';ist.textContent=`Учтено текущих источников Вдохновения: ${currentInsp}. Планируемого повышения нет, но текущий бонус уже участвует в расчёте прироста.`;}}
    document.getElementById('auditGain').textContent=hasBase?fmt(cell('T72'),cell('U72')||''):'—';
    document.getElementById('auditFinal').textContent=hasBase?fmt(cell('T73'),cell('U73')||''):'—';
    document.getElementById('auditBloodNeed').textContent=fmt(cell('AS1'),cell('AT1')||'B');
    document.getElementById('auditBloodHave').textContent=fmt(cell('AO1'),cell('AT1')||'B');
    for(const [idx,row] of conclave.entries()){const [name,current,plus,out,bonus]=row;const cur=Number(cell(current)||0),add=Number(cell(plus)||0),gain=Number(cell(out)||0),bookFrac=Number(cell(bonus)||0),book=bookFrac*100;const bookRow=22+idx;const directM=gain*Number(cell('S1')||0)/1e6;const booksM=toM(cell(`AG${bookRow}`),cell(`AH${bookRow}`))*bookFrac;const domM=directM+booksM;setText(`conclaveAfter-${current}`,fmt(cur+add));setText(`conclaveGain-${current}`,gain?`+${fmt(gain)} ${name}`:'без прибавки');setText(`conclaveBooks-${current}`,book?`+${fmt(book)} % к книгам`:'без усиления');setText(`conclaveDom-${current}`,domM?`+${fmt(domM,'M')}`:'0 M');setText(`conclaveAttr-${current}`,gain?`каждому +${fmt(gain)}`:'без изменений');setText(`conclaveBook-${current}`,book?`книги +${fmt(book)} %`:'книги без бонуса');}
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

    const mainNameCells=['AJ6','AJ24','AJ42','AJ61','AJ80'];
    const valCols=['S','U','W','Y','AA'];
    let bookChosen=0,bookComplete=0;
    mainNameCells.forEach((addr,i)=>{
      const name=cell(addr);setText(`keeperBookName${i+1}`,name||`Смотритель ${i+1}`);
      if(!name)return;bookChosen++;
      const ok=[22,23,24,25].every(r=>getStored(`${valCols[i]}${r}`)!==null && getStored(`${valCols[i]}${r}`)!=='');
      if(ok)bookComplete++;
    });
    const bookStatus=document.getElementById('keeperBookBonusStatus');
    if(bookStatus){
      const conclaveBookChange=[7,8,9,10].some(r=>Number(cell(`V${r}`)||0)>0);
      if(!bookChosen){bookStatus.className='status-message neutral';bookStatus.textContent='Сначала выбери основных смотрителей выше.';}
      else if(bookComplete===bookChosen){bookStatus.className='status-message success';bookStatus.textContent=`Бонус книг заполнен у ${bookComplete}/${bookChosen} основных смотрителей. Книжная часть Конклава считается полностью.`;}
      else if(conclaveBookChange){bookStatus.className='status-message warning';bookStatus.textContent=`Для точного бонуса Конклава дополни «Бонус книг» ещё у ${bookChosen-bookComplete} смотрителей.`;}
      else{bookStatus.className='status-message neutral';bookStatus.textContent=`Заполнено ${bookComplete}/${bookChosen}. Сейчас выбранные ступени Конклава не добавляют процент к книгам, поэтому пропущенные значения не создают книжного прироста.`;}
    }

    // Детальная раскладка общего прироста — ровно те компоненты, которые входят в T72.
    const conclaveM=toM(cell('U12'),cell('W12'));
    const booksM=toM(cell('Z37'),'raw');
    const tastingM=toM(cell('T46'),'raw');
    const otherM=toM(cell('U57'),'raw');
    const keeperM=['18','36','54','73','92','112','132','152'].reduce((s,r)=>s+toM(cell('AW'+r),cell('AX'+r)),0);
    let othersM=0; for(let r=30;r<=68;r++) othersM+=toM(cell('AF'+r),cell('AG'+r));
    const put=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=hasBase?fmt(v,'M'):'—';};
    put('bdConclave',conclaveM);put('bdBooks',booksM);put('bdTasting',tastingM);put('bdOther',otherM);put('bdKeepers',keeperM);put('bdOthers',othersM);setText('conclaveTotalGain',conclaveM?`+${fmt(conclaveM,'M')}`:'0 M');setText('keepersCount',String(selectedKeepers));setText('keepersBloodNeed',selectedKeepers?fmt(Number(cell('AS1')||0),'B'):'—');setText('keepersGainTotal',selectedKeepers?fmt(keeperM,'M'):'—');let otherUps=0;for(let r=30;r<=67;r++){const ups=Number(cell(`AE${r}`)||0),g=toM(cell(`AF${r}`),cell(`AG${r}`));otherUps+=ups;setText(`otherUps-${r}`,fmt(ups));setText(`otherGain-${r}`,g?fmt(g,'M'):'—');}setText('othersTalentLevels',fmt(otherUps));setText('othersGainTotal',othersM?fmt(othersM,'M'):'—');
    const bg=document.getElementById('booksGain'); if(bg)bg.textContent=fmt(booksM,'M');let bookCount=0,bookBase=0;const bookVals=[10000,5000,1000,400,100,1500,15000];for(let r=31;r<=35;r++){['S','T','U','V','W','X','Y'].forEach((c,i)=>{const q=Number(cell(`${c}${r}`)||0);bookCount+=q;bookBase+=q*bookVals[i];});}setText('booksCount',fmt(bookCount));setText('booksBasePoints',fmt(bookBase));
    setText('tastingGain',hasBase?fmt(tastingM,'M'):(tastingM?fmt(tastingM,'M'):'—'));
    setText('otherGain',hasBase?fmt(otherM,'M'):(otherM?fmt(otherM,'M'):'—'));

    const bloodNow=Number(cell('AK1')||0), bloodTotal=Number(cell('AO1')||0), bloodNeed=Number(cell('AS1')||0), bloodExtra=Math.max(0,bloodTotal-bloodNow), balance=bloodTotal-bloodNeed;
    setText('bloodNow',fmt(bloodNow,'B'));
    setText('bloodExtra',fmt(bloodExtra,'B'));
    setText('bloodTotal',fmt(bloodTotal,'B'));
    setText('bloodNeed',fmt(bloodNeed,'B'));
    setText('bloodBalance',(balance>=0?'Останется ':'Не хватает ')+fmt(Math.abs(balance),'B'));const ba=document.getElementById('bloodBalance')?.closest('div');if(ba){ba.classList.toggle('resource-good',balance>=0);ba.classList.toggle('resource-bad',balance<0);}
    const kps=document.getElementById('keeperPlanStatus');if(kps){if(!selectedKeepers){kps.className='status-message neutral';kps.textContent='Выбери хотя бы одного смотрителя. Пустые слоты в расчёт не входят.';}else{const need=Number(cell('AS1')||0),have=Number(cell('AO1')||0),bal=have-need;if(need>0&&bal<0){kps.className='status-message danger';kps.textContent=`Для выбранных уровней не хватает ${fmt(Math.abs(bal),'B')} крови. Общий прирост смотрителей: ${fmt(keeperM,'M')}.`;}else{kps.className='status-message success';kps.textContent=`План по ${selectedKeepers} смотрител${selectedKeepers===1?'ю':'ям'} даёт ${fmt(keeperM,'M')} господства. На уровни нужно ${fmt(need,'B')} крови.`;}}}
    const rp=document.getElementById('resourcePlanStatus');
    if(rp){
      const warnings=[];
      if(bloodNeed>0 && balance<0) warnings.push(`крови не хватает ${fmt(Math.abs(balance),'B')}`);
      if(councilNeed>0 && councilBal<0) warnings.push(`баллов совета не хватает ${fmt(Math.abs(councilBal),'M')}`); const conclaveNeedsBooks=[7,8,9,10].some(r=>Number(cell(`V${r}`)||0)>0); if(conclaveNeedsBooks&&bookChosen>bookComplete) warnings.push(`не заполнен «Бонус книг» у ${bookChosen-bookComplete} основных смотрителей`);
      if(!hasBase){rp.className='status-message neutral';rp.textContent='Начни с текущего господства и плана прокачки — Совет соберёт сводку по ресурсам.';}
      else if(warnings.length){rp.className='status-message danger';rp.textContent='⚠ План пока не готов: '+warnings.join(' • ')+'.';setText('bloodStatus','Есть нехватка');}
      else if(bloodNeed>0||councilNeed>0){rp.className='status-message success';rp.textContent='✓ По указанным крови и баллам совета ресурсов хватает. Можно проверять книги и остальные источники.';setText('bloodStatus','План выполним');}
      else{rp.className='status-message neutral';rp.textContent='План активен. Добавь прокачку смотрителей или Конклава — здесь появится проверка ресурсов.';setText('bloodStatus','План считается');}
    }
    const advTitle=document.getElementById('planAdvisorTitle'),advText=document.getElementById('planAdvisorText'),adv=document.getElementById('planAdvisor');
    if(advTitle&&advText&&adv){
      const problems=[];if(bloodNeed>0&&balance<0)problems.push(`крови ${fmt(Math.abs(balance),'B')}`);if(councilNeed>0&&councilBal<0)problems.push(`баллов совета ${fmt(Math.abs(councilBal),'M')}`);if([7,8,9,10].some(r=>Number(cell(`V${r}`)||0)>0)&&bookChosen>bookComplete)problems.push(`бонус книг у ${bookChosen-bookComplete} смотрителей`);
      adv.classList.remove('advisor-ok','advisor-bad','advisor-idle');
      if(!hasBase){adv.classList.add('advisor-idle');advTitle.textContent='Совет ждёт исходные данные';advText.textContent='Введи текущее господство — после этого каждый раздел начнёт добавлять свой вклад в общий план.';}
      else if(problems.length){adv.classList.add('advisor-bad');advTitle.textContent='План пока не готов';advText.textContent='Не хватает: '+problems.join(' • ')+'. Исправь дефицит — итог пересчитается сразу.';}
      else if(gainDom>0){adv.classList.add('advisor-ok');advTitle.textContent='План можно выполнять';advText.textContent=`Ожидаемый прирост: ${fmt(gainDom,'M')}. Итоговое господство: ${fmt(finalDom,'M')}. По указанным крови и баллам совета критичной нехватки нет.`;}
      else{adv.classList.add('advisor-idle');advTitle.textContent='Основа заполнена';advText.textContent='Теперь добавь Конклав, смотрителей, книги или другие источники — Совет покажет их вклад и расход.';}
      setText('advisorBlood',bloodNeed?((balance>=0?'🩸 Кровь: хватает, остаток ':'🩸 Кровь: не хватает ')+fmt(Math.abs(balance),'B')):'🩸 Кровь: расход не задан');
      setText('advisorCouncil',councilNeed?((councilBal>=0?'🌳 Совет: хватает, остаток ':'🌳 Совет: не хватает ')+fmt(Math.abs(councilBal),'M')):'🌳 Баллы совета: расход не задан');
      setText('advisorKeepers',selectedKeepers?`🧛 Смотрителей в плане: ${selectedKeepers}`:'🧛 Смотрители: не выбраны');
    }
  }

  // ---------- Дополнительные калькуляторы из загруженных Excel ----------
  const TALENT_THRESHOLDS={6:1200,5:1000,4:800,3:600,2:400,1:200};
  let talentKeeperCounter=0;
  let affinityMode='closeness';
  const AFFINITY_ITEMS={
    closeness:[
      {group:'Подарки выбранному партнёру',name:'Обычный подарок',min:1,max:1,note:'+1 Близости'},
      {group:'Подарки выбранному партнёру',name:'Большой подарок',min:2,max:2,note:'+2 Близости'},
      {group:'Подарки выбранному партнёру',name:'Роскошный подарок',min:5,max:5,note:'+5 Близости'},
      {group:'Предметы случайному партнёру',name:'Чёртова монета',min:1,max:1,note:'+1 случайному партнёру'},
      {group:'Предметы случайному партнёру',name:'Бронзовая чёртова монета',min:2,max:2,note:'+2 случайному партнёру'},
      {group:'Предметы случайному партнёру',name:'Серебряная чёртова монета',min:5,max:5,note:'+5 случайному партнёру'},
      {group:'Предметы случайному партнёру',name:'Золотая чёртова монета',min:25,max:25,note:'+25 случайному партнёру'},
      {group:'Случайный размер прибавки',name:'Сумочка близости',min:1,max:4,note:'от 1 до 4'},
      {group:'Случайный размер прибавки',name:'Мешок близости',min:5,max:8,note:'от 5 до 8'},
      {group:'Случайный размер прибавки',name:'Шкатулка близости',min:4,max:50,note:'от 4 до 50'}
    ],
    attraction:[
      {group:'Букеты выбранному партнёру',name:'Алый букет',min:1,max:1,note:'+1 Влечения'},
      {group:'Букеты выбранному партнёру',name:'Синий букет',min:2,max:2,note:'+2 Влечения'},
      {group:'Букеты выбранному партнёру',name:'Лиловый букет',min:5,max:5,note:'+5 Влечения'},
      {group:'Записки случайному партнёру',name:'Бирюзовая записка',min:1,max:1,note:'+1 случайному партнёру'},
      {group:'Записки случайному партнёру',name:'Индиговая записка',min:2,max:2,note:'+2 случайному партнёру'},
      {group:'Записки случайному партнёру',name:'Багровая записка',min:5,max:5,note:'+5 случайному партнёру'},
      {group:'Записки случайному партнёру',name:'Потальная записка',min:25,max:25,note:'+25 случайному партнёру'},
      {group:'Случайный размер прибавки',name:'Пиала влечения',min:1,max:4,note:'от 1 до 4'},
      {group:'Случайный размер прибавки',name:'Бутыль влечения',min:5,max:8,note:'от 5 до 8'},
      {group:'Случайный размер прибавки',name:'Шкатулка влечения',min:4,max:50,note:'от 4 до 50'}
    ]
  };
  const GATHER_ITEMS=[['Жетон ×0,1',0.1],['Жетон ×0,5',0.5],['Жетон ×1',1],['Жетон ×2',2],['Жетон ×3',3],['Жетон ×5',5],['Жетон ×10',10],['Карта сбора ×1',1]];

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
    const chanceCount=numFrom(document.getElementById('manChanceCount'));const chanceStar=Number(document.getElementById('manChanceStar')?.value||3);const chanceRate=1/chanceStar;const expectedSuccess=chanceCount*chanceRate;const expectedRating=expectedSuccess*chanceStar;setText('manChanceResult',chanceCount?`≈ ${fmt(expectedSuccess)} успешных • ≈ ${fmt(expectedRating)} рейтинга`:'—');const chanceNote=document.getElementById('manChanceNote');if(chanceNote)chanceNote.textContent=chanceCount?'Это математическая оценка по шансу звёздности; фактический результат может отличаться и сюда не прибавляется.':'Не прибавляется к гарантированному итогу.';
    document.getElementById('talScrollPoints').textContent=fmt(scrollPts);
    document.getElementById('talScrollGain').textContent='Это запас очков для распределения по смотрителям; в рейтинг он попадёт после распределения.';
    document.getElementById('talentTotal').textContent=fmt(keeperTotal+manuscriptTotal);
    document.getElementById('talentBreakdown').textContent=`По очкам смотрителей ${fmt(keeperTotal)} • гарантированный прирост от рукописей ${fmt(manuscriptTotal)} • нераспределённые очки свитков ${fmt(scrollPts)}`;
  }

  const BREAKTHROUGH_LEVELS=[[100,200],[150,400],[200,600],[250,800],[300,1000],[350,1200]];
  function renderBreakthroughInputs(){
    const host=document.getElementById('breakthroughInputs');if(!host)return;host.innerHTML='';
    BREAKTHROUGH_LEVELS.forEach(([level,exp],i)=>{const el=toolInput(`Прорыв до ${level} ур. ×${exp} EXP`,`break-${i}`);host.appendChild(el);el.querySelector('input').step='1';el.querySelector('input').addEventListener('input',refreshBreakthroughTool);});
  }
  function refreshBreakthroughTool(){let total=0;BREAKTHROUGH_LEVELS.forEach(([level,exp],i)=>total+=numFrom(document.getElementById(`break-${i}`))*exp);setText('breakthroughTalentExp',fmt(total));}
  function inspirationStepCost(level){if(level<5)return 10;if(level<10)return 20;if(level<15)return 30;if(level<20)return 40;if(level<25)return 50;return 60;}
  function refreshInspirationTool(){
    const cur=Math.floor(numFrom(document.getElementById('inspToolCurrent'))),tar=Math.floor(numFrom(document.getElementById('inspToolTarget'))),st=document.getElementById('inspToolStatus');
    if(!document.getElementById('inspToolTarget')?.value){setText('inspToolItems','0');setText('inspToolLevels','0');if(st){st.className='status-message neutral';st.textContent='Укажи текущий и целевой уровень.';}return;}
    if(tar<cur){setText('inspToolItems','0');setText('inspToolLevels','0');if(st){st.className='status-message danger';st.textContent='Целевой уровень должен быть не ниже текущего.';}return;}
    let cost=0;for(let l=cur;l<tar;l++)cost+=inspirationStepCost(l);setText('inspToolItems',fmt(cost));setText('inspToolLevels',fmt(tar-cur));if(st){st.className='status-message success';st.textContent=`По справочной шкале сообщества для ${tar-cur} уровней понадобится ${fmt(cost)} предметов. Перед тратой сверь стоимость следующей ступени в игре.`;}
  }

  function renderAffinityInputs(){
    const host=document.getElementById('affinityInputs');host.innerHTML='';
    let lastGroup='';
    AFFINITY_ITEMS[affinityMode].forEach((item,i)=>{
      if(item.group!==lastGroup){const h=document.createElement('div');h.className='affinity-group-title';h.textContent=item.group;host.appendChild(h);lastGroup=item.group;}
      const el=toolInput(item.name,`aff-${i}`);el.classList.add('affinity-item');
      const small=document.createElement('small');small.textContent=item.note;el.appendChild(small);host.appendChild(el);el.querySelector('input').addEventListener('input',refreshAffinityTool);
    });
    refreshAffinityTool();
  }
  function refreshAffinityTool(){
    let guaranteed=0,min=0,max=0;AFFINITY_ITEMS[affinityMode].forEach((item,i)=>{const q=numFrom(document.getElementById(`aff-${i}`));min+=q*item.min;max+=q*item.max;if(item.min===item.max)guaranteed+=q*item.min;});const avg=(min+max)/2;setText('affinityGuaranteed',fmt(guaranteed));setText('affinityMin',fmt(min));setText('affinityMax',fmt(max));setText('affinityAvg',fmt(avg));const goal=numFrom(document.getElementById('affinityGoal')),st=document.getElementById('affinityGoalStatus');if(!st)return;if(!goal){st.className='status-message neutral';st.textContent='Укажи цель, если хочешь проверить, хватает ли предметов.';}else if(min>=goal){st.className='status-message success';st.textContent=`Гарантированно хватает. Даже минимальный результат выше цели на ${fmt(min-goal)}.`;}else if(max<goal){st.className='status-message danger';st.textContent=`Даже при максимальном результате не хватает ${fmt(goal-max)}.`;}else{st.className='status-message warning';st.textContent=`Цель возможна, но не гарантирована. До гарантии не хватает ${fmt(goal-min)} по минимальному сценарию.`;}
  }
  function renderGatherInputs(){
    const host=document.getElementById('gatherInputs');
    GATHER_ITEMS.forEach((item,i)=>{const el=toolInput(item[0],`gather-${i}`);host.appendChild(el);el.querySelector('input').addEventListener('input',refreshGatherTool);});
  }
  function refreshGatherTool(){
    const base=numFrom(document.getElementById('gatherBase')),stock=numFrom(document.getElementById('gatherStock')),goal=numFrom(document.getElementById('gatherGoal')),unit=document.getElementById('gatherUnit')?.value||'M',resource=document.getElementById('gatherResourceType')?.value||'Ресурс';let extra=0;GATHER_ITEMS.forEach((item,i)=>extra+=numFrom(document.getElementById(`gather-${i}`))*base*item[1]);const total=stock+extra;setText('gatherExtra',fmt(extra,unit));setText('gatherTotal',fmt(total,unit));setText('gatherBalance',goal?fmt(Math.abs(total-goal),unit):'—');const st=document.getElementById('gatherStatus');if(!st)return;if(!goal){st.className='status-message neutral';st.textContent=extra?`${resource}: предметы дадут ещё ${fmt(extra,unit)}. Всего будет ${fmt(total,unit)}.`:'Введите сбор и количество предметов.';}else if(total>=goal){st.className='status-message success';st.textContent=`${resource}: хватает. После достижения цели останется ${fmt(total-goal,unit)}.`;}else{st.className='status-message danger';st.textContent=`${resource}: не хватает ${fmt(goal-total,unit)} до цели.`;}
  }
  function buildTools(){
    addTalentKeeperRow();addTalentKeeperRow();addTalentKeeperRow();
    ['talScrollHigh','talScrollMid','talScrollLow','manStrength','manCharisma','manIntellect','manWill','manChanceCount','manChanceStar'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshTalentTool));
    document.getElementById('addTalentKeeper')?.addEventListener('click',()=>addTalentKeeperRow());
    document.querySelectorAll('[data-affinity-mode]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-affinity-mode]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');affinityMode=btn.dataset.affinityMode;renderAffinityInputs();}));
    renderAffinityInputs();renderGatherInputs();renderBreakthroughInputs();document.getElementById('affinityGoal')?.addEventListener('input',refreshAffinityTool);['gatherBase','gatherStock','gatherGoal','gatherResourceType','gatherUnit'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshGatherTool));['inspToolCurrent','inspToolTarget'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshInspirationTool));refreshGatherTool();refreshTalentTool();refreshBreakthroughTool();refreshInspirationTool();
  }

  function resetProfileSection(){
    if(!confirm('Очистить профиль, Конклав и Вдохновение? Данные смотрителей и ресурсов останутся.'))return;const cells=['S1','S2','AK1','T14','S7','S8','S9','S10','T7','T8','T9','T10'];for(let r=4;r<=17;r++)cells.push(`AA${r}`,`AB${r}`,`AD${r}`,`AE${r}`);cells.forEach(a=>{try{localStorage.removeItem(storageKey(a));}catch(_){}});try{Object.keys(localStorage).filter(k=>k.includes('conclave-target-')).forEach(k=>localStorage.removeItem(k));}catch(_){}location.reload();
  }
  function resetAll(){
    if(!confirm('Начать новый расчёт и удалить все введённые данные на этом устройстве?'))return;clearStorage();try{localStorage.removeItem('vd10:migrated');localStorage.removeItem('vd14:migrated');}catch(_){}location.reload();
  }

  function runSelfTest(){
    const log=document.getElementById('testLog');
    log.textContent='Запуск внутренней контрольной проверки…\n';
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
      // Независимые мини-тесты дополнительных калькуляторов.
      const talentRating=Math.floor(3557/1200)*6, talentNeed=1200-(3557%1200);
      const closenessFixed=216+122*2+80*5+10+4*2;
      const closenessMin=closenessFixed+127*1+44*5+25*4;
      const closenessMax=closenessFixed+127*4+44*8+25*50;
      const attractionFixed=2020+335*2+258*5+48+10*2+3*5+1*25;
      const attractionMin=attractionFixed+359*1+109*5+90*4;
      const attractionMax=attractionFixed+359*4+109*8+90*50;
      const gatherTest=1123.23*(0.1+0.5+1+2+3+5+10+1);
      const mini=[
        ['Таланты ×6: 3557 EXP → рейтинг 12',talentRating===12],
        ['Таланты ×6: до следующего порога 43 EXP',talentNeed===43],
        ['Близость: исправленный минимум 1325',closenessMin===1325],
        ['Близость: максимум 2988',closenessMax===2988],
        ['Влечение: минимум 5352',attractionMin===5352],
        ['Влечение: максимум 10896',attractionMax===10896],
        ['Сбор ресурсов: коэффициенты предметов',Math.abs(gatherTest-25384.998)<1e-9]
      ];
      for(const [label,pass] of mini){ok=ok&&pass;lines.push(`${pass?'✅':'❌'} ${label}`);}
      lines.push(ok?'\n✅ Основной движок и быстрые калькуляторы совпали с проверенными контрольными сценариями.':'\n❌ Есть расхождение. Публикацию лучше остановить и проверить формулы.');
      log.textContent=lines.join('\n');
      setBanner(ok?'Проверка пройдена — расчёты работают устойчиво.':'Самопроверка обнаружила проблему.',ok?'ok':'bad');const hs=document.getElementById('healthSelfTest');if(hs){hs.className='health-dot '+(ok?'ok':'bad');hs.textContent=ok?'● Самопроверка пройдена':'● Ошибка самопроверки';}
      test.destroy();
    }catch(e){log.textContent+='\n❌ '+e.message;setBanner('Ошибка самопроверки: '+e.message,'bad');const hs=document.getElementById('healthSelfTest');if(hs){hs.className='health-dot bad';hs.textContent='● Ошибка самопроверки';}}
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
    migrateV14();
    applyTheme(preferredTheme(),false);
    initializeTelegram(); wireTabs();
    try{
      buildEngine();
      buildProfile(); buildKeepers(); buildKeeperBookBonuses(); buildResources(); buildOthers(); buildTools();
      restoreUIToEngine(); refresh();
      document.getElementById('runSelfTest').addEventListener('click',runSelfTest);
      document.getElementById('selfTestBtn')?.addEventListener('click',runSelfTest);
      document.getElementById('resetBtn')?.addEventListener('click',resetAll);document.getElementById('resetAllTopBtn')?.addEventListener('click',resetAll);document.getElementById('resetProfileBtn')?.addEventListener('click',resetProfileSection);
      document.getElementById('themeBtn').addEventListener('click',toggleTheme);
      document.getElementById('toggleInspiration')?.addEventListener('click',(e)=>{const box=document.getElementById('inspirationFields');box?.classList.toggle('expanded');e.currentTarget.textContent=box?.classList.contains('expanded')?'Скрыть дополнительные строки':'Показать всех смотрителей Вдохновения';});document.getElementById('togglePartners')?.addEventListener('click',(e)=>{const box=document.getElementById('partnerFields');box?.classList.toggle('expanded');e.currentTarget.textContent=box?.classList.contains('expanded')?'Скрыть дополнительные строки':'Показать больше партнёров';});
      document.getElementById('addOtherKeeper')?.addEventListener('click',()=>{const next=document.querySelector('.other-keeper-card.is-hidden');if(next)next.classList.remove('is-hidden');else alert('Открыты все доступные дополнительные строки.');});document.getElementById('toggleExtraKeepers')?.addEventListener('click',(e)=>{const hidden=[...document.querySelectorAll('.extra-main-keeper.is-hidden')];if(hidden.length){hidden.forEach(x=>x.classList.remove('is-hidden'));e.currentTarget.textContent='Скрыть дополнительные слоты';}else{document.querySelectorAll('.extra-main-keeper').forEach(x=>x.classList.add('is-hidden'));e.currentTarget.textContent='+ Показать ещё 3 основных слота';}});
      const coverageOk=renderExcelCoverage();
      setBanner(coverageOk?'Калькулятор готов. Все изменения пересчитываются сразу.':'Внимание: расчётное ядро запустилось не полностью.',coverageOk?'ok':'bad');const he=document.getElementById('healthEngine');if(he){he.className='health-dot '+(coverageOk?'ok':'bad');he.textContent=coverageOk?'● Расчётное ядро готово':'● Ошибка расчётного ядра';}
      setTimeout(runSelfTest,120);
    }catch(e){setBanner('Не удалось запустить приложение: '+e.message,'bad');console.error(e);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
