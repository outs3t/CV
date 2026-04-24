const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5173;

const app = express();
app.use(express.json({ limit: '10mb' }));

function isLocalRequest(req) {
  const ip = String(req.ip || '');
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function prankAdminPage(req, res) {
  res.status(200).send(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0c0c0c;color:#f0ece4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial} .box{max-width:720px;padding:28px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;background:rgba(255,255,255,0.03)} h1{margin:0 0 10px;font-size:22px} p{margin:0 0 14px;color:#8a8580;line-height:1.5} a{color:#c8a55c;text-decoration:none}</style></head><body><div class="box"><h1>Area Admin</h1><p>Accesso non disponibile.</p><p>Se volevi vedere il CV, vai qui: <a href="/cv">/cv</a></p></div></body></html>`);
}

function blockNonLocalApi(req, res, next) {
  if (isLocalRequest(req)) return next();
  res.status(404).json({ ok: false, error: 'Not found' });
}

function safeProjectId(id) {
  const s = String(id || '').trim();
  if (!/^[a-z0-9-]+$/i.test(s)) return null;
  return s;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escapeForTemplateLiteral(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
}

function escapeForSingleQuotedJsString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n');
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  if (typeof tags !== 'string') return [];
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

function tagToIcon(tag) {
  const t = String(tag || '').toLowerCase();
  // Vendors / Networking
  if (t.includes('paloalto') || t.includes('palo alto') || t.includes('pan-os') || t.includes('panos')) return 'fa-shield-halved';
  if (t.includes('cisco') || t.includes('ios-xe') || t.includes('ios xe') || t.includes('asa') || t.includes('nx-os') || t.includes('nexus')) return 'fa-network-wired';
  if (t.includes('meraki')) return 'fa-signal';
  if (t.includes('mikrotik') || t.includes('routeros') || t.includes('router os')) return 'fa-route';
  if (t.includes('aruba') || t.includes('hp') || t.includes('hpe') || t.includes('procurve')) return 'fa-wifi';
  if (t.includes('juniper') || t.includes('junos')) return 'fa-network-wired';
  if (t.includes('extreme')) return 'fa-network-wired';
  if (t.includes('netgear')) return 'fa-network-wired';
  if (t.includes('tp-link') || t.includes('tplink')) return 'fa-network-wired';
  if (t.includes('huawei')) return 'fa-network-wired';

  if (t.includes('ubiquiti') || t.includes('unifi') || t.includes('airmax') || t.includes('beam') || t.includes('powerbeam')) return 'fa-wifi';
  if (t.includes('vlan') || t.includes('lan') || t.includes('wan') || t.includes('routing') || t.includes('network')) return 'fa-network-wired';
  if (t.includes('firewall') || t.includes('fortigate') || t.includes('watchguard') || t.includes('zyxel') || t.includes('vpn') || t.includes('ssl') || t.includes('ipsec') || t.includes('wireguard') || t.includes('openvpn')) return 'fa-shield-halved';
  if (t.includes('sonicwall') || t.includes('sonic wall')) return 'fa-shield-halved';
  if (t.includes('checkpoint') || t.includes('check point')) return 'fa-shield-halved';
  if (t.includes('sophos')) return 'fa-shield-halved';
  if (t.includes('suricata') || t.includes('snort') || t.includes('ids') || t.includes('ips')) return 'fa-eye';
  if (t.includes('radius') || t.includes('802.1x') || t.includes('8021x') || t.includes('nac')) return 'fa-key';
  if (t.includes('switch') || t.includes('switching')) return 'fa-network-wired';
  if (t.includes('wifi') || t.includes('wi-fi') || t.includes('wireless') || t.includes('wlan') || t.includes('access point') || t.includes('ap ')) return 'fa-wifi';

  if (t.includes('active directory') || t.includes('ad ') || t === 'ad') return 'fa-sitemap';
  if (t.includes('windows')) return 'fa-windows';
  if (t.includes('linux') || t.includes('debian')) return 'fa-linux';

  // Virtualization / Cloud
  if (t.includes('vmware') || t.includes('esxi') || t.includes('vcenter')) return 'fa-server';
  if (t.includes('proxmox')) return 'fa-server';
  if (t.includes('hyper-v') || t.includes('hyperv')) return 'fa-windows';
  if (t.includes('azure')) return 'fa-cloud';
  if (t.includes('aws') || t.includes('amazon web services')) return 'fa-cloud';
  if (t.includes('gcp') || t.includes('google cloud')) return 'fa-cloud';
  if (t.includes('cloud')) return 'fa-cloud';

  // DevOps / Containers
  if (t.includes('docker') || t.includes('container')) return 'fa-box';
  if (t.includes('kubernetes') || t.includes('k8s')) return 'fa-diagram-project';
  if (t.includes('gitlab')) return 'fa-code-branch';
  if (t.includes('github') || t.includes('git ' ) || t === 'git') return 'fa-code-branch';

  // Web / DB
  if (t.includes('nginx')) return 'fa-globe';
  if (t.includes('apache')) return 'fa-globe';
  if (t.includes('mysql') || t.includes('mariadb')) return 'fa-database';
  if (t.includes('postgres') || t.includes('postgresql')) return 'fa-database';

  if (t.includes('backup') || t.includes('veeam') || t.includes('nas') || t.includes('synology') || t.includes('storage') || t.includes('raid')) return 'fa-database';
  if (t.includes('fiber') || t.includes('fibra') || t.includes('ftth') || t.includes('gpon')) return 'fa-bolt';
  return 'fa-circle';
}

function pickHeaderTheme(badgeClass, tags) {
  const bc = String(badgeClass || '').toLowerCase();
  const t = (tags || []).join(' ').toLowerCase();
  if (bc === 'backup') return 'header-backup';
  if (bc === 'auth') return 'header-ad-google';
  if (t.includes('fortigate') || t.includes('watchguard') || t.includes('firewall') || t.includes('vpn') || t.includes('ssl')) return 'header-firewall';
  return 'header-ubiquiti';
}

function buildHeaderHTML(badgeClass, tags) {
  const theme = pickHeaderTheme(badgeClass, tags);
  const items = (tags || []).slice(0, 5).map((tag) => {
    const icon = tagToIcon(tag);
    const label = String(tag).trim().slice(0, 18);
    return `<div class="brand-item"><div class="brand-icon"><i class="fas ${icon}"></i></div><span class="brand-label">${label}</span></div>`;
  }).join('');
  return `<div class="card-tech-header ${theme}"><div class="brand-showcase">${items}</div></div>`;
}

function extractProjectsChunk(html) {
  const start = html.indexOf('var projects = [');
  if (start === -1) throw new Error('Array projects non trovato');
  const end = html.indexOf('];', start);
  if (end === -1) throw new Error('Chiusura array projects non trovata');
  return { start, end: end + 2, chunk: html.slice(start, end + 2) };
}

function listProjectIdsFromHtml(html) {
  const { chunk } = extractProjectsChunk(html);
  const ids = [];
  const re = /\bid\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(chunk))) ids.push(m[1]);
  return Array.from(new Set(ids));
}

function insertProjectIntoHtml(html, project) {
  const id = safeProjectId(project.id);
  if (!id) throw new Error('id non valido (usa solo lettere/numeri e -)');

  const existing = listProjectIdsFromHtml(html);
  if (existing.includes(id)) throw new Error(`Esiste già un progetto con id '${id}'`);

  const tags = normalizeTags(project.tags);
  const badgeClass = String(project.badgeClass || project.category || 'infra');
  const category = String(project.category || 'infra');
  const badge = String(project.badge || (category === 'backup' ? 'Backup & Recovery' : category === 'server' ? 'Server & Autenticazione' : 'Infrastruttura Rete'));

  const headerHTML = buildHeaderHTML(badgeClass, tags);

  const obj =
`      {
        id: '${id}',
        title: '${escapeForSingleQuotedJsString(project.title || 'Nuovo progetto')}',
        desc: '${escapeForSingleQuotedJsString(project.desc || '')}',
        tags: [${tags.map(t => `'${escapeForSingleQuotedJsString(t)}'`).join(', ')}],
        category: '${escapeForSingleQuotedJsString(category)}',
        badge: '${escapeForSingleQuotedJsString(badge)}',
        badgeClass: '${escapeForSingleQuotedJsString(badgeClass)}',
        headerHTML: '${escapeForSingleQuotedJsString(headerHTML)}',
        gallery: [],
        article: \`\`
      },
`;

  const { start, end } = extractProjectsChunk(html);
  const before = html.slice(0, end - 2);
  const after = html.slice(end - 2);

  // Ensure array stays valid: if the last element before insertion ends with `}`
  // and is not already followed by a comma, add it.
  const beforeTrimmed = before.replace(/\s+$/g, '');
  let joiner = '\n';
  if (beforeTrimmed.endsWith('}') && !/\},\s*$/.test(beforeTrimmed)) {
    joiner = ',\n';
  }
  return before + joiner + obj + after;
}

function updateProjectArticleInHtml(html, projectId, articleText) {
  const id = safeProjectId(projectId);
  if (!id) throw new Error('projectId non valido');

  const escaped = escapeForTemplateLiteral(articleText);
  const replacement = `id: '${id}',`;

  const idx = html.indexOf(replacement);
  if (idx === -1) throw new Error(`Progetto con id '${id}' non trovato in Curriculum.html`);

  // Limit search to the object block (from this id to the next "}," at same indentation or next "{\n")
  // We keep it simple: operate on a window of characters.
  const windowStart = idx;
  const windowEnd = Math.min(html.length, idx + 220000);
  const chunk = html.slice(windowStart, windowEnd);

  const articlePropRegex = /\n\s*article\s*:\s*`[\s\S]*?`\s*(,)?/;
  const articleHtmlPropRegex = /\n\s*articleHTML\s*:\s*'[^']*'\s*(,)?/;

  let newChunk = chunk;
  if (articlePropRegex.test(newChunk)) {
    newChunk = newChunk.replace(articlePropRegex, `\n        article: \`${escaped}\`$1`);
  } else if (articleHtmlPropRegex.test(newChunk)) {
    newChunk = newChunk.replace(articleHtmlPropRegex, `\n        article: \`${escaped}\`$1`);
  } else {
    // Insert after gallery block end if possible, else after headerHTML
    const insertAfterGallery = /\n\s*gallery\s*:\s*\[[\s\S]*?\]\s*(,?)/;
    if (insertAfterGallery.test(newChunk)) {
      newChunk = newChunk.replace(insertAfterGallery, (m, comma) => `${m}${comma}\n        article: \`${escaped}\``);
    } else {
      const insertAfterHeader = /\n\s*headerHTML\s*:\s*'[^']*'\s*(,?)/;
      if (insertAfterHeader.test(newChunk)) {
        newChunk = newChunk.replace(insertAfterHeader, (m, comma) => `${m}${comma}\n        article: \`${escaped}\``);
      } else {
        throw new Error('Non riesco a trovare un punto di inserimento per l\'articolo nel blocco del progetto');
      }
    }
  }

  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function clearProjectArticleInHtml(html, projectId) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  let newChunk = chunk;

  // Clear `article` template literal if present
  const articlePropRegex = /\n\s*article\s*:\s*`[\s\S]*?`\s*(,)?/i;
  if (articlePropRegex.test(newChunk)) {
    newChunk = newChunk.replace(articlePropRegex, '\n        article: ``$1');
  }

  // Clear `articleHTML` string if present
  const articleHtmlPropRegex = /\n\s*articleHTML\s*:\s*'([\s\S]*?)'\s*(,)?/i;
  if (articleHtmlPropRegex.test(newChunk)) {
    newChunk = newChunk.replace(articleHtmlPropRegex, "\n        articleHTML: ''$2");
  }

  // If neither existed, insert empty `article` so it stays consistent
  if (!/\n\s*article\s*:\s*`/i.test(newChunk) && !/\n\s*articleHTML\s*:/i.test(newChunk)) {
    const anchor = /\n\s*gallery\s*:\s*\[[\s\S]*?\]\s*(,?)/i;
    if (anchor.test(newChunk)) {
      newChunk = newChunk.replace(anchor, (m, comma) => `${m}${comma}\n        article: ```);
    }
  }

  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function setProjectGalleryInHtml(html, projectId, paths) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  const list = (Array.isArray(paths) ? paths : []).map(String).map(s => s.trim()).filter(Boolean);
  const galleryBlockRegex = /\n\s*gallery\s*:\s*\[[\s\S]*?\]\s*(,?)/;
  let newChunk = chunk;
  if (!galleryBlockRegex.test(newChunk)) throw new Error('gallery non trovata nel progetto');
  const rendered = list.map(p => `          '${escapeForSingleQuotedJsString(p)}'`).join(',\n');
  newChunk = newChunk.replace(galleryBlockRegex, `\n        gallery: [\n${rendered}\n        ]$1`);
  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function getProjectWindow(html, projectId) {
  const id = safeProjectId(projectId);
  if (!id) throw new Error('projectId non valido');
  const replacement = `id: '${id}',`;
  const idx = html.indexOf(replacement);
  if (idx === -1) throw new Error(`Progetto con id '${id}' non trovato in Curriculum.html`);
  const windowStart = idx;
  const windowEnd = Math.min(html.length, idx + 220000);
  const chunk = html.slice(windowStart, windowEnd);
  return { id, windowStart, windowEnd, chunk };
}

function extractArticleFromProjectChunk(chunk) {
  const m = chunk.match(/\n\s*article\s*:\s*`([\s\S]*?)`\s*(,|\n|\})/);
  if (m) return m[1];
  return '';
}

function extractArticleHTMLFromProjectChunk(chunk) {
  const m = chunk.match(/\n\s*articleHTML\s*:\s*'([\s\S]*?)'\s*(,|\n|\})/);
  if (m) return m[1];
  return '';
}

function extractStringFieldFromProjectChunk(chunk, field) {
  const re = new RegExp(`\\n\\s*${field}\\s*:\\s*'([^']*)'`, 'i');
  const m = chunk.match(re);
  return m ? m[1] : '';
}

function extractNumberFieldFromProjectChunk(chunk, field) {
  const re = new RegExp(`\\n\\s*${field}\\s*:\\s*(-?\\d+)`, 'i');
  const m = chunk.match(re);
  return m ? Number(m[1]) : null;
}

function extractBoolFieldFromProjectChunk(chunk, field) {
  const re = new RegExp(`\\n\\s*${field}\\s*:\\s*(true|false)`, 'i');
  const m = chunk.match(re);
  return m ? m[1].toLowerCase() === 'true' : null;
}

function upsertStringFieldInChunk(chunk, field, value, anchorField) {
  const v = escapeForSingleQuotedJsString(value);
  let out = chunk;

  const existsRe = new RegExp(`\\n(\\s*)${field}\\s*:\\s*'[^']*'\\s*(,?)`, 'i');
  if (existsRe.test(out)) {
    out = out.replace(existsRe, (m, indent, comma) => `\n${indent}${field}: '${v}'${comma}`);
    return out;
  }

  const anchor = anchorField
    ? new RegExp(`\\n\\s*${anchorField}\\s*:\\s*[^\\n]+`, 'i')
    : /\n\s*id\s*:\s*'[^']+'\s*,?/i;

  if (!anchor.test(out)) throw new Error(`Impossibile inserire il campo '${field}': anchor non trovato`);
  out = out.replace(anchor, (m) => `${m}\n        ${field}: '${v}',`);
  return out;
}

function updateProjectDetailsInHtml(html, projectId, details) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  let newChunk = chunk;
  if (details.category !== undefined) newChunk = upsertStringFieldInChunk(newChunk, 'category', String(details.category), 'tags');
  if (details.badge !== undefined) newChunk = upsertStringFieldInChunk(newChunk, 'badge', String(details.badge), 'category');
  if (details.badgeClass !== undefined) newChunk = upsertStringFieldInChunk(newChunk, 'badgeClass', String(details.badgeClass), 'badge');
  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function deleteProjectFromHtml(html, projectId) {
  const id = safeProjectId(projectId);
  if (!id) throw new Error('projectId non valido');

  const { start, end, chunk } = extractProjectsChunk(html);
  const needle = `id: '${id}',`;
  const idx = chunk.indexOf(needle);
  if (idx === -1) throw new Error(`Progetto con id '${id}' non trovato`);

  // Find object start: scan backwards for the nearest '{' before the id.
  let objStart = -1;
  for (let i = idx; i >= 0; i--) {
    if (chunk[i] === '{') { objStart = i; break; }
  }
  if (objStart === -1) throw new Error('Inizio oggetto progetto non trovato');

  // Find object end by brace-depth parsing, skipping strings and template literals.
  let depth = 0;
  let inS = false;
  let inD = false;
  let inT = false;
  let esc = false;
  let objEnd = -1;

  for (let i = objStart; i < chunk.length; i++) {
    const ch = chunk[i];

    if (esc) { esc = false; continue; }
    if (ch === '\\') {
      if (inS || inD || inT) { esc = true; continue; }
    }

    if (!inD && !inT && ch === "'") { inS = !inS; continue; }
    if (!inS && !inT && ch === '"') { inD = !inD; continue; }
    if (!inS && !inD && ch === '`') { inT = !inT; continue; }
    if (inS || inD || inT) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { objEnd = i + 1; break; }
    }
  }

  if (objEnd === -1) throw new Error('Fine oggetto progetto non trovata');

  // Also remove trailing comma after the object (if any)
  let cutEnd = objEnd;
  while (cutEnd < chunk.length && /\s/.test(chunk[cutEnd])) cutEnd++;
  if (chunk[cutEnd] === ',') cutEnd++;

  let newChunk = chunk.slice(0, objStart) + chunk.slice(cutEnd);
  // Cleanup: remove a dangling comma before closing bracket
  newChunk = newChunk.replace(/,\s*\n\s*\];/, '\n];');
  return html.slice(0, start) + newChunk + html.slice(end);
}

function upsertProjectSettingsInChunk(chunk, settings) {
  let out = chunk;
  const fields = [
    { key: 'order', type: 'number' },
    { key: 'isNew', type: 'bool' },
    { key: 'disabled', type: 'bool' }
  ];

  fields.forEach(({ key, type }) => {
    if (settings[key] === undefined) return;
    const value = settings[key];
    const existsRe = new RegExp(`\\n(\\s*)${key}\\s*:\\s*[^,\\n]+(,?)`, 'i');
    if (existsRe.test(out)) {
      out = out.replace(existsRe, (m, indent, comma) => {
        const v = type === 'number' ? String(Number(value)) : (value ? 'true' : 'false');
        return `\n${indent}${key}: ${v}${comma}`;
      });
      return;
    }

    // Insert near other meta fields: after badgeClass if present, else after category
    const anchor = /\n\s*badgeClass\s*:\s*'[^']*'\s*,?/i.test(out)
      ? /\n\s*badgeClass\s*:\s*'[^']*'\s*,?/i
      : /\n\s*category\s*:\s*'[^']*'\s*,?/i;

    out = out.replace(anchor, (m) => {
      const v = type === 'number' ? String(Number(value)) : (value ? 'true' : 'false');
      return `${m}\n        ${key}: ${v},`;
    });
  });

  return out;
}

function updateProjectSettingsInHtml(html, projectId, settings) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  const newChunk = upsertProjectSettingsInChunk(chunk, settings);
  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function extractGalleryFromProjectChunk(chunk) {
  const m = chunk.match(/\n\s*gallery\s*:\s*\[([\s\S]*?)\]\s*(,|\n)/);
  if (!m) return [];
  const inner = m[1];
  const items = [];
  const re = /'([^']+)'/g;
  let mm;
  while ((mm = re.exec(inner))) items.push(mm[1]);
  return items;
}

function extractTagsFromProjectChunk(chunk) {
  const m = chunk.match(/\n\s*tags\s*:\s*\[([\s\S]*?)\]\s*(,|\n|\})/);
  if (!m) return [];
  const inner = m[1];
  const items = [];
  const re = /'([^']+)'/g;
  let mm;
  while ((mm = re.exec(inner))) items.push(mm[1]);
  return items;
}

function setTagsInChunk(chunk, tags) {
  const list = normalizeTags(tags);
  const tagsBlockRegex = /\n\s*tags\s*:\s*\[[\s\S]*?\]\s*(,?)/i;
  if (!tagsBlockRegex.test(chunk)) throw new Error('tags non trovati nel progetto');
  const rendered = list.map(t => `'${escapeForSingleQuotedJsString(t)}'`).join(', ');
  return chunk.replace(tagsBlockRegex, `\n        tags: [${rendered}]$1`);
}

function updateProjectCoreInHtml(html, projectId, core) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  let newChunk = chunk;

  if (core.title !== undefined) newChunk = upsertStringFieldInChunk(newChunk, 'title', String(core.title), 'id');
  if (core.desc !== undefined) newChunk = upsertStringFieldInChunk(newChunk, 'desc', String(core.desc), 'title');
  if (core.tags !== undefined) newChunk = setTagsInChunk(newChunk, core.tags);

  if (core.regenHeaderHTML) {
    const tags = extractTagsFromProjectChunk(newChunk);
    const badgeClass = extractStringFieldFromProjectChunk(newChunk, 'badgeClass') || 'infra';
    const headerHTML = buildHeaderHTML(badgeClass, tags);
    newChunk = upsertStringFieldInChunk(newChunk, 'headerHTML', headerHTML, 'badgeClass');
  }

  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

function updateProjectGalleryInHtml(html, projectId, newPaths) {
  const { windowStart, windowEnd, chunk } = getProjectWindow(html, projectId);
  const add = (Array.isArray(newPaths) ? newPaths : []).map(String).map(s => s.trim()).filter(Boolean);
  if (!add.length) return html;

  const existing = extractGalleryFromProjectChunk(chunk);
  const merged = Array.from(new Set(existing.concat(add)));
  const galleryBlockRegex = /\n\s*gallery\s*:\s*\[[\s\S]*?\]\s*(,?)/;

  let newChunk = chunk;
  if (galleryBlockRegex.test(newChunk)) {
    const rendered = merged.map(p => `          '${escapeForSingleQuotedJsString(p)}'`).join(',\n');
    newChunk = newChunk.replace(galleryBlockRegex, `\n        gallery: [\n${rendered}\n        ]$1`);
  } else {
    throw new Error('gallery non trovata nel progetto');
  }

  return html.slice(0, windowStart) + newChunk + html.slice(windowEnd);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const id = safeProjectId(req.body.projectId);
      if (!id) return cb(new Error('projectId non valido'));
      const dir = path.join(ROOT, 'assets', 'articles', id);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const base = path.basename(file.originalname).replace(/[^a-z0-9._-]/gi, '_');
      cb(null, base);
    }
  })
});

app.get('/', (req, res) => {
  if (!isLocalRequest(req)) return prankAdminPage(req, res);
  res.sendFile(path.join(ROOT, 'admin.html'));
});

app.get('/cv', (req, res) => {
  res.sendFile(path.join(ROOT, 'Curriculum.html'));
});

app.use('/assets', express.static(path.join(ROOT, 'assets')));

// Allow API calls only from localhost
app.use('/api', blockNonLocalApi);

app.post('/api/save-article', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const article = req.body.article;
    if (typeof article !== 'string') throw new Error('Campo article mancante');

    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = updateProjectArticleInHtml(html, projectId, article);
    fs.writeFileSync(filePath, updated, 'utf8');

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/update-project-details', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const category = req.body.category;
    const badge = req.body.badge;
    const badgeClass = req.body.badgeClass;

    const details = {};
    if (category !== undefined && category !== null) details.category = String(category);
    if (badge !== undefined && badge !== null) details.badge = String(badge);
    if (badgeClass !== undefined && badgeClass !== null) details.badgeClass = String(badgeClass);

    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = updateProjectDetailsInHtml(html, projectId, details);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/delete-project', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = deleteProjectFromHtml(html, projectId);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/delete-article', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = clearProjectArticleInHtml(html, projectId);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/api/gallery', (req, res) => {
  try {
    const projectId = req.query.projectId;
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const { chunk } = getProjectWindow(html, projectId);
    const gallery = extractGalleryFromProjectChunk(chunk);
    res.json({ ok: true, gallery });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/set-gallery', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const paths = req.body.paths;
    if (!Array.isArray(paths)) throw new Error('paths deve essere un array');
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = setProjectGalleryInHtml(html, projectId, paths);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/remove-gallery-image', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const pathToRemove = String(req.body.path || '').trim();
    if (!pathToRemove) throw new Error('path mancante');
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const { chunk } = getProjectWindow(html, projectId);
    const gallery = extractGalleryFromProjectChunk(chunk).filter(p => p !== pathToRemove);
    const updated = setProjectGalleryInHtml(html, projectId, gallery);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/api/article', (req, res) => {
  try {
    const projectId = req.query.projectId;
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const { chunk } = getProjectWindow(html, projectId);
    const article = extractArticleFromProjectChunk(chunk) || extractArticleHTMLFromProjectChunk(chunk);
    res.json({ ok: true, article });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/api/projects-meta', (req, res) => {
  try {
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const ids = listProjectIdsFromHtml(html);
    const meta = ids.map((id) => {
      const { chunk } = getProjectWindow(html, id);
      return {
        id,
        title: extractStringFieldFromProjectChunk(chunk, 'title'),
        desc: extractStringFieldFromProjectChunk(chunk, 'desc'),
        tags: extractTagsFromProjectChunk(chunk),
        category: extractStringFieldFromProjectChunk(chunk, 'category'),
        badge: extractStringFieldFromProjectChunk(chunk, 'badge'),
        badgeClass: extractStringFieldFromProjectChunk(chunk, 'badgeClass'),
        order: extractNumberFieldFromProjectChunk(chunk, 'order'),
        isNew: extractBoolFieldFromProjectChunk(chunk, 'isNew'),
        disabled: extractBoolFieldFromProjectChunk(chunk, 'disabled')
      };
    });
    res.json({ ok: true, projects: meta });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/update-project-core', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const title = req.body.title;
    const desc = req.body.desc;
    const tags = req.body.tags;
    const regenHeaderHTML = !!req.body.regenHeaderHTML;

    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = updateProjectCoreInHtml(html, projectId, { title, desc, tags, regenHeaderHTML });
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/update-project-settings', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const order = req.body.order;
    const isNew = req.body.isNew;
    const disabled = req.body.disabled;

    const settings = {};
    if (order !== undefined && order !== null && order !== '') settings.order = Number(order);
    if (isNew !== undefined && isNew !== null) settings.isNew = !!isNew;
    if (disabled !== undefined && disabled !== null) settings.disabled = !!disabled;

    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = updateProjectSettingsInHtml(html, projectId, settings);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/add-gallery-images', (req, res) => {
  try {
    const projectId = req.body.projectId;
    const paths = req.body.paths;
    if (!Array.isArray(paths)) throw new Error('paths deve essere un array');
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = updateProjectGalleryInHtml(html, projectId, paths);
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const ids = listProjectIdsFromHtml(html);
    res.json({ ok: true, ids });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/create-project', (req, res) => {
  try {
    const body = req.body || {};
    const id = safeProjectId(body.id);
    if (!id) throw new Error('id non valido (usa solo lettere/numeri e -)');

    const filePath = path.join(ROOT, 'Curriculum.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const updated = insertProjectIntoHtml(html, {
      id,
      title: body.title,
      desc: body.desc,
      tags: body.tags,
      category: body.category,
      badge: body.badge,
      badgeClass: body.badgeClass
    });
    fs.writeFileSync(filePath, updated, 'utf8');

    // Create article images folder for convenience
    ensureDir(path.join(ROOT, 'assets', 'articles', id));
    ensureDir(path.join(ROOT, 'assets', 'projects', id));

    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/api/upload-images', upload.array('images', 30), (req, res) => {
  try {
    const id = safeProjectId(req.body.projectId);
    if (!id) throw new Error('projectId non valido');
    const files = (req.files || []).map(f => ({
      filename: f.filename,
      path: `assets/articles/${id}/${f.filename}`
    }));
    res.json({ ok: true, files });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

function runGit(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd: ROOT, stdio: 'inherit', ...opts });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(' ')} -> exit ${code}`));
    });
  });
}

app.post('/api/publish', async (req, res) => {
  try {
    const msg = (req.body && req.body.message ? String(req.body.message) : 'update cv').trim() || 'update cv';

    // Ensure git repo exists
    if (!fs.existsSync(path.join(ROOT, '.git'))) {
      throw new Error('Questa cartella non è una repo git. Inizializzala prima (git init + remote).');
    }

    await runGit(['add', '-A']);
    // Commit may fail if nothing to commit; handle gracefully.
    try {
      await runGit(['commit', '-m', msg]);
    } catch {
      // ignore
    }
    await runGit(['push']);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Admin: http://localhost:${PORT}/`);
  console.log(`CV:    http://localhost:${PORT}/cv`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\nERRORE: porta ${PORT} già in uso.`);
    console.error('Chiudi l\'altro server oppure avvia con una porta diversa:');
    console.error('  set PORT=5174 && npm start\n');
    process.exitCode = 1;
    return;
  }
  console.error(err);
  process.exitCode = 1;
});
