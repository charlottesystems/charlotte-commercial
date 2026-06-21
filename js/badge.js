// ============================================================
// CHARLOTTE COMMERCIAL — badge.js
// Timbratura turni via GPS
// ============================================================

const RAGGIO_DEFAULT_METRI = 100; // raggio default garage

// ── TIMBRATURA GPS ───────────────────────────────────────────

async function timbra(tipo) {
  const accountId = localStorage.getItem('charlotte_account_id');
  if (!accountId || !garageCorrente) {
    alert('Nessun garage selezionato.');
    return;
  }

  // Chiedi nome operatore se non salvato
  let nomeOperatore = localStorage.getItem('charlotte_operatore_nome');
  if (!nomeOperatore) {
    nomeOperatore = prompt('Inserisci il tuo nome:');
    if (!nomeOperatore?.trim()) return;
    localStorage.setItem('charlotte_operatore_nome', nomeOperatore.trim());
  }

  // Mostra stato
  const btn = document.getElementById(`badge-btn-${tipo}`);
  const stato = document.getElementById('badge-stato');
  if (btn) btn.disabled = true;
  if (stato) stato.textContent = '📡 Rilevamento posizione...';

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

    // Calcola distanza dal garage
    const distanza = calcolaDistanza(
      lat, lng,
      garageCorrente.lat, garageCorrente.lng
    );

    const raggio = garageCorrente.raggio_metri || RAGGIO_DEFAULT_METRI;

    if (distanza > raggio) {
      if (stato) {
        stato.style.color = 'var(--red)';
        stato.textContent = `❌ Sei a ${Math.round(distanza)}m dal garage. Devi essere entro ${raggio}m.`;
      }
      if (btn) btn.disabled = false;
      return;
    }

    // Salva timbratura
    const { error } = await sbClient.from('turni').insert({
      garage_id: garageCorrente.id,
      account_id: accountId,
      operatore_nome: nomeOperatore,
      tipo: tipo,
      lat: lat,
      lng: lng,
      distanza_metri: Math.round(distanza),
      timbrato_at: new Date().toISOString()
    });

    if (error) throw error;

    // Aggiorna UI
    const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (stato) {
      stato.style.color = 'var(--green)';
      stato.textContent = `✅ ${tipo === 'entrata' ? 'Entrata' : 'Uscita'} timbrata alle ${ora} (${Math.round(distanza)}m dal garage)`;
    }

    // Aggiorna stato badge
    localStorage.setItem('charlotte_ultimo_badge', tipo);
    localStorage.setItem('charlotte_ultimo_badge_ora', ora);
    aggiornaUIBadge();

  } catch (err) {
    if (err.code === 1) {
      if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Permesso GPS negato. Abilita la posizione nel browser.'; }
    } else if (err.code === 2) {
      if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ GPS non disponibile. Riprova.'; }
    } else if (err.code === 3) {
      if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Timeout GPS. Riprova all\'aperto.'; }
    } else {
      if (stato) { stato.style.color = 'var(--red)'; stato.textContent = '❌ Errore: ' + (err.message || 'sconosciuto'); }
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function aggiornaUIBadge() {
  const ultimoBadge = localStorage.getItem('charlotte_ultimo_badge');
  const ultimaOra = localStorage.getItem('charlotte_ultimo_badge_ora');
  const nomeOp = localStorage.getItem('charlotte_operatore_nome');

  const elNome = document.getElementById('badge-nome-operatore');
  const elUltimo = document.getElementById('badge-ultimo');
  const btnEntrata = document.getElementById('badge-btn-entrata');
  const btnUscita = document.getElementById('badge-btn-uscita');

  if (elNome && nomeOp) elNome.textContent = nomeOp;

  if (ultimoBadge && ultimaOra) {
    if (elUltimo) elUltimo.textContent = `Ultima timbratura: ${ultimoBadge === 'entrata' ? 'Entrata' : 'Uscita'} alle ${ultimaOra}`;
    // Suggerisci il prossimo badge
    if (btnEntrata) btnEntrata.style.opacity = ultimoBadge === 'entrata' ? '0.4' : '1';
    if (btnUscita) btnUscita.style.opacity = ultimoBadge === 'uscita' ? '0.4' : '1';
  }
}

// ── CALCOLO DISTANZA GPS (formula Haversine) ─────────────────

function calcolaDistanza(lat1, lng1, lat2, lng2) {
  if (!lat2 || !lng2) return 0; // garage senza coordinate → sempre ok
  const R = 6371000; // raggio terra in metri
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ── CAMBIO NOME OPERATORE ────────────────────────────────────

function cambioNomeOperatore() {
  const nuovo = prompt('Inserisci il tuo nome:');
  if (nuovo?.trim()) {
    localStorage.setItem('charlotte_operatore_nome', nuovo.trim());
    aggiornaUIBadge();
  }
}
