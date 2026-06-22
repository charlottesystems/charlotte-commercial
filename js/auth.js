// ============================================================
// CHARLOTTE COMMERCIAL — auth.js
// Login, logout, PIN, gestione sessione, ruoli
// ============================================================

let sbClient = null;
let currentUser = null;
let currentOperatore = null; // dati operatore se non è owner

function initSupabase() {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── LOGIN ────────────────────────────────────────────────────

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
  await dopoLogin();
}

async function dopoLogin() {
  // Prima controlla se è owner
  const { data: account } = await sbClient
    .from('accounts')
    .select('id, company_name, onboarding_complete')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

  if (account) {
    // È un owner
    if (!account.onboarding_complete) {
      mostraSchermata('onboarding-screen');
      avviaWizard();
    } else {
      localStorage.setItem('charlotte_account_id', account.id);
      localStorage.setItem('charlotte_company', account.company_name);
      localStorage.setItem('charlotte_ruolo', 'owner');
      localStorage.removeItem('charlotte_operatore_id');
      localStorage.removeItem('charlotte_operatore_nome');
      mostraSchermata('pin-screen');
      aggiornaNomeSocietà(account.company_name);
    }
    return;
  }

  // Non è owner — controlla se è operatore
  const { data: operatore } = await sbClient
    .from('operatori')
    .select('id, account_id, nome, ruolo, attivo, accounts(company_name)')
    .eq('user_id', currentUser.id)
    .eq('attivo', true)
    .maybeSingle();

  if (operatore) {
    currentOperatore = operatore;
    localStorage.setItem('charlotte_account_id', operatore.account_id);
    localStorage.setItem('charlotte_company', operatore.accounts?.company_name || '');
    localStorage.setItem('charlotte_ruolo', 'operatore');
    localStorage.setItem('charlotte_operatore_id', operatore.id);
    localStorage.setItem('charlotte_operatore_nome', operatore.nome);
    mostraSchermata('main-screen');
    inizializzaApp();
    aggiornaHeaderRuolo();
    return;
  }

  // Né owner né operatore
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = 'Account non associato a nessuna società. Contatta il tuo responsabile.';
  await sbClient.auth.signOut();
}

// ── REGISTRAZIONE ────────────────────────────────────────────

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
  if (error) { errEl.textContent = error.message; return; }

  currentUser = data.user;

  // Controlla se c'è un invito pendente per questa email
  const { data: operatore } = await sbClient
    .from('operatori')
    .select('id, account_id, nome, accounts(company_name)')
    .eq('email', email)
    .is('user_id', null)
    .maybeSingle();

  if (operatore) {
    // Collega l'utente all'operatore esistente
    await sbClient.from('operatori')
      .update({ user_id: data.user.id })
      .eq('id', operatore.id);

    errEl.style.color = 'var(--green)';
    errEl.textContent = `✓ Account creato! Sei stato collegato a ${operatore.accounts?.company_name}. Accedi ora.`;
    setTimeout(() => mostraLogin(), 2000);
  } else {
    // Nuovo owner — vai all'onboarding
    await dopoLogin();
  }
}

// ── RESET PASSWORD ───────────────────────────────────────────

async function doResetPassword() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-error');
  if (!email) { errEl.textContent = 'Inserisci la tua email per il reset.'; return; }
  await sbClient.auth.resetPasswordForEmail(email);
  errEl.style.color = 'var(--green)';
  errEl.textContent = 'Email di reset inviata. Controlla la casella.';
  setTimeout(() => { errEl.style.color = ''; errEl.textContent = ''; }, 4000);
}

// ── LOGOUT ───────────────────────────────────────────────────

async function doLogout() {
  await sbClient.auth.signOut();
  currentUser = null;
  currentOperatore = null;
  localStorage.removeItem('charlotte_pin');
  localStorage.removeItem('charlotte_account_id');
  localStorage.removeItem('charlotte_company');
  localStorage.removeItem('charlotte_ruolo');
  localStorage.removeItem('charlotte_operatore_id');
  localStorage.removeItem('charlotte_operatore_nome');
  mostraSchermata('login-screen');
}

// ── PIN ──────────────────────────────────────────────────────

let pinCorrente = '';
const PIN_LUNGHEZZA = 4;

function aggiornaDotsPin(hasError = false) {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('filled', 'error');
    if (hasError) dot.classList.add('error');
    else if (i < pinCorrente.length) dot.classList.add('filled');
  });
}

function premicifraPIN(cifra) {
  if (pinCorrente.length >= PIN_LUNGHEZZA) return;
  pinCorrente += cifra;
  aggiornaDotsPin();
  if (pinCorrente.length === PIN_LUNGHEZZA) setTimeout(verificaPin, 150);
}

function cancellaCifraPIN() {
  pinCorrente = pinCorrente.slice(0, -1);
  aggiornaDotsPin();
}

function verificaPin() {
  const bloccatoFino = localStorage.getItem('charlotte_pin_bloccato');
  if (bloccatoFino && Date.now() < parseInt(bloccatoFino)) {
    const minuti = Math.ceil((parseInt(bloccatoFino) - Date.now()) / 60000);
    document.getElementById('pin-error').textContent = `Troppi tentativi. Riprova tra ${minuti} min.`;
    pinCorrente = '';
    aggiornaDotsPin();
    return;
  }

  const pinSalvato = localStorage.getItem('charlotte_pin');
  if (pinCorrente === pinSalvato) {
    localStorage.removeItem('charlotte_pin_tentativi');
    localStorage.removeItem('charlotte_pin_bloccato');
    pinCorrente = '';
    aggiornaDotsPin();
    document.getElementById('pin-error').textContent = '';
    mostraSchermata('main-screen');
    inizializzaApp();
    aggiornaHeaderRuolo();
  } else {
    aggiornaDotsPin(true);
    let tentativi = parseInt(localStorage.getItem('charlotte_pin_tentativi') || '0') + 1;
    localStorage.setItem('charlotte_pin_tentativi', tentativi);
    if (tentativi >= PIN_MAX_TENTATIVI) {
      localStorage.setItem('charlotte_pin_bloccato', Date.now() + PIN_BLOCCO_MINUTI * 60 * 1000);
      localStorage.removeItem('charlotte_pin_tentativi');
      document.getElementById('pin-error').textContent = `Bloccato per ${PIN_BLOCCO_MINUTI} minuti.`;
    } else {
      document.getElementById('pin-error').textContent = `PIN errato. Tentativi rimasti: ${PIN_MAX_TENTATIVI - tentativi}`;
    }
    setTimeout(() => { pinCorrente = ''; aggiornaDotsPin(); }, 600);
  }
}

// ── SESSIONE ALL'AVVIO ───────────────────────────────────────

async function controllaSessione() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await dopoLogin();
  } else {
    mostraSchermata('login-screen');
  }
}

// ── UTILITY ─────────────────────────────────────────────────

function aggiornaNomeSocietà(nome) {
  const el = document.getElementById('company-name-header');
  if (el) el.textContent = nome || 'Charlotte';
}

function aggiornaHeaderRuolo() {
  const ruolo = localStorage.getItem('charlotte_ruolo');
  const ownerBtn = document.getElementById('owner-btn-header');
  if (ownerBtn) {
    ownerBtn.style.display = ruolo === 'owner' ? 'inline-block' : 'none';
  }
  // Mostra nome operatore se non owner
  if (ruolo === 'operatore') {
    const nomeOp = localStorage.getItem('charlotte_operatore_nome');
    aggiornaNomeSocietà(localStorage.getItem('charlotte_company'));
    const el = document.getElementById('company-name-header');
    if (el && nomeOp) el.textContent = nomeOp;
  }
}

function isOwner() {
  return localStorage.getItem('charlotte_ruolo') === 'owner';
}
