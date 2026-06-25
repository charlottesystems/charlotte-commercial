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

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['it'][key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('charlotte_lang', lang);
  applicaTraduzioni();
}

function applicaTraduzioni() {
  // Applica traduzioni a tutti gli elementi con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });

  // Aggiorna placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

function getLangFlag() {
  return currentLang === 'en' ? '🇬🇧' : '🇮🇹';
}

function toggleLang() {
  setLang(currentLang === 'it' ? 'en' : 'it');
}
