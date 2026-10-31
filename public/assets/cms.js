/* Lentera Ekonomi CMS interface. Authentication happens exclusively in the Cloudflare Worker. */
document.addEventListener('DOMContentLoaded', () => {
  const root=document.querySelector('[data-cms]');
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const isEditor=root.dataset.cms==='editor';
  const status=$('[data-cms-status]');
  let csrf='',currentSha='',items=[],busy=false,coverLocalUrl='';
  const categoryNames=['Dasar Ekonomi','Keuangan Pribadi','Bisnis & UMKM','Ekonomi Indonesia'];
  const slugify=text=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
  function notice(message,type='info'){
    if(!status)return;
    status.textContent=message;
    status.dataset.state=type;
    status.hidden=!message;
  }
  async function api(path,options={}){
    const method=options.method||'GET';
    const headers={'Accept':'application/json'};
    if(options.body)headers['Content-Type']='application/json';
    if(method!=='GET'&&csrf)headers['X-CSRF-Token']=csrf;
    let response;
    try{
      response=await fetch(path,{method,headers,credentials:'same-origin',cache:'no-store',body:options.body?JSON.stringify(options.body):undefined});
    }catch{throw Error('Tidak dapat terhubung ke server. Periksa internet.')}
    let payload;
    try{payload=await response.json()}catch{throw Error('Server mengembalikan respons tidak valid.')}
    if(!response.ok)throw Error(payload.error||'Permintaan tidak berhasil.');
    return payload;
  }
  async function getSession(){
    const data=await api('/api/admin/session');
    if(data.authenticated)csrf=data.csrf;
    return data;
  }
  async function loginInit(){
    try{
      const session=await getSession();
      if(session.authenticated){location.replace('/admin/editor/');return}
    }catch(e){notice(e.message,'error')}
    const form=$('[data-login-form]'),submit=$('[data-login-submit]');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(busy)return;
      busy=true;submit.disabled=true;notice('Memverifikasi akun...');
      try{
        const payload=await api('/api/admin/login',{method:'POST',body:{
          username:form.elements.username.value.trim(),
          password:form.elements.password.value
        }});
        csrf=payload.csrf;
        form.elements.password.value='';
        notice('Login berhasil. Membuka editor...','success');
        location.replace('/admin/editor/');
      }catch(e){notice(e.message,'error')}
      finally{busy=false;submit.disabled=false}
    });
  }
  async function checkIntegration(){
    const statusBox=$('[data-integration-state]');
    if(!statusBox)return;
    statusBox.textContent='Memeriksa koneksi GitHub...';
    statusBox.dataset.state='checking';
    try{
      const state=await api('/api/admin/integration');
      statusBox.dataset.state='connected';
      statusBox.textContent='GitHub terhubung · '+state.articles+' artikel · branch '+state.branch;
      $('[data-integration-detail]').textContent='Artikel tersimpan langsung di '+state.repository+'. Publikasi live mengikuti deployment Cloudflare.';
    }catch(e){
      statusBox.dataset.state='error';
      statusBox.textContent='GitHub tidak terhubung';
      $('[data-integration-detail]').textContent=e.message;
      notice('Periksa koneksi GitHub: '+e.message,'error');
    }
  }
  const field=(name)=>$('[name="'+name+'"]');
  const formValues=()=>({
    slug:field('slug').value,
    sha:currentSha,
    title:field('title').value,
    description:field('description').value,
    category:field('category').value,
    date:field('date').value,
    author:field('author').value,
    cover:field('cover').value,
    published:field('published').checked,
    featured:field('featured').checked,
    body:field('body').value
  });
  function forgetLocalPreview(){
    if(coverLocalUrl){URL.revokeObjectURL(coverLocalUrl);coverLocalUrl=''}
  }
  function clearForm(){
    forgetLocalPreview();
    currentSha='';
    $('[data-editor-heading]').textContent='Artikel baru';
    field('slug').disabled=false;
    field('title').value='';field('slug').value='';
    field('description').value='';field('category').value=categoryNames[0];
    field('date').value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Makassar'});
    field('author').value='Redaksi Lentera Ekonomi';
    field('cover').value='';field('published').checked=false;field('featured').checked=false;
    field('body').value='';
    $('[data-delete]').hidden=true;
    $('[data-slug-help]').textContent='Alamat URL akan menggunakan slug ini. Tidak boleh sama dengan artikel lain.';
    imagePreview();
    $('[data-preview-pane]').hidden=true;
    $('[data-save-result]').hidden=true;
    notice('');
  }
  function fillForm(a){
    forgetLocalPreview();
    currentSha=a.sha;
    $('[data-editor-heading]').textContent='Edit artikel';
    for(const name of ['slug','title','description','category','date','author','cover','body'])field(name).value=a[name]||'';
    field('published').checked=a.published===true;
    field('featured').checked=a.featured===true;
    field('slug').disabled=true;
    $('[data-delete]').hidden=false;
    $('[data-slug-help]').textContent='Slug dikunci saat edit agar tautan artikel tidak berubah.';
    imagePreview();
    $('[data-preview-pane]').hidden=true;
    $('[data-save-result]').hidden=true;
    notice('');
  }
  function imagePreview(){
    const box=$('[data-cover-preview]'),path=field('cover').value.trim();
    box.replaceChildren();
    if(coverLocalUrl || (path && /^\/media\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g)$/.test(path))){
      const image=document.createElement('img');image.src=coverLocalUrl||path;image.alt='Pratinjau sampul';
      image.loading='lazy';box.append(image);
    }else {
      const hint=document.createElement('span');
      hint.textContent='Pratinjau sampul artikel';box.append(hint);
    }
  }
  function renderList(){
    const list=$('[data-article-list]'),query=($('[data-article-search]').value||'').toLowerCase().trim();
    list.replaceChildren();
    const found=items.filter(item=>(item.title+' '+item.category).toLowerCase().includes(query));
    $('[data-article-count]').textContent=found.length+' artikel';
    if(!found.length){
      const p=document.createElement('p');p.className='cms-empty';p.textContent='Belum ada artikel yang sesuai.';list.append(p);
    }
    found.forEach(item=>{
      const btn=document.createElement('button');btn.type='button';btn.className='cms-article-item';
      if(item.slug===field('slug').value&&currentSha)btn.classList.add('selected');
      const title=document.createElement('strong');title.textContent=item.title||item.slug;
      const small=document.createElement('span');small.textContent=(item.category||'Tanpa kategori')+' · '+(item.date||'-');
      const badge=document.createElement('em');badge.textContent=item.published?'Terbit':'Draft';badge.dataset.published=String(!!item.published);
      btn.append(title,small,badge);
      btn.addEventListener('click',()=>openArticle(item.slug));
      list.append(btn);
    });
  }
  async function refresh(){
    try{
      const result=await api('/api/admin/articles');items=result.articles;renderList();
    }catch(e){notice(e.message,'error')}
  }
  async function openArticle(slug){
    notice('Memuat artikel...');
    try{
      const response=await api('/api/admin/articles/'+encodeURIComponent(slug));
      fillForm(response.article);renderList();
    }catch(e){notice(e.message,'error')}
  }
  async function save(event){
    event.preventDefault();if(busy)return;
    const payload=formValues();
    if(!payload.slug||!payload.title.trim()||!payload.body.trim()){notice('Isi judul, slug, dan isi artikel.','error');return}
    busy=true;$('[data-save]').disabled=true;notice('Menyimpan artikel ke GitHub...');
    try{
      const response=await api('/api/admin/articles',{method:'POST',body:payload});
      currentSha=response.sha;
      const info=$('[data-save-result]');
      info.replaceChildren();
      const message=document.createElement('span');
      message.textContent=response.published?'Artikel telah dikirim untuk publikasi.':'Draft tersimpan secara privat di GitHub.';
      info.append(message);
      if(response.commitSha && /^[a-f0-9]{40}$/.test(response.commitSha)){
        const link=document.createElement('a');
        link.href='https://github.com/bravocompanion/lenteraekonomi/commit/'+response.commitSha;
        link.target='_blank';link.rel='noopener noreferrer';link.textContent='Lihat commit GitHub ↗';info.append(link);
      }
      info.hidden=false;
      field('slug').disabled=true;
      $('[data-delete]').hidden=false;
      notice('Tersimpan di GitHub. Tunggu deployment Cloudflare selesai sebelum memeriksa perubahan di website publik.','success');
      await refresh();renderList();
      checkIntegration();
    }catch(e){notice(e.message,'error')}
    finally{busy=false;$('[data-save]').disabled=false}
  }
  async function del(){
    if(!currentSha)return;
    const name=field('title').value,slug=field('slug').value;
    if(!confirm('Hapus artikel "'+name+'"? Tindakan ini membuat commit penghapusan di GitHub.'))return;
    notice('Menghapus artikel...');
    try{
      await api('/api/admin/articles/'+encodeURIComponent(slug),{method:'DELETE',body:{sha:currentSha}});
      clearForm();await refresh();checkIntegration();notice('Artikel dihapus dari GitHub. Perubahan di website publik mengikuti deployment Cloudflare.','success');
    }catch(e){notice(e.message,'error')}
  }
  async function upload(file){
    if(!file)return;
    if(file.size>1500000){notice('Gambar maksimal 1,5 MB. Kompres gambar terlebih dahulu.','error');return}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){notice('Gunakan gambar PNG, JPG, atau WebP.','error');return}
    forgetLocalPreview();
    coverLocalUrl=URL.createObjectURL(file);
    imagePreview();
    notice('Mengunggah gambar...');
    const reader=new FileReader();
    reader.onerror=()=>notice('Gagal membaca gambar.','error');
    reader.onload=async()=>{
      try{
        const result=await api('/api/admin/upload',{method:'POST',body:{data:reader.result}});
        field('cover').value=result.url;imagePreview();
        notice('Gambar berhasil diunggah. Simpan artikel untuk menggunakan gambar ini.','success');
      }catch(e){notice(e.message,'error')}
    };
    reader.readAsDataURL(file);
  }
  function togglePreview(){
    const panel=$('[data-preview-pane]'),body=$('[data-preview-body]');
    if(!panel.hidden){panel.hidden=true;return}
    body.replaceChildren();
    const title=document.createElement('h3');
    title.textContent=field('title').value||'Judul artikel';
    body.append(title);
    const desc=document.createElement('p');
    desc.className='cms-preview-dek';
    desc.textContent=field('description').value||'Ringkasan artikel...';
    body.append(desc);
    let count=0;
    for(const line of field('body').value.split(/\r?\n/)){
      if(++count>500)break;
      const trimmed=line.trim();
      if(!trimmed)continue;
      let element;
      const h=trimmed.match(/^(#{1,3})\s+(.+)$/);
      if(h){element=document.createElement('h'+Math.min(h[1].length+1,4));element.textContent=h[2]}
      else if(/^[-*]\s+/.test(trimmed)){element=document.createElement('p');element.className='cms-preview-bullet';element.textContent='• '+trimmed.slice(2)}
      else {element=document.createElement('p');element.textContent=trimmed}
      body.append(element);
    }
    panel.hidden=false;
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function editorInit(){
    try{
      const session=await getSession();
      if(!session.authenticated){location.replace('/admin/');return}
    }catch(e){notice(e.message,'error');return}
    clearForm();await Promise.all([refresh(),checkIntegration()]);
    $('[data-cms-form]').addEventListener('submit',save);
    $('[data-new-article]').addEventListener('click',()=>{clearForm();renderList()});
    $('[data-delete]').addEventListener('click',del);
    $('[data-article-search]').addEventListener('input',renderList);
    $('[data-check-integration]').addEventListener('click',checkIntegration);
    $('[data-preview-toggle]').addEventListener('click',togglePreview);
    field('title').addEventListener('input',()=>{if(!currentSha)field('slug').value=slugify(field('title').value)});
    field('cover').addEventListener('input',imagePreview);
    $('[data-cover-upload]').addEventListener('change',e=>upload(e.target.files?.[0]));
    $('[data-logout]').addEventListener('click',async()=>{
      try{await api('/api/admin/logout',{method:'POST'});location.replace('/admin/')}
      catch(e){notice(e.message,'error')}
    });
    const params=new URLSearchParams(location.search);
    if(params.has('new'))clearForm();
  }
  if(isEditor)editorInit();else loginInit();
});
