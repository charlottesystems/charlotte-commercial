// ============================================================
// CHARLOTTE COMMERCIAL — app.js
// Ingresso, uscita, lista soste, OCR targa, ricerca
// ============================================================

let garageCorrente = null;
let garageList = [];
let targaCorrente = '';
let tipoVeicoloCorrente = '';
let convenzionCorrente = null;
let categoriaCorrente = null;

// ── INIT APP ─────────────────────────────────────────────────

async function inizializzaApp() {
  aggiornaOrologio();
  setInterval(aggiornaOrologio, 1000);
  await caricaGarages();
  await aggiornaStatistiche();
}

function aggiornaOrologio() {
  const ora = new Date();
  const hh = String(ora.getHours()).padStart(2, '0');
  const mm = String(ora.getMinutes()).padStart(2, '0');
  const ss = String(ora.getSeconds()).padStart(2, '0');
  const el = document.getElementById('clock');
  if (el) el.textContent = `${hh}:${mm}:${ss}`;

  const giorni = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
  const mesi = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  const elData = document.getElementById('clock-date');
  if (elData) elData.textContent = `${giorni[ora.getDay()]} ${ora.getDate()} ${mesi[ora.getMonth()]} ${ora.getFullYear()}`;
}

// ── GARAGES ──────────────────────────────────────────────────

async function caricaGarages() {
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!accountId) return;

  const { data, error } = await sbClient
    .from('garages')
    .select('id, name, address')
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
      await aggiornaStatistiche();
    });
  }
}

// ── STATISTICHE ───────────────────────────────────────────────

async function aggiornaStatistiche() {
  if (!garageCorrente) return;

  const oggi = new Date().toISOString().split('T')[0];

  const { data: attive } = await sbClient
    .from('soste')
    .select('id')
    .eq('garage_id', garageCorrente.id)
    .is('uscita_at', null);

  const { data: oggi_soste } = await sbClient
    .from('soste')
    .select('id')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', `${oggi}T00:00:00`);

  const elAttive = document.getElementById('stat-attive');
  const elOggi = document.getElementById('stat-oggi');
  if (elAttive) elAttive.textContent = attive?.length || 0;
  if (elOggi) elOggi.textContent = oggi_soste?.length || 0;
}

// ── NAVIGAZIONE SCHERMATE ─────────────────────────────────────

function mostraSchermata(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Mostra/nascondi header
  const header = document.getElementById('main-header');
  if (header) {
    const senzaHeader = ['login-screen', 'pin-screen', 'onboarding-screen'];
    header.style.display = senzaHeader.includes(id) ? 'none' : 'flex';
  }
}

function tornaHome() {
  mostraSchermata('main-screen');
  resetIngresso();
}

// ── INGRESSO ─────────────────────────────────────────────────

function apriIngresso() {
  resetIngresso();
  mostraSchermata('ingresso-screen');
}

function resetIngresso() {
  targaCorrente = '';
  tipoVeicoloCorrente = '';
  convenzionCorrente = null;
  categoriaCorrente = null;

  const display = document.getElementById('targa-display');
  const val = document.getElementById('targa-value');
  const placeholder = document.getElementById('targa-placeholder');
  if (display) display.classList.remove('has-targa');
  if (val) val.textContent = '';
  if (placeholder) placeholder.style.display = 'block';

  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.conv-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));

  const convSection = document.getElementById('conv-cat-section');
  if (convSection) convSection.style.display = 'none';

  aggiornaBottoneConferma();
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
  tipoVeicoloCorrente = tipo;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  aggiornaBottoneConferma();
}

function selezionaConvenzione(convId, nome, el) {
  if (convenzionCorrente === convId) {
    convenzionCorrente = null;
    categoriaCorrente = null;
    el.classList.remove('selected');
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    const catRow = document.getElementById('cat-row');
    if (catRow) catRow.style.display = 'none';
  } else {
    convenzionCorrente = convId;
    document.querySelectorAll('.conv-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    // mostra categorie se esistono
    caricaCategorie(convId);
  }
  aggiornaBottoneConferma();
}

async function caricaCategorie(convId) {
  const { data } = await sbClient
    .from('tariffe_convenzioni')
    .select('categoria')
    .eq('convenzione_id', convId);

  const catRow = document.getElementById('cat-row');
  if (!catRow) return;

  if (data && data.length > 1) {
    const cats = [...new Set(data.map(r => r.categoria).filter(Boolean))];
    catRow.innerHTML = cats.map(c =>
      `<button class="cat-btn" onclick="selezionaCategoria('${c}', this)">${c}</button>`
    ).join('');
    catRow.style.display = 'grid';
  } else {
    catRow.style.display = 'none';
    categoriaCorrente = data?.[0]?.categoria || null;
  }
}

function selezionaCategoria(cat, el) {
  categoriaCorrente = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  aggiornaBottoneConferma();
}

function aggiornaBottoneConferma() {
  const btn = document.getElementById('conferma-ingresso-btn');
  if (!btn) return;
  const pronto = targaCorrente && tipoVeicoloCorrente;
  btn.classList.toggle('enabled', !!pronto);
}

async function confermaIngresso() {
  if (!targaCorrente || !tipoVeicoloCorrente || !garageCorrente) return;

  const ora = new Date().toISOString();

  const { error } = await sbClient.from('soste').insert({
    garage_id: garageCorrente.id,
    targa: targaCorrente,
    tipo_veicolo: tipoVeicoloCorrente,
    convenzione_id: convenzionCorrente || null,
    categoria: categoriaCorrente || null,
    ingresso_at: ora,
    uscita_at: null
  });

  if (error) {
    alert('Errore nel registrare l\'ingresso. Riprova.');
    return;
  }

  // Mostra overlay conferma
  const ol = document.getElementById('overlay-ingresso');
  const olTarga = document.getElementById('overlay-targa');
  if (ol) ol.classList.add('show');
  if (olTarga) olTarga.textContent = targaCorrente;

  await aggiornaStatistiche();
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
    .select('id, targa, tipo_veicolo, ingresso_at, convenzione_id, categoria')
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
    return `
      <div class="sosta-card attiva">
        <div class="sosta-info">
          <div class="sosta-targa">${s.targa}</div>
          <div class="sosta-tipo">${s.tipo_veicolo}${s.convenzione_id ? ' · CONV.' : ''}</div>
        </div>
        <div>
          <div class="sosta-time">⏱ ${oraIngresso}</div>
          <div class="sosta-duration">${durata}</div>
        </div>
        <button class="uscita-quick-btn" onclick="confermaUscita('${s.id}','${s.targa}','${s.ingresso_at}')">USCITA</button>
      </div>`;
  }).join('');
}

async function confermaUscita(sostaId, targa, ingressoAt) {
  const ora = new Date().toISOString();

  const { error } = await sbClient
    .from('soste')
    .update({ uscita_at: ora })
    .eq('id', sostaId);

  if (error) {
    alert('Errore nel registrare l\'uscita. Riprova.');
    return;
  }

  await aggiornaStatistiche();
  await caricaSosteAttive();
}

// ── LISTA SOSTE ───────────────────────────────────────────────

async function apriLista() {
  mostraSchermata('lista-screen');
  await caricaListaSoste();
}

async function caricaListaSoste() {
  if (!garageCorrente) return;

  const { data } = await sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, convenzione_id')
    .eq('garage_id', garageCorrente.id)
    .order('ingresso_at', { ascending: false })
    .limit(50);

  const container = document.getElementById('lista-soste-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Nessuna sosta registrata</div></div>';
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
    html += `<div class="section-label" style="margin-top:16px">Uscite oggi</div>`;
    html += chiuse.map(s => cardSosta(s, false)).join('');
  }

  container.innerHTML = html;
}

function cardSosta(s, attiva) {
  const oraIngresso = new Date(s.ingresso_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const durata = attiva ? calcolaDurata(s.ingresso_at) : calcolaDurata(s.ingresso_at, s.uscita_at);
  return `
    <div class="sosta-card ${attiva ? 'attiva' : 'chiusa'}">
      <div class="sosta-info">
        <div class="sosta-targa">${s.targa}</div>
        <div class="sosta-tipo">${s.tipo_veicolo}${s.convenzione_id ? ' · CONV.' : ''}</div>
      </div>
      <div>
        <div class="sosta-time">${attiva ? '⏱' : '✓'} ${oraIngresso}</div>
        <div class="sosta-duration">${durata}</div>
      </div>
      ${attiva ? `<button class="uscita-quick-btn" onclick="confermaUscita('${s.id}','${s.targa}','${s.ingresso_at}')">USCITA</button>` : ''}
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
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, convenzione_id')
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

function apriCamera() {
  document.getElementById('camera-input')?.click();
}

function apriGalleria() {
  document.getElementById('gallery-input')?.click();
}

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
      const targa = results[0].plate.toUpperCase();
      const confidence = Math.round((results[0].score || 0) * 100);
      mostraOverlayOCR(targa, confidence);
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
  const overlay = document.getElementById('ocr-overlay');
  if (overlay) overlay.classList.remove('show');
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
