# System Design In Depth

Deep system design curriculum for senior engineers — 18 modules, 200 topics, interactive simulators, from-scratch builds, and 470+ curated video explainers.

---

## Why This Exists

Most system design resources are either too shallow (flashcard-level) or too scattered (dozens of blog posts you'll never finish). This is a single, structured curriculum that goes **deep** — from capacity planning to Raft consensus to LSM-tree compaction — with real code you can run, diagrams you can zoom into, and videos hand-picked from the best lecturers in the field.

No signup. No paywall. Just open it and learn.

## Quick Start

```bash
# serve locally (zero dependencies)
python3 -m http.server 8080
```

Open `http://localhost:8080` — that's it.

---

## What's Inside

**200 deep-dive topics** organized into 18 modules, each with:

- 📝 **Written notes** with architecture diagrams (182 Mermaid diagrams)
- 🎥 **Curated videos** — 470+ picks from Kleppmann, MIT 6.824, CMU DB, ByteByteGo, Hussein Nasser, Strange Loop, and more
- 🧠 **Intuition-first primers** — plain-language analogies, one-line mental models, and interview traps
- 🔊 **Audio narrations** — 200 spoken summaries with speed control (0.75x–2x)
- ✅ **Quizzes** — 3 review questions per topic with explanations

**15 from-scratch builds** (zero dependencies, just Node.js):

Load balancer · Consistent hashing · Rate limiter · LRU/TTL cache · Bloom filter · Snowflake IDs · Keyset pagination · WAL · LSM-tree KV store · Leases with fencing · Gossip + SWIM · Merkle anti-entropy · HyperLogLog · Tiny search engine


**32 interactive simulators** across 68 lessons:

Raft elections · Vector clocks · Quorum (N/R/W) tuning · Consistent hashing rings · WAL crash recovery · MVCC isolation anomalies · Cache stampedes · Load-balancing algorithms · Count-Min Sketch · Gossip protocol · Adaptive bitrate · SLO burn-rate alerts

**Plus:** `⌘K` search, progress tracking with streaks, printable cheat sheets per module, and a 75-term glossary.

---

## Curriculum

### Part 1 — Fundamentals

| # | Module | Topics |
|---|--------|--------|
| 01 | **Foundations** | Requirements, trade-offs, capacity planning, NFRs |
| 02 | **APIs & Protocols** | REST, gRPC, GraphQL, WebSockets, TCP vs UDP |
| 03 | **Data Modeling & SQL** | Schema design, indexing, joins, migrations |
| 04 | **NoSQL & Partitioning** | Document vs KV stores, sharding, consistent hashing |
| 05 | **Caching** | Cache layers, eviction, stampede prevention, Redis |
| 06 | **Distributed Coordination** | Raft, Paxos, leader election, distributed locks |
| 07 | **Storage Engines** | B-Trees, LSM-Trees, WAL, compaction, SSTables |
| 08 | **Async & Streams** | Kafka internals, event sourcing, CQRS |
| 09 | **Search & Retrieval** | Inverted indexes, BM25, posting lists |
| 10 | **Analytics & Sketches** | HyperLogLog, Count-Min, t-digest |
| 11 | **Realtime & Social** | Feeds, fanout, presence, chat, social graphs |
| 12 | **Geo & Matching** | Geohashing, R-trees, ride matching |
| 13 | **Media & CDN** | Adaptive bitrate, transcoding, object storage |
| 14 | **Reliability & Ops** | Circuit breakers, observability, SLOs |

### Part 2 — System Designs

URL shortener · Distributed rate limiter · Collaborative editing · E-commerce listing · Chat system · Payment processing · Ride matching · Video transcoding · Notification system

### Part 3 — Case Studies

Instagram's early architecture · Stripe idempotency keys · Discord's trillion-message migration · Amazon Dynamo paper · GitLab database incident

---

## Tech Stack

Vanilla HTML + CSS + JavaScript. No build step, no frameworks, no `npm install`. Serves from any static HTTP server or CDN.

---

## Author

**[Ved Gupta](https://vedgupta.in)**

---

## License

[MIT](LICENSE) — use it, share it, learn from it.
