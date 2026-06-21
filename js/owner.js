// ============================================================
// CHARLOTTE COMMERCIAL — owner.js
// Pannello owner: gestione tariffe e convenzioni per garage
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

  // Mostra una card per ogni categoria
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
          </div>
          <button class="wz-btn-primary" style="margin-top:8px"
                  onclick="salvaTariffa('${cat.id}', '${t.id || ''}')">
            💾 Salva ${cat.label}
          </button>
          <div class="tariffa-msg" id="msg-${cat.id}"></div>
        </div>
      </div>`;
  }).join('');
}

async function salvaTariffa(categoriaId, esistenteId) {
  const prima = parseFloat(document.getElementById(`t-${categoriaId}-prima`)?.value || 0);
  const succ = parseFloat(document.getElementById(`t-${categoriaId}-succ`)?.value || 0);
  const giorn = parseFloat(document.getElementById(`t-${categoriaId}-giorn`)?.value || 0);
  const soglia = parseInt(document.getElementById(`t-${categoriaId}-soglia`)?.value || 4);
  const toll = parseInt(document.getElementById(`t-${categoriaId}-toll`)?.value || 30);
  const msg = document.getElementById(`msg-${categoriaId}`);

  const payload = {
    garage_id: ownerGarageId,
    categoria: categoriaId,
    prezzo_prima_ora: prima,
    prezzo_ora_successiva: succ,
    prezzo_giornaliero: giorn,
    soglia_giornaliero_ore: soglia,
    tolleranza_minuti: toll,
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
      msg.textContent = '✓ Salvato!';
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
          💾 Salva tariffe convenzione
        </button>
        <div class="tariffa-msg" id="msg-conv-${conv.id}"></div>
      </div>
    </div>`;
}

async function apriFormConvenzione() {
  const nome = prompt('Nome della convenzione (es. Hotel Bellavista):');
  if (!nome || !nome.trim()) return;

  const { data, error } = await sbClient.from('convenzioni').insert({
    garage_id: ownerGarageId,
    nome: nome.trim(),
    attiva: true
  }).select().single();

  if (error) { alert('Errore nella creazione.'); return; }
  await renderConvenzioni();
}

async function salvaConvenzione(convId) {
  const msg = document.getElementById(`msg-conv-${convId}`);

  for (const cat of CATEGORIE) {
    const val = parseFloat(document.getElementById(`tc-${convId}-${cat.id}`)?.value || 0);
    if (val <= 0) continue;

    // Upsert tariffe_convenzioni
    await sbClient.from('tariffe_convenzioni').upsert({
      convenzione_id: convId,
      categoria: cat.id,
      prezzo_giornaliero: val
    }, { onConflict: 'convenzione_id,categoria' });
  }

  if (msg) {
    msg.style.color = 'var(--green)';
    msg.textContent = '✓ Salvato!';
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
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="wz-btn-primary" style="flex:1"
                  onclick="salvaGarage('${g.id}')">💾 Salva</button>
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
  const nome = document.getElementById(`g-nome-${garageId}`)?.value?.trim();
  const addr = document.getElementById(`g-addr-${garageId}`)?.value?.trim();
  const msg = document.getElementById(`msg-g-${garageId}`);

  const { error } = await sbClient.from('garages')
    .update({ name: nome, address: addr })
    .eq('id', garageId);

  if (msg) {
    msg.style.color = error ? 'var(--red)' : 'var(--green)';
    msg.textContent = error ? 'Errore.' : '✓ Salvato!';
    setTimeout(() => { msg.textContent = ''; caricaGaragesOwner(); }, 1500);
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
