import fs from 'node:fs';
import path from 'node:path';

const BASE='https://lenteraekonomi.my.id', OUT='dist';
const topics=[
 {name:'Dasar Ekonomi',slug:'dasar-ekonomi',symbol:'◎',icon:'◈',bg:'#dcefe0',color:'#2a6849',description:'Konsep ekonomi sehari-hari, dari inflasi sampai cara kerja pasar.'},
 {name:'Keuangan Pribadi',slug:'keuangan-pribadi',symbol:'%',icon:'◉',bg:'#f8e7bf',color:'#926525',description:'Anggaran, menabung, dan keputusan keuangan yang lebih sehat.'},
 {name:'Bisnis & UMKM',slug:'bisnis-umkm',symbol:'↗',icon:'▥',bg:'#dce9f5',color:'#356a91',description:'Modal, harga, arus kas, dan pengelolaan usaha.'},
 {name:'Ekonomi Indonesia',slug:'ekonomi-indonesia',symbol:'ID',icon:'✳',bg:'#f4dfd7',color:'#a45f4b',description:'Memahami kebijakan dan dinamika ekonomi Indonesia.'}
];
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const slug=x=>String(x).toLowerCase().replace(/&/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const topic=x=>topics.find(t=>t.name===x)||topics[0];
const date=x=>{let d=new Date(String(x).slice(0,10)+'T12:00:00Z');return isNaN(d)?esc(x):new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(d)};
function write(file,content){const target=path.join(OUT,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
function parse(source){
 const normalized=source.replace(/\r\n/g,'\n'),match=normalized.match(/^---\n([\s\S]*?)\n---\s*\n/);
 if(!match)return{data:{},body:normalized};
 const data={};let current='',block=false;
 for(const line of match[1].split('\n')){
  const pair=line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
  if(pair){
   current=pair[1];let val=pair[2].trim();
   block=/^[>|][-+]?$/.test(val);
   if(block){data[current]='';continue}
   if(val.startsWith('"')&&val.endsWith('"')){try{val=JSON.parse(val)}catch{val=val.slice(1,-1)}}
   else if(val.startsWith("'")&&val.endsWith("'"))val=val.slice(1,-1).replace(/''/g,"'");
   data[current]=val==='true'?true:val==='false'?false:val;
  }else if(block&&current&&/^\s+/.test(line))data[current]+=(data[current]?' ':'')+line.trim();
 }
 return{data,body:normalized.slice(match[0].length).trim()};
}
const safeUrl=value=>/^(https?:\/\/|\/(?!\/)|#)/i.test(String(value))?String(value):'#';
function inline(text){
 return esc(text)
 .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(_,a,u)=>'<img loading="lazy" alt="'+a+'" src="'+esc(safeUrl(u))+'">')
 .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,a,u)=>'<a href="'+esc(safeUrl(u))+'">'+a+'</a>')
 .replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>')
 .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
 .replace(/\*([^*]+)\*/g,'<em>$1</em>');
}
function markdown(text){
 const lines=text.split(/\r?\n/),out=[];let para=[],list=null,quote=[],code=[],codeOpen=false;
 function flush(){if(para.length)out.push('<p>'+inline(para.join(' '))+'</p>');para=[];if(list)out.push('</'+list+'>');list=null;if(quote.length)out.push('<blockquote><p>'+inline(quote.join(' '))+'</p></blockquote>');quote=[]}
 for(const raw of lines){
  const line=raw.trim();
  if(/^\x60{3}/.test(line)){flush();if(codeOpen){out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');code=[];}codeOpen=!codeOpen;continue}
  if(codeOpen){code.push(raw);continue}
  if(!line){flush();continue}
  const h=line.match(/^(#{1,4})\s+(.+)$/);
  if(h){flush();out.push('<h'+h[1].length+' id="'+slug(h[2])+'">'+inline(h[2])+'</h'+h[1].length+'>');continue}
  if(/^---+$/.test(line)){flush();out.push('<hr>');continue}
  if(/^>\s?/.test(line)){if(para.length||list)flush();quote.push(line.replace(/^>\s?/,''));continue}
  const ordered=/^\d+\.\s+/.test(line),bullet=/^[-*]\s+/.test(line);
  if(ordered||bullet){
   if(para.length||quote.length)flush();
   const type=ordered?'ol':'ul';
   if(list!==type){if(list)out.push('</'+list+'>');out.push('<'+type+'>');list=type}
   out.push('<li>'+inline(line.replace(/^(\d+\.|[-*])\s+/,''))+'</li>');continue
  }
  if(list||quote.length)flush();
  para.push(line);
 }
 flush();if(codeOpen)out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');
 return out.join('\n');
}
const logo='<span class="brand-mark" aria-hidden="true">L</span><span>Lentera <b>Ekonomi</b><small>Belajar jadi paham</small></span>';
function shell(title,description,body,url,article=false,metadata=''){
 const nav='<a href="/">Beranda</a><a href="/artikel/">Artikel</a><a href="/#topik">Topik Belajar</a><a href="/tentang/">Tentang Kami</a><a class="nav-cta" href="/artikel/">Mulai Belajar ↗</a>';
 return '<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="theme-color" content="#215b46"><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+BASE+url+'">'+
 '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><meta property="og:site_name" content="Lentera Ekonomi">'+
 '<meta property="og:type" content="'+(article?'article':'website')+'"><meta property="og:url" content="'+BASE+url+'">'+
 '<meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+metadata+
 '<title>'+esc(title)+' | Lentera Ekonomi</title><link rel="stylesheet" href="/assets/styles.css"><script defer src="/assets/app.js"></script></head>'+
 '<body><a class="skip-link" href="#konten">Lewati ke konten</a>'+(article?'<div class="progress" data-reading-progress></div>':'')+
 '<header class="site-header"><div class="wrap header-inner"><a class="brand" href="/">'+logo+'</a>'+
 '<nav class="nav-links" id="nav" data-mobile-nav>'+nav+'</nav>'+
 '<button class="menu-toggle" data-menu-toggle aria-controls="nav" aria-expanded="false" aria-label="Buka menu" type="button">☰</button></div></header>'+
 '<main id="konten">'+body+'</main>'+
 '<footer class="site-footer"><div class="wrap"><div class="footer-top"><div><a class="brand" href="/">'+logo+'</a>'+
 '<p>Ruang belajar ekonomi yang lebih dekat dengan kehidupan. Pahami sebab dan akibatnya, bukan sekadar angka.</p></div>'+
 '<div class="footer-links"><div><h4>Jelajahi</h4><a href="/">Beranda</a><a href="/artikel/">Semua Artikel</a><a href="/#topik">Topik Belajar</a><a href="/tentang/">Tentang Kami</a></div>'+
 '<div><h4>Pengelolaan</h4><a href="/admin/">Masuk CMS</a><a href="https://app.pagescms.org" target="_blank" rel="noopener noreferrer">Panel Editor ↗</a></div></div></div>'+
 '<div class="footer-bottom"><span>© '+new Date().getUTCFullYear()+' Lentera Ekonomi. Edukasi untuk semua.</span><span>Konten edukatif, bukan nasihat keuangan pribadi.</span></div></div></footer></body></html>';
}
function cover(a){
 const t=topic(a.category),image=a.cover&&/^(https?:\/\/|\/media\/)/.test(a.cover);
 return '<div class="cover-art'+(image?' has-image':'')+'" style="--cover-bg:'+t.bg+';--cover-ink:'+t.color+';--cover-line:'+t.color+'">'+
 '<span class="cover-mini">'+esc(t.name)+'</span>'+(image?'<img loading="lazy" src="'+esc(a.cover)+'" alt="'+esc(a.title)+'">':'<span class="cover-symbol">'+esc(t.symbol)+'</span>')+'</div>';
}
function meta(a){return '<div class="article-meta"><span class="chip">'+esc(a.category)+'</span><span>·</span><time datetime="'+esc(a.date)+'">'+esc(date(a.date))+'</time><span>·</span><span>'+a.minutes+' menit baca</span></div>'}
function card(a,feature=false){
 const href='/artikel/'+a.slug+'/';
 return '<article class="story-card'+(feature?' feature':'')+'" data-article-card data-category="'+esc(a.category)+'" data-search="'+esc(a.title+' '+a.description+' '+a.category)+'">'+
 '<a href="'+href+'" aria-label="Baca '+esc(a.title)+'">'+cover(a)+'</a><div class="story-content">'+meta(a)+
 '<h3><a href="'+href+'">'+esc(a.title)+'</a></h3><p>'+esc(a.description)+'</p><a class="story-read" href="'+href+'">Baca artikel →</a></div></article>';
}
function home(articles){
 const first=articles.find(a=>a.featured)||articles[0],selected=first?[first,...articles.filter(a=>a!==first)].slice(0,5):[];
 const charts='<svg viewBox="0 0 430 260" fill="none" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4d77c" stop-opacity=".32"/><stop offset="1" stop-color="#f4d77c" stop-opacity="0"/></linearGradient></defs>'+
 '<path d="M0 40H430M0 95H430M0 150H430M0 205H430" stroke="#83b39b" stroke-opacity=".25" stroke-dasharray="5 7"/>'+
 '<path d="M0 222C40 220 60 170 95 182S165 155 197 144 240 175 280 98 335 121 365 76 402 49 430 25V260H0Z" fill="url(#area)"/>'+
 '<path d="M0 222C40 220 60 170 95 182S165 155 197 144 240 175 280 98 335 121 365 76 402 49 430 25" stroke="#f6d77b" stroke-width="4" stroke-linecap="round"/><circle cx="365" cy="76" r="8" fill="#f6d77b" stroke="#20553c" stroke-width="4"/></svg>';
 const body='<section class="hero"><div class="wrap hero-grid"><div><div class="announcement"><span class="pulse"></span> Ruang belajar ekonomi untuk semua</div>'+
 '<h1>Ekonomi itu dekat.<br><em>Yuk, pahami.</em></h1><p class="lead">Dari harga kebutuhan sehari-hari sampai keputusan keuangan dan bisnis. Belajar ekonomi tak harus rumit—mulai dari hal yang paling dekat dengan kita.</p>'+
 '<div class="hero-actions"><a class="button primary" href="/artikel/">Jelajahi artikel ↗</a><a class="button secondary" href="#topik">Pilih topik belajar ↓</a></div>'+
 '<div class="hero-note"><span></span> Memahami lebih penting daripada sekadar menghafal.</div></div>'+
 '<div class="hero-art-wrap"><div class="doodle"></div><div class="hero-graphic"><div class="graphic-top"><div><div class="graphic-label">GAMBARAN EKONOMI</div><div class="graphic-number">Pahami polanya.</div></div><div class="graphic-icon">✳</div></div>'+
 '<div class="graph-area">'+charts+'</div><div class="graph-footer"><span>Pelajari perubahan</span><span>Ambil keputusan</span></div></div>'+
 '<div class="floating-card"><small>Yang penting dipahami</small><strong>Sebab &amp; akibat</strong><span class="spark">● Bukan sekadar angka</span></div></div></div></section>'+
 '<div class="ticker"><div class="wrap ticker-inner"><strong>TOPIK FAVORIT</strong><span>Inflasi</span><span>Menabung</span><span>Modal usaha</span><span>Pasar &amp; harga</span></div></div>'+
 '<section class="section" id="bacaan"><div class="wrap"><div class="section-heading"><div><span class="overline">Pojok pengetahuan</span><h2>Bacaan pilihan untukmu</h2>'+
 '<p class="section-intro">Penjelasan sederhana, contoh yang dekat dengan keseharian, dan ide-ide untuk dipahami lebih lanjut.</p></div><a class="text-link" href="/artikel/">Lihat semua artikel ↗</a></div>'+
 '<div class="story-grid">'+selected.map((a,i)=>card(a,i===0)).join('')+'</div></div></section>'+
 '<section class="section alt" id="topik"><div class="wrap"><div class="section-heading"><div><span class="overline">Mulai dari yang menarik</span><h2>Jelajahi berdasarkan topik</h2>'+
 '<p class="section-intro">Pilih pembahasan yang ingin kamu kuasai, satu artikel dalam satu waktu.</p></div></div><div class="topic-grid">'+
 topics.map(t=>'<a class="topic-card" href="/kategori/'+t.slug+'/"><div class="topic-icon">'+t.icon+'</div><span class="arrow">↗</span><h3>'+esc(t.name)+'</h3><p>'+esc(t.description)+'</p></a>').join('')+
 '</div></div></section><section class="section"><div class="wrap"><div class="statement"><div><span class="overline" style="color:#b9d7b9">Belajar tanpa harus rumit</span>'+
 '<h2>Keputusan yang baik dimulai dari <em>pemahaman yang baik.</em></h2><p>Mulai dari konsep dasarnya, lalu hubungkan dengan kehidupan nyata.</p></div><a class="button" href="/artikel/">Mulai membaca ↗</a></div></div></section>';
 return shell('Belajar Ekonomi dengan Cara Sederhana','Edukasi ekonomi untuk semua: dasar ekonomi, keuangan pribadi, bisnis dan UMKM, serta ekonomi Indonesia.',body,'/');
}
function listing(articles){
 const buttons=['Semua',...topics.map(t=>t.name)].map((n,i)=>'<button class="filter-btn'+(i?'':' active')+'" type="button" data-filter="'+esc(n)+'" aria-pressed="'+(!i)+'">'+esc(n)+'</button>').join('');
 const body='<section class="page-hero"><div class="wrap"><span class="eyebrow">Perpustakaan pengetahuan</span><h1>Semua artikel</h1>'+
 '<p>Temukan ide, konsep, dan penjelasan ekonomi yang bisa kamu gunakan untuk memahami dunia di sekitarmu.</p>'+
 '<label class="search-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6d8778" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'+
 '<input data-article-search type="search" placeholder="Cari topik atau judul artikel..." aria-label="Cari artikel"></label>'+
 '<div class="filters">'+buttons+'</div><div class="result-count" data-result-count></div></div></section>'+
 '<section class="wrap"><div class="listing-grid">'+articles.map(a=>card(a)).join('')+'</div>'+
 '<div class="empty-results" data-empty-results hidden><h2>Belum ada artikel yang cocok.</h2><p>Coba kata kunci atau kategori lain.</p></div></section>';
 return shell('Artikel Ekonomi','Jelajahi artikel edukasi ekonomi dalam bahasa yang mudah dimengerti.',body,'/artikel/');
}
function article(a,articles){
 const url='/artikel/'+a.slug+'/',same=articles.filter(b=>b!==a&&b.category===a.category);
 const related=[...same,...articles.filter(b=>b!==a&&b.category!==a.category)].slice(0,2);
 const body='<div class="wrap article-shell"><div class="breadcrumb"><a href="/">Beranda</a> / <a href="/artikel/">Artikel</a> / '+esc(a.category)+'</div>'+
 '<div class="article-layout"><div><header class="article-header">'+meta(a)+'<h1>'+esc(a.title)+'</h1><p class="dek">'+esc(a.description)+'</p>'+
 '<div class="article-author"><span class="avatar">LE</span><div><strong>'+esc(a.author||'Redaksi Lentera Ekonomi')+'</strong><span>'+esc(date(a.date))+' · '+a.minutes+' menit baca</span></div></div></header>'+
 '<div class="article-cover">'+cover(a)+'</div><div class="article-body">'+markdown(a.body)+'</div>'+
 '<div class="related-section"><span class="overline">Lanjut membaca</span><h2>Artikel lainnya</h2><div class="related-grid">'+related.map(b=>card(b)).join('')+'</div></div></div>'+
 '<aside class="article-sidebar"><div class="side-panel"><h3>Ringkasan</h3><p>'+esc(a.description)+'</p>'+
 '<a class="side-link" href="/kategori/'+topic(a.category).slug+'/">Lihat topik '+esc(a.category)+' ↗</a></div>'+
 '<div class="side-panel"><h3>Bagikan pengetahuan</h3><p>Bagikan artikel ini jika bermanfaat.</p><button type="button" class="share-btn" data-share>Bagikan / salin tautan ↗</button></div></aside></div></div>';
 const json={'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.description,datePublished:a.date,author:{'@type':'Person',name:a.author||'Redaksi Lentera Ekonomi'},publisher:{'@type':'Organization',name:'Lentera Ekonomi'},mainEntityOfPage:BASE+url};
 return shell(a.title,a.description,body,url,true,'<meta property="article:published_time" content="'+esc(a.date)+'"><script type="application/ld+json">'+JSON.stringify(json).replace(/</g,'\\u003c')+'</script>');
}
function category(t,articles){
 const found=articles.filter(a=>a.category===t.name);
 const body='<section class="page-hero"><div class="wrap"><div class="breadcrumb"><a href="/">Beranda</a> / <a href="/artikel/">Artikel</a> / Kategori</div>'+
 '<span class="eyebrow">Topik belajar</span><h1>'+esc(t.name)+'</h1><p>'+esc(t.description)+'</p><a class="text-link" href="/artikel/">← Semua artikel</a></div></section>'+
 '<section class="wrap"><div class="listing-grid">'+found.map(a=>card(a)).join('')+'</div>'+(found.length?'':'<p>Belum ada artikel di topik ini.</p>')+'</section>';
 return shell(t.name,t.description,body,'/kategori/'+t.slug+'/');
}
function about(){
 const body='<section class="page-hero"><div class="wrap"><span class="eyebrow">Kenali kami</span><h1>Ekonomi bukan cuma<br>tentang angka.</h1><p>Tapi tentang keputusan, pilihan, dan cara memahami dunia di sekitar.</p></div></section>'+
 '<section class="wrap about-content"><h2>Kenapa Lentera Ekonomi?</h2>'+
 '<p>Berita ekonomi, perubahan harga, perencanaan uang, dan keputusan bisnis sering terasa rumit. Lentera Ekonomi hadir untuk menjelaskan konsep ekonomi dalam bahasa sederhana dengan contoh dari kehidupan sehari-hari.</p>'+
 '<p>Mulai dengan hal mendasar, lalu pelajari topik keuangan, bisnis, dan ekonomi Indonesia. Semua konten disediakan untuk edukasi, bukan rekomendasi investasi atau pengganti nasihat profesional.</p>'+
 '<h2>Prinsip kami</h2><div class="principles"><div class="principle"><b>01 — Mudah dipahami</b><p>Istilah sulit dijelaskan tanpa kehilangan maknanya.</p></div>'+
 '<div class="principle"><b>02 — Dekat dengan realitas</b><p>Contohnya berasal dari keputusan sehari-hari.</p></div>'+
 '<div class="principle"><b>03 — Mengajak berpikir</b><p>Memahami alasan di balik angka.</p></div></div></section>';
 return shell('Tentang Kami','Tentang portal edukasi Lentera Ekonomi.',body,'/tentang/');
}
function admin(){
 const body='<section class="page-hero"><div class="wrap"><span class="eyebrow">Untuk pengelola konten</span><h1>Ruang Editor</h1>'+
 '<p>Artikel diatur lewat Pages CMS yang terhubung langsung ke GitHub. Hanya akun yang punya akses repository yang dapat mengubah konten.</p></div></section>'+
 '<section class="wrap" style="padding-bottom:90px"><div class="admin-steps">'+
 '<div class="admin-step"><b>01</b><h3>Masuk dengan GitHub</h3><p>Buka Pages CMS dan masuk menggunakan akun GitHub pengelola.</p></div>'+
 '<div class="admin-step"><b>02</b><h3>Kelola artikel</h3><p>Pilih bravocompanion/lenteraekonomi. Buat artikel, unggah foto, dan atur publikasi.</p></div>'+
 '<div class="admin-step"><b>03</b><h3>Terbitkan</h3><p>Simpan. Perubahan tersimpan di GitHub dan dapat memicu deployment Cloudflare otomatis.</p></div>'+
 '</div><a class="button primary" href="https://app.pagescms.org" target="_blank" rel="noopener noreferrer">Buka panel CMS ↗</a></section>';
 return shell('Ruang Editor','Panel editor artikel Lentera Ekonomi.',body,'/admin/');
}
if(fs.existsSync(OUT))fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
fs.cpSync('public',OUT,{recursive:true});
const articles=fs.readdirSync('content/articles').filter(x=>x.endsWith('.md')).map(file=>{
 const parsed=parse(fs.readFileSync('content/articles/'+file,'utf8'));
 const a={...parsed.data,body:parsed.body,slug:file.replace(/\.md$/,'')};
 a.minutes=Math.max(2,Math.ceil(a.body.split(/\s+/).length/190));
 return a;
}).filter(a=>a.published===true&&a.title&&a.date&&a.body).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
write('index.html',home(articles));write('artikel/index.html',listing(articles));
write('tentang/index.html',about());write('admin/index.html',admin());
const routes=['/','/artikel/','/tentang/','/admin/'];
for(const t of topics){const url='/kategori/'+t.slug+'/';write(url.slice(1)+'index.html',category(t,articles));routes.push(url)}
for(const a of articles){const url='/artikel/'+a.slug+'/';write(url.slice(1)+'index.html',article(a,articles));routes.push(url)}
write('404.html',shell('Halaman Tidak Ditemukan','Halaman tidak ditemukan.','<section class="page-hero"><div class="wrap"><span class="eyebrow">404</span><h1>Sepertinya kamu tersesat.</h1><p>Kembali ke beranda atau baca artikel lainnya.</p><a class="button primary" href="/">Kembali ke beranda →</a></div></section>','/404/'));
write('robots.txt','User-agent: *\nAllow: /\nSitemap: '+BASE+'/sitemap.xml\n');
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(u=>'<url><loc>'+BASE+u+'</loc></url>').join('')+'</urlset>');
write('feed.xml','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Lentera Ekonomi</title><link>'+BASE+'</link><description>Artikel edukasi ekonomi.</description><language>id-ID</language>'+articles.map(a=>'<item><title>'+esc(a.title)+'</title><link>'+BASE+'/artikel/'+a.slug+'/</link><guid>'+BASE+'/artikel/'+a.slug+'/</guid><pubDate>'+new Date(a.date.slice(0,10)+'T12:00:00Z').toUTCString()+'</pubDate><description>'+esc(a.description)+'</description></item>').join('')+'</channel></rss>');
console.log('Built '+routes.length+' routes and '+articles.length+' articles.');
