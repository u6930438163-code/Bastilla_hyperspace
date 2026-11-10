import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chooseModel,ollamaOrigin,answerAgent} from '../scripts/ollama-agent.mjs';
test('installed models only',()=>{
 assert.equal(chooseModel(['qwen3:14b','llama3.2-vision:11b']),'llama3.2-vision:11b');
 assert.equal(chooseModel(['qwen3:14b','llama3.2:vision-11b']),'llama3.2:vision-11b');
 assert.equal(chooseModel(['llama3.2-vision:11b'],'llama3.2-vision'),'llama3.2-vision:11b');
 assert.throws(()=>chooseModel(['qwen3:14b'],'llama3.2-vision'),/niedostępny/);
 assert.throws(()=>chooseModel([]),/Brak modelu/);
 assert.throws(()=>ollamaOrigin('http://external.example:11434'),/HTTPS/);
});
test('real Ollama API response, no canned completion',async()=>{
 const requests=[];
 const api=createServer(async(req,res)=>{
  requests.push(req.url);res.setHeader('content-type','application/json');
  if(req.url==='/api/tags')return res.end(JSON.stringify({models:[{name:'qwen3:14b'}]}));
  if(req.url==='/api/chat'){let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(raw);
   assert.equal(p.model,'qwen3:14b');assert.equal(p.messages[1].content,'test');assert.equal(p.stream,false);
   return res.end(JSON.stringify({message:{content:'Odpowiedź wygenerowana przez testowy endpoint'}}));}
  res.statusCode=404;res.end('{}');
 });
 await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const old=process.env.OLLAMA_BASE_URL;
 try{process.env.OLLAMA_BASE_URL='http://127.0.0.1:'+api.address().port;
  const answer=await answerAgent('Alex','test');
  assert.equal(answer.content,'Odpowiedź wygenerowana przez testowy endpoint');
  assert.deepEqual(requests,['/api/tags','/api/chat']);
 }finally{if(old===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=old;await new Promise(r=>api.close(r));}
});
