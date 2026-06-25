// ============================================================
// CHARLOTTE COMMERCIAL — app.js
// Ingresso, uscita, lista soste, OCR targa, ricerca
// ============================================================

let garageCorrente = null;
let garageList = [];
let targaCorrente = '';
let categoriaCorrente = '';
let convenzionCorrente = null;
let tariffeGarage = [];
let convenzioniGarage = [];

// ── INIT APP ─────────────────────────────────────────────────

async function inizializzaApp() {
  aggiornaOrologio();
  setInterval(aggiornaOrologio, 1000);
  await caricaGarages();
  await aggiornaStatistiche();
}

function getLang() {
  return localStorage.getItem('charlotte_lang') || 'it';
}

function aggiornaOrologio() {
  const ora = new Date();
  const hh = String(ora.getHours()).padStart(2, '0');
  const mm = String(ora.getMinutes()).padStart(2, '0');
  const ss = String(ora.getSeconds()).padStart(2, '0');
  const el = document.getElementById('clock');
  if (el) el.textContent = `${hh}:${mm}:${ss}`;

  const giorni = ['DOM','LUN','MAR','MER','GIO','VEN','SAB'];
  const mesi = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'];
  const elData = document.getElementById('clock-date');
  if (elData) elData.textContent = `${giorni[ora.getDay()]} ${ora.getDate()} ${mesi[ora.getMonth()]} ${ora.getFullYear()}`;
}

// ── GARAGES ──────────────────────────────────────────────────

async function caricaGarages() {
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!accountId) return;

  const { data, error } = await sbClient
    .from('garages')
    .select('id, name, address, lat, lng, raggio_metri')
    .eq('account_id', accountId)
    .eq('active', true)
    .order('name');

  if (error || !data || data.length === 0) return;

  garageList = data;
  garageCorrente = data[0];

  const sel = document.getElementById('garage-select');
  if (sel) {
    sel.innerHTML = data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    sel.addEventListener('change', async () => {
      garageCorrente = garageList.find(g => g.id === sel.value);
      await caricaTariffeEConvenzioni();
      await aggiornaStatistiche();
    });
  }

  await caricaTariffeEConvenzioni();
}

async function caricaTariffeEConvenzioni() {
  if (!garageCorrente) return;
  tariffeGarage = await caricaTariffeGarage(garageCorrente.id);
  convenzioniGarage = await caricaConvenzioniGarage(garageCorrente.id);
}

// ── STATISTICHE ───────────────────────────────────────────────

async function aggiornaStatistiche() {
  if (!garageCorrente) return;

  const oggi = new Date().toISOString().split('T')[0];
  const meseInizio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: attive } = await sbClient
    .from('soste').select('id')
    .eq('garage_id', garageCorrente.id)
    .is('uscita_at', null);

  const { data: oggiSoste } = await sbClient
    .from('soste').select('id')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', `${oggi}T00:00:00`);

  const { data: meseSoste } = await sbClient
    .from('soste').select('id')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', meseInizio);

  const elAttive = document.getElementById('stat-attive');
  const elOggi = document.getElementById('stat-oggi');
  const elMese = document.getElementById('stat-mese');
  if (elAttive) elAttive.textContent = attive?.length || 0;
  if (elOggi) elOggi.textContent = oggiSoste?.length || 0;
  if (elMese) elMese.textContent = meseSoste?.length || 0;
}

// ── NAVIGAZIONE ───────────────────────────────────────────────

function mostraSchermata(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  const header = document.getElementById('main-header');
  if (header) {
    const senzaHeader = ['login-screen','pin-screen','onboarding-screen'];
    header.style.display = senzaHeader.includes(id) ? 'none' : 'flex';
  }
  // Applica traduzioni dopo cambio schermata
  setTimeout(() => { if (typeof applicaTraduzioni === 'function') applicaTraduzioni(); }, 50);
}

function tornaHome() {
  mostraSchermata('main-screen');
  resetIngresso();
}

// ── INGRESSO ─────────────────────────────────────────────────

async function apriIngresso() {
  resetIngresso();
  mostraSchermata('ingresso-screen');
  await caricaTariffeEConvenzioni();
  renderCategorie();
  renderConvenzioniIngresso();
  setTimeout(() => {
    renderCategorie();
    renderConvenzioniIngresso();
  }, 500);
}

function resetIngresso() {
  targaCorrente = '';
  categoriaCorrente = '';
  convenzionCorrente = null;

  const display = document.getElementById('targa-display');
  const val = document.getElementById('targa-value');
  const placeholder = document.getElementById('targa-placeholder');
  if (display) display.classList.remove('has-targa');
  if (val) val.textContent = '';
  if (placeholder) placeholder.style.display = 'block';

  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.conv-btn').forEach(b => b.classList.remove('selected'));

  aggiornaBottoneConferma();
}

function renderCategorie() {
  const grid = document.getElementById('tipo-grid');
  if (!grid) return;

  const categorieAttive = tariffeGarage.length > 0
    ? CATEGORIE.filter(cat => tariffeGarage.some(t => t.categoria === cat.id))
    : CATEGORIE;

  if (categorieAttive.length === 0) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px;text-align:center;grid-column:1/-1">
      Nessuna tariffa configurata.<br>
      <a href="owner.html" style="color:var(--accent3)">Vai al pannello Owner →</a>
    </div>`;
    return;
  }

  grid.innerHTML = categorieAttive.map(cat => `
    <div class="tipo-btn" onclick="selezionaTipo('${cat.id}', this)">
      <span class="tipo-icon">${cat.icon}</span>
      ${cat.label}
    </div>`).join('');
}

function renderConvenzioniIngresso() {
  const section = document.getElementById('conv-section');
  const grid = document.getElementById('conv-grid');
  if (!grid) return;

  if (convenzioniGarage.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = 'block';
  grid.innerHTML = convenzioniGarage.map(c => `
    <div class="conv-btn" onclick="selezionaConvenzione('${c.id}', this)">
      <span class="conv-icon">🤝</span>
      ${c.nome}
    </div>`).join('');
}

function impostaTarga(targa) {
  targaCorrente = targa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const display = document.getElementById('targa-display');
  const val = document.getElementById('targa-value');
  const placeholder = document.getElementById('targa-placeholder');

  if (targaCorrente) {
    if (display) display.classList.add('has-targa');
    if (val) val.textContent = targaCorrente;
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (display) display.classList.remove('has-targa');
    if (val) val.textContent = '';
    if (placeholder) placeholder.style.display = 'block';
  }
  aggiornaBottoneConferma();
}

function confermaTArgaManuale() {
  const input = document.getElementById('manual-targa-input');
  if (input && input.value.trim()) {
    impostaTarga(input.value.trim());
    input.value = '';
  }
}

function selezionaTipo(tipo, el) {
  categoriaCorrente = tipo;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  aggiornaBottoneConferma();
}

function selezionaConvenzione(convId, el) {
  if (convenzionCorrente?.id === convId) {
    convenzionCorrente = null;
    el.classList.remove('selected');
  } else {
    convenzionCorrente = convenzioniGarage.find(c => c.id === convId);
    document.querySelectorAll('.conv-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }
  aggiornaBottoneConferma();
}

function aggiornaBottoneConferma() {
  const btn = document.getElementById('conferma-ingresso-btn');
  if (!btn) return;
  btn.classList.toggle('enabled', !!(targaCorrente && categoriaCorrente));
}

async function confermaIngresso() {
  if (!targaCorrente || !categoriaCorrente || !garageCorrente) return;

  const opId = currentUser?.id || null;
  const opNome = localStorage.getItem('charlotte_operatore_nome') || localStorage.getItem('charlotte_company') || 'Owner';

  const { error } = await sbClient.from('soste').insert({
    garage_id: garageCorrente.id,
    targa: targaCorrente,
    tipo_veicolo: categoriaCorrente,
    convenzione_id: convenzionCorrente?.id || null,
    ingresso_at: new Date().toISOString(),
    uscita_at: null,
    operatore_ingresso_id: opId,
    operatore_ingresso_nome: opNome
  });

  if (error) { alert('Errore nel registrare l\'ingresso. Riprova.'); return; }

  const ol = document.getElementById('overlay-ingresso');
  const olTarga = document.getElementById('overlay-targa');
  const olTime = document.getElementById('overlay-time');
  if (ol) ol.classList.add('show');
  if (olTarga) olTarga.textContent = targaCorrente;
  if (olTime) {
    const cat = CATEGORIE.find(c => c.id === categoriaCorrente);
    olTime.textContent = `${cat?.icon || ''} ${cat?.label || categoriaCorrente}${convenzionCorrente ? ' · Conv. ' + convenzionCorrente.nome : ''}`;
  }

  await aggiornaStatistiche();

  // Stampa ticket ingresso - chiede conferma
  try {
    const { data: sostaStampata } = await sbClient.from('soste')
      .select('*').eq('garage_id', garageCorrente.id).eq('targa', targaCorrente)
      .is('uscita_at', null).order('ingresso_at', { ascending: false }).limit(1).single();
    if (sostaStampata && confirm('Stampare il ticket di ingresso?')) {
      await stampaTicketIngresso(sostaStampata);
    }
  } catch(e) {}

  setTimeout(() => {
    if (ol) ol.classList.remove('show');
    tornaHome();
  }, 2000);
}

// ── USCITA ────────────────────────────────────────────────────

function apriUscita() {
  mostraSchermata('uscita-screen');
  caricaSosteAttive();
}

async function caricaSosteAttive() {
  if (!garageCorrente) return;

  const { data } = await sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, convenzione_id')
    .eq('garage_id', garageCorrente.id)
    .is('uscita_at', null)
    .order('ingresso_at', { ascending: true });

  const container = document.getElementById('soste-attive-list');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🅿️</div><div class="empty-text">Nessuna auto in sosta</div></div>';
    return;
  }

  container.innerHTML = data.map(s => {
    const durata = calcolaDurata(s.ingresso_at);
    const oraIngresso = new Date(s.ingresso_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
    const conv = convenzioniGarage.find(c => c.id === s.convenzione_id);
    return `
      <div class="sosta-card attiva">
        <div class="sosta-info">
          <div class="sosta-targa">${s.targa}</div>
          <div class="sosta-tipo">${cat?.icon || ''} ${cat?.label || s.tipo_veicolo}${conv ? ' · ' + conv.nome : ''}</div>
        </div>
        <div>
          <div class="sosta-time">⏱ ${oraIngresso}</div>
          <div class="sosta-duration">${durata}</div>
        </div>
        <button class="uscita-quick-btn"
                onclick="apriConfermaUscita('${s.id}','${s.targa}','${s.ingresso_at}','${s.tipo_veicolo}','${s.convenzione_id || ''}')">
          USCITA
        </button>
      </div>`;
  }).join('');
}

function apriConfermaUscita(sostaId, targa, ingressoAt, tipoVeicolo, convId) {
  const uscitaAt = new Date();
  const ingressoDate = new Date(ingressoAt);

  const tariffa = tariffeGarage.find(t => t.categoria === tipoVeicolo);
  const conv = convId ? convenzioniGarage.find(c => c.id === convId) : null;
  const { importo, dettaglio } = calcolaImporto(ingressoDate, uscitaAt, tipoVeicolo, conv, tariffa);

  const cat = CATEGORIE.find(c => c.id === tipoVeicolo);
  const durata = calcolaDurata(ingressoAt);

  const ol = document.getElementById('overlay-uscita');
  if (ol) {
    document.getElementById('uscita-targa').textContent = targa;
    document.getElementById('uscita-categoria').textContent = `${cat?.icon || ''} ${cat?.label || tipoVeicolo}`;
    document.getElementById('uscita-durata').textContent = durata;
    document.getElementById('uscita-importo').textContent = formatEuro(importo);
    document.getElementById('uscita-dettaglio').textContent = dettaglio;
    document.getElementById('uscita-conv').textContent = conv ? `Conv. ${conv.nome}` : '';
    ol.classList.add('show');
    ol.dataset.sostaId = sostaId;
    ol.dataset.importo = importo;
  } else {
    if (confirm(`${targa} — ${durata}\nImporto: ${formatEuro(importo)}\n\nConfermi l'uscita?`)) {
      confermaUscita(sostaId, importo);
    }
  }
}

async function confermaUscita(sostaId, importo) {
  const ol = document.getElementById('overlay-uscita');
  const id = sostaId || ol?.dataset?.sostaId;
  const imp = importo ?? parseFloat(ol?.dataset?.importo || 0);

  if (ol) ol.classList.remove('show');

  const opNomeUscita = localStorage.getItem('charlotte_operatore_nome') || localStorage.getItem('charlotte_company') || 'Owner';

  const { error } = await sbClient
    .from('soste')
    .update({
      uscita_at: new Date().toISOString(),
      importo: imp,
      operatore_uscita_id: currentUser?.id || null,
      operatore_uscita_nome: opNomeUscita
    })
    .eq('id', id);

  if (error) { alert('Errore nel registrare l\'uscita. Riprova.'); return; }

  await aggiornaStatistiche();
  await caricaSosteAttive();
}

function annullaUscita() {
  const ol = document.getElementById('overlay-uscita');
  if (ol) ol.classList.remove('show');
}

// ── LISTA SOSTE ───────────────────────────────────────────────

async function apriLista() {
  mostraSchermata('lista-screen');
  await caricaListaSoste();
}

async function caricaListaSoste() {
  if (!garageCorrente) return;

  const oggi = new Date().toISOString().split('T')[0];
  const { data } = await sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, convenzione_id, importo, operatore_ingresso_nome, operatore_uscita_nome')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', `${oggi}T00:00:00`)
    .order('ingresso_at', { ascending: false });

  const container = document.getElementById('lista-soste-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Nessuna sosta oggi</div></div>';
    return;
  }

  const attive = data.filter(s => !s.uscita_at);
  const chiuse = data.filter(s => s.uscita_at);
  let html = '';

  if (attive.length > 0) {
    html += `<div class="section-label">In sosta ora (${attive.length})</div>`;
    html += attive.map(s => cardSosta(s, true)).join('');
  }
  if (chiuse.length > 0) {
    html += `<div class="section-label" style="margin-top:16px">Uscite oggi (${chiuse.length})</div>`;
    html += chiuse.map(s => cardSosta(s, false)).join('');
  }

  container.innerHTML = html;
}

function cardSosta(s, attiva) {
  const oraIngresso = new Date(s.ingresso_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const durata = calcolaDurata(s.ingresso_at, s.uscita_at);
  const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
  const conv = convenzioniGarage.find(c => c.id === s.convenzione_id);
  const opIngresso = s.operatore_ingresso_nome ? `👤 ${s.operatore_ingresso_nome}` : '';
  const opUscita = s.operatore_uscita_nome ? ` → ${s.operatore_uscita_nome}` : '';
  return `
    <div class="sosta-card ${attiva ? 'attiva' : 'chiusa'}">
      <div class="sosta-info">
        <div class="sosta-targa">${s.targa}</div>
        <div class="sosta-tipo">${cat?.icon || ''} ${cat?.label || s.tipo_veicolo}${conv ? ' · ' + conv.nome : ''}</div>
        ${opIngresso ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${opIngresso}${opUscita}</div>` : ''}
      </div>
      <div>
        <div class="sosta-time">${attiva ? '⏱' : '✓'} ${oraIngresso}</div>
        <div class="sosta-duration">${durata}</div>
        ${!attiva && s.importo ? `<div class="sosta-time" style="color:var(--green)">${formatEuro(s.importo)}</div>` : ''}
      </div>
      ${attiva ? `<button class="uscita-quick-btn"
        onclick="apriConfermaUscita('${s.id}','${s.targa}','${s.ingresso_at}','${s.tipo_veicolo}','${s.convenzione_id || ''}')">
        USCITA</button>` : ''}
    </div>`;
}

// ── RICERCA ───────────────────────────────────────────────────

function apriRicerca() {
  mostraSchermata('ricerca-screen');
  const input = document.getElementById('search-targa-input');
  if (input) { input.value = ''; input.focus(); }
  const container = document.getElementById('ricerca-risultati');
  if (container) container.innerHTML = '';
}

async function eseguiRicerca() {
  const input = document.getElementById('search-targa-input');
  const query = (input?.value || '').trim().toUpperCase();
  const container = document.getElementById('ricerca-risultati');
  if (!container || !query || !garageCorrente) return;

  const { data } = await sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, convenzione_id, importo, operatore_ingresso_nome, operatore_uscita_nome')
    .eq('garage_id', garageCorrente.id)
    .ilike('targa', `%${query}%`)
    .order('ingresso_at', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Nessun risultato</div></div>';
    return;
  }

  container.innerHTML = data.map(s => cardSosta(s, !s.uscita_at)).join('');
}

// ── OCR TARGA ─────────────────────────────────────────────────

function apriCamera() { document.getElementById('camera-input')?.click(); }
function apriGalleria() { document.getElementById('gallery-input')?.click(); }

async function gestisciImmagineOCR(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('upload', file);
  formData.append('regions', 'it');

  try {
    const res = await fetch(PLATE_RECOGNIZER_URL, {
      method: 'POST',
      headers: { 'Authorization': `Token ${PLATE_RECOGNIZER_TOKEN}` },
      body: formData
    });
    const json = await res.json();
    const results = json.results || [];
    if (results.length > 0) {
      mostraOverlayOCR(results[0].plate.toUpperCase(), Math.round((results[0].score || 0) * 100));
    } else {
      alert('Targa non rilevata. Inseriscila manualmente.');
    }
  } catch (e) {
    alert('Errore OCR. Inserisci la targa manualmente.');
  }
}

function mostraOverlayOCR(targa, confidence) {
  const overlay = document.getElementById('ocr-overlay');
  const input = document.getElementById('ocr-targa-input');
  const conf = document.getElementById('ocr-confidence');
  if (overlay) overlay.classList.add('show');
  if (input) input.value = targa;
  if (conf) conf.textContent = `Confidenza: ${confidence}%`;
}

function confermaOCR() {
  const input = document.getElementById('ocr-targa-input');
  if (input) impostaTarga(input.value);
  chiudiOverlayOCR();
}

function chiudiOverlayOCR() {
  document.getElementById('ocr-overlay')?.classList.remove('show');
}

// ── UTILITY ───────────────────────────────────────────────────

function calcolaDurata(ingressoAt, uscitaAt = null) {
  const start = new Date(ingressoAt);
  const end = uscitaAt ? new Date(uscitaAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
