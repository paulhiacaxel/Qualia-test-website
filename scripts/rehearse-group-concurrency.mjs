/**
 * Destructive fixture initialization, exclusively for an EMPTY local disposable
 * database named qualia_group_race_fixture. No hosted credentials are accepted.
 * Run with `QUALIA_RACE_DATABASE_URL=postgresql://USER@127.0.0.1/qualia_group_race_fixture
 * node scripts/rehearse-group-concurrency.mjs`. Install `pg` and the existing
 * PGlite dev dependency in a disposable runner, never in production.
 * The database is left for inspection; this script never drops databases.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { asRole, acceptFixtureLegal, fixtureSafetySubmission } from '../tests/database/helpers.mjs';

const url = new URL(process.env.QUALIA_RACE_DATABASE_URL ?? 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.ok(['127.0.0.1', '[::1]'].includes(url.hostname), 'Only a literal loopback endpoint is allowed');
assert.equal(url.pathname, '/qualia_group_race_fixture');
assert.equal(url.search, '', 'Connection overrides are forbidden');
const connections = [];
async function connect() {
  const client = new pg.Client({ connectionString: url.href, application_name: 'qualia-disposable-race' });
  await client.connect();
  client.exec = (sql) => client.query(sql);
  await client.query("set statement_timeout='15s'; set lock_timeout='10s'");
  connections.push(client);
  return client;
}
const scalar = async (client, name, args = []) => (await client.query(
  `select public.${name}(${args.map((_, i) => `$${i+1}`).join(',')}) as value`, args,
)).rows[0].value;
let admin;
let host;
let db;
let sequence = 0;
const actor = (id, callback) => asRole(db, 'authenticated', id, callback);
async function user(isHost = false) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())', [id]);
  await actor(id, () => scalar(db, 'attest_adult_account', [true, 'adult_account_v1']));
  await acceptFixtureLegal(db, id, {host:isHost});
  if (isHost) {
    await actor(id, () => scalar(db, 'enable_host_mode'));
    await actor(id, () => scalar(db, 'save_host_profile', ['Synthetic race host','Synthetic portfolio.','Miami',null]));
  }
  return id;
}
async function fixture({capacity = 2, resources = [], start} = {}) {
  start ??= new Date(Date.UTC(2099,5,1+sequence++,14)).toISOString();
  const id = await actor(host, () => scalar(db, 'create_listing', ['Synthetic concurrency activity','Synthetic reviewed activity.','art',12000,60,'Miami','Wynwood']));
  await actor(host, async () => {
    await scalar(db, 'save_listing_booking_options', [id,'both',capacity,'group',2500,resources]);
    await scalar(db, 'save_listing_location', [id,'SYNTHETIC VENUE','','33127','Synthetic meeting instructions.']);
    const path = `${host}/${id}/${randomUUID()}.jpg`;
    await db.query("insert into storage.objects(bucket_id,name,owner_id) values('listing-photos',$1,$2)",[path,host]);
    await scalar(db,'add_listing_photo',[id,path,'Synthetic demonstration',0]);
    await scalar(db,'add_availability_window',[id,start,new Date(Date.parse(start)+3*3600000).toISOString()]);
  });
  const revision = await actor(host,()=>scalar(db,'save_listing_safety_submission',[id,null,fixtureSafetySubmission({supervision_plan:'Synthetic reviewed supervision for every participant.'})]));
  await actor(host,()=>scalar(db,'submit_listing_for_review',[id]));
  await actor(admin,()=>scalar(db,'admin_review_listing_safety',[id,revision,'approved','Synthetic reviewed group activity.','2100-01-01T00:00:00Z',false]));
  for(const action of ['approve_safety','waive_consultation','publish']) {
    const version=(await db.query('select updated_at::text as v from public.listings where id=$1',[id])).rows[0].v;
    await actor(admin,()=>scalar(db,'admin_review_listing',[id,action,version,'Synthetic approval.','',null,'Synthetic group-specific risk assessment.',{profile:true,experience:true,location:true,risks:true}]));
  }
  return {id,start,revision};
}
function request(client,f,{mode='shared',count=1}={}) {
  const envelope={members:Array.from({length:count},()=>({kind:'adult',age_at_experience:30})),adult_booker_confirmed:true,rules_accepted:true,guardian_authority_confirmed:false,guardian_presence_accepted:false,rules_revision:f.revision,group_authority_confirmed:true};
  return scalar(client,'request_group_booking',[f.id,f.start,'Synthetic actual multi-connection rehearsal',envelope,mode,count]);
}
async function begin(client, guest) {
  await client.query('begin');
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[guest]);
  await client.query('set local role authenticated');
}
async function waitBlocked(observer, blockerPid, blockedPid) {
  const deadline=Date.now()+7000;
  while(Date.now()<deadline) {
    const state=(await observer.query("select pid,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1",[blockedPid])).rows[0];
    if(state?.wait_event_type==='Lock' && state.blockers.includes(blockerPid)) return state;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('Second PostgreSQL backend did not demonstrably wait on the first');
}
const evidence=[];
async function race(label,fa,fb,optionsA={},optionsB={},expectConflict=true) {
  const a=await connect(), b=await connect();
  const ga=await user(),gb=await user();
  await begin(a,ga); await begin(b,gb);
  const pidA=(await a.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pidB=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  assert.notEqual(pidA,pidB);
  const first=await request(a,fa,optionsA);
  const second=request(b,fb,optionsB).then(id=>({ok:true,id}),error=>({ok:false,code:error.code,message:error.message}));
  const blocking=await waitBlocked(db,pidA,pidB);
  await a.query('commit');
  const result=await second;
  if(expectConflict) { assert.equal(result.ok,false);assert.equal(result.code,'23P01');await b.query('rollback'); }
  else {assert.equal(result.ok,true,result.message);await b.query('commit');}
  const record={case:label,backendA:pidA,backendB:pidB,blocking,committed:expectConflict?1:2,rejected:expectConflict?1:0,rejectionCode:result.code??null};
  evidence.push(record);console.log(JSON.stringify(record));
  return {first,second:result.id,ga};
}
try {
  db=await connect();
  assert.equal((await db.query('select current_database() as db')).rows[0].db,'qualia_group_race_fixture');
  assert.equal((await db.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%' and c.relkind in ('r','p')")).rows[0].n,0,'Fixture database must be empty');
  // Reuse exactly the synthetic Supabase catalog bootstrap maintained for the
  // regular database tests, rather than a divergent approximation of its roles.
  const helper=await readFile(new URL('../tests/database/helpers.mjs',import.meta.url),'utf8');
  const bootstrap=helper.match(/await db\.exec\(`([\s\S]*?)`\);/);
  assert.ok(bootstrap,'Synthetic bootstrap must remain extractable');
  await db.query(bootstrap[1]);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const hash=createHash('sha256');
  for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort()) {
    const sql=await readFile(new URL(name,directory),'utf8');hash.update(name);hash.update(sql);await db.query(sql);
  }
  console.log(JSON.stringify({postgres:(await db.query('select version() as version')).rows[0].version,migrationsSha256:hash.digest('hex')}));
  host=await user(true);admin=await user();
  await db.query("insert into private.admin_memberships(user_id,reason) values($1,'Synthetic concurrency reviewer')",[admin]);
  await actor(admin,()=>scalar(db,'admin_set_booking_policy',[1440,1440,true]));
  const lastSeat=await fixture({capacity:2});
  const initialGuest=await user();
  await actor(initialGuest,()=>request(db,lastSeat));
  await race('two parties contend for the last shared seat',lastSeat,lastSeat);
  const privateFirst=await fixture({capacity:4});
  await race('private buyout commits while shared-seat request waits',privateFirst,privateFirst,{mode:'private',count:2});
  const sharedFirst=await fixture({capacity:4});
  await race('shared seats commit while private buyout waits',sharedFirst,sharedFirst,{count:2},{mode:'private',count:2});
  const resource=await actor(host,()=>scalar(db,'save_host_resource',[null,'Synthetic common boat','boat']));
  const one=await fixture({resources:[resource]});
  const two=await fixture({resources:[resource],start:one.start});
  await race('different listings contend for the same boat',one,two,{mode:'private'},{mode:'private'});
  const resource2=await actor(host,()=>scalar(db,'save_host_resource',[null,'Synthetic independent boat','boat']));
  const independent1=await fixture({resources:[resource]});
  const independent2=await fixture({resources:[resource2],start:independent1.start});
  await race('independent boats remain bookable after lock serialization',independent1,independent2,{mode:'private'},{mode:'private'},false);
  const release=await fixture({capacity:1});const oldGuest=await user();
  const oldId=await actor(oldGuest,()=>request(db,release));
  const a=await connect(),b=await connect();const nextGuest=await user();
  await begin(a,oldGuest);await begin(b,nextGuest);
  const pa=(await a.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pb=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  await scalar(a,'cancel_unpaid_booking',[oldId]);
  const replacement=request(b,release).then(id=>({ok:true,id}),error=>({ok:false,message:error.message}));
  const blocking=await waitBlocked(db,pa,pb);await a.query('commit');const result=await replacement;
  assert.equal(result.ok,true,result.message);await b.query('commit');
  assert.equal((await db.query('select status from public.bookings where id=$1',[oldId])).rows[0].status,'cancelled');
  const releaseRecord={case:'unpaid cancellation releases final seat atomically',backendA:pa,backendB:pb,blocking,cancelled:1,replacementCommitted:1};evidence.push(releaseRecord);console.log(JSON.stringify(releaseRecord));
  console.log(JSON.stringify({passed:evidence.length,total:evidence.length,providerPaymentTested:false,productionTouched:false}));
} finally {
  await Promise.allSettled(connections.map(async c=>{await c.query('rollback').catch(()=>{});await c.end();}));
}
