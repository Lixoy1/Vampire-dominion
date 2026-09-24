(()=>{
'use strict';
const D=window.VD_DATA, E=window.VD_ENGINE;
const ATTRS=E.ATTRS;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const attrsShort={Сила:'Сила',Харизма:'Харизма',Интеллект:'Интеллект',Воля:'Воля'};
let wardenSeq=0,inspSeq=0,otherSeq=0,ratingSeq=0;

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
 attraction:Object.fromEntries(Object.keys(D.attraction).map(n=>[n,''])),attractionGoal:''
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

function renderOtherWardens(){const box=$('#otherWardenRows');box.innerHTML='';for(const r of S.otherWardens){const el=document.createElement('div');el.className='other-row';el.innerHTML=`<label>Уровень<input inputmode="numeric" value="${esc(r.level)}" placeholder="250"></label><label>Talent EXP<input inputmode="numeric" value="${esc(r.exp)}" placeholder="0"></label><label>Атрибут<select>${ATTRS.map(a=>`<option value="${a}">${a}</option>`).join('')}</select></label><button class="remove-btn">×</button>`;const ins=el.querySelectorAll('input');ins[0].addEventListener('input',e=>{r.level=e.target.value;recalc()});ins[1].addEventListener('input',e=>{r.exp=e.target.value;recalc()});const sel=el.querySelector('select');sel.value=r.attr||'Сила';sel.addEventListener('change',e=>{r.attr=e.target.value;recalc()});el.querySelector('button').addEventListener('click',()=>{S.otherWardens=S.otherWardens.filter(x=>x.id!==r.id);renderOtherWardens();recalc()});box.append(el)}}
$('#addOtherWarden').addEventListener('click',()=>{S.otherWardens.push({id:++otherSeq,level:'',exp:'',attr:'Сила'});renderOtherWardens();recalc()});

function renderRating(){const box=$('#talentRatingRows');box.innerHTML='';for(const r of S.ratingRows){if(r.name)r.star=maxStar(r.name);const el=document.createElement('div');el.className='rating-row';el.innerHTML=`<label>Смотритель<select class="r-name">${watcherOptions()}</select></label><label>Макс. талант<input class="r-star" value="×${r.star||1}" readonly></label><label>Talent EXP<input class="r-exp" inputmode="numeric" value="${esc(r.exp)}" placeholder="например 2612"></label><button class="remove-btn">×</button>`;const sel=el.querySelector('.r-name');sel.value=r.name||'';sel.addEventListener('change',e=>{r.name=e.target.value;r.star=maxStar(r.name);renderRating();recalc()});el.querySelector('.r-exp').addEventListener('input',e=>{r.exp=e.target.value;recalc()});el.querySelector('button').addEventListener('click',()=>{S.ratingRows=S.ratingRows.filter(x=>x.id!==r.id);renderRating();recalc()});box.append(el)}}
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

function getConclave(){const seals={};for(const a of ATTRS)seals[a]={current:n(S.conclave[a].current),target:n(S.conclave[a].target)};const totals=Object.fromEntries(ATTRS.map(a=>[a,parse(S.conclaveAttrTotals[a])]));return E.conclaveCalc({watcherCount:n(S.profile.watchers),seals,attrTotals:totals})}
function getBookBonusFinal(conc){return Object.fromEntries(ATTRS.map(a=>[a,conc.details[a]?.finalBookBonusPct||0]))}

function recalc(){
 scheduleLocalSave();
 const conc=getConclave();
 setText('#conclaveGain',fmt(conc.gain));setText('#conclaveCouncil',conc.councilComplete?fmt(conc.council):'нет данных');
 const council=parseDefault(S.profile.council,1e6);const councilEntered=String(S.profile.council||'').trim()!=='';const cst=E.requirementStatus(council,conc.council,conc.councilComplete,councilEntered);
 const ccard=$('#conclaveStatusCard');if(ccard)ccard.className='status-card '+cst.state;setText('#conclaveStatus',cst.label);setText('#conclaveStatusHint',cst.hint);
 $$('#conclaveRows .seal-row').forEach((row,i)=>{const a=ATTRS[i],d=conc.details[a];row.querySelector('[data-out]').textContent=d?`+${fmt(d.direct+d.bookEffect)} · книги +${d.deltaBookPct.toLocaleString('ru-RU',{maximumFractionDigits:1})}%`:'+0'});
 const inspiration=recalcInspirationPills();
 let wGain=0,wBlood=0;
 $$('#wardenCards .warden-card').forEach((card,i)=>{const w=S.wardens[i];const calc=E.wardenCalc({name:w.name,currentLevel:n(w.currentLevel),targetLevel:n(w.targetLevel),talents:w.talents,inspiration});wGain+=calc.gain;wBlood+=calc.blood;card.querySelector('.w-blood').textContent=fmt(calc.blood);card.querySelector('.w-gain').textContent=calc.gainReady?fmt(calc.gain):'—';card.querySelector('.w-status').textContent=!calc.active?'заполни героя и уровни':!calc.gainReady?'введи текущие уровни всех талантов':'готово';card.querySelectorAll('[data-plan]').forEach((el,j)=>{const t=calc.talents[j];el.textContent=t&&t.planned?`+${t.planned} ур.`:'—'});card.querySelectorAll('[data-exp]').forEach((el,j)=>{const t=calc.talents[j];if(!t){el.textContent='EXP не указан';return}el.textContent=t.expValue>0?`остаток ${intfmt(t.expRemainder)} · до +1: ${intfmt(t.expToNext)} EXP`:'EXP не указан'});});
 const other=E.otherWatcherGain(S.otherWardens,inspiration);wGain+=other.gain;
 const resource=E.resourceCalc(parseDefault(S.resource.one,1e6),S.resource.counts);setText('#resourceTotal',fmt(resource.total));
 const availBlood=parseDefault(S.profile.blood,1e9)+(S.resource.type==='Кровь'?resource.total:0);setText('#wardenBlood',fmt(wBlood));setText('#wardenGain',fmt(wGain));setText('#wardenBloodStatus',wBlood===0?'—':availBlood>=wBlood?`хватает · запас ${fmt(availBlood-wBlood)}`:`не хватает ${fmt(wBlood-availBlood)}`);
 const books=E.booksCalc(S.books,getBookBonusFinal(conc),n(S.bookPackIIIEach));const tasting=E.tastingCalc(S.tasting);const misc=E.miscCalc(Object.fromEntries(Object.entries(S.misc).map(([k,v])=>[k,parse(v)])));setText('#booksGain',fmt(books.gain));setText('#tastingGain',fmt(tasting.gain));setText('#miscGain',fmt(misc.gain));
 const magicIIIUsed=Object.values(S.books).some(row=>n(row.packIII15)>0);const bh=$('#booksHint');if(bh){bh.className='goal-status';if(magicIIIUsed&&!n(S.bookPackIIIEach)){bh.classList.add('warn');bh.textContent='Есть Магия III, но не указан её номинал. Перепиши число с карточки предмета — до этого Магия III в итог не входит.'}else if(magicIIIUsed){bh.classList.add('good');bh.textContent=`Магия III учтена: по ${intfmt(n(S.bookPackIIIEach))} каждому из 15 смотрителей.`}else{bh.textContent='Добавь только те книги и предметы «Магия», которые собираешься использовать.'}}
 const overallGain=conc.gain+wGain+books.gain+tasting.gain+misc.gain;const current=parseDefault(S.profile.dominion,1e6);setText('#domCurrent',current?fmt(current):'—');setText('#domGain',fmt(overallGain));setText('#domFinal',current?fmt(current+overallGain):'—');setText('#homeGain',overallGain?fmt(overallGain):'—');setText('#homeFinal',current?fmt(current+overallGain):'—');
 const parts=[['Конклав',conc.gain],['Смотрители',wGain],['Книги',books.gain],['Дегустация',tasting.gain],['Прочее',misc.gain]].filter(x=>x[1]>0);$('#domBreakdown').innerHTML=parts.length?parts.map(([k,v])=>`<div class="break-row"><span>${k}</span><b>+${fmt(v)}</b></div>`).join(''):'<div class="note">План пока пуст. Заполни только те разделы, которые собираешься использовать.</div>';
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
function loadLocalState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;const saved=JSON.parse(raw);const base=freshState();S={...base,...saved,profile:{...base.profile,...(saved.profile||{})},conclave:{...base.conclave,...(saved.conclave||{})},conclaveAttrTotals:{...base.conclaveAttrTotals,...(saved.conclaveAttrTotals||{})},inspiration:Array.isArray(saved.inspiration)?saved.inspiration:[],wardens:Array.isArray(saved.wardens)?saved.wardens:[],otherWardens:Array.isArray(saved.otherWardens)?saved.otherWardens:[],ratingRows:Array.isArray(saved.ratingRows)?saved.ratingRows:[],ratingManuscripts:{...base.ratingManuscripts,...(saved.ratingManuscripts||{})},scrolls:{...base.scrolls,...(saved.scrolls||{})},resource:{...base.resource,...(saved.resource||{}),counts:{...base.resource.counts,...((saved.resource||{}).counts||{})}},books:{...base.books,...(saved.books||{})},tasting:{...base.tasting,...(saved.tasting||{})},misc:{...base.misc,...(saved.misc||{})},closeness:{...base.closeness,...(saved.closeness||{})},attraction:{...base.attraction,...(saved.attraction||{})}};Object.keys(base.books).forEach(k=>S.books[k]={...base.books[k],...(S.books[k]||{})});return true}catch(e){return false}}
function downloadBackup(){const p={schema:'vampire-dominion-local',version:2,createdAt:new Date().toISOString(),state:serializableState()};const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`vampire-dominion-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Резервная копия сохранена')}
function restoreBackup(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(String(r.result||''));localStorage.setItem(STORAGE_KEY,JSON.stringify(p.state||p));location.reload()}catch(e){alert('Не удалось восстановить JSON-бэкап Vampire Dominion.')}};r.readAsText(file,'utf-8')}
$('#saveBackup').addEventListener('click',downloadBackup);$('#loadBackup').addEventListener('click',()=>$('#backupFile').click());$('#backupFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)restoreBackup(f);e.target.value=''})

$('#resetAll').addEventListener('click',()=>{if(!confirm('Обнулить все введённые данные?'))return;S=freshState();wardenSeq=inspSeq=otherSeq=ratingSeq=0;localStorage.removeItem(STORAGE_KEY);renderAll();toast('Данные обнулены')});
function renderAll(){
 ['profileDominion','profileWatchers','profileBlood','profileCouncil'].forEach((id,i)=>{const keys=['dominion','watchers','blood','council'];$('#'+id).value=S.profile[keys[i]]});$('#closenessGoal').value=S.closenessGoal;$('#attractionGoal').value=S.attractionGoal;$('#oneCollect').value=S.resource.one;$('#resourceType').value=S.resource.type;$('#scrollHigh').value=S.scrolls.high;$('#scrollMid').value=S.scrolls.mid;$('#scrollSimple').value=S.scrolls.simple;$('#scrollStar').value=S.scrolls.star;$('#miscPlasma').value=S.misc.plasma;$('#miscVito').value=S.misc.vito;$('#miscTrust').value=S.misc.trustTotal;$('#miscRB').value=S.misc.heirsRB;$('#miscGP').value=S.misc.heirsGP;$('#miscS').value=S.misc.heirsS;$('#miscDirect').value=S.misc.directOther;if($('#packIIIEach'))$('#packIIIEach').value=S.bookPackIIIEach;
 renderConclave();renderInspiration();renderWardens();renderOtherWardens();renderRating();renderRatingManuscripts();renderResourceTokens();renderBooks();renderTasting();renderItems('closeness');renderItems('attraction');recalc();
}

loadLocalState();
wardenSeq=Math.max(0,...S.wardens.map(x=>Number(x.id)||0));
inspSeq=Math.max(0,...S.inspiration.map(x=>Number(x.id)||0));
otherSeq=Math.max(0,...S.otherWardens.map(x=>Number(x.id)||0));
ratingSeq=Math.max(0,...S.ratingRows.map(x=>Number(x.id)||0));
bindStatic();renderAll();
if('scrollRestoration' in history) history.scrollRestoration='manual';
const showHero=()=>{if(!location.hash)window.scrollTo({top:0,left:0,behavior:'instant'})};
window.addEventListener('load',()=>setTimeout(showHero,40));window.addEventListener('pageshow',e=>{if(e.persisted)setTimeout(showHero,30)});
const tests=E.selfTests(window.VD_SAMPLES);$('#engineLamp').classList.add(tests.ok?'ok':'bad');$('#engineText').textContent=tests.ok?'Проверка пройдена · расчётный круг стабилен':'Ошибка самопроверки · расчёт временно недоступен';
if(!tests.ok) console.error('Self tests failed',tests);
})();

window.addEventListener('pagehide',saveLocalState);window.addEventListener('beforeunload',saveLocalState);

window.addEventListener('pagehide',saveLocalState);window.addEventListener('beforeunload',saveLocalState);

window.addEventListener('pagehide',saveLocalState);window.addEventListener('beforeunload',saveLocalState);
