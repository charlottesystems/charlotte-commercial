// ============================================================
// CHARLOTTE COMMERCIAL — tariffe.js
// Calcolo importo soste, tariffe standard e convenzioni
// ============================================================

const CATEGORIE = [
  { id: 'moto',        label: 'Moto',        icon: '🏍️' },
  { id: 'piccola',     label: 'Auto Piccola', icon: '🚗' },
  { id: 'media',       label: 'Auto Media',   icon: '🚙' },
  { id: 'grande',      label: 'Auto Grande',  icon: '🚐' },
  { id: 'luxury_van',  label: 'Luxury/Van',   icon: '🚌' },
];

// ── CARICA TARIFFE GARAGE ────────────────────────────────────

async function caricaTariffeGarage(garageId) {
  const { data, error } = await sbClient
    .from('tariffe')
    .select('*')
    .eq('garage_id', garageId);
  if (error) return [];
  return data || [];
}

async function caricaConvenzioniGarage(garageId) {
  const { data, error } = await sbClient
    .from('convenzioni')
    .select('*, tariffe_convenzioni(*)')
    .eq('garage_id', garageId)
    .eq('attiva', true);
  if (error) return [];
  return data || [];
}

// ── CALCOLO IMPORTO ──────────────────────────────────────────

/**
 * Calcola l'importo di una sosta.
 * @param {Date} ingresso - Data/ora ingresso
 * @param {Date} uscita - Data/ora uscita
 * @param {string} categoria - Categoria veicolo
 * @param {Object|null} convenzione - Oggetto convenzione (con tariffe_convenzioni)
 * @param {Object} tariffa - Riga tariffe dal DB
 * @returns {Object} { importo, dettaglio }
 */
function calcolaImporto(ingresso, uscita, categoria, convenzione, tariffa) {
  const durataMs = uscita - ingresso;
  const durataMinuti = Math.floor(durataMs / 60000);
  const durataOre = durataMinuti / 60;

  // ── CONVENZIONE ──────────────────────────────────────────
  if (convenzione) {
    const tc = convenzione.tariffe_convenzioni?.find(t => t.categoria === categoria);
    if (tc) {
      // Quanti giorni interi + eventuale extra
      const giorniInteri = Math.floor(durataOre / 24);
      const oreExtra = durataOre - (giorniInteri * 24);
      const tolleranza = tariffa?.tolleranza_minuti || 30;

      let importo = (giorniInteri || 1) * tc.prezzo_giornaliero;

      // Se supera la tolleranza del giornaliero, aggiunge un altro giorno
      if (giorniInteri >= 1 && oreExtra > (tolleranza / 60)) {
        importo += tc.prezzo_giornaliero;
      }

      return {
        importo: Math.max(importo, tc.prezzo_giornaliero),
        dettaglio: `Convenzione ${convenzione.nome} — ${categoria} — ${formatDurata(durataMinuti)}`
      };
    }
  }

  // ── TARIFFA STANDARD ────────────────────────────────────
  if (!tariffa) {
    return { importo: 0, dettaglio: 'Nessuna tariffa configurata' };
  }

  const soglia = tariffa.soglia_giornaliero_ore || 4;
  const tolleranzaMin = tariffa.tolleranza_minuti || 30;
  const prezzoGiornaliero = tariffa.prezzo_giornaliero || 0;
  const prezzoPrimaOra = tariffa.prezzo_prima_ora || 0;
  const prezzoOraSucc = tariffa.prezzo_ora_successiva || 0;

  // Calcola per ogni blocco di 24h
  let importoTotale = 0;
  let minutiRimanenti = durataMinuti;
  let dettaglioParti = [];

  while (minutiRimanenti > 0) {
    const oreBloccco = minutiRimanenti / 60;

    if (oreBloccco >= soglia) {
      // Scatta tariffa giornaliera
      importoTotale += prezzoGiornaliero;
      dettaglioParti.push(`1 giornaliero €${prezzoGiornaliero.toFixed(2)}`);
      minutiRimanenti -= 24 * 60; // consuma 24h

      // Controlla tolleranza per i minuti extra
      if (minutiRimanenti > 0 && minutiRimanenti <= tolleranzaMin) {
        // Dentro tolleranza — non addebita
        minutiRimanenti = 0;
      }
    } else {
      // Tariffa oraria
      const oreIntere = Math.ceil(oreBloccco);
      let importoOrario = 0;

      if (oreIntere >= 1) {
        importoOrario += prezzoPrimaOra;
        if (oreIntere > 1) {
          importoOrario += (oreIntere - 1) * prezzoOraSucc;
        }
      } else if (minutiRimanenti > 0) {
        // Meno di un'ora — addebita prima ora
        importoOrario = prezzoPrimaOra;
      }

      importoTotale += importoOrario;
      dettaglioParti.push(`${oreIntere}h orario €${importoOrario.toFixed(2)}`);
      minutiRimanenti = 0;
    }
  }

  return {
    importo: importoTotale,
    dettaglio: `${formatDurata(durataMinuti)} — ${dettaglioParti.join(' + ')}`
  };
}

// ── UTILITY ─────────────────────────────────────────────────

function formatDurata(minuti) {
  if (minuti < 60) return `${minuti}min`;
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatEuro(importo) {
  return `€ ${parseFloat(importo || 0).toFixed(2)}`;
}
