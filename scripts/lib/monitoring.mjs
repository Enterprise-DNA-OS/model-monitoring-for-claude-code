import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv} from './csv.mjs';
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export function text(v,label){if(typeof v!=='string'||!v.trim())throw Error(`${label} must be nonempty text`);return v.trim();}
export function number(v,label,{nullable=false,min=-1e12,max=1e12,integer=false}={}){
 if(v===null||v===undefined||v===''){if(nullable)return null;throw Error(`${label} is required`);}
 if(!['string','number'].includes(typeof v)||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(v).trim()))throw Error(`${label} must be a finite number`);
 const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(`${label} out of range`);return n;
}
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Expected a real YYYY-MM-DD date');return v;}
export function instant(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))throw Error('Timestamp requires ISO date, time, seconds and timezone');date(v.slice(0,10));if(!Number.isFinite(Date.parse(v))||Number(v.slice(11,13))>23)throw Error('Invalid timestamp');return new Date(v).toISOString();}
export function cuts(v){const xs=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(xs)||!xs.length||xs.length>30)throw Error('cuts needs 1 to 30 numeric boundaries');const ns=xs.map(x=>number(x,'cut'));if(ns.some((x,i)=>i&&x<=ns[i-1]))throw Error('cuts must increase strictly');return ns;}
export async function resolve(db,table,selector){
 if(!['models','datasets','actions'].includes(table))throw Error('Unknown record type');text(selector,table);
 const label=table==='models'?"name||' '||version":table==='datasets'?'external_id':'title';
 const rows=await db.query(`SELECT *,${label} AS label FROM ${table} WHERE id::text=$1 OR lower(${label})=lower($1) OR id::text LIKE $2 ORDER BY id`,[selector,selector.toLowerCase()+'%']);
 if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'Unknown'} ${table}: ${selector}\n`+rows.map(r=>`${r.id} ${r.label}`).join('\n'));return rows[0];
}
export async function audit(db,model,actor,operation,detail){await db.query('INSERT INTO activity(model_id,actor,operation,detail) VALUES($1,$2,$3,$4)',[model,actor,operation,JSON.stringify(detail)]);}
export async function addModel(db,f){
 const m={source:text(f.source,'source'),external_id:text(f['external-id'],'external-id'),name:text(f.name,'name'),version:text(f.version,'version'),owner:text(f.owner,'owner'),purpose:text(f.purpose,'purpose'),feature_name:text(f.feature,'feature'),unit:text(f.unit,'unit'),cuts:JSON.stringify(cuts(f.cuts)),drift_limit:number(f['drift-limit'],'drift-limit',{min:0,max:1}),mae_limit:number(f['mae-limit'],'mae-limit',{min:0}),min_samples:number(f['min-samples'],'min-samples',{min:2,max:1000000,integer:true}),review_due:date(f['review-due']),retention_review_due:date(f['retention-review-due']),source_ref:text(f['source-ref'],'source-ref')};
 const keys=Object.keys(m);return (await db.query(`INSERT INTO models(${keys}) VALUES(${keys.map((_,i)=>'$'+(i+1))}) RETURNING *`,Object.values(m)))[0];
}
export async function importFiddler(db,model,file,actor,dryRun){
 const raw=fs.readFileSync(file,'utf8'), manifest=JSON.parse(raw);text(manifest.source_ref,'manifest source_ref');
 if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('manifest needs files');
 const payload=[];const ids=new Set();
 for(const spec of manifest.files){
  text(spec.external_id,'dataset external_id');if(ids.has(spec.external_id))throw Error('Duplicate dataset external_id');ids.add(spec.external_id);
  if(!['baseline','production'].includes(spec.kind))throw Error('kind must be baseline or production');
  const start=instant(spec.window_start),end=instant(spec.window_end);if(start>=end)throw Error('Window end must follow start');
  const expected=number(spec.expected_count,'expected_count',{min:1,max:10000000,integer:true});
  const csv=fs.readFileSync(path.resolve(path.dirname(file),text(spec.path,'path')),'utf8'), rows=parseCsv(csv);
  if(rows.length!==expected)throw Error(`Count mismatch for ${spec.external_id}: expected ${expected}, read ${rows.length}`);
  const seen=new Set();const mapped=rows.map(row=>{
   const o={};for(const k of ['event_id','occurred_at','feature','prediction','actual','segment']){const col=spec.columns?.[k];if(typeof col!=='string'||!Object.hasOwn(row,col))throw Error(`Missing exported column for ${k}`);o[k]=row[col];}
   o.event_id=text(o.event_id,'event_id');if(seen.has(o.event_id))throw Error('Duplicate event_id');seen.add(o.event_id);
   o.occurred_at=instant(o.occurred_at);if(o.occurred_at<start||o.occurred_at>=end)throw Error('Event outside half-open dataset window');
   for(const k of ['feature','prediction','actual'])o[k]=number(o[k],k,{nullable:k!=='prediction'});o.segment=text(o.segment,'segment');return o;
  });
  payload.push({external_id:spec.external_id,kind:spec.kind,window_start:start,window_end:end,expected_count:expected,source_ref:manifest.source_ref,digest:hash({spec,csv}),rows:mapped});
 }
 const digest=hash({raw,payload});const previous=await db.query('SELECT * FROM imports WHERE model_id=$1 AND digest=$2',[model.id,digest]);if(previous.length)return {replayed:true,datasets:0,rows:0};
 let added=0,skipped=0,count=0;
 for(const p of payload){
  const old=await db.query('SELECT * FROM datasets WHERE model_id=$1 AND external_id=$2',[model.id,p.external_id]);
  if(old.length){if(old[0].digest!==p.digest)throw Error(`Conflicting evidence: ${p.external_id}; use a new snapshot ID`);skipped++;continue;}
  const ds=(await db.query('INSERT INTO datasets(model_id,external_id,kind,window_start,window_end,expected_count,source_ref,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[model.id,p.external_id,p.kind,p.window_start,p.window_end,p.expected_count,p.source_ref,p.digest]))[0];
  for(const o of p.rows)await db.query('INSERT INTO observations(dataset_id,event_id,occurred_at,feature,prediction,actual,segment) VALUES($1,$2,$3,$4,$5,$6,$7)',[ds.id,o.event_id,o.occurred_at,o.feature,o.prediction,o.actual,o.segment]);
  added++;count+=p.rows.length;
 }
 await db.query('INSERT INTO imports(model_id,digest,source_ref,datasets,rows,actor) VALUES($1,$2,$3,$4,$5,$6)',[model.id,digest,manifest.source_ref,added,count,actor]);
 await audit(db,model.id,actor,'import',{digest,added,skipped,rows:count});return {dry_run:dryRun,added,skipped,rows:count};
}
export function calculate(baseline,production,model){
 const boundaries=cuts(model.cuts),size=boundaries.length+2;
 const bin=v=>v===null?size-1:(boundaries.findIndex(c=>v<c)===-1?size-2:boundaries.findIndex(c=>v<c));
 const counts=rows=>{const out=Array(size).fill(0);for(const r of rows)out[bin(r.feature)]++;return out;};
 const b=counts(baseline),p=counts(production);
 const enough=baseline.length>=model.min_samples&&production.length>=model.min_samples;
 const distance=baseline.length&&production.length?b.reduce((s,x,i)=>s+Math.abs(x/baseline.length-p[i]/production.length),0)/2:null;
 const labelled=production.filter(r=>r.actual!==null);const errors=labelled.map(r=>r.prediction-r.actual);
 const mae=errors.length?errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length:null;
 const rmse=errors.length?Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length):null;
 const bias=errors.length?errors.reduce((s,x)=>s+x,0)/errors.length:null;
 const findings=[];
 if(!enough)findings.push('insufficient feature samples');
 if(enough&&distance>model.drift_limit)findings.push('distribution shift');
 if(labelled.length<model.min_samples)findings.push('insufficient observed outcomes');
 if(labelled.length>=model.min_samples&&mae>model.mae_limit)findings.push('forecast error above limit');
 return {algorithm:'fixed-bin-total-variation-v1',status:findings.some(x=>/shift|above/.test(x))?'needs review':findings.length?'insufficient evidence':'within configured limits',baseline_count:baseline.length,production_count:production.length,outcome_count:labelled.length,outcome_coverage:production.length?labelled.length/production.length:null,missing_features:production.filter(x=>x.feature===null).length,distance,mae,rmse,bias,unit:model.unit,cuts:boundaries,drift_limit:model.drift_limit,mae_limit:model.mae_limit,min_samples:model.min_samples,baseline_bins:b,production_bins:p,findings};
}
export async function compare(db,bsel,psel){
 const baseline=await resolve(db,'datasets',bsel),production=await resolve(db,'datasets',psel);
 if(baseline.kind!=='baseline'||production.kind!=='production')throw Error('Need a baseline and a production dataset');
 if(baseline.model_id!==production.model_id)throw Error('Datasets must belong to the same model version');
 if(new Date(baseline.window_end)>new Date(production.window_start))throw Error('Baseline must finish before production starts');
 const model=(await db.query('SELECT * FROM models WHERE id=$1',[baseline.model_id]))[0];
 const b=await db.query('SELECT * FROM observations WHERE dataset_id=$1 ORDER BY event_id',[baseline.id]),p=await db.query('SELECT * FROM observations WHERE dataset_id=$1 ORDER BY event_id',[production.id]);
 if(b.length!==baseline.expected_count||p.length!==production.expected_count)throw Error('Incomplete dataset');
 return {model,baseline,production,b,p,result:calculate(b,p,model)};
}
