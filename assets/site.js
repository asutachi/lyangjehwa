(function(){
  const $ = (s, el=document)=> el.querySelector(s);
  const $$ = (s, el=document)=> Array.from(el.querySelectorAll(s));
  const Y = $('#y'); if (Y) Y.textContent = new Date().getFullYear();

  const isIndex = !!$('#archive');
  const isPost = !!$('#post-body');

  // 쿼리 또는 경로(/post/<slug>) 어디에 있어도 slug를 회수
  function getSlug(){
    const url = new URL(location.href);
    let s = url.searchParams.get('slug');
    if (s) return s;
    const parts = url.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('post');
    if (i >= 0 && parts[i+1]) return parts[i+1].replace(/\/+$/,'');
    return null;
  }

  // ===== INDEX =====
  if (isIndex){
    fetch('posts/posts.json')
      .then(r=>r.json())
      .then(posts=>{
        posts.sort((a,b)=> new Date(b.date) - new Date(a.date));

        const tagsEl = $('#tags');
        const searchEl = $('#search');
        const archiveEl = $('#archive');

        const selected = new Set();
        const tagSet = new Set();

        // 태그 버튼
        posts.forEach(p => (p.tags||[]).forEach(t => tagSet.add(t)));
        [...tagSet].sort().forEach(t=>{
          const b = document.createElement('button');
          b.className = 'tag';
          b.textContent = `#${t}`;
          b.onclick = ()=>{
            b.classList.toggle('active');
            if (selected.has(t)) selected.delete(t); else selected.add(t);
            render();
          };
          tagsEl.appendChild(b);
        });

        // 검색
        if (searchEl) searchEl.addEventListener('input', render);

        // 보기 전환
        const vCompactBtn = $('#vCompact');
        const vBoxBtn = $('#vBox');
        function setView(mode){
          archiveEl.classList.remove('view-compact','view-box');
          archiveEl.classList.add(mode==='compact' ? 'view-compact' : 'view-box');
          vCompactBtn?.setAttribute('aria-selected', String(mode==='compact'));
          vBoxBtn?.setAttribute('aria-selected', String(mode==='box'));
          localStorage.setItem('ljh_view', mode);
          render();
        }
        vCompactBtn?.addEventListener('click', ()=>setView('compact'));
        vBoxBtn?.addEventListener('click', ()=>setView('box'));
        setView(localStorage.getItem('ljh_view') || 'box');

        function match(p){
          const q = (searchEl?.value || '').trim().toLowerCase();
          const tagOK = selected.size===0 || (p.tags||[]).some(t=>selected.has(t));
          const hay = [p.title,p.description,(p.keywords||[]).join(' ')].join(' ').toLowerCase();
          const textOK = !q || hay.includes(q);
          return tagOK && textOK;
        }

        function render(){
          const list = posts.filter(match);
          archiveEl.innerHTML = '';
          list.forEach(p=>{
            const a = document.createElement('a');
            a.className = 'card-link card';
            // 핵심 수정 ①: .html 제거하고 쿼리 유지
            a.href = `post?slug=${encodeURIComponent(p.slug)}`;
            a.innerHTML = `
              <div class="date">${p.date}</div>
              <h3>${p.title}</h3>
              <p>${p.description || ''}</p>
              <div class="tags">${(p.tags||[]).slice(0,6).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
            `;
            archiveEl.appendChild(a);
          });
          if (!archiveEl.children.length){
            archiveEl.innerHTML = '<p class="card" style="padding:16px;">조건에 맞는 글이 없습니다.</p>';
          }
        }

        setupBackToTop();
      })
      .catch(err=>{
        console.error(err);
        $('#archive').innerHTML = '<p class="card" style="padding:16px;">목록을 불러오지 못했습니다.</p>';
      });
  }

  // ===== POST =====
  if (isPost){
    // 핵심 수정 ②: slug 추출 로직 강화
    const slug = getSlug();
    if (!slug){
      $('#post-body').innerHTML = '<p class="card" style="padding:16px;">슬러그가 없습니다.</p>';
      return;
    }

    fetch('posts/posts.json')
      .then(r=>r.json())
      .then(list=>{
        const meta = list.find(p=>p.slug===slug);
        if (!meta){
          $('#post-body').innerHTML = '<p class="card" style="padding:16px;">해당 글을 찾을 수 없습니다.</p>';
          return;
        }

        document.title = `${meta.title} · 량제화`;
        $('#desc')?.setAttribute('content', meta.description || '');
        $('#post-title') && ($('#post-title').textContent = meta.title);
        $('#post-sub') && ($('#post-sub').textContent = `${meta.date} · ${(meta.tags||[]).map(t=>`#${t}`).join(' ')}`);

        return fetch(`posts/${meta.file}`).then(r=>r.text()).then(html=>{
          const body = $('#post-body');
          body.innerHTML = html;

          buildTOC();
          activateTOC();
          setupProgress();
          setupBackToTop();
        });
      })
      .catch(err=>{
        console.error(err);
        $('#post-body').innerHTML = '<p class="card" style="padding:16px;">글을 불러오지 못했습니다.</p>';
      });
  }

  function buildTOC(){
    const body = $('#post-body');
    const list = $('#toc-list');
    if (!body || !list) return;
    list.innerHTML = '';
    let heads = $$('section[id]', body);
    if (!heads.length) heads = $$('h2, h3', body);
    heads.forEach((el, i)=>{
      const id = el.id || `s${i}`;
      el.id = id;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`;
      const num = document.createElement('span');
      num.className = 'no';
      num.textContent = String(i);
      a.appendChild(num);
      a.appendChild(document.createTextNode(' ' + (el.textContent || '').trim()));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function activateTOC(){
    const tocLinks = $$('#toc a');
    if (!tocLinks.length) return;
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        const active = document.querySelector(`#toc a[href="#${CSS.escape(id)}"]`);
        if (!active) return;
        tocLinks.forEach(a=>a.removeAttribute('aria-current'));
        active.setAttribute('aria-current','true');
      });
    }, { rootMargin:'-40% 0px -55% 0px', threshold:[0,1] });

    $$('#post-body section[id], #post-body h2[id], #post-body h3[id]').forEach(sec=> io.observe(sec));
  }

  function setupProgress(){
    const progress = $('#progress');
    const main = $('#main');
    if (!progress || !main) return;
    let ticking = false;
    const setProgress = ()=>{
      const top = Math.max((window.pageYOffset || document.documentElement.scrollTop) - main.offsetTop, 0);
      const total = Math.max(main.scrollHeight - window.innerHeight, 1);
      progress.style.transform = `scaleX(${top / total})`;
      ticking = false;
    };
    const onScroll = ()=>{
      if (!ticking){ requestAnimationFrame(setProgress); ticking = true; }
    };
    setProgress();
    window.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', setProgress, { passive:true });
  }

  function setupBackToTop(){
    const btn = $('#backtop');
    if (!btn) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    btn.addEventListener('click', ()=>{
      if (prefersReduced) window.scrollTo(0,0);
      else window.scrollTo({ top:0, behavior:'smooth' });
    }, { passive:true });
  }
})();
