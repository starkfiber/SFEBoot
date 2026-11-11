import {tools,callTool,VERSION} from './engine.mjs';
const LIMIT=1048576;
export function startMcp(){
 let initialized=false,ready=false,buffer='',queue=Promise.resolve(),closed=false;
 const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
 async function handle(line){
  let req;
  try{req=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
  const hasId=Object.hasOwn(req||{},'id');
  const validId=!hasId||typeof req.id==='string'||Number.isSafeInteger(req.id);
  if(!req||typeof req!=='object'||Array.isArray(req)||req.jsonrpc!=='2.0'||typeof req.method!=='string'||!validId){send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}});return;}
  const respond=result=>{if(hasId)send({jsonrpc:'2.0',id:req.id,result});};
  const error=(code,message)=>{if(hasId)send({jsonrpc:'2.0',id:req.id,error:{code,message}});};
  if(req.params!==undefined&&(!req.params||typeof req.params!=='object'||Array.isArray(req.params)))return error(-32602,'params must be an object');
  if(req.method==='initialize'){
   if(initialized)return error(-32600,'Already initialized');
   if(!hasId||typeof req.params?.protocolVersion!=='string'||typeof req.params?.clientInfo?.name!=='string'||typeof req.params?.clientInfo?.version!=='string'||!req.params?.capabilities||typeof req.params.capabilities!=='object'||Array.isArray(req.params.capabilities))return error(-32602,'protocolVersion, clientInfo and capabilities required');
   initialized=true;
   return respond({protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'sfeboot',version:VERSION},instructions:'USB build/write simulation/boot verification use regular files. Device inventory and burn plans are read-only; physical writes are unavailable through MCP. VSS and Proxmox return scripts only, never execute them. Check passed and qualification fields: virtual USB proof covers the two pinned ARM64 Alpine entries and the pinned x86_64 Alpine UEFI/BIOS recipe. A Windows Server2025 Setup-only USB case booted and mounted its source volume, but lacks install payload and is not a usable complete installer. Windows construction and launch plans themselves do not prove boot. Windows VSS is unexecuted.'});
  }
  if(req.method==='notifications/initialized'){if(hasId)return error(-32600,'Initialized must be a notification');if(initialized)ready=true;return;}
  if(req.method==='ping')return respond({});
  if(!hasId)return;
  if(!ready)return error(-32002,'Initialize first');
  if(req.method==='tools/list')return respond({tools});
  if(req.method==='tools/call'){
   try{const result=await callTool(req.params?.name,req.params?.arguments);return respond({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:result?.passed===false});}
   catch(e){return respond({content:[{type:'text',text:e.message}],isError:true});}
  }
  error(-32601,'Method not found');
 }
 function tooLarge(){closed=true;send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Message exceeds 1 MiB'}});process.stdin.destroy();buffer='';}
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{
  process.stdin.pause();
  queue=queue.then(async()=>{
   if(closed)return;buffer+=chunk;
   for(;;){const newline=buffer.indexOf('\n');if(newline<0)break;const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(Buffer.byteLength(line)>LIMIT)return tooLarge();if(line.trim())await handle(line);}
   if(Buffer.byteLength(buffer)>LIMIT)return tooLarge();
  }).catch(e=>process.stderr.write(e.message+'\n')).finally(()=>{if(!closed)process.stdin.resume();});
 });
 process.stdin.on('end',()=>{queue=queue.then(async()=>{if(!closed&&buffer.trim())await handle(buffer);buffer='';}).catch(e=>process.stderr.write(e.message+'\n'));});
}
