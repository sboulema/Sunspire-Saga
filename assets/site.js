// Sunspire Saga site: theme toggle and handheld colour, shared by every page.
// The <head> of each page applies the saved choices before first paint; this file wires the controls.
(function(){
  'use strict';
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  };

  // ---------------- light / dark ----------------
  function effTheme(){ return root.dataset.theme || (mq.matches ? 'dark' : 'light'); }
  function syncTheme(){
    const t = effTheme();
    root.dataset.themeEff = t;
    for (const b of document.querySelectorAll('.theme-toggle')){
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = b.getAttribute('aria-label');
    }
  }
  for (const b of document.querySelectorAll('.theme-toggle')){
    b.addEventListener('click', () => {
      const next = effTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      store.set('sunspire_theme', next);
      syncTheme();
    });
  }
  mq.addEventListener('change', syncTheme);
  syncTheme();

  // ---------------- mobile menu ----------------
  // the button is made here so the links stay in the bar when the script doesn't run
  for (const nav of document.querySelectorAll('header.nav')){
    const links = nav.querySelector('.nav-links');
    if (!links) continue;
    links.id = links.id || 'site-links';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon-btn menu-toggle';
    b.setAttribute('aria-controls', links.id);
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', 'Menu');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path class="bars" d="M4 7h16M4 12h16M4 17h16"/><path class="cross" d="M6 6l12 12M18 6L6 18"/></svg>';
    nav.querySelector('.wrap').appendChild(b);
    nav.classList.add('has-menu');
    const setOpen = open => {
      nav.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
    };
    b.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    links.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', e => { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')){ setOpen(false); b.focus(); }
    });
  }

  // ---------------- handheld colour ----------------
  // named after the game's elements and places; Twilight is the original shell
  const PRESETS = [
    { name: 'Twilight', hex: '#2b2250' },
    { name: 'Ember',    hex: '#c4502b' },
    { name: 'Tide',     hex: '#2f7db5' },
    { name: 'Gale',     hex: '#8466c9' },
    { name: 'Moss',     hex: '#4c7a3a' },
    { name: 'Sunstone', hex: '#e2ab33' },
    { name: 'Pearl',    hex: '#e6e2ec' },
    { name: 'Granite',  hex: '#3a3d45' }
  ];
  const DEFAULT_HH = PRESETS[0].hex;
  function validHex(h){ return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); }
  function luminance(hex){
    const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255)
      .map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function presetName(hex){
    const p = PRESETS.find(p => p.hex.toLowerCase() === hex.toLowerCase());
    return p ? p.name : 'Custom';
  }
  let current = validHex(store.get('sunspire_handheld')) ? store.get('sunspire_handheld') : DEFAULT_HH;
  function applyHH(hex){
    current = hex;
    root.style.setProperty('--hh', hex);
    // the engraved label on the shell needs to read on pale shells too
    root.style.setProperty('--hh-ink', luminance(hex) > .4 ? '#2a2340' : '#e6def7');
    for (const pk of document.querySelectorAll('[data-hh-picker]')) syncPicker(pk);
    document.dispatchEvent(new CustomEvent('handheldchange', { detail: { hex, name: presetName(hex) } }));
  }
  function setHH(hex){
    if (!validHex(hex)) return;
    store.set('sunspire_handheld', hex);
    applyHH(hex);
  }
  function syncPicker(pk){
    const isPreset = PRESETS.some(p => p.hex.toLowerCase() === current.toLowerCase());
    for (const b of pk.querySelectorAll('.hh-sw')) b.setAttribute('aria-pressed', String(b.dataset.hex.toLowerCase() === current.toLowerCase()));
    const cu = pk.querySelector('.hh-custom');
    if (cu){
      cu.dataset.on = String(!isPreset);
      const inp = cu.querySelector('input');
      if (inp && inp.value.toLowerCase() !== current.toLowerCase()) inp.value = current;
    }
    const nm = pk.querySelector('.hh-name');
    if (nm) nm.textContent = presetName(current);
  }
  function buildPicker(pk){
    const label = pk.dataset.hhPicker || 'Shell';
    pk.classList.add('hh-picker');
    pk.setAttribute('role', 'group');
    pk.setAttribute('aria-label', 'Handheld colour');
    pk.innerHTML = '<span class="lbl">' + label + '</span>';
    for (const p of PRESETS){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hh-sw'; b.dataset.hex = p.hex;
      b.style.setProperty('--c', p.hex);
      b.title = p.name; b.setAttribute('aria-label', p.name + ' shell');
      b.addEventListener('click', () => { setHH(p.hex); b.blur(); });
      pk.appendChild(b);
    }
    const cu = document.createElement('label');
    cu.className = 'hh-custom'; cu.title = 'Pick any colour';
    cu.innerHTML = '<input type="color" aria-label="Custom shell colour">';
    cu.querySelector('input').addEventListener('input', e => setHH(e.target.value));
    pk.appendChild(cu);
    const nm = document.createElement('span');
    nm.className = 'hh-name'; nm.setAttribute('aria-live', 'polite');
    pk.appendChild(nm);
    syncPicker(pk);
  }
  for (const pk of document.querySelectorAll('[data-hh-picker]')) buildPicker(pk);
  applyHH(current);

  // keep other open tabs in step
  addEventListener('storage', e => {
    if (e.key === 'sunspire_handheld' && validHex(e.newValue)) applyHH(e.newValue);
    if (e.key === 'sunspire_theme'){ if (e.newValue) root.dataset.theme = e.newValue; else delete root.dataset.theme; syncTheme(); }
  });

  // the service worker (sw.js, site root) makes the site installable as an app and playable offline
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.SunspireSite = { setHH, presets: PRESETS };
})();
