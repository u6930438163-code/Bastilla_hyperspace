/** Real Ollama API client; never returns a canned agent reply. */
export function ollamaOrigin(value=process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434'){
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Invalid OLLAMA_BASE_URL');
 if(u.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('Remote Ollama needs private HTTPS connection');
 return u.origin;
}
export function chooseModel(names,model='auto'){
 if(!names.length)throw Error('Brak modelu w Ollama. Użyj ollama pull MODEL na hoście.');
 if(model!=='auto'){
  const found=names.find(n=>n===model)||names.find(n=>n.startsWith(model+':'));
  if(!found)throw Error('Model '+model+' niedostępny. Zainstalowane: '+names.join(', '));
  return found;
 }
 return names.find(n=>/llama3\.2[-:]vision|vision.*11b|llama3\.2:11b/i.test(n))||names[0];
}
function headers(){return {'Content-Type':'application/json',...(process.env.OLLAMA_API_KEY?{Authorization:'Bearer '+process.env.OLLAMA_API_KEY}:{})};}
export async function probeOllama(){
 const url=ollamaOrigin();
 const response=await fetch(url+'/api/tags',{headers:headers(),signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw Error('Ollama /api/tags HTTP '+response.status);
 const obj=await response.json();
 if(!Array.isArray(obj?.models))throw Error('Ollama returned invalid model list');
 const models=obj.models.map(x=>x?.name).filter(x=>typeof x==='string'&&x.length);
 return {url,model:chooseModel(models,process.env.OLLAMA_MODEL||'auto'),models};
}
export async function answerAgent(agent,question){
 if(typeof question!=='string'||!question.trim())throw Error('Puste zadanie');
 const {url,model}=await probeOllama();
 const response=await fetch(url+'/api/chat',{method:'POST',headers:headers(),signal:AbortSignal.timeout(150000),body:JSON.stringify({model,stream:false,messages:[
  {role:'system',content:'Jesteś agentem '+agent+' Bastilla OS. Odpowiadaj po polsku. Ten kanał nie wykonuje komend ani nie posiada narzędzi do modyfikacji hosta. Nie twierdź, że wykonałeś operacje root, zmieniłeś pliki lub przetestowałeś aplikację bez faktycznych wyników narzędzi. Odróżniaj zalecenia od działań wykonanych.'},
  {role:'user',content:question}
 ]})});
 if(!response.ok)throw Error('Ollama /api/chat HTTP '+response.status);
 const data=await response.json(),content=typeof data?.message?.content==='string'?data.message.content.trim():'';
 if(!content)throw Error('Ollama zwróciła pustą odpowiedź');
 return {content:content.slice(0,16000),model};
}
