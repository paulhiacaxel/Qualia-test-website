(function(){
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var exp = QUALIA_DATA.getExperience(id);
  var root = document.getElementById('exp-root');

  if (!exp){
    root.innerHTML = '<div class="empty-state max-w-[520px] mx-auto"><p class="font-display text-[20px] mb-2">We couldn\'t find that experience.</p><p class="text-inksoft text-[14px] mb-6">It may have been removed, or the link is off.</p><a href="discover.html" class="btn btn-primary">Browse experiences</a></div>';
    return;
  }

  var host = QUALIA_DATA.getHost(exp.hostId);
  var reviews = QUALIA_DATA.getReviews(exp.id);
  document.title = exp.title + ' — Qualia';
  document.getElementById('page-title').textContent = exp.title + ' — Qualia';

  function stars(rating){
    var full = Math.round(rating);
    var out = '';
    for (var i=0;i<5;i++) out += (i < full ? '★' : '☆');
    return out;
  }
  function firstName(n){ return n.split(' ')[0]; }

  /* ---------- breadcrumb ---------- */
  document.getElementById('exp-breadcrumb').innerHTML =
    '<a href="discover.html" class="link-underline text-inksoft">Discover</a> &nbsp;/&nbsp; ' +
    '<a href="discover.html?category=' + encodeURIComponent(exp.category) + '" class="link-underline text-inksoft">' + exp.category + '</a> &nbsp;/&nbsp; ' +
    '<span class="text-ink">' + exp.title + '</span>';

  /* ---------- header ---------- */
  var saved = QUALIA_STORE.isWishlisted(exp.id);
  document.getElementById('exp-header').innerHTML =
    '<div class="flex items-start justify-between gap-6 mb-3">' +
      '<p class="eyebrow">' + exp.category + ' · ' + exp.location + '</p>' +
      '<button type="button" id="header-wishlist" class="heart-btn' + (saved ? ' saved' : '') + '" aria-label="Save experience">' +
        '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2.6 5 6 5c2 0 3.4 1 6 3.6C14.6 6 16 5 18 5c3.4 0 5.5 3.4 4 6.8C19.5 16.4 12 21 12 21z"/></svg>' +
      '</button>' +
    '</div>' +
    '<h1 class="font-display font-medium text-[32px] md:text-[42px] tracking-[-0.01em] leading-[1.08] mb-4 max-w-[24ch]">' + exp.title + '</h1>' +
    '<p class="font-display italic text-[18px] md:text-[20px] text-inksoft leading-[1.5] mb-5 max-w-[52ch]">"' + exp.tagline + '"</p>' +
    '<div class="flex flex-wrap items-center gap-4">' +
      '<span class="flex items-center gap-1.5 text-[13.5px]"><span class="stars text-[13px]">' + stars(exp.rating) + '</span><span class="text-ink font-semibold">' + exp.rating.toFixed(2) + '</span><span class="text-inksoft">(' + exp.reviewCount + ' reviews)</span></span>' +
      (exp.risk === 'high' ? '<span class="status status-changes">Waiver required</span>' : '') +
      '<span class="font-mono text-[11px] uppercase tracking-[0.05em] text-inksoft">' + exp.duration + ' · up to ' + exp.groupMax + (exp.groupMax === 1 ? ' guest' : ' guests') + '</span>' +
    '</div>';

  document.getElementById('header-wishlist').addEventListener('click', function(){
    QUALIA_STORE.toggleWishlist(exp.id);
    this.classList.toggle('saved');
    QUALIA_APP.toast(this.classList.contains('saved') ? 'Saved to your wishlist' : 'Removed from your wishlist');
  });

  /* ---------- gallery ---------- */
  var shots = ['1','2','3','4'];
  document.getElementById('exp-gallery').innerHTML =
    '<div class="photo-treat rounded-[22px] overflow-hidden aspect-[16/9] mb-3">' +
      '<img id="gallery-main" src="https://placehold.co/1200x675/' + exp.img + '/F1EADA?text=' + encodeURIComponent(exp.title.split(' ').slice(0,2).join(' ')) + '" alt="" class="w-full h-full object-cover">' +
    '</div>' +
    '<div class="grid grid-cols-4 gap-3">' +
      shots.map(function(n){
        return '<button type="button" class="gallery-thumb photo-treat rounded-xl overflow-hidden aspect-[4/3]" data-src="https://placehold.co/1200x900/' + exp.img + '/F1EADA?text=' + n + '">' +
          '<img src="https://placehold.co/300x220/' + exp.img + '/F1EADA?text=' + n + '" alt="" class="w-full h-full object-cover">' +
        '</button>';
      }).join('') +
    '</div>';
  document.querySelectorAll('.gallery-thumb').forEach(function(btn){
    btn.addEventListener('click', function(){ document.getElementById('gallery-main').src = btn.getAttribute('data-src'); });
  });

  /* ---------- host card ---------- */
  document.getElementById('exp-host-card').innerHTML =
    '<div class="border border-line rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">' +
      '<a href="host-profile.html?id=' + host.id + '" class="flex items-center gap-4 min-w-0">' +
        '<span class="avatar-circle !w-14 !h-14 !text-[18px]" style="background:#' + host.color + '">' + QUALIA_APP.initials(host.name) + '</span>' +
        '<span class="min-w-0">' +
          '<span class="flex items-center gap-1.5">' +
            '<span class="font-display text-[17px] font-medium">' + host.name + '</span>' +
            (host.verified ? '<svg width="14" height="14" viewBox="0 0 24 24" class="text-moss shrink-0"><path fill="currentColor" d="M12 2l2.4 2.1 3.1-.6 1 3 2.9 1.4-.9 3.1.9 3.1-2.9 1.4-1 3-3.1-.6L12 22l-2.4-2.1-3.1.6-1-3-2.9-1.4.9-3.1-.9-3.1 2.9-1.4 1-3 3.1.6z"/><path fill="#FAF6EE" d="M9.5 12.5l1.8 1.8 3.4-3.6" stroke="#FAF6EE" stroke-width="1.2"/></svg>' : '') +
          '</span>' +
          '<span class="block font-display italic text-[13.5px] text-inksoft leading-snug mt-1 max-w-[38ch]">' + host.tagline + '</span>' +
          '<span class="block font-mono text-[10.5px] uppercase tracking-[0.04em] text-inksoft mt-2">Hosting since ' + host.joined + ' · ' + host.responseRate + '% response rate</span>' +
        '</span>' +
      '</a>' +
      '<button type="button" id="message-host" class="btn btn-outline btn-sm shrink-0">Message host</button>' +
    '</div>';
  document.getElementById('message-host').addEventListener('click', function(){
    QUALIA_APP.toast(firstName(host.name) + ' usually responds within a few hours.');
  });

  /* ---------- details ---------- */
  document.getElementById('exp-details').innerHTML =
    '<div class="mb-10">' +
      '<h2 class="font-display font-medium text-[22px] mb-5">What you\'ll experience</h2>' +
      '<ul class="space-y-3.5">' + exp.whatYoullExperience.map(function(t){
        return '<li class="ring-bullet text-moss"><span class="text-ink text-[15px] leading-[1.7]">' + t + '</span></li>';
      }).join('') + '</ul>' +
    '</div>' +
    '<div class="mb-10">' +
      '<h2 class="font-display font-medium text-[22px] mb-4">Why this is unique</h2>' +
      '<p class="text-inksoft text-[15px] leading-[1.75] max-w-[62ch]">' + exp.whyUnique + '</p>' +
    '</div>' +
    '<div>' +
      '<h2 class="font-display font-medium text-[22px] mb-4">What\'s included</h2>' +
      '<div class="flex flex-wrap gap-2">' + exp.included.map(function(t){ return '<span class="pill">' + t + '</span>'; }).join('') + '</div>' +
    '</div>';

  /* ---------- safety ---------- */
  if (exp.risk === 'high'){
    document.getElementById('exp-safety').innerHTML =
      '<h2 class="font-display font-medium text-[22px] mb-4">Before you book</h2>' +
      '<div class="risk-notice">' +
        '<span class="ring"></span>' +
        '<div>' +
          '<p class="text-[14.5px] text-ink font-semibold mb-1.5">This is a higher-risk experience: ' + exp.riskTags.join(', ') + '.</p>' +
          '<p class="text-[14px] text-inksoft leading-[1.7]">It was reviewed with that in mind, and ' + firstName(host.name) + ' holds the credentials and insurance the activity requires. You\'ll be asked to sign a short digital waiver acknowledging the assumption of risk before this booking is confirmed.</p>' +
        '</div>' +
      '</div>';
  }

  /* ---------- cancellation ---------- */
  document.getElementById('exp-cancellation').innerHTML =
    '<h2 class="font-display font-medium text-[22px] mb-4">Cancellation &amp; rules</h2>' +
    '<p class="text-inksoft text-[14.5px] leading-[1.75] max-w-[62ch]">' + exp.cancellation + '</p>';

  /* ---------- reviews ---------- */
  var reviewsHTML =
    '<div class="flex items-center gap-4 mb-8">' +
      '<span class="font-display font-semibold text-[30px]">' + exp.rating.toFixed(2) + '</span>' +
      '<span><span class="stars block mb-0.5">' + stars(exp.rating) + '</span><span class="font-mono text-[11px] text-inksoft uppercase tracking-[0.04em]">' + exp.reviewCount + ' reviews</span></span>' +
    '</div>';
  if (reviews.length){
    reviewsHTML += '<div class="grid sm:grid-cols-2 gap-6">' + reviews.map(function(r){
      return '<div class="border-t border-line pt-5">' +
        '<div class="flex items-center gap-3 mb-2.5">' +
          '<span class="avatar-circle !w-9 !h-9 !text-[12px]" style="background:#55504A">' + QUALIA_APP.initials(r.author) + '</span>' +
          '<span><span class="block text-[13.5px] font-semibold">' + r.author + '</span><span class="block font-mono text-[10.5px] text-inksoft">' + QUALIA_STORE.displayDate(r.date) + '</span></span>' +
        '</div>' +
        '<p class="text-[14px] text-inksoft leading-[1.7]">' + r.text + '</p>' +
      '</div>';
    }).join('') + '</div>';
  }
  document.getElementById('exp-reviews').innerHTML =
    '<h2 class="font-display font-medium text-[22px] mb-6">Reviews</h2>' + reviewsHTML;

  /* ---------- more from host ---------- */
  var others = QUALIA_DATA.getExperiencesByHost(host.id).filter(function(e){ return e.id !== exp.id; });
  if (others.length){
    document.getElementById('exp-more-host').innerHTML =
      '<h2 class="font-display font-medium text-[22px] mb-6">More from ' + firstName(host.name) + '</h2>' +
      '<div class="grid sm:grid-cols-2 gap-5">' + others.map(function(o){
        return '<a href="experience.html?id=' + o.id + '" class="block bg-card border border-line rounded-2xl overflow-hidden shadow-brand-sm card-hover">' +
          '<div class="photo-treat aspect-[4/3]"><img src="https://placehold.co/480x360/' + o.img + '/F1EADA?text=' + encodeURIComponent(o.category.split(' ')[0]) + '" alt="" class="w-full h-full object-cover"></div>' +
          '<div class="p-4"><p class="font-display italic text-[14.5px] leading-snug mb-2">"' + o.tagline + '"</p><div class="flex items-center justify-between"><span class="font-mono text-[11.5px] text-inksoft">' + o.rating.toFixed(2) + '★</span><span class="font-display font-semibold text-[15px]">$' + o.price + '</span></div></div>' +
        '</a>';
      }).join('') + '</div>';
  }

  /* ================= BOOKING WIDGET ================= */
  var blocked = QUALIA_STORE.getBlockedDates(host.id);
  var todayMid = new Date(); todayMid.setHours(0,0,0,0);

  document.getElementById('booking-price').innerHTML =
    '<div class="flex items-baseline justify-between mb-1">' +
      '<span class="font-display font-semibold text-[28px]">$' + exp.price + '<span class="font-mono font-normal text-[11px] text-inksoft align-top ml-1">/ person</span></span>' +
      '<span class="flex items-center gap-1 text-[13px]"><span class="stars text-[12px]">' + stars(exp.rating) + '</span>' + exp.rating.toFixed(2) + '</span>' +
    '</div>' +
    '<p class="font-mono text-[10.5px] uppercase tracking-[0.05em] text-inksoft">' + exp.duration + ' · ' + exp.location + '</p>';

  var selected = { date: null, time: null, guests: 1 };

  var calEl = document.getElementById('booking-calendar');
  var cal = QUALIA_CALENDAR.create(calEl, {
    dayState: function(dateObj, iso){
      if (dateObj < todayMid) return 'past';
      if (host.availableWeekdays.indexOf(dateObj.getDay()) === -1) return 'unavailable';
      if (blocked.indexOf(iso) !== -1) return 'unavailable';
      return 'available';
    },
    clickable: function(dateObj, iso, state){ return state === 'available'; },
    onSelect: function(iso){
      selected.date = iso;
      selected.time = null;
      cal.setSelected(iso);
      renderSlots();
      updateCTA();
    }
  });

  document.getElementById('booking-calendar').insertAdjacentHTML('beforeend',
    '<div class="cal-legend mt-4 pt-4 border-t border-line">' +
      '<span><i style="background:#FFFDF8; border-color:#c9d8cb;"></i>Available</span>' +
      '<span><i style="background:#F1EADA; border-color:#F1EADA;"></i>Unavailable</span>' +
    '</div>'
  );

  var slotsEl = document.getElementById('booking-slots');
  function renderSlots(){
    if (!selected.date){ slotsEl.innerHTML = ''; return; }
    slotsEl.innerHTML =
      '<p class="field-label">Time on ' + QUALIA_STORE.displayDate(selected.date) + '</p>' +
      '<div class="grid grid-cols-2 gap-2">' + exp.slots.map(function(t){
        return '<button type="button" class="slot" data-time="' + t + '">' + t + '</button>';
      }).join('') + '</div>';
    slotsEl.querySelectorAll('.slot').forEach(function(btn){
      btn.addEventListener('click', function(){
        slotsEl.querySelectorAll('.slot').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        selected.time = btn.getAttribute('data-time');
        updateCTA();
      });
    });
  }

  var qtyEl = document.getElementById('booking-qty');
  function renderQty(){
    qtyEl.innerHTML =
      '<p class="field-label">Guests</p>' +
      '<div class="qty-stepper">' +
        '<button type="button" id="qty-minus">−</button>' +
        '<span class="font-display font-medium text-[16px] w-6 text-center" id="qty-value">' + selected.guests + '</span>' +
        '<button type="button" id="qty-plus">+</button>' +
        '<span class="font-mono text-[10.5px] text-inksoft ml-1">max ' + exp.groupMax + '</span>' +
      '</div>';
    document.getElementById('qty-minus').addEventListener('click', function(){
      if (selected.guests > 1){ selected.guests--; renderQty(); renderBreakdown(); updateCTA(); }
    });
    document.getElementById('qty-plus').addEventListener('click', function(){
      if (selected.guests < exp.groupMax){ selected.guests++; renderQty(); renderBreakdown(); updateCTA(); }
    });
    document.getElementById('qty-minus').disabled = selected.guests <= 1;
    document.getElementById('qty-plus').disabled = selected.guests >= exp.groupMax;
  }
  renderQty();

  var breakdownEl = document.getElementById('booking-breakdown');
  function computeTotal(){
    var sub = exp.price * selected.guests;
    var fee = Math.round(sub * 0.1);
    return { sub: sub, fee: fee, total: sub + fee };
  }
  function renderBreakdown(){
    var t = computeTotal();
    breakdownEl.innerHTML =
      '<div class="space-y-2 text-[13.5px]">' +
        '<div class="flex justify-between text-inksoft"><span>$' + exp.price + ' × ' + selected.guests + (selected.guests===1?' guest':' guests') + '</span><span class="font-mono">$' + t.sub + '</span></div>' +
        '<div class="flex justify-between text-inksoft"><span>Service fee</span><span class="font-mono">$' + t.fee + '</span></div>' +
        '<div class="flex justify-between font-semibold pt-2 border-t border-line"><span>Total</span><span class="font-mono">$' + t.total + '</span></div>' +
      '</div>';
  }
  renderBreakdown();

  var ctaBtn = document.getElementById('booking-cta');
  function updateCTA(){
    if (!selected.date){ ctaBtn.disabled = true; ctaBtn.textContent = 'Choose a date'; return; }
    if (!selected.time){ ctaBtn.disabled = true; ctaBtn.textContent = 'Choose a time'; return; }
    ctaBtn.disabled = false; ctaBtn.textContent = 'Request to book';
  }
  updateCTA();

  ctaBtn.addEventListener('click', function(){
    var session = QUALIA_STORE.getSession();
    if (!session){
      window.location.href = 'login.html?mode=signup&next=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    openBookingModal(session);
  });

  function openBookingModal(session){
    var t = computeTotal();
    document.getElementById('booking-modal-title').textContent = exp.title;
    document.getElementById('booking-modal-summary').innerHTML =
      '<div class="flex justify-between"><span class="text-inksoft">Date</span><span>' + QUALIA_STORE.displayDate(selected.date) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-inksoft">Time</span><span>' + selected.time + '</span></div>' +
      '<div class="flex justify-between"><span class="text-inksoft">Guests</span><span>' + selected.guests + '</span></div>' +
      '<div class="flex justify-between font-semibold pt-2 border-t border-line mt-1"><span>Total</span><span class="font-mono">$' + t.total + '</span></div>';

    var waiverEl = document.getElementById('booking-modal-waiver');
    var agreeLabel = document.getElementById('booking-agree-label');
    if (exp.risk === 'high'){
      waiverEl.innerHTML = '<div class="risk-notice mb-1"><span class="ring"></span><p class="text-[13px] text-inksoft leading-[1.6]">This booking includes ' + exp.riskTags.join(', ') + '. A digital liability waiver is required.</p></div>';
      agreeLabel.textContent = "I agree to " + firstName(host.name) + "'s cancellation policy and the liability waiver, and I accept the assumption of risk for this experience.";
    } else {
      waiverEl.innerHTML = '';
      agreeLabel.textContent = "I agree to " + firstName(host.name) + "'s cancellation policy and Qualia's guest terms.";
    }

    var agreeBox = document.getElementById('booking-agree');
    var confirmBtn = document.getElementById('booking-confirm');
    agreeBox.checked = false;
    confirmBtn.disabled = true;
    agreeBox.onchange = function(){ confirmBtn.disabled = !agreeBox.checked; };

    confirmBtn.onclick = function(){
      var guestId = session.guestId || session.hostId || 'guest-demo';
      QUALIA_STORE.addBooking({
        experienceId: exp.id, hostId: host.id, guestId: guestId, guestName: session.name,
        date: selected.date, time: selected.time, guests: selected.guests, total: t.total, status: 'pending'
      });
      QUALIA_APP.closeModal('booking-modal');
      document.getElementById('success-message').textContent = firstName(host.name) + ' usually confirms within a few hours. You can track this request from your bookings.';
      QUALIA_APP.openModal('success-modal');
    };

    QUALIA_APP.openModal('booking-modal');
  }

})();
