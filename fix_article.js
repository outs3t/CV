const fs = require('fs');
const f = 'D:/Nicola/Documenti/CV/Curriculum.html';
let html = fs.readFileSync(f, 'utf8');

const adRadiusIdMarker = "id: 'ad-radius'";
const backupDrMarker = "id: 'backup-dr'";

const adStart = html.indexOf(adRadiusIdMarker);
const backupStart = html.indexOf(backupDrMarker);

if (adStart === -1 || backupStart === -1) {
  console.error('Markers not found', adStart, backupStart);
  process.exit(1);
}

// Find the article: ` start within the ad-radius block
const articleStart = html.indexOf('article:', adStart);
if (articleStart === -1 || articleStart > backupStart) {
  console.error('article: not found in ad-radius block');
  process.exit(1);
}

// Find the closing `}, before {id: 'backup-dr'
// We look for the last `}, sequence before backupStart
const closingSeq = '`},';
let closingIdx = -1;
let searchFrom = articleStart;
while (true) {
  const idx = html.indexOf(closingSeq, searchFrom);
  if (idx === -1 || idx > backupStart) break;
  closingIdx = idx;
  searchFrom = idx + 1;
}

if (closingIdx === -1) {
  console.error('closing backtick-}, not found');
  process.exit(1);
}

console.log('articleStart:', articleStart, 'closingIdx:', closingIdx);
console.log('Article length:', closingIdx - articleStart, 'chars');

// Build clean replacement: a JSON string with a placeholder article
const cleanText = "## Progetto: Autenticazione Wi-Fi Enterprise tramite Google Workspace (RADIUS + LDAP)\n\nLa scuola aveva la necessità di implementare un sistema di **autenticazione centralizzata Wi-Fi**, basato su credenziali **Google Workspace (GSuite)**, per garantire accesso sicuro e tracciato alla rete da parte di studenti e docenti.\n\n---\n\n### Infrastruttura di partenza\n\nL'istituto disponeva già di un'infrastruttura hardware di alto livello:\n\n* Hewlett Packard Enterprise **ProLiant DL380 Gen10**\n* CPU **Intel Xeon Silver 4110**\n* **128 GB RAM**\n* Storage: **2 SSD 300 GB** + **2 HDD SAS 600 GB**\n\n---\n\n### Architettura adottata\n\n* Virtualizzazione tramite **Proxmox VE**\n* VM dedicata: **Debian Linux**\n\n---\n\n### Implementazione RADIUS\n\n* **FreeRADIUS 3.2** installato su VM Debian\n* IP statico, client RADIUS configurati (AP + firewall Zyxel)\n* Shared secret definito\n\n---\n\n### Integrazione con Google Workspace (LDAP)\n\n* Client LDAP creato da pannello admin Google\n* Integrazione con **LDAP Google (ldaps://ldap.google.com:636)**\n* Campi configurati: utenti, gruppi, intero dominio\n\n---\n\n### Configurazione autenticazione\n\n* **802.1X (WPA Enterprise)**\n* Protocollo: **EAP-TTLS** / fase 2: **GTC**\n* File modificati: sites-enabled/default, inner-tunnel, mods-enabled/ldap, mods-enabled/eap\n\n---\n\n### Certificati e sicurezza\n\n* Certificati **self-signed** (validità 10 anni)\n* Previsto upgrade a **Let's Encrypt** (anche per **Eduroam**)\n\n---\n\n### Integrazione infrastruttura di rete\n\n* Firewall: Zyxel **VPN100**\n* Access point: Zyxel (gestione centralizzata)\n* SSID: **Wireless Campus** — sicurezza: **WPA Enterprise** — autenticazione: **RADIUS**\n\n---\n\n### Problematica critica: TLS 1.3 (Windows)\n\nDopo aggiornamenti Windows: incompatibilità TLS 1.3 con FreeRADIUS 3.0.\n\n* Soluzione temporanea: modifica registro Windows (TlsVersion)\n* Soluzione definitiva: upgrade a **FreeRADIUS 3.2**\n\n---\n\n### Risultato finale\n\n* Autenticazione Wi-Fi centralizzata tramite Google Workspace\n* Integrazione RADIUS + LDAP\n* Accesso sicuro tramite 802.1X\n* Infrastruttura virtualizzata e scalabile\n* Gestione utenti completamente centralizzata\n* Compatibilità multi-dispositivo (Android / Windows)";

const replacement = '        article: ' + JSON.stringify(cleanText);

const newHtml = html.slice(0, articleStart) + replacement + html.slice(closingIdx + closingSeq.length);

fs.writeFileSync(f, newHtml, 'utf8');
console.log('Done! File written successfully.');
