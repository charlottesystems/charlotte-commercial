// ============================================================
// CHARLOTTE — notifiche.js
// Notifiche sonore e visive per nuove prenotazioni
// Ascolta Supabase Realtime sul garage_id corrente
// ============================================================

let _notificheChannel = null;
let _notificheGarageId = null;

// ── STATO NOTIFICHE ──────────────────────────────────────────

function notificheAttive() {
  return localStorage.getItem('charlotte_notifiche') !== 'off';
}

function setNotifiche(attive) {
  localStorage.setItem('charlotte_notifiche', attive ? 'on' : 'off');
  aggiornaBottoniNotifiche();
  if (attive && garageCorrente) {
    avviaListenerNotifiche(garageCorrente.id);
  } else {
    fermaListenerNotifiche();
  }
}

function toggleNotifiche() {
  setNotifiche(!notificheAttive());
}

// ── AGGIORNA UI DEI TASTI ────────────────────────────────────

function aggiornaBottoniNotifiche() {
  const attive = notificheAttive();
  const label = attive ? '🔔 Notifiche attive' : '🔕 Notifiche disattivate';
  const color = attive ? 'var(--green)' : 'var(--muted)';

  // Tasto nel menu logo (owner)
  const btnMenu = document.getElementById('notifiche-btn-menu');
  if (btnMenu) {
    btnMenu.textContent = label;
    btnMenu.style.color = color;
  }

  // Tasto nella schermata badge (operatore)
  const btnBadge = document.getElementById('notifiche-btn-badge');
  if (btnBadge) {
    btnBadge.textContent = label;
    btnBadge.style.color = color;
    btnBadge.style.borderColor = attive ? 'var(--green)' : 'var(--border)';
  }
}

// ── LISTENER SUPABASE REALTIME ────────────────────────────────

function avviaListenerNotifiche(garageId) {
  // Evita duplicati: se già in ascolto sullo stesso garage, non rifare
  if (_notificheChannel && _notificheGarageId === garageId) return;

  fermaListenerNotifiche();

  if (!notificheAttive()) return;
  if (!garageId) return;

  _notificheGarageId = garageId;

  _notificheChannel = sbClient
    .channel('notifiche-prenotazioni-' + garageId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'prenotazioni',
        filter: 'garage_id=eq.' + garageId
      },
      (payload) => {
        if (!notificheAttive()) return;
        mostraNotificaPrenotazione(payload.new);
      }
    )
    .subscribe();
}

function fermaListenerNotifiche() {
  if (_notificheChannel) {
    sbClient.removeChannel(_notificheChannel);
    _notificheChannel = null;
    _notificheGarageId = null;
  }
}

// ── SUONO NOTIFICA ────────────────────────────────────────────

function suonaNotifica() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Due toni in sequenza — suono di notifica
    const tempi = [
      { freq: 880, start: 0,    dur: 0.12 },
      { freq: 1100, start: 0.15, dur: 0.18 }
    ];

    tempi.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch (e) {
    // AudioContext non disponibile — ignora silenziosamente
  }
}

// ── BANNER NOTIFICA ───────────────────────────────────────────

function mostraNotificaPrenotazione(pren) {
  suonaNotifica();

  // Costruisci testo
  const nome = pren.nome_cliente || 'Cliente';
  const targa = pren.targa ? ' · ' + pren.targa : '';
  const cat = pren.categoria || '';
  const dataI = pren.data_ingresso
    ? new Date(pren.data_ingresso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const importo = pren.importo_preventivo
    ? ' · €' + parseFloat(pren.importo_preventivo).toFixed(2)
    : '';

  // Rimuovi banner precedente se presente
  const vecchio = document.getElementById('notifica-banner');
  if (vecchio) vecchio.remove();

  const banner = document.createElement('div');
  banner.id = 'notifica-banner';
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:9999',
    'background:linear-gradient(135deg,var(--accent),var(--accent2))',
    'color:#fff',
    'padding:14px 16px 14px 16px',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'box-shadow:0 4px 24px rgba(124,58,237,0.45)',
    'animation:notifica-slide-in 0.3s ease',
    'cursor:pointer'
  ].join(';');

  banner.innerHTML =
    '<div style="font-size:26px;flex-shrink:0">📅</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        '🔔 Nuova prenotazione — ' + nome + targa +
      '</div>' +
      '<div style="font-size:12px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        (cat ? cat + ' · ' : '') + dataI + importo +
      '</div>' +
    '</div>' +
    '<div id="notifica-close" style="font-size:20px;padding:4px 8px;flex-shrink:0;opacity:0.7">✕</div>';

  // Click sul banner → apri prenotazioni
  banner.addEventListener('click', (e) => {
    if (e.target.id === 'notifica-close') {
      banner.remove();
      return;
    }
    banner.remove();
    if (typeof apriPrenotazioni === 'function') apriPrenotazioni();
  });

  document.body.appendChild(banner);

  // Auto-chiudi dopo 8 secondi
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
}

// ── INIT ──────────────────────────────────────────────────────
// Chiamato da app.js dopo che garageCorrente è impostato

function initNotifiche() {
  // Inietta stile animazione
  if (!document.getElementById('notifiche-style')) {
    const style = document.createElement('style');
    style.id = 'notifiche-style';
    style.textContent =
      '@keyframes notifica-slide-in {' +
        'from { transform: translateY(-100%); opacity: 0; }' +
        'to   { transform: translateY(0);    opacity: 1; }' +
      '}';
    document.head.appendChild(style);
  }

  aggiornaBottoniNotifiche();

  if (notificheAttive() && garageCorrente) {
    avviaListenerNotifiche(garageCorrente.id);
  }
}
