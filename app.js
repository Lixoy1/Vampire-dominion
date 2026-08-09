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
  const EXCEL_EXPECTED_INPUTS = 283;

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
    const boundCount=[...DATA.manualCells].filter(a=>boundInputs.has(a)).length;
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
  function clearStorage(){ try{ Object.keys(localStorage).filter(k=>k.startsWith('vd01:')).forEach(k=>localStorage.removeItem(k)); }catch(_){} }

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
    // Restore user state only after formulas have been loaded.
    for (const addr of DATA.manualCells) {
      const v=getStored(addr);
      if (v!==null) setCell(addr,v, isTextCell(addr)?'text':'number');
    }
  }

  function isTextCell(addr){ return /^AJ(6|24|42|61|80)$/.test(addr) || addr==='AG29'; }

  function buildProfile() {
    const box=document.getElementById('profileFields');
    box.append(
      inputField('Текущее господство','S2',{help:'В единицах, указанных исходной таблицей (M).'}),
      inputField('Количество смотрителей','S1',{step:'1',min:0}),
      inputField('Имеющаяся кровь','AK1',{help:'В исходной таблице — B.'}),
      inputField('Имеющиеся баллы совета','T14',{help:'В исходной таблице — M.'})
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
      top.append(inputField('Смотритель',`AJ${b.header}`,{select:true,options:DATA.keepers}),inputField('Текущий уровень',`AU${b.header}`,{step:'1',min:1}),inputField('Прирост уровня',`AU${b.sub}`,{step:'1',min:0}),inputField('Опыт / очки талантов',`AO${b.exp}`,{step:'1',min:0}));
      card.appendChild(top);
      const labels=document.createElement('div');labels.className='talent-labels';labels.innerHTML='<span>Талант</span><span>ур.</span><span>рукоп.</span><span>100%</span>';card.appendChild(labels);
      const list=document.createElement('div');list.className='talent-table'; list.id=`talents${b.n}`;
      for(let r=b.talents[0];r<=b.talents[1];r++){
        const row=document.createElement('div');row.className='talent-row';
        const name=document.createElement('div');name.className='talent-name';name.id=`talentName-${r}`;name.textContent='—';
        const level=inputFieldMini(`AL${r}`), manuscript=inputFieldMini(`AM${r}`), scroll=inputFieldMini(`AN${r}`);
        row.append(name,level,manuscript,scroll);list.appendChild(row);
      }
      card.appendChild(list);host.appendChild(card);
    }
  }

  function inputFieldMini(addr){
    covered.add(addr);
    const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.step='1';input.min='0';input.dataset.cell=addr;input.dataset.kind='number';
    const stored=getStored(addr);if(stored!==null)input.value=stored;input.addEventListener('input',onInput);boundInputs.set(addr,input);return input;
  }

  function buildResources(){
    const books=document.getElementById('booksFields');
    const headers=['V','IV','III','II','I','15шт','15шт'];
    const h=document.createElement('div');h.className='book-row book-head';h.innerHTML='<span></span>'+headers.map(x=>`<span>${x}</span>`).join('');books.appendChild(h);
    const labels={31:'Энциклопедия',32:'Сила',33:'Харизма',34:'Интеллект',35:'Воля'};
    const cols=['S','T','U','V','W','X','Y'];
    for(let r=31;r<=35;r++){
      const row=document.createElement('div');row.className='book-row';const lab=document.createElement('label');lab.textContent=labels[r];row.appendChild(lab);
      for(const c of cols){const inp=inputFieldMini(`${c}${r}`);row.appendChild(inp);} books.appendChild(row);
    }
    const tasting=document.getElementById('tastingFields');
    [['Знак винодельни','S42'],['Знак винодельни I','S43'],['Знак винодельни II','S44'],['Знак винодельни III','S45']].forEach(([l,a])=>tasting.appendChild(inputField(l,a,{step:'1',min:0})));
    const partners=document.getElementById('partnerFields');
    for(let r=40;r<=67;r++){const name=cellStatic(`X${r}`);if(name)partners.appendChild(inputField(name,`Y${r}`,{min:0}));}
    const other=document.getElementById('otherResourceFields');
    for(let r=51;r<=56;r++){const label=cellStatic(`R${r}`);if(label)other.appendChild(inputField(label,`S${r}`,{min:0}));}
  }

  function buildOthers(){
    const host=document.getElementById('otherKeepersFields');
    for(let r=30;r<=67;r++){
      const name=cellStatic(`AB${r}`);if(!name)continue;
      const row=document.createElement('div');row.className='other-keeper-row';const lab=document.createElement('div');lab.innerHTML=`<strong>${name}</strong>`;
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

  function refresh(){
    if(!hf)return;
    document.getElementById('finalDominion').textContent=fmt(cell('T73'),cell('U73')||'');
    document.getElementById('gainDominion').textContent=fmt(cell('T72'),cell('U72')||'');
    document.getElementById('bloodStatus').textContent=fmt(cell('AW1'));
    document.getElementById('councilNeeded').textContent=fmt(cell('T15'),cell('U15')||'M');
    document.getElementById('councilStatus').textContent=fmt(cell('S17'));
    document.getElementById('auditGain').textContent=fmt(cell('T72'),cell('U72')||'');
    document.getElementById('auditFinal').textContent=fmt(cell('T73'),cell('U73')||'');
    document.getElementById('auditBloodNeed').textContent=fmt(cell('AS1'),cell('AT1')||'B');
    document.getElementById('auditBloodHave').textContent=fmt(cell('AO1'),cell('AT1')||'B');
    for(const [name,current,plus,out,bonus] of conclave){
      const el=document.getElementById(`summary-${current}`);if(el)el.textContent=`+${fmt(cell(out))} • книги +${fmt(cell(bonus)*100,'%')}`;
    }
    for(const b of keeperBlocks){
      const selected=cell(`AJ${b.header}`);
      const summary=document.getElementById(`keeperSummary${b.n}`);
      if(summary) summary.textContent=selected?`${selected} • +${fmt(cell(`AU${b.sub}`))} ур.`:'пустой слот';
      for(let r=b.talents[0];r<=b.talents[1];r++){
        const n=document.getElementById(`talentName-${r}`);if(n){const talent=cell(`AJ${r}`),mult=cell(`AK${r}`);n.textContent=talent?`${talent} ×${mult||1}`:'—';}
      }
    }
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

  function wireTabs(){
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      if(TG?.HapticFeedback)try{TG.HapticFeedback.selectionChanged();}catch(_){}
    }));
  }

  function boot(){
    applyTheme(preferredTheme(),false);
    initializeTelegram(); wireTabs();
    try{
      buildEngine();
      buildProfile(); buildKeepers(); buildResources(); buildOthers();
      restoreUIToEngine(); refresh();
      document.getElementById('runSelfTest').addEventListener('click',runSelfTest);
      document.getElementById('selfTestBtn').addEventListener('click',()=>{document.querySelector('[data-tab="audit"]').click();runSelfTest();});
      document.getElementById('resetBtn').addEventListener('click',resetAll);
      document.getElementById('themeBtn').addEventListener('click',toggleTheme);
      const coverageOk=renderExcelCoverage();
      setBanner(coverageOk?'Расчётное ядро готово. Все формулы и поля Excel-калькулятора подключены.':'Внимание: проверка комплектации Excel-калькулятора не пройдена.',coverageOk?'ok':'bad');
      setTimeout(runSelfTest,120);
    }catch(e){setBanner('Не удалось запустить приложение: '+e.message,'bad');console.error(e);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
