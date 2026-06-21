// ============================================================
// CHARLOTTE COMMERCIAL — auth.js
// Login, logout, PIN, gestione sessione
// ============================================================

let sbClient = null;
let currentUser = null;

// Inizializza il client Supabase (chiamato dopo che supabase CDN è caricato)
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
  // Controlla se l'utente ha già completato l'onboarding
  const { data: account } = await sbClient
    .from('accounts')
    .select('id, company_name, onboarding_complete')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

  if (!account || !account.onboarding_complete) {
    mostraSchermata('onboarding-screen');
    avviaWizard();
  } else {
    localStorage.setItem('charlotte_account_id', account.id);
    localStorage.setItem('charlotte_company', account.company_name);
    mostraSchermata('pin-screen');
    aggiornaNomeSocietà(account.company_name);
  }
}

// ── RESET PASSWORD ───────────────────────────────────────────

async function doResetPassword() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-error');
  if (!email) {
    errEl.textContent = 'Inserisci la tua email per il reset.';
    return;
  }
  await sbClient.auth.resetPasswordForEmail(email);
  errEl.style.color = 'var(--green)';
  errEl.textContent = 'Email di reset inviata. Controlla la casella.';
  setTimeout(() => { errEl.style.color = ''; errEl.textContent = ''; }, 4000);
}

// ── LOGOUT ───────────────────────────────────────────────────

async function doLogout() {
  await sbClient.auth.signOut();
  currentUser = null;
  localStorage.removeItem('charlotte_pin');
  localStorage.removeItem('charlotte_account_id');
  localStorage.removeItem('charlotte_company');
  mostraSchermata('login-screen');
}

// ── PIN ──────────────────────────────────────────────────────

let pinCorrente = '';
const PIN_LUNGHEZZA = 4;

function aggiornaDotsPin(hasError = false) {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('filled', 'error');
    if (hasError) {
      dot.classList.add('error');
    } else if (i < pinCorrente.length) {
      dot.classList.add('filled');
    }
  });
}

function premicifraPIN(cifra) {
  if (pinCorrente.length >= PIN_LUNGHEZZA) return;
  pinCorrente += cifra;
  aggiornaDotsPin();
  if (pinCorrente.length === PIN_LUNGHEZZA) {
    setTimeout(verificaPin, 150);
  }
}

function cancellaCifraPIN() {
  pinCorrente = pinCorrente.slice(0, -1);
  aggiornaDotsPin();
}

function verificaPin() {
  // Controlla blocco
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
    // PIN corretto
    localStorage.removeItem('charlotte_pin_tentativi');
    localStorage.removeItem('charlotte_pin_bloccato');
    pinCorrente = '';
    aggiornaDotsPin();
    document.getElementById('pin-error').textContent = '';
    mostraSchermata('main-screen');
    inizializzaApp();
  } else {
    // PIN errato
    aggiornaDotsPin(true);
    let tentativi = parseInt(localStorage.getItem('charlotte_pin_tentativi') || '0') + 1;
    localStorage.setItem('charlotte_pin_tentativi', tentativi);
    if (tentativi >= PIN_MAX_TENTATIVI) {
      const bloccaFino = Date.now() + PIN_BLOCCO_MINUTI * 60 * 1000;
      localStorage.setItem('charlotte_pin_bloccato', bloccaFino);
      localStorage.removeItem('charlotte_pin_tentativi');
      document.getElementById('pin-error').textContent = `Bloccato per ${PIN_BLOCCO_MINUTI} minuti.`;
    } else {
      document.getElementById('pin-error').textContent = `PIN errato. Tentativi rimasti: ${PIN_MAX_TENTATIVI - tentativi}`;
    }
    setTimeout(() => {
      pinCorrente = '';
      aggiornaDotsPin();
    }, 600);
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
