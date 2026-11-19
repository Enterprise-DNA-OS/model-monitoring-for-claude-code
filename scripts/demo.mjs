import {getDb} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,human} from './monitor.mjs';
const db=await getDb();try{if(db.mode==='postgres')throw Error('Demo uses the local database; unset DATABASE_URL.');await migrate(db);await seed(db);for(const command of ['drift','performance','segments'])console.log(command+'\n'+human(await run(db,[command,'--baseline=reference','--production=this-week'])));}finally{await db.close();}
