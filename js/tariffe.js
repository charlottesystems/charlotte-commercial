// ============================================================
// CHARLOTTE COMMERCIAL — tariffe.js
// Calcolo importo soste, tariffe standard e convenzioni
// ============================================================

const CATEGORIE_LABELS = {
  it: { moto: 'Moto', piccola: 'Auto Piccola', media: 'Auto Media', grande: 'Auto Grande', luxury_van: 'Luxury/Van' },
  en: { moto: 'Motorcycle', piccola: 'Small Car', media: 'Medium Car', grande: 'Large Car', luxury_van: 'Luxury/Van' }
};

function getCategorieLabels() {
  const lang = localStorage.getItem('charlotte_lang') || 'it';
  return CATEGORIE_LABELS[lang] || CATEGORIE_LABELS['it'];
}

const CATEGORIE = [
  { id: 'moto',       get label() { return getCategorieLabels().moto; },       icon: '🏍️' },
  { id: 'piccola',    get label() { return getCategorieLabels().piccola; },    icon: '🚗' },
  { id: 'media',      get label() { return getCategorieLabels().media; },      icon: '🚙' },
  { id: 'grande',     get label() { return getCategorieLabels().grande; },     icon: '🚐' },
  { id: 'luxury_van', get label() { return getCategorieLabels().luxury_van; }, icon: '🚌' },
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
      const tolleranzaGiorn = tariffa?.tolleranza_minuti || 30;
      const giorniInteri = Math.floor(durataOre / 24);
      const oreExtra = durataOre - (giorniInteri * 24);

      let importo = (giorniInteri || 1) * tc.prezzo_giornaliero;

      if (giorniInteri >= 1 && oreExtra > (tolleranzaGiorn / 60)) {
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
  const tolleranzaGiornMin = tariffa.tolleranza_minuti || 30;
  const tolleranzaOraMin = tariffa.tolleranza_ora_minuti ?? 10;
  const prezzoGiornaliero = tariffa.prezzo_giornaliero || 0;
  const prezzoPrimaOra = tariffa.prezzo_prima_ora || 0;
  const prezzoOraSucc = tariffa.prezzo_ora_successiva || 0;

  let importoTotale = 0;
  let minutiRimanenti = durataMinuti;
  let dettaglioParti = [];

  while (minutiRimanenti > 0) {
    const oreBloccco = minutiRimanenti / 60;

    if (oreBloccco >= soglia) {
      // Scatta tariffa giornaliera
      importoTotale += prezzoGiornaliero;
      dettaglioParti.push(`1 giornaliero €${prezzoGiornaliero.toFixed(2)}`);
      minutiRimanenti -= 24 * 60;

      // Controlla tolleranza fine giornaliero
      if (minutiRimanenti > 0 && minutiRimanenti <= tolleranzaGiornMin) {
        minutiRimanenti = 0;
      }
    } else {
      // Tariffa oraria con tolleranza per ora
      // Prima ora: sempre piena
      let importoOrario = 0;
      let oreConteggiate = 0;

      if (minutiRimanenti <= 0) break;

      // Prima ora
      importoOrario += prezzoPrimaOra;
      oreConteggiate = 1;
      minutiRimanenti -= 60;

      // Ore successive con tolleranza
      while (minutiRimanenti > 0) {
        if (minutiRimanenti <= tolleranzaOraMin) {
          // Dentro tolleranza — non addebita altra ora
          minutiRimanenti = 0;
          break;
        }
        importoOrario += prezzoOraSucc;
        oreConteggiate++;
        minutiRimanenti -= 60;
      }

      importoTotale += importoOrario;
      dettaglioParti.push(`${oreConteggiate}h orario €${importoOrario.toFixed(2)}`);
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
