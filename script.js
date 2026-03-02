/* ============================================
   DEEDSLICE.COM — SCRIPT v3
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 60);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  reveals.forEach(el => obs.observe(el));

  // Nav scroll
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // Mobile nav
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      const s = toggle.querySelectorAll('span');
      if (links.classList.contains('open')) {
        s[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        s[1].style.opacity = '0';
        s[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        s[0].style.transform = ''; s[1].style.opacity = ''; s[2].style.transform = '';
      }
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // FAQ
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // ============ DEMO ENGINE ============
  const step1 = document.getElementById('demoStep1');
  const step2 = document.getElementById('demoStep2');
  const step3 = document.getElementById('demoStep3');
  const log = document.getElementById('deployLog');
  const tokenizeBtn = document.getElementById('demoTokenize');
  const resetBtn = document.getElementById('demoReset');

  const hId = () => `0.0.${8800000 + Math.floor(Math.random() * 200000)}`;
  const txId = () => `0.0.7420047@${Math.floor(Date.now()/1000)}.${String(Math.floor(Math.random()*999999999)).padStart(9,'0')}`;
  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtN = n => new Intl.NumberFormat('en-US').format(n);
  const sym = name => {
    const w = name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean);
    return 'DS-' + (w.length >= 2 ? w.slice(0,2).map(x => x.substring(0,2).toUpperCase()).join('') : name.substring(0,4).toUpperCase());
  };

  const steps = [
    { msg: 'Connecting to Hedera testnet...', t: '0.2s' },
    { msg: 'Analyzing property structure...', t: '0.8s' },
    { msg: 'Creating NFT Master Deed...', id: 'Collection', t: '1.4s' },
    { msg: 'Minting NFT Deed #1...', id: 'Tx', t: '2.1s' },
    { msg: 'Creating share token...', id: 'Token', t: '2.9s' },
    { msg: 'Minting initial supply...', t: '3.5s' },
    { msg: 'Creating HCS Audit Topic...', id: 'Topic', t: '4.0s' },
    { msg: 'Logging tokenization event...', t: '4.3s' },
    { msg: '✓ Property tokenized!', final: true, t: '4.6s' },
  ];

  let nftId, tokenId, topicId, symbol;

  if (tokenizeBtn) {
    tokenizeBtn.addEventListener('click', () => {
      const name = document.getElementById('demoName').value || 'Demo Property';
      const val = parseInt((document.getElementById('demoValue').value || '500000').replace(/\D/g, ''));
      const slices = parseInt((document.getElementById('demoSlices').value || '1000').replace(/\D/g, ''));
      const type = document.getElementById('demoType').value;

      nftId = hId(); tokenId = hId(); topicId = hId(); symbol = sym(name);

      step1.classList.remove('active');
      step2.classList.add('active');
      log.innerHTML = '';

      steps.forEach((s, i) => {
        setTimeout(() => {
          const el = document.createElement('div');
          el.className = 'deploy-line';
          let idH = '';
          if (s.id) {
            const id = s.id === 'Collection' ? nftId : s.id === 'Tx' ? txId() : s.id === 'Token' ? tokenId : topicId;
            idH = `<span class="deploy-id">${s.id}: ${id}</span>`;
          }
          if (s.final) {
            el.innerHTML = `<span class="deploy-check">✓</span><span style="font-weight:700;color:var(--teal)">${s.msg}</span><span class="deploy-time">${s.t}</span>`;
            el.classList.add('success');
          } else {
            el.innerHTML = `<span class="deploy-check" style="display:none">✓</span><span class="deploy-spinner"></span><span>${s.msg}</span>${idH}<span class="deploy-time">${s.t}</span>`;
          }
          log.appendChild(el);
          requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
          if (!s.final) {
            setTimeout(() => {
              const sp = el.querySelector('.deploy-spinner');
              const ch = el.querySelector('.deploy-check');
              if (sp) sp.style.display = 'none';
              if (ch) ch.style.display = 'inline';
              el.classList.add('success');
            }, 350);
          }
          if (s.final) setTimeout(() => showDash(name, val, slices, type), 1000);
        }, i * 450);
      });
    });
  }

  function showDash(name, val, slices, type) {
    step2.classList.remove('active');
    step3.classList.add('active');
    document.getElementById('dashName').textContent = name;
    document.getElementById('dashValue').textContent = fmt(val);
    document.getElementById('dashSlicePrice').textContent = fmt(val / slices) + ' / slice';
    document.getElementById('dashNftId').textContent = nftId;
    document.getElementById('dashTokenId').textContent = tokenId;
    document.getElementById('dashSymbol').textContent = symbol;
    document.getElementById('dashSupply').textContent = fmtN(slices);
    document.getElementById('dashTopicId').textContent = topicId;
    document.getElementById('dashMsgCount').textContent = '3';
    const tb = document.querySelector('.dash-badge.type');
    if (tb) tb.textContent = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      step3.classList.remove('active');
      step1.classList.add('active');
      log.innerHTML = '';
    });
  }

  // (Email form removed — CTA now links directly to console)
});
