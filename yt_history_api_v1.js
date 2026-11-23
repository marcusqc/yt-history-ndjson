/*
 * YouTube History Extractor — version API (sans DOM)
 * À coller dans la console (F12) sur https://myactivity.google.com/product/youtube
 *
 * Principe : rejoue la requête interne batchexecute (rpcid y3VFHd) que la page
 * utilise quand on défile. 100 éléments par requête, jeton de continuation,
 * aucun élément ajouté au DOM -> mémoire stable.
 *
 * Commandes (console) :
 *   ytx.start()   démarre ou reprend là où ça s'était arrêté
 *   ytx.stop()    arrête après la page en cours (télécharge le morceau partiel)
 *   ytx.status()  affiche la progression
 *   ytx.reset()   efface la reprise (pour recommencer depuis aujourd'hui)
 */
(() => {
  'use strict';

  const CFG = {
    RPC: 'y3VFHd',
    PAGE_SIZE: 100,
    DELAY_MS: 1200,          // délai entre deux requêtes
    CHUNK_LINES: 25000,      // lignes par fichier NDJSON téléchargé
    MAX_RETRIES: 6,          // essais en cas d'erreur (backoff exponentiel)
    STORE_KEY: 'ytx_api_v1_state',
  };

  const W = () => window.WIZ_global_data || {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let reqid = 100000 + Math.floor(Math.random() * 9000);

  // ---------- état persistant (reprise après rechargement) ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(CFG.STORE_KEY)) || null; } catch { return null; } };
  const save = s => { try { localStorage.setItem(CFG.STORE_KEY, JSON.stringify(s)); } catch {} };

  let state = load() || { token: null, done: false, total: 0, pages: 0, chunk: 1, oldest: null, newest: null, startedAt: null };
  let buf = [];               // lignes NDJSON du morceau en cours
  let running = false, stopFlag = false;

  // ---------- requête ----------
  function parseBE(text) {
    for (const line of text.split('\n')) {
      if (!line.startsWith('[[')) continue;
      try {
        for (const e of JSON.parse(line)) {
          if (e[0] === 'wrb.fr' && e[1] === CFG.RPC && e[2]) return JSON.parse(e[2]);
        }
      } catch {}
    }
    return null;
  }

  async function fetchPage(token) {
    const w = W();
    if (!w.SNlM0e || !w.FdrFJe) throw new Error('Jetons de page introuvables : es-tu bien sur myactivity.google.com ?');
    const inner = JSON.stringify([[null, ['youtube']], token, CFG.PAGE_SIZE]);
    const body = new URLSearchParams({
      'f.req': JSON.stringify([[[CFG.RPC, inner, null, 'generic']]]),
      at: w.SNlM0e,
    });
    const qs = new URLSearchParams({
      rpcids: CFG.RPC, 'source-path': '/product/youtube', 'f.sid': w.FdrFJe, bl: w.cfb2h,
      hl: 'fr', 'soc-app': '712', 'soc-platform': '1', 'soc-device': '1',
      _reqid: String(reqid += 100000), rt: 'c',
    });
    const r = await fetch('/_/FootprintsMyactivityUi/data/batchexecute?' + qs, {
      method: 'POST', credentials: 'include', body,
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-same-domain': '1' },
    });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    const p = parseBE(await r.text());
    if (!p) throw new Error('Réponse illisible (format changé ?)');
    return { items: p[0] || [], next: p[1] || null };
  }

  // ---------- décodage d'un élément ----------
  // Les positions peuvent varier : on cherche les champs par leur forme plutôt que par index fixe.
  function toRecord(it) {
    const ts = it[4];
    const t = Array.isArray(it[9]) ? it[9] : [];
    const url = t[3] || null;
    const vid = url && (url.match(/[?&]v=([\w-]{11})/) || [])[1] || null;
    let channel = null, channel_url = null, duration = null, device = null, is_ad = false;
    for (const f of it) {
      if (!Array.isArray(f)) continue;
      if (typeof f[0] === 'string' && f[0].includes('i.ytimg.com') && typeof f[1] === 'string') duration = f[1];
      else if (Array.isArray(f[0]) && f[0].length === 1 && typeof f[0][0] === 'string' && f.length === 1) {
        if (/annonce|google ads/i.test(f[0][0])) is_ad = true; else device = f[0][0];
      }
      else if (Array.isArray(f[0]) && f[0][0] === null && typeof f[0][1] === 'string' && typeof f[0][3] === 'string' && f[0][3].includes('youtube.com')) {
        channel = f[0][1]; channel_url = f[0][3];
      }
    }
    return {
      id: it[5] || null,
      ts_us: ts,
      activity_date: ts ? new Date(ts / 1000).toISOString() : null,
      action: t[2] || null,            // "Vous avez regardé", "Vous avez consulté", "Vous avez recherché"...
      title: t[0] || null,
      url,
      video_id: vid,
      channel, channel_url, duration, device, is_ad,
    };
  }

  // ---------- export ----------
  function download(lines, name) {
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/x-ndjson' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  function flush(final) {
    if (!buf.length) return;
    const name = `yt_history_part${String(state.chunk).padStart(3, '0')}${final ? '_final' : ''}.ndjson`;
    download(buf, name);
    console.log(`[ytx] fichier téléchargé : ${name} (${buf.length} lignes)`);
    buf = [];
    state.chunk++;
    save(state);
  }

  // ---------- boucle ----------
  async function start() {
    if (running) return console.warn('[ytx] déjà en cours');
    if (state.done) return console.warn('[ytx] extraction déjà terminée. ytx.reset() pour recommencer.');
    running = true; stopFlag = false;
    delete state._pendingToken;
    state.startedAt = state.startedAt || new Date().toISOString();
    console.log(`[ytx] démarrage ${state.token ? '(reprise, ' + state.total + ' déjà extraits)' : '(depuis aujourd\'hui)'}`);

    // cursor = page à demander maintenant ; state.token = point de reprise
    // (n'avance qu'au téléchargement d'un fichier, pour ne rien perdre en cas de plantage)
    let cursor = state.token;
    let lastFirstId = null;

    try {
      while (!stopFlag) {
        let res, tries = 0;
        for (;;) {
          try { res = await fetchPage(cursor); break; }
          catch (e) {
            tries++;
            if (e.status === 400 || e.status === 401) {
              throw new Error('Session expirée : recharge la page (F5), recolle le script et fais ytx.start() — ça reprendra au même endroit.');
            }
            if (tries > CFG.MAX_RETRIES) throw e;
            const wait = Math.min(120000, 2000 * 2 ** tries);
            console.warn(`[ytx] ${e.message} — nouvel essai dans ${wait / 1000}s (${tries}/${CFG.MAX_RETRIES})`);
            await sleep(wait);
          }
        }

        // garde-fou : si la pagination n'avance plus, on arrête au lieu d'écrire des doublons
        const firstId = res.items[0] && res.items[0][5];
        if ((res.next && res.next === cursor) || (firstId && firstId === lastFirstId)) {
          throw new Error('La pagination n\'avance plus (même page reçue deux fois) — arrêt pour éviter les doublons.');
        }
        lastFirstId = firstId;

        for (const it of res.items) buf.push(JSON.stringify(toRecord(it)));
        if (res.items.length) {
          const first = new Date(res.items[0][4] / 1000).toISOString();
          const last = new Date(res.items[res.items.length - 1][4] / 1000).toISOString();
          state.newest = state.newest || first;
          state.oldest = last;
        }
        state.total += res.items.length;
        state.pages++;

        cursor = res.next;
        // Le point de reprise n'est sauvegardé que quand le morceau est téléchargé,
        // sinon une reprise après plantage sauterait les éléments du buffer perdu.
        state._pendingToken = res.next;
        if (buf.length >= CFG.CHUNK_LINES) { state.token = res.next; flush(false); }

        if (state.pages % 10 === 0) console.log(`[ytx] ${state.total} éléments — rendu au ${state.oldest?.slice(0, 10)}`);

        if (!res.next) { state.done = true; state.token = null; flush(true); save(state); console.log(`[ytx] TERMINÉ : ${state.total} éléments, du ${state.oldest} au ${state.newest}`); break; }
        await sleep(CFG.DELAY_MS);
      }
      if (stopFlag && !state.done) {
        state.token = state._pendingToken ?? state.token;
        flush(false);
        console.log('[ytx] arrêté. ytx.start() pour reprendre.');
      }
    } catch (e) {
      console.error('[ytx] ' + e.message);
      // on télécharge ce qui est en mémoire et on avance le point de reprise
      state.token = state._pendingToken ?? state.token;
      flush(false);
    } finally {
      delete state._pendingToken;
      save(state);
      running = false;
    }
  }

  window.ytx = {
    start,
    stop() { stopFlag = true; console.log('[ytx] arrêt demandé (fin de la page en cours)…'); },
    status() { const s = { ...state, enMemoire: buf.length, enCours: running }; console.table(s); return s; },
    reset() { if (running) return console.warn('[ytx] fais ytx.stop() d\'abord'); localStorage.removeItem(CFG.STORE_KEY); state = { token: null, done: false, total: 0, pages: 0, chunk: 1, oldest: null, newest: null, startedAt: null }; buf = []; console.log('[ytx] reprise effacée'); },
    _toRecord: toRecord, _fetchPage: fetchPage, CFG,
  };
  console.log('[ytx] prêt. Tape ytx.start() pour lancer.', load() ? '(une reprise existe : ' + load().total + ' éléments déjà extraits)' : '');
})();
