/* ═══════════════════════════════════════════════════════════════
   Simulators: quorums, vector clocks, Count-Min Sketch, gossip
   Same contract as the other simulator files: { id, title, slugs, blurb, render(), mount(root), unmount(root) }
   ═══════════════════════════════════════════════════════════════ */

window.SIMULATORS = window.SIMULATORS || {};

(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const pickRandom = (arr, k) => [...arr].sort(() => Math.random() - 0.5).slice(0, k);

  // Tracks listeners/timers per mount so unmount can always clean up
  function lifecycle() {
    const offs = [];
    const timers = new Set();
    return {
      on(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); offs.push(() => el.removeEventListener(ev, fn)); },
      every(ms, fn) { const t = setInterval(fn, ms); timers.add(t); return t; },
      stop(t) { clearInterval(t); timers.delete(t); },
      dispose() { offs.splice(0).forEach(f => f()); timers.forEach(t => clearInterval(t)); timers.clear(); }
    };
  }

  // ── Quorum reads and writes (N, R, W) ───────────────────────
  window.SIMULATORS['quorum-nrw'] = {
    id: 'quorum-nrw',
    title: 'Quorum Explorer (N, R, W)',
    slugs: ['case-amazon-dynamo'],
    blurb: 'Tune N, R and W, fail replicas, and see when a read can return stale data.',
    render() {
      return `
        <div class="simulator-card" id="sim-quorum">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Quorum Explorer (N, R, W)</div>
            <span class="simulator-card__status" id="q-rule"></span>
          </div>
          <p class="simulator-card__description">A write is acknowledged once W replicas store it; the rest catch up only when you run anti-entropy. A read asks R live replicas and returns the highest version. Click a replica to fail or recover it.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">N replicas: <b id="q-n-val">3</b></span><input type="range" id="q-n" min="3" max="7" value="3"></label>
            <label><span class="simulator-card__label">W write quorum: <b id="q-w-val">2</b></span><input type="range" id="q-w" min="1" max="3" value="2"></label>
            <label><span class="simulator-card__label">R read quorum: <b id="q-r-val">2</b></span><input type="range" id="q-r" min="1" max="3" value="2"></label>
          </div>
          <div class="sim-row" id="q-replicas"></div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="q-write">Write next version</button>
            <button class="btn btn--outline btn--sm" id="q-read">Read</button>
            <button class="btn btn--outline btn--sm" id="q-sync">Run anti-entropy</button>
            <button class="btn btn--sm" id="q-reset">Reset</button>
          </div>
          <div class="simulator-card__log" id="q-log"><div class="simulator-card__log-header">Event log</div></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      let N = 3, W = 2, R = 2, latest = 0, replicas = [];
      const reset = () => { latest = 0; replicas = Array.from({ length: N }, (_, i) => ({ id: i + 1, v: 0, up: true, hit: '' })); };
      const log = (msg, kind = '') => { const d = document.createElement('div'); d.className = 'sim-log-line ' + kind; d.textContent = msg; $('#q-log').insertBefore(d, $('#q-log').children[1] || null); };

      const draw = () => {
        $('#q-n-val').textContent = N; $('#q-w-val').textContent = W; $('#q-r-val').textContent = R;
        const strict = R + W > N;
        const rule = $('#q-rule');
        rule.textContent = `R + W = ${R + W} ${strict ? '>' : '≤'} N = ${N} → ${strict ? 'read and write sets always overlap' : 'stale reads possible'}`;
        rule.style.color = strict ? 'var(--success)' : 'var(--warning)';
        $('#q-replicas').innerHTML = replicas.map(r => `
          <button class="sim-node ${r.up ? '' : 'is-down'} ${r.hit}" data-id="${r.id}" title="Click to ${r.up ? 'fail' : 'recover'} replica ${r.id}">
            <span class="sim-node__name">Replica ${r.id}</span>
            <span class="sim-node__value">${r.up ? 'v' + r.v : 'down'}</span>
          </button>`).join('');
      };
      const clearHits = () => replicas.forEach(r => { r.hit = ''; });
      const syncSliders = () => {
        $('#q-w').max = N; $('#q-r').max = N;
        W = Math.min(W, N); R = Math.min(R, N);
        $('#q-w').value = W; $('#q-r').value = R;
      };

      lc.on($('#q-n'), 'input', e => { N = +e.target.value; syncSliders(); reset(); clearHits(); draw(); });
      lc.on($('#q-w'), 'input', e => { W = +e.target.value; draw(); });
      lc.on($('#q-r'), 'input', e => { R = +e.target.value; draw(); });
      lc.on($('#q-replicas'), 'click', e => {
        const b = e.target.closest('.sim-node'); if (!b) return;
        const r = replicas.find(x => x.id === +b.dataset.id); r.up = !r.up;
        log(`Replica ${r.id} ${r.up ? 'recovered (still holds v' + r.v + ')' : 'failed'}`);
        clearHits(); draw();
      });
      lc.on($('#q-write'), 'click', () => {
        clearHits();
        const live = replicas.filter(r => r.up);
        if (live.length < W) { log(`Write v${latest + 1} FAILED: only ${live.length} live replicas, W = ${W}`, 'is-bad'); draw(); return; }
        latest++;
        pickRandom(live, W).forEach(r => { r.v = latest; r.hit = 'is-write'; });
        log(`Write v${latest} acknowledged by ${W} replica(s); ${N - W} still hold older data`);
        draw();
      });
      lc.on($('#q-read'), 'click', () => {
        clearHits();
        const live = replicas.filter(r => r.up);
        if (live.length < R) { log(`Read FAILED: only ${live.length} live replicas, R = ${R}`, 'is-bad'); draw(); return; }
        const asked = pickRandom(live, R); asked.forEach(r => { r.hit = 'is-read'; });
        const got = Math.max(...asked.map(r => r.v));
        const stale = got < latest;
        log(`Read asked replicas ${asked.map(r => r.id).join(', ')} → v${got}${stale ? ` (STALE, latest is v${latest})` : ' (latest)'}`, stale ? 'is-bad' : 'is-good');
        draw();
      });
      lc.on($('#q-sync'), 'click', () => {
        clearHits();
        let n = 0; replicas.forEach(r => { if (r.up && r.v < latest) { r.v = latest; n++; } });
        log(`Anti-entropy repaired ${n} live replica(s) to v${latest}`);
        draw();
      });
      lc.on($('#q-reset'), 'click', () => { reset(); draw(); log('Reset'); });
      reset(); syncSliders(); draw();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── Vector clocks vs Lamport clocks ─────────────────────────
  window.SIMULATORS['vector-clocks'] = {
    id: 'vector-clocks',
    title: 'Vector Clocks vs Lamport Clocks',
    slugs: ['clocks-and-ordering', 'clock-skew-and-id-ordering'],
    blurb: 'Create events and messages between three processes, then compare any two events.',
    render() {
      const procs = ['A', 'B', 'C'];
      return `
        <div class="simulator-card" id="sim-vc">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Vector Clocks vs Lamport Clocks</div>
            <button class="btn btn--sm" id="vc-reset">Reset</button>
          </div>
          <p class="simulator-card__description">Each event gets a Lamport timestamp L and a vector clock [A, B, C]. Lamport order is consistent with causality, but only vector clocks can tell you two events are concurrent.</p>
          <div class="sim-cols">
            ${procs.map(p => `
              <div class="sim-col">
                <div class="sim-col__head">Process ${p}</div>
                <div class="simulator-card__controls">
                  <button class="btn btn--outline btn--sm" data-act="local" data-p="${p}">Local event</button>
                  ${procs.filter(q => q !== p).map(q => `<button class="btn btn--outline btn--sm" data-act="send" data-p="${p}" data-to="${q}">Send → ${q}</button>`).join('')}
                </div>
                <div class="sim-col__events" id="vc-events-${p}"></div>
              </div>`).join('')}
          </div>
          <div class="simulator-card__controls">
            <label>Compare <select class="simulator-card__input sim-select" id="vc-a"></select></label>
            <label>with <select class="simulator-card__input sim-select" id="vc-b"></select></label>
          </div>
          <div class="sim-verdict" id="vc-verdict">Create a few events, then pick two to compare.</div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      const P = ['A', 'B', 'C'];
      let events, clocks, lamport, seq;
      const reset = () => { events = []; clocks = { A: [0, 0, 0], B: [0, 0, 0], C: [0, 0, 0] }; lamport = { A: 0, B: 0, C: 0 }; seq = 0; };
      const record = (p, label, vc, L) => { const e = { id: 'e' + (++seq), p, label, vc: [...vc], L }; events.push(e); return e; };

      const tick = p => { clocks[p][P.indexOf(p)]++; lamport[p]++; };
      const local = p => { tick(p); record(p, 'local', clocks[p], lamport[p]); };
      const send = (p, q) => {
        tick(p);
        const msgVc = [...clocks[p]], msgL = lamport[p];
        record(p, `send → ${q}`, clocks[p], lamport[p]);
        // receiver merges: element-wise max, then its own tick
        clocks[q] = clocks[q].map((v, i) => Math.max(v, msgVc[i]));
        lamport[q] = Math.max(lamport[q], msgL);
        tick(q);
        record(q, `recv ← ${p}`, clocks[q], lamport[q]);
      };
      const leq = (a, b) => a.every((v, i) => v <= b[i]);
      const compare = (x, y) => {
        if (x.id === y.id) return 'Same event.';
        const lam = `Lamport: ${x.id} L=${x.L}, ${y.id} L=${y.L}.`;
        if (leq(x.vc, y.vc)) return `<b>${x.id} → ${y.id}</b>: ${x.id} happened-before ${y.id} (every entry of [${x.vc}] ≤ [${y.vc}]). ${lam}`;
        if (leq(y.vc, x.vc)) return `<b>${y.id} → ${x.id}</b>: ${y.id} happened-before ${x.id} (every entry of [${y.vc}] ≤ [${x.vc}]). ${lam}`;
        const lamNote = x.L === y.L
          ? 'Their Lamport timestamps tie (a process-id tiebreak would order them arbitrarily).'
          : `Lamport still puts ${x.L < y.L ? x.id : y.id} first, which looks like causality but is not.`;
        return `<b>${x.id} ∥ ${y.id}: concurrent.</b> Neither vector dominates ([${x.vc}] vs [${y.vc}]). ${lam} ${lamNote}`;
      };
      const draw = () => {
        P.forEach(p => {
          $('#vc-events-' + p).innerHTML = events.filter(e => e.p === p).map(e =>
            `<div class="sim-event"><span class="sim-event__id">${e.id}</span> ${esc(e.label)}<span class="sim-event__vc">L=${e.L} · [${e.vc.join(', ')}]</span></div>`).join('') || '<div class="sim-muted">no events</div>';
        });
        const opts = events.map(e => `<option value="${e.id}">${e.id} (${e.p}: ${esc(e.label)})</option>`).join('');
        const a = $('#vc-a').value, b = $('#vc-b').value;
        $('#vc-a').innerHTML = opts; $('#vc-b').innerHTML = opts;
        if (events.length) {
          $('#vc-a').value = events.some(e => e.id === a) ? a : events[0].id;
          $('#vc-b').value = events.some(e => e.id === b) ? b : events[events.length - 1].id;
          verdict();
        } else $('#vc-verdict').textContent = 'Create a few events, then pick two to compare.';
      };
      const verdict = () => {
        const x = events.find(e => e.id === $('#vc-a').value), y = events.find(e => e.id === $('#vc-b').value);
        if (x && y) $('#vc-verdict').innerHTML = compare(x, y);
      };
      lc.on(root.querySelector('#sim-vc'), 'click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        if (b.dataset.act === 'local') local(b.dataset.p); else send(b.dataset.p, b.dataset.to);
        draw();
      });
      lc.on($('#vc-a'), 'change', verdict);
      lc.on($('#vc-b'), 'change', verdict);
      lc.on($('#vc-reset'), 'click', () => { reset(); draw(); });
      reset();
      // seed a small scenario with one concurrent pair
      local('A'); send('A', 'B'); local('C');
      draw();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── Count-Min Sketch ────────────────────────────────────────
  window.SIMULATORS['count-min'] = {
    id: 'count-min',
    title: 'Count-Min Sketch',
    slugs: ['count-min-sketch', 'top-k-heavy-hitters'],
    blurb: 'Stream items into a d × w counter grid and compare estimated vs true counts.',
    render() {
      return `
        <div class="simulator-card" id="sim-cms">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Count-Min Sketch (d = 3 rows)</div>
            <span class="simulator-card__status" id="cms-bound"></span>
          </div>
          <p class="simulator-card__description">Each item increments one counter per row. The estimate is the minimum across its rows, so it never under-counts; collisions only push it up. Narrow grids collide more.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">Width w: <b id="cms-w-val">8</b></span><input type="range" id="cms-w" min="4" max="32" step="4" value="8"></label>
            <label><span class="simulator-card__label">Item</span><input class="simulator-card__input" id="cms-item" value="cats" maxlength="24"></label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="cms-add">Add item</button>
            <button class="btn btn--outline btn--sm" id="cms-query">Estimate item</button>
            <button class="btn btn--outline btn--sm" id="cms-stream">Stream 500 Zipf items</button>
            <button class="btn btn--sm" id="cms-reset">Reset</button>
          </div>
          <div class="sim-grid-wrap"><table class="sim-grid" id="cms-grid"></table></div>
          <div class="sim-verdict" id="cms-verdict">Add items or stream a skewed workload.</div>
          <div class="sim-topk" id="cms-topk"></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      const D = 3, SEEDS = [0x9e3779b1, 0x85ebca6b, 0xc2b2ae35];
      const WORDS = ['cats', 'dogs', 'kafka', 'redis', 'raft', 'paxos', 'bloom', 'shard', 'cache', 'queue', 'index', 'btree', 'lsm', 'quorum', 'gossip', 'vector', 'lease', 'fence', 'saga', 'retry'];
      let w = 8, grid, truth, total;
      const hash = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; return ((h ^ (h >>> 12)) >>> 0) % w; };
      const reset = () => { grid = Array.from({ length: D }, () => new Array(w).fill(0)); truth = new Map(); total = 0; };
      const add = (item, n = 1) => { for (let d = 0; d < D; d++) grid[d][hash(item, SEEDS[d])] += n; truth.set(item, (truth.get(item) || 0) + n); total += n; };
      const estimate = item => Math.min(...Array.from({ length: D }, (_, d) => grid[d][hash(item, SEEDS[d])]));
      const draw = (highlight) => {
        $('#cms-w-val').textContent = w;
        const eps = Math.E / w;
        $('#cms-bound').textContent = `error ≤ e/w × total = ${(eps * total).toFixed(0)} (with prob ≈ ${(100 * (1 - Math.exp(-D))).toFixed(0)}%)`;
        const cols = highlight ? Array.from({ length: D }, (_, d) => hash(highlight, SEEDS[d])) : [];
        $('#cms-grid').innerHTML = grid.map((row, d) => `<tr><th>h${d + 1}</th>${row.map((c, i) => `<td class="${cols[d] === i ? 'is-hit' : ''}">${c}</td>`).join('')}</tr>`).join('');
        const ranked = [...truth.keys()].map(k => ({ k, est: estimate(k), real: truth.get(k) })).sort((a, b) => b.est - a.est).slice(0, 5);
        $('#cms-topk').innerHTML = ranked.length ? `<div class="simulator-card__label">Top 5 by estimate (estimate / true)</div>` +
          ranked.map(r => `<div class="sim-topk__row"><span>${esc(r.k)}</span><span>${r.est} / ${r.real}${r.est > r.real ? ` <em>+${r.est - r.real}</em>` : ''}</span></div>`).join('') : '';
      };
      const query = () => {
        const item = $('#cms-item').value.trim(); if (!item) return;
        const est = estimate(item), real = truth.get(item) || 0;
        $('#cms-verdict').innerHTML = `<b>${esc(item)}</b>: estimate ${est}, true ${real}${est > real ? ` — over by ${est - real} from collisions` : ' — exact'}. Highlighted cells are its three counters; the answer is their minimum.`;
        draw(item);
      };
      lc.on($('#cms-w'), 'input', e => { w = +e.target.value; reset(); draw(); $('#cms-verdict').textContent = 'Width changed: sketch cleared.'; });
      lc.on($('#cms-add'), 'click', () => { const item = $('#cms-item').value.trim(); if (!item) return; add(item); query(); });
      lc.on($('#cms-query'), 'click', query);
      lc.on($('#cms-stream'), 'click', () => {
        // Zipf(s=1): item k is picked with probability ∝ 1/k
        const weights = WORDS.map((_, k) => 1 / (k + 1)), sum = weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < 500; i++) { let r = Math.random() * sum, k = 0; while ((r -= weights[k]) > 0) k++; add(WORDS[k]); }
        $('#cms-verdict').textContent = `Streamed 500 items (total ${total}). Heavy hitters stay accurate; rare items absorb the collision error.`;
        draw();
      });
      lc.on($('#cms-reset'), 'click', () => { reset(); draw(); $('#cms-verdict').textContent = 'Cleared.'; });
      reset(); draw();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── Gossip dissemination ────────────────────────────────────
  window.SIMULATORS['gossip-spread'] = {
    id: 'gossip-spread',
    title: 'Gossip Dissemination',
    slugs: ['gossip-protocol'],
    blurb: 'Spread a rumor with push gossip and watch it reach every node in about log N rounds.',
    render() {
      return `
        <div class="simulator-card" id="sim-gossip">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Gossip Dissemination (push)</div>
            <span class="simulator-card__status" id="g-status"></span>
          </div>
          <p class="simulator-card__description">Every round, each informed node tells <i>fanout</i> random peers. Coverage grows roughly exponentially, so even large clusters converge in a handful of rounds, and dropped messages only slow it down slightly.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">Nodes: <b id="g-n-val">64</b></span><input type="range" id="g-n" min="16" max="256" step="16" value="64"></label>
            <label><span class="simulator-card__label">Fanout: <b id="g-f-val">2</b></span><input type="range" id="g-f" min="1" max="4" value="2"></label>
            <label><span class="simulator-card__label">Message loss: <b id="g-l-val">0</b>%</span><input type="range" id="g-l" min="0" max="50" step="10" value="0"></label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="g-run">Run</button>
            <button class="btn btn--outline btn--sm" id="g-step">Step one round</button>
            <button class="btn btn--sm" id="g-reset">Reset</button>
          </div>
          <div class="sim-dots" id="g-dots"></div>
          <div class="sim-bars" id="g-bars"></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      let N = 64, F = 2, loss = 0, informed, round, history, timer = null;
      const reset = () => { if (timer) { lc.stop(timer); timer = null; } informed = new Uint8Array(N); informed[0] = 1; round = 0; history = [1]; $('#g-run').textContent = 'Run'; };
      const count = () => informed.reduce((a, b) => a + b, 0);
      const step = () => {
        if (count() === N) return false;
        const next = informed.slice();
        for (let i = 0; i < N; i++) {
          if (!informed[i]) continue;
          for (let f = 0; f < F; f++) {
            let peer = Math.floor(Math.random() * (N - 1)); if (peer >= i) peer++;
            if (Math.random() * 100 >= loss) next[peer] = 1;
          }
        }
        informed = next; round++; history.push(count());
        return true;
      };
      const draw = () => {
        $('#g-n-val').textContent = N; $('#g-f-val').textContent = F; $('#g-l-val').textContent = loss;
        const c = count();
        $('#g-status').textContent = `round ${round} · ${c}/${N} informed · log₂N ≈ ${Math.log2(N).toFixed(1)}`;
        $('#g-dots').innerHTML = Array.from(informed, (v, i) => `<span class="sim-dot ${v ? 'is-on' : ''}${i === 0 ? ' is-seed' : ''}"></span>`).join('');
        $('#g-bars').innerHTML = history.map((h, r) => `<div class="sim-bar" title="round ${r}: ${h} nodes"><div style="height:${(100 * h / N).toFixed(1)}%"></div><span>${r}</span></div>`).join('');
      };
      const toggleRun = () => {
        if (timer) { lc.stop(timer); timer = null; $('#g-run').textContent = 'Run'; return; }
        $('#g-run').textContent = 'Pause';
        timer = lc.every(550, () => { if (!step()) { lc.stop(timer); timer = null; $('#g-run').textContent = 'Run'; } draw(); });
      };
      const param = (sel, set) => lc.on($(sel), 'input', e => { set(+e.target.value); reset(); draw(); });
      param('#g-n', v => { N = v; });
      param('#g-f', v => { F = v; });
      param('#g-l', v => { loss = v; });
      lc.on($('#g-run'), 'click', toggleRun);
      lc.on($('#g-step'), 'click', () => { step(); draw(); });
      lc.on($('#g-reset'), 'click', () => { reset(); draw(); });
      reset(); draw();
    },
    unmount() { this._lc?.dispose(); }
  };
})();
