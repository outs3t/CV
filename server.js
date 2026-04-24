const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;

const app = express();
app.use(express.json({ limit: '10mb' }));

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
  const windowEnd = Math.min(html.length, idx + 20000);
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
  res.sendFile(path.join(ROOT, 'admin.html'));
});

app.get('/cv', (req, res) => {
  res.sendFile(path.join(ROOT, 'Curriculum.html'));
});

app.use('/assets', express.static(path.join(ROOT, 'assets')));

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

app.listen(PORT, () => {
  console.log(`Admin: http://localhost:${PORT}/`);
  console.log(`CV:    http://localhost:${PORT}/cv`);
});
