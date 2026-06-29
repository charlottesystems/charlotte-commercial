// ============================================================
// CHARLOTTE COMMERCIAL — cassa.js
// Registro cassa: oggi / settimana / mese / 6 mesi
// ============================================================

let cassaTab = 'oggi';

async function apriCassa() {
  mostraSchermata('cassa-screen');
  await caricaCassa();
}

async function caricaCassa() {
  if (!garageCorrente) return;
  const container = document.getElementById('cassa-container');
  if (!container) return;

  container.innerHTML = renderTabBar() + '<div id="cassa-body"></div>';
  await caricaCassaTab(cassaTab);
}

function renderTabBar() {
  const tabs = [
    { id: 'oggi',      label: 'Oggi' },
    { id: 'settimana', label: 'Settimana' },
    { id: 'mese',      label: 'Mese' },
    { id: '6mesi',     label: '6 Mesi' }
  ];
  const btns = tabs.map(t => `
    <button onclick="cambiaCassaTab('${t.id}')" id="tab-${t.id}"
      style="flex:1;padding:10px 4px;border:none;border-bottom:2px solid ${cassaTab === t.id ? 'var(--green)' : 'transparent'};
             background:none;color:${cassaTab === t.id ? 'var(--green)' : 'var(--muted)'};
             font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;cursor:pointer">
      ${t.label}
    </button>`).join('');
  return `<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:16px">${btns}</div>`;
}

async function cambiaCassaTab(tab) {
  cassaTab = tab;
  // Aggiorna stili tab senza ri-renderizzare tutta la pagina
  ['oggi','settimana','mese','6mesi'].forEach(id => {
    const btn = document.getElementById('tab-' + id);
    if (!btn) return;
    const attivo = id === tab;
    btn.style.borderBottomColor = attivo ? 'var(--green)' : 'transparent';
    btn.style.color = attivo ? 'var(--green)' : 'var(--muted)';
  });
  await caricaCassaTab(tab);
}

async function caricaCassaTab(tab) {
  const body = document.getElementById('cassa-body');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Caricamento...</div>';

  if (tab === 'oggi')      await renderCassaOggi(body);
  else if (tab === 'settimana') await renderCassaAggregata(body, 7,   'giorno');
  else if (tab === 'mese')      await renderCassaAggregata(body, 30,  'giorno');
  else if (tab === '6mesi')     await renderCassaAggregata(body, 180, 'mese');
}

// ── TAB OGGI ─────────────────────────────────────────────────

async function renderCassaOggi(body) {
  const oggi = new Date().toISOString().split('T')[0];

  const [{ data }, inSosta] = await Promise.all([
    sbClient.from('soste')
      .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, importo, operatore_uscita_nome')
      .eq('garage_id', garageCorrente.id)
      .gte('ingresso_at', oggi + 'T00:00:00')
      .not('uscita_at', 'is', null)
      .order('uscita_at', { ascending: false }),
    sbClient.from('soste').select('id', { count: 'exact', head: true })
      .eq('garage_id', garageCorrente.id).is('uscita_at', null)
  ]);

  const soste = data || [];
  const totale = soste.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const attive = inSosta.count || 0;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totale)}</div><div class="lbl">Incasso</div></div>
      <div class="stat"><div class="val">${soste.length}</div><div class="lbl">Uscite</div></div>
      <div class="stat"><div class="val" style="color:var(--amber)">${attive}</div><div class="lbl">In sosta</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="section-label">Dettaglio soste</div>
      <button onclick="esportaCassaCSV()" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--accent3);cursor:pointer;font-size:12px;font-family:Rajdhani,sans-serif;font-weight:700">
        📥 CSV
      </button>
    </div>
    ${soste.length === 0
      ? '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">Nessuna sosta chiusa oggi</div></div>'
      : soste.map(s => {
          const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
          const oraU = new Date(s.uscita_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          const durata = calcolaDurata(s.ingresso_at, s.uscita_at);
          return `<div class="sosta-card chiusa" style="margin-bottom:8px">
            <div class="sosta-info">
              <div class="sosta-targa">${s.targa}</div>
              <div class="sosta-tipo">${cat?.icon || ''} ${cat?.label || s.tipo_veicolo}</div>
              ${s.operatore_uscita_nome ? '<div style="font-size:10px;color:var(--muted)">👤 ' + s.operatore_uscita_nome + '</div>' : ''}
            </div>
            <div style="text-align:right">
              <div class="sosta-time">✓ ${oraU}</div>
              <div class="sosta-duration">${durata}</div>
              <div style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green);margin-top:2px">${formatEuro(s.importo)}</div>
            </div>
          </div>`;
        }).join('')
    }`;
}

// ── TAB AGGREGATI (settimana / mese / 6 mesi) ────────────────

async function renderCassaAggregata(body, giorni, raggruppamento) {
  const fine = new Date();
  const inizio = new Date();
  inizio.setDate(inizio.getDate() - giorni);

  // Fetch leggero: solo i campi necessari per l'aggregazione
  const { data } = await sbClient.from('soste')
    .select('uscita_at, importo')
    .eq('garage_id', garageCorrente.id)
    .gte('uscita_at', inizio.toISOString())
    .not('uscita_at', 'is', null);

  const soste = data || [];
  const totale = soste.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);

  // Aggrega per chiave (giorno o mese)
  const bucket = {};
  soste.forEach(s => {
    const d = new Date(s.uscita_at);
    const chiave = raggruppamento === 'mese'
      ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      : d.toISOString().slice(0, 10);
    if (!bucket[chiave]) bucket[chiave] = { importo: 0, count: 0 };
    bucket[chiave].importo += parseFloat(s.importo) || 0;
    bucket[chiave].count++;
  });

  // Ordina per data decrescente
  const voci = Object.entries(bucket).sort((a, b) => b[0].localeCompare(a[0]));

  // Trova il massimo per la barra proporzionale
  const maxImporto = voci.reduce((m, [, v]) => Math.max(m, v.importo), 0);

  const labelPeriodo = giorni === 7 ? 'ultimi 7 giorni' : giorni === 30 ? 'ultimi 30 giorni' : 'ultimi 6 mesi';

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totale)}</div><div class="lbl">Totale ${labelPeriodo}</div></div>
      <div class="stat"><div class="val">${soste.length}</div><div class="lbl">Uscite totali</div></div>
    </div>
    <div class="section-label" style="margin-bottom:12px">Dettaglio per ${raggruppamento}</div>
    ${voci.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Nessun dato nel periodo</div></div>'
      : voci.map(([chiave, v]) => {
          const etichetta = raggruppamento === 'mese'
            ? formattaMese(chiave)
            : formattaGiorno(chiave);
          const pct = maxImporto > 0 ? Math.round((v.importo / maxImporto) * 100) : 0;
          return `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--text)">${etichetta}</span>
                <span style="display:flex;gap:12px;align-items:center">
                  <span style="font-size:12px;color:var(--muted)">${v.count} uscite</span>
                  <span style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green)">${formatEuro(v.importo)}</span>
                </span>
              </div>
              <div style="height:6px;background:var(--panel);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--green),#059669);border-radius:3px;transition:width 0.3s"></div>
              </div>
            </div>`;
        }).join('')
    }`;
}

// ── UTILITY DATE ─────────────────────────────────────────────

function formattaGiorno(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formattaMese(chiave) {
  const [anno, mese] = chiave.split('-');
  const nomiMesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return nomiMesi[parseInt(mese) - 1] + ' ' + anno;
}

// ── EXPORT CSV (solo tab oggi) ────────────────────────────────

function esportaCassaCSV() {
  if (!garageCorrente) return;
  const oggi = new Date().toISOString().split('T')[0];

  sbClient.from('soste')
    .select('targa, tipo_veicolo, ingresso_at, uscita_at, importo, operatore_ingresso_nome, operatore_uscita_nome')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', oggi + 'T00:00:00')
    .not('uscita_at', 'is', null)
    .order('uscita_at', { ascending: true })
    .then(({ data }) => {
      if (!data || data.length === 0) { alert('Nessun dato da esportare.'); return; }
      const header = 'Targa;Categoria;Ingresso;Uscita;Durata;Importo;Op.Ingresso;Op.Uscita';
      const rows = data.map(s => {
        const oraI = new Date(s.ingresso_at).toLocaleString('it-IT');
        const oraU = new Date(s.uscita_at).toLocaleString('it-IT');
        const durata = calcolaDurata(s.ingresso_at, s.uscita_at);
        return [s.targa, s.tipo_veicolo, oraI, oraU, durata, (s.importo||0).toFixed(2), s.operatore_ingresso_nome||'', s.operatore_uscita_nome||''].join(';');
      });
      const csv = [header, ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cassa_' + oggi + '_' + garageCorrente.name + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
}
