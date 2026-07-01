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

// Bridge nativo Android (Bluetooth Classic, SPP/RFCOMM) — iniettato da WebViewActivity
// Presente solo quando l'app gira dentro la WebView nativa Charlotte
const CHARLOTTE_BT = window.CharlotteBT || null;
let charlotteBtAddress = null; // indirizzo MAC del dispositivo nativo connesso

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

function buildIntestazione(garage) {
  // ragione_sociale e piva sono dati aziendali (account), letti da localStorage
  const ragioneSociale = localStorage.getItem('charlotte_ragione_sociale') || '';
  const piva = localStorage.getItem('charlotte_piva') || '';

  const bytes = [...CMD.ALIGN_CENTER];
  let haIntestazione = false;

  if (ragioneSociale) {
    bytes.push(...CMD.BOLD_ON, ...testoBytes(ragioneSociale.toUpperCase()), LF, ...CMD.BOLD_OFF);
    haIntestazione = true;
  }
  if (garage?.address) {
    bytes.push(...testoBytes(garage.address), LF);
    haIntestazione = true;
  }
  if (garage?.telefono || piva) {
    let riga = '';
    if (garage?.telefono) riga += 'TEL ' + garage.telefono;
    if (garage?.telefono && piva) riga += '  ';
    if (piva) riga += 'P.IVA ' + piva;
    bytes.push(...testoBytes(riga), LF);
    haIntestazione = true;
  }
  if (garage?.orario_apertura && garage?.orario_chiusura) {
    bytes.push(...testoBytes('ORARIO ' + garage.orario_apertura + '-' + garage.orario_chiusura), LF);
    haIntestazione = true;
  }
  if (haIntestazione) {
    bytes.push(...testoBytes(separatore('-')), LF);
  }
  return bytes;
}

function buildTicketIngresso(sosta, nomeGarage, garage) {
  nomeGarage = 'GARAGE ' + nomeGarage;
  const now = new Date(sosta.ingresso_at);
  const data = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ora = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);

  let bytes = [
    ...CMD.INIT,
    ...buildIntestazione(garage),
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
    ...(sosta.modello_auto ? [...testoBytes('Modello   : ' + sosta.modello_auto), LF] : []),
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

function buildTicketUscita(sosta, nomeGarage, garage) {
  nomeGarage = 'GARAGE ' + nomeGarage;
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
    ...buildIntestazione(garage),
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
    ...(sosta.modello_auto ? [...testoBytes('Modello   : ' + sosta.modello_auto), LF] : []),
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

// ── CANVAS TICKET (per Web Share → Print Label) ──────────────

function disegnaTicketCanvas(righe) {
  const W = 384; // 58mm a ~168dpi, buona risoluzione per stampante termica
  const FONT = '22px Courier New';
  const FONT_BOLD = 'bold 22px Courier New';
  const FONT_LARGE = 'bold 32px Courier New';
  const FONT_XLARGE = 'bold 46px Courier New';
  const PAD = 16;
  const LINE = 28;

  // Prima passata: calcola altezza
  let y = PAD;
  for (const r of righe) {
    if (r.type === 'sep') y += 20;
    else if (r.type === 'spacer') y += 14;
    else y += (r.size === 'xl' ? 52 : r.size === 'lg' ? 38 : LINE);
  }
  y += PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = y;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = '#000000';

  let cy = PAD;
  for (const r of righe) {
    if (r.type === 'sep') {
      ctx.save();
      ctx.setLineDash(r.dot ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(PAD, cy + 10);
      ctx.lineTo(W - PAD, cy + 10);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      cy += 20;
    } else if (r.type === 'spacer') {
      cy += 14;
    } else {
      const fh = r.size === 'xl' ? 46 : r.size === 'lg' ? 32 : 22;
      ctx.font = r.size === 'xl' ? FONT_XLARGE : r.size === 'lg' ? FONT_LARGE : (r.bold ? FONT_BOLD : FONT);
      cy += fh + 4;
      if (r.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(r.text, W / 2, cy);
      } else if (r.right) {
        ctx.textAlign = 'left';
        ctx.fillText(r.text, PAD, cy);
        ctx.textAlign = 'right';
        ctx.fillText(r.right, W - PAD, cy);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(r.text, PAD, cy);
      }
      cy += 2;
    }
  }

  return canvas;
}

function ticketRigheIngresso(garage, targa, categoria, ingressoStr, modello) {
  const righe = [
    { type: 'text', text: garage.toUpperCase(), align: 'center', bold: true, size: 'lg' },
    { type: 'sep' },
    { type: 'text', text: 'TICKET INGRESSO', align: 'center', bold: true },
    { type: 'sep' },
    { type: 'spacer' },
    { type: 'text', text: 'Targa:', align: 'center' },
    { type: 'text', text: targa, align: 'center', bold: true, size: 'xl' },
    { type: 'spacer' },
    { type: 'sep', dot: true },
    { type: 'text', text: 'Categoria:', right: categoria },
  ];
  if (modello) righe.push({ type: 'text', text: 'Modello:', right: modello });
  righe.push(
    { type: 'text', text: 'Ingresso:', right: ingressoStr },
    { type: 'sep', dot: true },
    { type: 'spacer' },
    { type: 'text', text: 'Conservare fino all\'uscita', align: 'center' },
    { type: 'sep' },
  );
  return righe;
}

function ticketRigheUscita(garage, targa, categoria, ingressoStr, uscitaStr, durata, importo, modello) {
  const righe = [
    { type: 'text', text: garage.toUpperCase(), align: 'center', bold: true, size: 'lg' },
    { type: 'sep' },
    { type: 'text', text: 'TICKET USCITA', align: 'center', bold: true },
    { type: 'sep' },
    { type: 'spacer' },
    { type: 'text', text: 'Targa:', align: 'center' },
    { type: 'text', text: targa, align: 'center', bold: true, size: 'xl' },
    { type: 'spacer' },
    { type: 'sep', dot: true },
    { type: 'text', text: 'Categoria:', right: categoria },
  ];
  if (modello) righe.push({ type: 'text', text: 'Modello:', right: modello });
  righe.push(
    { type: 'text', text: 'Ingresso:', right: ingressoStr },
    { type: 'text', text: 'Uscita:', right: uscitaStr },
    { type: 'text', text: 'Durata:', right: durata },
    { type: 'sep', dot: true },
    { type: 'spacer' }
  );
  if (importo) {
    righe.push({ type: 'text', text: 'IMPORTO: ' + importo, align: 'center', bold: true, size: 'lg' });
    righe.push({ type: 'spacer' });
  }
  righe.push({ type: 'sep' });
  righe.push({ type: 'text', text: 'Grazie per aver scelto', align: 'center' });
  righe.push({ type: 'text', text: garage, align: 'center' });
  return righe;
}

async function condividiOStampa(canvas, nomeFile) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], nomeFile, { type: 'image/png' });

      // 1. Prova Web Share con file (Android Chrome — funziona con app che accettano immagini)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Ticket Charlotte Parking' });
          resolve('share');
          return;
        } catch (e) {
          if (e.name === 'AbortError') { resolve('abort'); return; }
          // share non riuscita, continua con download
        }
      }

      // 2. Download diretto — appare nella barra notifiche Android
      //    L'utente tocca il file scaricato → "Apri con" → seleziona Print Label
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // Avvisa l'utente di aprire il file scaricato
      setTimeout(() => {
        alert('Ticket salvato. Apri il file scaricato dalla barra delle notifiche e scegli "Stampa con Print Label".');
      }, 500);

      resolve('download');
    }, 'image/png');
  });
}

// ── FUNZIONI PRINCIPALI ──────────────────────────────────────

async function stampaTicketIngresso(sosta) {
  const nomeGarage = 'GARAGE ' + (garageCorrente?.name || 'Garage');

  // 1. Bridge nativo Android (Bluetooth Classic — MPT-II e simili)
  if (CHARLOTTE_BT) {
    if (!CHARLOTTE_BT.isConnected()) {
      await gestisciConnessioneBTNativa();
    }
    if (!CHARLOTTE_BT.isConnected()) {
      alert('Stampante non connessa. Riprova.');
      return;
    }
    const bytes = buildTicketIngresso(sosta, nomeGarage, garageCorrente);
    const result = CHARLOTTE_BT.printBytes(bytes.join(','));
    if (result !== 'ok') alert('Errore stampa: ' + result);
    return;
  }

  // 2. Web Bluetooth BLE
  if (btCharacteristic && btDevice?.gatt?.connected) {
    const bytes = buildTicketIngresso(sosta, nomeGarage, garageCorrente);
    await inviaBytes(bytes);
    return;
  }

  // Web Share / Download come immagine PNG (compatibile con Print Label)
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  const ingresso = new Date(sosta.ingresso_at);
  const ingressoStr = ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
  const canvas = disegnaTicketCanvas(ticketRigheIngresso(nomeGarage, sosta.targa, cat?.label || sosta.tipo_veicolo, ingressoStr, sosta.modello_auto));
  await condividiOStampa(canvas, 'ticket-ingresso.png');
}

async function stampaTicketUscita(sosta) {
  const nomeGarage = 'GARAGE ' + (garageCorrente?.name || 'Garage');

  // 1. Bridge nativo Android (Bluetooth Classic — MPT-II e simili)
  if (CHARLOTTE_BT) {
    if (!CHARLOTTE_BT.isConnected()) {
      await gestisciConnessioneBTNativa();
    }
    if (!CHARLOTTE_BT.isConnected()) {
      alert('Stampante non connessa. Riprova.');
      return;
    }
    const bytes = buildTicketUscita(sosta, nomeGarage, garageCorrente);
    const result = CHARLOTTE_BT.printBytes(bytes.join(','));
    if (result !== 'ok') alert('Errore stampa: ' + result);
    return;
  }

  // 2. Web Bluetooth BLE
  if (btCharacteristic && btDevice?.gatt?.connected) {
    const bytes = buildTicketUscita(sosta, nomeGarage, garageCorrente);
    await inviaBytes(bytes);
    return;
  }

  // Web Share / Download come immagine PNG (compatibile con Print Label)
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  const ingresso = new Date(sosta.ingresso_at);
  const uscita = new Date(sosta.uscita_at || new Date());
  const ingressoStr = ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
  const uscitaStr = uscita.toLocaleDateString('it-IT') + ' ' + uscita.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
  const canvas = disegnaTicketCanvas(ticketRigheUscita(nomeGarage, sosta.targa, cat?.label || sosta.tipo_veicolo, ingressoStr, uscitaStr, calcolaDurata(sosta.ingresso_at, sosta.uscita_at), sosta.importo ? 'EUR ' + parseFloat(sosta.importo).toFixed(2) : null, sosta.modello_auto));
  await condividiOStampa(canvas, 'ticket-uscita.png');
}

// ── FALLBACK STAMPA BROWSER ──────────────────────────────────

function stampaFallback(html) {
  // Inietta il ticket in un iframe nascosto nella pagina corrente per evitare
  // il blocco popup di Chrome su Android, poi stampa e rimuove l'iframe.
  let iframe = document.getElementById('_charlotte_print_frame');
  if (iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = '_charlotte_print_frame';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:58mm;height:0;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 400);
}

function stampaFallbackIngresso(sosta, nomeGarage) {
  const ingresso = new Date(sosta.ingresso_at);
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  stampaFallback(ticketHTML(
    nomeGarage, 'INGRESSO', sosta.targa,
    cat?.label || sosta.tipo_veicolo,
    ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    null, null, null
  ));
}

function stampaFallbackUscita(sosta, nomeGarage) {
  const ingresso = new Date(sosta.ingresso_at);
  const uscita = new Date(sosta.uscita_at || new Date());
  const cat = CATEGORIE.find(c => c.id === sosta.tipo_veicolo);
  stampaFallback(ticketHTML(
    nomeGarage, 'USCITA', sosta.targa,
    cat?.label || sosta.tipo_veicolo,
    ingresso.toLocaleDateString('it-IT') + ' ' + ingresso.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    uscita.toLocaleDateString('it-IT') + ' ' + uscita.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    calcolaDurata(sosta.ingresso_at, sosta.uscita_at),
    sosta.importo ? 'EUR ' + parseFloat(sosta.importo).toFixed(2) : null
  ));
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
  // Se siamo nell'app nativa, mostra lista dispositivi accoppiati
  if (CHARLOTTE_BT) {
    await gestisciConnessioneBTNativa();
    return;
  }

  // Web Bluetooth BLE
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

async function gestisciConnessioneBTNativa() {
  // Disconnetti se già connesso
  if (CHARLOTTE_BT.isConnected()) {
    CHARLOTTE_BT.disconnect();
    charlotteBtAddress = null;
    aggiornaStatoBT();
    return;
  }

  const stato = document.getElementById('bt-stato');

  // Leggi dispositivi accoppiati
  let dispositivi = [];
  try {
    dispositivi = JSON.parse(CHARLOTTE_BT.getDevicesPaired());
  } catch (e) {
    if (stato) { stato.textContent = 'Errore lettura dispositivi BT'; stato.style.color = 'var(--red)'; }
    return;
  }

  if (dispositivi.length === 0) {
    alert('Nessun dispositivo Bluetooth accoppiato. Vai in Impostazioni → Bluetooth e accoppia la stampante MPT-II.');
    return;
  }

  // Crea dialog selezione dispositivo
  const scelta = await new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--card);border-radius:12px;padding:20px;width:min(90vw,340px);';
    box.innerHTML = '<div style="font-weight:600;margin-bottom:12px;">Seleziona stampante</div>';
    dispositivi.forEach(d => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text);cursor:pointer;font-size:14px;';
      btn.textContent = d.name + '\n' + d.address;
      btn.style.whiteSpace = 'pre-line';
      btn.onclick = () => { document.body.removeChild(overlay); resolve(d.address); };
      box.appendChild(btn);
    });
    const annulla = document.createElement('button');
    annulla.style.cssText = 'display:block;width:100%;padding:10px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:14px;margin-top:4px;';
    annulla.textContent = 'Annulla';
    annulla.onclick = () => { document.body.removeChild(overlay); resolve(null); };
    box.appendChild(annulla);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });

  if (!scelta) return;

  if (stato) { stato.textContent = 'Connessione in corso...'; stato.style.color = 'var(--amber)'; }

  const result = CHARLOTTE_BT.connect(scelta);
  alert('Risultato connessione: ' + result);
  if (result === 'ok') {
    charlotteBtAddress = scelta;
    aggiornaStatoBT();
  } else {
    charlotteBtAddress = null;
    if (stato) { stato.textContent = result; stato.style.color = 'var(--red)'; }
  }
}

function initStampa() {
  // Nell'app nativa Android con bridge BT Classic, nascondi il pulsante BLE
  if (CHARLOTTE_BT) {
    const btn = document.getElementById('bt-btn');
    if (btn) btn.style.display = 'none';
  }
}

function aggiornaStatoBT() {
  const btn = document.getElementById('bt-btn');
  const stato = document.getElementById('bt-stato');

  // Controlla stato: prima bridge nativo, poi BLE
  const nativoConnesso = CHARLOTTE_BT?.isConnected() || false;
  const bleConnesso = !nativoConnesso && (btDevice?.gatt?.connected || false);
  const connesso = nativoConnesso || bleConnesso;
  const nomeDispositivo = nativoConnesso ? (CHARLOTTE_BT.getConnectedName() || 'Stampante') : null;

  if (btn) {
    const labelEl = document.getElementById('bt-label');
    const label = connesso ? ('Connesso: ' + (nomeDispositivo || 'Stampante BLE')) : 'Connetti stampante';
    if (labelEl) labelEl.textContent = label;
    else btn.textContent = connesso ? ('🔵 ' + label) : '⚪ Connetti stampante';
    btn.style.borderColor = connesso ? 'var(--green)' : 'var(--border)';
    btn.style.color = connesso ? 'var(--green)' : 'var(--muted)';
  }
  if (stato) {
    stato.textContent = connesso ? 'Pronta per la stampa' : 'Nessuna stampante — stampa su browser';
    stato.style.color = connesso ? 'var(--green)' : 'var(--muted)';
  }
}
