// ============================================================
// CHARLOTTE COMMERCIAL — lang.js
// Sistema multilingua IT / EN
// ============================================================

const TRANSLATIONS = {
  it: {
    // Login
    login_title: 'Parking Management',
    login_email: 'Email',
    login_password: 'Password',
    login_btn: 'ACCEDI',
    login_create: 'Crea account owner →',
    login_forgot: 'Password dimenticata?',
    login_operator: '👤 Sono un operatore',
    login_buy: 'Non hai ancora un piano? Acquista qui →',
    login_register_title: 'Crea un nuovo account owner',
    login_reg_email: 'Email',
    login_reg_pass: 'Password (min. 6 caratteri)',
    login_reg_pass2: 'Conferma password',
    login_reg_btn: 'REGISTRATI',
    login_back: '← Torna al login',
    // PIN operatore
    op_pin_title: 'Accesso Operatore',
    op_pin_sub: 'Inserisci il tuo PIN a 6 cifre',
    // Home
    stat_insosta: 'In sosta',
    stat_oggi: 'Oggi',
    stat_mese: 'Mese',
    btn_ingresso: 'Ingresso',
    btn_ingresso_sub: 'Registra entrata',
    btn_uscita: 'Uscita',
    btn_uscita_sub: 'Registra uscita',
    btn_lista: 'Lista',
    btn_lista_sub: 'Soste attive',
    btn_badge: 'Badge',
    btn_badge_sub: 'Timbra turno',
    btn_cassa: 'Cassa',
    btn_cassa_sub: 'Registro giornaliero',
    // Ingresso
    ingresso_title: '🚗 Ingresso',
    targa_placeholder: 'Scansiona o inserisci targa',
    btn_fotocamera: 'FOTOCAMERA',
    btn_galleria: 'GALLERIA',
    label_manuale: 'Inserimento manuale',
    label_categoria: 'Categoria veicolo',
    label_convenzione: 'Convenzione',
    btn_conferma_ingresso: '✓ CONFERMA INGRESSO',
    // Uscita
    uscita_title: '🏁 Uscita',
    nessuna_sosta: 'Nessuna auto in sosta',
    btn_uscita_quick: 'USCITA',
    // Overlay uscita
    conferma_uscita_title: 'CONFERMA USCITA',
    label_importo: 'IMPORTO',
    btn_annulla: '✕ ANNULLA',
    btn_conferma: '✓ CONFERMA',
    // Lista
    lista_title: '📋 Lista Soste',
    in_sosta_ora: 'In sosta ora',
    uscite_oggi: 'Uscite oggi',
    nessuna_sosta_oggi: 'Nessuna sosta oggi',
    // Ricerca
    ricerca_title: '🔍 Cerca Targa',
    nessun_risultato: 'Nessun risultato',
    // Cassa
    cassa_title: '💰 Cassa del giorno',
    incasso_oggi: 'Incasso oggi',
    uscite_label: 'Uscite oggi',
    in_sosta_label: 'In sosta',
    dettaglio_soste: 'Dettaglio soste chiuse oggi',
    btn_csv: '📥 Esporta CSV',
    nessuna_chiusa: 'Nessuna sosta chiusa oggi',
    // Badge
    badge_title: '📍 Timbra Turno',
    badge_nessuna: 'Nessuna timbratura recente',
    badge_entrata: 'ENTRATA',
    badge_uscita: 'USCITA',
    badge_premi: 'Premi un bottone per timbrare',
    btn_cambia_nome: '✏️ Cambia nome operatore',
    // Overlay ingresso
    ingresso_registrato: 'INGRESSO REGISTRATO',
    // Messaggi errore
    err_nessun_garage: 'Nessun garage selezionato.',
    err_gps_negato: 'GPS non autorizzato',
    err_gps_desc: 'La timbratura richiede l\'accesso alla posizione GPS per verificare che tu sia nel garage.',
    btn_gps_reload: '✓ Ho abilitato il GPS — Ricarica',
    btn_annulla_gps: 'Annulla',
    // Owner lock
    owner_lock_title: 'Pannello Owner',
    owner_lock_sub: 'Inserisci la password owner per continuare',
    owner_lock_placeholder: 'Password owner',
    owner_lock_btn: 'ACCEDI',
    owner_lock_annulla: 'Annulla',
    // Lingua
    lingua_label: 'Lingua',
  },
  en: {
    // Login
    login_title: 'Parking Management',
    login_email: 'Email',
    login_password: 'Password',
    login_btn: 'SIGN IN',
    login_create: 'Create owner account →',
    login_forgot: 'Forgot password?',
    login_operator: '👤 I am an operator',
    login_buy: 'No plan yet? Purchase here →',
    login_register_title: 'Create a new owner account',
    login_reg_email: 'Email',
    login_reg_pass: 'Password (min. 6 characters)',
    login_reg_pass2: 'Confirm password',
    login_reg_btn: 'REGISTER',
    login_back: '← Back to login',
    // PIN operatore
    op_pin_title: 'Operator Access',
    op_pin_sub: 'Enter your 6-digit PIN',
    // Home
    stat_insosta: 'Parked',
    stat_oggi: 'Today',
    stat_mese: 'Month',
    btn_ingresso: 'Entry',
    btn_ingresso_sub: 'Register arrival',
    btn_uscita: 'Exit',
    btn_uscita_sub: 'Register departure',
    btn_lista: 'List',
    btn_lista_sub: 'Active stays',
    btn_badge: 'Badge',
    btn_badge_sub: 'Clock in/out',
    btn_cassa: 'Cash',
    btn_cassa_sub: 'Daily register',
    // Ingresso
    ingresso_title: '🚗 Entry',
    targa_placeholder: 'Scan or enter plate',
    btn_fotocamera: 'CAMERA',
    btn_galleria: 'GALLERY',
    label_manuale: 'Manual entry',
    label_categoria: 'Vehicle category',
    label_convenzione: 'Convention',
    btn_conferma_ingresso: '✓ CONFIRM ENTRY',
    // Uscita
    uscita_title: '🏁 Exit',
    nessuna_sosta: 'No vehicles parked',
    btn_uscita_quick: 'EXIT',
    // Overlay uscita
    conferma_uscita_title: 'CONFIRM EXIT',
    label_importo: 'AMOUNT',
    btn_annulla: '✕ CANCEL',
    btn_conferma: '✓ CONFIRM',
    // Lista
    lista_title: '📋 Stays List',
    in_sosta_ora: 'Currently parked',
    uscite_oggi: 'Exited today',
    nessuna_sosta_oggi: 'No stays today',
    // Ricerca
    ricerca_title: '🔍 Search Plate',
    nessun_risultato: 'No results',
    // Cassa
    cassa_title: '💰 Daily Cash',
    incasso_oggi: 'Today\'s revenue',
    uscite_label: 'Exits today',
    in_sosta_label: 'Parked',
    dettaglio_soste: 'Closed stays today',
    btn_csv: '📥 Export CSV',
    nessuna_chiusa: 'No closed stays today',
    // Badge
    badge_title: '📍 Clock In/Out',
    badge_nessuna: 'No recent clock-in',
    badge_entrata: 'CLOCK IN',
    badge_uscita: 'CLOCK OUT',
    badge_premi: 'Press a button to clock in/out',
    btn_cambia_nome: '✏️ Change operator name',
    // Overlay ingresso
    ingresso_registrato: 'ENTRY REGISTERED',
    // Messaggi errore
    err_nessun_garage: 'No garage selected.',
    err_gps_negato: 'GPS not authorized',
    err_gps_desc: 'Clock-in requires GPS access to verify you are at the garage.',
    btn_gps_reload: '✓ I enabled GPS — Reload',
    btn_annulla_gps: 'Cancel',
    // Owner lock
    owner_lock_title: 'Owner Panel',
    owner_lock_sub: 'Enter your owner password to continue',
    owner_lock_placeholder: 'Owner password',
    owner_lock_btn: 'ACCESS',
    owner_lock_annulla: 'Cancel',
    // Lingua
    lingua_label: 'Language',
  }
};

// ── GESTIONE LINGUA ──────────────────────────────────────────

let currentLang = localStorage.getItem('charlotte_lang') || 'it';

// Applica lingua immediatamente al caricamento
document.addEventListener('DOMContentLoaded', function() { setTimeout(applicaTraduzioni, 300); });

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['it'][key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('charlotte_lang', lang);
  applicaTraduzioni();
}

function applicaTraduzioni() {
  const lang = currentLang;
  const en = lang === 'en';

  // Elementi statici della pagina
  const map = {
    'targa-placeholder': en ? 'Scan or enter plate' : 'Scansiona o inserisci targa',
    'stat-attive': null, // valori numerici, non tradurre
  };

  // Label statistiche
  const lbls = document.querySelectorAll('.stat .lbl');
  const lblTexts = en ? ['Parked','Today','Month'] : ['In sosta','Oggi','Mese'];
  lbls.forEach((l,i) => { if (lblTexts[i]) l.textContent = lblTexts[i]; });

  // Bottoni griglia - traduzione per testo invece che per indice
  const btnMap = {
    'Ingresso': 'Entry', 'Entry': 'Entry',
    'Uscita': 'Exit', 'Exit': 'Exit',
    'Lista': 'List', 'List': 'List',
    'Badge': 'Badge',
    'Cassa': 'Cash', 'Cash': 'Cash',
  };
  const subMap = {
    'Registra entrata': 'Register arrival', 'Register arrival': 'Register arrival',
    'Registra uscita': 'Register departure', 'Register departure': 'Register departure',
    'Soste attive': 'Active stays', 'Active stays': 'Active stays',
    'Timbra turno': 'Clock in/out', 'Clock in/out': 'Clock in/out',
    'Registro giornaliero': 'Daily register', 'Daily register': 'Daily register',
  };

  document.querySelectorAll('.btn-label').forEach(el => {
    const testo = el.textContent.trim();
    if (en && btnMap[testo]) el.textContent = btnMap[testo];
    else if (!en) {
      for (const [it, eng] of Object.entries(btnMap)) {
        if (eng === testo && it !== eng) { el.textContent = it; break; }
      }
    }
  });
  document.querySelectorAll('.btn-sub').forEach(el => {
    const testo = el.textContent.trim();
    if (en && subMap[testo]) el.textContent = subMap[testo];
    else if (!en) {
      for (const [it, eng] of Object.entries(subMap)) {
        if (eng === testo) { el.textContent = it; break; }
      }
    }
  });

  // Titoli schermate
  const titoli = document.querySelectorAll('.screen-title');
  const titoliMap = {
    '🚗 Ingresso': '🚗 Entry',
    '🏁 Uscita': '🏁 Exit',
    '📋 Lista Soste': '📋 Stays List',
    '📍 Timbra Turno': '📍 Clock In/Out',
    '💰 Cassa del giorno': '💰 Daily Cash',
    '🔍 Cerca Targa': '🔍 Search Plate',
  };
  titoli.forEach(el => {
    const testo = el.textContent.trim();
    if (en && titoliMap[testo]) el.textContent = titoliMap[testo];
    else if (!en) {
      // Trova chiave italiana
      for (const [it, eng] of Object.entries(titoliMap)) {
        if (eng === testo) { el.textContent = it; break; }
      }
    }
  });

  // Login form
  const loginBtn = document.querySelector('#login-form .wz-btn-primary');
  if (loginBtn) loginBtn.textContent = en ? 'SIGN IN' : 'ACCEDI';
  const regBtn = document.querySelector('#login-form .wz-btn-secondary');
  if (regBtn) regBtn.textContent = en ? 'Create owner account →' : 'Crea account owner →';
  const opBtn = document.querySelector('#operatore-pin-form .pin-logo-text');
  if (opBtn) opBtn.textContent = en ? 'Operator Access' : 'Accesso Operatore';
  const opSub = document.querySelector('#operatore-pin-form .pin-subtitle');
  if (opSub) opSub.textContent = en ? 'Enter your 6-digit PIN' : 'Inserisci il tuo PIN a 6 cifre';

  // Overlay uscita
  const confUscita = document.querySelector('#overlay-uscita .overlay-title');
  if (confUscita) confUscita.textContent = en ? 'CONFIRM EXIT' : 'CONFERMA USCITA';
  const labelImporto = document.querySelector('#overlay-uscita [style*="margin-bottom:4px"]');
  if (labelImporto) labelImporto.textContent = en ? 'AMOUNT' : 'IMPORTO';

  // Badge
  const badgeStato = document.getElementById('badge-stato');
  if (badgeStato && (badgeStato.textContent === 'Premi un bottone per timbrare' || badgeStato.textContent === 'Press a button to clock in/out')) {
    badgeStato.textContent = en ? 'Press a button to clock in/out' : 'Premi un bottone per timbrare';
  }

  // Bottoni entrata/uscita badge
  const btnEntrata = document.getElementById('badge-btn-entrata');
  if (btnEntrata) btnEntrata.innerHTML = (en ? '🟢<br>CLOCK IN' : '🟢<br>ENTRATA');
  const btnUscita = document.getElementById('badge-btn-uscita');
  if (btnUscita) btnUscita.innerHTML = (en ? '🔴<br>CLOCK OUT' : '🔴<br>USCITA');

  // Elementi hardcoded nella schermata ingresso
  const targaPlaceholder = document.getElementById('targa-placeholder');
  if (targaPlaceholder) targaPlaceholder.textContent = en ? 'Scan or enter plate' : 'Scansiona o inserisci targa';

  document.querySelectorAll('.btn-txt').forEach(el => {
    if (el.textContent === 'FOTOCAMERA' || el.textContent === 'CAMERA') el.textContent = en ? 'CAMERA' : 'FOTOCAMERA';
    if (el.textContent === 'GALLERIA' || el.textContent === 'GALLERY') el.textContent = en ? 'GALLERY' : 'GALLERIA';
  });

  document.querySelectorAll('.manual-label').forEach(el => {
    if (el.textContent === 'Inserimento manuale' || el.textContent === 'Manual entry') el.textContent = en ? 'Manual entry' : 'Inserimento manuale';
    if (el.textContent === 'Categoria veicolo' || el.textContent === 'Vehicle category') el.textContent = en ? 'Vehicle category' : 'Categoria veicolo';
    if (el.textContent === 'Convenzione' || el.textContent === 'Convention') el.textContent = en ? 'Convention' : 'Convenzione';
  });

  const confBtn = document.getElementById('conferma-ingresso-btn');
  if (confBtn) confBtn.textContent = en ? 'CONFIRM ENTRY' : 'CONFERMA INGRESSO';

  const manualInput = document.getElementById('manual-targa-input');
  if (manualInput) manualInput.placeholder = en ? 'AB123CD' : 'AB123CD';

  // Overlay ingresso
  const olIngresso = document.querySelector('#overlay-ingresso .overlay-title');
  if (olIngresso) olIngresso.textContent = en ? 'ENTRY REGISTERED' : 'INGRESSO REGISTRATO';

  // Uscita
  const noSoste = document.querySelector('#soste-attive-list .empty-text');
  if (noSoste) noSoste.textContent = en ? 'No vehicles parked' : 'Nessuna auto in sosta';

  // Badge
  const cambiaNome = document.querySelector('#badge-screen button[onclick="cambioNomeOperatore()"]');
  if (cambiaNome) cambiaNome.textContent = en ? 'Change operator name' : 'Cambia nome operatore';

  // Owner lock
  const ownerLockTitle = document.querySelector('.owner-lock .pin-logo-text');
  if (ownerLockTitle) ownerLockTitle.textContent = en ? 'Owner Panel' : 'Pannello Owner';
  const ownerLockSub = document.querySelector('.owner-lock .pin-subtitle');
  if (ownerLockSub) ownerLockSub.textContent = en ? 'Enter owner password to continue' : 'Inserisci la password owner per continuare';
  const ownerLockPwd = document.getElementById('owner-lock-password');
  if (ownerLockPwd) ownerLockPwd.placeholder = en ? 'Owner password' : 'Password owner';
  const ownerLockBtn = document.querySelector('.owner-lock .wz-btn-primary');
  if (ownerLockBtn) ownerLockBtn.textContent = en ? 'ACCESS' : 'ACCEDI';
  const ownerLockCanc = document.querySelector('.owner-lock .wz-btn-secondary');
  if (ownerLockCanc) ownerLockCanc.textContent = en ? 'Cancel' : 'Annulla';

  // Traduci categorie veicolo
  const catMap = {
    'Moto': 'Motorcycle', 'Motorcycle': 'Motorcycle',
    'Auto Piccola': 'Small Car', 'Small Car': 'Small Car',
    'Auto Media': 'Medium Car', 'Medium Car': 'Medium Car',
    'Auto Grande': 'Large Car', 'Large Car': 'Large Car',
    'Luxury/Van': 'Luxury/Van',
  };
  document.querySelectorAll('.tipo-btn, .conv-btn').forEach(el => {
    const testo = el.textContent.trim();
    for (const [it, eng] of Object.entries(catMap)) {
      if (en && testo.includes(it)) { el.innerHTML = el.innerHTML.replace(it, eng); break; }
      if (!en && testo.includes(eng) && it !== eng) { el.innerHTML = el.innerHTML.replace(eng, it); break; }
    }
  });

  // Aggiorna label bottone lingua
  const langBtn = document.getElementById('lang-btn-label');
  if (langBtn) langBtn.textContent = en ? 'Italiano' : 'English';
  const langLoginBtn = document.getElementById('lang-login-btn');
  if (langLoginBtn) langLoginBtn.textContent = en ? 'Italiano' : 'English';

  // Aggiorna data-i18n se presenti
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) el.textContent = TRANSLATIONS[lang][key];
  });
}

function getLangFlag() {
  return currentLang === 'en' ? '🇬🇧' : '🇮🇹';
}

function toggleLang() {
  setLang(currentLang === 'it' ? 'en' : 'it');
}
