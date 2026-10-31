// Lentera Ekonomi CMS: Cloudflare Worker auth + GitHub-backed articles.
// Secrets only in Cloudflare: ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN.
const REPO = 'bravocompanion/lenteraekonomi';
const BRANCH = 'main';
const USERNAME = 'pakde';
const COOKIE = '__Host-lentera_admin';
const SESSION_SECONDS = 8 * 60 * 60;
const CATEGORIES = ['Dasar Ekonomi','Keuangan Pribadi','Bisnis & UMKM','Ekonomi Indonesia'];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function response(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer',
    ...extra,
  }});
}
const jsonError=(message,status=400)=>response({ok:false,error:message},status);
const redirect=(url)=>new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store'}});
const b64url=(bytes)=> btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unb64(str) {
  if(!/^[A-Za-z0-9_-]+$/.test(str))throw Error('Invalid base64url');
  const binary=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function plainBase64(bytes) {
  let str='';
  for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(str);
}
function fromBase64(data) {
  const raw=atob(data.replace(/\s/g,''));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
const utfBase64=s=>plainBase64(encoder.encode(s));
const decodeUtf=s=>decoder.decode(fromBase64(s));
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw',encoder.encode(secret),'HMAC',false,['sign','verify']);
}
async function sign(payload,secret) {
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),encoder.encode(payload)));
  return payload+'.'+b64url(sig);
}
async function verifySigned(value,secret) {
  if(typeof value!=='string'||value.length>2500)return null;
  const dot=value.indexOf('.');
  if(dot<1)return null;
  const payload=value.slice(0,dot),signature=value.slice(dot+1);
  try {
    const valid=await crypto.subtle.verify('HMAC',await hmacKey(secret),unb64(signature),encoder.encode(payload));
    return valid ? JSON.parse(decoder.decode(unb64(payload))) : null;
  } catch {return null}
}
function cookieValue(request) {
  const match=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-lentera_admin=([^;]+)/);
  return match?.[1]||null;
}
async function session(request,env) {
  if(!env.SESSION_SECRET)return null;
  const data=await verifySigned(cookieValue(request),env.SESSION_SECRET);
  if(!data||data.u!==USERNAME||!Number.isSafeInteger(data.exp)||data.exp<=Math.floor(Date.now()/1000)||! /^[a-f0-9-]{36}$/.test(data.csrf||''))return null;
  return data;
}
const sessionCookie=(value,maxAge)=> COOKIE+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;
function allowedOrigin(request) {
  const origin=request.headers.get('Origin');
  return origin===new URL(request.url).origin;
}
function requireCsrf(request,s) {
  return !!s&&allowedOrigin(request)&&request.headers.get('X-CSRF-Token')===s.csrf;
}
async function compareSecret(input,expected) {
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(input)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
  const left=new Uint8Array(a),right=new Uint8Array(b);
  let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];
  return diff===0;
}
async function readJson(request,maxBytes=180000) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw Error('Content-Type harus application/json.');
  const cl=Number(request.headers.get('Content-Length')||0);
  if(cl>maxBytes)throw Error('Ukuran data melebihi batas.');
  const text=await request.text();
  if(text.length>maxBytes)throw Error('Ukuran data melebihi batas.');
  try {return JSON.parse(text)} catch {throw Error('Data JSON tidak valid.')}
}
function cleanHeaders(extra={}){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+extra.token,'User-Agent':'lenteraekonomi-cms','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json',};}
async function github(env,method,path,body) {
  const url='https://api.github.com/repos/'+REPO+'/contents/'+path+(method==='GET'?'?ref='+BRANCH:'');
  const r=await fetch(url,{method,headers:cleanHeaders({token:env.GITHUB_TOKEN}),body:body?JSON.stringify(body):undefined});
  let data=null;try {data=await r.json()}catch{}
  if(!r.ok) {
    const safe=r.status===409||r.status===422?'File telah berubah atau permintaan ditolak. Muat ulang sebelum menyimpan.':
      r.status===401||r.status===403?'Akses GitHub gagal. Periksa token dan izin Contents.':
      r.status===404?'Artikel atau repository tidak ditemukan.':
      'GitHub gagal memproses permintaan (HTTP '+r.status+').';
    const e=new Error(safe);e.status=r.status;throw e;
  }
  return data;
}
const articlePath=slug=>'content/articles/'+slug+'.md';
function fieldString(v,max) {return typeof v==='string'&&v.trim().length<=max?v.trim():''}
function yamlQuote(v) {return JSON.stringify(v)}
function articleText(a) {
  return '---\n'+
  'title: '+yamlQuote(a.title)+'\n'+
  'description: '+yamlQuote(a.description)+'\n'+
  'category: '+yamlQuote(a.category)+'\n'+
  'date: '+yamlQuote(a.date)+'\n'+
  'author: '+yamlQuote(a.author)+'\n'+
  'cover: '+yamlQuote(a.cover)+'\n'+
  'published: '+(a.published?'true':'false')+'\n'+
  'featured: '+(a.featured?'true':'false')+'\n'+
  '---\n\n'+a.body.trim()+'\n';
}
function parseArticle(source) {
  const result={};
  const match=source.replace(/\r\n/g,'\n').match(/^---\n([\s\S]*?)\n---\s*\n/);
  if(!match)return {body:source};
  for(const line of match[1].split('\n')){
    const m=line.match(/^(\w+):\s*(.*)$/);
    if(!m)continue;
    let v=m[2];
    if(v.startsWith('"')){try{v=JSON.parse(v)}catch{}}
    else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);
    else if(v==='true')v=true;
    else if(v==='false')v=false;
    result[m[1]]=v;
  }
  result.body=source.slice(match[0].length).trim();
  return result;
}
const slugOk=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=100;
function validate(a) {
  if(!a||!slugOk(a.slug))throw Error('Slug artikel tidak valid.');
  const title=fieldString(a.title,160),description=fieldString(a.description,360);
  const author=fieldString(a.author,100),body=typeof a.body==='string'?a.body.trim():'';
  const category=fieldString(a.category,50),date=fieldString(a.date,10),cover=fieldString(a.cover||'',500);
  if(title.length<3||description.length<10||!CATEGORIES.includes(category)||!author||body.length<10||body.length>100000)
    throw Error('Judul, ringkasan, kategori, penulis, atau isi artikel belum valid.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z')))throw Error('Tanggal tidak valid.');
  if(cover && !/^\/media\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g)$/.test(cover))
    throw Error('Gambar sampul harus berasal dari media website.');
  return {slug:a.slug,title,description,category,author,date,cover,body,published:a.published===true,featured:a.featured===true};
}
function safeError(error){
  const allowed=[400,401,403,404,409,413,422,429,500,503];
  const status=allowed.includes(error.status)?error.status:400;
  return jsonError(error.message||'Terjadi kesalahan.',status);
}
async function listArticles(env){
  const list=await github(env,'GET','content/articles');
  if(!Array.isArray(list))throw Error('Direktori artikel tidak ditemukan.');
  const files=list.filter(x=>x.type==='file'&&x.name.endsWith('.md')).slice(0,150);
  const items=[];
  // Use small concurrent batches to avoid hitting GitHub secondary rate limits.
  // A failed request should be visible to the editor, never silently dropped.
  for(let i=0;i<files.length;i+=6){
    const batch=await Promise.all(files.slice(i,i+6).map(async file=>{
      const slug=file.name.slice(0,-3);
      const data=await github(env,'GET',articlePath(slug));
      const parsed=parseArticle(decodeUtf(data.content));
      delete parsed.body;
      return {...parsed,slug,sha:data.sha};
    }));
    items.push(...batch);
  }
  return items.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
async function integrationStatus(env){
  // GitHub API call checks the actual configured token and repository permissions.
  const list=await github(env,'GET','content/articles');
  if(!Array.isArray(list))throw Error('Akses direktori artikel GitHub tidak tersedia.');
  return {
    ok:true, connected:true, repository:REPO, branch:BRANCH,
    articles:list.filter(file=>file.type==='file'&&file.name.endsWith('.md')).length,
    deployment:'Perubahan commit tersimpan di GitHub; status live bergantung pada deploy Cloudflare.',
    checkedAt:new Date().toISOString()
  };
}
async function saveArticle(env,payload){
  const a=validate(payload),path=articlePath(a.slug),sha=fieldString(payload.sha||'',80);
  let current=null;
  try{current=await github(env,'GET',path)}catch(e){if(e.status!==404)throw e}
  if(current&&current.sha!==sha){const e=new Error('Artikel telah berubah. Muat ulang sebelum menyimpan.');e.status=409;throw e}
  if(!current&&sha){const e=new Error('Artikel tidak ditemukan. Muat ulang sebelum menyimpan.');e.status=409;throw e}
  const body={message:(current?'cms: update ':'cms: create ')+a.slug,content:utfBase64(articleText(a)),branch:BRANCH};
  if(current)body.sha=current.sha;
  const result=await github(env,'PUT',path,body);
  return {ok:true,sha:result.content?.sha,commitSha:result.commit?.sha,slug:a.slug,published:a.published,needsDeploy:true};
}
async function deleteArticle(env,slug,sha){
  if(!slugOk(slug)||!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Permintaan penghapusan tidak valid.');
  const current=await github(env,'GET',articlePath(slug));
  if(current.sha!==sha){const e=new Error('Artikel telah berubah. Muat ulang sebelum menghapus.');e.status=409;throw e}
  const result=await github(env,'DELETE',articlePath(slug),{message:'cms: delete '+slug,sha,branch:BRANCH});
  return {ok:true,commitSha:result.commit?.sha,needsDeploy:true};
}
async function uploadMedia(env,data) {
  if(!data||typeof data.data!=='string'||data.data.length>2100000)throw Error('Gambar maksimal 1,5 MB.');
  const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data.data);
  if(!m)throw Error('Format gambar hanya PNG, JPEG, atau WebP.');
  const bytes=fromBase64(m[2]);
  if(bytes.length>1500000||bytes.length<100)throw Error('Ukuran gambar tidak sesuai.');
  const valid=m[1]==='png'&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47 ||
    m[1]==='jpeg'&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff ||
    m[1]==='webp'&&decoder.decode(bytes.subarray(0,4))==='RIFF'&&decoder.decode(bytes.subarray(8,12))==='WEBP';
  if(!valid)throw Error('Isi file gambar tidak valid.');
  const ext=m[1]==='jpeg'?'jpg':m[1],name=crypto.randomUUID()+'.'+ext,repoPath='public/media/editor/'+name;
  await github(env,'PUT',repoPath,{message:'cms: upload image '+name,content:m[2],branch:BRANCH});
  return {ok:true,url:'/media/editor/'+name};
}
const ipAttempts=new Map(); // Best-effort local throttle; use Cloudflare WAF rate limiting for global enforcement.
function blocked(ip){
  const now=Date.now(),x=ipAttempts.get(ip);
  if(!x||now-x.time>15*60000){ipAttempts.delete(ip);return false}
  return x.count>=6;
}
function failed(ip){
  if(ipAttempts.size>1500)ipAttempts.clear();
  const now=Date.now(),x=ipAttempts.get(ip);
  ipAttempts.set(ip,!x||now-x.time>15*60000?{count:1,time:now}:{count:x.count+1,time:x.time});
}
async function api(request,env){
  const url=new URL(request.url),pathname=url.pathname,method=request.method;
  const ready=!!(env.ADMIN_PASSWORD&&env.SESSION_SECRET&&env.GITHUB_TOKEN);
  if(!ready)return jsonError('CMS belum dikonfigurasi di Cloudflare. Admin perlu memasang tiga Secret.',503);
  if(pathname==='/api/admin/login'&&method==='POST'){
    if(!allowedOrigin(request))return jsonError('Asal permintaan tidak valid.',403);
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    if(blocked(ip))return jsonError('Terlalu banyak percobaan. Coba lagi nanti.',429);
    let body;try{body=await readJson(request,10000)}catch(e){return safeError(e)}
    if(typeof body?.username!=='string'||typeof body?.password!=='string'||body.password.length>1024)return jsonError('Data login tidak valid.');
    const valid=await compareSecret(body.password,env.ADMIN_PASSWORD);
    if(body.username!==USERNAME||!valid){failed(ip);return jsonError('Username atau password salah.',401)}
    ipAttempts.delete(ip);
    const csrf=crypto.randomUUID();
    const payload=b64url(encoder.encode(JSON.stringify({u:USERNAME,exp:Math.floor(Date.now()/1000)+SESSION_SECONDS,csrf})));
    const signed=await sign(payload,env.SESSION_SECRET);
    return response({ok:true,username:USERNAME,csrf},200, {'Set-Cookie':sessionCookie(signed,SESSION_SECONDS)});
  }
  const s=await session(request,env);
  if(pathname==='/api/admin/session'&&method==='GET')return response(s?{ok:true,authenticated:true,username:USERNAME,csrf:s.csrf}:{ok:true,authenticated:false},200);
  if(!s)return jsonError('Sesi berakhir. Silakan masuk lagi.',401);
  if(method!=='GET'&&!requireCsrf(request,s))return jsonError('Token keamanan atau origin tidak valid.',403);
  if(pathname==='/api/admin/logout'&&method==='POST')return response({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
  if(!env.GITHUB_TOKEN)return jsonError('Token GitHub belum diatur.',503);
  try{
    if(pathname==='/api/admin/integration'&&method==='GET')return response(await integrationStatus(env));
    if(pathname==='/api/admin/articles'&&method==='GET')return response({ok:true,articles:await listArticles(env)});
    if(pathname==='/api/admin/articles'&&method==='POST')return response(await saveArticle(env,await readJson(request)),200);
    const item=pathname.match(/^\/api\/admin\/articles\/([a-z0-9-]+)$/);
    if(item&&method==='GET'){
      if(!slugOk(item[1]))return jsonError('Slug tidak valid.');
      const data=await github(env,'GET',articlePath(item[1]));
      return response({ok:true,article:{...parseArticle(decodeUtf(data.content)),slug:item[1],sha:data.sha}});
    }
    if(item&&method==='DELETE'){
      const data=await readJson(request,3000);
      return response(await deleteArticle(env,item[1],data.sha));
    }
    if(pathname==='/api/admin/upload'&&method==='POST')return response(await uploadMedia(env,await readJson(request,2200000)));
    return jsonError('Endpoint tidak tersedia.',404);
  }catch(error){return safeError(error)}
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),pathname=url.pathname;
    if(pathname.startsWith('/api/admin/'))return api(request,env);
    if(pathname==='/admin/editor'||pathname.startsWith('/admin/editor/')){
      const s=await session(request,env);
      if(!s)return redirect('/admin/');
      const asset=await env.ASSETS.fetch(request);
      const headers=new Headers(asset.headers);
      headers.set('Cache-Control','private, no-store');
      headers.set('X-Robots-Tag','noindex, nofollow');
      headers.set('X-Frame-Options','DENY');
      headers.set('Content-Security-Policy',"frame-ancestors 'none'");
      return new Response(asset.body,{status:asset.status,headers});
    }
    return env.ASSETS.fetch(request);
  }
};
