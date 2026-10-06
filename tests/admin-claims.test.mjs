import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {manageAdminClaims,ADMIN_TARGET_EMAILS} from '../scripts/admin-claims-core.mjs';
import {filterUsers} from '../security/claims/management.mjs';
function fake(){
 const users=ADMIN_TARGET_EMAILS.map((email,i)=>({uid:'uid-'+i,email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}],customClaims:{existing:'keep'}})),roles=new Map(),writes=[];
 const auth={getUserByEmail:async email=>users.find(u=>u.email===email),getUser:async uid=>users.find(u=>u.uid===uid),setCustomUserClaims:async(uid,claims)=>{writes.push(uid);users.find(u=>u.uid===uid).customClaims=claims;}};
 const db={collection:()=>({doc:id=>({id,get:async()=>({exists:roles.has(id),data:()=>roles.get(id)})})}),batch:()=>{const pending=[];return {set:(ref,data)=>pending.push([ref.id,data]),commit:async()=>pending.forEach(([id,data])=>roles.set(id,data))};}};
 return {auth,db,users,roles,writes};
}
test('Grant verifies both identities, preserves other claims and protects both UIDs',async()=>{
 const f=fake();const initial=await manageAdminClaims(f.auth,f.db);assert.ok(initial.every(r=>!r.claim&&!r.protected));assert.equal(f.writes.length,0);
 const granted=await manageAdminClaims(f.auth,f.db,'grant');assert.ok(granted.every(r=>r.claim&&r.protected));assert.ok(f.users.every(u=>u.customClaims.existing==='keep'));assert.equal(f.roles.size,2);
 f.users[1].emailVerified=false;f.writes.length=0;await assert.rejects(manageAdminClaims(f.auth,f.db,'grant'));assert.equal(f.writes.length,0);
});
test('Client filters administrators by UID rather than matching an email',()=>{
 const users=[{id:'admin',name:'Admin',email:'same@example.com'},{id:'student',name:'Student',email:'same@example.com'}];
 assert.deepEqual(filterUsers(users,'','','admin',['admin']).map(u=>u.id),['admin']);
});
test('Staged client removes email authorization while preserving business rules',async()=>{
 for(const file of ['app.js','domain.mjs','management.mjs']){const source=await readFile(new URL('../security/claims/'+file,import.meta.url),'utf8');assert.ok(!source.includes('ADMIN_EMAIL'));assert.ok(!source.includes('sebastianezequielmedina@gmail.com'));execFileSync(process.execPath,['--check',new URL('../security/claims/'+file,import.meta.url).pathname]);}
 const original=await readFile(new URL('../firestore.rules',import.meta.url),'utf8'),candidate=await readFile(new URL('../security/claims/firestore.rules',import.meta.url),'utf8');assert.equal(candidate.slice(candidate.indexOf('    function shortText')),original.slice(original.indexOf('    function shortText')));assert.ok(candidate.includes('request.auth.token.admin == true'));assert.ok(candidate.includes('allow write: if false;'));assert.ok(!candidate.includes('@gmail.com'));
 const app=await readFile(new URL('../security/claims/app.js',import.meta.url),'utf8');assert.ok(app.includes('getIdTokenResult'));assert.ok(app.includes('authRequestId!==authRequest'));assert.ok(app.includes("getDoc(doc(db,'adminRoles',uid))"));
});
