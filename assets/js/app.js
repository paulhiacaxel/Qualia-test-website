/* Qualia — shared page behavior: nav, session-aware header, reveal-on-scroll, modal + toast helpers */
(function(){

  var BASE = window.QUALIA_BASE || '';

  function initMobileNav(){
    var toggle = document.querySelector('[data-mobile-toggle]');
    var drawer = document.querySelector('.mobile-drawer');
    if (!toggle || !drawer) return;
    var scrim = drawer.querySelector('.scrim');
    var closeBtn = drawer.querySelector('[data-mobile-close]');
    function open(){ drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close(){ drawer.classList.remove('open'); document.body.style.overflow = ''; }
    toggle.addEventListener('click', open);
    if (scrim) scrim.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    drawer.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', close); });
  }

  function initReveal(){
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  function initials(name){
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    return ((parts[0]||'')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function initHeaderSession(){
    var slot = document.getElementById('auth-slot');
    var mobileSlot = document.getElementById('auth-slot-mobile');
    if (!slot && !mobileSlot) return;
    var session = window.QUALIA_STORE ? window.QUALIA_STORE.getSession() : null;
    window.QUALIA_SESSION = session;

    if (!session){
      if (slot) slot.innerHTML =
        '<a href="' + BASE + 'login.html" class="nav-link">Log in</a>' +
        '<a href="' + BASE + 'login.html?mode=signup" class="btn btn-primary btn-sm">Sign up</a>';
      if (mobileSlot) mobileSlot.innerHTML =
        '<a href="' + BASE + 'login.html" class="btn btn-outline w-full">Log in</a>' +
        '<a href="' + BASE + 'login.html?mode=signup" class="btn btn-primary w-full">Sign up</a>';
      return;
    }

    var dashHref, menuExtra;
    if (session.role === 'host'){
      dashHref = BASE + 'host/dashboard.html';
      menuExtra =
        '<a href="' + BASE + 'host/dashboard.html">Host dashboard</a>' +
        '<a href="' + BASE + 'host/create-experience.html">Create an experience</a>' +
        '<a href="' + BASE + 'host/calendar.html">Availability calendar</a>';
    } else {
      dashHref = BASE + 'account/dashboard.html';
      menuExtra =
        '<a href="' + BASE + 'account/dashboard.html">My bookings</a>' +
        '<a href="' + BASE + 'discover.html">Discover experiences</a>';
    }
    window.QUALIA_DASH_HREF = dashHref;

    if (slot){
      slot.innerHTML =
        '<div class="avatar-menu" id="avatar-menu">' +
          '<button type="button" id="avatar-btn" class="flex items-center gap-2" aria-haspopup="true" aria-expanded="false">' +
            '<span class="avatar-circle">' + initials(session.name) + '</span>' +
          '</button>' +
          '<div class="dropdown shadow-brand" role="menu">' +
            '<div class="px-3 py-2 mb-1 border-b border-line">' +
              '<p class="text-[13px] font-semibold text-ink truncate">' + session.name + '</p>' +
              '<p class="text-[11px] text-inksoft font-mono uppercase tracking-[0.04em]">' + (session.role === 'host' ? 'Host account' : 'Guest account') + '</p>' +
            '</div>' +
            menuExtra +
            '<button type="button" id="logout-btn">Log out</button>' +
          '</div>' +
        '</div>';

      var menu = document.getElementById('avatar-menu');
      var btn = document.getElementById('avatar-btn');
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', menu.classList.contains('open'));
      });
      document.addEventListener('click', function(){ menu.classList.remove('open'); });
      document.getElementById('logout-btn').addEventListener('click', function(){
        window.QUALIA_STORE.clearSession();
        window.location.href = BASE + 'index.html';
      });
    }

    if (mobileSlot){
      mobileSlot.innerHTML =
        '<div class="flex items-center gap-3 pb-4 mb-1 border-b border-line">' +
          '<span class="avatar-circle">' + initials(session.name) + '</span>' +
          '<div class="min-w-0"><p class="text-[13.5px] font-semibold text-ink truncate">' + session.name + '</p>' +
          '<p class="text-[11px] text-inksoft font-mono uppercase tracking-[0.04em]">' + (session.role === 'host' ? 'Host account' : 'Guest account') + '</p></div>' +
        '</div>' +
        '<a href="' + dashHref + '" class="btn btn-primary w-full">' + (session.role === 'host' ? 'Host dashboard' : 'My bookings') + '</a>' +
        '<button type="button" id="logout-btn-mobile" class="btn btn-outline w-full">Log out</button>';
      document.getElementById('logout-btn-mobile').addEventListener('click', function(){
        window.QUALIA_STORE.clearSession();
        window.location.href = BASE + 'index.html';
      });
    }
  }

  /* ---------- generic modal open/close ---------- */
  function openModal(id){
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id){
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
  function initModalDismiss(){
    document.querySelectorAll('.modal-backdrop').forEach(function(backdrop){
      backdrop.addEventListener('click', function(e){
        if (e.target === backdrop) closeModal(backdrop.id);
      });
      var closeBtns = backdrop.querySelectorAll('[data-modal-close]');
      closeBtns.forEach(function(b){ b.addEventListener('click', function(){ closeModal(backdrop.id); }); });
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){
        document.querySelectorAll('.modal-backdrop.open').forEach(function(b){ closeModal(b.id); });
      }
    });
  }

  /* ---------- toast ---------- */
  function toast(message){
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="w-4 h-4 rounded-full border-[1.6px] border-gold shrink-0" aria-hidden="true"></span><span>' + message + '</span>';
    wrap.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('show'); });
    setTimeout(function(){
      el.classList.remove('show');
      setTimeout(function(){ el.remove(); }, 400);
    }, 3800);
  }

  document.addEventListener('DOMContentLoaded', function(){
    initMobileNav();
    initReveal();
    initHeaderSession();
    initModalDismiss();
  });

  window.QUALIA_APP = {
    toast: toast, openModal: openModal, closeModal: closeModal, initials: initials, BASE: BASE
  };

})();
