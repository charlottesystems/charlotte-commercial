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

  // Ha abbonamento attivo → ok
  if (account.stripe_subscription_id) return 'ok';

  // Trial scaduto e non ancora bloccato → blocca ora
  if (trialFine && ora > trialFine && !bloccatoAt) {
    await sbClient.from('accounts').update({ blocked_at: ora.toISOString() }).eq('id', account.id);
    return 'blocked';
  }

  // Già bloccato → controlla se passati 30gg → cancella
  if (bloccatoAt) {
    const giorniBloccato = (ora - bloccatoAt) / (1000 * 60 * 60 * 24);
    if (giorniBloccato >= 30) {
      await sbClient.from('soste').delete().eq('garage_id', account.id);
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
    '<button onclick="doLogout()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:8px">Esci</button>';
}

async function dopoLoginOwner() {
  const { data: account } = await sbClient
    .from('accounts')
    .select('id, company_name, onboarding_complete, trial_ends_at, blocked_at, stripe_subscription_id')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

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
  inizializzaApp();
  aggiornaHeaderRuolo();
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

async function verificaPinOperatore() {
  const errEl = document.getElementById('op-pin-error');

  const { data: operatori, error } = await sbClient
    .from('operatori')
    .select('id, account_id, nome, attivo, pin_bloccato_fino, pin_tentativi, accounts(company_name)')
    .eq('pin', pinOperatoreCorrente)
    .eq('attivo', true);

  if (error || !operatori || operatori.length === 0) {
    aggiornaDotsOperatoreError();
    errEl.textContent = 'PIN non valido.';
    setTimeout(() => {
      pinOperatoreCorrente = '';
      aggiornaDotsOperatore();
      errEl.textContent = '';
    }, 1000);
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

  await sbClient.from('operatori').update({ pin_tentativi: 0, pin_bloccato_fino: null }).eq('id', op.id);

  currentOperatore = op;
  localStorage.setItem('charlotte_account_id', op.account_id);
  localStorage.setItem('charlotte_company', op.accounts?.company_name || '');
  localStorage.setItem('charlotte_ruolo', 'operatore');
  localStorage.setItem('charlotte_operatore_id', op.id);
  localStorage.setItem('charlotte_operatore_nome', op.nome);

  mostraSchermata('main-screen');
  inizializzaApp();
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
      mostraSchermata('main-screen');
      inizializzaApp();
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

  if (ruolo === 'operatore') {
    const nomeOp = localStorage.getItem('charlotte_operatore_nome');
    const el = document.getElementById('company-name-header');
    if (el && nomeOp) el.textContent = nomeOp;
    const benv = document.getElementById('benvenuto-operatore');
    if (benv && nomeOp) { benv.textContent = '&#x1F44B; Benvenuto, ' + nomeOp; benv.style.display = 'block'; }
  } else {
    aggiornaNomeSocietà(localStorage.getItem('charlotte_company'));
    const benv = document.getElementById('benvenuto-operatore');
    if (benv) benv.style.display = 'none';
  }
}

function isOwner() {
  return localStorage.getItem('charlotte_ruolo') === 'owner';
}
