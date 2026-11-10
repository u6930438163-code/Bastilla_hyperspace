/** Real container telemetry; this is not a Debian host observer. */
import fs from 'node:fs';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const token=process.env.SVL_LINUX_SYNC_TOKEN,port=Number(process.env.PORT||3000);
if(!token||token.length<32)throw Error('Missing container observer token');
function diskPercent(){
 try{const x=fs.statfsSync('/'),total=Number(x.blocks)*Number(x.bsize),free=Number(x.bavail)*Number(x.bsize);return total?Math.round((1-free/total)*1000)/10:0;}catch{return 0;}
}
function services(){
 try{
  const out=execFileSync('systemctl',['list-units','--all','--type=service','--plain','--no-legend','--no-pager'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000});
  return out.split('\n').filter(Boolean).slice(0,180).flatMap(line=>{
   const parts=line.trim().replace(/^●\s*/,'').split(/\s+/);
   return parts.length>=4&&parts[0].endsWith('.service')?[{name:parts[0],state:parts[2]+'/'+parts[3]}]:[];
  });
 }catch{return [];}
}
async function send(){
 const total=os.totalmem(),free=os.freemem();
 let ollama={reachable:false,models:[]};
 try{
  const u=new URL(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434');
  if(u.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(u.hostname)){
   const r=await fetch(u.origin+'/api/tags',{signal:AbortSignal.timeout(2000)});
   if(r.ok){const d=await r.json();ollama={reachable:true,models:(d.models||[]).map(x=>x.name).filter(Boolean).slice(0,40)};}
  }
 }catch{}
 const payload={scope:'app-container',hostname:os.hostname(),os:os.type()+' '+os.release(),kernel:os.release(),observedAt:new Date().toISOString(),
  uid:process.geteuid?.()??null,memoryPercent:total?Math.round((1-free/total)*1000)/10:0,diskPercent:diskPercent(),
  processCount:(()=>{try{return fs.readdirSync('/proc').filter(s=>/^\d+$/.test(s)).length;}catch{return 0;}})(),
  services:services(),ollama};
 try{const r=await fetch('http://127.0.0.1:'+port+'/api/linux/ingest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)});
  if(!r.ok)console.error('[OBSERVER] HTTP '+r.status);
 }catch(e){console.error('[OBSERVER] '+e.message);}
}
void send();setInterval(()=>void send(),15000);process.on('disconnect',()=>process.exit(0));
