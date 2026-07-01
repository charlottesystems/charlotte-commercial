// ============================================================
// CHARLOTTE COMMERCIAL — auth.js
// Login owner, accesso operatore via PIN
// ============================================================

let sbClient = null;
let currentUser = null;
let currentOperatore = null;

function initSupabase() {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── LOGIN OWNER ───────────────────────────────────────────────

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Inserisci email e password.';
    return;
  }

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = 'Credenziali non valide. Riprova.';
    return;
  }

  currentUser = data.user;
  await dopoLoginOwner();
}

async function verificaAbbonamento(account) {
  const ora = new Date();
  const trialFine = account.trial_ends_at ? new Date(account.trial_ends_at) : null;
  const bloccatoAt = account.blocked_at ? new Date(account.blocked_at) : null;

  // Ha abbonamento attivo (anche se disdetto ma non ancora scaduto) → ok
  const cancelsAt = account.cancels_at ? new Date(account.cancels_at) : null;
  if (account.stripe_subscription_id && (!cancelsAt || ora <= cancelsAt)) return 'ok';

  // Abbonamento con disdetta già scaduta ma webhook subscription.deleted non ancora arrivato → blocca subito
  if (account.stripe_subscription_id && cancelsAt && ora > cancelsAt && !bloccatoAt) {
    await sbClient.from('accounts').update({ blocked_at: ora.toISOString() }).eq('id', account.id);
    return 'blocked';
  }

  // Trial scaduto e non ancora bloccato → blocca ora
  if (trialFine && ora > trialFine && !bloccatoAt) {
    await sbClient.from('accounts').update({ blocked_at: ora.toISOString() }).eq('id', account.id);
    return 'blocked';
  }

  // Già bloccato → controlla se passati 30gg → cancella
  if (bloccatoAt) {
    const giorniBloccato = (ora - bloccatoAt) / (1000 * 60 * 60 * 24);
    if (giorniBloccato >= 30) {
      const { data: garages } = await sbClient.from('garages').select('id').eq('account_id', account.id);
      if (garages?.length) {
        for (const g of garages) {
          await sbClient.from('soste').delete().eq('garage_id', g.id);
        }
      }
      await sbClient.from('accounts').delete().eq('id', account.id);
      return 'deleted';
    }
    return 'blocked';
  }

  return 'ok';
}

function mostraSchermataBloccata(account) {
  const bloccatoAt = account.blocked_at ? new Date(account.blocked_at) : null;
  const ora = new Date();
  const giorniBloccato = bloccatoAt ? Math.floor((ora - bloccatoAt) / (1000 * 60 * 60 * 24)) : 0;
  const giorniRimasti = 30 - giorniBloccato;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const header = document.getElementById('main-header');
  if (header) header.style.display = 'none';

  let el = document.getElementById('blocked-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'blocked-screen';
    el.className = 'screen active';
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:32px;text-align:center';
    document.querySelector('.main') ? document.querySelector('.main').appendChild(el) : document.body.appendChild(el);
  }
  el.classList.add('active');

  el.innerHTML = '<div style="font-size:64px;margin-bottom:16px">&#x23F0;</div>' +
    '<div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:26px;color:var(--white);margin-bottom:8px">Periodo di prova terminato</div>' +
    '<div style="font-size:14px;color:var(--muted);margin-bottom:24px;max-width:340px">Il tuo periodo di prova gratuita &#xe8 scaduto. Sottoscrivi un abbonamento per continuare ad usare Charlotte Parking.</div>' +
    (giorniRimasti > 0 ? '<div style="font-size:12px;color:var(--amber);margin-bottom:20px">&#x26A0;&#xFE0F; I tuoi dati verranno eliminati tra <strong>' + giorniRimasti + ' giorni</strong>.</div>' : '') +
    '<a href="checkout.html" style="display:block;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:14px;padding:16px 32px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:18px;color:white;text-decoration:none;margin-bottom:12px">Scegli un piano &#x2192;</a>' +
    '<button onclick="apriPortaleAbbonamento()" style="display:block;width:100%;background:none;border:1px solid var(--border);border-radius:14px;padding:14px 32px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:16px;color:var(--muted);cursor:pointer;margin-bottom:12px">&#x1F4B3; Gestisci abbonamento esistente</button>' +
    '<button onclick="doLogout()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:8px">Esci</button>';
}

async function dopoLoginOwner() {
  const { data: account } = await sbClient
    .from('accounts')
    .select('id, company_name, onboarding_complete, trial_ends_at, blocked_at, stripe_subscription_id, cancels_at')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

  // Attiva abbonamento pendente se l'utente ha pagato dal sito prima di registrarsi
  if (account && !account.stripe_subscription_id && currentUser.email) {
    const { data: pending } = await sbClient
      .from('pending_subscriptions')
      .select('*')
      .eq('email', currentUser.email.toLowerCase())
      .maybeSingle();
    if (pending) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 30);
      const trialEndsAt = pending.trial_ends_at || fallback.toISOString();
      await sbClient.from('accounts').update({
        stripe_subscription_id: pending.stripe_subscription_id,
        stripe_customer_id: pending.stripe_customer_id,
        blocked_at: null,
        plan: pending.plan || 'pro',
        trial_ends_at: trialEndsAt,
      }).eq('id', account.id);
      await sbClient.from('pending_subscriptions').delete().eq('email', currentUser.email.toLowerCase());
      account.stripe_subscription_id = pending.stripe_subscription_id;
      account.blocked_at = null;
    }
  }

  if (!account) {
    await sbClient.auth.signOut();
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = 'Account non trovato.';
    return;
  }

  if (!account.onboarding_complete) {
    mostraSchermata('onboarding-screen');
    avviaWizard();
    return;
  }

  localStorage.setItem('charlotte_account_id', account.id);
  localStorage.setItem('charlotte_company', account.company_name);
  localStorage.setItem('charlotte_ruolo', 'owner');
  localStorage.removeItem('charlotte_operatore_id');
  localStorage.removeItem('charlotte_operatore_nome');

  // Verifica abbonamento
  const statoAbb = await verificaAbbonamento(account);
  if (statoAbb === 'blocked') {
    mostraSchermataBloccata(account);
    return;
  }
  if (statoAbb === 'deleted') {
    await doLogout();
    alert('Il tuo account è stato eliminato per inattività. Registrati nuovamente per usare Charlotte.');
    return;
  }

  mostraSchermata('main-screen');
  aggiornaNomeSocietà(account.company_name);
  aggiornaHeaderRuolo();
  mostraBannerTrial(account);
  mostraBannerCancellazione(account);
  await inizializzaApp();
}

// ── REGISTRAZIONE OWNER ───────────────────────────────────────

function mostraRegistrazione() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'flex';
}

function mostraLogin() {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'flex';
}

async function doRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Inserisci email e password.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password minimo 6 caratteri.'; return; }
  if (password !== password2) { errEl.textContent = 'Le password non coincidono.'; return; }

  const { data, error } = await sbClient.auth.signUp({ email, password });
  if (error) { errEl.textContent = 'Errore: ' + error.message; return; }

  currentUser = data.user;
  mostraSchermata('onboarding-screen');
  avviaWizard();
}

// ── LOGIN OPERATORE VIA PIN ────────────────────────────────────

let pinOperatoreCorrente = '';

function mostraLoginOperatore() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('operatore-pin-form').style.display = 'flex';
  pinOperatoreCorrente = '';
  aggiornaDotsOperatore();
  document.getElementById('op-pin-error').textContent = '';
}

function mostraLoginDaOperatore() {
  document.getElementById('operatore-pin-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'flex';
}

function aggiornaDotsOperatore() {
  const dots = document.querySelectorAll('.op-pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('filled', 'error');
    if (i < pinOperatoreCorrente.length) dot.classList.add('filled');
  });
}

function aggiornaDotsOperatoreError() {
  const dots = document.querySelectorAll('.op-pin-dot');
  dots.forEach(dot => { dot.classList.remove('filled'); dot.classList.add('error'); });
}

function premiCifraOperatore(cifra) {
  if (pinOperatoreCorrente.length >= 6) return;
  pinOperatoreCorrente += cifra;
  aggiornaDotsOperatore();
  if (pinOperatoreCorrente.length === 6) setTimeout(verificaPinOperatore, 150);
}

function cancellaCifraOperatore() {
  pinOperatoreCorrente = pinOperatoreCorrente.slice(0, -1);
  aggiornaDotsOperatore();
}

function pinDeviceBloccatoFino() {
  const fino = localStorage.getItem('charlotte_pin_device_bloccato_fino');
  return fino && new Date(fino) > new Date() ? new Date(fino) : null;
}

function registraTentativoPinFallito() {
  const tentativi = parseInt(localStorage.getItem('charlotte_pin_device_tentativi') || '0', 10) + 1;
  localStorage.setItem('charlotte_pin_device_tentativi', String(tentativi));
  if (tentativi >= 5) {
    const blocco = new Date(Date.now() + 5 * 60000);
    localStorage.setItem('charlotte_pin_device_bloccato_fino', blocco.toISOString());
  }
}

function resetTentativiPinDevice() {
  localStorage.removeItem('charlotte_pin_device_tentativi');
  localStorage.removeItem('charlotte_pin_device_bloccato_fino');
}

async function verificaPinOperatore() {
  const errEl = document.getElementById('op-pin-error');

  // Rate-limit lato dispositivo: dopo 5 tentativi falliti, blocca i tentativi
  // da questo dispositivo per 5 minuti (mitiga il brute-force del PIN a 6 cifre)
  const bloccoDispositivo = pinDeviceBloccatoFino();
  if (bloccoDispositivo) {
    const minuti = Math.ceil((bloccoDispositivo - new Date()) / 60000);
    errEl.textContent = 'Troppi tentativi. Riprova tra ' + minuti + ' min.';
    pinOperatoreCorrente = '';
    aggiornaDotsOperatore();
    return;
  }

  const { data: operatori, error } = await sbClient
    .from('operatori')
    .select('id, account_id, nome, attivo, pin_bloccato_fino, pin_tentativi, accounts(company_name)')
    .eq('pin', pinOperatoreCorrente)
    .eq('attivo', true);

  if (error || !operatori || operatori.length === 0) {
    registraTentativoPinFallito();
    aggiornaDotsOperatoreError();
    errEl.textContent = 'PIN non valido.';
    setTimeout(() => {
      pinOperatoreCorrente = '';
      aggiornaDotsOperatore();
      errEl.textContent = '';
    }, 1000);
    return;
  }

  if (operatori.length > 1) {
    // PIN non univoco a livello globale (collisione tra account diversi): non si può
    // determinare con certezza l'operatore corretto, quindi si nega l'accesso invece
    // di scegliere arbitrariamente operatori[0] e rischiare di loggare la persona sbagliata.
    console.error('PIN collision across accounts for entered PIN, denying login');
    aggiornaDotsOperatoreError();
    errEl.textContent = 'PIN ambiguo. Contatta il gestore.';
    setTimeout(() => {
      pinOperatoreCorrente = '';
      aggiornaDotsOperatore();
      errEl.textContent = '';
    }, 1500);
    return;
  }

  const op = operatori[0];

  if (op.pin_bloccato_fino && new Date(op.pin_bloccato_fino) > new Date()) {
    const minuti = Math.ceil((new Date(op.pin_bloccato_fino) - new Date()) / 60000);
    errEl.textContent = 'PIN bloccato. Riprova tra ' + minuti + ' min.';
    pinOperatoreCorrente = '';
    aggiornaDotsOperatore();
    return;
  }

  resetTentativiPinDevice();
  await sbClient.from('operatori').update({ pin_tentativi: 0, pin_bloccato_fino: null }).eq('id', op.id);

  currentOperatore = op;
  localStorage.setItem('charlotte_account_id', op.account_id);
  localStorage.setItem('charlotte_company', op.accounts?.company_name || '');
  localStorage.setItem('charlotte_ruolo', 'operatore');
  localStorage.setItem('charlotte_operatore_id', op.id);
  localStorage.setItem('charlotte_operatore_nome', op.nome);

  mostraSchermata('main-screen');
  await inizializzaApp();
  aggiornaHeaderRuolo();
}

// ── LOGOUT ───────────────────────────────────────────────────

async function doLogout() {
  const ruolo = localStorage.getItem('charlotte_ruolo');
  if (ruolo === 'owner') {
    await sbClient.auth.signOut();
    currentUser = null;
  }
  currentOperatore = null;
  localStorage.removeItem('charlotte_pin');
  localStorage.removeItem('charlotte_account_id');
  localStorage.removeItem('charlotte_company');
  localStorage.removeItem('charlotte_ruolo');
  localStorage.removeItem('charlotte_operatore_id');
  localStorage.removeItem('charlotte_operatore_nome');
  mostraSchermata('login-screen');
  document.getElementById('login-form').style.display = 'flex';
  document.getElementById('operatore-pin-form').style.display = 'none';
  if (document.getElementById('register-form')) {
    document.getElementById('register-form').style.display = 'none';
  }
}

// ── SESSIONE ALL'AVVIO ───────────────────────────────────────

async function controllaSessione() {
  const ruolo = localStorage.getItem('charlotte_ruolo');

  if (ruolo === 'operatore') {
    const opId = localStorage.getItem('charlotte_operatore_id');
    const opNome = localStorage.getItem('charlotte_operatore_nome');
    if (opId && opNome) {
      // Rivalida che l'operatore esista ancora nel DB e sia attivo
      const accountId = localStorage.getItem('charlotte_account_id');
      const { data: op } = await sbClient.from('operatori')
        .select('id, attivo').eq('id', opId).eq('account_id', accountId).maybeSingle();
      if (!op || op.attivo === false) {
        localStorage.removeItem('charlotte_ruolo');
        localStorage.removeItem('charlotte_operatore_id');
        localStorage.removeItem('charlotte_operatore_nome');
        mostraSchermata('login-screen');
        return;
      }
      mostraSchermata('main-screen');
      await inizializzaApp();
      aggiornaHeaderRuolo();
      return;
    }
  }

  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await dopoLoginOwner();
  } else {
    mostraSchermata('login-screen');
  }
}

// ── RESET PASSWORD ───────────────────────────────────────────

async function doResetPassword() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-error');
  if (!email) { errEl.textContent = 'Inserisci la tua email per il reset.'; return; }
  await sbClient.auth.resetPasswordForEmail(email);
  errEl.style.color = 'var(--green)';
  errEl.textContent = 'Email di reset inviata.';
  setTimeout(() => { errEl.style.color = ''; errEl.textContent = ''; }, 4000);
}

// ── UTILITY ─────────────────────────────────────────────────

function aggiornaNomeSocietà(nome) {
  const el = document.getElementById('company-name-header');
  if (el) el.textContent = nome || 'Charlotte';
}

function aggiornaHeaderRuolo() {
  const ruolo = localStorage.getItem('charlotte_ruolo');
  const ownerBtn = document.getElementById('owner-btn-header');
  if (ownerBtn) ownerBtn.style.display = ruolo === 'owner' ? 'inline-flex' : 'none';

  const gridOwner = document.getElementById('grid-owner');
  const gridOperatore = document.getElementById('grid-operatore');
  if (gridOwner) gridOwner.style.display = ruolo === 'owner' ? 'grid' : 'none';
  if (gridOperatore) gridOperatore.style.display = ruolo === 'operatore' ? 'grid' : 'none';

  const ownerBadge = document.getElementById('owner-badge');
  if (ruolo === 'owner') {
    document.body.classList.add('is-owner');
    if (ownerBadge) ownerBadge.style.display = 'flex';
  } else {
    document.body.classList.remove('is-owner');
    if (ownerBadge) ownerBadge.style.display = 'none';
  }

  // Mostra link elimina account solo per owner
  const eliminaLink = document.getElementById('elimina-link-owner');
  if (eliminaLink) eliminaLink.style.display = ruolo === 'owner' ? 'block' : 'none';

  // Mostra link gestisci abbonamento solo per owner
  const abbLink = document.getElementById('gestisci-abbonamento-link');
  if (abbLink) abbLink.style.display = ruolo === 'owner' ? 'flex' : 'none';

  if (ruolo === 'operatore') {
    const nomeOp = localStorage.getItem('charlotte_operatore_nome');
    const el = document.getElementById('company-name-header');
    if (el && nomeOp) el.textContent = nomeOp;
    const benv = document.getElementById('benvenuto-operatore');
    if (benv && nomeOp) { benv.textContent = '👋 Benvenuto, ' + nomeOp; benv.style.display = 'block'; }
  } else {
    aggiornaNomeSocietà(localStorage.getItem('charlotte_company'));
    const benv = document.getElementById('benvenuto-operatore');
    if (benv) benv.style.display = 'none';
  }
}

function isOwner() {
  return localStorage.getItem('charlotte_ruolo') === 'owner';
}

async function apriPortaleAbbonamento() {
  const link = document.getElementById('gestisci-abbonamento-link');
  const orig = link ? link.innerHTML : '';
  if (link) link.innerHTML = '&#x23F3; Caricamento...';

  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) { alert('Devi essere loggato.'); return; }

    const resp = await fetch(SUPABASE_URL + '/functions/v1/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({ return_url: window.location.href }),
    });

    const data = await resp.json();
    if (data.url) {
      window.open(data.url, '_blank');
    } else if (data.error === 'no_customer') {
      alert('Nessun abbonamento trovato. Se hai appena acquistato, attendi qualche istante e riprova.');
    } else {
      throw new Error(data.error || 'Errore');
    }
  } catch (err) {
    console.error('Portal error:', err);
    alert('Errore apertura portale. Riprova.');
  } finally {
    if (link) link.innerHTML = orig;
  }
}

function mostraBannerCancellazione(account) {
  if (!account.cancels_at) return;
  const el = document.getElementById('trial-banner');
  if (!el) return;
  const fine = new Date(account.cancels_at);
  const oggi = new Date();
  const giorni = Math.ceil((fine - oggi) / (1000 * 60 * 60 * 24));
  if (giorni <= 0) return;
  el.style.display = 'block';
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<span style="font-size:12px;color:var(--amber)">&#x26A0;&#xFE0F; Abbonamento disdetto: accesso attivo ancora <strong>' + giorni + ' giorni</strong> (scade il ' + fine.toLocaleDateString('it-IT') + ')</span>' +
    '<button onclick="apriPortaleAbbonamento()" style="font-size:11px;color:white;background:var(--accent);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700">Riattiva</button>' +
    '</div>';
}

function mostraBannerTrial(account) {
  const el = document.getElementById('trial-banner');
  if (!el) return;

  // Ha abbonamento attivo → nascondi banner
  if (account.stripe_subscription_id) { el.style.display = 'none'; return; }

  const trialFine = account.trial_ends_at ? new Date(account.trial_ends_at) : null;
  if (!trialFine) { el.style.display = 'none'; return; }

  const oggi = new Date();
  const giorniRimasti = Math.ceil((trialFine - oggi) / (1000 * 60 * 60 * 24));

  if (giorniRimasti <= 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  const colore = giorniRimasti <= 7 ? 'var(--red)' : giorniRimasti <= 14 ? 'var(--amber)' : 'var(--accent3)';
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<span style="font-size:12px;color:' + colore + '">&#x23F0; Prova gratuita: <strong>' + giorniRimasti + ' giorni rimanenti</strong></span>' +
    '<a href="checkout.html" style="font-size:11px;color:white;background:var(--accent);border-radius:6px;padding:4px 10px;text-decoration:none;font-family:Rajdhani,sans-serif;font-weight:700">Abbonati</a>' +
    '</div>';
}
