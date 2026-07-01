// ============================================================
// CHARLOTTE COMMERCIAL — stampa.js
// Stampa ticket termici ESC/POS via Bluetooth + fallback browser
// ============================================================

// ── COSTANTI ESC/POS ─────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const CMD = {
  INIT:           [ESC, 0x40],
  ALIGN_LEFT:     [ESC, 0x61, 0x00],
  ALIGN_CENTER:   [ESC, 0x61, 0x01],
  ALIGN_RIGHT:    [ESC, 0x61, 0x02],
  BOLD_ON:        [ESC, 0x45, 0x01],
  BOLD_OFF:       [ESC, 0x45, 0x00],
  DOUBLE_ON:      [GS,  0x21, 0x11],
  DOUBLE_OFF:     [GS,  0x21, 0x00],
  CUT:            [GS,  0x56, 0x41, 0x10],
  LINE:           [LF],
};

// UUID servizi BLE comuni per stampanti termiche
// NOTA: Web Bluetooth supporta solo BLE, NON Bluetooth Classic (SPP/RFCOMM).
// Stampanti Classic BT non appariranno nella lista — richiedono app nativa Android.
const BT_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Xprinter BLE (XP-P300, XP-P323B...)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Rongta (RPP02N, RPP200...)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // iSAP / Microchip BM70
  'af9b58e0-d60a-11e3-9c1a-0800200c9a66', // Epson TM-P20/P60 BLE
  '18f0',                                  // short UUID Xprinter
  '1101',                                  // SPP short (alcuni BLE dual-mode)
];

const BT_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '000018f1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'af9b58e2-d60a-11e3-9c1a-0800200c9a66', // Epson write char
];

let btDevice = null;
let btCharacteristic = null;

// ── CONNESSIONE BLUETOOTH ────────────────────────────────────

async function connettiBluetooth() {
  if (!navigator.bluetooth) {
    return { ok: false, motivo: 'Bluetooth non supportato da questo browser. Usa Chrome su Android.' };
  }

  try {
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BT_SERVICE_UUIDS
    });

    const server = await btDevice.gatt.connect();

    // Prova tutti i service UUID noti
    for (const serviceUuid of BT_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        for (const charUuid of BT_CHAR_UUIDS) {
          try {
            btCharacteristic = await service.getCharacteristic(charUuid);
            return { ok: true };
          } catch {}
        }
        // Se non trova char specifico, prova il primo disponibile
        const chars = await service.getCharacteristics();
        if (chars.length > 0) {
          btCharacteristic = chars[0];
          return { ok: true };
        }
      } catch {}
    }

    return { ok: false, motivo: 'Stampante connessa ma caratteristica non trovata. Se la tua stampante usa Bluetooth Classic (non BLE), non è compatibile con Chrome — usa l\'app del produttore per stampare.' };
  } catch (e) {
    if (e.name === 'NotFoundError') return { ok: false, motivo: 'Nessuna stampante selezionata.' };
    if (e.name === 'NotSupportedError') return { ok: false, motivo: 'Stampante non compatibile BLE. Se è una stampante Classic Bluetooth, usa la stampa browser oppure l\'app del produttore.' };
    return { ok: false, motivo: e.message };
  }
}

async function inviaBytes(bytes) {
  if (!btCharacteristic) return false;
  const chunk = 512;
  for (let i = 0; i < bytes.length; i += chunk) {
    await btCharacteristic.writeValue(new Uint8Array(bytes.slice(i, i + chunk)));
    await new Promise(r => setTimeout(r, 50));
  }
  return true;
}

// ── COSTRUZIONE TICKET ───────────────────────────────────────

function testoBytes(testo) {
  return Array.from(new TextEncoder().encode(testo));
}

function riga58(testo, lunghezza = 32) {
  return testo.substring(0, lunghezza).padEnd(lunghezza);
}

function separatore(char = '-', lunghezza = 32) {
  return char.repeat(lunghezza);
}

function buildTicketIngresso(sosta, nomeGarage) {
  const now = new Date(sosta.ingresso_at);
  const data = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ora = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);

  let bytes = [
    ...CMD.INIT,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...CMD.DOUBLE_ON,
    ...testoBytes(nomeGarage.toUpperCase()), LF,
    ...CMD.DOUBLE_OFF,
    ...CMD.BOLD_OFF,
    ...testoBytes(separatore()), LF,
    ...CMD.BOLD_ON,
    ...testoBytes('TICKET INGRESSO'), LF,
    ...CMD.BOLD_OFF,
    ...testoBytes(separatore()), LF,
    LF,
    ...CMD.ALIGN_LEFT,
    ...testoBytes('Targa:'), LF,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...CMD.DOUBLE_ON,
    ...testoBytes(sosta.targa), LF,
    ...CMD.DOUBLE_OFF,
    ...CMD.BOLD_OFF,
    LF,
    ...CMD.ALIGN_LEFT,
    ...testoBytes('Categoria : ' + (cat?.label || sosta.tipo_veicolo)), LF,
    ...testoBytes('Data      : ' + data), LF,
    ...testoBytes('Ora       : ' + ora), LF,
    LF,
    ...CMD.ALIGN_CENTER,
    ...testoBytes(separatore()), LF,
    ...testoBytes('Conservare fino all\'uscita'), LF,
    ...testoBytes(separatore()), LF,
    LF, LF, LF,
    ...CMD.CUT,
  ];
  return bytes;
}

function buildTicketUscita(sosta, nomeGarage) {
  const ingresso = new Date(sosta.ingresso_at);
  const uscita = new Date(sosta.uscita_at || new Date());
  const dataI = ingresso.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const oraI = ingresso.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const dataU = uscita.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const oraU = uscita.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const durata = calcolaDurata(sosta.ingresso_at, sosta.uscita_at);
  const importo = sosta.importo ? 'EUR ' + parseFloat(sosta.importo).toFixed(2) : 'N/D';
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);

  let bytes = [
    ...CMD.INIT,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...CMD.DOUBLE_ON,
    ...testoBytes(nomeGarage.toUpperCase()), LF,
    ...CMD.DOUBLE_OFF,
    ...CMD.BOLD_OFF,
    ...testoBytes(separatore()), LF,
    ...CMD.BOLD_ON,
    ...testoBytes('TICKET USCITA'), LF,
    ...CMD.BOLD_OFF,
    ...testoBytes(separatore()), LF,
    LF,
    ...CMD.ALIGN_LEFT,
    ...testoBytes('Targa:'), LF,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...CMD.DOUBLE_ON,
    ...testoBytes(sosta.targa), LF,
    ...CMD.DOUBLE_OFF,
    ...CMD.BOLD_OFF,
    LF,
    ...CMD.ALIGN_LEFT,
    ...testoBytes('Categoria : ' + (cat?.label || sosta.tipo_veicolo)), LF,
    ...testoBytes(separatore('.')), LF,
    ...testoBytes('Ingresso  : ' + dataI + ' ' + oraI), LF,
    ...testoBytes('Uscita    : ' + dataU + ' ' + oraU), LF,
    ...testoBytes('Durata    : ' + durata), LF,
    ...testoBytes(separatore('.')), LF,
    LF,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...CMD.DOUBLE_ON,
    ...testoBytes('IMPORTO: ' + importo), LF,
    ...CMD.DOUBLE_OFF,
    ...CMD.BOLD_OFF,
    LF,
    ...testoBytes(separatore()), LF,
    ...testoBytes('Grazie per aver scelto'), LF,
    ...testoBytes(nomeGarage), LF,
    ...testoBytes(separatore()), LF,
    LF, LF, LF,
    ...CMD.CUT,
  ];
  return bytes;
}

// ── FUNZIONI PRINCIPALI ──────────────────────────────────────

async function stampaTicketIngresso(sosta) {
  const nomeGarage = garageCorrente?.name || 'Garage';

  if (btCharacteristic && btDevice?.gatt?.connected) {
    const bytes = buildTicketIngresso(sosta, nomeGarage);
    await inviaBytes(bytes);
    return;
  }

  // Fallback: stampa browser
  stampaFallbackIngresso(sosta, nomeGarage);
}

async function stampaTicketUscita(sosta) {
  const nomeGarage = garageCorrente?.name || 'Garage';

  if (btCharacteristic && btDevice?.gatt?.connected) {
    const bytes = buildTicketUscita(sosta, nomeGarage);
    await inviaBytes(bytes);
    return;
  }

  // Fallback: stampa browser
  stampaFallbackUscita(sosta, nomeGarage);
}

// ── FALLBACK STAMPA BROWSER ──────────────────────────────────

function stampaFallbackIngresso(sosta, nomeGarage) {
  const ingresso = new Date(sosta.ingresso_at);
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  const win = window.open('', '_blank', 'width=300,height=400');
  win.document.write(ticketHTML(
    nomeGarage, 'INGRESSO', sosta.targa,
    cat?.label || sosta.tipo_veicolo,
    ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    null, null, null
  ));
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

function stampaFallbackUscita(sosta, nomeGarage) {
  const ingresso = new Date(sosta.ingresso_at);
  const uscita = new Date(sosta.uscita_at || new Date());
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  const win = window.open('', '_blank', 'width=300,height=500');
  win.document.write(ticketHTML(
    nomeGarage, 'USCITA', sosta.targa,
    cat?.label || sosta.tipo_veicolo,
    ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    uscita.toLocaleDateString('it-IT') + ' ' + uscita.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    calcolaDurata(sosta.ingresso_at, sosta.uscita_at),
    sosta.importo ? 'EUR ' + parseFloat(sosta.importo).toFixed(2) : null
  ));
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

function ticketHTML(garage, tipo, targa, categoria, ingresso, uscita, durata, importo) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    @page { margin: 0; size: 58mm auto; }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width: 58mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; padding: 3mm 4mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    .xlarge { font-size: 20px; }
    .sep { border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
  <div class="center bold large">${garage.toUpperCase()}</div>
  <div class="sep"></div>
  <div class="center bold">TICKET ${tipo}</div>
  <div class="sep"></div>
  <br>
  <div class="center">Targa:</div>
  <div class="center bold xlarge">${targa}</div>
  <br>
  <div class="sep" style="border-style:dotted"></div>
  <div class="row"><span>Categoria:</span><span>${categoria}</span></div>
  <div class="row"><span>Ingresso:</span><span>${ingresso}</span></div>
  ${uscita ? '<div class="row"><span>Uscita:</span><span>' + uscita + '</span></div>' : ''}
  ${durata ? '<div class="row"><span>Durata:</span><span>' + durata + '</span></div>' : ''}
  <div class="sep" style="border-style:dotted"></div>
  ${importo ? '<br><div class="center bold large">IMPORTO: ' + importo + '</div><br>' : '<br><div class="center">Conservare fino all\'uscita</div><br>'}
  <div class="sep"></div>
  <div class="center">Grazie</div>
  </body></html>`;
}

// ── GESTIONE CONNESSIONE UI ──────────────────────────────────

async function gestisciConnessioneBT() {
  if (btDevice?.gatt?.connected) {
    btDevice.gatt.disconnect();
    btDevice = null;
    btCharacteristic = null;
    aggiornaStatoBT();
    return;
  }

  const stato = document.getElementById('bt-stato');
  if (stato) { stato.textContent = 'Connessione...'; stato.style.color = 'var(--amber)'; }

  const { ok, motivo } = await connettiBluetooth();

  if (ok) {
    aggiornaStatoBT();
    btDevice.addEventListener('gattserverdisconnected', () => {
      btDevice = null; btCharacteristic = null; aggiornaStatoBT();
    });
  } else {
    if (stato) { stato.textContent = motivo || 'Errore connessione'; stato.style.color = 'var(--red)'; }
  }
}

function aggiornaStatoBT() {
  const btn = document.getElementById('bt-btn');
  const stato = document.getElementById('bt-stato');
  const connesso = btDevice?.gatt?.connected;
  if (btn) {
    const labelEl = document.getElementById('bt-label');
    if (labelEl) labelEl.textContent = connesso ? 'Stampante connessa' : 'Connetti stampante';
    else btn.textContent = connesso ? '🔵 Stampante connessa' : '⚪ Connetti stampante';
    btn.style.borderColor = connesso ? 'var(--green)' : 'var(--border)';
    btn.style.color = connesso ? 'var(--green)' : 'var(--muted)';
  }
  if (stato) {
    stato.textContent = connesso ? 'Pronta per la stampa' : 'Nessuna stampante — stampa su browser';
    stato.style.color = connesso ? 'var(--green)' : 'var(--muted)';
  }
}
