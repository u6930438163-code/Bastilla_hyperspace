import {probeOllama,answerAgent} from './ollama-agent.mjs';
const agent=process.env.AGENT_NAME,token=process.env.WORKER_TOKEN,port=Number(process.env.PORT||3000);
if(!['Alex','Aria','Astyria','Aurelius'].includes(agent)||!token||token.length<32)throw Error('Missing configured agent token');
const base='http://127.0.0.1:'+port+'/api/worker',workerId=agent+'-'+process.pid;
async function post(route,data){
 const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(route+' HTTP '+response.status);
 return response.json();
}
async function heartbeat(){
 let modelReady=false,model=null,error=null;
 try{model=(await probeOllama()).model;modelReady=true;}catch(e){error=String(e.message).slice(0,180);}
 try{await post('/heartbeat',{workerId,modelReady,model,error});}catch(e){console.error('[WORKER '+agent+'] heartbeat: '+e.message);}
}
let busy=false;
async function next(){
 if(busy)return;busy=true;
 try{
  const {job}=await post('/next',{workerId});
  if(!job)return;
  try{
   const result=await answerAgent(agent,job.content);
   await post('/complete',{workerId,jobId:job.id,content:result.content,provider:'Ollama · '+result.model});
   console.log('[WORKER '+agent+'] complete '+job.id+' using '+result.model);
  }catch(e){
   const error=String(e.message).slice(0,250);
   console.error('[WORKER '+agent+'] failed '+job.id+': '+error);
   try{await post('/fail',{workerId,jobId:job.id,error});}catch(e2){console.error('[WORKER '+agent+'] fail callback: '+e2.message);}
  }
 }catch(e){console.error('[WORKER '+agent+'] polling: '+e.message);}
 finally{busy=false;}
}
void heartbeat();void next();setInterval(()=>void heartbeat(),12000);setInterval(()=>void next(),4000);
process.on('disconnect',()=>process.exit(0));
