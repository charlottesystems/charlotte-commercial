// ============================================================
// CHARLOTTE — notifiche.js
// Notifiche in-app (Supabase Realtime) + Push native (Web Push)
// ============================================================

let _notificheChannel = null;
let _notificheGarageId = null;
let _swRegistration = null;

// ── STATO NOTIFICHE ──────────────────────────────────────────

function notificheAttive() {
  return localStorage.getItem('charlotte_notifiche') !== 'off';
}

async function setNotifiche(attive) {
  localStorage.setItem('charlotte_notifiche', attive ? 'on' : 'off');
  if (attive && garageCorrente) {
    avviaListenerNotifiche(garageCorrente.id);
    await iscriviPushNotifiche(garageCorrente.id);
  } else {
    fermaListenerNotifiche();
    await disiscriviPushNotifiche();
  }
  aggiornaBottoniNotifiche();
}

function toggleNotifiche() {
  setNotifiche(!notificheAttive());
}

// ── AGGIORNA UI DEI TASTI ────────────────────────────────────

function aggiornaBottoniNotifiche() {
  const attive = notificheAttive();
  const pushOk = localStorage.getItem('charlotte_push_iscritto') === '1';
  const label = attive
    ? (pushOk ? '🔔 Notifiche attive (push ✓)' : '🔔 Notifiche attive (solo in-app)')
    : '🔕 Notifiche disattivate';
  const color = attive ? 'var(--green)' : 'var(--muted)';

  const btnMenu = document.getElementById('notifiche-btn-menu');
  if (btnMenu) { btnMenu.textContent = label; btnMenu.style.color = color; }

  const btnBadge = document.getElementById('notifiche-btn-badge');
  if (btnBadge) {
    btnBadge.textContent = label;
    btnBadge.style.color = color;
    btnBadge.style.borderColor = attive ? 'var(--green)' : 'var(--border)';
  }
}

// ── SERVICE WORKER ────────────────────────────────────────────

async function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    _swRegistration = await navigator.serviceWorker.register('/charlotte-commercial/sw.js', {
      scope: '/charlotte-commercial/'
    });
    return _swRegistration;
  } catch (e) {
    console.warn('[Charlotte] Service worker non registrato:', e);
    return null;
  }
}

// ── ISCRIZIONE PUSH ───────────────────────────────────────────

async function iscriviPushNotifiche(garageId) {
  if (!('PushManager' in window) || !('Notification' in window)) return;
  if (typeof VAPID_PUBLIC_KEY === 'undefined' || VAPID_PUBLIC_KEY.startsWith('INSERISCI')) return;

  try {
    // Chiedi permesso notifiche
    const permesso = await Notification.requestPermission();
    if (permesso !== 'granted') {
      console.warn('[Charlotte] Permesso notifiche negato');
      localStorage.removeItem('charlotte_push_iscritto');
      localStorage.removeItem('charlotte_push_garage_id');
      aggiornaBottoniNotifiche();
      return;
    }

    // Registra service worker se non già fatto
    const reg = _swRegistration || await registraServiceWorker();
    if (!reg) return;

    // Controlla se già iscritto
    let sub = await reg.pushManager.getSubscription();

    // Se iscritto ma per un garage diverso, ri-iscriviti
    const garageIscritto = localStorage.getItem('charlotte_push_garage_id');
    if (sub && garageIscritto !== garageId) {
      await sub.unsubscribe();
      sub = null;
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Salva subscription su Supabase
    const accountId = localStorage.getItem('charlotte_account_id');
    const subJson = sub.toJSON();
    await sbClient.from('push_subscriptions').upsert({
      account_id: accountId,
      garage_id: garageId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth
    }, { onConflict: 'endpoint' });

    localStorage.setItem('charlotte_push_iscritto', '1');
    localStorage.setItem('charlotte_push_garage_id', garageId);
    console.log('[Charlotte] Push subscription attiva');
  } catch (e) {
    console.warn('[Charlotte] Errore iscrizione push:', e);
  }
}

async function disiscriviPushNotifiche() {
  try {
    const reg = _swRegistration || (await navigator.serviceWorker?.getRegistration('/charlotte-commercial/'));
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await sbClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
    localStorage.removeItem('charlotte_push_iscritto');
    localStorage.removeItem('charlotte_push_garage_id');
    console.log('[Charlotte] Push subscription rimossa');
  } catch (e) {
    console.warn('[Charlotte] Errore disiscrizione push:', e);
  }
}

// Converte chiave VAPID base64url → Uint8Array (richiesto da PushManager)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

// ── LISTENER SUPABASE REALTIME ────────────────────────────────

function avviaListenerNotifiche(garageId) {
  if (_notificheChannel && _notificheGarageId === garageId) return;
  fermaListenerNotifiche();
  if (!notificheAttive() || !garageId) return;
  _notificheGarageId = garageId;
  _notificheChannel = sbClient
    .channel('notifiche-prenotazioni-' + garageId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'prenotazioni',
      filter: 'garage_id=eq.' + garageId
    }, (payload) => {
      if (!notificheAttive()) return;
      mostraNotificaPrenotazione(payload.new);
    })
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
    [{ freq: 880, start: 0, dur: 0.12 }, { freq: 1100, start: 0.15, dur: 0.18 }].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch (e) {}
}

// ── BANNER IN-APP ─────────────────────────────────────────────

function mostraNotificaPrenotazione(pren) {
  suonaNotifica();
  const nome = pren.nome_cliente || 'Cliente';
  const targa = pren.targa ? ' · ' + pren.targa : '';
  const cat = pren.categoria || '';
  const dataI = pren.data_ingresso
    ? new Date(pren.data_ingresso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const importo = pren.importo_preventivo ? ' · €' + parseFloat(pren.importo_preventivo).toFixed(2) : '';

  const vecchio = document.getElementById('notifica-banner');
  if (vecchio) vecchio.remove();

  const banner = document.createElement('div');
  banner.id = 'notifica-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 24px rgba(124,58,237,0.45);animation:notifica-slide-in 0.3s ease;cursor:pointer';
  banner.innerHTML =
    '<div style="font-size:26px;flex-shrink:0">📅</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔔 Nuova prenotazione — ' + nome + targa + '</div>' +
      '<div style="font-size:12px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (cat ? cat + ' · ' : '') + dataI + importo + '</div>' +
    '</div>' +
    '<div id="notifica-close" style="font-size:20px;padding:4px 8px;flex-shrink:0;opacity:0.7">✕</div>';

  banner.addEventListener('click', (e) => {
    if (e.target.id === 'notifica-close') { banner.remove(); return; }
    banner.remove();
    if (typeof apriPrenotazioni === 'function') apriPrenotazioni();
  });
  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
}

// ── INIT ──────────────────────────────────────────────────────

async function initNotifiche() {
  if (!document.getElementById('notifiche-style')) {
    const style = document.createElement('style');
    style.id = 'notifiche-style';
    style.textContent = '@keyframes notifica-slide-in{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
  }

  // Registra service worker in background (non blocca)
  registraServiceWorker();

  aggiornaBottoniNotifiche();

  if (notificheAttive() && garageCorrente) {
    avviaListenerNotifiche(garageCorrente.id);
    // Rinnova la push subscription se già iscritto in precedenza
    if (localStorage.getItem('charlotte_push_iscritto') === '1') {
      await iscriviPushNotifiche(garageCorrente.id);
    }
  }
}
