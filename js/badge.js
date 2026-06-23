// ============================================================
// CHARLOTTE COMMERCIAL — badge.js
// Timbratura turni via GPS
// Operatore: nome fisso dal PIN, GPS obbligatorio
// Owner: scelta libera di operatore e garage
// ============================================================

const RAGGIO_DEFAULT_METRI = 50;

// ── TIMBRATURA GPS ───────────────────────────────────────────

async function timbra(tipo) {
  const accountId = localStorage.getItem('charlotte_account_id');
  const ruolo = localStorage.getItem('charlotte_ruolo');
  if (!accountId) { alert('Nessun account trovato.'); return; }

  const stato = document.getElementById('badge-stato');
  const btn = document.getElementById('badge-btn-' + tipo);
  if (btn) btn.disabled = true;

  if (ruolo === 'operatore') {
    await timbraOperatore(tipo, stato);
  } else {
    await timbraOwner(tipo, stato);
  }

  if (btn) btn.disabled = false;
}

// ── TIMBRATURA OPERATORE (nome fisso dal PIN, GPS obbligatorio) ──

async function timbraOperatore(tipo, stato) {
  const nomeOperatore = localStorage.getItem('charlotte_operatore_nome');
  const accountId = localStorage.getItem('charlotte_account_id');

  if (!nomeOperatore) {
    if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Sessione operatore non valida. Riaccedi con il tuo PIN.'; }
    return;
  }

  if (!garageCorrente) {
    if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Nessun garage selezionato.'; }
    return;
  }

  // Verifica coordinate GPS obbligatorie
  if (!garageCorrente.lat || !garageCorrente.lng) {
    if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Coordinate GPS del garage non configurate. Contatta il responsabile.'; }
    return;
  }

  if (stato) { stato.textContent = '📡 Rilevamento posizione...'; stato.style.color = 'var(--muted)'; }

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const distanza = calcolaDistanza(lat, lng, garageCorrente.lat, garageCorrente.lng);
    const raggio = garageCorrente.raggio_metri || RAGGIO_DEFAULT_METRI;

    if (distanza > raggio) {
      if (stato) {
        stato.style.color = 'var(--red)';
        stato.textContent = `❌ Sei a ${Math.round(distanza)}m dal garage. Devi essere entro ${raggio}m per timbrare.`;
      }
      return;
    }

    await salvaTimbrata(accountId, garageCorrente.id, nomeOperatore, tipo, lat, lng, Math.round(distanza));

    const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (stato) {
      stato.style.color = 'var(--green)';
      stato.textContent = `✅ ${tipo === 'entrata' ? 'Entrata' : 'Uscita'} timbrata alle ${ora} (${Math.round(distanza)}m dal garage)`;
    }

    localStorage.setItem('charlotte_ultimo_badge', tipo);
    localStorage.setItem('charlotte_ultimo_badge_ora', ora);
    aggiornaUIBadge();

  } catch (err) {
    if (stato) {
      stato.style.color = 'var(--red)';
      if (err.code === 1) stato.textContent = '❌ Permesso GPS negato. Abilita la posizione.';
      else if (err.code === 2) stato.textContent = '❌ GPS non disponibile. Riprova.';
      else if (err.code === 3) stato.textContent = '❌ Timeout GPS. Vai all\'aperto e riprova.';
      else stato.textContent = '❌ Errore GPS: ' + (err.message || 'sconosciuto');
    }
  }
}

// ── TIMBRATURA OWNER (scelta libera) ────────────────────────

async function timbraOwner(tipo, stato) {
  const accountId = localStorage.getItem('charlotte_account_id');

  // Carica lista operatori
  const { data: operatori } = await sbClient
    .from('operatori')
    .select('id, nome')
    .eq('account_id', accountId)
    .eq('attivo', true)
    .order('nome');

  if (!operatori || operatori.length === 0) {
    if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Nessun operatore configurato.'; }
    return;
  }

  // Mostra dialog selezione operatore e garage
  const nomiOperatori = operatori.map(o => o.nome).join('\n');
  const sceltaNome = prompt('Seleziona operatore (scrivi il nome esatto):\n\n' + nomiOperatori);
  if (!sceltaNome?.trim()) return;

  const operatore = operatori.find(o => o.nome.toLowerCase() === sceltaNome.trim().toLowerCase());
  if (!operatore) {
    alert('Operatore non trovato. Scrivi esattamente il nome come mostrato.');
    return;
  }

  const garageId = garageCorrente?.id;
  if (!garageId) {
    if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Nessun garage selezionato.'; }
    return;
  }

  await salvaTimbrata(accountId, garageId, operatore.nome, tipo, null, null, null);

  const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (stato) {
    stato.style.color = 'var(--green)';
    stato.textContent = `✅ ${tipo === 'entrata' ? 'Entrata' : 'Uscita'} timbrata per ${operatore.nome} alle ${ora}`;
  }

  localStorage.setItem('charlotte_ultimo_badge', tipo);
  localStorage.setItem('charlotte_ultimo_badge_ora', ora);
  aggiornaUIBadge();
}

// ── SALVA TIMBRATA ───────────────────────────────────────────

async function salvaTimbrata(accountId, garageId, nomeOperatore, tipo, lat, lng, distanza) {
  const { error } = await sbClient.from('turni').insert({
    garage_id: garageId,
    account_id: accountId,
    operatore_nome: nomeOperatore,
    tipo: tipo,
    lat: lat,
    lng: lng,
    distanza_metri: distanza,
    timbrato_at: new Date().toISOString()
  });

  if (error) throw new Error('Errore salvataggio: ' + error.message);
}

// ── UI BADGE ─────────────────────────────────────────────────

function aggiornaUIBadge() {
  const ultimoBadge = localStorage.getItem('charlotte_ultimo_badge');
  const ultimaOra = localStorage.getItem('charlotte_ultimo_badge_ora');
  const ruolo = localStorage.getItem('charlotte_ruolo');
  const nomeOp = localStorage.getItem('charlotte_operatore_nome');

  const elNome = document.getElementById('badge-nome-operatore');
  const elUltimo = document.getElementById('badge-ultimo');
  const btnEntrata = document.getElementById('badge-btn-entrata');
  const btnUscita = document.getElementById('badge-btn-uscita');

  if (elNome) {
    elNome.textContent = ruolo === 'operatore' ? (nomeOp || '—') : 'Accesso Owner';
  }

  if (ultimoBadge && ultimaOra) {
    if (elUltimo) elUltimo.textContent = `Ultima timbratura: ${ultimoBadge === 'entrata' ? 'Entrata' : 'Uscita'} alle ${ultimaOra}`;
    if (btnEntrata) btnEntrata.style.opacity = ultimoBadge === 'entrata' ? '0.5' : '1';
    if (btnUscita) btnUscita.style.opacity = ultimoBadge === 'uscita' ? '0.5' : '1';
  }
}

// ── CALCOLO DISTANZA GPS (Haversine) ─────────────────────────

function calcolaDistanza(lat1, lng1, lat2, lng2) {
  if (!lat2 || !lng2) return 99999;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── CAMBIO NOME (solo per compatibilità, non usato da operatori) ──

function cambioNomeOperatore() {
  const ruolo = localStorage.getItem('charlotte_ruolo');
  if (ruolo === 'operatore') {
    alert('Il tuo nome è associato al tuo PIN di accesso e non può essere modificato.');
    return;
  }
  // Per owner non serve
}
