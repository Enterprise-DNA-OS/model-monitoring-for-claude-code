#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table as formatTable} from './lib/format.mjs';
import {page,table} from './lib/render.mjs';
import {text,date,resolve,audit,addModel,importFiddler,compare,calculate} from './lib/monitoring.mjs';
const specs={
 help:[],models:[],model:['model'],datasets:['model'],observations:['dataset'],queue:[],quality:[],compliance:[],actions:[],history:[],imports:[],
 drift:['baseline','production'],performance:['baseline','production'],segments:['baseline','production'],evaluate:['baseline','production','actor'],evaluations:[],
 'add-model':['source','external-id','name','version','owner','purpose','feature','unit','cuts','drift-limit','mae-limit','min-samples','review-due','retention-review-due','source-ref','actor'],
 import:['model','manifest','actor','dry-run'],
 'add-action':['model','title','owner','due','actor'],'close-action':['action','evidence','actor'],
 log:['model','body','actor'],review:['model','review-due','retention-review-due','evidence','actor'],
 'draft-review':['baseline','production','file'],export:['file']
};
export const verbs=Object.keys(specs);
const writes=new Set(['evaluate','add-model','import','add-action','close-action','log','review']);
export function human(value){const rows=Array.isArray(value)?value:[value];if(!rows.length)return '(no records)';if(rows.some(r=>!r||typeof r!=='object'))return JSON.stringify(value,null,2);const keys=[...new Set(rows.flatMap(Object.keys))];return formatTable(rows.map(r=>Object.fromEntries(keys.map(k=>[k,typeof r[k]==='object'&&r[k]!==null?JSON.stringify(r[k]):r[k]]))),keys.map(k=>({key:k,label:k,width:k==='id'?36:undefined})));}
function parse(args){const [verb='help',...rest]=args;if(!specs[verb])throw Error('Unknown command. Run help.');const f={},pos=[];
 for(const a of rest){if(!a.startsWith('--')){pos.push(a);continue;}const eq=a.indexOf('='),k=a.slice(2,eq<0?undefined:eq),v=eq<0?true:a.slice(eq+1);if(![...specs[verb],'json'].includes(k))throw Error('Unknown flag: '+k);if(Object.hasOwn(f,k))throw Error('Repeated flag: '+k);f[k]=v;}
 if(verb==='import'){if(pos.length!==1||pos[0]!=='fiddler')throw Error('Use import fiddler --model=... --manifest=... --actor=...');}else if(pos.length)throw Error('Unexpected positional arguments');
 for(const k of ['json','dry-run'])if(f[k]!==undefined&&f[k]!==true)throw Error(k+' is a boolean flag');
 return {verb,f};}
async function body(db,v,f){
 if(v==='help')return verbs.map(command=>({command,arguments:specs[command].map(x=>'--'+x+'=').join(' ')}));
 const queries={models:'SELECT id,name,version,owner,feature_name,unit FROM models ORDER BY name,version',queue:'SELECT * FROM monitoring_queue ORDER BY name,version',quality:'SELECT * FROM dataset_quality ORDER BY model,external_id',compliance:'SELECT * FROM compliance_findings ORDER BY model,rule',actions:'SELECT a.*,m.name AS model FROM actions a JOIN models m ON m.id=a.model_id ORDER BY a.due',history:'SELECT * FROM activity ORDER BY created_at,id',imports:'SELECT * FROM imports ORDER BY created_at,id',evaluations:"SELECT id,model_id,actor,result->>'status' AS status,result,created_at FROM evaluations ORDER BY created_at,id"};
 if(queries[v])return db.query(queries[v]);
 if(v==='model'){const m=await resolve(db,'models',f.model);return {model:m,datasets:await db.query('SELECT * FROM dataset_quality WHERE model_id=$1',[m.id]),notes:await db.query('SELECT * FROM notes WHERE model_id=$1',[m.id])};}
 if(v==='datasets'){const m=await resolve(db,'models',f.model);return db.query('SELECT * FROM dataset_quality WHERE model_id=$1 ORDER BY window_start',[m.id]);}
 if(v==='observations'){const d=await resolve(db,'datasets',f.dataset);return db.query('SELECT event_id,occurred_at,feature,prediction,actual,segment FROM observations WHERE dataset_id=$1 ORDER BY occurred_at,event_id',[d.id]);}
 if(['drift','performance','segments','evaluate','draft-review'].includes(v)){
  const c=await compare(db,f.baseline,f.production),r=c.result;
  if(v==='drift')return [{model:c.model.name,version:c.model.version,baseline:r.baseline_count,production:r.production_count,distance:r.distance,limit:r.drift_limit,missing:r.missing_features,status:r.status}];
  if(v==='performance')return [{model:c.model.name,outcomes:r.outcome_count,total:r.production_count,mae:r.mae,rmse:r.rmse,bias:r.bias,unit:r.unit,status:r.status}];
  if(v==='segments')return [...new Set([...c.b,...c.p].map(x=>x.segment))].sort().map(segment=>{const x=calculate(c.b.filter(x=>x.segment===segment),c.p.filter(x=>x.segment===segment),c.model);return {segment,baseline:x.baseline_count,production:x.production_count,outcomes:x.outcome_count,distance:x.distance,mae:x.mae,status:x.status};});
  if(v==='evaluate'){const e=(await db.query('INSERT INTO evaluations(model_id,baseline_id,production_id,result,actor) VALUES($1,$2,$3,$4,$5) RETURNING *',[c.model.id,c.baseline.id,c.production.id,JSON.stringify(r),f.actor]))[0];await audit(db,c.model.id,f.actor,'evaluate',{evaluation:e.id});return e;}
  const name=text(f.file,'file');if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.html$/.test(name))throw Error('Draft requires a simple .html filename');
  const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,name);
  const html=page({title:'Model monitoring review',subtitle:c.model.name+' '+c.model.version,sections:[{title:'Saved source windows',html:table([{baseline:c.baseline.external_id,production:c.production.external_id}])},{title:'Observed evidence',html:table([r],['status','baseline_count','production_count','outcome_count','distance','mae','unit'])},{title:'Open actions',html:table(await db.query("SELECT title,owner,due FROM actions WHERE model_id=$1 AND status='open'",[c.model.id]))}]});
  fs.writeFileSync(file,html,{flag:'wx',mode:0o600});return {file};
 }
 if(v==='add-model'){const m=await addModel(db,f);await audit(db,m.id,f.actor,v,{model:m.id});return m;}
 if(v==='import')return importFiddler(db,await resolve(db,'models',f.model),text(f.manifest,'manifest'),f.actor,!!f['dry-run']);
 if(v==='add-action'){const m=await resolve(db,'models',f.model);const a=(await db.query('INSERT INTO actions(model_id,title,owner,due) VALUES($1,$2,$3,$4) RETURNING *',[m.id,text(f.title,'title'),text(f.owner,'owner'),date(f.due)]))[0];await audit(db,m.id,f.actor,v,{action:a.id});return a;}
 if(v==='close-action'){const a=await resolve(db,'actions',f.action);const evidence=text(f.evidence,'evidence');const rows=await db.query("UPDATE actions SET status='closed',resolution=$2 WHERE id=$1 AND status='open' RETURNING *",[a.id,evidence]);if(!rows.length)throw Error('Action already closed');await audit(db,a.model_id,f.actor,v,{action:a.id,evidence});return rows[0];}
 if(v==='log'){const m=await resolve(db,'models',f.model);const note=(await db.query('INSERT INTO notes(model_id,body,actor) VALUES($1,$2,$3) RETURNING *',[m.id,text(f.body,'body'),f.actor]))[0];await audit(db,m.id,f.actor,v,{note:note.id});return note;}
 if(v==='review'){const m=await resolve(db,'models',f.model);const evidence=text(f.evidence,'evidence');const out=(await db.query('UPDATE models SET review_due=$2,retention_review_due=$3 WHERE id=$1 RETURNING *',[m.id,date(f['review-due']),date(f['retention-review-due'])]))[0];await audit(db,m.id,f.actor,v,{before:{review_due:m.review_due,retention_review_due:m.retention_review_due},after:{review_due:out.review_due,retention_review_due:out.retention_review_due},evidence});return out;}
 if(v==='export'){const out={format:'model-monitoring-v1',exported_at:new Date().toISOString()};for(const t of ['models','datasets','observations','evaluations','actions','notes','activity','imports'])out[t]=await db.query(`SELECT * FROM ${t} ORDER BY id`);const file=path.resolve(text(f.file,'file'));fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});return {file};}
 throw Error('Not implemented');
}
export async function run(db,args){const {verb,f}=parse(args);if(writes.has(verb))text(f.actor,'actor');await db.exec(writes.has(verb)?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{const out=await body(db,verb,f);await db.exec(f['dry-run']?'ROLLBACK':'COMMIT');return out;}catch(e){await db.exec('ROLLBACK');throw e;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const args=process.argv.slice(2),out=await run(db,args);console.log(args.includes('--json')?JSON.stringify(out,null,2):human(out));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
