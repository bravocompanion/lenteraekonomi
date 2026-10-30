document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-mobile-nav]');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(isOpen));
      menu.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  const search = document.querySelector('[data-article-search]');
  const cards = [...document.querySelectorAll('[data-article-card]')];
  const pills = [...document.querySelectorAll('[data-filter]')];
  const counter = document.querySelector('[data-result-count]');
  const empty = document.querySelector('[data-empty-results]');
  let currentFilter = 'Semua';

  const normalize = text => text.toLocaleLowerCase('id-ID').trim();
  function applyFilters() {
    if (!cards.length) return;
    const term = normalize(search?.value || '');
    let visible = 0;
    cards.forEach(card => {
      const byTopic = currentFilter === 'Semua' || card.dataset.category === currentFilter;
      const byTerm = !term || normalize(card.dataset.search || card.textContent).includes(term);
      const show = byTopic && byTerm;
      card.hidden = !show;
      if (show) visible++;
    });
    if (counter) counter.textContent = visible + ' artikel ditemukan';
    if (empty) empty.hidden = visible !== 0;
  }
  search?.addEventListener('input', applyFilters);
  pills.forEach(pill => pill.addEventListener('click', () => {
    currentFilter = pill.dataset.filter;
    pills.forEach(item => {
      const active = item === pill;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
  }));
  applyFilters();

  const progress = document.querySelector('[data-reading-progress]');
  if (progress) {
    let scheduled = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(100, Math.round(window.scrollY / max * 100)) : 0;
      progress.style.width = value + '%';
      scheduled = false;
    };
    window.addEventListener('scroll', () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    }, {passive:true});
    update();
  }
  document.querySelectorAll('[data-share]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({title: document.title, url: location.href});
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(location.href);
        const prev = btn.textContent;
        btn.textContent = 'Tautan disalin ✓';
        setTimeout(() => btn.textContent = prev, 2000);
      }
    } catch(e) { /* visitor cancelled */ }
  }));
});
