/* ═══════════════════════════════════════════════════════════════
   Simulators: load-balancing algorithms, cache stampede, Snowflake IDs, SLO burn-rate alerts
   Same contract as the other simulator files: { id, title, slugs, blurb, render(), mount(root), unmount(root) }
   ═══════════════════════════════════════════════════════════════ */

window.SIMULATORS = window.SIMULATORS || {};

(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

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

  // Small seeded PRNG (mulberry32): same seed, same run
  const mulberry32 = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Exponential sample with the given mean (1 - u keeps log away from 0)
  const expRand = (rng, mean) => -mean * Math.log(1 - rng());
  // Nearest-rank percentile
  const percentile = (arr, p) => {
    if (!arr.length) return NaN;
    const s = Float64Array.from(arr).sort();
    return s[Math.max(0, Math.ceil(p * s.length) - 1)];
  };
  const fmtMs = v => !isFinite(v) ? '–' : v >= 10000 ? (v / 1000).toFixed(1) + ' s' : v.toFixed(0) + ' ms';
  const fmtPct = (v, d = 1) => (100 * v).toFixed(d) + '%';
  const row = (k, v) => `<div class="sim-topk__row"><span>${k}</span><span>${v}</span></div>`;
  const barsHtml = bars => bars.map(b =>
    `<div class="sim-bar" title="${esc(b.title)}"><div style="height:${Math.min(100, Math.max(0, b.pct)).toFixed(1)}%${b.color ? `;background:var(${b.color})` : ''}"></div><span>${esc(b.label)}</span></div>`).join('');

  // ── Load-balancing algorithms ───────────────────────────────
  window.SIMULATORS['lb-algorithms'] = {
    id: 'lb-algorithms',
    title: 'Load-Balancing Algorithms',
    slugs: ['load-balancers', 'api-gateway-vs-load-balancer'],
    blurb: 'Stream the same requests through Random, Round-robin, Least-connections and Power-of-two-choices with one slow server.',
    render() {
      return `
        <div class="simulator-card" id="sim-lb">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Load-Balancing Algorithms (one slow server)</div>
            <span class="simulator-card__status" id="lb-status"></span>
          </div>
          <p class="simulator-card__description">Each server handles one request at a time (FIFO queue, mean service 50 ms). Server 1 (amber bar) is <i>f</i>× slower. All four balancers get exactly the same request stream. Random and Round-robin ignore load and keep sending the slow node 1/N of the traffic; Least-connections and Power-of-two-choices see its growing in-flight count and route around it. Bars show in-flight requests (queued + in service) per server.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">Servers N: <b id="lb-n-val">8</b></span><input type="range" id="lb-n" min="4" max="12" value="8"></label>
            <label><span class="simulator-card__label">Slow server factor f: <b id="lb-f-val">5</b>×</span><input type="range" id="lb-f" min="1" max="10" value="5"></label>
            <label><span class="simulator-card__label">Offered load: <b id="lb-l-val">70</b>% of N healthy servers</span><input type="range" id="lb-l" min="30" max="95" step="5" value="70"></label>
            <label><span class="simulator-card__label">Speed</span><select class="simulator-card__input sim-select" id="lb-speed"><option value="1">1×</option><option value="4" selected>4×</option><option value="10">10×</option></select></label>
            <label><span class="simulator-card__label">Seed</span><input class="simulator-card__input" id="lb-seed" value="42" maxlength="10"></label>
            <label><span class="simulator-card__label">Deterministic</span><input type="checkbox" id="lb-det" checked> use the seed (off = new random run on reset)</label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="lb-run">Run</button>
            <button class="btn btn--outline btn--sm" id="lb-step">Step 1 s</button>
            <button class="btn btn--sm" id="lb-reset">Reset</button>
          </div>
          <div class="sim-cols" id="lb-cols"></div>
          <div class="sim-verdict" id="lb-verdict">Press Run to stream requests.</div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      const ALGOS = [
        { k: 'random', name: 'Random' },
        { k: 'rr', name: 'Round-robin' },
        { k: 'lc', name: 'Least connections' },
        { k: 'p2c', name: 'Power of two choices' }
      ];
      const S = 50;          // mean service time (ms) on a healthy server
      const MAX_T = 300000;  // auto-pause after 5 simulated minutes
      const LAT_CAP = 20000; // percentiles over the most recent completions
      let N = 8, F = 5, load = 70, speed = 4, t, arrRng, nextArr, sims, timer = null, seedUsed = 42;

      const lambda = () => (load / 100) * N / S; // requests per ms
      const inflight = sv => sv.q.length + (sv.cur ? 1 : 0);

      const reset = () => {
        if (timer) { lc.stop(timer); timer = null; }
        $('#lb-run').textContent = 'Run';
        const raw = parseInt($('#lb-seed').value, 10);
        seedUsed = $('#lb-det').checked && isFinite(raw) ? raw >>> 0 : (Math.random() * 4294967296) >>> 0;
        arrRng = mulberry32(seedUsed);
        t = 0;
        nextArr = expRand(arrRng, 1 / lambda());
        sims = ALGOS.map((a, i) => ({
          ...a,
          rng: mulberry32((seedUsed + Math.imul(0x9E3779B9, i + 1)) >>> 0),
          rr: 0,
          sv: Array.from({ length: N }, (_, j) => ({ f: j === 0 ? F : 1, cur: null, doneAt: 0, q: [] })),
          lat: [], sent: new Array(N).fill(0), total: 0, peak: 0
        }));
      };

      // Complete every request on every server that finishes by time T
      const advance = (sim, T) => {
        for (const sv of sim.sv) {
          while (sv.cur && sv.doneAt <= T) {
            sim.lat.push(sv.doneAt - sv.cur.a);
            const next = sv.q.shift();
            if (next) { sv.cur = next; sv.doneAt += next.d * sv.f; } else sv.cur = null;
          }
        }
        if (sim.lat.length > 2 * LAT_CAP) sim.lat.splice(0, sim.lat.length - LAT_CAP);
      };
      const pick = sim => {
        const n = sim.sv.length;
        switch (sim.k) {
          case 'random': return Math.floor(sim.rng() * n);
          case 'rr': return sim.rr++ % n;
          case 'lc': {
            // fewest in-flight; ties broken by a rotating start so equal servers share work
            const start = sim.rr++ % n; let best = start;
            for (let o = 1; o < n; o++) { const j = (start + o) % n; if (inflight(sim.sv[j]) < inflight(sim.sv[best])) best = j; }
            return best;
          }
          case 'p2c': {
            const a = Math.floor(sim.rng() * n);
            let b = Math.floor(sim.rng() * (n - 1)); if (b >= a) b++;
            return inflight(sim.sv[b]) < inflight(sim.sv[a]) ? b : a;
          }
        }
        return 0;
      };
      const assign = (sim, req) => {
        const j = pick(sim), sv = sim.sv[j];
        sim.sent[j]++; sim.total++;
        if (!sv.cur) { sv.cur = req; sv.doneAt = req.a + req.d * sv.f; } else sv.q.push(req);
        sim.peak = Math.max(sim.peak, inflight(sv));
      };
      const simulate = ms => {
        const end = Math.min(t + ms, MAX_T);
        while (nextArr <= end) {
          const req = { a: nextArr, d: expRand(arrRng, S) };
          for (const sim of sims) { advance(sim, req.a); assign(sim, req); }
          nextArr += expRand(arrRng, 1 / lambda());
        }
        for (const sim of sims) advance(sim, end);
        t = end;
        return t < MAX_T;
      };

      const draw = () => {
        $('#lb-n-val').textContent = N; $('#lb-f-val').textContent = F; $('#lb-l-val').textContent = load;
        const rho = load / 100;
        const effCap = N - 1 + 1 / F;                   // cluster capacity in "healthy server" units
        const util = rho * N / effCap;                   // utilisation if load were spread perfectly
        const slowUtilBlind = rho * F;                   // slow node utilisation under Random / RR (gets 1/N of traffic)
        const capShare = (1 / F) / effCap;               // slow node's fair share of traffic by capacity
        const st = $('#lb-status');
        st.textContent = `t = ${(t / 1000).toFixed(1)} s · ${(lambda() * 1000).toFixed(0)} req/s · cluster utilisation ${fmtPct(util, 0)} · slow node under Random/RR ${fmtPct(slowUtilBlind, 0)}`;
        st.style.color = util >= 1 ? 'var(--error)' : slowUtilBlind >= 1 ? 'var(--warning)' : '';

        const scale = Math.max(5, ...sims.map(s => Math.max(...s.sv.map(inflight))));
        const stats = sims.map(sim => {
          const oldest = Math.max(0, ...sim.sv.map(sv => sv.cur ? t - sv.cur.a : 0));
          return { sim, p50: percentile(sim.lat.slice(-LAT_CAP), 0.5), p99: percentile(sim.lat.slice(-LAT_CAP), 0.99), oldest, share: sim.total ? sim.sent[0] / sim.total : 0 };
        });
        $('#lb-cols').innerHTML = stats.map(({ sim, p50, p99, oldest, share }) => `
          <div class="sim-col">
            <div class="sim-col__head">${esc(sim.name)}</div>
            <div class="sim-grid-wrap"><div class="sim-bars">${barsHtml(sim.sv.map((sv, j) => ({
              pct: 100 * inflight(sv) / scale, label: String(inflight(sv)), color: j === 0 && F > 1 ? '--warning' : '',
              title: `Server ${j + 1}${j === 0 && F > 1 ? ' (slow)' : ''}: ${inflight(sv)} in flight, ${sim.sent[j]} routed`
            })))}</div></div>
            <div class="sim-topk">
              ${row('p50 latency', fmtMs(p50))}
              ${row('p99 latency', fmtMs(p99))}
              ${row('peak in-flight on a server', sim.peak)}
              ${row('sent to slow server', fmtPct(share))}
              ${row('oldest request waiting', fmtMs(oldest))}
            </div>
          </div>`).join('');

        if (t === 0) { $('#lb-verdict').textContent = `Press Run to stream requests (seed ${seedUsed}).`; return; }
        const ranked = [...stats].sort((a, b) => (a.p99 || 0) - (b.p99 || 0));
        const lines = [];
        if (F === 1) lines.push('No slow server (f = 1): all four stay close; P2C and least-connections still trim the tail by avoiding momentarily busy servers.');
        else {
          lines.push(`The slow server has ${fmtPct(capShare)} of the cluster's capacity, but Random and Round-robin send it 1/N = ${fmtPct(1 / N)} of requests, so its utilisation is load × f = ${fmtPct(slowUtilBlind, 0)}${slowUtilBlind >= 1 ? ' → its queue grows without bound and the p99 keeps climbing' : ''}.`);
          lines.push('Least-connections and P2C see its in-flight count rise and send it only what it can drain.');
        }
        if (util >= 1) lines.push(`<b>Overloaded:</b> total demand exceeds total capacity (${fmtPct(util, 0)}), so every algorithm eventually queues.`);
        $('#lb-verdict').innerHTML = `<b>Lowest p99: ${esc(ranked[0].sim.name)}</b> (${fmtMs(ranked[0].p99)}); highest: ${esc(ranked[ranked.length - 1].sim.name)} (${fmtMs(ranked[ranked.length - 1].p99)}). ${lines.join(' ')} <span class="sim-muted">Seed ${seedUsed}. Percentiles cover completed requests only; see “oldest request waiting” for requests still stuck.</span>`;
      };

      const toggleRun = () => {
        if (timer) { lc.stop(timer); timer = null; $('#lb-run').textContent = 'Run'; return; }
        if (t >= MAX_T) reset();
        $('#lb-run').textContent = 'Pause';
        timer = lc.every(100, () => {
          if (!simulate(100 * speed)) { lc.stop(timer); timer = null; $('#lb-run').textContent = 'Run'; }
          draw();
        });
      };
      const param = (sel, set) => lc.on($(sel), 'input', e => { set(+e.target.value); reset(); draw(); });
      param('#lb-n', v => { N = v; });
      param('#lb-f', v => { F = v; });
      param('#lb-l', v => { load = v; });
      lc.on($('#lb-speed'), 'change', e => { speed = +e.target.value; });
      lc.on($('#lb-seed'), 'change', () => { reset(); draw(); });
      lc.on($('#lb-det'), 'change', () => { reset(); draw(); });
      lc.on($('#lb-run'), 'click', toggleRun);
      lc.on($('#lb-step'), 'click', () => { if (t >= MAX_T) reset(); simulate(1000); draw(); });
      lc.on($('#lb-reset'), 'click', () => { reset(); draw(); });
      reset(); draw();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── Cache stampede protection ───────────────────────────────
  window.SIMULATORS['cache-stampede'] = {
    id: 'cache-stampede',
    title: 'Cache Stampede Protection',
    slugs: ['cache-concurrency-control', 'ttl-expiration-and-cache-reapers'],
    blurb: 'Expire a hot key under load and compare no protection, single-flight, stale-while-revalidate and XFetch.',
    render() {
      return `
        <div class="simulator-card" id="sim-stampede">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Cache Stampede on a Hot Key</div>
            <span class="simulator-card__status" id="cs-status"></span>
          </div>
          <p class="simulator-card__description">One hot key with a TTL; every client reads it about once per second. Rebuilding it takes one database query of fixed duration. All four strategies see the same request stream. With no protection, every request that arrives while the key is being rebuilt also misses and hits the database: roughly request rate × rebuild time queries per expiry.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">TTL: <b id="cs-ttl-val">10</b> s</span><input type="range" id="cs-ttl" min="2" max="30" value="10"></label>
            <label><span class="simulator-card__label">DB rebuild time: <b id="cs-d-val">500</b> ms</span><input type="range" id="cs-d" min="100" max="3000" step="100" value="500"></label>
            <label><span class="simulator-card__label">Clients (≈1 req/s each): <b id="cs-n-val">200</b></span><input type="range" id="cs-n" min="10" max="1000" step="10" value="200"></label>
            <label><span class="simulator-card__label">XFetch β: <b id="cs-b-val">1</b></span><input type="range" id="cs-b" min="0.5" max="3" step="0.5" value="1"></label>
            <label><span class="simulator-card__label">Speed</span><select class="simulator-card__input sim-select" id="cs-speed"><option value="1">1×</option><option value="3" selected>3×</option><option value="10">10×</option></select></label>
            <label><span class="simulator-card__label">Chart strategy</span><select class="simulator-card__input sim-select" id="cs-chart">
              <option value="none">No protection</option><option value="mutex">Single-flight / mutex</option><option value="swr">Stale-while-revalidate</option><option value="xfetch">XFetch</option></select></label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="cs-run">Run</button>
            <button class="btn btn--outline btn--sm" id="cs-step">Step 5 s</button>
            <button class="btn btn--sm" id="cs-reset">Reset</button>
          </div>
          <div class="simulator-card__label" id="cs-chart-label"></div>
          <div class="sim-grid-wrap"><div class="sim-bars" id="cs-bars"></div></div>
          <div class="sim-grid-wrap"><table class="sim-grid" id="cs-table"></table></div>
          <div class="sim-verdict" id="cs-verdict"></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      const STRATS = [
        { k: 'none', name: 'No protection' },
        { k: 'mutex', name: 'Single-flight' },
        { k: 'swr', name: 'Stale-while-revalidate' },
        { k: 'xfetch', name: 'XFetch' }
      ];
      const BUCKET = 500, BARS = 24, HIT_MS = 1, LAT_CAP = 20000;
      let TTL = 10000, D = 500, clients = 200, beta = 1, speed = 3, chartK = 'none';
      let t, rng, nextArr, sims, timer = null;

      const reset = () => {
        if (timer) { lc.stop(timer); timer = null; }
        $('#cs-run').textContent = 'Run';
        t = 0; rng = mulberry32(42);
        nextArr = expRand(rng, 1000 / clients);
        // cache starts warm: value written at t = 0
        sims = STRATS.map((s, i) => ({
          ...s, rng: mulberry32(1000 + i),
          soft: TTL, hard: TTL + (s.k === 'swr' ? TTL : 0),
          inflight: [], refreshing: null, episode: 0, episodes: [],
          db: 0, stale: 0, waited: 0, reqs: 0, lat: [], buckets: [], peak: 0
        }));
      };
      const write = (sim, at) => { sim.soft = at + TTL; sim.hard = sim.soft + (sim.k === 'swr' ? TTL : 0); };
      // Finish DB queries (all take D ms, so FIFO order == completion order)
      const complete = (sim, T) => {
        while (sim.inflight.length && sim.inflight[0].doneAt <= T) {
          const q = sim.inflight.shift();
          write(sim, q.doneAt);
          if (sim.refreshing === q) sim.refreshing = null;
          if (!sim.inflight.length) { sim.episodes.push(sim.episode); sim.episode = 0; }
        }
      };
      const query = (sim, at) => {
        const q = { doneAt: at + D };
        sim.inflight.push(q); sim.db++; sim.episode++;
        const b = Math.floor(at / BUCKET); sim.buckets[b] = (sim.buckets[b] || 0) + 1;
        sim.peak = Math.max(sim.peak, sim.inflight.length);
        return q;
      };
      const handle = (sim, at) => {
        sim.reqs++;
        let lat = HIT_MS;
        const fresh = at < sim.soft;
        switch (sim.k) {
          case 'none':
            if (!fresh) { query(sim, at); lat = D; }
            break;
          case 'mutex':
            if (!fresh) {
              if (sim.refreshing) { sim.waited++; lat = sim.refreshing.doneAt - at; }
              else { sim.refreshing = query(sim, at); lat = D; }
            }
            break;
          case 'swr':
            if (!fresh) {
              if (at < sim.hard) { sim.stale++; if (!sim.refreshing) sim.refreshing = query(sim, at); }
              else if (sim.refreshing) { sim.waited++; lat = sim.refreshing.doneAt - at; }
              else { sim.refreshing = query(sim, at); lat = D; }
            }
            break;
          case 'xfetch': {
            // Vattani et al.: recompute early if now − δ·β·ln(rand) ≥ expiry (δ = rebuild time).
            // No lock: several requests can decide to recompute; the key stays readable meanwhile.
            const u = 1 - sim.rng();
            if (!fresh || at - D * beta * Math.log(u) >= sim.soft) { query(sim, at); lat = D; }
            break;
          }
        }
        sim.lat.push(lat);
        if (sim.lat.length > 2 * LAT_CAP) sim.lat.splice(0, sim.lat.length - LAT_CAP);
      };
      const simulate = ms => {
        const end = t + ms;
        while (nextArr <= end) {
          for (const sim of sims) { complete(sim, nextArr); handle(sim, nextArr); }
          nextArr += expRand(rng, 1000 / clients);
        }
        for (const sim of sims) complete(sim, end);
        t = end;
      };

      const draw = () => {
        $('#cs-ttl-val').textContent = TTL / 1000; $('#cs-d-val').textContent = D;
        $('#cs-n-val').textContent = clients; $('#cs-b-val').textContent = beta;
        $('#cs-status').textContent = `t = ${(t / 1000).toFixed(1)} s · ${clients} req/s · expected misses per expiry without protection ≈ ${(clients * D / 1000).toFixed(0)}`;

        const sim = sims.find(s => s.k === chartK);
        const cur = Math.floor(t / BUCKET), from = Math.max(0, cur - BARS + 1);
        const vals = Array.from({ length: Math.min(BARS, cur + 1) }, (_, i) => ({ b: from + i, v: sim.buckets[from + i] || 0 }));
        const scale = Math.max(1, ...vals.map(x => x.v));
        $('#cs-chart-label').textContent = `${sim.name}: DB queries started per 500 ms (last ${BARS * BUCKET / 1000} s, peak bar ${scale})`;
        $('#cs-bars').innerHTML = barsHtml(vals.map(({ b, v }) => ({
          pct: 100 * v / scale, label: String(v), color: v > 3 ? '--error' : v > 1 ? '--warning' : '',
          title: `${(b * BUCKET / 1000).toFixed(1)}–${((b + 1) * BUCKET / 1000).toFixed(1)} s: ${v} DB queries`
        })));

        const ep = s => s.episode ? [...s.episodes, s.episode] : s.episodes;
        const metrics = [
          ['DB queries', s => s.db],
          ['Rebuild episodes', s => s.episodes.length],
          ['DB queries per expiry (max)', s => ep(s).length ? Math.max(...ep(s)) : 0],
          ['DB queries per expiry (avg)', s => ep(s).length ? (ep(s).reduce((a, b) => a + b, 0) / ep(s).length).toFixed(1) : 0],
          ['Peak concurrent DB queries', s => s.peak],
          ['Stale reads served', s => s.stale],
          ['Requests blocked waiting', s => s.waited],
          ['p99 latency', s => fmtMs(percentile(s.lat, 0.99))],
          ['p99.9 latency', s => fmtMs(percentile(s.lat, 0.999))]
        ];
        $('#cs-table').innerHTML = `<tr><th></th>${sims.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>` +
          metrics.map(([name, f]) => `<tr><th>${name}</th>${sims.map(s => `<td>${f(s)}</td>`).join('')}</tr>`).join('');

        const byK = Object.fromEntries(sims.map(s => [s.k, s]));
        $('#cs-verdict').innerHTML = t < TTL
          ? `The key is warm until t = ${TTL / 1000} s. Run past the first expiry to see the spike.`
          : `<b>No protection</b> sent ${byK.none.db} queries to the database; <b>single-flight</b> sent one per expiry (${byK.mutex.db}) but ${byK.mutex.waited} requests blocked for up to ${D} ms. <b>Stale-while-revalidate</b> also sends one per expiry and nobody waits, at the cost of ${byK.swr.stale} stale reads. <b>XFetch</b> (${byK.xfetch.db} queries) refreshes shortly before expiry, so readers rarely see a miss; raising β refreshes earlier and more often, and with no lock it can occasionally fire more than one early rebuild.`;
      };

      const toggleRun = () => {
        if (timer) { lc.stop(timer); timer = null; $('#cs-run').textContent = 'Run'; return; }
        $('#cs-run').textContent = 'Pause';
        timer = lc.every(100, () => { simulate(100 * speed); draw(); });
      };
      const param = (sel, set) => lc.on($(sel), 'input', e => { set(+e.target.value); reset(); draw(); });
      param('#cs-ttl', v => { TTL = v * 1000; });
      param('#cs-d', v => { D = v; });
      param('#cs-n', v => { clients = v; });
      param('#cs-b', v => { beta = v; });
      lc.on($('#cs-speed'), 'change', e => { speed = +e.target.value; });
      lc.on($('#cs-chart'), 'change', e => { chartK = e.target.value; draw(); });
      lc.on($('#cs-run'), 'click', toggleRun);
      lc.on($('#cs-step'), 'click', () => { simulate(5000); draw(); });
      lc.on($('#cs-reset'), 'click', () => { reset(); draw(); });
      reset(); draw();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── Snowflake ID layout ─────────────────────────────────────
  window.SIMULATORS['snowflake-layout'] = {
    id: 'snowflake-layout',
    title: 'Snowflake ID Generator and Decoder',
    slugs: ['snowflake-id-design', 'uuid-objectid-and-snowflake', 'distributed-id-generation'],
    blurb: 'Generate 64-bit Snowflake IDs, see the bit layout, decode an ID, and trigger sequence overflow and clock rollback.',
    render() {
      return `
        <div class="simulator-card" id="sim-snowflake">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Snowflake ID: 1 + 41 + 10 + 12 bits</div>
            <span class="simulator-card__status" id="sf-status"></span>
          </div>
          <p class="simulator-card__description">A Snowflake ID packs a sign bit (always 0), 41 bits of milliseconds since a custom epoch, a 10-bit worker ID and a 12-bit per-millisecond sequence into one signed 64-bit integer. IDs from one worker are strictly increasing, and IDs from all workers sort roughly by time.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">Epoch preset</span><select class="simulator-card__input sim-select" id="sf-preset">
              <option value="1288834974657">Twitter (2010-11-04T01:42:54.657Z)</option>
              <option value="1577836800000">2020-01-01T00:00:00Z</option>
              <option value="0">Unix epoch (1970-01-01)</option>
              <option value="custom">Custom…</option></select></label>
            <label><span class="simulator-card__label">Epoch (ms since 1970)</span><input class="simulator-card__input" id="sf-epoch" value="1288834974657" maxlength="15"></label>
            <label><span class="simulator-card__label">Worker ID: <b id="sf-w-val">7</b> (0–1023)</span><input type="range" id="sf-w" min="0" max="1023" value="7"></label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="sf-gen">Generate ID</button>
            <button class="btn btn--outline btn--sm" id="sf-burst">Burst 10,000 in one ms</button>
            <button class="btn btn--outline btn--sm" id="sf-back">Roll clock back 50 ms</button>
            <button class="btn btn--sm" id="sf-reset">Reset</button>
          </div>
          <div class="sim-verdict" id="sf-bits"></div>
          <div class="sim-grid-wrap"><table class="sim-grid" id="sf-table"></table></div>
          <div class="simulator-card__controls">
            <label>Decode an ID <input class="simulator-card__input" id="sf-decode" placeholder="decimal or 0x hex" maxlength="24"></label>
            <button class="btn btn--outline btn--sm" id="sf-decode-btn">Decode</button>
          </div>
          <div class="sim-verdict" id="sf-decoded">Paste an ID (or click one in the log) to decode it with the current epoch.</div>
          <div class="simulator-card__log" id="sf-log"><div class="simulator-card__log-header">Event log (click an ID to decode it)</div></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      const TS_BITS = 41n, W_BITS = 10n, SEQ_BITS = 12n;
      const MAX_TS = (1n << TS_BITS) - 1n, MAX_SEQ = (1n << SEQ_BITS) - 1n, W_MASK = (1n << W_BITS) - 1n;
      const TS_SHIFT = W_BITS + SEQ_BITS, W_SHIFT = SEQ_BITS;
      const MS_PER_YEAR = 365.25 * 86400000;
      let epoch = 1288834974657n, worker = 7n, lastTs = -1n, seq = 0n, clockOffset = 0, lastId = null;

      const log = (html, kind = '') => {
        const d = document.createElement('div'); d.className = 'sim-log-line ' + kind; d.innerHTML = html;
        const box = $('#sf-log'); box.insertBefore(d, box.children[1] || null);
        while (box.children.length > 41) box.removeChild(box.lastChild);
      };
      const idLink = id => `<button class="btn btn--sm" data-id="${id}">${id}</button>`;
      const isoOf = ms => { const d = new Date(Number(ms)); return isNaN(d) ? 'out of range' : d.toISOString(); };
      const nowMs = () => BigInt(Date.now() + clockOffset);

      // One generator step at wall-clock time `ms` (BigInt). Returns { id, ts, seq } or { error }.
      // `spin` = what tilNextMillis would do on sequence overflow: move to the next millisecond.
      const nextId = (ms, onOverflow) => {
        let ts = ms - epoch;
        if (ts < 0n) return { error: `the clock (${isoOf(ms)}) is before the epoch` };
        if (ts < lastTs) return { error: `clock moved backwards by ${lastTs - ts} ms (now ${ts}, last ${lastTs}); refusing to generate so IDs cannot repeat`, rollback: true };
        if (ts === lastTs) {
          seq = (seq + 1n) & MAX_SEQ;
          if (seq === 0n) { ts = lastTs + 1n; if (onOverflow) onOverflow(ts); } // spin until next ms
        } else seq = 0n;
        if (ts > MAX_TS) return { error: `timestamp ${ts} no longer fits in 41 bits; this epoch ran out on ${isoOf(epoch + MAX_TS)}` };
        lastTs = ts;
        return { id: (ts << TS_SHIFT) | (worker << W_SHIFT) | seq, ts, seq };
      };
      const decode = id => ({ ts: id >> TS_SHIFT, w: (id >> W_SHIFT) & W_MASK, seq: id & MAX_SEQ });

      const drawLayout = id => {
        if (id === null) { $('#sf-bits').textContent = 'Generate an ID to see its bit layout.'; $('#sf-table').innerHTML = ''; return; }
        const bin = id.toString(2).padStart(64, '0');
        const parts = [
          { name: 'sign', bits: bin.slice(0, 1), color: '--fg-muted' },
          { name: 'timestamp', bits: bin.slice(1, 42), color: '--info' },
          { name: 'worker', bits: bin.slice(42, 52), color: '--success' },
          { name: 'sequence', bits: bin.slice(52), color: '--warning' }
        ];
        $('#sf-bits').innerHTML = `<div style="font-family:var(--font-mono);word-break:break-all">${parts.map(p => `<span style="color:var(${p.color})" title="${p.name}">${p.bits}</span>`).join(' ')}</div>`;
        const d = decode(id);
        $('#sf-table').innerHTML = `<tr><th>Field</th><th>Bits</th><th>Value</th><th>Meaning</th></tr>
          <tr><th style="color:var(--fg-muted)">sign</th><td>63</td><td>0</td><td>always 0, so the ID stays positive as a signed int64</td></tr>
          <tr><th style="color:var(--info)">timestamp</th><td>62–22 (41)</td><td>${d.ts}</td><td>${isoOf(epoch + d.ts)}</td></tr>
          <tr><th style="color:var(--success)">worker</th><td>21–12 (10)</td><td>${d.w}</td><td>often split 5 bits datacenter (${d.w >> 5n}) + 5 bits machine (${d.w & 31n})</td></tr>
          <tr><th style="color:var(--warning)">sequence</th><td>11–0 (12)</td><td>${d.seq}</td><td>counter within this millisecond (0–4095)</td></tr>`;
      };
      const drawStatus = () => {
        $('#sf-w-val').textContent = worker;
        const years = Number(MAX_TS + 1n) / MS_PER_YEAR;
        const nowTs = nowMs() - epoch;
        const used = nowTs < 0n ? 0 : Number(nowTs) / Number(MAX_TS + 1n);
        $('#sf-status').textContent = `4096 IDs/ms/worker · 2^41 ms ≈ ${years.toFixed(1)} years → runs out ${isoOf(epoch + MAX_TS).slice(0, 10)} · ${fmtPct(Math.min(used, 1))} used${clockOffset ? ` · clock offset ${clockOffset} ms` : ''}`;
      };
      const showDecode = raw => {
        const s = String(raw).trim();
        if (!/^(0x[0-9a-f]{1,16}|\d{1,20})$/i.test(s)) { $('#sf-decoded').innerHTML = `<b>${esc(s) || '(empty)'}</b> is not a decimal or 0x-hex 64-bit integer.`; return; }
        const id = BigInt(s);
        if (id >= (1n << 63n)) { $('#sf-decoded').innerHTML = `<b>${esc(s)}</b> sets the sign bit or exceeds 64 bits, so it is not a valid Snowflake ID.`; return; }
        const d = decode(id);
        $('#sf-decoded').innerHTML = `<b>${id}</b> → timestamp ${d.ts} ms after epoch = <b>${isoOf(epoch + d.ts)}</b>, worker <b>${d.w}</b>, sequence <b>${d.seq}</b>. <span class="sim-muted">Decoded with epoch ${epoch}; the wrong epoch shifts the date but not worker or sequence.</span>`;
        drawLayout(id);
      };
      const reset = () => { lastTs = -1n; seq = 0n; clockOffset = 0; lastId = null; };

      lc.on($('#sf-preset'), 'change', e => {
        if (e.target.value === 'custom') { $('#sf-epoch').focus(); return; }
        $('#sf-epoch').value = e.target.value; epoch = BigInt(e.target.value); reset();
        log(`Epoch set to ${epoch} (${isoOf(epoch)}); generator state reset`); drawLayout(null); drawStatus();
      });
      lc.on($('#sf-epoch'), 'change', e => {
        const v = e.target.value.trim();
        if (!/^-?\d{1,15}$/.test(v)) { log(`Epoch “${esc(v)}” is not an integer number of milliseconds`, 'is-bad'); return; }
        epoch = BigInt(v); $('#sf-preset').value = [...$('#sf-preset').options].some(o => o.value === v) ? v : 'custom';
        reset(); log(`Epoch set to ${epoch} (${isoOf(epoch)}); generator state reset`); drawLayout(null); drawStatus();
      });
      lc.on($('#sf-w'), 'input', e => { worker = BigInt(e.target.value); drawStatus(); });
      lc.on($('#sf-gen'), 'click', () => {
        const r = nextId(nowMs());
        if (r.error) { log(esc(r.error), 'is-bad'); return; }
        lastId = r.id; log(`${idLink(r.id)} ts=${r.ts} worker=${worker} seq=${r.seq}`, 'is-good');
        drawLayout(r.id); drawStatus();
      });
      lc.on($('#sf-burst'), 'click', () => {
        // Freeze the clock at one millisecond and ask for 10,000 IDs
        const frozen = nowMs(); let waits = 0, first = null, last = null, err = null;
        const perMs = [];
        for (let i = 0; i < 10000; i++) {
          // after an overflow the real generator spins until the wall clock reaches lastTs + 1
          const at = i === 0 || frozen > lastTs + epoch ? frozen : lastTs + epoch;
          const r = nextId(at, () => { waits++; });
          if (r.error) { err = r.error; break; }
          if (first === null) first = r;
          last = r;
          const k = Number(r.ts - (first.ts)); perMs[k] = (perMs[k] || 0) + 1;
        }
        if (err) { log(esc(err), 'is-bad'); return; }
        lastId = last.id;
        log(`Burst: 10,000 IDs requested within one ms. The 12-bit sequence allows 4096 per ms, so the generator overflowed ${waits} time(s) and had to wait for the next millisecond each time (IDs per ms: ${perMs.map(n => n || 0).join(', ')}). Last ID ${idLink(last.id)} seq=${last.seq}`, 'is-bad');
        drawLayout(last.id); drawStatus();
      });
      lc.on($('#sf-back'), 'click', () => {
        clockOffset -= 50;
        log(`Clock stepped back 50 ms (e.g. an NTP correction). The next Generate is refused while the clock is behind the last timestamp; after ~${Math.max(0, Number(lastTs + epoch - nowMs()))} ms it catches up on its own.`);
        drawStatus();
      });
      lc.on($('#sf-reset'), 'click', () => { reset(); drawLayout(null); drawStatus(); log('Generator reset (clock offset cleared)'); });
      lc.on($('#sf-decode-btn'), 'click', () => showDecode($('#sf-decode').value));
      lc.on($('#sf-decode'), 'keydown', e => { if (e.key === 'Enter') showDecode(e.target.value); });
      lc.on($('#sf-log'), 'click', e => {
        const b = e.target.closest('button[data-id]'); if (!b) return;
        $('#sf-decode').value = b.dataset.id; showDecode(b.dataset.id);
      });
      drawLayout(null); drawStatus();
    },
    unmount() { this._lc?.dispose(); }
  };

  // ── SLO error budget and burn-rate alerts ───────────────────
  window.SIMULATORS['slo-burn'] = {
    id: 'slo-burn',
    title: 'SLO Error Budget and Burn-Rate Alerts',
    slugs: ['slos-and-error-budgets', 'observability-slo-case-study'],
    blurb: 'Inject incidents into an SLO window and see the remaining error budget and which multi-window burn-rate alerts fire.',
    render() {
      return `
        <div class="simulator-card" id="sim-slo">
          <div class="simulator-card__header">
            <div class="simulator-card__title">Error Budget and Multi-Window Burn-Rate Alerts</div>
            <span class="simulator-card__status" id="slo-status"></span>
          </div>
          <p class="simulator-card__description">Burn rate = observed error rate ÷ allowed error rate (1 − SLO). A burn rate of 1 uses exactly the whole budget over the SLO window. Each alert fires only when <i>both</i> its long and short window are at or above the threshold: the long window gives significance, and the short window makes the alert stop soon after the incident ends. Traffic is assumed uniform, with a resolution of one minute.</p>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">SLO</span><select class="simulator-card__input sim-select" id="slo-target">
              <option value="0.99">99%</option><option value="0.999" selected>99.9%</option><option value="0.9999">99.99%</option></select></label>
            <label><span class="simulator-card__label">Window</span><select class="simulator-card__input sim-select" id="slo-window">
              <option value="30" selected>30 days</option><option value="28">28 days</option><option value="7">7 days</option></select></label>
            <label><span class="simulator-card__label">Baseline error rate (%)</span><input class="simulator-card__input" id="slo-base" value="0" maxlength="8"></label>
          </div>
          <div class="simulator-card__grid">
            <label><span class="simulator-card__label">Incident start day</span><input class="simulator-card__input" id="slo-day" type="number" min="1" max="30" value="12"></label>
            <label><span class="simulator-card__label">Start hour (0–23)</span><input class="simulator-card__input" id="slo-hour" type="number" min="0" max="23" value="14"></label>
            <label><span class="simulator-card__label">Error rate x (%)</span><input class="simulator-card__input" id="slo-rate" type="number" min="0.001" max="100" step="any" value="100"></label>
            <label><span class="simulator-card__label">Duration y (minutes)</span><input class="simulator-card__input" id="slo-dur" type="number" min="1" max="20000" value="20"></label>
          </div>
          <div class="simulator-card__controls">
            <button class="btn btn--primary btn--sm" id="slo-add">Inject incident</button>
            <button class="btn btn--outline btn--sm" data-preset="100,20">Outage 100% × 20 min</button>
            <button class="btn btn--outline btn--sm" data-preset="2,60">2% × 1 h</button>
            <button class="btn btn--outline btn--sm" data-preset="1,300">1% × 5 h</button>
            <button class="btn btn--outline btn--sm" data-preset="0.3,2880">0.3% × 2 days</button>
            <button class="btn btn--sm" id="slo-clear">Clear incidents</button>
          </div>
          <div class="simulator-card__progress-text"><span id="slo-budget-label"></span><span id="slo-budget-pct"></span></div>
          <div class="simulator-card__progress"><div class="simulator-card__progress-fill" id="slo-budget-fill"></div></div>
          <div class="simulator-card__label">Error budget remaining at the end of each day</div>
          <div class="sim-grid-wrap"><div class="sim-bars" id="slo-bars"></div></div>
          <div class="sim-grid-wrap"><table class="sim-grid" id="slo-rules"></table></div>
          <div class="sim-grid-wrap"><table class="sim-grid" id="slo-incidents"></table></div>
          <div class="simulator-card__log" id="slo-log"><div class="simulator-card__log-header">Alert timeline</div></div>
        </div>`;
    },
    mount(root) {
      const lc = this._lc = lifecycle();
      const $ = s => root.querySelector(s);
      // Google SRE workbook, ch. 5 "Alerting on SLOs": budget fraction spent within the long window.
      // threshold = fraction × window / long-window → 14.4, 6 and 1 for a 30-day window.
      const RULES = [
        { sev: 'Page', long: 60, short: 5, frac: 0.02 },
        { sev: 'Page', long: 360, short: 30, frac: 0.05 },
        { sev: 'Ticket', long: 4320, short: 360, frac: 0.10 }
      ];
      let slo = 0.999, days = 30, base = 0, incidents = [{ day: 12, hour: 14, rate: 100, dur: 20 }];

      const dur = m => m < 60 ? `${m} min` : m < 1440 ? `${+(m / 60).toFixed(1)} h` : `${+(m / 1440).toFixed(1)} d`;
      const when = m => `day ${Math.floor(m / 1440) + 1} ${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const num = v => +(+v).toPrecision(4);

      const compute = () => {
        const W = days * 1440, e = 1 - slo;
        const err = new Float64Array(W).fill(base / 100);
        incidents.forEach(inc => {
          const s = (inc.day - 1) * 1440 + inc.hour * 60;
          for (let m = s; m < Math.min(W, s + inc.dur); m++) err[m] = Math.min(1, err[m] + inc.rate / 100);
        });
        const pre = new Float64Array(W + 1);
        for (let m = 0; m < W; m++) pre[m + 1] = pre[m] + err[m];
        // average error rate over the `len` minutes ending at minute m (before minute 0: baseline)
        const avg = (m, len) => {
          const from = m - len + 1, inRange = pre[m + 1] - pre[Math.max(0, from)];
          return (inRange + Math.max(0, -from) * base / 100) / len;
        };
        const rules = RULES.map(r => ({ ...r, thr: r.frac * W / r.long, firing: new Uint8Array(W), minutes: 0, spans: [] }));
        for (const r of rules) {
          let open = -1;
          for (let m = 0; m < W; m++) {
            const on = avg(m, r.long) / e >= r.thr - 1e-9 && avg(m, r.short) / e >= r.thr - 1e-9;
            r.firing[m] = on ? 1 : 0;
            if (on) { r.minutes++; if (open < 0) open = m; }
            else if (open >= 0) { r.spans.push([open, m]); open = -1; }
          }
          if (open >= 0) r.spans.push([open, W]);
        }
        const daily = Array.from({ length: days }, (_, d) => 1 - pre[(d + 1) * 1440] / (e * W));
        return { W, e, err, pre, rules, daily, consumed: pre[W] / (e * W) };
      };

      const draw = () => {
        const { W, e, rules, daily, consumed } = compute();
        const budgetMin = e * W;
        $('#slo-status').textContent = `allowed error rate ${num(e * 100)}% · budget ${num(budgetMin)} min of full outage per ${days} d`;
        const remaining = 1 - consumed;
        $('#slo-budget-label').textContent = `Error budget: ${fmtPct(consumed)} consumed`;
        $('#slo-budget-pct').textContent = `${fmtPct(remaining)} remaining${remaining < 0 ? ' (SLO missed)' : ''}`;
        const fill = $('#slo-budget-fill');
        fill.style.width = fmtPct(Math.max(0, Math.min(1, remaining)));
        fill.style.background = remaining < 0 ? 'var(--error)' : remaining < 0.25 ? 'var(--warning)' : 'var(--success)';

        $('#slo-bars').innerHTML = barsHtml(daily.map((v, d) => ({
          pct: 100 * Math.max(0, v), label: String(d + 1),
          color: v < 0 ? '--error' : v < 0.25 ? '--warning' : '--success',
          title: `end of day ${d + 1}: ${fmtPct(v)} of budget remaining`
        })));

        $('#slo-rules').innerHTML = `<tr><th>Alert</th><th>Long window</th><th>Short window</th><th>Burn threshold</th><th>Budget spent in long window</th><th>Fired</th><th>Time firing</th></tr>` +
          rules.map(r => `<tr><th>${r.sev}</th><td>${dur(r.long)}</td><td>${dur(r.short)}</td><td>${num(r.thr)}×</td><td>${fmtPct(r.frac, 0)}</td>` +
            `<td class="${r.spans.length ? 'is-hit' : ''}">${r.spans.length ? r.spans.length + '×' : 'no'}</td><td>${r.minutes ? dur(r.minutes) : '–'}</td></tr>`).join('');

        $('#slo-incidents').innerHTML = incidents.length ? `<tr><th>Incident</th><th>Burn rate</th><th>Budget used</th>${rules.map(r => `<th>${r.sev} ${num(r.thr)}× detects after</th>`).join('')}<th></th></tr>` +
          incidents.map((inc, i) => {
            const s = (inc.day - 1) * 1440 + inc.hour * 60;
            const burn = inc.rate / 100 / e;
            const used = (inc.rate / 100) * Math.min(inc.dur, Math.max(0, W - s)) / (e * W);
            const det = rules.map(r => {
              if (s >= W) return '<td>outside window</td>';
              if (s > 0 && r.firing[s - 1]) return '<td>already firing</td>';
              const end = Math.min(W, s + inc.dur + r.long);
              for (let m = s; m < end; m++) if (r.firing[m]) return `<td class="is-hit">${dur(m - s + 1)}</td>`;
              return '<td>not detected</td>';
            }).join('');
            return `<tr><th>${esc(when(s))}: ${num(inc.rate)}% × ${dur(inc.dur)}</th><td>${num(burn)}×</td><td>${fmtPct(used)}</td>${det}<td><button class="btn btn--sm" data-del="${i}">Remove</button></td></tr>`;
          }).join('') : '<tr><td>No incidents injected.</td></tr>';

        const box = $('#slo-log');
        while (box.children.length > 1) box.removeChild(box.lastChild);
        const events = [];
        rules.forEach(r => r.spans.forEach(([a, b]) => {
          events.push({ m: a, text: `${r.sev} (${num(r.thr)}× over ${dur(r.long)} & ${dur(r.short)}) starts firing`, kind: 'is-bad' });
          if (b < W) events.push({ m: b, text: `${r.sev} (${num(r.thr)}× over ${dur(r.long)} & ${dur(r.short)}) resolves after ${dur(b - a)}`, kind: 'is-good' });
        }));
        events.sort((x, y) => x.m - y.m);
        if (!events.length) events.push({ m: -1, text: 'No alert fired in this window.', kind: '' });
        events.forEach(ev => {
          const d = document.createElement('div'); d.className = 'sim-log-line ' + ev.kind;
          d.textContent = (ev.m >= 0 ? when(ev.m) + ' · ' : '') + ev.text;
          box.appendChild(d);
        });
      };

      const clampInt = (v, lo, hi, dflt) => { const n = Math.round(+v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
      const addIncident = (rate, durMin) => {
        const day = clampInt($('#slo-day').value, 1, days, 1), hour = clampInt($('#slo-hour').value, 0, 23, 0);
        const r = Math.min(100, Math.max(0.0001, +rate || 0.0001)), d = clampInt(durMin, 1, days * 1440, 1);
        incidents.push({ day, hour, rate: r, dur: d });
        $('#slo-day').value = day; $('#slo-hour').value = hour;
        draw();
      };
      lc.on($('#slo-target'), 'change', e => { slo = +e.target.value; draw(); });
      lc.on($('#slo-window'), 'change', e => {
        days = +e.target.value; $('#slo-day').max = days;
        incidents = incidents.filter(i => i.day <= days); draw();
      });
      lc.on($('#slo-base'), 'change', e => {
        const v = +e.target.value; base = isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
        e.target.value = base; draw();
      });
      lc.on($('#slo-add'), 'click', () => addIncident($('#slo-rate').value, $('#slo-dur').value));
      lc.on(root.querySelector('#sim-slo'), 'click', e => {
        const p = e.target.closest('button[data-preset]');
        if (p) { const [r, d] = p.dataset.preset.split(','); $('#slo-rate').value = r; $('#slo-dur').value = d; addIncident(r, d); return; }
        const del = e.target.closest('button[data-del]');
        if (del) { incidents.splice(+del.dataset.del, 1); draw(); }
      });
      lc.on($('#slo-clear'), 'click', () => { incidents = []; draw(); });
      draw();
    },
    unmount() { this._lc?.dispose(); }
  };
})();
