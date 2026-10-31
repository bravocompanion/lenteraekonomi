/* Lentera Ekonomi CMS interface. Authentication happens exclusively in the Cloudflare Worker. */
document.addEventListener('DOMContentLoaded', () => {
  const root=document.querySelector('[data-cms]');
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const isEditor=root.dataset.cms==='editor';
  const status=$('[data-cms-status]');
  let csrf='',currentSha='',items=[],busy=false;
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
  function clearForm(){
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
    notice('');
  }
  function fillForm(a){
    currentSha=a.sha;
    $('[data-editor-heading]').textContent='Edit artikel';
    for(const name of ['slug','title','description','category','date','author','cover','body'])field(name).value=a[name]||'';
    field('published').checked=a.published===true;
    field('featured').checked=a.featured===true;
    field('slug').disabled=true;
    $('[data-delete]').hidden=false;
    $('[data-slug-help]').textContent='Slug dikunci saat edit agar tautan artikel tidak berubah.';
    imagePreview();
    notice('');
  }
  function imagePreview(){
    const box=$('[data-cover-preview]'),path=field('cover').value.trim();
    box.replaceChildren();
    if(path && (/^\/media\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g)$/.test(path))){
      const image=document.createElement('img');image.src=path;image.alt='Pratinjau sampul';
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
      field('slug').disabled=true;
      $('[data-delete]').hidden=false;
      notice('Artikel berhasil disimpan. Cloudflare akan menerbitkan pembaruan melalui deploy GitHub.','success');
      await refresh();renderList();
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
      clearForm();await refresh();notice('Artikel berhasil dihapus.','success');
    }catch(e){notice(e.message,'error')}
  }
  async function upload(file){
    if(!file)return;
    if(file.size>1500000){notice('Gambar maksimal 1,5 MB. Kompres gambar terlebih dahulu.','error');return}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){notice('Gunakan gambar PNG, JPG, atau WebP.','error');return}
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
  async function editorInit(){
    try{
      const session=await getSession();
      if(!session.authenticated){location.replace('/admin/');return}
    }catch(e){notice(e.message,'error');return}
    clearForm();await refresh();
    $('[data-cms-form]').addEventListener('submit',save);
    $('[data-new-article]').addEventListener('click',()=>{clearForm();renderList()});
    $('[data-delete]').addEventListener('click',del);
    $('[data-article-search]').addEventListener('input',renderList);
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
