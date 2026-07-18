/* Qualia — tiny localStorage-backed store (demo persistence, no backend). Attaches to window.QUALIA_STORE */
(function(){

  var KEYS = {
    session: 'qualia_session',
    bookings: 'qualia_bookings',
    listings: 'qualia_listings',
    blocked: 'qualia_blocked_',   // + hostId
    wishlist: 'qualia_wishlist',
    accounts: 'qualia_accounts',
    seeded: 'qualia_seeded_v1'
  };

  function read(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function write(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
  }
  function uid(prefix){
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  /* ---------- date helpers ---------- */
  function toISO(d){
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  function addDays(base, n){
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }
  function displayDate(iso){
    var parts = iso.split('-').map(Number);
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  }
  function displayDateLong(iso){
    var parts = iso.split('-').map(Number);
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  }
  function isPastISO(iso){
    var parts = iso.split('-').map(Number);
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    var today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  }

  /* ---------- seed demo data on first run ---------- */
  function seedIfNeeded(){
    if (read(KEYS.seeded, false)) return;
    var today = new Date();
    var data = window.QUALIA_DATA;

    var bookings = [
      {
        id: uid('bk'), experienceId: 'sailing-newport', hostId: 'elin',
        guestId: 'guest-demo', guestName: 'Jordan Avery',
        date: toISO(addDays(today, 14)), time: '9:00 AM', guests: 2,
        total: 310*2, status: 'confirmed', createdAt: toISO(addDays(today, -6))
      },
      {
        id: uid('bk'), experienceId: 'ceramics-portland', hostId: 'priya',
        guestId: 'guest-demo', guestName: 'Jordan Avery',
        date: toISO(addDays(today, 10)), time: '10:00 AM', guests: 1,
        total: 135, status: 'pending', createdAt: toISO(addDays(today, -2))
      },
      {
        id: uid('bk'), experienceId: 'pasta-bensonhurst', hostId: 'rosa',
        guestId: 'guest-demo', guestName: 'Jordan Avery',
        date: toISO(addDays(today, -34)), time: '11:00 AM', guests: 2,
        total: 145*2, status: 'completed', createdAt: toISO(addDays(today, -40))
      },
      {
        id: uid('bk'), experienceId: 'pasta-bensonhurst', hostId: 'rosa',
        guestId: 'guest-other-1', guestName: 'Alex Chen',
        date: toISO(addDays(today, 4)), time: '4:00 PM', guests: 3,
        total: 145*3, status: 'pending', createdAt: toISO(addDays(today, -1))
      },
      {
        id: uid('bk'), experienceId: 'nonna-sauce', hostId: 'rosa',
        guestId: 'guest-other-2', guestName: 'Priti Anand',
        date: toISO(addDays(today, 7)), time: '10:00 AM', guests: 2,
        total: 120*2, status: 'confirmed', createdAt: toISO(addDays(today, -3))
      },
      {
        id: uid('bk'), experienceId: 'pasta-bensonhurst', hostId: 'rosa',
        guestId: 'guest-other-3', guestName: 'Han Suh',
        date: toISO(addDays(today, -20)), time: '4:00 PM', guests: 2,
        total: 145*2, status: 'completed', createdAt: toISO(addDays(today, -25))
      }
    ];
    write(KEYS.bookings, bookings);

    var listings = [
      {
        id: 'ravioli-two', hostId: 'rosa', title: 'Handmade Ravioli for Two',
        category: 'Cooking', location: 'Bensonhurst, Brooklyn', duration: '2 hours',
        price: 130, groupMax: 2, risk: 'standard', riskTags: [],
        description: "A smaller, quieter session than my Sunday pasta class — just ravioli, filled and folded by hand, for two people at a time.",
        whatYoullExperience: ['Rolling and filling ravioli by hand', 'A simple brown-butter sauce to finish'],
        whyUnique: "It's the version of pasta night I actually cook for two, not a crowd.",
        status: 'review', createdAt: toISO(addDays(today, -4)), img: '374a2e'
      }
    ];
    write(KEYS.listings, listings);

    write(KEYS.blocked + 'rosa', [ toISO(addDays(today, 11)) ]);
    write(KEYS.wishlist, ['woodworking-redhook', 'french-paris']);

    write(KEYS.accounts, [
      { email: 'jordan@demo.qualia', name: 'Jordan Avery', role: 'guest', guestId: 'guest-demo' },
      { email: 'rosa@demo.qualia', name: 'Rosa Bianchi', role: 'host', hostId: 'rosa' }
    ]);

    write(KEYS.seeded, true);
  }

  /* ---------- session ---------- */
  function getSession(){ return read(KEYS.session, null); }
  function setSession(session){ write(KEYS.session, session); }
  function clearSession(){ try{ localStorage.removeItem(KEYS.session); }catch(e){} }

  /* ---------- bookings ---------- */
  function getBookings(){ seedIfNeeded(); return read(KEYS.bookings, []); }
  function addBooking(booking){
    var all = getBookings();
    booking.id = booking.id || uid('bk');
    booking.createdAt = booking.createdAt || toISO(new Date());
    all.push(booking);
    write(KEYS.bookings, all);
    return booking;
  }
  function updateBooking(id, patch){
    var all = getBookings();
    var idx = all.findIndex(function(b){ return b.id === id; });
    if (idx === -1) return null;
    all[idx] = Object.assign({}, all[idx], patch);
    write(KEYS.bookings, all);
    return all[idx];
  }
  function getBookingsForGuest(guestId){
    return getBookings().filter(function(b){ return b.guestId === guestId; });
  }
  function getBookingsForHost(hostId){
    return getBookings().filter(function(b){ return b.hostId === hostId; });
  }

  /* ---------- listings (host-submitted experiences) ---------- */
  function getListings(){ seedIfNeeded(); return read(KEYS.listings, []); }
  function addListing(listing){
    var all = getListings();
    listing.id = listing.id || uid('lst');
    listing.createdAt = listing.createdAt || toISO(new Date());
    all.push(listing);
    write(KEYS.listings, all);
    return listing;
  }
  function getListingsForHost(hostId){
    return getListings().filter(function(l){ return l.hostId === hostId; });
  }

  /* ---------- availability ---------- */
  function getBlockedDates(hostId){ seedIfNeeded(); return read(KEYS.blocked + hostId, []); }
  function toggleBlockedDate(hostId, iso){
    var blocked = getBlockedDates(hostId);
    var idx = blocked.indexOf(iso);
    if (idx === -1) blocked.push(iso); else blocked.splice(idx, 1);
    write(KEYS.blocked + hostId, blocked);
    return blocked;
  }

  /* ---------- accounts (demo email lookup for "sign in") ---------- */
  function getAccounts(){ seedIfNeeded(); return read(KEYS.accounts, []); }
  function addAccount(account){
    var all = getAccounts();
    var existing = all.filter(function(a){ return a.email.toLowerCase() !== account.email.toLowerCase(); });
    existing.push(account);
    write(KEYS.accounts, existing);
    return account;
  }
  function findAccountByEmail(email){
    email = (email || '').toLowerCase().trim();
    return getAccounts().find(function(a){ return a.email.toLowerCase() === email; }) || null;
  }

  /* ---------- wishlist ---------- */
  function getWishlist(){ seedIfNeeded(); return read(KEYS.wishlist, []); }
  function toggleWishlist(experienceId){
    var list = getWishlist();
    var idx = list.indexOf(experienceId);
    if (idx === -1) list.push(experienceId); else list.splice(idx, 1);
    write(KEYS.wishlist, list);
    return list;
  }
  function isWishlisted(experienceId){
    return getWishlist().indexOf(experienceId) !== -1;
  }

  window.QUALIA_STORE = {
    getSession: getSession, setSession: setSession, clearSession: clearSession,
    getBookings: getBookings, addBooking: addBooking, updateBooking: updateBooking,
    getBookingsForGuest: getBookingsForGuest, getBookingsForHost: getBookingsForHost,
    getListings: getListings, addListing: addListing, getListingsForHost: getListingsForHost,
    getBlockedDates: getBlockedDates, toggleBlockedDate: toggleBlockedDate,
    getAccounts: getAccounts, addAccount: addAccount, findAccountByEmail: findAccountByEmail,
    getWishlist: getWishlist, toggleWishlist: toggleWishlist, isWishlisted: isWishlisted,
    toISO: toISO, addDays: addDays, displayDate: displayDate, displayDateLong: displayDateLong, isPastISO: isPastISO,
    uid: uid
  };

})();
