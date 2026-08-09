(function(root,factory){
  const api=factory(root.VD_DATA || (typeof require==='function'?require('./data.js'):null));
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.VD_ENGINE=api;
})(typeof window!=='undefined'?window:globalThis,function(DATA){
  'use strict';
  const ATTRS=['Сила','Харизма','Интеллект','Воля'];
  const PREFIX={K:1e3,M:1e6,B:1e9,T:1e12};

  const conclaveCum={dom:[0],book:[0],cost:[0]};
  const conclaveCostKnown=[true];
  let d=0,b=0,c=0;
  for(const row of DATA.conclaveLevels){
    d+=num(row.dom); b+=num(row.book);
    if(row.cost!==null && row.cost!==undefined) c+=num(row.cost);
    conclaveCum.dom[row.level]=d; conclaveCum.book[row.level]=b; conclaveCum.cost[row.level]=c;
    conclaveCostKnown[row.level]=(row.cost!==null && row.cost!==undefined);
  }
  const levelCoeff=[0], levelBlood=[0];
  for(const row of DATA.wardenLevels){ levelCoeff[row.level]=row.coeff; levelBlood[row.level]=row.blood; }

  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function clamp(n,min,max){ return Math.min(max,Math.max(min,n)); }
  function parseCompact(value){
    if(value===null||value===undefined||value==='') return 0;
    if(typeof value==='number') return Number.isFinite(value)?value:0;
    const s=String(value).trim().replace(/\s+/g,'').replace(',','.').toUpperCase();
    const m=s.match(/^(-?[0-9]*\.?[0-9]+)([KMBT])?$/);
    if(!m) return 0;
    return Number(m[1])*(PREFIX[m[2]]||1);
  }
  function formatCompact(v,digits=2){
    v=num(v); const av=Math.abs(v);
    let u='',m=1;
    if(av>=1e12){u='T';m=1e12;} else if(av>=1e9){u='B';m=1e9;} else if(av>=1e6){u='M';m=1e6;} else if(av>=1e3){u='K';m=1e3;}
    const x=v/m;
    const dp=Math.abs(x)>=100?0:Math.abs(x)>=10?1:digits;
    return x.toLocaleString('ru-RU',{maximumFractionDigits:dp,minimumFractionDigits:0})+(u?' '+u:'');
  }
  function levelCoeffAt(level){ level=Math.round(num(level)); return levelCoeff[clamp(level,1,500)]||0; }
  function bloodNeeded(current,target){
    current=Math.round(num(current)); target=Math.round(num(target));
    if(current<1||target<=current) return 0;
    target=Math.min(target,500);
    let total=0;
    for(let lvl=current; lvl<=target-1; lvl++) total += levelBlood[lvl]||0;
    return total;
  }
  function cumAt(arr,level){ level=Math.round(num(level)); if(level<=0)return 0; return arr[Math.min(level,arr.length-1)]||0; }

  function conclaveCalc(input){
    const watcherCount=Math.max(0,Math.round(num(input.watcherCount)));
    const attrTotals=input.attrTotals||{};
    const seals=input.seals||{};
    let direct=0, bookEffect=0, council=0;
    const missingCostLevels=new Set();
    const details={};
    for(const attr of ATTRS){
      const s=seals[attr]||{};
      const cur=clamp(Math.round(num(s.current)),0,180);
      const target=clamp(Math.round(num(s.target)),0,180);
      const t=Math.max(cur,target);
      const deltaDom=cumAt(conclaveCum.dom,t)-cumAt(conclaveCum.dom,cur);
      const deltaBook=(cumAt(conclaveCum.book,t)-cumAt(conclaveCum.book,cur))/100;
      const attrTotal=num(attrTotals[attr]);
      const directPart=deltaDom*watcherCount;
      const bookPart=attrTotal*deltaBook;
      const councilPart=cumAt(conclaveCum.cost,t)-cumAt(conclaveCum.cost,cur);
      for(let lvl=cur+1;lvl<=t;lvl++) if(!conclaveCostKnown[lvl]) missingCostLevels.add(lvl);
      direct+=directPart; bookEffect+=bookPart; council+=councilPart;
      details[attr]={current:cur,target:t,direct:directPart,bookEffect:bookPart,deltaBookPct:deltaBook*100,council:councilPart,finalBookBonusPct:cumAt(conclaveCum.book,t)};
    }
    return {gain:direct+bookEffect,direct,bookEffect,council,councilComplete:missingCostLevels.size===0,missingCostLevels:[...missingCostLevels].sort((a,b)=>a-b),details};
  }

  function normalizeAffects(txt){
    const s=String(txt||'').toLowerCase().replace('нтелект','интеллект').replace('интелект','интеллект');
    if(s.includes('все')) return ATTRS.slice();
    return ATTRS.filter(a=>s.includes(a.toLowerCase()));
  }
  function inspirationTotals(entries){
    const out={Сила:0,Харизма:0,Интеллект:0,Воля:0};
    const map=Object.fromEntries(DATA.inspirationWatchers.map(x=>[x.name,x.affects]));
    for(const e of (entries||[])){
      if(!e||!e.name) continue;
      const pct=(num(e.currentPct)+num(e.addPct))/100;
      const affects=normalizeAffects(e.affects||map[e.name]||'');
      for(const a of affects) out[a]+=pct;
    }
    return out;
  }

  function talentIncrease(star,manuscripts,guaranteed,exp){
    star=clamp(Math.round(num(star)),1,6);
    const chance=num(DATA.manuscriptChance[String(star)]);
    const fromMan=Math.floor(Math.max(0,num(manuscripts))*chance);
    const fromGuaranteed=Math.floor(Math.max(0,num(guaranteed)));
    const fromExp=Math.floor(Math.max(0,num(exp))/(star*200));
    return {levels:fromMan+fromGuaranteed+fromExp,fromMan,fromGuaranteed,fromExp,chance};
  }

  function wardenCalc(input){
    const name=input.name||'';
    const definition=DATA.watchers[name]||[];
    const currentLevel=Math.round(num(input.currentLevel));
    let targetLevel=Math.round(num(input.targetLevel));
    if(currentLevel>0 && targetLevel===0) targetLevel=currentLevel;
    if(!name||currentLevel<1||targetLevel<currentLevel||targetLevel>500) return {active:false,gain:0,blood:0,attrGain:{Сила:0,Харизма:0,Интеллект:0,Воля:0},talents:[]};
    const currentWeighted={Сила:0,Харизма:0,Интеллект:0,Воля:0};
    const newWeighted={Сила:0,Харизма:0,Интеллект:0,Воля:0};
    const rows=[];
    const inputs=input.talents||[];
    definition.forEach((def,i)=>{
      const x=inputs[i]||{};
      const current=Math.max(0,Math.floor(num(x.current)));
      const inc=talentIncrease(def.star,x.manuscripts,x.guaranteed,x.exp);
      const attr=ATTRS.includes(def.attr)?def.attr:null;
      if(attr){
        currentWeighted[attr]+=def.star*current;
        newWeighted[attr]+=def.star*(current+inc.levels);
      }
      rows.push({...def,current,planned:inc.levels,newLevel:current+inc.levels,...inc});
    });
    const hasTalentPlan=inputs.some(x=>num(x&&x.manuscripts)>0||num(x&&x.guaranteed)>0||num(x&&x.exp)>0);
    const hasPlan=targetLevel>currentLevel||hasTalentPlan;
    const talentsComplete=definition.length>0&&definition.every((_,i)=>num(inputs[i]&&inputs[i].current)>0);
    const gainReady=!hasPlan||talentsComplete;
    const insp=input.inspiration||{Сила:0,Харизма:0,Интеллект:0,Воля:0}; // fractions, e.g. .71
    const c0=levelCoeffAt(currentLevel), c1=levelCoeffAt(targetLevel);
    const attrGain={}; let gain=0;
    for(const attr of ATTRS){
      const nw=newWeighted[attr], cw=currentWeighted[attr];
      let g;
      if(attr==='Сила'){
        g=(nw*c1-nw*c0+(nw-cw)*c0)*(1+num(insp[attr]));
      }else{
        // Exact transcription of the source spreadsheet formulas for Charisma/Intellect/Will.
        g=((nw*c1-nw*c0+(nw-cw)*c0)+(nw-cw)*c0)*(1+num(insp[attr]));
      }
      attrGain[attr]=g; gain+=g;
    }
    const rawGain=gain;
    if(!gainReady) gain=0;
    return {active:true,name,currentLevel,targetLevel,gain,rawGain,gainReady,talentsComplete,hasPlan,blood:bloodNeeded(currentLevel,targetLevel),attrGain,currentWeighted,newWeighted,talents:rows};
  }

  function otherWatcherGain(rows,inspiration){
    let total=0; const details=[];
    for(const r of (rows||[])){
      const level=Math.round(num(r.level)); const exp=Math.max(0,num(r.exp));
      if(level<1||level>500||exp<=0) continue;
      const attr=ATTRS.includes(r.attr)?r.attr:'Сила';
      const plus=Math.floor(exp/200);
      const gain=plus*levelCoeffAt(level)*(1+num((inspiration||{})[attr]));
      total+=gain; details.push({level,exp,attr,plus,gain});
    }
    return {gain:total,details};
  }

  function booksCalc(counts,finalBookBonusPct){
    const vals=DATA.books; let total=0; const details={};
    for(const attr of ['Энциклопедия',...ATTRS]){
      const c=(counts&&counts[attr])||{};
      const raw=num(c.V)*vals.V+num(c.IV)*vals.IV+num(c.III)*vals.III+num(c.II)*vals.II+num(c.I)*vals.I+num(c.packI15)*vals.packI15+num(c.packIII15)*vals.packIII15;
      let bonus=0;
      if(attr==='Энциклопедия') bonus=ATTRS.reduce((s,a)=>s+num((finalBookBonusPct||{})[a]),0)/4;
      else bonus=num((finalBookBonusPct||{})[attr]);
      const gain=raw*(1+bonus/100); total+=gain; details[attr]={raw,bonusPct:bonus,gain};
    }
    return {gain:total,details};
  }
  function tastingCalc(counts){ let total=0; const details={}; for(const [name,value] of Object.entries(DATA.tasting)){const q=Math.max(0,num((counts||{})[name]));details[name]=q*value;total+=details[name];} return {gain:total,details}; }
  function miscCalc(x){
    x=x||{};
    const gain=Math.max(0,num(x.plasma))*200+Math.max(0,num(x.vito))*400+Math.max(0,num(x.trustTotal))*0.8+Math.max(0,num(x.heirsRB))*75000+Math.max(0,num(x.heirsGP))*17000+Math.max(0,num(x.heirsS))*7500+Math.max(0,num(x.directOther));
    return {gain};
  }
  function resourceCalc(oneCollect,counts){
    oneCollect=Math.max(0,num(oneCollect)); let total=0; const details={};
    for(const [name,m] of DATA.resourceMultipliers){ const q=Math.max(0,num((counts||{})[name])); const v=q*oneCollect*m; details[name]=v; total+=v; }
    return {total,details};
  }
  function rangeItemsCalc(defs,counts){
    let min=0,max=0; const details={};
    for(const [name,range] of Object.entries(defs)){ const q=Math.max(0,num((counts||{})[name])); const a=q*range[0], b=q*range[1]; min+=a; max+=b; details[name]={min:a,max:b}; }
    return {min,max,avg:(min+max)/2,details};
  }
  function closenessCalc(counts){return rangeItemsCalc(DATA.closeness,counts);}
  function attractionCalc(counts){return rangeItemsCalc(DATA.attraction,counts);}
  function talentRatingCalc(rows,manuscripts,scrolls){
    let watcherScore=0; const details=[];
    for(const r of (rows||[])){
      const star=clamp(Math.round(num(r.star)),1,6); const exp=Math.max(0,num(r.exp));
      if(!exp) continue;
      const threshold=star*200; const completed=Math.floor(exp/threshold); const score=completed*star; const remainder=exp-completed*threshold; const missing=remainder===0?threshold:threshold-remainder;
      watcherScore+=score; details.push({name:r.name||'',star,exp,threshold,completed,score,remainder,missing});
    }
    const manuscriptScore=ATTRS.reduce((s,a)=>s+Math.max(0,num((manuscripts||{})[a])),0);
    const sp=scrolls||{}; const pool=scrollPool(sp.high,sp.mid,sp.simple); const scrollStar=clamp(Math.round(num(sp.star)||6),1,6); const scrollScore=Math.floor(pool/(scrollStar*200))*scrollStar;
    return {score:watcherScore+manuscriptScore+scrollScore,watcherScore,manuscriptScore,scrollScore,scrollPool:pool,scrollStar,details};
  }
  function scrollPool(high,mid,simple){return Math.max(0,num(high))*200+Math.max(0,num(mid))*100+Math.max(0,num(simple))*50;}

  function approx(a,b,tol=1e-6){return Math.abs(a-b)<=tol*Math.max(1,Math.abs(b));}
  function selfTests(samples){
    const tests=[];
    try{
      const c=conclaveCalc(samples.conclave); tests.push({name:'Конклав: заполненный пример',ok:approx(c.gain,samples.conclave.expectedGain,1e-9)&&approx(c.council,samples.conclave.expectedCouncil,1e-9),got:{gain:c.gain,council:c.council}});
      const wr=samples.wardenRudra; const w=wardenCalc({name:wr.name,currentLevel:wr.currentLevel,targetLevel:wr.targetLevel,inspiration:Object.fromEntries(ATTRS.map(a=>[a,wr.inspiration[a]/100])),talents:wr.talents}); tests.push({name:'Смотритель Рудра: пример таблицы',ok:approx(w.gain,wr.expectedGain,1e-9)&&approx(w.blood,wr.expectedBlood,1e-9),got:{gain:w.gain,blood:w.blood}});
      const cl=closenessCalc(samples.closeness1.counts); tests.push({name:'Близость: заполненный пример',ok:cl.min===samples.closeness1.expected[0]&&cl.max===samples.closeness1.expected[1]&&cl.avg===samples.closeness1.expected[2],got:cl});
      const at=attractionCalc(samples.attraction1.counts); tests.push({name:'Влечение: заполненный пример',ok:at.min===samples.attraction1.expected[0]&&at.max===samples.attraction1.expected[1]&&at.avg===samples.attraction1.expected[2],got:at});
      const tr=talentRatingCalc(samples.talentRating2.rows,samples.talentRating2.manuscripts,samples.talentRating2.scrolls); tests.push({name:'Рейтинг талантов: исправленный пример',ok:tr.score===samples.talentRating2.expected,got:tr.score});
      const bk=booksCalc(samples.booksFilled.counts,samples.booksFilled.finalBookBonusPct); tests.push({name:'Книги: исправленный заполненный пример',ok:approx(bk.gain,samples.booksFilled.expectedCorrected,1e-9),got:bk.gain});
      const ts=tastingCalc(samples.tastingFilled.counts); tests.push({name:'Дегустация: заполненный пример',ok:ts.gain===samples.tastingFilled.expected,got:ts.gain});
      const ms=miscCalc(samples.miscFilled.input); tests.push({name:'Прочее: заполненный пример',ok:ms.gain===samples.miscFilled.expected,got:ms.gain});
      const missingCost=conclaveCalc({watcherCount:1,seals:{Сила:{current:10,target:11}},attrTotals:{}}); tests.push({name:'Конклав: неизвестная стоимость не считается нулём',ok:missingCost.councilComplete===false&&missingCost.missingCostLevels.includes(11),got:missingCost});
      const incomplete=wardenCalc({name:'Рудра',currentLevel:350,targetLevel:351,talents:[]}); tests.push({name:'Смотритель: без текущих талантов прирост не выдумывается',ok:incomplete.gainReady===false&&incomplete.gain===0&&incomplete.blood>0,got:{gainReady:incomplete.gainReady,gain:incomplete.gain,blood:incomplete.blood}});
      const rc=resourceCalc(1123.23e6,{'Жетон 1':2,'Жетон 3':1,'Карта сбора':1}); tests.push({name:'Сбор ресурсов: множители',ok:rc.total===1123.23e6*(0.2+1+1),got:rc.total});
      tests.push({name:'K/M/B парсер',ok:parseCompact('5,25M')===5250000&&parseCompact('1.2B')===1200000000&&parseCompact('750K')===750000,got:[parseCompact('5,25M'),parseCompact('1.2B'),parseCompact('750K')]});
      const zero=conclaveCalc({watcherCount:0,seals:{},attrTotals:{}}); const zeroBooks=booksCalc({},{}); const zeroRange=closenessCalc({}); const zeroTal=talentRatingCalc([],{},{}); tests.push({name:'Нулевое состояние всех модулей',ok:zero.gain===0&&zero.council===0&&zeroBooks.gain===0&&zeroRange.min===0&&zeroRange.max===0&&zeroTal.score===0,got:{zero,zeroBooks,zeroRange,zeroTal}});
    }catch(e){tests.push({name:'Исключение тестов',ok:false,error:String(e&&e.stack||e)});}
    return {ok:tests.every(t=>t.ok),tests};
  }

  return {ATTRS,parseCompact,formatCompact,conclaveCalc,inspirationTotals,talentIncrease,wardenCalc,otherWatcherGain,booksCalc,tastingCalc,miscCalc,resourceCalc,closenessCalc,attractionCalc,talentRatingCalc,scrollPool,bloodNeeded,levelCoeffAt,selfTests};
});
