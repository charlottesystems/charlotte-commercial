// ============================================================
// CHARLOTTE COMMERCIAL — cassa.js
// Registro cassa con analisi multi-periodo, multi-garage
// e ricavi da piattaforme esterne
// ============================================================

let cassaTab = 'oggi';
let _apexLoaded = false;
let _pdfLibsLoaded = false;
let _multiPeriodo = 'mese';
let _mostraIVA = false;

const COLORI_GARAGE = ['#10b981','#7c3aed','#d4a843','#6366f1','#f59e0b','#ec4899','#06b6d4','#84cc16'];

async function apriCassa() {
  mostraSchermata('cassa-screen');
  await caricaCassa();
}

async function caricaCassa() {
  if (!garageCorrente) return;
  const container = document.getElementById('cassa-container');
  if (!container) return;
  container.innerHTML = renderTabBar() + '<div id="cassa-body"></div>' + renderBottoniFlottanti();
  await caricaCassaTab(cassaTab);
}

// ── TAB BAR ───────────────────────────────────────────────────

function renderTabBar() {
  const mostraMulti = (garageList || []).length > 1;
  const tabs = [
    { id: 'oggi',      label: t('cassa_tab_oggi') },
    { id: 'settimana', label: t('cassa_tab_sett') },
    { id: 'mese',      label: t('cassa_tab_mese') },
    { id: '6mesi',     label: t('cassa_tab_6m') },
    { id: 'anno',      label: t('cassa_tab_anno') },
    { id: 'grafici',   label: '📊' },
    ...(mostraMulti ? [{ id: 'multi', label: '🏢' }] : [])
  ];
  const allIds = tabs.map(t => t.id);
  const btns = tabs.map(t => `
    <button onclick="cambiaCassaTab('${t.id}')" id="tab-${t.id}"
      style="flex:1;padding:9px 2px;border:none;border-bottom:2px solid ${cassaTab === t.id ? 'var(--green)' : 'transparent'};
             background:none;color:${cassaTab === t.id ? 'var(--green)' : 'var(--muted)'};
             font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;cursor:pointer">
      ${t.label}
    </button>`).join('');
  return `<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:16px">${btns}</div>`;
}

async function cambiaCassaTab(tab) {
  cassaTab = tab;
  document.querySelectorAll('[id^="tab-"]').forEach(btn => {
    const id = btn.id.replace('tab-','');
    btn.style.borderBottomColor = id === tab ? 'var(--green)' : 'transparent';
    btn.style.color = id === tab ? 'var(--green)' : 'var(--muted)';
  });
  await caricaCassaTab(tab);
}

async function caricaCassaTab(tab) {
  const body = document.getElementById('cassa-body');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Caricamento...</div>';
  if      (tab === 'oggi')      await renderCassaOggi(body);
  else if (tab === 'settimana') await renderCassaAggregata(body, 7,   'giorno');
  else if (tab === 'mese')      await renderCassaAggregata(body, 30,  'giorno');
  else if (tab === '6mesi')     await renderCassaAggregata(body, 180, 'mese');
  else if (tab === 'anno')      await renderCassaAggregata(body, 365, 'mese');
  else if (tab === 'grafici')   await renderCassaGrafici(body);
  else if (tab === 'multi')     await renderCassaMulti(body);
}

// ── BOTTONI FLOTTANTI ─────────────────────────────────────────

function renderBottoniFlottanti() {
  return `
    <div id="cassa-fab" style="position:fixed;bottom:24px;right:16px;z-index:500;display:flex;flex-direction:column;align-items:flex-end;gap:10px">
      <button onclick="apriPannelloEsterni()"
        style="background:var(--panel);border:1px solid var(--border);border-radius:50px;padding:10px 18px;
               color:var(--accent3);font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;
               cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);display:flex;align-items:center;gap:6px">
        ➕ Ricavi esterni
      </button>
      <button onclick="scaricaReportPDF()" id="btn-scarica-pdf"
        style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:50px;
               padding:12px 20px;color:#fff;font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;
               cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,0.45);display:flex;align-items:center;gap:8px">
        📄 Scarica PDF
      </button>
    </div>`;
}

// ── IVA TOGGLE ───────────────────────────────────────────────

function renderToggleIVA() {
  return `<div style="text-align:right;margin-bottom:8px">
    <button onclick="toggleIVA()" id="btn-iva"
      style="background:${_mostraIVA ? 'rgba(251,191,36,0.15)' : 'none'};
             border:1px solid ${_mostraIVA ? 'var(--amber)' : 'var(--border)'};
             border-radius:20px;padding:4px 12px;
             color:${_mostraIVA ? 'var(--amber)' : 'var(--muted)'};
             font-family:Rajdhani,sans-serif;font-weight:700;font-size:12px;cursor:pointer">
      📊 IVA 22%${_mostraIVA ? ' ✓' : ''}
    </button>
  </div>`;
}

function renderRigaIVA(totale) {
  if (!_mostraIVA || totale <= 0) return '';
  const netto = totale / 1.22;
  const iva = totale - netto;
  return `<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:10px 14px;margin-bottom:12px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center">
      <div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Lordo</div>
        <div style="font-family:Share Tech Mono,monospace;font-size:13px;color:var(--muted);text-decoration:line-through">${formatEuro(totale)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:var(--amber);margin-bottom:3px">IVA 22%</div>
        <div style="font-family:Share Tech Mono,monospace;font-size:13px;color:var(--amber)">- ${formatEuro(iva)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:var(--green);margin-bottom:3px">Netto</div>
        <div style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green);font-weight:700">${formatEuro(netto)}</div>
      </div>
    </div>
  </div>`;
}

async function toggleIVA() {
  _mostraIVA = !_mostraIVA;
  await caricaCassaTab(cassaTab);
}

// ── TAB OGGI ─────────────────────────────────────────────────

async function renderCassaOggi(body) {
  const oggi = new Date().toISOString().split('T')[0];
  const [{ data }, inSosta] = await Promise.all([
    sbClient.from('soste')
      .select('id, targa, tipo_veicolo, ingresso_at, uscita_at, importo, convenzione_id, operatore_uscita_nome')
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
  const media = soste.length > 0 ? totale / soste.length : 0;
  body.innerHTML = `
    ${renderToggleIVA()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totale)}</div><div class="lbl">${t('cassa_incasso')}</div></div>
      <div class="stat"><div class="val">${soste.length}</div><div class="lbl">🚗 Auto uscite</div></div>
      <div class="stat"><div class="val" style="color:var(--muted);font-size:1rem">${soste.length > 0 ? formatEuro(media) : '—'}</div><div class="lbl">Media/auto</div></div>
    </div>
    ${renderRigaIVA(totale)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat"><div class="val" style="color:var(--amber)">${attive}</div><div class="lbl">${t('in_sosta_label')}</div></div>
      <div class="stat"><div class="val">${soste.length + attive}</div><div class="lbl">Tot. ingressi oggi</div></div>
    </div>
    ${renderBreakdownConvenzioni(soste, totale)}
    <div style="margin-bottom:12px;margin-top:16px"><div class="section-label">${t('cassa_dettaglio')}</div></div>
    ${soste.length === 0
      ? `<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">${t('nessuna_chiusa')}</div></div>`
      : soste.map(s => {
          const cat = CATEGORIE.find(c => c.id === s.tipo_veicolo);
          const conv = (convenzioniGarage || []).find(c => c.id === s.convenzione_id);
          const oraU = new Date(s.uscita_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          return `<div class="sosta-card chiusa" style="margin-bottom:8px">
            <div class="sosta-info">
              <div class="sosta-targa">${s.targa}</div>
              <div class="sosta-tipo">${cat?.icon || ''} ${cat?.label || s.tipo_veicolo}</div>
              ${conv ? `<div style="font-size:10px;color:var(--accent3)">🤝 ${conv.nome}</div>` : ''}
              ${s.operatore_uscita_nome ? '<div style="font-size:10px;color:var(--muted)">👤 ' + s.operatore_uscita_nome + '</div>' : ''}
            </div>
            <div style="text-align:right">
              <div class="sosta-time">✓ ${oraU}</div>
              <div class="sosta-duration">${calcolaDurata(s.ingresso_at, s.uscita_at)}</div>
              <div style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green);margin-top:2px">${formatEuro(s.importo)}</div>
            </div>
          </div>`;
        }).join('')
    }`;
}

// ── TAB AGGREGATI ─────────────────────────────────────────────

async function renderCassaAggregata(body, giorni, raggruppamento) {
  const inizio = new Date();
  inizio.setDate(inizio.getDate() - giorni);

  const [{ data }, esterni] = await Promise.all([
    sbClient.from('soste')
      .select('uscita_at, importo, convenzione_id')
      .eq('garage_id', garageCorrente.id)
      .gte('uscita_at', inizio.toISOString())
      .not('uscita_at', 'is', null),
    // I ricavi esterni sono tracciati a granularità mensile: si includono nel totale
    // di qualunque periodo (anche settimana/mese), ma la ripartizione per bucket
    // giorno-per-giorno resta possibile solo col raggruppamento 'mese'.
    fetchRicaviEsterni(garageCorrente.id, inizio)
  ]);

  const soste = data || [];
  const totaleInterno = soste.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const totaleEsterno = esterni.reduce((s, r) => s + (parseFloat(r.incasso) || 0), 0);
  const totale = totaleInterno + totaleEsterno;

  // Aggrega interni per chiave temporale
  const bucket = {};
  soste.forEach(s => {
    const d = new Date(s.uscita_at);
    const chiave = raggruppamento === 'mese'
      ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      : d.toISOString().slice(0, 10);
    if (!bucket[chiave]) bucket[chiave] = { importo: 0, count: 0, esterno: 0, countEsterno: 0 };
    bucket[chiave].importo += parseFloat(s.importo) || 0;
    bucket[chiave].count++;
  });

  // Aggiungi ricavi esterni ai bucket mensili (solo quando il raggruppamento è per mese:
  // con bucket giornalieri non è possibile sapere a quale giorno assegnare un importo
  // tracciato a livello mensile, ma resta comunque incluso nel totale del periodo sopra)
  if (raggruppamento === 'mese') {
    esterni.forEach(e => {
      const chiave = e.anno + '-' + String(e.mese).padStart(2, '0');
      if (!bucket[chiave]) bucket[chiave] = { importo: 0, count: 0, esterno: 0, countEsterno: 0 };
      bucket[chiave].esterno += parseFloat(e.incasso) || 0;
      bucket[chiave].countEsterno += e.num_prenotazioni || 0;
    });
  }

  const voci = Object.entries(bucket).sort((a, b) => b[0].localeCompare(a[0]));
  const maxImporto = voci.reduce((m, [, v]) => Math.max(m, v.importo + v.esterno), 0);
  const labelPeriodo = giorni === 7 ? '7 giorni' : giorni === 30 ? '30 giorni' : giorni === 180 ? '6 mesi' : 'anno';

  const mediaAgg = soste.length > 0 ? totaleInterno / soste.length : 0;
  body.innerHTML = `
    ${renderToggleIVA()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totale)}</div><div class="lbl">${t('cassa_incasso')} ${labelPeriodo}</div></div>
      <div class="stat"><div class="val">${soste.length}</div><div class="lbl">🚗 Auto uscite</div></div>
      <div class="stat"><div class="val" style="color:var(--muted);font-size:1rem">${soste.length > 0 ? formatEuro(mediaAgg) : '—'}</div><div class="lbl">Media/auto</div></div>
    </div>
    ${renderRigaIVA(totale)}
    ${totaleEsterno > 0 ? `
    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;color:#6366f1;font-family:Rajdhani,sans-serif;font-weight:700">🌐 Ricavi piattaforme esterne inclusi</div>
      <div style="font-family:Share Tech Mono,monospace;font-size:13px;color:#6366f1">${formatEuro(totaleEsterno)}</div>
    </div>` : ''}
    ${renderBreakdownConvenzioni(soste, totale)}
    <div class="section-label" style="margin-bottom:12px;margin-top:16px">${t('cassa_dettaglio_per')} ${raggruppamento}</div>
    ${voci.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">${t('cassa_nessun_dato')}</div></div>`
      : voci.map(([chiave, v]) => {
          const etichetta = raggruppamento === 'mese' ? formattaMese(chiave) : formattaGiorno(chiave);
          const totVoce = v.importo + v.esterno;
          const pct = maxImporto > 0 ? Math.round((totVoce / maxImporto) * 100) : 0;
          const pctInt = totVoce > 0 ? Math.round((v.importo / totVoce) * 100) : 100;
          return `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--text)">${etichetta}</span>
                <span style="display:flex;gap:10px;align-items:center">
                  <span style="font-size:11px;color:var(--muted)">${v.count}${v.countEsterno > 0 ? '+' + v.countEsterno + '🌐' : ''} uscite</span>
                  <span style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green)">${formatEuro(totVoce)}</span>
                </span>
              </div>
              <div style="height:6px;background:var(--panel);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;border-radius:3px;display:flex;overflow:hidden">
                  <div style="height:100%;width:${pctInt}%;background:linear-gradient(90deg,var(--green),#059669)"></div>
                  ${v.esterno > 0 ? `<div style="height:100%;flex:1;background:#6366f1"></div>` : ''}
                </div>
              </div>
              ${v.esterno > 0 ? `<div style="font-size:10px;color:#6366f1;margin-top:3px">🟢 interno ${formatEuro(v.importo)} · 🌐 esterno ${formatEuro(v.esterno)}</div>` : ''}
            </div>`;
        }).join('')
    }`;
}

// ── TAB GRAFICI ───────────────────────────────────────────────

async function renderCassaGrafici(body) {
  body.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Caricamento grafici...</div>';
  await caricaApexCharts();

  const inizio = new Date();
  inizio.setMonth(inizio.getMonth() - 11);
  inizio.setDate(1);
  inizio.setHours(0, 0, 0, 0);

  const [{ data }, esterni] = await Promise.all([
    sbClient.from('soste')
      .select('uscita_at, importo, convenzione_id')
      .eq('garage_id', garageCorrente.id)
      .gte('uscita_at', inizio.toISOString())
      .not('uscita_at', 'is', null),
    fetchRicaviEsterni(garageCorrente.id, inizio)
  ]);

  const soste = data || [];
  const nomiMesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

  // Costruisci 12 slot mensili
  const mesiMap = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(inizio);
    d.setMonth(inizio.getMonth() + i);
    const chiave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    mesiMap[chiave] = { importo: 0, count: 0, esterno: 0 };
  }

  soste.forEach(s => {
    const d = new Date(s.uscita_at);
    const chiave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (mesiMap[chiave]) {
      mesiMap[chiave].importo += parseFloat(s.importo) || 0;
      mesiMap[chiave].count++;
    }
  });
  esterni.forEach(e => {
    const chiave = e.anno + '-' + String(e.mese).padStart(2, '0');
    if (mesiMap[chiave]) mesiMap[chiave].esterno += parseFloat(e.incasso) || 0;
  });

  const labels   = Object.keys(mesiMap).map(k => { const [a,m] = k.split('-'); return nomiMesi[parseInt(m)-1] + ' ' + a.slice(2); });
  const importi  = Object.values(mesiMap).map(v => parseFloat((v.importo + v.esterno).toFixed(2)));
  const interni  = Object.values(mesiMap).map(v => parseFloat(v.importo.toFixed(2)));
  const esterniV = Object.values(mesiMap).map(v => parseFloat(v.esterno.toFixed(2)));
  const counts   = Object.values(mesiMap).map(v => v.count);
  const hasEsterni = esterniV.some(v => v > 0);

  // Donut convenzioni
  const convMap = {};
  soste.forEach(s => {
    const k = s.convenzione_id || '__nessuna__';
    convMap[k] = (convMap[k] || 0) + (parseFloat(s.importo) || 0);
  });
  const convAttive = convenzioniGarage || [];
  const donutLabels = Object.keys(convMap).map(k => k === '__nessuna__' ? 'Standard' : (convAttive.find(c => c.id === k)?.nome || 'Conv. rimossa'));
  const donutValori = Object.values(convMap).map(v => parseFloat(v.toFixed(2)));

  const totaleAnno = importi.reduce((a, b) => a + b, 0);
  const autoAnno   = counts.reduce((a, b) => a + b, 0);

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      <div class="stat"><div class="val" style="color:var(--green)">${formatEuro(totaleAnno)}</div><div class="lbl">Incasso 12 mesi</div></div>
      <div class="stat"><div class="val">${autoAnno}</div><div class="lbl">Auto totali</div></div>
    </div>
    <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📈 Andamento incassi</div>
    <div id="chart-area" style="margin-bottom:24px"></div>
    <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🚗 Affluenza mensile</div>
    <div id="chart-bar" style="margin-bottom:24px"></div>
    <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🥧 Provenienza ricavi</div>
    <div id="chart-donut" style="margin-bottom:24px"></div>`;

  const base = {
    chart: { background: 'transparent', toolbar: { show: false }, fontFamily: 'Rajdhani, sans-serif' },
    theme: { mode: 'dark' },
    grid: { borderColor: '#2a2a3a' },
    xaxis: { categories: labels, labels: { style: { colors: '#888', fontSize: '11px' } } },
    tooltip: { theme: 'dark' }
  };

  // Area chart — stile azionario (stacked se ci sono ricavi esterni)
  if (hasEsterni) {
    new ApexCharts(document.getElementById('chart-area'), {
      ...base,
      chart: { ...base.chart, type: 'area', height: 220, stacked: true },
      series: [
        { name: 'Interno (€)', data: interni },
        { name: 'Esterno (€)', data: esterniV }
      ],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      colors: ['#10b981', '#6366f1'],
      yaxis: { labels: { formatter: v => '€' + v.toLocaleString('it-IT'), style: { colors: '#888', fontSize: '11px' } } },
      dataLabels: { enabled: false }
    }).render();
  } else {
    new ApexCharts(document.getElementById('chart-area'), {
      ...base,
      chart: { ...base.chart, type: 'area', height: 200 },
      series: [{ name: 'Incasso (€)', data: importi }],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
      colors: ['#10b981'],
      yaxis: { labels: { formatter: v => '€' + v.toLocaleString('it-IT'), style: { colors: '#888', fontSize: '11px' } } },
      dataLabels: { enabled: false },
      markers: { size: 3, colors: ['#10b981'], strokeWidth: 0 }
    }).render();
  }

  // Bar chart affluenza
  new ApexCharts(document.getElementById('chart-bar'), {
    ...base,
    chart: { ...base.chart, type: 'bar', height: 180 },
    series: [{ name: 'Auto', data: counts }],
    colors: ['#7c3aed'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    yaxis: { labels: { style: { colors: '#888', fontSize: '11px' } } },
    dataLabels: { enabled: false }
  }).render();

  // Donut convenzioni
  if (donutValori.length > 0) {
    new ApexCharts(document.getElementById('chart-donut'), {
      chart: { ...base.chart, type: 'donut', height: 280 },
      theme: { mode: 'dark' },
      series: donutValori,
      labels: donutLabels,
      colors: ['#10b981','#7c3aed','#d4a843','#6366f1','#f59e0b','#ec4899'],
      legend: { position: 'bottom', labels: { colors: '#aaa' } },
      dataLabels: { style: { fontSize: '12px' } },
      tooltip: { theme: 'dark', y: { formatter: v => '€' + v.toLocaleString('it-IT') } },
      plotOptions: { pie: { donut: { size: '60%', labels: { show: true,
        total: { show: true, label: 'Totale', color: '#aaa',
          formatter: w => '€' + w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString('it-IT')
        }
      }}}}
    }).render();
  } else {
    document.getElementById('chart-donut').innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">Nessuna convenzione usata nel periodo</div>';
  }
}

// ── TAB MULTI-GARAGE ──────────────────────────────────────────

async function renderCassaMulti(body) {
  const periodi = [
    { id: 'settimana', label: 'Sett',  giorni: 7 },
    { id: 'mese',      label: 'Mese',  giorni: 30 },
    { id: '6mesi',     label: '6 M',   giorni: 180 },
    { id: 'anno',      label: 'Anno',  giorni: 365 }
  ];

  const selectorHtml = `
    <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap">
      ${periodi.map(p => `
        <button onclick="cambiaMultiPeriodo('${p.id}')" id="multi-tab-${p.id}"
          style="padding:6px 14px;border-radius:20px;border:1px solid ${_multiPeriodo === p.id ? 'var(--green)' : 'var(--border)'};
                 background:${_multiPeriodo === p.id ? 'rgba(16,185,129,0.15)' : 'none'};
                 color:${_multiPeriodo === p.id ? 'var(--green)' : 'var(--muted)'};
                 font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;cursor:pointer">
          ${p.label}
        </button>`).join('')}
    </div>
    <div id="multi-body"></div>`;

  body.innerHTML = selectorHtml;
  await renderMultiBody();
}

async function cambiaMultiPeriodo(periodo) {
  _multiPeriodo = periodo;
  document.querySelectorAll('[id^="multi-tab-"]').forEach(btn => {
    const id = btn.id.replace('multi-tab-','');
    const attivo = id === periodo;
    btn.style.borderColor = attivo ? 'var(--green)' : 'var(--border)';
    btn.style.background = attivo ? 'rgba(16,185,129,0.15)' : 'none';
    btn.style.color = attivo ? 'var(--green)' : 'var(--muted)';
  });
  await renderMultiBody();
}

async function renderMultiBody() {
  const mb = document.getElementById('multi-body');
  if (!mb) return;
  mb.innerHTML = '<div style="color:var(--muted);text-align:center;padding:16px">Caricamento...</div>';
  await caricaApexCharts();

  const periodi = { settimana: 7, mese: 30, '6mesi': 180, anno: 365 };
  const giorni = periodi[_multiPeriodo] || 30;
  const inizio = new Date();
  inizio.setDate(inizio.getDate() - giorni);

  const garages = garageList || [];

  // Fetch parallelo per tutti i garage
  const risultati = await Promise.all(garages.map(g =>
    sbClient.from('soste')
      .select('uscita_at, importo')
      .eq('garage_id', g.id)
      .gte('uscita_at', inizio.toISOString())
      .not('uscita_at', 'is', null)
      .then(({ data }) => ({ garage: g, soste: data || [] }))
  ));

  // Raccoglie tutte le chiavi mensili/giornaliere
  const usaMesi = giorni > 30;
  const labelMap = {};
  risultati.forEach(({ soste }) => soste.forEach(s => {
    const d = new Date(s.uscita_at);
    const k = usaMesi
      ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      : d.toISOString().slice(0, 10);
    labelMap[k] = true;
  }));
  const chiavi = Object.keys(labelMap).sort();
  const nomiMesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const labels = chiavi.map(k => usaMesi
    ? nomiMesi[parseInt(k.split('-')[1]) - 1] + ' ' + k.split('-')[0].slice(2)
    : formattaGiorno(k));

  // Totali per garage
  const totaliGarage = risultati.map(({ garage, soste }) => ({
    garage,
    totale: soste.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0),
    count: soste.length,
    serie: chiavi.map(k => {
      return soste.filter(s => {
        const d = new Date(s.uscita_at);
        const sk = usaMesi
          ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
          : d.toISOString().slice(0, 10);
        return sk === k;
      }).reduce((sum, s) => sum + (parseFloat(s.importo) || 0), 0);
    })
  }));

  totaliGarage.sort((a, b) => b.totale - a.totale);

  // Tabella riepilogo
  const maxTotale = totaliGarage[0]?.totale || 1;
  const tabellaHtml = totaliGarage.map((t, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="width:10px;height:10px;border-radius:50%;background:${COLORI_GARAGE[i % COLORI_GARAGE.length]};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.garage.name}</div>
        <div style="height:4px;background:var(--panel);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${Math.round((t.totale/maxTotale)*100)}%;background:${COLORI_GARAGE[i % COLORI_GARAGE.length]};border-radius:2px"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green)">${formatEuro(t.totale)}</div>
        <div style="font-size:11px;color:var(--muted)">${t.count} uscite</div>
      </div>
    </div>`).join('');

  mb.innerHTML = `
    <div class="section-label" style="margin-bottom:12px">Confronto garage</div>
    ${tabellaHtml}
    ${chiavi.length > 0 ? `
    <div style="margin-top:24px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
      📊 Andamento comparato
    </div>
    <div id="chart-multi"></div>` : ''}`;

  if (chiavi.length > 0) {
    new ApexCharts(document.getElementById('chart-multi'), {
      chart: { background: 'transparent', toolbar: { show: false }, fontFamily: 'Rajdhani, sans-serif', type: 'bar', height: 260, stacked: false },
      theme: { mode: 'dark' },
      series: totaliGarage.map((t, i) => ({ name: t.garage.name, data: t.serie.map(v => parseFloat(v.toFixed(2))) })),
      colors: totaliGarage.map((_, i) => COLORI_GARAGE[i % COLORI_GARAGE.length]),
      xaxis: { categories: labels, labels: { style: { colors: '#888', fontSize: '10px' } } },
      yaxis: { labels: { formatter: v => '€' + v.toLocaleString('it-IT'), style: { colors: '#888', fontSize: '10px' } } },
      plotOptions: { bar: { borderRadius: 3, columnWidth: garages.length > 3 ? '80%' : '60%' } },
      grid: { borderColor: '#2a2a3a' },
      legend: { labels: { colors: '#aaa' }, position: 'bottom' },
      tooltip: { theme: 'dark', y: { formatter: v => '€' + v.toLocaleString('it-IT') } },
      dataLabels: { enabled: false }
    }).render();
  }
}

// ── RICAVI ESTERNI ────────────────────────────────────────────

async function fetchRicaviEsterni(garageId, dataDa) {
  const annoMin = dataDa.getFullYear();
  const { data } = await sbClient.from('ricavi_esterni')
    .select('piattaforma, num_prenotazioni, incasso, mese, anno')
    .eq('garage_id', garageId)
    .gte('anno', annoMin);
  if (!data) return [];
  // Filtra con precisione mese/anno
  return data.filter(e => {
    const d = new Date(e.anno, e.mese - 1, 1);
    return d >= dataDa;
  });
}

async function apriPannelloEsterni() {
  if (localStorage.getItem('charlotte_ruolo') !== 'owner') return;
  if (document.getElementById('pannello-esterni')) return;
  const accountId = localStorage.getItem('charlotte_account_id');

  const panel = document.createElement('div');
  panel.id = 'pannello-esterni';
  panel.style.cssText = 'position:fixed;inset:0;z-index:800;display:flex;flex-direction:column;background:var(--bg)';

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:18px;color:var(--text)">🌐 Ricavi piattaforme esterne</div>
      <button onclick="chiudiPannelloEsterni()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:16px">
      <div style="background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--accent3);margin-bottom:12px">➕ Aggiungi ricavo esterno</div>
        <select id="ext-garage" style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:14px;margin-bottom:8px;outline:none">
          ${(garageList||[]).map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
        </select>
        <input id="ext-piattaforma" class="wz-input" placeholder="Nome piattaforma (es. Booking.com)" style="margin-bottom:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <select id="ext-mese" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:13px;outline:none">
            ${['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'].map((m,i) => `<option value="${i+1}" ${new Date().getMonth()===i?'selected':''}>${m}</option>`).join('')}
          </select>
          <input id="ext-anno" class="wz-input" type="number" placeholder="Anno" value="${new Date().getFullYear()}" style="margin-bottom:0">
          <input id="ext-prenotazioni" class="wz-input" type="number" placeholder="N° pren." min="0" style="margin-bottom:0">
        </div>
        <input id="ext-incasso" class="wz-input" type="number" placeholder="Incasso totale (€)" step="0.01" min="0" style="margin-bottom:12px">
        <div id="ext-error" style="color:var(--red);font-size:12px;margin-bottom:8px;min-height:16px"></div>
        <button onclick="salvaRicavoEsterno()"
          style="width:100%;background:var(--green);border:none;border-radius:10px;padding:12px;color:#fff;font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;cursor:pointer">
          SALVA E RICALCOLA
        </button>
      </div>
      <div class="section-label" style="margin-bottom:12px">Storico ricavi inseriti</div>
      <div id="ext-lista">Caricamento...</div>
    </div>`;

  document.body.appendChild(panel);
  await aggiornaListaEsterni();
}

function chiudiPannelloEsterni() {
  const p = document.getElementById('pannello-esterni');
  if (p) p.remove();
}

async function aggiornaListaEsterni() {
  const lista = document.getElementById('ext-lista');
  if (!lista) return;
  const garageIds = (garageList || []).map(g => g.id);
  if (garageIds.length === 0) { lista.innerHTML = '<div style="color:var(--muted);font-size:13px">Nessun garage</div>'; return; }

  const { data } = await sbClient.from('ricavi_esterni')
    .select('id, piattaforma, num_prenotazioni, incasso, mese, anno, garage_id')
    .in('garage_id', garageIds)
    .order('anno', { ascending: false })
    .order('mese', { ascending: false });

  const nomiMesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  if (!data || data.length === 0) {
    lista.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">Nessun ricavo esterno inserito</div>';
    return;
  }

  lista.innerHTML = data.map(e => {
    const nomeGarage = (garageList||[]).find(g => g.id === e.garage_id)?.name || '';
    return `
      <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--accent3)">${e.piattaforma}</div>
          <div style="font-size:11px;color:var(--muted)">${nomeGarage} · ${nomiMesi[e.mese-1]} ${e.anno} · ${e.num_prenotazioni} pren.</div>
        </div>
        <div style="font-family:Share Tech Mono,monospace;font-size:14px;color:var(--green);flex-shrink:0">${formatEuro(e.incasso)}</div>
        <button onclick="eliminaRicavoEsterno('${e.id}')"
          style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;flex-shrink:0;padding:4px">✕</button>
      </div>`;
  }).join('');
}

async function salvaRicavoEsterno() {
  const errEl = document.getElementById('ext-error');
  const garageId = document.getElementById('ext-garage')?.value;
  const piattaforma = document.getElementById('ext-piattaforma')?.value.trim();
  const mese = parseInt(document.getElementById('ext-mese')?.value);
  const anno = parseInt(document.getElementById('ext-anno')?.value);
  const numPren = parseInt(document.getElementById('ext-prenotazioni')?.value) || 0;
  const incasso = parseFloat(document.getElementById('ext-incasso')?.value);

  if (!piattaforma) { errEl.textContent = 'Inserisci il nome della piattaforma'; return; }
  if (!anno || anno < 2020) { errEl.textContent = 'Anno non valido'; return; }
  if (isNaN(incasso) || incasso < 0) { errEl.textContent = 'Inserisci un incasso valido'; return; }
  errEl.textContent = '';

  const accountId = localStorage.getItem('charlotte_account_id');
  const { error } = await sbClient.from('ricavi_esterni').insert({
    account_id: accountId,
    garage_id: garageId,
    piattaforma,
    mese,
    anno,
    num_prenotazioni: numPren,
    incasso
  });

  if (error) { errEl.textContent = 'Errore nel salvataggio. Riprova.'; return; }

  // Reset form
  document.getElementById('ext-piattaforma').value = '';
  document.getElementById('ext-prenotazioni').value = '';
  document.getElementById('ext-incasso').value = '';

  await aggiornaListaEsterni();
  await ricalcolaCassaCorrente();
}

async function eliminaRicavoEsterno(id) {
  if (!confirm('Eliminare questo ricavo esterno?')) return;
  await sbClient.from('ricavi_esterni').delete().eq('id', id);
  await aggiornaListaEsterni();
  await ricalcolaCassaCorrente();
}

async function ricalcolaCassaCorrente() {
  // Ricalcola il tab corrente senza chiudere il pannello
  const body = document.getElementById('cassa-body');
  if (!body) return;
  if (['6mesi','anno','grafici'].includes(cassaTab)) {
    await caricaCassaTab(cassaTab);
  }
}

// ── BREAKDOWN CONVENZIONI ─────────────────────────────────────

function renderBreakdownConvenzioni(soste, totaleGlobale) {
  if (!soste || soste.length === 0) return '';
  const gruppi = {};
  soste.forEach(s => {
    const k = s.convenzione_id || '__nessuna__';
    if (!gruppi[k]) gruppi[k] = { importo: 0, count: 0 };
    gruppi[k].importo += parseFloat(s.importo) || 0;
    gruppi[k].count++;
  });
  const hasConvenzioni = Object.keys(gruppi).some(k => k !== '__nessuna__');
  if (!hasConvenzioni) return '';

  const convAttive = convenzioniGarage || [];
  const righe = Object.entries(gruppi)
    .sort((a, b) => { if (a[0]==='__nessuna__') return 1; if (b[0]==='__nessuna__') return -1; return b[1].importo - a[1].importo; })
    .map(([k, v]) => {
      const isNessuna = k === '__nessuna__';
      const nome = isNessuna ? 'Senza convenzione' : (convAttive.find(c => c.id === k)?.nome || 'Convenzione rimossa');
      const importoMostrato = _mostraIVA ? v.importo / 1.22 : v.importo;
      const mediaMostrata = v.count > 0 ? importoMostrato / v.count : 0;
      const pct = totaleGlobale > 0 ? Math.round((v.importo / totaleGlobale) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:18px;flex-shrink:0">${isNessuna ? '🚗' : '🤝'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:${isNessuna ? 'var(--muted)' : 'var(--accent3)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">🚗 ${v.count} auto · media ${formatEuro(mediaMostrata)}${_mostraIVA ? ' netto' : ''} · ${pct}%</div>
            <div style="height:4px;background:var(--panel);border-radius:2px;overflow:hidden;margin-top:5px">
              <div style="height:100%;width:${pct}%;background:${isNessuna ? 'var(--muted)' : 'var(--accent3)'};border-radius:2px"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:Share Tech Mono,monospace;font-size:15px;color:var(--green)">${formatEuro(importoMostrato)}</div>
            ${_mostraIVA ? `<div style="font-size:10px;color:var(--muted)">netto IVA</div>` : ''}
          </div>
        </div>`;
    }).join('');

  return `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px">
      <div style="padding:12px 14px 4px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:var(--accent3)">
        🤝 Ripartizione per convenzione
      </div>
      <div style="padding:0 14px 8px">${righe}</div>
    </div>`;
}

// ── UTILITY DATE ─────────────────────────────────────────────

function formattaGiorno(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formattaMese(chiave) {
  const [anno, mese] = chiave.split('-');
  return ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][parseInt(mese)-1] + ' ' + anno;
}

// ── APEX CHARTS ───────────────────────────────────────────────

function caricaApexCharts() {
  return new Promise(resolve => {
    if (_apexLoaded || window.ApexCharts) { _apexLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3';
    s.onload = () => { _apexLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

// ── EXPORT PDF ────────────────────────────────────────────────

async function scaricaReportPDF() {
  const btn = document.getElementById('btn-scarica-pdf');
  if (btn) { btn.textContent = '⏳ Generazione...'; btn.disabled = true; }
  await caricaLibsPDF();
  const body = document.getElementById('cassa-body');
  if (!body) return;
  const labelTab = { oggi:'Oggi', settimana:'Settimana', mese:'Mese', '6mesi':'6 Mesi', anno:'Anno', grafici:'Grafici', multi:'Multi-Garage' };
  const periodo = labelTab[cassaTab] || cassaTab;
  const dataOra = new Date().toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const nomeGarage = cassaTab === 'multi' ? 'Tutti i garage' : (garageCorrente?.name || 'Garage');
  try {
    const canvas = await html2canvas(body, { backgroundColor: '#0a0a0f', scale: 2, useCORS: true, logging: false, scrollY: 0 });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - margin * 2;
    pdf.setFillColor(10, 10, 15); pdf.rect(0, 0, pageW, 22, 'F');
    pdf.setTextColor(16, 185, 129); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('CHARLOTTE', margin, 13);
    pdf.setTextColor(170, 170, 170); pdf.setFontSize(9); pdf.text('Report Cassa — ' + periodo + ' — ' + nomeGarage, margin, 19);
    pdf.setFontSize(8); pdf.text(dataOra, pageW - margin, 19, { align: 'right' });
    pdf.setDrawColor(42, 42, 58); pdf.line(margin, 23, pageW - margin, 23);
    const imgH = (canvas.height * contentW) / canvas.width;
    let y = 27, altezzaRimanente = imgH, sorgY = 0;
    while (altezzaRimanente > 0) {
      const spazio = pageH - y - 8;
      const slice = Math.min(altezzaRimanente, spazio);
      const canvasSliceH = canvas.height * (slice / imgH);
      const sc = document.createElement('canvas');
      sc.width = canvas.width; sc.height = canvasSliceH;
      sc.getContext('2d').drawImage(canvas, 0, sorgY, canvas.width, canvasSliceH, 0, 0, canvas.width, canvasSliceH);
      pdf.addImage(sc.toDataURL('image/png'), 'PNG', margin, y, contentW, slice);
      altezzaRimanente -= slice; sorgY += canvasSliceH;
      if (altezzaRimanente > 0) {
        pdf.addPage();
        pdf.setFillColor(10,10,15); pdf.rect(0,0,pageW,18,'F');
        pdf.setTextColor(16,185,129); pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
        pdf.text('CHARLOTTE — ' + nomeGarage + ' — ' + periodo, margin, 12);
        pdf.setDrawColor(42,42,58); pdf.line(margin,16,pageW-margin,16);
        y = 20;
      }
    }
    pdf.setTextColor(80,80,100); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
    pdf.text('Generato da Charlotte Parking · charlotteparking.it', pageW/2, pageH-5, { align:'center' });
    pdf.save('charlotte_' + nomeGarage.replace(/\s+/g,'-') + '_' + cassaTab + '_' + new Date().toISOString().slice(0,10) + '.pdf');
  } catch(e) { alert('Errore nella generazione del PDF. Riprova.'); }
  if (btn) { btn.innerHTML = '📄 Scarica PDF'; btn.disabled = false; }
}

function caricaLibsPDF() {
  return new Promise(resolve => {
    if (_pdfLibsLoaded && window.html2canvas && window.jspdf) { resolve(); return; }
    let loaded = 0;
    const check = () => { if (++loaded === 2) { _pdfLibsLoaded = true; resolve(); } };
    const s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s1.onload = check; document.head.appendChild(s1);
    const s2 = document.createElement('script');
    s2.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s2.onload = check; document.head.appendChild(s2);
  });
}
