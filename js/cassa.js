// ============================================================
// CHARLOTTE COMMERCIAL — cassa.js
// Registro cassa giornaliero
// ============================================================

async function apriCassa() {
  mostraSchermata('cassa-screen');
  await caricaCassa();
}

async function caricaCassa() {
  if (!garageCorrente) return;
  const container = document.getElementById('cassa-container');
  if (!container) return;

  const oggi = new Date().toISOString().split('T')[0];

  const { data } = await sbClient
    .from('soste')
    .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, importo, convenzione_id, operatore_ingresso_nome, operatore_uscita_nome')
    .eq('garage_id', garageCorrente.id)
    .gte('ingresso_at', oggi + 'T00:00:00')
    .not('uscita_at', 'is', null)
    .order('uscita_at', { ascending: false });

  const soste = data || [];
  const totale = soste.reduce((sum, s) => sum + (parseFloat(s.importo) || 0), 0);
  const inSosta = await sbClient.from('soste').select('id').eq('garage_id', garageCorrente.id).is('uscita_at', null);
  const attive = inSosta.data?.length || 0;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totale)}</div><div class="lbl">Incasso oggi</div></div>
      <div class="stat"><div class="val">${soste.length}</div><div class="lbl">Uscite oggi</div></div>
      <div class="stat"><div class="val" style="color:var(--amber)">${attive}</div><div class="lbl">In sosta</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="section-label">Dettaglio soste chiuse oggi</div>
      <button onclick="esportaCassaCSV()" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--accent3);cursor:pointer;font-size:12px;font-family:Rajdhani,sans-serif;font-weight:700">
        📥 Esporta CSV
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
        return [s.targa, s.tipo_veicolo, oraI, oraU, durata, (s.importo || 0).toFixed(2), s.operatore_ingresso_nome || '', s.operatore_uscita_nome || ''].join(';');
      });

      const csv = [header, ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cassa_' + oggi + '_' + garageCorrente.name + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
}
