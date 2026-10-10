import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const rules=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{30}/],
 ['service-account',/"private_key"\s*:\s*"[^"\s]{30}/],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
 ['google-oauth-secret',/\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
 ['stripe-secret',/\bsk_live_[A-Za-z0-9]{20,}\b/],
 ['aws-secret',/\bAKIA[A-Z0-9]{16}\b/],
 ['configured-secret',/(?:CRON_SECRET|UNSUBSCRIBE_SECRET|GMAIL_APP_PASSWORD|RESEND_API_KEY)\s*[=:]\s*['"]?(?!(?:example|placeholder|your_|TU_|test|emulator|a{12}|\$|process\.env))[A-Za-z0-9_-]{16,}(?:['"]|\s|$)/i]
];
export function secretKinds(source){return rules.filter(([,regex])=>regex.test(source)).map(([name])=>name);}
export function fixture(path){return /(^|\/)(tests|node_modules|\.git|public)\//.test(path);}
async function paths(dir='.'){
 const result=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink()||['.git','node_modules','public','.firebase','.vercel','.claims-migration-backup'].includes(entry.name)||entry.name.startsWith('.env'))continue;
  const path=dir==='.'?entry.name:dir+'/'+entry.name;
  if(entry.isDirectory())result.push(...await paths(path));else if(entry.isFile())result.push(path);
 }return result;
}
export async function scanWorkingTree(){
 let files;try{files=execFileSync('git',['ls-files','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);}catch{files=await paths();}
 const findings=[];
 for(const path of files){if(fixture(path)||!/\.(?:[cm]?js|json|md|ya?ml|html|txt|env|pem|key)$/.test(path)&&!/(^|\/)\.env/.test(path))continue;
  let source;try{source=await readFile(path,'utf8');}catch{continue;}
  for(const kind of secretKinds(source))findings.push({path,kind});
 }return findings;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const findings=await scanWorkingTree();
 if(findings.length){console.error(JSON.stringify({findings}));process.exitCode=1;}else console.log('Secret-pattern scan passed (test fixtures excluded; Firebase public API key allowed).');
}
