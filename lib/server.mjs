import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {callTool,capabilities} from './engine.mjs';
export function startServer({port=47831,token=process.env.SFEBOOT_TOKEN,allowedOrigin=process.env.SFEBOOT_ALLOWED_ORIGIN}={}){
 if(typeof token!=='string'||token.length<32)throw Error('SFEBOOT_TOKEN must contain at least 32 characters');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
 if(allowedOrigin){const u=new URL(allowedOrigin);if(u.origin!==allowedOrigin||u.protocol!=='https:')throw Error('Allowed external origin must be an exact HTTPS origin');}
 let busy=false;
 const server=http.createServer(async(req,res)=>{
  const actualPort=server.address().port;const localOrigins=[`http://127.0.0.1:${actualPort}`,`http://localhost:${actualPort}`];
  const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  if(![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(req.headers.host))return reply(403,{error:'Invalid Host'});
  const origin=req.headers.origin;if(origin&&!localOrigins.includes(origin)&&origin!==allowedOrigin)return reply(403,{error:'Origin not allowed'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);return res.end();}
  if(['GET','HEAD'].includes(req.method)&&!req.url.startsWith('/api/')){
   let pathname;try{const root=await fs.realpath(fileURLToPath(new URL('../website',import.meta.url)));pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.split('/').some(p=>p.startsWith('.')))return reply(403,{error:'Hidden paths are not served'});const file=await fs.realpath(path.join(root,pathname==='/'?'index.html':pathname));if(!file.startsWith(root+path.sep)||!(await fs.stat(file)).isFile())return reply(403,{error:'Forbidden'});const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.zip':'application/zip','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:await fs.readFile(file));}catch(e){if(e.code==='ENOENT'&&pathname==='/sfeboot-source.zip'){res.writeHead(302,{Location:'https://starkfiber.my/starkfiber/boot/sfeboot-source.zip','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});return res.end();}return reply(404,{error:'Not found'});}
  }
  const auth=req.headers.authorization||'';const expected='Bearer '+token;const ok=Buffer.byteLength(auth)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(auth),Buffer.from(expected));if(!ok)return reply(401,{error:'Bearer token required'});
  if(req.method==='GET'&&req.url==='/api/capabilities')return reply(200,capabilities());
  if(req.method!=='POST'||req.url!=='/api/tool')return reply(404,{error:'Unknown endpoint'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(415,{error:'Content-Type application/json required'});
  if(busy)return reply(409,{error:'Another operation is running'});
  busy=true;
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1048576)throw Error('Request exceeds 1 MiB');chunks.push(chunk);}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Request must be an object');if(Object.keys(value).some(k=>!['name','arguments'].includes(k)))throw Error('Unknown request field');const result=await callTool(value.name,value.arguments);reply(200,{result});}
  catch(e){reply(400,{error:e.message});}finally{busy=false;}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve({server,token,url:`http://127.0.0.1:${server.address().port}`}));});
}
