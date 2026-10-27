(()=>{
'use strict';
const D=window.VD_DATA, E=window.VD_ENGINE;
const ATTRS=E.ATTRS;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const attrsShort={Сила:'Сила',Харизма:'Харизма',Интеллект:'Интеллект',Воля:'Воля'};
let wardenSeq=0,inspSeq=0,otherSeq=0,ratingSeq=0,manualSourceSeq=0,guildMemberSeq=1;

function freshState(){return {
 profile:{dominion:'',watchers:'',blood:'',council:''},
 conclave:Object.fromEntries(ATTRS.map(a=>[a,{current:'',target:''}])),
 conclaveAttrTotals:Object.fromEntries(ATTRS.map(a=>[a,''])),
 inspiration:[],wardens:[],otherWardens:[],
 ratingRows:[],ratingManuscripts:Object.fromEntries(ATTRS.map(a=>[a,''])),scrolls:{high:'',mid:'',simple:'',star:6},
 resource:{type:'Кровь',one:'',counts:Object.fromEntries(D.resourceMultipliers.map(([n])=>[n,'']))},
 books:Object.fromEntries(['Энциклопедия',...ATTRS].map(a=>[a,{V:'',IV:'',III:'',II:'',I:'',packI15:'',packII15:'',packIII15:''}])),bookPackIIIEach:'',
 tasting:Object.fromEntries(Object.keys(D.tasting).map(n=>[n,''])),misc:{plasma:'',vito:'',trustTotal:'',heirsRB:'',heirsGP:'',heirsS:'',directOther:''},
 closeness:Object.fromEntries(Object.keys(D.closeness).map(n=>[n,''])),closenessGoal:'',
 attraction:Object.fromEntries(Object.keys(D.attraction).map(n=>[n,''])),attractionGoal:'',
 heirs:{rings:{amethyst:{stock:'',planned:'',gainPerMarriage:''},ruby:{stock:'',planned:'',gainPerMarriage:''},blackPearl:{stock:'',planned:'',gainPerMarriage:''}}},
 manualSources:[],
 guildExp:{members:[{id:1,name:'',counts:Object.fromEntries((D.guildExperienceItems||[]).map(item=>[item.key,'']))}]}
};}
let S=freshState();

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function val(id){return $(id)?.value??''}
function parse(v){return E.parseCompact(v)}
function parseDefault(v,mult){const s=String(v??'').trim(); if(!s)return 0; return /[KMBT]/i.test(s)?parse(s):n(s)*mult}
function n(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function setText(id,text){const el=$(id);if(el)el.textContent=text}
function fmt(x){return E.formatCompact(x)}
function intfmt(x){return Math.round(x).toLocaleString('ru-RU')}
function pctfmt(x){return (x*100).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%'}

function switchTab(id){$$('.tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===id));$$('.page').forEach(p=>p.classList.toggle('is-active',p.id===id));window.scrollTo({top:document.querySelector('.tabs').offsetTop-4,behavior:'smooth'});}
$$('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.jump)));

const theme=localStorage.getItem('vd_theme')||'dark';document.documentElement.dataset.theme=theme;$('#themeBtn').textContent=theme==='dark'?'☀':'☾';
$('#themeBtn').addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.setItem('vd_theme',t);$('#themeBtn').textContent=t==='dark'?'☀':'☾';});

function bindStatic(){
 const map={profileDominion:['profile','dominion'],profileWatchers:['profile','watchers'],profileBlood:['profile','blood'],profileCouncil:['profile','council'],closenessGoal:['closenessGoal'],attractionGoal:['attractionGoal'],oneCollect:['resource','one'],resourceType:['resource','type'],scrollHigh:['scrolls','high'],scrollMid:['scrolls','mid'],scrollSimple:['scrolls','simple'],scrollStar:['scrolls','star'],miscPlasma:['misc','plasma'],miscVito:['misc','vito'],miscTrust:['misc','trustTotal'],miscRB:['misc','heirsRB'],miscGP:['misc','heirsGP'],miscS:['misc','heirsS'],miscDirect:['misc','directOther']};
 for(const [id,path] of Object.entries(map)){const el=$('#'+id); if(!el)continue; el.addEventListener('input',()=>{let o=S;for(let i=0;i<path.length-1;i++)o=o[path[i]];o[path.at(-1)]=el.value;recalc();});}
}

function renderConclave(){
 const box=$('#conclaveRows'); box.innerHTML='';
 for(const attr of ATTRS){
  const x=S.conclave[attr]; const row=document.createElement('div');row.className='seal-row';
  row.innerHTML=`<div class="name">${attr}</div><input inputmode="numeric" aria-label="${attr} сейчас" placeholder="сейчас" value="${esc(x.current)}"><div class="arrow">→</div><input inputmode="numeric" aria-label="${attr} цель" placeholder="цель" value="${esc(x.target)}"><div class="seal-out" data-out>+0</div>`;
  const ins=row.querySelectorAll('input');ins[0].addEventListener('input',e=>{x.current=e.target.value;recalc()});ins[1].addEventListener('input',e=>{x.target=e.target.value;recalc()});box.append(row);
 }
 const ab=$('#conclaveAttrTotals');ab.innerHTML='';
 for(const a of ATTRS){const lab=document.createElement('label');lab.textContent=a;lab.innerHTML+=`<input inputmode="decimal" placeholder="например 5,1M" value="${esc(S.conclaveAttrTotals[a])}">`;lab.querySelector('input').addEventListener('input',e=>{S.conclaveAttrTotals[a]=e.target.value;recalc()});ab.append(lab);}
}

function renderInspiration(){
 const box=$('#inspirationRows');box.innerHTML='';
 const opts='<option value="">Выбери смотрителя</option>'+D.inspirationWatchers.map(x=>`<option ${''} value="${esc(x.name)}">${esc(x.name)} · ${esc(x.affects)}</option>`).join('');
 for(const row of S.inspiration){
  const el=document.createElement('div');el.className='inspiration-row';el.innerHTML=`<label>Смотритель<select>${opts}</select></label><label>Сейчас, %<input inputmode="decimal" placeholder="0" value="${esc(row.currentPct)}"></label><label>Добавить, %<input inputmode="decimal" placeholder="0" value="${esc(row.addPct)}"></label><button class="remove-btn" title="Удалить">×</button>`;
  const sel=el.querySelector('select');sel.value=row.name||'';sel.addEventListener('change',e=>{row.name=e.target.value;recalc()});const ins=el.querySelectorAll('input');ins[0].addEventListener('input',e=>{row.currentPct=e.target.value;recalc()});ins[1].addEventListener('input',e=>{row.addPct=e.target.value;recalc()});el.querySelector('button').addEventListener('click',()=>{S.inspiration=S.inspiration.filter(x=>x.id!==row.id);renderInspiration();recalc()});box.append(el);
 }
 recalcInspirationPills();
}
function recalcInspirationPills(){const totals=E.inspirationTotals(S.inspiration);$('#inspirationTotals').innerHTML=ATTRS.map(a=>`<span>${a}: <b>${pctfmt(totals[a])}</b></span>`).join('');return totals;}
$('#addInspiration').addEventListener('click',()=>{S.inspiration.push({id:++inspSeq,name:'',currentPct:'',addPct:''});renderInspiration();recalc()});

function watcherOptions(){return '<option value="">Выбери смотрителя</option>'+Object.keys(D.watchers).sort((a,b)=>a.localeCompare(b,'ru')).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}
function maxStar(name){const defs=D.watchers[name]||[];return defs.length?Math.max(...defs.map(x=>Number(x.star)||1)):1}
function newWarden(){return {id:++wardenSeq,name:'',currentLevel:'',targetLevel:'',talents:[]}}
function syncTalentInputs(w){const defs=D.watchers[w.name]||[];while(w.talents.length<defs.length)w.talents.push({current:'',manuscripts:'',guaranteed:'',exp:''});if(w.talents.length>defs.length)w.talents=w.talents.slice(0,defs.length)}
function renderWardens(){
 const box=$('#wardenCards');box.innerHTML='';
 for(const w of S.wardens){syncTalentInputs(w);const defs=D.watchers[w.name]||[];const card=document.createElement('article');card.className='warden-card';
  card.innerHTML=`<div class="warden-top"><label>Смотритель<select class="w-name">${watcherOptions()}</select></label><label>Уровень сейчас<input class="w-cur" inputmode="numeric" placeholder="1" value="${esc(w.currentLevel)}"></label><label>Цель<input class="w-tgt" inputmode="numeric" placeholder="1" value="${esc(w.targetLevel)}"></label><button class="remove-btn" title="Удалить">×</button></div><div class="warden-summary"><div><span>Нужно крови</span><b class="w-blood">0</b></div><div><span>Прирост</span><b class="w-gain">0</b></div><div><span>Статус</span><b class="w-status">заполни данные</b></div></div><details><summary>★ Таланты и рукописи${w.name?' · '+esc(w.name):''}</summary><p>Заполняй только то, что реально планируешь использовать. Шанс рукописи берётся из множителя таланта.</p><div class="talent-grid"></div></details>`;
  const sel=card.querySelector('.w-name');sel.value=w.name;sel.addEventListener('change',e=>{w.name=e.target.value;w.talents=[];syncTalentInputs(w);renderWardens();recalc()});card.querySelector('.w-cur').addEventListener('input',e=>{w.currentLevel=e.target.value;recalc()});card.querySelector('.w-tgt').addEventListener('input',e=>{w.targetLevel=e.target.value;recalc()});card.querySelector('.remove-btn').addEventListener('click',()=>{S.wardens=S.wardens.filter(x=>x.id!==w.id);renderWardens();recalc()});
  const tg=card.querySelector('.talent-grid');
  defs.forEach((def,i)=>{const x=w.talents[i];const chance=Math.round((D.manuscriptChance[String(def.star)]||0)*1000)/10;const row=document.createElement('div');row.className='talent-row';row.innerHTML=`<div class="talent-head"><div class="tal-name"><span>${esc(def.attr)}</span><small>Талант ${i+1}</small></div><span class="tal-star">×${def.star}<small>${chance}% рук.</small></span></div><label class="tal-current">Текущий уровень<input inputmode="numeric" value="${esc(x.current)}" placeholder="1"></label><label>Рукописи<input inputmode="numeric" value="${esc(x.manuscripts)}" placeholder="0"></label><label>Гарант. свитки<input inputmode="numeric" value="${esc(x.guaranteed)}" placeholder="0"></label><label class="tal-exp">Опыт таланта (EXP)<input inputmode="numeric" value="${esc(x.exp)}" placeholder="0"></label><div class="tal-result"><small>ПЛАН</small><b data-plan>—</b><span data-exp>EXP не указан</span></div>`;const ins=row.querySelectorAll('input');['current','manuscripts','guaranteed','exp'].forEach((k,j)=>ins[j].addEventListener('input',e=>{x[k]=e.target.value;recalc()}));tg.append(row);});box.append(card);
 }
  const addWarden=$('#addWarden');const isFull=S.wardens.length>=5;setText('#wardenCount',`${S.wardens.length} / 5`);if(addWarden){addWarden.disabled=isFull;addWarden.classList.toggle('is-full',isFull);addWarden.innerHTML=isFull?`✓ Смотрители добавлены <span id="wardenCount" class="count-badge">5 / 5</span>`:`＋ Добавить смотрителя <span id="wardenCount" class="count-badge">${S.wardens.length} / 5</span>`}
}
$('#addWarden').addEventListener('click',()=>{if(S.wardens.length>=5)return;S.wardens.push(newWarden());renderWardens();recalc()});

function renderOtherWardens(){const box=$('#otherWardenRows');box.innerHTML='';for(const r of S.otherWardens){const el=document.createElement('div');el.className='other-row';el.innerHTML=`<label>Уровень<input inputmode="numeric" value="${esc(r.level)}" placeholder="250"></label><label>Опыт таланта (EXP)<input inputmode="numeric" value="${esc(r.exp)}" placeholder="0"></label><label>Атрибут<select>${ATTRS.map(a=>`<option value="${a}">${a}</option>`).join('')}</select></label><button class="remove-btn">×</button>`;const ins=el.querySelectorAll('input');ins[0].addEventListener('input',e=>{r.level=e.target.value;recalc()});ins[1].addEventListener('input',e=>{r.exp=e.target.value;recalc()});const sel=el.querySelector('select');sel.value=r.attr||'Сила';sel.addEventListener('change',e=>{r.attr=e.target.value;recalc()});el.querySelector('button').addEventListener('click',()=>{S.otherWardens=S.otherWardens.filter(x=>x.id!==r.id);renderOtherWardens();recalc()});box.append(el)}}
$('#addOtherWarden').addEventListener('click',()=>{S.otherWardens.push({id:++otherSeq,level:'',exp:'',attr:'Сила'});renderOtherWardens();recalc()});

function renderRating(){const box=$('#talentRatingRows');box.innerHTML='';for(const r of S.ratingRows){if(r.name)r.star=maxStar(r.name);const el=document.createElement('div');el.className='rating-row';el.innerHTML=`<label>Смотритель<select class="r-name">${watcherOptions()}</select></label><label>Макс. талант<input class="r-star" value="×${r.star||1}" readonly></label><label>Опыт таланта (EXP)<input class="r-exp" inputmode="numeric" value="${esc(r.exp)}" placeholder="например 2612"></label><button class="remove-btn">×</button>`;const sel=el.querySelector('.r-name');sel.value=r.name||'';sel.addEventListener('change',e=>{r.name=e.target.value;r.star=maxStar(r.name);renderRating();recalc()});el.querySelector('.r-exp').addEventListener('input',e=>{r.exp=e.target.value;recalc()});el.querySelector('button').addEventListener('click',()=>{S.ratingRows=S.ratingRows.filter(x=>x.id!==r.id);renderRating();recalc()});box.append(el)}}
$('#addTalentRating').addEventListener('click',()=>{S.ratingRows.push({id:++ratingSeq,name:'',star:1,exp:''});renderRating();recalc()});
function renderRatingManuscripts(){const box=$('#ratingManuscripts');box.innerHTML='';for(const a of ATTRS){const l=document.createElement('label');l.innerHTML=`${a}<input inputmode="numeric" placeholder="0" value="${esc(S.ratingManuscripts[a])}">`;l.querySelector('input').addEventListener('input',e=>{S.ratingManuscripts[a]=e.target.value;recalc()});box.append(l)}}

function renderResourceTokens(){const box=$('#resourceTokenRows');box.innerHTML='';for(const [name,m] of D.resourceMultipliers){const el=document.createElement('div');el.className='counter-item';el.innerHTML=`<span>${esc(name)} · ×${m}</span><input inputmode="numeric" placeholder="0" value="${esc(S.resource.counts[name])}">`;el.querySelector('input').addEventListener('input',e=>{S.resource.counts[name]=e.target.value;recalc()});box.append(el)}}
function renderBooks(){
 const tb=$('#bookRows');tb.innerHTML='';
 for(const a of ['Энциклопедия',...ATTRS]){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${a}</td>${['V','IV','III','II','I'].map(k=>`<td><input inputmode="numeric" aria-label="${a} ${k}" data-k="${k}" value="${esc(S.books[a][k])}" placeholder="0"></td>`).join('')}`;
  tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{S.books[a][e.target.dataset.k]=e.target.value;recalc()}));tb.append(tr)
 }
 const packValue=$('#packIIIEach');if(packValue){packValue.value=S.bookPackIIIEach;packValue.oninput=e=>{S.bookPackIIIEach=e.target.value;recalc()};}
 const packs=$('#bookPacks');packs.innerHTML='';
 for(const a of ['Энциклопедия',...ATTRS]){
  const group=document.createElement('div');group.className='book-pack-row';
  group.innerHTML=`<b>${a}</b>${[
    ['packI15','I','100'],['packII15','II','1000'],['packIII15','III','?']
   ].map(([k,label,val])=>`<label>Магия ${label}<small>${val==='?'?'15 смотр. · номинал выше':'15 × '+val}</small><input data-k="${k}" inputmode="numeric" value="${esc(S.books[a][k])}" placeholder="0"></label>`).join('')}`;
  group.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{S.books[a][e.target.dataset.k]=e.target.value;recalc()}));packs.append(group)
 }
}
function renderTasting(){const box=$('#tastingRows');box.innerHTML='';for(const [name,v] of Object.entries(D.tasting)){const el=document.createElement('div');el.className='counter-item';el.innerHTML=`<span>${name} · +${v}</span><input inputmode="numeric" placeholder="0" value="${esc(S.tasting[name])}">`;el.querySelector('input').addEventListener('input',e=>{S.tasting[name]=e.target.value;recalc()});box.append(el)}}
function renderItems(type){const defs=D[type],state=S[type],box=$('#'+type+'Rows');box.innerHTML='';for(const [name,range] of Object.entries(defs)){const fixed=range[0]===range[1];const el=document.createElement('div');el.className='item-row';el.innerHTML=`<div><b>${name}</b><div class="meta">${fixed?'+'+range[0]:'+'+range[0]+'…'+range[1]} за предмет</div></div><input inputmode="numeric" placeholder="0" value="${esc(state[name])}">`;el.querySelector('input').addEventListener('input',e=>{state[name]=e.target.value;recalc()});box.append(el)}}

function newManualSource(){return {id:++manualSourceSeq,source:'',gain:'',note:''}}
function renderManualDominionSources(){
 const box=$('#manualDominionRows');if(!box)return;box.innerHTML='';
 const opts='<option value="">Выбери систему</option>'+E.MANUAL_DOMINION_SOURCES.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');
 for(const row of S.manualSources){
  const el=document.createElement('div');el.className='manual-source-row';
  el.innerHTML=`<label>Источник<select class="manual-source-select">${opts}</select></label>
   <label>Подтверждённый прирост<input class="manual-source-gain" inputmode="decimal" value="${esc(row.gain)}" placeholder="например 1,25M"></label>
   <label>Заметка / контрольный экран<input class="manual-source-note" value="${esc(row.note)}" placeholder="например, улучшение узла 112"></label>
   <button class="remove-btn" type="button" aria-label="Удалить источник">×</button>`;
  const select=el.querySelector('.manual-source-select');select.value=row.source||'';
  select.addEventListener('change',e=>{row.source=e.target.value;recalc()});
  el.querySelector('.manual-source-gain').addEventListener('input',e=>{row.gain=e.target.value;recalc()});
  el.querySelector('.manual-source-note').addEventListener('input',e=>{row.note=e.target.value;scheduleLocalSave()});
  el.querySelector('.remove-btn').addEventListener('click',()=>{S.manualSources=S.manualSources.filter(x=>x.id!==row.id);renderManualDominionSources();recalc()});
  box.append(el);
 }
 setText('#manualSourceCount',String(S.manualSources.length));
}
$('#addManualDominionSource').addEventListener('click',()=>{S.manualSources.push(newManualSource());renderManualDominionSources();recalc()});

function newGuildMember(){
 return {id:++guildMemberSeq,name:'',counts:Object.fromEntries((D.guildExperienceItems||[]).map(item=>[item.key,'']))};
}
function renderGuildMembers(){
 const box=$('#guildMemberRows');if(!box)return;box.innerHTML='';
 const defs=D.guildExperienceItems||[];
 for(const member of S.guildExp.members){
  member.counts=member.counts||{};
  for(const item of defs) if(member.counts[item.key]===undefined)member.counts[item.key]='';
  const el=document.createElement('article');el.className='guild-member-card';el.dataset.memberId=String(member.id);
  el.innerHTML=`<div class="guild-member-head">
    <label class="guild-member-name">Участник / ник<input class="guild-name" value="${esc(member.name)}" placeholder="Имя участника"></label>
    <div class="guild-member-total"><span>Опыт участника</span><strong data-guild-member-total>0</strong><small data-guild-member-items>0 предметов</small></div>
    <button class="remove-btn guild-remove" type="button" aria-label="Удалить участника">×</button>
   </div>
   <div class="guild-item-grid">${defs.map(item=>`<label><span>${esc(item.name)}<small>+ ${intfmt(item.experience)} опыта / шт.</small></span><input type="number" min="0" step="1" inputmode="numeric" data-item-key="${esc(item.key)}" value="${esc(member.counts[item.key])}" placeholder="0" aria-label="${esc(item.name)}"></label>`).join('')}</div>`;
  el.querySelector('.guild-name').addEventListener('input',e=>{member.name=e.target.value;recalc()});
  el.querySelectorAll('[data-item-key]').forEach(input=>input.addEventListener('input',e=>{member.counts[e.target.dataset.itemKey]=e.target.value;recalc()}));
  el.querySelector('.guild-remove').addEventListener('click',()=>{S.guildExp.members=S.guildExp.members.filter(x=>x.id!==member.id);renderGuildMembers();recalc()});
  box.append(el);
 }
 const add=$('#addGuildMember');if(add){add.disabled=S.guildExp.members.length>=29;add.innerHTML=S.guildExp.members.length>=29?'Лимит участников <span class="count-badge">29 / 29</span>':'+ Добавить участника <span class="count-badge">'+S.guildExp.members.length+' / 29</span>';}
 setText('#guildMemberCount',String(S.guildExp.members.length));
}
$('#addGuildMember').addEventListener('click',()=>{
 if(S.guildExp.members.length>=29)return;
 S.guildExp.members.push(newGuildMember());renderGuildMembers();recalc();
});
function renderHeirRings(){
 const box=$('#heirRingRows');if(!box)return;box.innerHTML='';
 for(const type of E.HEIR_RING_TYPES){
  const rowState=S.heirs.rings[type.key]||(S.heirs.rings[type.key]={stock:'',planned:'',gainPerMarriage:''});
  const el=document.createElement('div');el.className='heir-ring-row';
  el.innerHTML=`<div class="heir-ring-label"><b>${esc(type.name)}</b><small>Для наследников: ${esc(type.rank)}</small></div>
   <label>В сумке<input data-field="stock" inputmode="numeric" value="${esc(rowState.stock)}" placeholder="0"></label>
   <label>План браков<input data-field="planned" inputmode="numeric" value="${esc(rowState.planned)}" placeholder="0"></label>
   <label>Прирост за брак<input data-field="gainPerMarriage" inputmode="decimal" value="${esc(rowState.gainPerMarriage)}" placeholder="значение из игры"></label>`;
  el.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{rowState[e.target.dataset.field]=e.target.value;recalc()}));
  box.append(el);
 }
}
function initBloodBondCoverage(){
 const search=$('#bloodBondCoverageSearch');
 const rowsBox=$('#bloodBondCoverageRows');
 const meta=$('#bloodBondCoverageMeta');
 const rosterRowsBox=$('#bloodBondRosterCoverageRows');
 const rosterMeta=$('#bloodBondRosterCoverageMeta');
 const status=$('#bloodBondCoverageStatus');
 const communityRowsBox=$('#communityWardenRosterRows');
 const communityMeta=$('#communityWardenRosterMeta');
 if(!rowsBox||!rosterRowsBox||!communityRowsBox)return;
 let candidates=[],localRosterCoverage=[],communityNames=[],aliasesRequiringConfirmation=[];
 const typeLabels={All:'Все атрибуты',Dual:'Два атрибута',Single:'Один атрибут'};
 const localizationLabels={
  'matched-name':'Кандидат по имени · требует сверки',
  'probable-localization':'Вероятная локализация · подтвердить',
  'unresolved-localization':'Сопоставление не подтверждено'
 };
 const rosterStatusLabels={
  'candidate-pair-found-needs-game-verification':'Кандидат найден · нужна проверка в игре',
  'candidate-pair-needs-localization-review':'Нужно проверить локализацию имени',
  'no-pair-found-in-this-public-candidate-table':'Пара не найдена в этой публичной выборке'
 };
 function render(){
  const query=String(search?.value||'').trim().toLocaleLowerCase('ru-RU');
  const candidateIndex=new Map(candidates.map(row=>[row.candidateId,row]));
  const filtered=candidates.filter(row=>[
   row.publicPartnerLabel,row.publicWardenName,row.possibleLocalWarden,row.candidateId,row.bondClass,row.localizationStatus
  ].some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(query)));
  if(meta)meta.textContent=query?`${filtered.length} из ${candidates.length} кандидатных связок`:`${candidates.length} кандидатных связок`;
  rowsBox.innerHTML=filtered.length?filtered.map(row=>`<tr>
   <td><code>${esc(row.candidateId)}</code></td>
   <td>${esc(row.publicPartnerLabel)}</td>
   <td>${esc(row.publicWardenName)}</td>
   <td>${esc(row.possibleLocalWarden||'—')}</td>
   <td>${esc(typeLabels[row.bondClass]||row.bondClass||'не указан')}</td>
   <td><span class="coverage-status">${esc(localizationLabels[row.localizationStatus]||row.localizationStatus||'неизвестно')}</span></td>
  </tr>`).join(''):`<tr><td colspan="6">${candidates.length?'По такому запросу связок не найдено.':'Реестр пока не загружен.'}</td></tr>`;

  const filteredCommunity=communityNames.filter(name=>{
   const alias=aliasesRequiringConfirmation.find(row=>row.sourceName===name);
   const related=candidates.filter(row=>String(row.publicWardenName||'').toLocaleLowerCase('en-US')===String(name).toLocaleLowerCase('en-US'));
   return [name,alias&&alias.localName,...related.flatMap(row=>[row.possibleLocalWarden,row.publicPartnerLabel,row.candidateId])]
    .some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(query));
  });
  if(communityMeta)communityMeta.textContent=query?filteredCommunity.length+' из '+communityNames.length+' имён':communityNames.length+' имён из публичного списка';
  communityRowsBox.innerHTML=filteredCommunity.length?filteredCommunity.map(name=>{
   const related=candidates.filter(row=>String(row.publicWardenName||'').toLocaleLowerCase('en-US')===String(name||'').toLocaleLowerCase('en-US'));
   const match=related[0]||null;
   const alias=aliasesRequiringConfirmation.find(row=>row.sourceName===name);
   let localName=match?.possibleLocalWarden||'—';
   let mappingStatus=match?(localizationLabels[match.localizationStatus]||match.localizationStatus||'кандидатная связь'):'Не сопоставлено с локальным профилем';
   if(alias){localName=alias.localName;mappingStatus='Возможный псевдоним · требуется проверка в игре';}
   if(name==='Dominique'){localName='—';mappingStatus='Нет очевидного локального соответствия; не добавлять автоматически';}
   const partnerText=related.length?related.map(row=>row.publicPartnerLabel).join('; '):'Пара не найдена в публичном списке из 43 связок';
   const state=match?'Есть кандидат связи · не подтверждено в клиенте':'Нужна отдельная проверка партнёра и навыков';
   return '<tr><td><b>'+esc(name)+'</b></td><td>'+esc(localName)+'</td><td>'+esc(partnerText)+'</td><td>'+esc(mappingStatus)+'</td><td>'+esc(state)+'</td></tr>';
  }).join(''):'<tr><td colspan="5">По этому запросу имена не найдены.</td></tr>';

  const filteredRoster=localRosterCoverage.filter(row=>{
   const related=(row.publicCandidateBondPairs||[]).map(id=>candidateIndex.get(id)).filter(Boolean);
   const relatedText=related.flatMap(item=>[item.candidateId,item.publicPartnerLabel,item.publicWardenName,item.possibleLocalWarden]).join(' ');
   return [row.localWardenName,row.coverageStatus,relatedText]
    .some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(query));
  });
  if(rosterMeta)rosterMeta.textContent=query?`${filteredRoster.length} из ${localRosterCoverage.length} профилей`:`${localRosterCoverage.length} локальных профилей`;
  rosterRowsBox.innerHTML=filteredRoster.length?filteredRoster.map(row=>{
   const related=(row.publicCandidateBondPairs||[]).map(id=>candidateIndex.get(id)).filter(Boolean);
   const relatedText=related.length?related.map(item=>`${item.candidateId} · ${item.publicPartnerLabel}`).join('; '):'В кандидатном наборе не найдено';
   const exactText=row.exactCalculationEnabled===true?'Разрешено':'Отключено · нет полной подтверждённой таблицы';
   return `<tr>
    <td><b>${esc(row.localWardenName)}</b></td>
    <td>${esc(relatedText)}</td>
    <td><span class="coverage-status">${esc(rosterStatusLabels[row.coverageStatus]||row.coverageStatus||'Статус неизвестен')}</span></td>
    <td>${esc(exactText)}</td>
   </tr>`;
  }).join(''):`<tr><td colspan="4">${localRosterCoverage.length?'По такому запросу Смотрители не найдены.':'Каталог покрытия пока не загружен.'}</td></tr>`;
 }
  search?.addEventListener('input',render);
 fetch('./game-data/blood-bond-pairing-candidates.json')
  .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()})
  .then(payload=>{
   candidates=Array.isArray(payload.candidatePairs)?payload.candidatePairs:[];
   localRosterCoverage=Array.isArray(payload.localRosterCoverage)?payload.localRosterCoverage:[];
   render();
   if(status){
    status.className='goal-status warn';
    status.textContent='Загружено '+candidates.length+' кандидатных связок и '+localRosterCoverage.length+' локальных профилей. В наборе нет числовых формул; имена, тип связи и актуальность нужно подтвердить в игре. Ни одна строка не включена в расчёт господства.';
   }
  })
  .catch(()=>{
   if(meta)meta.textContent='Реестр недоступен';
   if(rosterMeta)rosterMeta.textContent='Каталог недоступен';
   rowsBox.innerHTML='<tr><td colspan="6">Не удалось загрузить реестр. Проверь подключение или открой JSON по ссылке ниже.</td></tr>';
   rosterRowsBox.innerHTML='<tr><td colspan="4">Не удалось загрузить каталог покрытия.</td></tr>';
   if(status){status.className='goal-status warn';status.textContent='Реестр кандидатов недоступен. Расчёты калькулятора продолжают работать; список можно открыть напрямую в GitHub.'}
  });

 fetch('./game-data/community-warden-roster-candidates.json')
  .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()})
  .then(payload=>{
   communityNames=Array.isArray(payload.names)?payload.names:[];
   aliasesRequiringConfirmation=Array.isArray(payload.reconciliation?.aliasesRequiringConfirmation)?payload.reconciliation.aliasesRequiringConfirmation:[];
   render();
  })
  .catch(()=>{
   if(communityMeta)communityMeta.textContent='Внешний список недоступен';
   communityRowsBox.innerHTML='<tr><td colspan="5">Не удалось загрузить кандидатный список. Открой JSON по ссылке ниже.</td></tr>';
  });
}

function initGardenCoverage(){
 const search=$('#gardenCoverageSearch');
 const filter=$('#gardenCoverageFilter');
 const rowsBox=$('#gardenCoverageRows');
 const meta=$('#gardenCoverageMeta');
 const status=$('#gardenCoverageStatus');
 if(!rowsBox)return;
 let observations=[],candidates=[],maxLevel=140,claimedPoints=18900;
 function numericDisplay(value){
  const raw=String(value??'').replace(/[^0-9,.-]/g,'').replace(',','.');
  const out=Number(raw);return Number.isFinite(out)?out:null;
 }
 function render(){
  const observedByLevel=new Map(observations.map(row=>[Number(row.level),row]));
  const candidateByLevel=new Map(candidates.map(row=>[Number(row.level),row]));
  const query=String(search?.value||'').trim().toLocaleLowerCase('ru-RU');
  const mode=String(filter?.value||'all');
  const rows=Array.from({length:maxLevel},(_,index)=>{
   const level=index+1;
   return {level,observation:observedByLevel.get(level)||null,candidate:candidateByLevel.get(level)||null};
  }).filter(row=>{
   const isObserved=Boolean(row.observation);
   if(mode==='observed'&&!isObserved)return false;
   if(mode==='missing'&&isObserved)return false;
   if(!query)return true;
   const o=row.observation,c=row.candidate;
   const searchable=[
    row.level,o?.category,o?.rawCostDisplay,c?.cost,c?.points,
    ...(o?.bonuses||[]).flatMap(bonus=>[bonus.attribute,bonus.displayed]),o?.status
   ].map(value=>String(value??'').toLocaleLowerCase('ru-RU'));
   return searchable.some(value=>value.includes(query));
  });
  const observedCount=observations.length;
  if(meta)meta.textContent=query||mode!=='all'
    ?`${rows.length} из ${maxLevel} уровней · ${observedCount} с игровыми наблюдениями`
    :`${observedCount} из ${maxLevel} уровней с игровыми наблюдениями`;
  rowsBox.innerHTML=rows.length?rows.map(({level,observation:o,candidate:c})=>{
   const effect=o&&Array.isArray(o.bonuses)&&o.bonuses.length
    ?o.bonuses.map(b=>`${b.attribute}: ${b.displayed}`).join('; ')
    :'Нет подтверждённого эффекта';
   let observedCost='Нет подтверждённой цены';
   if(o?.cost!==null&&o?.cost!==undefined)observedCost=String(o.cost);
   else if(o?.rawCostDisplay)observedCost=`Сырая строка «${o.rawCostDisplay}»`;
   const candidateText=c?`Цена ${intfmt(c.cost)} · points ${intfmt(c.points)}`:'Нет кандидатной строки';
   const observedTotal=o?.bonuses?.length
    ?o.bonuses.reduce((sum,b)=>sum+(numericDisplay(b.displayed)||0),0):null;
   const conflict=Boolean(c&&observedTotal!==null&&observedTotal!==Number(c.points));
   const rowStatus=conflict
    ?'РАСХОЖДЕНИЕ · не использовать'
    :o&&c?'Снимок есть · совпадение чисел не доказывает формулу'
    :o?'Только наблюдение из игрового экрана'
    :c?'Только кандидат сообщества · не подтверждён'
    :'Нет данных';
   return `<tr class="${conflict?'garden-conflict-row':o?'garden-observed-row':'garden-missing-row'}">
    <td><b>${level}</b></td>
    <td>${esc(o?.category||'—')}</td>
    <td>${esc(effect)}</td>
    <td>${esc(observedCost)}</td>
    <td>${esc(candidateText)}</td>
    <td><span class="coverage-status">${esc(rowStatus)}</span></td>
   </tr>`;
  }).join(''):'<tr><td colspan="6">По заданному фильтру уровни не найдены.</td></tr>';
 }
 search?.addEventListener('input',render);
 filter?.addEventListener('change',render);
 fetch('./game-data/garden-observations.json')
  .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()})
  .then(payload=>{
   observations=Array.isArray(payload.observations)?payload.observations:[];
   const candidatePayload=payload.communityCandidateCheckpoints||{};
   candidates=Array.isArray(candidatePayload.rows)?candidatePayload.rows:[];
   const aggregate=payload.communityAggregate||{};
   maxLevel=Math.max(1,Math.min(500,Math.round(Number(aggregate.claimedMaxLevel)||140)));
   claimedPoints=Number(aggregate.claimedTotalPointsToMax)||18900;
   render();
   if(status){
    status.className='goal-status warn';
    status.textContent=`В реестре ${observations.length} игровых наблюдений и ${candidates.length} кандидатных строк сообщества на ${maxLevel} заявленных уровнях. Сумма ${intfmt(claimedPoints)} очков — неподтверждённый агрегат. Расхождение уровня 112 выделено отдельно. Ни одна кандидатная цифра не включена в прогноз господства.`;
   }
  })
  .catch(()=>{
   if(meta)meta.textContent='Реестр Сада недоступен';
   rowsBox.innerHTML='<tr><td colspan="6">Не удалось загрузить реестр уровней Сада.</td></tr>';
   if(status){status.className='goal-status warn';status.textContent='Данные Сада недоступны. Никакие неподтверждённые значения не включаются в прогноз.'}
  });
}

function getConclave(){const seals={};for(const a of ATTRS)seals[a]={current:n(S.conclave[a].current),target:n(S.conclave[a].target)};const totals=Object.fromEntries(ATTRS.map(a=>[a,parse(S.conclaveAttrTotals[a])]));return E.conclaveCalc({watcherCount:n(S.profile.watchers),seals,attrTotals:totals})}
function getBookBonusFinal(conc){return Object.fromEntries(ATTRS.map(a=>[a,conc.details[a]?.finalBookBonusPct||0]))}

function recalc(){
 scheduleLocalSave();
 const guild=E.guildExperienceCalc(S.guildExp.members);
 setText('#guildExpTotal',intfmt(guild.total));
 setText('#guildExpItemsTotal',intfmt(guild.totalItems));
 setText('#guildExpContributors',intfmt(guild.contributors));
 const guildBreakdown=$('#guildExpBreakdown');
 if(guildBreakdown)guildBreakdown.innerHTML=(D.guildExperienceItems||[]).map(item=>`<div class="break-row"><span>${esc(item.name)} · ${intfmt(guild.itemTotals[item.key]||0)} шт.</span><b>+${intfmt((guild.itemTotals[item.key]||0)*item.experience)}</b></div>`).join('');
 const guildStatus=$('#guildExpStatus');
 if(guildStatus){
  guildStatus.className='goal-status';
  if(!guild.complete){guildStatus.classList.add('warn');guildStatus.textContent='Проверь количества: предметы должны быть целыми неотрицательными числами. Ошибочные ячейки временно не включены в расчёт.'}
  else{guildStatus.textContent='Расчёт использует коэффициенты из файла «счет опыта ги.xlsx». Перед использованием как эталонного результата сверь их с актуальной игрой: источник пока не подтверждён отдельно в клиенте.'}
 }
 const guildDetails=new Map(guild.members.map(row=>[String(row.id),row]));
 $('#guildMemberRows .guild-member-card').forEach(card=>{
  const detail=guildDetails.get(card.dataset.memberId);
  const total=card.querySelector('[data-guild-member-total]');
  const items=card.querySelector('[data-guild-member-items]');
  if(total)total.textContent=intfmt(detail?detail.total:0);
  if(items)items.textContent=intfmt(detail?detail.totalItems:0)+' предметов';
 });
 const conc=getConclave();
 const conclaveAudit=E.conclaveDataAudit();
 setText('#conclaveGain',fmt(conc.gain));setText('#conclaveGainLabel',conclaveAudit.fullyMatched?'Прирост Конклава':'Предварительный прирост · не включён в итог');setText('#conclaveCouncil',conc.councilComplete?fmt(conc.council):'нет данных');
 const auditBox=$('#conclaveDataAudit');
 if(auditBox){
  auditBox.className='goal-status';
  if(conclaveAudit.fullyMatched){auditBox.classList.add('good');auditBox.textContent='Таблица Конклава совпадает с контрольными суммами по опубликованным агрегатам и имеет полные стоимости всех уровней.'}
  else{auditBox.classList.add('warn');auditBox.textContent='ПРЕДВАРИТЕЛЬНО: историческая таблица не совпадает с контрольными итогами сообщества. Одна ветвь: '+fmt(conclaveAudit.directAttribute)+' против '+fmt(conclaveAudit.expectedDirectAttribute)+' атрибута; книги: '+conclaveAudit.bookBonusPct+'% против '+conclaveAudit.expectedBookBonusPct+'%; нет цены для '+conclaveAudit.missingCostLevels.length+' уровней. Прирост Конклава не включён в общий итог, пока таблица не будет восстановлена по уровням.'}
 }
 const summaryTrust=$('#domSummaryTrust');
 if(summaryTrust){summaryTrust.className='goal-status';if(!conclaveAudit.fullyMatched){summaryTrust.classList.add('warn');summaryTrust.textContent='Общий прогноз пока не включает прирост Конклава и его бонус книг: контрольные суммы текущей таблицы расходятся с источником сообщества. Остальные модули показываются по своим статусам проверки.'}else{summaryTrust.classList.add('good');summaryTrust.textContent='Таблица Конклава прошла сверку контрольных сумм.'}}
 const council=parseDefault(S.profile.council,1e6);const councilEntered=String(S.profile.council||'').trim()!=='';const cst=E.requirementStatus(council,conc.council,conc.councilComplete,councilEntered);
 const ccard=$('#conclaveStatusCard');if(ccard)ccard.className='status-card '+cst.state;setText('#conclaveStatus',cst.label);setText('#conclaveStatusHint',cst.hint);
 $$('#conclaveRows .seal-row').forEach((row,i)=>{const a=ATTRS[i],d=conc.details[a];row.querySelector('[data-out]').textContent=d?`+${fmt(d.direct+d.bookEffect)} · книги +${d.deltaBookPct.toLocaleString('ru-RU',{maximumFractionDigits:1})}%`:'+0'});
 const inspiration=recalcInspirationPills();
 let wGain=0,wBlood=0;
 $$('#wardenCards .warden-card').forEach((card,i)=>{const w=S.wardens[i];const calc=E.wardenCalc({name:w.name,currentLevel:n(w.currentLevel),targetLevel:n(w.targetLevel),talents:w.talents,inspiration});wGain+=calc.gain;wBlood+=calc.blood;card.querySelector('.w-blood').textContent=fmt(calc.blood);card.querySelector('.w-gain').textContent=calc.gainReady?fmt(calc.gain):'—';card.querySelector('.w-status').textContent=calc.dataStatus==='incomplete'?'профиль требует проверки':!calc.active?'заполни героя и уровни':!calc.gainReady?'введи текущие уровни всех талантов':'готово';card.querySelectorAll('[data-plan]').forEach((el,j)=>{const t=calc.talents[j];el.textContent=t&&t.planned?`+${t.planned} ур.`:'—'});card.querySelectorAll('[data-exp]').forEach((el,j)=>{const t=calc.talents[j];if(!t){el.textContent='EXP не указан';return}el.textContent=t.expValue>0?`остаток ${intfmt(t.expRemainder)} · до +1: ${intfmt(t.expToNext)} EXP`:'EXP не указан'});});
 const other=E.otherWatcherGain(S.otherWardens,inspiration);wGain+=other.gain;
 const resource=E.resourceCalc(parseDefault(S.resource.one,1e6),S.resource.counts);setText('#resourceTotal',fmt(resource.total));
 const availBlood=parseDefault(S.profile.blood,1e9)+(S.resource.type==='Кровь'?resource.total:0);setText('#wardenBlood',fmt(wBlood));setText('#wardenGain',fmt(wGain));setText('#wardenBloodStatus',wBlood===0?'—':availBlood>=wBlood?`хватает · запас ${fmt(availBlood-wBlood)}`:`не хватает ${fmt(wBlood-availBlood)}`);
 const bookBonusForCalc=conclaveAudit.fullyMatched?getBookBonusFinal(conc):Object.fromEntries(ATTRS.map(a=>[a,0]));
 const books=E.booksCalc(S.books,bookBonusForCalc,n(S.bookPackIIIEach));const tasting=E.tastingCalc(S.tasting);const misc=E.miscCalc(Object.fromEntries(Object.entries(S.misc).map(([k,v])=>[k,parse(v)])));setText('#booksGain',fmt(books.gain));setText('#tastingGain',fmt(tasting.gain));setText('#miscGain',fmt(misc.gain));
 const booksAudit=$('#booksConclaveAudit');if(booksAudit){booksAudit.className='goal-status';if(!conclaveAudit.fullyMatched){booksAudit.classList.add('warn');booksAudit.textContent='Бонус книг Конклава временно отключён в этом расчёте, потому что таблица бонусов не прошла сверку. Книги считаются без этого множителя.'}else{booksAudit.classList.add('good');booksAudit.textContent='Бонус книг Конклава включён по сверенной таблице.'}}
 const heirs=E.heirMarriageCalc({rings:S.heirs.rings});
 const manual=E.manualSourcesCalc(S.manualSources);
 setText('#manualSourcesGain',fmt(manual.gain));
 const manualStatus=$('#manualSourcesStatus');
 if(manualStatus){
  manualStatus.className='goal-status';
  if(manual.invalidRows.length){manualStatus.classList.add('warn');manualStatus.textContent='Есть '+manual.invalidRows.length+' строк(и) с неверным источником или форматом числа. Они не включены в прогноз.'}
  else if(manual.missingRows.length){manualStatus.classList.add('warn');manualStatus.textContent='Заполни источник и подтверждённый прирост ещё в '+manual.missingRows.length+' строк(ах), либо удали пустые строки. Пустые строки не включены в расчёт.'}
  else if(manual.details.length){manualStatus.textContent='В прогноз добавлены только введённые приросты: '+manual.details.length+'. Не дублируй здесь значения, уже учитываемые Конклавом, Смотрителями, книгами, Дегустацией, прочими формулами или кольцами.'}
  else{manualStatus.textContent='Используй этот блок временно для подтверждённых приростов систем, для которых ещё нет проверенной автоматической формулы.'}
 }
 setText('#heirsGain',fmt(heirs.gain));setText('#heirsPlanned',intfmt(heirs.planned));setText('#heirsShortage',intfmt(heirs.shortage));
 const heirsStatus=$('#heirsStatus');
 if(heirsStatus){
  heirsStatus.className='goal-status';
  if(heirs.planned===0){heirsStatus.textContent='Добавь планируемые браки и фактический прирост господства за каждый тип кольца. Запас колец сам по себе господство не добавляет.'}
  else if(!heirs.complete){heirsStatus.classList.add('warn');const missing=heirs.unknownTypes.map(k=>E.HEIR_RING_TYPES.find(t=>t.key===k)?.name||k).join(', ');heirsStatus.textContent='Не указано подтверждённое господство за брак: '+missing+'. Эти строки не включены в прогноз, пока значение не введено.'}
  else if(heirs.shortage>0){heirsStatus.classList.add('warn');heirsStatus.textContent='План рассчитан по введённым значениям, но не хватает '+intfmt(heirs.shortage)+' колец. Прогноз прироста: '+fmt(heirs.gain)+'.'}
  else{heirsStatus.classList.add('good');heirsStatus.textContent='План рассчитан по введённым игровым значениям. Прогноз дополнительного господства: '+fmt(heirs.gain)+'.'}
 }
 const magicIIIUsed=Object.values(S.books).some(row=>n(row.packIII15)>0);const bh=$('#booksHint');if(bh){bh.className='goal-status';if(magicIIIUsed&&!n(S.bookPackIIIEach)){bh.classList.add('warn');bh.textContent='Есть Магия III, но не указан её номинал. Перепиши число с карточки предмета — до этого Магия III в итог не входит.'}else if(magicIIIUsed){bh.classList.add('good');bh.textContent=`Магия III учтена: по ${intfmt(n(S.bookPackIIIEach))} каждому из 15 смотрителей.`}else{bh.textContent='Добавь только те книги и предметы «Магия», которые собираешься использовать.'}}
 const acceptedConclaveGain=conclaveAudit.fullyMatched?conc.gain:0;
 const overallGain=acceptedConclaveGain+wGain+books.gain+tasting.gain+misc.gain+heirs.gain+manual.gain;const current=parseDefault(S.profile.dominion,1e6);setText('#domCurrent',current?fmt(current):'—');setText('#domGain',fmt(overallGain));setText('#domFinal',current?fmt(current+overallGain):'—');setText('#homeGain',overallGain?fmt(overallGain):'—');setText('#homeFinal',current?fmt(current+overallGain):'—');
 const parts=[...(conclaveAudit.fullyMatched?[['Конклав',conc.gain]]:[]),['Смотрители',wGain],['Книги',books.gain],['Дегустация',tasting.gain],['Прочее',misc.gain],['Наследники и браки',heirs.gain],...Object.entries(manual.bySource)].filter(x=>x[1]>0);
 const provisionalConclave=!conclaveAudit.fullyMatched&&conc.gain>0?`<div class="break-row provisional"><span>Конклав · предварительно, не включён в итог</span><b>+${fmt(conc.gain)}</b></div>`:'';
 $('#domBreakdown').innerHTML=provisionalConclave+(parts.length?parts.map(([k,v])=>`<div class="break-row"><span>${k}</span><b>+${fmt(v)}</b></div>`).join(''):'<div class="note">План пока пуст. Заполни только те разделы, которые собираешься использовать.</div>');
 const tr=E.talentRatingCalc(S.ratingRows,S.ratingManuscripts,{...S.scrolls});setText('#talentWatcherScore',intfmt(tr.watcherScore));setText('#talentManScore',intfmt(tr.manuscriptScore));setText('#talentTotalScore',intfmt(tr.score));setText('#scrollPool',intfmt(tr.scrollPool));setText('#scrollScore',intfmt(tr.scrollScore));$('#talentDetails').innerHTML=tr.details.length?tr.details.map(r=>{const expState=r.remainder===0?`до следующего ×${r.star}: ${intfmt(r.threshold)} EXP`:`остаток ${intfmt(r.remainder)} · до следующего: ${intfmt(r.missing)} EXP`;return `<div class="break-row"><span>${esc(r.name||'Смотритель')} · ×${r.star} · EXP ${intfmt(r.exp)}</span><b>+${r.score} · ${expState}</b></div>`}).join(''):'';
 const cl=E.closenessCalc(Object.fromEntries(Object.entries(S.closeness).map(([k,v])=>[k,n(v)])));setText('#closenessMin',intfmt(cl.min));setText('#closenessAvg',intfmt(cl.avg));setText('#closenessMax',intfmt(cl.max));goalStatus('#closenessStatus',n(S.closenessGoal),cl);
 const at=E.attractionCalc(Object.fromEntries(Object.entries(S.attraction).map(([k,v])=>[k,n(v)])));setText('#attractionMin',intfmt(at.min));setText('#attractionAvg',intfmt(at.avg));setText('#attractionMax',intfmt(at.max));goalStatus('#attractionStatus',n(S.attractionGoal),at);
}
function goalStatus(id,goal,r){const el=$(id);el.className='goal-status';if(!goal){el.textContent='Укажи цель, если хочешь проверить, хватает ли предметов.';return}if(r.min>=goal){el.classList.add('good');el.textContent=`Гарантированно хватает. Даже минимум выше цели на ${intfmt(r.min-goal)}.`}else if(r.max<goal){el.classList.add('bad');el.textContent=`Не хватает даже при максимальном выпадении: ещё ${intfmt(goal-r.max)}.`}else{el.classList.add('warn');el.textContent=`Может хватить, но не гарантировано. До цели от ${intfmt(Math.max(0,goal-r.avg))} по средней оценке.`}}

const STORAGE_KEY='vd_state_v220';
let saveTimer=null;
function serializableState(){return JSON.parse(JSON.stringify(S))}
function saveLocalState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(serializableState()))}catch(e){}}
function scheduleLocalSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveLocalState,250)}
function loadLocalState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;const saved=JSON.parse(raw);const base=freshState();S={...base,...saved,profile:{...base.profile,...(saved.profile||{})},conclave:{...base.conclave,...(saved.conclave||{})},conclaveAttrTotals:{...base.conclaveAttrTotals,...(saved.conclaveAttrTotals||{})},inspiration:Array.isArray(saved.inspiration)?saved.inspiration:[],wardens:Array.isArray(saved.wardens)?saved.wardens:[],otherWardens:Array.isArray(saved.otherWardens)?saved.otherWardens:[],ratingRows:Array.isArray(saved.ratingRows)?saved.ratingRows:[],ratingManuscripts:{...base.ratingManuscripts,...(saved.ratingManuscripts||{})},scrolls:{...base.scrolls,...(saved.scrolls||{})},resource:{...base.resource,...(saved.resource||{}),counts:{...base.resource.counts,...((saved.resource||{}).counts||{})}},books:{...base.books,...(saved.books||{})},tasting:{...base.tasting,...(saved.tasting||{})},misc:{...base.misc,...(saved.misc||{})},closeness:{...base.closeness,...(saved.closeness||{})},attraction:{...base.attraction,...(saved.attraction||{})},heirs:{...base.heirs,...(saved.heirs||{}),rings:{...base.heirs.rings,...(((saved.heirs||{}).rings)||{})}},manualSources:Array.isArray(saved.manualSources)?saved.manualSources:[],guildExp:{...base.guildExp,...(saved.guildExp||{}),members:Array.isArray((saved.guildExp||{}).members)?saved.guildExp.members:base.guildExp.members}};Object.keys(base.books).forEach(k=>S.books[k]={...base.books[k],...(S.books[k]||{})});Object.keys(base.heirs.rings).forEach(k=>S.heirs.rings[k]={...base.heirs.rings[k],...((S.heirs.rings&&S.heirs.rings[k])||{})});return true}catch(e){return false}}
function downloadBackup(){const p={schema:'vampire-dominion-local',version:2,createdAt:new Date().toISOString(),state:serializableState()};const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`vampire-dominion-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Резервная копия сохранена')}
function restoreBackup(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(String(r.result||''));localStorage.setItem(STORAGE_KEY,JSON.stringify(p.state||p));location.reload()}catch(e){alert('Не удалось восстановить JSON-бэкап Vampire Dominion.')}};r.readAsText(file,'utf-8')}
$('#saveBackup').addEventListener('click',downloadBackup);$('#loadBackup').addEventListener('click',()=>$('#backupFile').click());$('#backupFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)restoreBackup(f);e.target.value=''})

$('#resetAll').addEventListener('click',()=>{if(!confirm('Обнулить все введённые данные?'))return;S=freshState();wardenSeq=inspSeq=otherSeq=ratingSeq=manualSourceSeq=0;guildMemberSeq=Math.max(1,...S.guildExp.members.map(x=>Number(x.id)||1));localStorage.removeItem(STORAGE_KEY);renderAll();toast('Данные обнулены')});
function renderAll(){
 ['profileDominion','profileWatchers','profileBlood','profileCouncil'].forEach((id,i)=>{const keys=['dominion','watchers','blood','council'];$('#'+id).value=S.profile[keys[i]]});$('#closenessGoal').value=S.closenessGoal;$('#attractionGoal').value=S.attractionGoal;$('#oneCollect').value=S.resource.one;$('#resourceType').value=S.resource.type;$('#scrollHigh').value=S.scrolls.high;$('#scrollMid').value=S.scrolls.mid;$('#scrollSimple').value=S.scrolls.simple;$('#scrollStar').value=S.scrolls.star;$('#miscPlasma').value=S.misc.plasma;$('#miscVito').value=S.misc.vito;$('#miscTrust').value=S.misc.trustTotal;$('#miscRB').value=S.misc.heirsRB;$('#miscGP').value=S.misc.heirsGP;$('#miscS').value=S.misc.heirsS;$('#miscDirect').value=S.misc.directOther;if($('#packIIIEach'))$('#packIIIEach').value=S.bookPackIIIEach;
 renderConclave();renderInspiration();renderWardens();renderOtherWardens();renderRating();renderRatingManuscripts();renderResourceTokens();renderBooks();renderTasting();renderItems('closeness');renderItems('attraction');renderGuildMembers();renderHeirRings();renderManualDominionSources();recalc();
}

loadLocalState();
wardenSeq=Math.max(0,...S.wardens.map(x=>Number(x.id)||0));
inspSeq=Math.max(0,...S.inspiration.map(x=>Number(x.id)||0));
otherSeq=Math.max(0,...S.otherWardens.map(x=>Number(x.id)||0));
ratingSeq=Math.max(0,...S.ratingRows.map(x=>Number(x.id)||0));
manualSourceSeq=Math.max(0,...S.manualSources.map(x=>Number(x.id)||0));
guildMemberSeq=Math.max(0,...S.guildExp.members.map(x=>Number(x.id)||0));
bindStatic();renderAll();initBloodBondCoverage();initGardenCoverage();
if('scrollRestoration' in history) history.scrollRestoration='manual';
const showHero=()=>{if(!location.hash)window.scrollTo({top:0,left:0,behavior:'instant'})};
window.addEventListener('load',()=>setTimeout(showHero,40));window.addEventListener('pageshow',e=>{if(e.persisted)setTimeout(showHero,30)});
const tests=E.selfTests(window.VD_SAMPLES);$('#engineLamp').classList.add(tests.ok?'ok':'bad');$('#engineText').textContent=tests.ok?'Проверка пройдена · расчётный круг стабилен':'Ошибка самопроверки · расчёт временно недоступен';
if(!tests.ok) console.error('Self tests failed',tests);
})();

window.addEventListener('pagehide',saveLocalState);window.addEventListener('beforeunload',saveLocalState);
