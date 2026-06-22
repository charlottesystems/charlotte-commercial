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
    .select('id, name')
    .eq('account_id', accountId)
    .eq('active', true)
    .order('name');

  if (!data || data.length === 0) return;

  ownerGarageList = data;
  ownerGarageId = data[0].id;

  const sel = document.getElementById('owner-garage-select');
  if (sel) {
    sel.innerHTML = data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
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
    s.style.display = s.id === `owner-${sezione}` ? 'block' : 'none';
  });
  if (sezione === 'tariffe') return renderTariffe();
  if (sezione === 'convenzioni') return renderConvenzioni();
  if (sezione === 'garages') return renderGarages();
  if (sezione === 'storico') return renderStorico();
  if (sezione === 'operatori') return renderOperatori();
}

// ── TARIFFE ──────────────────────────────────────────────────

async function renderTariffe() {
  const container = document.getElementById('tariffe-container');
  if (!container || !ownerGarageId) return;

  const { data } = await sbClient
    .from('tariffe')
    .select('*')
    .eq('garage_id', ownerGarageId);

  tariffeCorrente = data || [];

  container.innerHTML = CATEGORIE.map(cat => {
    const t = tariffeCorrente.find(r => r.categoria === cat.id) || {};
    return `
      <div class="tariffa-card" id="card-${cat.id}">
        <div class="tariffa-card-header">
          <span>${cat.icon} ${cat.label}</span>
          <span class="tariffa-badge ${t.id ? 'configured' : 'missing'}">
            ${t.id ? 'Configurata' : 'Non configurata'}
          </span>
        </div>
        <div class="tariffa-fields">
          <div class="tariffa-row">
            <div class="tariffa-field">
              <label>Prima ora (€)</label>
              <input type="number" step="0.01" min="0" class="wz-input"
                     id="t-${cat.id}-prima" value="${t.prezzo_prima_ora || ''}">
            </div>
            <div class="tariffa-field">
              <label>Ore successive (€)</label>
              <input type="number" step="0.01" min="0" class="wz-input"
                     id="t-${cat.id}-succ" value="${t.prezzo_ora_successiva || ''}">
            </div>
          </div>
          <div class="tariffa-row">
            <div class="tariffa-field">
              <label>Tariffa giornaliera (€)</label>
              <input type="number" step="0.01" min="0" class="wz-input"
                     id="t-${cat.id}-giorn" value="${t.prezzo_giornaliero || ''}">
            </div>
            <div class="tariffa-field">
              <label>Soglia giornaliero (ore)</label>
              <input type="number" step="1" min="1" max="23" class="wz-input"
                     id="t-${cat.id}-soglia" value="${t.soglia_giornaliero_ore || 4}">
            </div>
          </div>
          <div class="tariffa-row">
            <div class="tariffa-field">
              <label>Tolleranza fine giornaliero (min)</label>
              <input type="number" step="1" min="0" max="120" class="wz-input"
                     id="t-${cat.id}-toll" value="${t.tolleranza_minuti || 30}">
            </div>
            <div class="tariffa-field">
              <label>Tolleranza per ora (min)</label>
              <input type="number" step="1" min="0" max="59" class="wz-input"
                     id="t-${cat.id}-tollora" value="${t.tolleranza_ora_minuti ?? 10}">
            </div>
          </div>
          <button class="wz-btn-primary" style="margin-top:8px"
                  onclick="salvaTariffa('${cat.id}', '${t.id || ''}')">
            Salva ${cat.label}
          </button>
          <div class="tariffa-msg" id="msg-${cat.id}"></div>
        </div>
      </div>`;
  }).join('');
}

async function salvaTariffa(categoriaId, esistenteId) {
  const prima = parseFloat(document.getElementById('t-' + categoriaId + '-prima')?.value || 0);
  const succ = parseFloat(document.getElementById('t-' + categoriaId + '-succ')?.value || 0);
  const giorn = parseFloat(document.getElementById('t-' + categoriaId + '-giorn')?.value || 0);
  const soglia = parseInt(document.getElementById('t-' + categoriaId + '-soglia')?.value || 4);
  const toll = parseInt(document.getElementById('t-' + categoriaId + '-toll')?.value || 30);
  const tollOra = parseInt(document.getElementById('t-' + categoriaId + '-tollora')?.value || 10);
  const msg = document.getElementById('msg-' + categoriaId);

  const payload = {
    garage_id: ownerGarageId,
    categoria: categoriaId,
    prezzo_prima_ora: prima,
    prezzo_ora_successiva: succ,
    prezzo_giornaliero: giorn,
    soglia_giornaliero_ore: soglia,
    tolleranza_minuti: toll,
    tolleranza_ora_minuti: tollOra,
    updated_at: new Date().toISOString()
  };

  let error;
  if (esistenteId) {
    ({ error } = await sbClient.from('tariffe').update(payload).eq('id', esistenteId));
  } else {
    ({ error } = await sbClient.from('tariffe').insert(payload));
  }

  if (msg) {
    if (error) {
      msg.style.color = 'var(--red)';
      msg.textContent = 'Errore nel salvataggio.';
    } else {
      msg.style.color = 'var(--green)';
      msg.textContent = 'Salvato!';
      setTimeout(() => { msg.textContent = ''; renderTariffe(); }, 1500);
    }
  }
}

// ── CONVENZIONI ───────────────────────────────────────────────

async function renderConvenzioni() {
  const container = document.getElementById('convenzioni-container');
  if (!container || !ownerGarageId) return;

  const { data } = await sbClient
    .from('convenzioni')
    .select('*, tariffe_convenzioni(*)')
    .eq('garage_id', ownerGarageId)
    .order('nome');

  convenzioniCorrente = data || [];

  if (convenzioniCorrente.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤝</div>
        <div class="empty-text">Nessuna convenzione configurata</div>
      </div>
      <button class="wz-btn-primary" style="margin-top:16px" onclick="apriFormConvenzione()">
        + Nuova convenzione
      </button>`;
    return;
  }

  container.innerHTML = `
    <button class="wz-btn-primary" style="margin-bottom:16px" onclick="apriFormConvenzione()">
      + Nuova convenzione
    </button>
    ${convenzioniCorrente.map(c => cardConvenzione(c)).join('')}`;
}

function cardConvenzione(conv) {
  const tcs = conv.tariffe_convenzioni || [];
  return `
    <div class="tariffa-card">
      <div class="tariffa-card-header">
        <span>🤝 ${conv.nome}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="tariffa-badge ${conv.attiva ? 'configured' : 'missing'}">
            ${conv.attiva ? 'Attiva' : 'Disattiva'}
          </span>
          <button onclick="toggleConvenzione('${conv.id}', ${conv.attiva})"
                  style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--muted);cursor:pointer;font-size:11px">
            ${conv.attiva ? 'Disattiva' : 'Attiva'}
          </button>
          <button onclick="eliminaConvenzione('${conv.id}')"
                  style="background:none;border:1px solid var(--red);border-radius:6px;padding:4px 8px;color:var(--red);cursor:pointer;font-size:11px">
            Elimina
          </button>
        </div>
      </div>
      <div class="tariffa-fields">
        <div class="section-label" style="margin-bottom:8px">Tariffe per categoria (€/giorno)</div>
        ${CATEGORIE.map(cat => {
          const tc = tcs.find(t => t.categoria === cat.id) || {};
          return `
            <div class="tariffa-row" style="margin-bottom:8px;align-items:center">
              <span style="flex:1;font-size:13px;color:var(--text)">${cat.icon} ${cat.label}</span>
              <input type="number" step="0.01" min="0" class="wz-input"
                     style="width:100px;text-align:right"
                     id="tc-${conv.id}-${cat.id}"
                     value="${tc.prezzo_giornaliero || ''}"
                     placeholder="€">
            </div>`;
        }).join('')}
        <button class="wz-btn-primary" style="margin-top:8px"
                onclick="salvaConvenzione('${conv.id}')">
          Salva tariffe convenzione
        </button>
        <div class="tariffa-msg" id="msg-conv-${conv.id}"></div>
      </div>
    </div>`;
}

async function apriFormConvenzione() {
  const nome = prompt('Nome della convenzione (es. Hotel Bellavista):');
  if (!nome || !nome.trim()) return;

  const { error } = await sbClient.from('convenzioni').insert({
    garage_id: ownerGarageId,
    nome: nome.trim(),
    attiva: true
  });

  if (error) { alert('Errore nella creazione.'); return; }
  await renderConvenzioni();
}

async function salvaConvenzione(convId) {
  const msg = document.getElementById('msg-conv-' + convId);

  for (const cat of CATEGORIE) {
    const el = document.getElementById('tc-' + convId + '-' + cat.id);
    const val = parseFloat(el?.value || 0);
    if (val <= 0) continue;

    await sbClient.from('tariffe_convenzioni').upsert({
      convenzione_id: convId,
      categoria: cat.id,
      prezzo_giornaliero: val
    }, { onConflict: 'convenzione_id,categoria' });
  }

  if (msg) {
    msg.style.color = 'var(--green)';
    msg.textContent = 'Salvato!';
    setTimeout(() => { msg.textContent = ''; }, 1500);
  }
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

async function renderGarages() {
  const container = document.getElementById('garages-container');
  if (!container) return;

  const accountId = localStorage.getItem('charlotte_account_id');
  const { data } = await sbClient
    .from('garages')
    .select('*')
    .eq('account_id', accountId)
    .order('name');

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-text">Nessun garage</div></div>';
    return;
  }

  container.innerHTML = data.map(g => `
    <div class="tariffa-card">
      <div class="tariffa-card-header">
        <span>🏢 ${g.name}</span>
        <span class="tariffa-badge ${g.active ? 'configured' : 'missing'}">
          ${g.active ? 'Attivo' : 'Disattivo'}
        </span>
      </div>
      <div class="tariffa-fields">
        <div class="tariffa-row">
          <div class="tariffa-field">
            <label>Nome</label>
            <input class="wz-input" id="g-nome-${g.id}" value="${g.name}">
          </div>
          <div class="tariffa-field">
            <label>Indirizzo</label>
            <input class="wz-input" id="g-addr-${g.id}" value="${g.address || ''}">
          </div>
        </div>
        <div class="tariffa-row">
          <div class="tariffa-field">
            <label>Latitudine GPS</label>
            <input class="wz-input" id="g-lat-${g.id}" type="number" step="0.0000001"
                   placeholder="Es. 43.7696" value="${g.lat || ''}">
          </div>
          <div class="tariffa-field">
            <label>Longitudine GPS</label>
            <input class="wz-input" id="g-lng-${g.id}" type="number" step="0.0000001"
                   placeholder="Es. 11.2558" value="${g.lng || ''}">
          </div>
        </div>
        <div class="tariffa-row">
          <div class="tariffa-field">
            <label>Raggio badge (metri)</label>
            <input class="wz-input" id="g-raggio-${g.id}" type="number" min="10" max="500"
                   value="${g.raggio_metri || 100}">
          </div>
          <div class="tariffa-field" style="justify-content:flex-end">
            <label>&nbsp;</label>
            <button onclick="rilevaPosizioneGarage('${g.id}')"
                    style="background:var(--bg2);border:1px solid var(--accent);border-radius:8px;padding:10px;color:var(--accent3);cursor:pointer;font-size:12px">
              Usa posizione attuale
            </button>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="wz-btn-primary" style="flex:1"
                  onclick="salvaGarage('${g.id}')">Salva</button>
          <button class="wz-btn-secondary" style="flex:1"
                  onclick="toggleGarage('${g.id}', ${g.active})">
            ${g.active ? 'Disattiva' : 'Attiva'}
          </button>
        </div>
        <div class="tariffa-msg" id="msg-g-${g.id}"></div>
      </div>
    </div>`).join('') + `
    <button class="wz-btn-primary" style="margin-top:8px" onclick="aggiungiGarage()">
      + Aggiungi garage
    </button>`;
}

async function salvaGarage(garageId) {
  const nome = document.getElementById('g-nome-' + garageId)?.value?.trim();
  const addr = document.getElementById('g-addr-' + garageId)?.value?.trim();
  const lat = parseFloat(document.getElementById('g-lat-' + garageId)?.value) || null;
  const lng = parseFloat(document.getElementById('g-lng-' + garageId)?.value) || null;
  const raggio = parseInt(document.getElementById('g-raggio-' + garageId)?.value) || 100;
  const msg = document.getElementById('msg-g-' + garageId);

  const { error } = await sbClient.from('garages')
    .update({ name: nome, address: addr, lat: lat, lng: lng, raggio_metri: raggio })
    .eq('id', garageId);

  if (msg) {
    msg.style.color = error ? 'var(--red)' : 'var(--green)';
    msg.textContent = error ? 'Errore.' : 'Salvato!';
    setTimeout(() => { msg.textContent = ''; caricaGaragesOwner(); }, 1500);
  }
}

async function rilevaPosizioneGarage(garageId) {
  const msg = document.getElementById('msg-g-' + garageId);
  if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = 'Rilevamento GPS...'; }

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 0
      });
    });
    document.getElementById('g-lat-' + garageId).value = pos.coords.latitude.toFixed(7);
    document.getElementById('g-lng-' + garageId).value = pos.coords.longitude.toFixed(7);
    if (msg) { msg.style.color = 'var(--green)'; msg.textContent = 'Posizione rilevata. Salva per confermare.'; }
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

  const { error } = await sbClient.from('garages').insert({
    account_id: accountId,
    name: nome.trim(),
    address: addr.trim(),
    active: true
  });

  if (error) { alert('Errore nella creazione.'); return; }
  await caricaGaragesOwner();
  await renderGarages();
}

// ── STORICO ──────────────────────────────────────────────────

function renderStorico() {
  const container = document.getElementById('storico-container');
  if (!container) return;

  const oggi = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="tariffa-card" style="margin-bottom:16px">
      <div class="tariffa-fields">
        <div class="tariffa-row">
          <div class="tariffa-field">
            <label>Targa (anche parziale)</label>
            <input class="wz-input" id="storico-targa" placeholder="Es. FL13"
                   style="text-transform:uppercase"
                   oninput="this.value=this.value.toUpperCase()">
          </div>
          <div class="tariffa-field">
            <label>Data centrale</label>
            <input class="wz-input" id="storico-data" type="date" value="${oggi}">
          </div>
        </div>
        <div class="tariffa-row">
          <div class="tariffa-field">
            <label>Range giorni (+-)</label>
            <input class="wz-input" id="storico-range" type="number" min="1" max="365" value="10">
          </div>
          <div class="tariffa-field">
            <label>Garage</label>
            <select class="wz-input" id="storico-garage">
              <option value="">Tutti i garage</option>
              ${ownerGarageList.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('')}
            </select>
          </div>
        </div>
        <button class="wz-btn-primary" style="margin-top:8px" onclick="cercaStorico()">
          Cerca
        </button>
      </div>
    </div>
    <div id="storico-risultati"></div>`;
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
  const dataInizio = new Date(dataCentrale);
  dataInizio.setDate(dataInizio.getDate() - range);
  const dataFine = new Date(dataCentrale);
  dataFine.setDate(dataFine.getDate() + range);

  let query = sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, importo, convenzione_id, garage_id, operatore_ingresso_nome, operatore_uscita_nome')
    .gte('ingresso_at', dataInizio.toISOString())
    .lte('ingresso_at', dataFine.toISOString())
    .order('ingresso_at', { ascending: false })
    .limit(100);

  if (targa) query = query.ilike('targa', '%' + targa + '%');

  if (garageId) {
    query = query.eq('garage_id', garageId);
  } else {
    const garageIds = ownerGarageList.map(g => g.id);
    query = query.in('garage_id', garageIds);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Nessuna sosta trovata nel periodo selezionato</div></div>';
    return;
  }

  const perData = {};
  data.forEach(s => {
    const giorno = new Date(s.ingresso_at).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!perData[giorno]) perData[giorno] = [];
    perData[giorno].push(s);
  });

  let html = '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">' +
    data.length + ' soste trovate · dal ' + dataInizio.toLocaleDateString('it-IT') +
    ' al ' + dataFine.toLocaleDateString('it-IT') + '</div>';

  for (const giorno in perData) {
    const soste = perData[giorno];
    const totaleGiorno = soste.reduce((sum, s) => sum + (s.importo || 0), 0);
    html += '<div style="margin-bottom:4px;padding:8px 12px;background:rgba(124,58,237,0.1);border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--accent3);text-transform:capitalize">' + giorno + '</span>' +
      '<span style="font-family:Share Tech Mono,monospace;font-size:12px;color:var(--green)">' + soste.length + ' soste · ' + formatEuro(totaleGiorno) + '</span>' +
      '</div>';

    soste.forEach(s => {
      const garage = ownerGarageList.find(g => g.id === s.garage_id);
      const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
      const oraIngresso = new Date(s.ingresso_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const oraUscita = s.uscita_at ? new Date(s.uscita_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';
      const durata = s.uscita_at ? calcolaDurataStorico(s.ingresso_at, s.uscita_at) : 'In sosta';
      const opInfo = s.operatore_ingresso_nome ? ' · ' + s.operatore_ingresso_nome : '';

      html += '<div class="sosta-card ' + (s.uscita_at ? 'chiusa' : 'attiva') + '" style="margin-bottom:6px">' +
        '<div class="sosta-info">' +
        '<div class="sosta-targa">' + s.targa + '</div>' +
        '<div class="sosta-tipo">' + (cat ? cat.icon + ' ' + cat.label : s.tipo_veicolo) + (garage ? ' · ' + garage.name : '') + opInfo + '</div>' +
        '</div>' +
        '<div>' +
        '<div class="sosta-time">' + oraIngresso + ' → ' + oraUscita + '</div>' +
        '<div class="sosta-duration">' + durata + '</div>' +
        (s.importo ? '<div class="sosta-time" style="color:var(--green)">' + formatEuro(s.importo) + '</div>' : '') +
        '</div>' +
        '</div>';
    });
  }

  container.innerHTML = html;
}

function calcolaDurataStorico(ingressoAt, uscitaAt) {
  const diff = Math.floor((new Date(uscitaAt) - new Date(ingressoAt)) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// ── OPERATORI ─────────────────────────────────────────────────

async function renderOperatori() {
  const container = document.getElementById('operatori-container');
  if (!container) return;

  const accountId = localStorage.getItem('charlotte_account_id');
  const { data } = await sbClient
    .from('operatori')
    .select('*')
    .eq('account_id', accountId)
    .order('nome');

  const lista = data || [];

  let listaHtml = '';
  if (lista.length === 0) {
    listaHtml = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Nessun operatore ancora</div></div>';
  } else {
    lista.forEach(op => {
      listaHtml += '<div class="tariffa-card" style="margin-bottom:8px">' +
        '<div class="tariffa-card-header" style="padding:10px 16px">' +
        '<div>' +
        '<div style="font-size:15px">' + op.nome + '</div>' +
        '<div style="font-size:11px;color:var(--muted);font-family:Share Tech Mono,monospace">' + op.email + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<span class="tariffa-badge ' + (op.user_id ? 'configured' : 'missing') + '">' +
        (op.user_id ? 'Attivo' : 'In attesa') +
        '</span>' +
        '<button onclick="toggleOperatore(\'' + op.id + '\', ' + op.attivo + ')" ' +
        'style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--muted);cursor:pointer;font-size:11px">' +
        (op.attivo ? 'Disattiva' : 'Riattiva') +
        '</button>' +
        '<button onclick="eliminaOperatore(\'' + op.id + '\')" ' +
        'style="background:none;border:1px solid var(--red);border-radius:6px;padding:4px 8px;color:var(--red);cursor:pointer;font-size:11px">' +
        'Elimina</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    });
  }

  container.innerHTML = '<div class="tariffa-card" style="margin-bottom:16px">' +
    '<div class="tariffa-card-header"><span>Invita operatore</span></div>' +
    '<div class="tariffa-fields">' +
    '<div class="tariffa-row">' +
    '<div class="tariffa-field"><label>Nome</label>' +
    '<input class="wz-input" id="inv-nome" placeholder="Es. Mario Rossi"></div>' +
    '<div class="tariffa-field"><label>Email</label>' +
    '<input class="wz-input" id="inv-email" type="email" placeholder="mario@email.com"></div>' +
    '</div>' +
    '<button class="wz-btn-primary" style="margin-top:8px" onclick="invitaOperatore()">Invia invito</button>' +
    '<div class="tariffa-msg" id="msg-invito"></div>' +
    '</div></div>' +
    '<div class="section-label" style="margin-bottom:12px">Operatori (' + lista.length + ')</div>' +
    listaHtml;
}

async function invitaOperatore() {
  const nome = document.getElementById('inv-nome')?.value?.trim();
  const email = document.getElementById('inv-email')?.value?.trim();
  const msg = document.getElementById('msg-invito');
  const accountId = localStorage.getItem('charlotte_account_id');

  if (!nome || !email) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Inserisci nome e email.'; }
    return;
  }

  const { error } = await sbClient.from('operatori').insert({
    account_id: accountId,
    nome: nome,
    email: email,
    attivo: true
  });

  if (error) {
    if (msg) {
      msg.style.color = 'var(--red)';
      msg.textContent = error.code === '23505' ? 'Email gia presente.' : 'Errore nell invito.';
    }
    return;
  }

  await sbClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/charlotte-commercial/'
  });

  if (msg) {
    msg.style.color = 'var(--green)';
    msg.textContent = 'Invito inviato a ' + email + '. Ricevera un link per registrarsi.';
    document.getElementById('inv-nome').value = '';
    document.getElementById('inv-email').value = '';
    setTimeout(() => { msg.textContent = ''; renderOperatori(); }, 3000);
  }
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
