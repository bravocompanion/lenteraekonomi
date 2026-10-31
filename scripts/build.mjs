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
const logo='<img class="brand-logo" src="/assets/logo-lentera-ekonomi.svg" width="244" height="54" alt="Lentera Ekonomi">';
const footerLogo='<img class="brand-logo" src="/assets/logo-lentera-ekonomi-light.svg" width="244" height="54" alt="Lentera Ekonomi">';
function shell(title,description,body,url,article=false,metadata='',socialImage=''){
 const chosenImage = socialImage && /^(https?:\/\/|\/media\/)/i.test(socialImage) ? socialImage : '/media/open-graph-lentera-ekonomi.jpg';
 const imageUrl = chosenImage.startsWith('/') ? BASE + chosenImage : chosenImage;
 const webpSocial = /\.webp(?:\?.*)?$/i.test(chosenImage);
 const nav='<a href="/">Beranda</a><a href="/artikel/">Artikel</a><a href="/#topik">Topik Belajar</a><a href="/tentang/">Tentang Kami</a><a class="nav-cta" href="/artikel/">Mulai Belajar ↗</a>';
 return '<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="theme-color" content="#215b46"><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+BASE+url+'">'+
 '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><meta property="og:site_name" content="Lentera Ekonomi">'+
 '<meta property="og:type" content="'+(article?'article':'website')+'"><meta property="og:url" content="'+BASE+url+'">'+
 '<meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+
 '<meta property="og:locale" content="id_ID">'+
 '<meta property="og:image" content="'+esc(imageUrl)+'"><meta property="og:image:type" content="'+(webpSocial?'image/webp':'image/jpeg')+'">'+
 '<meta property="og:image:width" content="'+(webpSocial?'1600':'1200')+'"><meta property="og:image:height" content="'+(webpSocial?'900':'630')+'">'+
 '<meta property="og:image:alt" content="'+esc(article?title:'Lentera Ekonomi — edukasi ekonomi untuk semua')+'">'+
 '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(title)+'">'+
 '<meta name="twitter:description" content="'+esc(description)+'"><meta name="twitter:image" content="'+esc(imageUrl)+'">'+metadata+
 '<title>'+esc(title)+' | Lentera Ekonomi</title><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/editorial.css">'+(url.startsWith('/admin/')?'<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/assets/cms.css"><script defer src="/assets/cms.js"></script>':'')+'<script defer src="/assets/app.js"></script></head>'+
 '<body><a class="skip-link" href="#konten">Lewati ke konten</a>'+(article?'<div class="progress" data-reading-progress></div>':'')+
 '<header class="site-header"><div class="wrap header-inner"><a class="brand" href="/">'+logo+'</a>'+
 '<nav class="nav-links" id="nav" data-mobile-nav>'+nav+'</nav>'+
 '<button class="menu-toggle" data-menu-toggle aria-controls="nav" aria-expanded="false" aria-label="Buka menu" type="button">☰</button></div></header>'+
 '<main id="konten">'+body+'</main>'+
 '<footer class="site-footer"><div class="wrap"><div class="footer-top"><div><a class="brand" href="/">'+footerLogo+'</a>'+
 '<p>Ruang belajar ekonomi yang lebih dekat dengan kehidupan. Pahami sebab dan akibatnya, bukan sekadar angka.</p></div>'+
 '<div class="footer-links"><div><h4>Jelajahi</h4><a href="/">Beranda</a><a href="/artikel/">Semua Artikel</a><a href="/#topik">Topik Belajar</a><a href="/tentang/">Tentang Kami</a></div>'+
 '<div><h4>Pengelolaan</h4><a href="/admin/">Masuk CMS</a><a href="/admin/">Ruang Editor ↗</a></div></div></div>'+
 '<div class="footer-bottom"><span>© '+new Date().getUTCFullYear()+' Lentera Ekonomi. Edukasi untuk semua.</span><span>Konten edukatif, bukan nasihat keuangan pribadi.</span></div></div></footer></body></html>';
}
function cover(a){
 const t=topic(a.category),image=a.cover&&/^(https?:\/\/|\/media\/)/.test(a.cover);
 return '<div class="cover-art'+(image?' has-image':'')+'" style="--cover-bg:'+t.bg+';--cover-ink:'+t.color+';--cover-line:'+t.color+'">'+
 '<span class="cover-mini">'+esc(t.name)+'</span>'+(image?'<img loading="lazy" src="'+esc(a.cover)+'" alt="'+esc(a.title)+'">':'<img class="cover-category-icon" src="/assets/icons/'+t.slug+'.svg" loading="lazy" alt="">')+'</div>';
}
function meta(a){return '<div class="article-meta"><span class="chip">'+esc(a.category)+'</span><span>·</span><time datetime="'+esc(a.date)+'">'+esc(date(a.date))+'</time><span>·</span><span>'+a.minutes+' menit baca</span></div>'}
function card(a,feature=false){
 const href='/artikel/'+a.slug+'/';
 return '<article class="story-card'+(feature?' feature':'')+'" data-article-card data-category="'+esc(a.category)+'" data-search="'+esc(a.title+' '+a.description+' '+a.category)+'">'+
 '<a href="'+href+'" aria-label="Baca '+esc(a.title)+'">'+cover(a)+'</a><div class="story-content">'+meta(a)+
 '<h3><a href="'+href+'">'+esc(a.title)+'</a></h3><p>'+esc(a.description)+'</p><a class="story-read" href="'+href+'">Baca artikel →</a></div></article>';
}
function home(articles){
 const featured=articles.find(a=>a.featured)||articles[0],remaining=articles.filter(a=>a!==featured),latest=remaining.slice(0,6);
 const heroFeature=featured?'<div class="editor-pick"><div class="editor-pick-head"><span><span class="eyebrow-dot"></span> PILIHAN REDAKSI</span><span>01 / ARTIKEL UNGGULAN</span></div>'+
  '<a class="editor-pick-image" href="/artikel/'+featured.slug+'/" aria-label="Baca '+esc(featured.title)+'">'+cover(featured)+'</a>'+
  '<div class="editor-pick-content">'+meta(featured)+'<h2><a href="/artikel/'+featured.slug+'/">'+esc(featured.title)+'</a></h2>'+
  '<p>'+esc(featured.description)+'</p><a class="editor-pick-link" href="/artikel/'+featured.slug+'/">Baca selengkapnya <span aria-hidden="true">↗</span></a></div></div>':'';
 const topicCards=topics.map((t,i)=>{
  const n=articles.filter(a=>a.category===t.name).length;
  return '<a class="topic-card" href="/kategori/'+t.slug+'/"><div class="topic-card-top"><span class="topic-icon" aria-hidden="true"><img src="/assets/icons/'+t.slug+'.svg" loading="lazy" alt=""></span><span class="topic-index">0'+(i+1)+'</span></div><h3>'+esc(t.name)+'</h3><p>'+esc(t.description)+'</p><div class="topic-card-bottom"><span>'+n+' artikel</span><span aria-hidden="true">↗</span></div></a>';
 }).join('');
 const more=remaining.length>6?'<a class="button secondary" href="/artikel/">Lihat seluruh artikel <span aria-hidden="true">↗</span></a>':'<a class="button secondary" href="/artikel/">Jelajahi perpustakaan <span aria-hidden="true">↗</span></a>';
 const body='<section class="front-hero"><div class="wrap"><div class="front-topline"><span><span class="front-topline-mark">✳</span> LENTERA EKONOMI <span class="topline-dash">/</span> PUSAT LITERASI</span><span>WAWASAN YANG LEBIH DEKAT DENGAN KEHIDUPAN</span></div>'+
 '<div class="front-hero-grid"><div class="front-hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span> SELAMAT DATANG DI LENTERA EKONOMI</div>'+
 '<h1>Ekonomi lebih mudah saat <em>kita memahaminya.</em></h1><p>Belajar tentang uang, pasar, bisnis, dan perubahan ekonomi dengan penjelasan yang jernih dan dekat dengan keseharian.</p>'+
 '<div class="front-hero-actions"><a class="button primary" href="/artikel/">Mulai membaca <span aria-hidden="true">↗</span></a><a class="front-text-link" href="#topik">Lihat topik belajar <span aria-hidden="true">↓</span></a></div>'+
 '<div class="front-hero-bottom"><span class="hero-small-icon" aria-hidden="true">✦</span><span>Ide besar, dijelaskan dengan bahasa sederhana.</span></div></div>'+
 heroFeature+'</div></div></section>'+
 '<div class="editorial-ribbon"><div class="wrap ribbon-inner"><span>UNTUK SEMUA PEMBELAJAR</span><span><i aria-hidden="true">●</i> Bahasa yang mudah dimengerti</span><span><i aria-hidden="true">●</i> Contoh dari kehidupan nyata</span><span><i aria-hidden="true">●</i> Konten yang terus berkembang</span></div></div>'+
 '<section class="section latest-section"><div class="wrap"><div class="section-heading"><div><span class="overline">JURNAL LENTERA / TERBARU</span><h2>Wawasan terbaru</h2><p class="section-intro">Temukan penjelasan yang membantu kamu melihat persoalan ekonomi dari sudut pandang yang lebih jelas.</p></div><a class="text-link" href="/artikel/">Semua artikel <span aria-hidden="true">↗</span></a></div>'+
 '<div class="editorial-grid">'+latest.map(a=>card(a)).join('')+'</div><div class="latest-bottom">'+more+'</div></div></section>'+
 '<section class="section topic-section" id="topik"><div class="wrap"><div class="section-heading"><div><span class="overline">RUANG BELAJAR / KATEGORI</span><h2>Jelajahi topik ekonomi</h2><p class="section-intro">Pilih topik yang paling menarik untukmu dan pelajari satu konsep pada satu waktu.</p></div></div><div class="topic-grid">'+topicCards+'</div></div></section>'+
 '<section class="section guide-section"><div class="wrap"><div class="learning-panel"><div class="learning-panel-copy"><span class="overline">MULAI DARI SINI</span><h2>Baru mengenal ekonomi?<br><em>Kita mulai dari dasarnya.</em></h2><p>Tidak perlu istilah rumit untuk memahami bagaimana harga terbentuk, mengapa pilihan memiliki konsekuensi, dan bagaimana uang bergerak.</p><a class="button light-button" href="/kategori/dasar-ekonomi/">Pelajari ekonomi dasar <span aria-hidden="true">↗</span></a></div>'+
 '<div class="learning-path" aria-label="Tahapan belajar"><div class="learning-path-title">ALUR BELAJAR</div><a href="/kategori/dasar-ekonomi/"><span>01</span><div><strong>Pahami konsepnya</strong><small>Mulai dari kebutuhan, harga, dan pasar</small></div><b aria-hidden="true">↗</b></a>'+
 '<a href="/kategori/keuangan-pribadi/"><span>02</span><div><strong>Hubungkan dengan uangmu</strong><small>Latihan membuat pilihan keuangan</small></div><b aria-hidden="true">↗</b></a>'+
 '<a href="/kategori/bisnis-umkm/"><span>03</span><div><strong>Lihat gambaran besarnya</strong><small>Temukan kaitannya dengan dunia usaha</small></div><b aria-hidden="true">↗</b></a></div></div></div></section>'+
 '<section class="section mission-section"><div class="wrap mission-row"><div><span class="overline">TENTANG LENTERA EKONOMI</span><h2>Lebih paham hari ini.<br>Lebih bijak esok hari.</h2></div><div><p>Kami percaya pemahaman ekonomi seharusnya dapat diakses siapa pun. Karena setiap keputusan, sekecil apa pun, memiliki cerita ekonomi di belakangnya.</p><a class="text-link" href="/tentang/">Kenali Lentera Ekonomi <span aria-hidden="true">↗</span></a></div></div></section>';
 return shell('Belajar Ekonomi dengan Cara Sederhana','Lentera Ekonomi: artikel dan panduan edukasi ekonomi, keuangan pribadi, bisnis UMKM, dan ekonomi Indonesia dengan bahasa yang mudah dipahami.',body,'/');
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
 const headings=Array.from(a.body.matchAll(/^##\s+(.+)$/gm)).map(m=>m[1]).slice(0,12);
 const toc=headings.length?'<div class="side-panel toc-panel"><div class="side-panel-eyebrow">DALAM ARTIKEL INI</div><nav aria-label="Daftar isi">'+headings.map((h,i)=>'<a href="#'+slug(h)+'"><span>0'+(i+1)+'</span>'+esc(h)+'</a>').join('')+'</nav></div>':'';
 const body='<div class="wrap article-shell"><div class="breadcrumb"><a href="/">Beranda</a> <span aria-hidden="true">/</span> <a href="/artikel/">Artikel</a> <span aria-hidden="true">/</span> '+esc(a.category)+'</div>'+
 '<div class="article-layout"><div><header class="article-header"><div class="article-kicker"><span class="chip">'+esc(a.category)+'</span><span>ARTIKEL LENTERA EKONOMI</span></div><h1>'+esc(a.title)+'</h1><p class="dek">'+esc(a.description)+'</p>'+
 '<div class="article-author"><span class="avatar" aria-hidden="true">LE</span><div><strong>'+esc(a.author||'Redaksi Lentera Ekonomi')+'</strong><span><time datetime="'+esc(a.date)+'">'+esc(date(a.date))+'</time> <span aria-hidden="true">·</span> '+a.minutes+' menit baca</span></div></div></header>'+
 '<div class="article-cover">'+cover(a)+'</div><div class="article-body">'+markdown(a.body)+'</div>'+
 '<div class="article-end-note"><span class="article-end-icon" aria-hidden="true">✳</span><div><strong>Terus bertumbuh lewat pengetahuan.</strong><p>Sudah selesai membaca? Temukan sudut pandang baru di artikel selanjutnya.</p><a href="/artikel/">Jelajahi semua artikel ↗</a></div></div>'+
 '<div class="related-section"><span class="overline">BACAAN LAINNYA</span><h2>Lanjutkan eksplorasi</h2><div class="related-grid">'+related.map(b=>card(b)).join('')+'</div></div></div>'+
 '<aside class="article-sidebar">'+toc+'<div class="side-panel"><div class="side-panel-eyebrow">BAGIKAN ARTIKEL</div><p>Pengetahuan lebih berarti ketika dibagikan.</p><button type="button" class="share-btn" data-share>Salin tautan artikel ↗</button></div></aside></div></div>';
 const json={'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.description,datePublished:a.date,author:{'@type':'Person',name:a.author||'Redaksi Lentera Ekonomi'},publisher:{'@type':'Organization',name:'Lentera Ekonomi'},mainEntityOfPage:BASE+url};
 return shell(a.title,a.description,body,url,true,'<meta property="article:published_time" content="'+esc(a.date)+'"><script type="application/ld+json">'+JSON.stringify(json).replace(/</g,'\\u003c')+'</script>',a.cover);
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
 const body='<div class="cms-root cms-login-wrap" data-cms="login"><section class="cms-login-card" aria-label="Masuk editor">'+
 '<div class="cms-login-icon"><img src="/assets/brand-emblem.svg" alt=""></div>'+
 '<p class="cms-eyebrow">LENTERA EKONOMI / ADMIN</p><h1>Masuk ke Ruang Editor</h1>'+
 '<p>Kelola tulisan, gambar, kategori, dan publikasi artikel Lentera Ekonomi melalui akun editor.</p>'+
 '<form data-login-form autocomplete="on">'+
 '<div class="cms-field"><label for="cms-username">Username</label><input id="cms-username" name="username" value="pakde" autocomplete="username" required maxlength="80"></div>'+
 '<div class="cms-field"><label for="cms-password">Password</label><input id="cms-password" name="password" type="password" autocomplete="current-password" required maxlength="1024" placeholder="Masukkan password editor"></div>'+
 '<button class="cms-action full" type="submit" data-login-submit>Masuk ke CMS ↗</button></form>'+
 '<div data-cms-status class="cms-status" role="status" aria-live="polite" hidden></div>'+
 '<span class="cms-login-note">Area khusus pengelola konten · Dilindungi autentikasi server</span></section></div>';
 return shell('Login Editor','Masuk ke ruang pengelolaan Lentera Ekonomi.',body,'/admin/');
}
function editor(){
 const categoryOptions=topics.map(t=>'<option value="'+esc(t.name)+'">'+esc(t.name)+'</option>').join('');
 const body='<div class="cms-root cms-editor-outer" data-cms="editor"><div class="wrap">'+
 '<header class="cms-editor-top"><div><p class="cms-eyebrow">LENTERA EKONOMI / CONTENT MANAGEMENT</p><h1>Ruang Editor</h1><p>Kelola artikel yang disimpan langsung ke repository GitHub.</p></div><button type="button" class="cms-action secondary" data-logout>Keluar ↗</button></header>'+
 '<div class="cms-editor-grid"><aside class="cms-sidebar"><h2>Daftar artikel</h2><div class="cms-sidebar-actions"><button type="button" class="cms-action" data-new-article>+ Buat artikel</button>'+
 '<input class="cms-search" data-article-search type="search" aria-label="Cari artikel" placeholder="Cari judul atau kategori..."></div>'+
 '<div class="cms-count" data-article-count>Memuat artikel...</div><div class="cms-article-list" data-article-list></div></aside>'+
 '<section class="cms-editor-panel"><h2 data-editor-heading>Artikel baru</h2>'+
 '<div data-cms-status class="cms-status" role="status" aria-live="polite" hidden></div>'+
 '<form data-cms-form><div class="cms-field"><label for="e-title">Judul artikel</label><input id="e-title" name="title" maxlength="160" required placeholder="Tuliskan judul yang informatif"></div>'+
 '<div class="cms-field"><label for="e-slug">Alamat URL (slug)</label><input id="e-slug" name="slug" maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="judul-artikel"></div>'+
 '<p class="cms-help" data-slug-help>Alamat URL akan menggunakan slug ini.</p>'+
 '<div class="cms-field"><label for="e-description">Ringkasan (SEO)</label><textarea id="e-description" name="description" maxlength="360" required rows="3" placeholder="Ringkasan singkat yang muncul di daftar artikel dan mesin pencari"></textarea></div>'+
 '<div class="cms-form-row"><div class="cms-field"><label for="e-category">Kategori</label><select id="e-category" name="category">'+categoryOptions+'</select></div>'+
 '<div class="cms-field"><label for="e-date">Tanggal publikasi</label><input id="e-date" name="date" type="date" required></div></div>'+
 '<div class="cms-field"><label for="e-author">Penulis</label><input id="e-author" name="author" maxlength="100" required></div>'+
 '<div class="cms-field"><label for="e-cover">Gambar sampul</label><input id="e-cover" name="cover" maxlength="500" placeholder="/media/covers/gambar.webp">'+
 '<small>Masukkan path media website, atau unggah gambar JPG/PNG/WebP (maks. 1,5 MB).</small></div>'+
 '<div class="cms-cover-preview" data-cover-preview><span>Pratinjau sampul artikel</span></div>'+
 '<label class="cms-file-label" for="e-file">Unggah gambar sampul <input id="e-file" type="file" data-cover-upload accept="image/png,image/jpeg,image/webp"></label>'+
 '<div class="cms-form-checks"><label><input name="published" type="checkbox"> Publikasikan artikel</label>'+
 '<label><input name="featured" type="checkbox"> Tampilkan sebagai pilihan redaksi</label></div>'+
 '<div class="cms-field"><label for="e-body">Isi artikel (Markdown)</label><textarea id="e-body" name="body" required spellcheck="true" placeholder="## Subjudul\n\nTuliskan isi artikel di sini..."></textarea>'+
 '<small>Gunakan ## untuk subjudul, **teks** untuk tebal, - untuk daftar, dan [teks](tautan) untuk link.</small></div>'+
 '<div class="cms-form-bottom"><button class="cms-action danger" type="button" data-delete hidden>Hapus artikel</button>'+
 '<div><a class="cms-action secondary" href="/artikel/" target="_blank" rel="noopener noreferrer">Lihat website ↗</a>'+
 '<button class="cms-action" type="submit" data-save>Simpan ke GitHub ✓</button></div></div></form></section></div></div></div>';
 return shell('CMS Editor','Kelola artikel Lentera Ekonomi melalui ruang editor pribadi.',body,'/admin/editor/');
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
write('tentang/index.html',about());write('admin/index.html',admin());write('admin/editor/index.html',editor());
const routes=['/','/artikel/','/tentang/'];
for(const t of topics){const url='/kategori/'+t.slug+'/';write(url.slice(1)+'index.html',category(t,articles));routes.push(url)}
for(const a of articles){const url='/artikel/'+a.slug+'/';write(url.slice(1)+'index.html',article(a,articles));routes.push(url)}
write('404.html',shell('Halaman Tidak Ditemukan','Halaman tidak ditemukan.','<section class="page-hero"><div class="wrap"><span class="eyebrow">404</span><h1>Sepertinya kamu tersesat.</h1><p>Kembali ke beranda atau baca artikel lainnya.</p><a class="button primary" href="/">Kembali ke beranda →</a></div></section>','/404/'));
write('robots.txt','User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: '+BASE+'/sitemap.xml\n');
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(u=>'<url><loc>'+BASE+u+'</loc></url>').join('')+'</urlset>');
write('feed.xml','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Lentera Ekonomi</title><link>'+BASE+'</link><description>Artikel edukasi ekonomi.</description><language>id-ID</language>'+articles.map(a=>'<item><title>'+esc(a.title)+'</title><link>'+BASE+'/artikel/'+a.slug+'/</link><guid>'+BASE+'/artikel/'+a.slug+'/</guid><pubDate>'+new Date(a.date.slice(0,10)+'T12:00:00Z').toUTCString()+'</pubDate><description>'+esc(a.description)+'</description></item>').join('')+'</channel></rss>');
console.log('Built '+routes.length+' routes and '+articles.length+' articles.');
