// ============================================================
// CHARLOTTE COMMERCIAL — owner.js
// Pannello owner: gestione tariffe, convenzioni, storico, operatori
// ============================================================

let ownerGarageId = null;
let ownerGarageList = [];
let tariffeCorrente = [];
let convenzioniCorrente = [];

// ── INIT OWNER PANEL ─────────────────────────────────────────

async function inizializzaOwner() {
  await caricaGaragesOwner();
  mostraSezioneOwner('tariffe');
}

async function caricaGaragesOwner() {
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!accountId) return;

  const { data } = await sbClient
    .from('garages')
    .select('id, name, email, telefono, orario_apertura, orario_chiusura, giorni_apertura, lat, lng, raggio_metri, active, address')
    .eq('account_id', accountId)
    .eq('active', true)
    .order('name');

  if (!data || data.length === 0) return;

  ownerGarageList = data;
  ownerGarageId = data[0].id;

  const sel = document.getElementById('owner-garage-select');
  if (sel) {
    sel.innerHTML = data.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('');
    sel.addEventListener('change', async () => {
      ownerGarageId = sel.value;
      await ricaricaSezioneAttiva();
    });
  }

  await ricaricaSezioneAttiva();
}

async function ricaricaSezioneAttiva() {
  const sezione = document.querySelector('.owner-tab.active')?.dataset?.tab || 'tariffe';
  await mostraSezioneOwner(sezione);
}

function mostraSezioneOwner(sezione) {
  document.querySelectorAll('.owner-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === sezione);
  });
  document.querySelectorAll('.owner-section').forEach(s => {
    s.style.display = s.id === 'owner-' + sezione ? 'block' : 'none';
  });
  if (sezione === 'tariffe') return renderTariffe();
  if (sezione === 'convenzioni') return renderConvenzioni();
  if (sezione === 'garages') return renderGarages();
  if (sezione === 'storico') return renderStorico();
  if (sezione === 'operatori') return renderOperatori();
  if (sezione === 'turni') return renderTurni();
  if (sezione === 'prenotazioni') return renderPrenotazioni();
}

// ── TARIFFE ──────────────────────────────────────────────────

async function renderTariffe() {
  const container = document.getElementById('tariffe-container');
  if (!container || !ownerGarageId) return;

  const { data } = await sbClient.from('tariffe').select('*').eq('garage_id', ownerGarageId);
  tariffeCorrente = data || [];

  container.innerHTML = CATEGORIE.map(cat => {
    const t = tariffeCorrente.find(r => r.categoria === cat.id) || {};
    return '<div class="tariffa-card" id="card-' + cat.id + '">' +
      '<div class="tariffa-card-header"><span>' + cat.icon + ' ' + cat.label + '</span>' +
      '<span class="tariffa-badge ' + (t.id ? 'configured' : 'missing') + '">' + (t.id ? 'Configurata' : 'Non configurata') + '</span></div>' +
      '<div class="tariffa-fields">' +
      '<div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Prima ora (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="t-' + cat.id + '-prima" value="' + (t.prezzo_prima_ora || '') + '"></div>' +
      '<div class="tariffa-field"><label>Ore successive (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="t-' + cat.id + '-succ" value="' + (t.prezzo_ora_successiva || '') + '"></div>' +
      '</div><div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Tariffa giornaliera (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="t-' + cat.id + '-giorn" value="' + (t.prezzo_giornaliero || '') + '"></div>' +
      '<div class="tariffa-field"><label>Soglia giornaliero (ore)</label><input type="number" step="1" min="1" max="23" class="wz-input" id="t-' + cat.id + '-soglia" value="' + (t.soglia_giornaliero_ore || 4) + '"></div>' +
      '</div><div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Tolleranza fine giornaliero (min)</label><input type="number" step="1" min="0" max="120" class="wz-input" id="t-' + cat.id + '-toll" value="' + (t.tolleranza_minuti || 30) + '"></div>' +
      '<div class="tariffa-field"><label>Tolleranza per ora (min)</label><input type="number" step="1" min="0" max="59" class="wz-input" id="t-' + cat.id + '-tollora" value="' + (t.tolleranza_ora_minuti !== undefined ? t.tolleranza_ora_minuti : 10) + '"></div>' +
      '</div>' +
      '<button class="wz-btn-primary" style="margin-top:8px" onclick="salvaTariffa(\'' + cat.id + '\', \'' + (t.id || '') + '\')">Salva ' + cat.label + '</button>' +
      '<div class="tariffa-msg" id="msg-' + cat.id + '"></div>' +
      '</div></div>';
  }).join('');
  await renderCategorieCustomInTariffe();
}

async function renderCategorieCustomInTariffe() {
  const container = document.getElementById('tariffe-container');
  if (!container || !ownerGarageId) return;

  const { data: cats } = await sbClient.from('categorie_custom').select('*').eq('garage_id', ownerGarageId).order('nome');
  const { data: tariffe } = await sbClient.from('tariffe').select('*').eq('garage_id', ownerGarageId).not('categoria_custom', 'is', null);
  const lista = cats || [];

  let html = '<div style="margin-top:24px"><div class="section-label" style="margin-bottom:12px">Categorie personalizzate</div>' +
    '<div class="tariffa-card" style="margin-bottom:12px"><div class="tariffa-card-header"><span>+ Nuova categoria</span></div>' +
    '<div class="tariffa-fields"><div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Nome categoria</label><input class="wz-input" id="cc-nome" placeholder="Es. Bicicletta, Cargo..."></div>' +
    '<div class="tariffa-field"><label>Icona (emoji)</label><input class="wz-input" id="cc-icona" placeholder="Es. una emoji" maxlength="4" style="font-size:24px;text-align:center" value="&#x1F697;"></div>' +
    '</div><button class="wz-btn-primary" style="margin-top:8px" onclick="aggiungiCategoriaCustom()">+ Aggiungi categoria</button>' +
    '<div class="tariffa-msg" id="msg-cc"></div></div></div>';

  lista.forEach(cat => {
    const t = (tariffe || []).find(t => t.categoria_custom === cat.id) || {};
    html += '<div class="tariffa-card" style="margin-bottom:12px"><div class="tariffa-card-header">' +
      '<span>' + (cat.icona || '') + ' ' + cat.nome + '</span>' +
      '<div style="display:flex;gap:8px"><span class="tariffa-badge ' + (t.id ? 'configured' : 'missing') + '">' + (t.id ? 'Configurata' : 'Senza tariffa') + '</span>' +
      '<button onclick="eliminaCatCustom(this)" data-id="' + cat.id + '" style="background:none;border:1px solid var(--red);border-radius:6px;padding:4px 8px;color:var(--red);cursor:pointer;font-size:11px">Elimina</button>' +
      '</div></div><div class="tariffa-fields"><div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Prima ora (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="cc-' + cat.id + '-prima" value="' + (t.prezzo_prima_ora || '') + '"></div>' +
      '<div class="tariffa-field"><label>Ore successive (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="cc-' + cat.id + '-succ" value="' + (t.prezzo_ora_successiva || '') + '"></div>' +
      '</div><div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Tariffa giornaliera (€)</label><input type="number" step="0.01" min="0" class="wz-input" id="cc-' + cat.id + '-giorn" value="' + (t.prezzo_giornaliero || '') + '"></div>' +
      '<div class="tariffa-field"><label>Soglia giornaliero (ore)</label><input type="number" step="1" min="1" class="wz-input" id="cc-' + cat.id + '-soglia" value="' + (t.soglia_giornaliero_ore || 4) + '"></div>' +
      '</div><button class="wz-btn-primary" style="margin-top:8px" onclick="salvaTariffaCustomBtn(this)" data-catid="' + cat.id + '" data-tarid="' + (t.id || '') + '">Salva tariffa</button>' +
      '<div class="tariffa-msg" id="msg-cc-' + cat.id + '"></div></div></div>';
  });

  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
}

async function salvaTariffa(categoriaId, esistenteId) {
  const prima = parseFloat(document.getElementById('t-' + categoriaId + '-prima')?.value || 0);
  const succ = parseFloat(document.getElementById('t-' + categoriaId + '-succ')?.value || 0);
  const giorn = parseFloat(document.getElementById('t-' + categoriaId + '-giorn')?.value || 0);
  const soglia = parseInt(document.getElementById('t-' + categoriaId + '-soglia')?.value || 4);
  const toll = parseInt(document.getElementById('t-' + categoriaId + '-toll')?.value || 30);
  const tollOra = parseInt(document.getElementById('t-' + categoriaId + '-tollora')?.value || 10);
  const msg = document.getElementById('msg-' + categoriaId);
  const payload = { garage_id: ownerGarageId, categoria: categoriaId, prezzo_prima_ora: prima, prezzo_ora_successiva: succ, prezzo_giornaliero: giorn, soglia_giornaliero_ore: soglia, tolleranza_minuti: toll, tolleranza_ora_minuti: tollOra, updated_at: new Date().toISOString() };
  let error;
  if (esistenteId) { ({ error } = await sbClient.from('tariffe').update(payload).eq('id', esistenteId)); }
  else { ({ error } = await sbClient.from('tariffe').insert(payload)); }
  if (msg) { msg.style.color = error ? 'var(--red)' : 'var(--green)'; msg.textContent = error ? 'Errore.' : 'Salvato!'; setTimeout(() => { msg.textContent = ''; renderTariffe(); }, 1500); }
}

async function aggiungiCategoriaCustom() {
  const nome = document.getElementById('cc-nome')?.value?.trim();
  const icona = document.getElementById('cc-icona')?.value?.trim() || '';
  const msg = document.getElementById('msg-cc');
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!nome) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Inserisci il nome.'; } return; }
  const { error } = await sbClient.from('categorie_custom').insert({ account_id: accountId, garage_id: ownerGarageId, nome, icona });
  if (error) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Errore: ' + error.message; } return; }
  document.getElementById('cc-nome').value = '';
  await renderTariffe();
}

async function salvaTariffaCustom(catId, esistenteId) {
  const prima = parseFloat(document.getElementById('cc-' + catId + '-prima')?.value || 0);
  const succ = parseFloat(document.getElementById('cc-' + catId + '-succ')?.value || 0);
  const giorn = parseFloat(document.getElementById('cc-' + catId + '-giorn')?.value || 0);
  const soglia = parseInt(document.getElementById('cc-' + catId + '-soglia')?.value || 4);
  const msg = document.getElementById('msg-cc-' + catId);
  const payload = { garage_id: ownerGarageId, categoria: 'custom_' + catId, categoria_custom: catId, prezzo_prima_ora: prima, prezzo_ora_successiva: succ, prezzo_giornaliero: giorn, soglia_giornaliero_ore: soglia, tolleranza_minuti: 30, tolleranza_ora_minuti: 10, updated_at: new Date().toISOString() };
  let error;
  if (esistenteId) { ({ error } = await sbClient.from('tariffe').update(payload).eq('id', esistenteId)); }
  else { ({ error } = await sbClient.from('tariffe').insert(payload)); }
  if (msg) { msg.style.color = error ? 'var(--red)' : 'var(--green)'; msg.textContent = error ? 'Errore.' : 'Salvato!'; setTimeout(() => { msg.textContent = ''; renderTariffe(); }, 1500); }
}

async function eliminaCategoriaCustom(catId) {
  if (!confirm('Eliminare questa categoria e le sue tariffe?')) return;
  await sbClient.from('tariffe').delete().eq('categoria_custom', catId);
  await sbClient.from('categorie_custom').delete().eq('id', catId);
  await renderTariffe();
}

function eliminaCatCustom(btn) { eliminaCategoriaCustom(btn.getAttribute('data-id')); }
function salvaTariffaCustomBtn(btn) { salvaTariffaCustom(btn.getAttribute('data-catid'), btn.getAttribute('data-tarid')); }

// ── CONVENZIONI ───────────────────────────────────────────────

async function renderConvenzioni() {
  const container = document.getElementById('convenzioni-container');
  if (!container || !ownerGarageId) return;
  const { data } = await sbClient.from('convenzioni').select('*, tariffe_convenzioni(*)').eq('garage_id', ownerGarageId).order('nome');
  convenzioniCorrente = data || [];
  if (convenzioniCorrente.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F91D;</div><div class="empty-text">Nessuna convenzione</div></div><button class="wz-btn-primary" style="margin-top:16px" onclick="apriFormConvenzione()">+ Nuova convenzione</button>';
    return;
  }
  container.innerHTML = '<button class="wz-btn-primary" style="margin-bottom:16px" onclick="apriFormConvenzione()">+ Nuova convenzione</button>' + convenzioniCorrente.map(c => cardConvenzione(c)).join('');
}

function cardConvenzione(conv) {
  const tcs = conv.tariffe_convenzioni || [];
  return '<div class="tariffa-card"><div class="tariffa-card-header"><span>&#x1F91D; ' + conv.nome + '</span>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<span class="tariffa-badge ' + (conv.attiva ? 'configured' : 'missing') + '">' + (conv.attiva ? 'Attiva' : 'Disattiva') + '</span>' +
    '<button onclick="toggleConvenzione(\'' + conv.id + '\', ' + conv.attiva + ')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--muted);cursor:pointer;font-size:11px">' + (conv.attiva ? 'Disattiva' : 'Attiva') + '</button>' +
    '<button onclick="eliminaConvenzione(\'' + conv.id + '\')" style="background:none;border:1px solid var(--red);border-radius:6px;padding:4px 8px;color:var(--red);cursor:pointer;font-size:11px">Elimina</button>' +
    '</div></div><div class="tariffa-fields"><div class="section-label" style="margin-bottom:8px">Tariffe per categoria (€/giorno)</div>' +
    CATEGORIE.map(cat => {
      const tc = tcs.find(t => t.categoria === cat.id) || {};
      return '<div class="tariffa-row" style="margin-bottom:8px;align-items:center"><span style="flex:1;font-size:13px;color:var(--text)">' + cat.icon + ' ' + cat.label + '</span>' +
        '<input type="number" step="0.01" min="0" class="wz-input" style="width:100px;text-align:right" id="tc-' + conv.id + '-' + cat.id + '" value="' + (tc.prezzo_giornaliero || '') + '" placeholder="€"></div>';
    }).join('') +
    '<button class="wz-btn-primary" style="margin-top:8px" onclick="salvaConvenzione(\'' + conv.id + '\')">Salva tariffe convenzione</button>' +
    '<div class="tariffa-msg" id="msg-conv-' + conv.id + '"></div></div></div>';
}

async function apriFormConvenzione() {
  const nome = prompt('Nome della convenzione:');
  if (!nome?.trim()) return;
  const { error } = await sbClient.from('convenzioni').insert({ garage_id: ownerGarageId, nome: nome.trim(), attiva: true });
  if (error) { alert('Errore.'); return; }
  await renderConvenzioni();
}

async function salvaConvenzione(convId) {
  const msg = document.getElementById('msg-conv-' + convId);
  for (const cat of CATEGORIE) {
    const el = document.getElementById('tc-' + convId + '-' + cat.id);
    const val = parseFloat(el?.value || 0);
    if (val <= 0) continue;
    await sbClient.from('tariffe_convenzioni').upsert({ convenzione_id: convId, categoria: cat.id, prezzo_giornaliero: val }, { onConflict: 'convenzione_id,categoria' });
  }
  if (msg) { msg.style.color = 'var(--green)'; msg.textContent = 'Salvato!'; setTimeout(() => { msg.textContent = ''; }, 1500); }
}

async function toggleConvenzione(convId, attivaCorrente) {
  await sbClient.from('convenzioni').update({ attiva: !attivaCorrente }).eq('id', convId);
  await renderConvenzioni();
}

async function eliminaConvenzione(convId) {
  if (!confirm('Eliminare questa convenzione?')) return;
  await sbClient.from('convenzioni').delete().eq('id', convId);
  await renderConvenzioni();
}

// ── GARAGES ──────────────────────────────────────────────────

function generaOpzioniOre(selected) {
  let html = '';
  for (let h = 0; h < 24; h++) {
    for (let m of ['00', '30']) {
      const val = String(h).padStart(2,'0') + ':' + m;
      const sel = (selected && selected.slice(0,5) === val) ? 'selected' : '';
      html += '<option value="' + val + '" ' + sel + '>' + val + '</option>';
    }
  }
  return html;
}

async function renderGarages() {
  const container = document.getElementById('garages-container');
  if (!container) return;

  const accountId = localStorage.getItem('charlotte_account_id');
  const { data } = await sbClient.from('garages').select('*').eq('account_id', accountId).order('name');

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-text">Nessun garage</div></div>';
    return;
  }

  const nomiGiorni = ['','Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

  container.innerHTML = data.map(g => {
    const giorniAttuali = (g.giorni_apertura || '1,2,3,4,5,6').split(',');
    const giorniCheckbox = [1,2,3,4,5,6,7].map(i =>
      '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text);cursor:pointer">' +
      '<input type="checkbox" id="g-giorno-' + g.id + '-' + i + '" value="' + i + '" ' +
      (giorniAttuali.includes(String(i)) ? 'checked' : '') +
      ' style="accent-color:var(--accent)">' + nomiGiorni[i] + '</label>'
    ).join('');

    return '<div class="tariffa-card">' +
      '<div class="tariffa-card-header"><span>&#x1F3E2; ' + g.name + '</span>' +
      '<span class="tariffa-badge ' + (g.active ? 'configured' : 'missing') + '">' + (g.active ? 'Attivo' : 'Disattivo') + '</span></div>' +
      '<div class="tariffa-fields">' +
      '<div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Nome</label><input class="wz-input" id="g-nome-' + g.id + '" value="' + (g.name || '') + '"></div>' +
      '<div class="tariffa-field"><label>Indirizzo</label><input class="wz-input" id="g-addr-' + g.id + '" value="' + (g.address || '') + '"></div>' +
      '</div>' +
      '<div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Email contatto</label><input class="wz-input" id="g-email-' + g.id + '" type="email" placeholder="info@garage.it" value="' + (g.email || '') + '"></div>' +
      '<div class="tariffa-field"><label>Telefono contatto</label><input class="wz-input" id="g-tel-' + g.id + '" type="tel" placeholder="+39 055 123456" value="' + (g.telefono || '') + '"></div>' +
      '</div>' +
      '<div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Orario apertura</label><select class="wz-input" id="g-open-' + g.id + '">' + generaOpzioniOre(g.orario_apertura || '07:00') + '</select></div>' +
      '<div class="tariffa-field"><label>Orario chiusura</label><select class="wz-input" id="g-close-' + g.id + '">' + generaOpzioniOre(g.orario_chiusura || '20:00') + '</select></div>' +
      '</div>' +
      '<div class="tariffa-field" style="margin-bottom:8px"><label>Giorni di apertura</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' + giorniCheckbox + '</div></div>' +
      '<div class="tariffa-row">' +
      '<div class="tariffa-field"><label>Raggio badge (metri)</label><input class="wz-input" id="g-raggio-' + g.id + '" type="number" min="10" max="500" value="' + (g.raggio_metri || 50) + '"></div>' +
      '<div class="tariffa-field" style="justify-content:flex-end;align-items:flex-end"><label>&nbsp;</label>' +
      '<button onclick="rilevaPosizioneGarage(\'' + g.id + '\')" style="background:var(--bg2);border:1px solid var(--accent);border-radius:8px;padding:10px;color:var(--accent3);cursor:pointer;font-size:12px">&#x1F4CD; Usa posizione attuale</button></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button class="wz-btn-primary" style="flex:1" onclick="salvaGarage(\'' + g.id + '\')">Salva</button>' +
      '<button class="wz-btn-secondary" style="flex:1" onclick="toggleGarage(\'' + g.id + '\', ' + g.active + ')">' + (g.active ? 'Disattiva' : 'Attiva') + '</button>' +
      '</div>' +
      '<div class="tariffa-msg" id="msg-g-' + g.id + '"></div>' +
      '</div></div>';
  }).join('') + '<button class="wz-btn-primary" style="margin-top:8px" onclick="aggiungiGarage()">+ Aggiungi garage</button>';
}

async function salvaGarage(garageId) {
  const nome = document.getElementById('g-nome-' + garageId)?.value?.trim();
  const addr = document.getElementById('g-addr-' + garageId)?.value?.trim();
  const email = document.getElementById('g-email-' + garageId)?.value?.trim() || null;
  const telefono = document.getElementById('g-tel-' + garageId)?.value?.trim() || null;
  const orarioApertura = document.getElementById('g-open-' + garageId)?.value || '07:00';
  const orarioChiusura = document.getElementById('g-close-' + garageId)?.value || '20:00';
  const raggio = parseInt(document.getElementById('g-raggio-' + garageId)?.value) || 50;
  const giorniChecked = Array.from(document.querySelectorAll('[id^="g-giorno-' + garageId + '-"]:checked')).map(el => el.value);
  const giorni = giorniChecked.join(',') || '1,2,3,4,5,6';
  const msg = document.getElementById('msg-g-' + garageId);

  const { error } = await sbClient.from('garages').update({
    name: nome, address: addr, email, telefono,
    orario_apertura: orarioApertura, orario_chiusura: orarioChiusura,
    giorni_apertura: giorni, raggio_metri: raggio
  }).eq('id', garageId);

  if (msg) { msg.style.color = error ? 'var(--red)' : 'var(--green)'; msg.textContent = error ? 'Errore: ' + (error.message || '') : 'Salvato!'; setTimeout(() => { msg.textContent = ''; caricaGaragesOwner(); }, 1500); }
}

async function rilevaPosizioneGarage(garageId) {
  const msg = document.getElementById('msg-g-' + garageId);
  if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = 'Rilevamento GPS...'; }
  try {
    const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
    const { error } = await sbClient.from('garages').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', garageId);
    if (msg) { msg.style.color = error ? 'var(--red)' : 'var(--green)'; msg.textContent = error ? 'Errore salvataggio GPS.' : 'Posizione GPS salvata: ' + pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5); }
  } catch (e) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'GPS non disponibile.'; }
  }
}

async function toggleGarage(garageId, attivoCorrente) {
  await sbClient.from('garages').update({ active: !attivoCorrente }).eq('id', garageId);
  await renderGarages();
}

async function aggiungiGarage() {
  const nome = prompt('Nome del nuovo garage:');
  if (!nome?.trim()) return;
  const addr = prompt('Indirizzo (opzionale):') || '';
  const accountId = localStorage.getItem('charlotte_account_id');
  const { error } = await sbClient.from('garages').insert({ account_id: accountId, name: nome.trim(), address: addr.trim(), active: true });
  if (error) { alert('Errore nella creazione.'); return; }
  await caricaGaragesOwner();
  await renderGarages();
}

// ── STORICO ──────────────────────────────────────────────────

function renderStorico() {
  const container = document.getElementById('storico-container');
  if (!container) return;
  const oggi = new Date().toISOString().split('T')[0];
  container.innerHTML = '<div class="tariffa-card" style="margin-bottom:16px"><div class="tariffa-fields">' +
    '<div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Targa (anche parziale)</label><input class="wz-input" id="storico-targa" placeholder="Es. FL13" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>' +
    '<div class="tariffa-field"><label>Data centrale</label><input class="wz-input" id="storico-data" type="date" value="' + oggi + '"></div>' +
    '</div><div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Range giorni (+-)</label><input class="wz-input" id="storico-range" type="number" min="1" max="365" value="10"></div>' +
    '<div class="tariffa-field"><label>Garage</label><select class="wz-input" id="storico-garage"><option value="">Tutti i garage</option>' +
    ownerGarageList.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('') +
    '</select></div></div>' +
    '<button class="wz-btn-primary" style="margin-top:8px" onclick="cercaStorico()">Cerca</button>' +
    '</div></div><div id="storico-risultati"></div>';
}

async function cercaStorico() {
  const targa = document.getElementById('storico-targa')?.value?.trim() || '';
  const dataInput = document.getElementById('storico-data')?.value;
  const range = parseInt(document.getElementById('storico-range')?.value || 10);
  const garageId = document.getElementById('storico-garage')?.value || '';
  const container = document.getElementById('storico-risultati');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Ricerca in corso...</div>';
  const dataCentrale = new Date(dataInput);
  const dataInizio = new Date(dataCentrale); dataInizio.setDate(dataInizio.getDate() - range);
  const dataFine = new Date(dataCentrale); dataFine.setDate(dataFine.getDate() + range);
  let query = sbClient.from('soste').select('id, targa, tipo_veicolo, ingresso_at, uscita_at, importo, convenzione_id, garage_id, operatore_ingresso_nome, operatore_uscita_nome')
    .gte('ingresso_at', dataInizio.toISOString()).lte('ingresso_at', dataFine.toISOString()).order('ingresso_at', { ascending: false }).limit(100);
  if (targa) query = query.ilike('targa', '%' + targa + '%');
  if (garageId) { query = query.eq('garage_id', garageId); } else { query = query.in('garage_id', ownerGarageList.map(g => g.id)); }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F50D;</div><div class="empty-text">Nessuna sosta trovata</div></div>';
    return;
  }
  const perData = {};
  data.forEach(s => {
    const giorno = new Date(s.ingresso_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!perData[giorno]) perData[giorno] = [];
    perData[giorno].push(s);
  });
  let html = '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">' + data.length + ' soste</div>';
  for (const giorno in perData) {
    const soste = perData[giorno];
    const tot = soste.reduce((sum, s) => sum + (s.importo || 0), 0);
    html += '<div style="margin-bottom:4px;padding:8px 12px;background:rgba(124,58,237,0.1);border-radius:8px;display:flex;justify-content:space-between">' +
      '<span style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--accent3);text-transform:capitalize">' + giorno + '</span>' +
      '<span style="font-family:Share Tech Mono,monospace;font-size:12px;color:var(--green)">' + soste.length + ' soste · ' + formatEuro(tot) + '</span></div>';
    soste.forEach(s => {
      const garage = ownerGarageList.find(g => g.id === s.garage_id);
      const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
      const oraI = new Date(s.ingresso_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const oraU = s.uscita_at ? new Date(s.uscita_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '&#x2014;';
      const durata = s.uscita_at ? calcolaDurataStorico(s.ingresso_at, s.uscita_at) : 'In sosta';
      const opInfo = s.operatore_ingresso_nome ? ' · ' + s.operatore_ingresso_nome : '';
      html += '<div class="sosta-card ' + (s.uscita_at ? 'chiusa' : 'attiva') + '" style="margin-bottom:6px">' +
        '<div class="sosta-info"><div class="sosta-targa">' + s.targa + '</div>' +
        '<div class="sosta-tipo">' + (cat ? cat.icon + ' ' + cat.label : s.tipo_veicolo) + (garage ? ' · ' + garage.name : '') + opInfo + '</div></div>' +
        '<div><div class="sosta-time">' + oraI + ' &#x2192; ' + oraU + '</div><div class="sosta-duration">' + durata + '</div>' +
        (s.importo ? '<div class="sosta-time" style="color:var(--green)">' + formatEuro(s.importo) + '</div>' : '') +
        '</div></div>';
    });
  }
  container.innerHTML = html;
}

function calcolaDurataStorico(ingressoAt, uscitaAt) {
  const diff = Math.floor((new Date(uscitaAt) - new Date(ingressoAt)) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

// ── OPERATORI ─────────────────────────────────────────────────

function generaPIN() { return String(Math.floor(100000 + Math.random() * 900000)); }

async function renderOperatori() {
  const container = document.getElementById('operatori-container');
  if (!container) return;
  const accountId = localStorage.getItem('charlotte_account_id');
  const { data } = await sbClient.from('operatori').select('*').eq('account_id', accountId).order('nome');
  const lista = data || [];
  let listaHtml = lista.length === 0
    ? '<div class="empty-state"><div class="empty-icon">&#x1F465;</div><div class="empty-text">Nessun operatore ancora</div></div>'
    : lista.map(op =>
        '<div class="tariffa-card" style="margin-bottom:8px"><div class="tariffa-card-header" style="padding:12px 16px">' +
        '<div><div style="font-size:16px;font-weight:700">' + op.nome + '</div>' +
        '<div style="font-size:15px;color:var(--accent3);font-family:Share Tech Mono,monospace;margin-top:4px;letter-spacing:4px">PIN: ' + (op.pin || '——') + '</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<span class="tariffa-badge ' + (op.attivo ? 'configured' : 'missing') + '">' + (op.attivo ? 'Attivo' : 'Disattivo') + '</span>' +
        '<button onclick="rigeneraPIN(\'' + op.id + '\')" style="background:none;border:1px solid var(--accent);border-radius:6px;padding:4px 8px;color:var(--accent3);cursor:pointer;font-size:11px">Nuovo PIN</button>' +
        '<button onclick="toggleOperatore(\'' + op.id + '\', ' + op.attivo + ')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--muted);cursor:pointer;font-size:11px">' + (op.attivo ? 'Disattiva' : 'Riattiva') + '</button>' +
        '<button onclick="eliminaOperatore(\'' + op.id + '\')" style="background:none;border:1px solid var(--red);border-radius:6px;padding:4px 8px;color:var(--red);cursor:pointer;font-size:11px">Elimina</button>' +
        '</div></div></div>'
      ).join('');
  container.innerHTML =
    '<div class="tariffa-card" style="margin-bottom:16px"><div class="tariffa-card-header"><span>&#x1F464; Aggiungi operatore</span></div>' +
    '<div class="tariffa-fields"><div class="tariffa-row"><div class="tariffa-field"><label>Nome operatore</label>' +
    '<input class="wz-input" id="inv-nome" placeholder="Es. Mario Rossi"></div></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Verrà generato un PIN a 6 cifre da comunicare al dipendente.</div>' +
    '<button class="wz-btn-primary" style="margin-top:8px" onclick="aggiungiOperatore()">+ Aggiungi operatore</button>' +
    '<div class="tariffa-msg" id="msg-invito"></div></div></div>' +
    '<div class="section-label" style="margin-bottom:12px">Operatori (' + lista.length + ')</div>' + listaHtml;
}

async function aggiungiOperatore() {
  const nome = document.getElementById('inv-nome')?.value?.trim();
  const msg = document.getElementById('msg-invito');
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!nome) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Inserisci il nome.'; } return; }
  const pin = generaPIN();
  const { error } = await sbClient.from('operatori').insert({ account_id: accountId, nome, pin, attivo: true });
  if (error) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Errore.'; } return; }
  if (msg) { msg.style.color = 'var(--green)'; msg.textContent = 'Operatore aggiunto! PIN: ' + pin; document.getElementById('inv-nome').value = ''; setTimeout(() => { msg.textContent = ''; renderOperatori(); }, 6000); }
}

async function rigeneraPIN(opId) {
  const nuovoPin = generaPIN();
  const { error } = await sbClient.from('operatori').update({ pin: nuovoPin, pin_tentativi: 0, pin_bloccato_fino: null }).eq('id', opId);
  if (!error) { alert('Nuovo PIN: ' + nuovoPin + '\nComunicalo al dipendente.'); await renderOperatori(); }
}

async function toggleOperatore(opId, attivoCorrente) {
  await sbClient.from('operatori').update({ attivo: !attivoCorrente }).eq('id', opId);
  await renderOperatori();
}

async function eliminaOperatore(opId) {
  if (!confirm('Eliminare questo operatore?')) return;
  await sbClient.from('operatori').delete().eq('id', opId);
  await renderOperatori();
}

// ── TURNI ─────────────────────────────────────────────────────

async function renderTurni() {
  const container = document.getElementById('turni-container');
  if (!container) return;
  const oggi = new Date().toISOString().split('T')[0];
  const accountId = localStorage.getItem('charlotte_account_id');
  const { data: operatori } = await sbClient.from('operatori').select('id, nome').eq('account_id', accountId).eq('attivo', true).order('nome');
  const opzioniOperatori = (operatori || []).map(o => '<option value="' + o.nome + '">' + o.nome + '</option>').join('');
  const opzioniGarage = ownerGarageList.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('');
  const now = new Date();
  const dataOra = now.toISOString().slice(0, 16);
  container.innerHTML =
    '<div class="tariffa-card" style="margin-bottom:16px"><div class="tariffa-card-header"><span>&#x2795; Inserimento manuale timbratura</span></div>' +
    '<div class="tariffa-fields"><div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Operatore</label><select class="wz-input" id="ins-operatore"><option value="">Seleziona...</option>' + opzioniOperatori + '</select></div>' +
    '<div class="tariffa-field"><label>Garage</label><select class="wz-input" id="ins-garage"><option value="">Seleziona...</option>' + opzioniGarage + '</select></div>' +
    '</div><div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Tipo</label><select class="wz-input" id="ins-tipo"><option value="entrata">&#x1F7E2; Entrata</option><option value="uscita">&#x1F534; Uscita</option></select></div>' +
    '<div class="tariffa-field"><label>Data e ora</label><input class="wz-input" id="ins-dataora" type="datetime-local" value="' + dataOra + '"></div>' +
    '</div><button class="wz-btn-primary" style="margin-top:8px" onclick="inserisciTimbraturaManuale()">Inserisci timbratura</button>' +
    '<div class="tariffa-msg" id="msg-ins-turno"></div></div></div>' +
    '<div class="tariffa-card" style="margin-bottom:16px"><div class="tariffa-card-header"><span>&#x1F50D; Cerca timbrature</span></div>' +
    '<div class="tariffa-fields"><div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Nome operatore</label><input class="wz-input" id="turni-nome" placeholder="Anche parziale"></div>' +
    '<div class="tariffa-field"><label>Data</label><input class="wz-input" id="turni-data" type="date" value="' + oggi + '"></div>' +
    '</div><button class="wz-btn-primary" style="margin-top:8px" onclick="cercaTurni()">Cerca</button>' +
    '</div></div><div id="turni-risultati"></div>';
}

async function inserisciTimbraturaManuale() {
  const nomeOp = document.getElementById('ins-operatore')?.value;
  const garageId = document.getElementById('ins-garage')?.value;
  const tipo = document.getElementById('ins-tipo')?.value;
  const dataOra = document.getElementById('ins-dataora')?.value;
  const msg = document.getElementById('msg-ins-turno');
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!nomeOp || !garageId || !tipo || !dataOra) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Compila tutti i campi.'; } return; }
  const { error } = await sbClient.from('turni').insert({ garage_id: garageId, account_id: accountId, operatore_nome: nomeOp, tipo, lat: null, lng: null, distanza_metri: null, timbrato_at: new Date(dataOra).toISOString() });
  if (error) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Errore: ' + error.message; } return; }
  if (msg) { msg.style.color = 'var(--green)'; msg.textContent = '&#x2713; Timbratura inserita per ' + nomeOp + '.'; setTimeout(() => { msg.textContent = ''; }, 3000); }
}

async function cercaTurni() {
  const nome = document.getElementById('turni-nome')?.value?.trim() || '';
  const data = document.getElementById('turni-data')?.value;
  const container = document.getElementById('turni-risultati');
  if (!container) return;
  container.innerHTML = '<div style="color:#7a9ab8;text-align:center;padding:20px">Ricerca in corso...</div>';
  const garageIds = ownerGarageList.map(g => g.id);
  let query = sbClient.from('turni').select('id, operatore_nome, tipo, timbrato_at, distanza_metri, garage_id')
    .in('garage_id', garageIds).gte('timbrato_at', data + 'T00:00:00').lte('timbrato_at', data + 'T23:59:59').order('timbrato_at', { ascending: true });
  if (nome) query = query.ilike('operatore_nome', '%' + nome + '%');
  const { data: turni, error } = await query;
  if (error || !turni || turni.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F550;</div><div class="empty-text">Nessuna timbratura trovata</div></div>'; return; }
  const perOperatore = {};
  turni.forEach(t => { if (!perOperatore[t.operatore_nome]) perOperatore[t.operatore_nome] = []; perOperatore[t.operatore_nome].push(t); });
  let html = '<div style="font-size:12px;color:#7a9ab8;margin-bottom:12px">' + turni.length + ' timbrature trovate</div>';
  for (const nomeOp in perOperatore) {
    const timbrature = perOperatore[nomeOp];
    html += '<div class="tariffa-card" style="margin-bottom:12px"><div class="tariffa-card-header"><span>&#x1F464; ' + nomeOp + '</span><span style="font-size:12px;color:#7a9ab8">' + timbrature.length + ' timbrature</span></div><div class="tariffa-fields">';
    timbrature.forEach(t => {
      const garage = ownerGarageList.find(g => g.id === t.garage_id);
      const ora = new Date(t.timbrato_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const tipoColore = t.tipo === 'entrata' ? '#4caf80' : '#e06060';
      const tipoLabel = t.tipo === 'entrata' ? '&#x1F7E2; ENTRATA' : '&#x1F534; USCITA';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a4060"><div>' +
        '<span style="font-weight:700;color:' + tipoColore + '">' + tipoLabel + '</span>' +
        '<div style="font-size:11px;color:#7a9ab8;margin-top:2px">' + (garage?.name || 'Garage') + (t.distanza_metri ? ' · ' + t.distanza_metri + 'm dal garage' : '') + '</div>' +
        '</div><span style="font-family:Share Tech Mono,monospace;font-size:16px;color:#e8f0f8">' + ora + '</span></div>';
    });
    const entrate = timbrature.filter(t => t.tipo === 'entrata');
    const uscite = timbrature.filter(t => t.tipo === 'uscita');
    if (entrate.length > 0 && uscite.length > 0) {
      const minuti = Math.floor((new Date(uscite[uscite.length-1].timbrato_at) - new Date(entrate[0].timbrato_at)) / 60000);
      html += '<div style="padding:8px 0;text-align:right;color:#d4a843;font-weight:700">Totale: ' + Math.floor(minuti/60) + 'h ' + (minuti%60) + 'm</div>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

// ── PRENOTAZIONI ──────────────────────────────────────────────

async function renderPrenotazioni() {
  const container = document.getElementById('prenotazioni-container');
  if (!container) return;
  const baseUrl = window.location.origin + '/charlotte-commercial/prenota.html';
  let linksHtml = '<div class="tariffa-card" style="margin-bottom:16px"><div class="tariffa-card-header"><span>&#x1F517; Link prenotazione per garage</span></div><div class="tariffa-fields">';
  ownerGarageList.forEach(g => {
    const link = baseUrl + '?garage=' + g.id;
    linksHtml += '<div style="margin-bottom:12px">' +
      '<div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:6px">&#x1F3E2; ' + g.name + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input class="wz-input" value="' + link + '" readonly style="font-size:11px;font-family:Share Tech Mono,monospace;color:var(--muted);flex:1">' +
      '<button onclick="copiaLink(&quot;' + link + '&quot;)" style="background:var(--accent);border:none;border-radius:8px;padding:8px 12px;color:white;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;white-space:nowrap">Copia</button>' +
      '<a href="' + link + '" target="_blank" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--muted);text-decoration:none;font-size:13px">Anteprima</a>' +
      '</div></div>';
  });
  linksHtml += '</div></div>';
  const garageIds = ownerGarageList.map(g => g.id);
  const { data: prenotazioni } = await sbClient.from('prenotazioni').select('*').in('garage_id', garageIds).order('created_at', { ascending: false }).limit(50);
  const lista = prenotazioni || [];
  const inAttesa = lista.filter(p => p.stato === 'in_attesa');
  const confermate = lista.filter(p => p.stato === 'confermata');
  const rifiutate = lista.filter(p => p.stato === 'rifiutata');
  let prenotHtml = '<div class="section-label" style="margin-bottom:12px">Prenotazioni ricevute (' + lista.length + ')</div>';
  if (lista.length === 0) {
    prenotHtml += '<div class="empty-state"><div class="empty-icon">&#x1F4C5;</div><div class="empty-text">Nessuna prenotazione ancora.</div></div>';
  } else {
    if (inAttesa.length > 0) { prenotHtml += '<div style="font-size:11px;color:var(--amber);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">&#x23F3; In attesa (' + inAttesa.length + ')</div>'; inAttesa.forEach(p => { prenotHtml += cardPrenotazione(p); }); }
    if (confermate.length > 0) { prenotHtml += '<div style="font-size:11px;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">&#x2713; Confermate (' + confermate.length + ')</div>'; confermate.forEach(p => { prenotHtml += cardPrenotazione(p); }); }
    if (rifiutate.length > 0) { prenotHtml += '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">&#x2715; Rifiutate (' + rifiutate.length + ')</div>'; rifiutate.forEach(p => { prenotHtml += cardPrenotazione(p); }); }
  }
  container.innerHTML = linksHtml + prenotHtml;
}

function cardPrenotazione(p) {
  const garage = ownerGarageList.find(g => g.id === p.garage_id);
  const dataI = new Date(p.data_ingresso).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const dataU = new Date(p.data_uscita).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const statoColore = p.stato === 'in_attesa' ? 'var(--amber)' : p.stato === 'confermata' ? 'var(--green)' : 'var(--muted)';
  return '<div class="tariffa-card" style="margin-bottom:8px"><div class="tariffa-card-header" style="padding:10px 14px">' +
    '<div><div style="font-size:15px;font-weight:700;color:var(--text)">' + p.nome_cliente + '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (garage?.name || '') + (p.targa ? ' · ' + p.targa : '') + (p.categoria ? ' · ' + p.categoria : '') + '</div></div>' +
    '<span style="font-size:11px;font-family:Share Tech Mono,monospace;color:' + statoColore + '">' + p.stato.toUpperCase() + '</span></div>' +
    '<div style="padding:10px 14px"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">&#x1F4C5; ' + dataI + ' &#x2192; ' + dataU + '</div>' +
    (p.importo_preventivo ? '<div style="font-size:13px;color:var(--green);margin-bottom:6px">Preventivo: &#x20AC;' + parseFloat(p.importo_preventivo).toFixed(2) + '</div>' : '') +
    (p.note ? '<div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-style:italic">' + p.note + '</div>' : '') +
    (p.stato === 'in_attesa' ?
      '<div style="display:flex;gap:8px">' +
      '<button onclick="aggiornaPrenotazione(&quot;' + p.id + '&quot;, &quot;confermata&quot;)" style="flex:1;background:var(--green);border:none;border-radius:8px;padding:8px;color:white;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px">&#x2713; Conferma</button>' +
      '<button onclick="aggiornaPrenotazione(&quot;' + p.id + '&quot;, &quot;rifiutata&quot;)" style="flex:1;background:none;border:1px solid var(--red);border-radius:8px;padding:8px;color:var(--red);cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px">&#x2715; Rifiuta</button>' +
      '</div>' : '') +
    '</div></div>';
}

async function aggiornaPrenotazione(prenotazioneId, nuovoStato) {
  const { error } = await sbClient.from('prenotazioni').update({ stato: nuovoStato }).eq('id', prenotazioneId);
  if (!error) await renderPrenotazioni();
}

function copiaLink(link) {
  navigator.clipboard.writeText(link).then(() => { alert('Link copiato!'); }).catch(() => { prompt('Copia questo link:', link); });
}

function cambiaStatoPren(btn) { aggiornaPrenotazione(btn.getAttribute('data-id'), btn.getAttribute('data-stato')); }
