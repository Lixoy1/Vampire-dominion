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
  const ATTR_LOOKUP=new Map(ATTRS.map(attr=>[attr.toLocaleLowerCase('ru-RU'),attr]));
  function normalizeAttr(value){
    const key=String(value??'').trim().toLocaleLowerCase('ru-RU');
    return ATTR_LOOKUP.get(key)||null;
  }
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

  // Compare the legacy per-level Conclave table with the source's published aggregate checkpoints.
  // Aggregate claims are evidence for auditing, not a substitute for a complete per-level table.
  function conclaveDataAudit(){
    const ref=DATA.conclaveCommunityAggregate||{};
    const maxLevel=Math.max(0,Math.round(num(ref.maxBranchLevel)));
    const rows=(Array.isArray(DATA.conclaveLevels)?DATA.conclaveLevels:[])
      .filter(row=>Number.isInteger(Number(row.level))&&Number(row.level)>=1&&Number(row.level)<=maxLevel);
    const levelSet=new Set(rows.map(row=>Number(row.level)));
    const missingTableLevels=[];
    const missingCostLevels=[];
    for(let level=1;level<=maxLevel;level++){
      if(!levelSet.has(level)) missingTableLevels.push(level);
      const row=rows.find(item=>Number(item.level)===level);
      if(!row||row.cost===null||row.cost===undefined||!Number.isFinite(Number(row.cost))) missingCostLevels.push(level);
    }
    const directAttribute=rows.reduce((sum,row)=>sum+num(row.dom),0);
    const bookBonusPct=rows.reduce((sum,row)=>sum+num(row.book),0);
    const knownCouncilCost=rows.reduce((sum,row)=>sum+(row.cost===null||row.cost===undefined?0:num(row.cost)),0);
    const directAttributeMatches=Number.isFinite(Number(ref.singleBranchAttributePerWarden))
      && approx(directAttribute,Number(ref.singleBranchAttributePerWarden),1e-10);
    const bookBonusMatches=Number.isFinite(Number(ref.singleBranchBookBonusPercent))
      && approx(bookBonusPct,Number(ref.singleBranchBookBonusPercent),1e-10);
    const councilCostComplete=missingTableLevels.length===0&&missingCostLevels.length===0;
    const councilCostMatches=councilCostComplete
      && Number.isFinite(Number(ref.singleBranchCouncilCost))
      && approx(knownCouncilCost,Number(ref.singleBranchCouncilCost),1e-10);
    const referenceArithmeticConsistent=
      Number(ref.singleBranchCouncilCost)*4===Number(ref.allFourBranchesCouncilCost)
      && Number(ref.singleBranchAttributePerWarden)*4===Number(ref.allFourBranchesAttributePerWarden)
      && Number(ref.allFourBranchesAttributePerWarden)*40===Number(ref.allFourBranchesFor40Wardens);
    return {
      source:ref.source||null,
      evidenceClass:ref.evidenceClass||'unknown',
      maxLevel,
      tableRows:rows.length,
      missingTableLevels,
      missingCostLevels,
      knownCostLevelCount:rows.length-missingCostLevels.length,
      directAttribute,
      expectedDirectAttribute:Number(ref.singleBranchAttributePerWarden)||0,
      directAttributeMatches,
      bookBonusPct,
      expectedBookBonusPct:Number(ref.singleBranchBookBonusPercent)||0,
      bookBonusMatches,
      knownCouncilCost,
      expectedCouncilCost:Number(ref.singleBranchCouncilCost)||0,
      councilCostComplete,
      councilCostMatches,
      referenceArithmeticConsistent,
      fullyMatched:directAttributeMatches&&bookBonusMatches&&councilCostMatches&&referenceArithmeticConsistent
    };
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
    const threshold=star*200;
    const expValue=Math.max(0,num(exp));
    const fromExp=Math.floor(expValue/threshold);
    const expRemainder=expValue-(fromExp*threshold);
    const expToNext=threshold-expRemainder;
    return {levels:fromMan+fromGuaranteed+fromExp,fromMan,fromGuaranteed,fromExp,chance,threshold,expValue,expRemainder,expToNext};
  }
  function wardenCalc(input){
    const name=input.name||'';
    const definition=DATA.watchers[name]||[];
    const currentLevel=Math.round(num(input.currentLevel));
    let targetLevel=Math.round(num(input.targetLevel));
    if(currentLevel>0 && targetLevel===0) targetLevel=currentLevel;
    if(!name||currentLevel<1||targetLevel<currentLevel||targetLevel>500) return {active:false,gain:0,blood:0,attrGain:{Сила:0,Харизма:0,Интеллект:0,Воля:0},talents:[]};
    const profileStatus=DATA.watcherDataStatus&&DATA.watcherDataStatus[name];
    if(profileStatus&&profileStatus.status==='incomplete'){
      return {active:true,name,currentLevel,targetLevel,gain:0,rawGain:0,gainReady:false,talentsComplete:false,hasPlan:true,dataStatus:'incomplete',dataNote:profileStatus.note||'Профиль требует проверки.',blood:bloodNeeded(currentLevel,targetLevel),attrGain:{Сила:0,Харизма:0,Интеллект:0,Воля:0},currentWeighted:{Сила:0,Харизма:0,Интеллект:0,Воля:0},newWeighted:{Сила:0,Харизма:0,Интеллект:0,Воля:0},talents:[]};
    }
    const currentWeighted={Сила:0,Харизма:0,Интеллект:0,Воля:0};
    const newWeighted={Сила:0,Харизма:0,Интеллект:0,Воля:0};
    const rows=[];
    const inputs=input.talents||[];
    definition.forEach((def,i)=>{
      const x=inputs[i]||{};
      const current=Math.max(0,Math.floor(num(x.current)));
      const inc=talentIncrease(def.star,x.manuscripts,x.guaranteed,x.exp);
      const attr=normalizeAttr(def.attr);
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
      const attr=normalizeAttr(r.attr)||'Сила';
      const plus=Math.floor(exp/200);
      const gain=plus*levelCoeffAt(level)*(1+num((inspiration||{})[attr]));
      total+=gain; details.push({level,exp,attr,plus,gain});
    }
    return {gain:total,details};
  }

  function booksCalc(counts,finalBookBonusPct,packIIIEach=0){
    const vals=DATA.books; let total=0; const details={};
    for(const attr of ['Энциклопедия',...ATTRS]){
      const c=(counts&&counts[attr])||{};
      const raw=num(c.V)*vals.V+num(c.IV)*vals.IV+num(c.III)*vals.III+num(c.II)*vals.II+num(c.I)*vals.I+num(c.packI15)*vals.packI15+num(c.packII15)*vals.packII15+num(c.packIII15)*Math.max(0,num(packIIIEach))*15;
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
  // The game-specific Dominion gain per heir marriage has not been verified for every ring type.
  // Keep it user-supplied until exact values are confirmed in-game; never silently guess.
  const HEIR_RING_TYPES=[
    {key:'amethyst',name:'Аметистовое кольцо',rank:'Iron / Bronze / Silver'},
    {key:'ruby',name:'Рубиновое кольцо',rank:'Gold / Platinum'},
    {key:'blackPearl',name:'Чёрная жемчужина',rank:'Ruby / Diamond'}
  ];
  const MANUAL_DOMINION_SOURCES=[
    {key:'bloodBonds',name:'Кровные узы'},
    {key:'garden',name:'Сад'},
    {key:'skins',name:'Скины'},
    {key:'familiars',name:'Фамильяры'},
    {key:'other',name:'Другой источник'}
  ];
  function heirMarriageCalc(input){
    const rings=(input&&input.rings)||{};
    let gain=0,planned=0,shortage=0;
    const unknownTypes=[];
    const details={};
    for(const type of HEIR_RING_TYPES){
      const row=rings[type.key]||{};
      const stock=Math.max(0,Math.floor(num(row.stock)));
      const marriages=Math.max(0,Math.floor(num(row.planned)));
      const raw=String(row.gainPerMarriage??'').trim();
      const validGain=/^\+?(?:\d+(?:[.,]\d*)?|[.,]\d+)\s*[KMBT]?$/i.test(raw);
      const parsed=raw===''||!validGain?null:parseCompact(raw);
      const gainKnown=parsed!==null&&Number.isFinite(parsed)&&parsed>=0;
      const perMarriageGain=gainKnown?parsed:null;
      const rowGain=gainKnown?marriages*perMarriageGain:0;
      if(marriages>0&&!gainKnown) unknownTypes.push(type.key);
      const rowShortage=Math.max(0,marriages-stock);
      gain+=rowGain; planned+=marriages; shortage+=rowShortage;
      details[type.key]={key:type.key,name:type.name,rank:type.rank,stock,planned:marriages,
        gainPerMarriage:perMarriageGain,gainKnown,gain:rowGain,remaining:stock-marriages,shortage:rowShortage};
    }
    return {gain,planned,shortage,complete:unknownTypes.length===0,unknownTypes,details};
  }

  // Bridge for systems whose full in-game formula is not yet verified.
  // Players enter only a confirmed incremental gain not calculated by another module.
  function manualSourcesCalc(rows){
    let gain=0;
    const bySource={};
    const details=[];
    const missingRows=[];
    const invalidRows=[];
    const allowed=new Set(MANUAL_DOMINION_SOURCES.map(x=>x.name));
    const validPattern=/^\+?(?:\d+(?:[.,]\d*)?|[.,]\d+)\s*[KMBT]?$/i;
    for(const row of (rows||[])){
      const source=String((row&&row.source)||'').trim();
      const raw=String((row&&row.gain)||'').trim();
      if(!source&&!raw) continue;
      if(!source||!raw){missingRows.push(row&&row.id);continue;}
      if(!allowed.has(source)||!validPattern.test(raw)){invalidRows.push(row&&row.id);continue;}
      const value=parseCompact(raw);
      if(!Number.isFinite(value)||value<0){invalidRows.push(row&&row.id);continue;}
      gain+=value;
      bySource[source]=(bySource[source]||0)+value;
      details.push({id:row.id,source,gain:value,note:String(row.note||'')});
    }
    return {gain,bySource,details,missingRows,invalidRows,complete:missingRows.length===0&&invalidRows.length===0};
  }

  // Guild experience values are transcribed from the uploaded workbook "счет опыта ги.xlsx".
  // The formulas are implemented exactly as provided; game-version verification is still pending.
  // Exact planners for future data-complete modules. The caller must pass rows explicitly
  // marked verified-in-game; candidate/community data never silently becomes calculation input.
  function gardenAttributePlan(input){
    input=input||{};
    const currentLevel=Math.round(num(input.currentLevel));
    const targetLevel=Math.round(num(input.targetLevel));
    const rows=Array.isArray(input.rows)?input.rows:[];
    const categoryCounts=input.categoryCounts||{};
    const categories=['single','dual','universal'];
    const missingLevels=[],unverifiedLevels=[],missingCosts=[],invalidEffects=[],invalidCounts=[];
    const byLevel=new Map(rows.map(row=>[Number(row&&row.level),row]));
    const attributeGain=Object.fromEntries(ATTRS.map(attr=>[attr,0]));
    if(!Number.isInteger(currentLevel)||!Number.isInteger(targetLevel)||currentLevel<0||targetLevel<currentLevel||targetLevel>500){
      return {ready:false,currentLevel,targetLevel,cost:null,attributeGain:null,missingLevels,unverifiedLevels,missingCosts,invalidEffects,invalidCounts:[{reason:'invalid-level-range'}],details:[]};
    }
    if(targetLevel===currentLevel){
      return {ready:true,currentLevel,targetLevel,cost:0,attributeGain,missingLevels,unverifiedLevels,missingCosts,invalidEffects,invalidCounts,details:[]};
    }
    for(const category of categories){
      const raw=categoryCounts[category];
      if(raw===undefined||raw===null||String(raw).trim()===''||!Number.isSafeInteger(Number(raw))||Number(raw)<0) invalidCounts.push({category,raw});
    }
    const steps=[];
    for(let level=currentLevel+1;level<=targetLevel;level++){
      const row=byLevel.get(level);
      if(!row){missingLevels.push(level);continue;}
      if(row.status!=='verified-in-game')unverifiedLevels.push(level);
      if(row.cost===null||row.cost===undefined||String(row.cost).trim()===''||!Number.isFinite(Number(row.cost))||Number(row.cost)<0)missingCosts.push(level);
      const effects=Array.isArray(row.effects)?row.effects:[];
      if(effects.length===0){invalidEffects.push({level,reason:'missing-effects'});continue;}
      for(const effect of effects){
        if(!effect||!categories.includes(String(effect.category||''))||!effect.attributes||typeof effect.attributes!=='object'||Array.isArray(effect.attributes)){
          invalidEffects.push({level,reason:'invalid-effect-schema'});continue;
        }
        const entries=Object.entries(effect.attributes);
        if(!entries.length||entries.some(([attr,value])=>!normalizeAttr(attr)||value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)){
          invalidEffects.push({level,reason:'invalid-effect-value'});continue;
        }
      }
      steps.push(row);
    }
    if(missingLevels.length||unverifiedLevels.length||missingCosts.length||invalidEffects.length||invalidCounts.length){
      return {ready:false,currentLevel,targetLevel,cost:null,attributeGain:null,missingLevels,unverifiedLevels:[...new Set(unverifiedLevels)],missingCosts:[...new Set(missingCosts)],invalidEffects,invalidCounts,details:[]};
    }
    let cost=0;const details=[];
    for(const row of steps){
      let levelCost=Number(row.cost),levelAttributes=Object.fromEntries(ATTRS.map(attr=>[attr,0]));
      for(const effect of row.effects){
        const count=Number(categoryCounts[effect.category]);
        for(const [rawAttr,rawGain] of Object.entries(effect.attributes)){
          const attr=normalizeAttr(rawAttr);
          levelAttributes[attr]+=Number(rawGain)*count;
        }
      }
      cost+=levelCost;
      for(const attr of ATTRS)attributeGain[attr]+=levelAttributes[attr];
      details.push({level:Number(row.level),cost:levelCost,attributeGain:levelAttributes});
    }
    return {ready:true,currentLevel,targetLevel,cost,attributeGain,missingLevels,unverifiedLevels,missingCosts,invalidEffects,invalidCounts,details};
  }

  // Blood Bond planner is metric-aware: it never adds percentage labels to flat attribute values.
  // Rows must contain each level's confirmed displayed numeric value, its metric, and next-level cost.
  function bloodBondProgressionPlan(input){
    input=input||{};
    const skills=Array.isArray(input.skills)?input.skills:[];
    const rows=Array.isArray(input.rows)?input.rows:[];
    const key=(warden,skill,level)=>String(warden||'')+'|'+String(skill||'')+'|'+Number(level);
    const byKey=new Map(rows.map(row=>[key(row&&row.warden,row&&row.skillName,row&&row.level),row]));
    const missingRows=[],unverifiedRows=[],missingCosts=[],invalidSkills=[],details=[];
    const totalByMetric={};let totalCost=0;
    for(const skill of skills){
      const warden=String(skill&&skill.warden||'').trim(),skillName=String(skill&&skill.skillName||'').trim();
      const current=Math.round(num(skill&&skill.currentLevel)),target=Math.round(num(skill&&skill.targetLevel));
      if(!warden||!skillName||current<1||target<current||target>500){invalidSkills.push({warden,skillName,current,target});continue;}
      if(current===target){details.push({warden,skillName,currentLevel:current,targetLevel:target,delta:0,cost:0,metric:null});continue;}
      const sequence=[];let sequenceInvalid=false;
      for(let level=current;level<=target;level++){
        const row=byKey.get(key(warden,skillName,level));
        if(!row){missingRows.push({warden,skillName,level});sequenceInvalid=true;continue;}
        if(row.status!=='verified-in-game'){unverifiedRows.push({warden,skillName,level});sequenceInvalid=true;}
        if(row.value===null||row.value===undefined||String(row.value).trim()===''||!Number.isFinite(Number(row.value))||Number(row.value)<0||!String(row.metric||'').trim()){missingRows.push({warden,skillName,level,field:'value-or-metric'});sequenceInvalid=true;}
        if(level>current&&(row.upgradeCost===null||row.upgradeCost===undefined||String(row.upgradeCost).trim()===''||!Number.isFinite(Number(row.upgradeCost))||Number(row.upgradeCost)<0)){missingCosts.push({warden,skillName,level});sequenceInvalid=true;}
        sequence.push(row);
      }
      if(sequenceInvalid||sequence.length!==target-current+1)continue;
      const metric=String(sequence[0].metric);
      if(sequence.some(row=>String(row.metric)!==metric)){invalidSkills.push({warden,skillName,reason:'metric-changed-within-level-range'});continue;}
      const start=Number(sequence[0].value),finish=Number(sequence[sequence.length-1].value);
      const delta=finish-start;let cost=0;
      for(let index=1;index<sequence.length;index++)cost+=Number(sequence[index].upgradeCost);
      totalByMetric[metric]=(totalByMetric[metric]||0)+delta;totalCost+=cost;
      details.push({warden,skillName,currentLevel:current,targetLevel:target,delta,cost,metric});
    }
    const ready=skills.length>0&&missingRows.length===0&&unverifiedRows.length===0&&missingCosts.length===0&&invalidSkills.length===0;
    return {ready,cost:ready?totalCost:null,gainByMetric:ready?totalByMetric:null,missingRows,unverifiedRows,missingCosts,invalidSkills,details:ready?details:[]};
  }
  function guildExperienceCalc(rows){
    const defs=Array.isArray(DATA.guildExperienceItems)?DATA.guildExperienceItems:[];
    const itemTotals=Object.fromEntries(defs.map(item=>[item.key,0]));
    const members=[];
    const invalidFields=[];
    let total=0,totalItems=0,contributors=0;
    for(const row of (rows||[])){
      const counts=(row&&row.counts)||{};
      let memberTotal=0,memberItemCount=0,hasItems=false;
      const itemDetails={};
      for(const item of defs){
        const raw=String(counts[item.key]??'').trim();
        const parsed=raw===''?0:Number(raw.replace(',','.'));
        const valid=Number.isSafeInteger(parsed)&&parsed>=0;
        const quantity=valid?parsed:0;
        if(!valid) invalidFields.push({memberId:row&&row.id,itemKey:item.key,raw});
        const exp=quantity*item.experience;
        itemDetails[item.key]={quantity,experiencePerItem:item.experience,gain:exp,valid};
        itemTotals[item.key]+=quantity;
        memberItemCount+=quantity;
        memberTotal+=exp;
        if(quantity>0) hasItems=true;
      }
      const name=String((row&&row.name)||'').trim();
      if(name||memberItemCount>0||Object.values(counts).some(v=>String(v??'').trim()!=='')){
        members.push({id:row&&row.id,name,total:memberTotal,totalItems:memberItemCount,hasItems,itemDetails});
      }
      total+=memberTotal; totalItems+=memberItemCount;
      if(hasItems) contributors++;
    }
    return {total,totalItems,contributors,members,itemTotals,invalidFields,complete:invalidFields.length===0};
  }

  function requirementStatus(available,required,complete=true,entered=true){
    available=Math.max(0,num(available)); required=Math.max(0,num(required));
    if(!complete) return {state:'unknown',label:'нет данных',hint:'Для части выбранных уровней в исходной таблице не указана стоимость.'};
    if(required===0) return {state:'idle',label:'—',hint:'Выбери повышение печатей.'};
    if(!entered) return {state:'warn',label:'введи запас',hint:`Для плана нужно ${formatCompact(required)} баллов совета.`};
    if(available>=required) return {state:'good',label:'хватает',hint:`После прокачки останется ${formatCompact(available-required)}.`};
    return {state:'bad',label:`не хватает ${formatCompact(required-available)}`,hint:`Есть ${formatCompact(available)} из ${formatCompact(required)}.`};
  }

  function approx(a,b,tol=1e-6){return Math.abs(a-b)<=tol*Math.max(1,Math.abs(b));}
  function refOrZero(v){return v===null||v===undefined?0:v;}
  function selfTests(samples){
    const tests=[];
    try{
      const c=conclaveCalc(samples.conclave); tests.push({name:'Конклав: заполненный пример',ok:approx(c.gain,samples.conclave.expectedGain,1e-9)&&approx(c.council,samples.conclave.expectedCouncil,1e-9),got:{gain:c.gain,council:c.council}});
      const wr=samples.wardenRudra; const w=wardenCalc({name:wr.name,currentLevel:wr.currentLevel,targetLevel:wr.targetLevel,inspiration:Object.fromEntries(ATTRS.map(a=>[a,wr.inspiration[a]/100])),talents:wr.talents}); tests.push({name:'Смотритель Рудра: пример таблицы',ok:approx(w.gain,wr.expectedGain,1e-9)&&approx(w.blood,wr.expectedBlood,1e-9),got:{gain:w.gain,blood:w.blood}});
      const cl=closenessCalc(samples.closeness1.counts); tests.push({name:'Близость: заполненный пример',ok:cl.min===samples.closeness1.expected[0]&&cl.max===samples.closeness1.expected[1]&&cl.avg===samples.closeness1.expected[2],got:cl});
      const at=attractionCalc(samples.attraction1.counts); tests.push({name:'Влечение: заполненный пример',ok:at.min===samples.attraction1.expected[0]&&at.max===samples.attraction1.expected[1]&&at.avg===samples.attraction1.expected[2],got:at});
      const tr=talentRatingCalc(samples.talentRating2.rows,samples.talentRating2.manuscripts,samples.talentRating2.scrolls); tests.push({name:'Рейтинг талантов: исправленный пример',ok:tr.score===samples.talentRating2.expected,got:tr.score});
      const bk=booksCalc(samples.booksFilled.counts,samples.booksFilled.finalBookBonusPct,0); tests.push({name:'Книги: исправленный заполненный пример',ok:approx(bk.gain,samples.booksFilled.expectedCorrected,1e-9),got:bk.gain});
      const ts=tastingCalc(samples.tastingFilled.counts); tests.push({name:'Дегустация: заполненный пример',ok:ts.gain===samples.tastingFilled.expected,got:ts.gain});
      const ms=miscCalc(samples.miscFilled.input); tests.push({name:'Прочее: заполненный пример',ok:ms.gain===samples.miscFilled.expected,got:ms.gain});
      const missingCost=conclaveCalc({watcherCount:1,seals:{Сила:{current:10,target:11}},attrTotals:{}}); tests.push({name:'Конклав: неизвестная стоимость не считается нулём',ok:missingCost.councilComplete===false&&missingCost.missingCostLevels.includes(11),got:missingCost});
      const conclaveAudit=conclaveDataAudit();
      tests.push({name:'Конклав: несоответствие контрольным агрегатам явно обнаруживается',ok:conclaveAudit.fullyMatched===false&&conclaveAudit.directAttribute===610200&&conclaveAudit.expectedDirectAttribute===987000&&conclaveAudit.bookBonusPct===1092&&conclaveAudit.expectedBookBonusPct===1056&&conclaveAudit.missingCostLevels.length===50&&conclaveAudit.referenceArithmeticConsistent,got:conclaveAudit});
      tests.push({name:'Конклав: агрегатные контрольные значения внутренне согласованы',ok:conclaveAudit.expectedCouncilCost*4===Number(refOrZero(DATA.conclaveCommunityAggregate&&DATA.conclaveCommunityAggregate.allFourBranchesCouncilCost))&&conclaveAudit.expectedDirectAttribute*4===Number(refOrZero(DATA.conclaveCommunityAggregate&&DATA.conclaveCommunityAggregate.allFourBranchesAttributePerWarden))&&Number(refOrZero(DATA.conclaveCommunityAggregate&&DATA.conclaveCommunityAggregate.allFourBranchesAttributePerWarden))*40===Number(refOrZero(DATA.conclaveCommunityAggregate&&DATA.conclaveCommunityAggregate.allFourBranchesFor40Wardens)),got:{referenceArithmeticConsistent:conclaveAudit.referenceArithmeticConsistent}});

      const incomplete=wardenCalc({name:'Рудра',currentLevel:350,targetLevel:351,talents:[]}); tests.push({name:'Смотритель: без текущих талантов прирост не выдумывается',ok:incomplete.gainReady===false&&incomplete.gain===0&&incomplete.blood>0,got:{gainReady:incomplete.gainReady,gain:incomplete.gain,blood:incomplete.blood}});
      const dianaDefs=DATA.watchers['Диана']||[];
      const diana=wardenCalc({name:'Диана',currentLevel:100,targetLevel:101,talents:dianaDefs.map(()=>({current:1}))});
      tests.push({name:'Смотритель: атрибут «Воля» нормализуется без потери талантов',ok:diana.active&&diana.gainReady&&diana.attrGain['Воля']>0,got:{gain:diana.gain,willGain:diana.attrGain&&diana.attrGain['Воля']}});
      const maraDefs=DATA.watchers['Мара']||[];
      const mara=wardenCalc({name:'Мара',currentLevel:100,targetLevel:101,talents:maraDefs.map(()=>({current:1}))});
      tests.push({name:'Смотритель: неполный профиль блокирует ложный точный прогноз',ok:mara.dataStatus==='incomplete'&&mara.gain===0&&mara.gainReady===false&&mara.blood>0,got:{dataStatus:mara.dataStatus,gain:mara.gain,gainReady:mara.gainReady,blood:mara.blood}});
      const profileRows=Object.entries(DATA.watchers||{}).flatMap(([name,rows])=>rows.map(row=>({name,row})));
      const badProfiles=profileRows.filter(({row})=>!normalizeAttr(row.attr)||!Number.isInteger(Number(row.star))||Number(row.star)<1||Number(row.star)>6);
      tests.push({name:'База талантов: атрибуты и звёзды проходят структурную проверку',ok:badProfiles.length===0,got:badProfiles.slice(0,10)});

      const rc=resourceCalc(1123.23e6,{'Жетон 1':2,'Жетон 3':1,'Карта сбора':1}); tests.push({name:'Сбор ресурсов: множители',ok:rc.total===1123.23e6*(0.2+1+1),got:rc.total});
      const rs=requirementStatus(10e6,62.44e6,true,true); tests.push({name:'Баллы совета: точный дефицит',ok:rs.state==='bad'&&Math.abs((62.44e6-10e6)-52.44e6)<1,got:rs});
      const b2=booksCalc({Сила:{packII15:2}},{},0); tests.push({name:'Магия II: 15 × 1000',ok:b2.gain===30000,got:b2.gain});
      const heirs=heirMarriageCalc({rings:{amethyst:{stock:2,planned:1,gainPerMarriage:'1,25M'},ruby:{stock:0,planned:2,gainPerMarriage:''},blackPearl:{stock:3,planned:0,gainPerMarriage:''}}});
      tests.push({name:'Наследники: подтверждённый прирост и неизвестная формула',ok:heirs.gain===1250000&&heirs.shortage===2&&heirs.complete===false&&heirs.unknownTypes.includes('ruby'),got:heirs});
      const noHeirs=heirMarriageCalc({rings:{}});
      tests.push({name:'Наследники: пустой план не добавляет господство',ok:noHeirs.gain===0&&noHeirs.planned===0&&noHeirs.shortage===0&&noHeirs.complete===true,got:noHeirs});
      const manual=manualSourcesCalc([{id:1,source:'Сад',gain:'2,5M'},{id:2,source:'Кровные узы',gain:'???'},{id:3,source:'Скины',gain:''}]);
      tests.push({name:'Дополнительные источники: только подтверждённые приросты',ok:manual.gain===2500000&&manual.bySource['Сад']===2500000&&manual.invalidRows.length===1&&manual.missingRows.length===1,got:manual});
      tests.push({name:'K/M/B парсер',ok:parseCompact('5,25M')===5250000&&parseCompact('1.2B')===1200000000&&parseCompact('750K')===750000,got:[parseCompact('5,25M'),parseCompact('1.2B'),parseCompact('750K')]});
      const guild=guildExperienceCalc([{id:1,name:'Участник 1',counts:{goldBucket:2,silverBucket:3,bronzeBucket:4,woodenBucket:5,steelChest:6,simpleChest:7,contribution:8,largeContribution:9}}]);
      tests.push({name:'Опыт гильдии: все 8 коэффициентов из таблицы',ok:guild.total===15940&&guild.totalItems===44&&guild.contributors===1&&guild.itemTotals.goldBucket===2&&guild.itemTotals.largeContribution===9,got:guild});
      const expectedGuildCoefficients=[['goldBucket',500],['silverBucket',100],['bronzeBucket',40],['woodenBucket',20],['steelChest',40],['simpleChest',20],['contribution',400],['largeContribution',1200]];
      const actualGuildCoefficients=(DATA.guildExperienceItems||[]).map(item=>[item.key,item.experience]);
      tests.push({name:'Опыт гильдии: все коэффициенты совпадают с переданной таблицей',ok:JSON.stringify(actualGuildCoefficients)===JSON.stringify(expectedGuildCoefficients),got:actualGuildCoefficients});
      const expectedCloseness=[['Обычный подарок',1,1],['Большой подарок',2,2],['Роскошный подарок',5,5],['Чёртова монета',1,1],['Бронзовая чёртова монета',2,2],['Серебряная чёртова монета',5,5],['Золотая чёртова монета',25,25],['Сумочка близости',1,4],['Мешок близости',5,8],['Шкатулка близости',4,50]];
      const actualCloseness=Object.entries(DATA.closeness).map(([name,range])=>[name,range[0],range[1]]);
      tests.push({name:'Близость: значения совпадают с Excel',ok:JSON.stringify(actualCloseness)===JSON.stringify(expectedCloseness),got:actualCloseness});
      const expectedAttraction=[['Алый букет',1,1],['Синий букет',2,2],['Лиловый букет',5,5],['Бирюзовая записка',1,1],['Индиговая записка',2,2],['Багровая записка',5,5],['Потальная записка',25,25],['Пиала влечения',1,4],['Бутыль влечения',5,8],['Шкатулка влечения',4,50]];
      const actualAttraction=Object.entries(DATA.attraction).map(([name,range])=>[name,range[0],range[1]]);
      tests.push({name:'Влечение: значения совпадают с Excel',ok:JSON.stringify(actualAttraction)===JSON.stringify(expectedAttraction),got:actualAttraction});
      const expectedResources=[['Жетон 1',0.1],['Жетон 2',0.5],['Жетон 3',1],['Жетон 4',2],['Жетон 5',3],['Жетон 6',5],['Жетон 7',10],['Карта сбора',1]];
      tests.push({name:'Сбор ресурсов: коэффициенты совпадают с Excel',ok:JSON.stringify(DATA.resourceMultipliers)===JSON.stringify(expectedResources),got:DATA.resourceMultipliers});

      const guildInvalid=guildExperienceCalc([{id:1,name:'Участник 1',counts:{goldBucket:-1,contribution:'1.5'}}]);
      tests.push({name:'Опыт гильдии: отрицательные и дробные количества не считаются',ok:guildInvalid.total===0&&guildInvalid.complete===false&&guildInvalid.invalidFields.length===2,got:guildInvalid});
      const guildZero=guildExperienceCalc([]);
      tests.push({name:'Опыт гильдии: пустой список',ok:guildZero.total===0&&guildZero.totalItems===0&&guildZero.contributors===0,got:guildZero});
      const zero=conclaveCalc({watcherCount:0,seals:{},attrTotals:{}}); const zeroBooks=booksCalc({},{}); const zeroRange=closenessCalc({}); const zeroTal=talentRatingCalc([],{},{}); tests.push({name:'Нулевое состояние всех модулей',ok:zero.gain===0&&zero.council===0&&zeroBooks.gain===0&&zeroRange.min===0&&zeroRange.max===0&&zeroTal.score===0,got:{zero,zeroBooks,zeroRange,zeroTal}});
    }catch(e){tests.push({name:'Исключение тестов',ok:false,error:String(e&&e.stack||e)});}
    return {ok:tests.every(t=>t.ok),tests};
  }

  return {ATTRS,HEIR_RING_TYPES,MANUAL_DOMINION_SOURCES,parseCompact,formatCompact,conclaveCalc,conclaveDataAudit,requirementStatus,inspirationTotals,talentIncrease,normalizeAttr,wardenCalc,otherWatcherGain,booksCalc,tastingCalc,miscCalc,resourceCalc,closenessCalc,attractionCalc,heirMarriageCalc,manualSourcesCalc,gardenAttributePlan,bloodBondProgressionPlan,guildExperienceCalc,talentRatingCalc,scrollPool,bloodNeeded,levelCoeffAt,selfTests};
});
