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

async function dopoLoginOwner() {
  const { data: account } = await sbClient
    .from('accounts')
    .select('id, company_name, onboarding_complete, pin_app')
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

  // Cerca operatore con questo PIN su tutti gli account
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

  // Controlla blocco
  if (op.pin_bloccato_fino && new Date(op.pin_bloccato_fino) > new Date()) {
    const minuti = Math.ceil((new Date(op.pin_bloccato_fino) - new Date()) / 60000);
    errEl.textContent = 'PIN bloccato. Riprova tra ' + minuti + ' min.';
    pinOperatoreCorrente = '';
    aggiornaDotsOperatore();
    return;
  }

  // PIN corretto — reset tentativi
  await sbClient.from('operatori').update({
    pin_tentativi: 0,
    pin_bloccato_fino: null
  }).eq('id', op.id);

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

// PIN owner rimosso — login diretto alla home

// ── SESSIONE ALL'AVVIO ───────────────────────────────────────

async function controllaSessione() {
  const ruolo = localStorage.getItem('charlotte_ruolo');

  // Se era un operatore, ripristina sessione direttamente
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

  // Altrimenti controlla sessione Supabase Auth per owner
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

  // Griglia corretta per ruolo
  const gridOwner = document.getElementById('grid-owner');
  const gridOperatore = document.getElementById('grid-operatore');
  if (gridOwner) gridOwner.style.display = ruolo === 'owner' ? 'grid' : 'none';
  if (gridOperatore) gridOperatore.style.display = ruolo === 'operatore' ? 'grid' : 'none';

  // Tema dorato owner
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
    if (benv && nomeOp) {
      benv.textContent = '👋 Benvenuto, ' + nomeOp;
      benv.style.display = 'block';
    }
  } else {
    aggiornaNomeSocietà(localStorage.getItem('charlotte_company'));
    const benv = document.getElementById('benvenuto-operatore');
    if (benv) benv.style.display = 'none';
  }
}

function isOwner() {
  return localStorage.getItem('charlotte_ruolo') === 'owner';
}
