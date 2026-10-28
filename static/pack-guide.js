// Pack guide: renders the slot list from static/pack-slots.json with each sheet's preview, size
// and frame names, and marks the slots the pack stored in this browser covers (the same
// IndexedDB the game reads, see base/shell/SpritePacks.ts).
(function(){
  'use strict';
  const list = document.getElementById('slotList');
  const count = document.getElementById('slotCount');
  const copy = document.getElementById('copyNames');
  if (!list) return;

  function covered(){
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(new Set());
      try {
        const rq = indexedDB.open('sunspire_engine_packs', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('sheets');
        rq.onsuccess = () => {
          const keys = rq.result.transaction('sheets', 'readonly').objectStore('sheets').getAllKeys();
          keys.onsuccess = () => resolve(new Set(keys.result));
          keys.onerror = () => resolve(new Set());
        };
        rq.onerror = () => resolve(new Set());
        rq.onblocked = () => resolve(new Set());
      } catch (e){ resolve(new Set()); }
    });
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

  async function render(){
    let slots = [];
    try { slots = await (await fetch('/static/pack-slots.json')).json(); }
    catch (e){ list.innerHTML = '<p class="warn">The slot list could not be loaded.</p>'; return; }
    const on = await covered();
    const groups = new Map();
    for (const s of slots){ if (!groups.has(s.group)) groups.set(s.group, []); groups.get(s.group).push(s); }
    const parts = [];
    for (const [group, items] of groups){
      parts.push('<h3 id="g-' + esc(group.replace(/\W+/g, '-')) + '">' + esc(group) + ' <i>' + items.length + '</i></h3>');
      parts.push('<table><tr><th>slot</th><th>size</th><th>sheet</th><th>frames</th></tr>');
      for (const s of items){
        const frames = s.frames.length
          ? s.frames.length + ' frame' + (s.frames.length > 1 ? 's' : '') + ': <span class="frames">' + s.frames.map(esc).join(', ') + '</span>'
          : 'single image';
        parts.push('<tr><td><code class="' + (on.has(s.slot) ? 'on' : '') + '">' + esc(s.slot) + '.png</code>' + (on.has(s.slot) ? ' <span class="cov">in your pack</span>' : '') + '</td>'
          + '<td>' + s.width + '&times;' + s.height + '</td>'
          + '<td><a href="/' + esc(s.file) + '" target="_blank"><img class="sheet" src="/' + esc(s.file) + '" alt="" loading="lazy"></a></td>'
          + '<td class="wrap">' + frames + '</td></tr>');
      }
      parts.push('</table>');
    }
    list.innerHTML = parts.join('');
    if (count) count.textContent = slots.length + ' slots' + (on.size ? ', ' + on.size + ' covered by your pack' : '');
    if (copy) copy.onclick = async () => {
      const names = slots.map(s => s.slot + '.png').join('\n');
      try { await navigator.clipboard.writeText(names); copy.textContent = 'Copied'; }
      catch (e){ copy.textContent = 'Copy failed'; }
      setTimeout(() => (copy.textContent = 'Copy all names'), 1500);
    };
    const toc = document.getElementById('slotToc');
    if (toc) toc.innerHTML = [...groups.keys()].map(g => '<a href="#g-' + esc(g.replace(/\W+/g, '-')) + '">' + esc(g) + '</a>').join('');
  }
  render();
})();
