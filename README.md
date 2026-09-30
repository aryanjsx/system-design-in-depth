# System Design In Depth

A zero-build, client-side system design learning platform for senior and staff backend engineers.

## What's Inside

- **18 Modules, 200 Units** covering distributed systems from fundamentals to FAANG case studies
- **Deep technical content** — B-Trees vs LSM-Trees, Raft consensus, consistent hashing rings, Kafka internals, BM25 scoring, Reed-Solomon erasure coding, and more
- **182 Mermaid architecture diagrams** — CQRS pipelines, Redis Cluster topologies, LSM-tree flush paths, Raft election sequences
- **470 hand-picked videos** — every unit has a topic-specific primary video plus quick-intro, deep-dive, interview and case-study picks (Kleppmann's Cambridge lectures, MIT 6.824, CMU DB, USENIX/Strange Loop/InfoQ talks, company engineering talks, ByteByteGo, Hussein Nasser, Arpit Bhayani, Hello Interview)
- **Intuition-first primers** — every unit opens with a plain-language analogy, the one-line mental model, and common interview traps; most units also include a worked example with real numbers and a trade-off table
- **15 from-scratch builds** — load balancer, consistent hashing, rate limiters, LRU/TTL caches, Bloom filter, Snowflake IDs, keyset pagination, WAL, LSM-tree KV store, leases with fencing, gossip + SWIM, Merkle anti-entropy, HyperLogLog and a tiny search engine; each with a README, a runnable demo and a test suite (`node demo.js`, `node test.js`, zero dependencies)
- **32 interactive simulators on 68 lessons** — consistent hashing, Raft elections, quorums (N/R/W), vector clocks, MVCC isolation anomalies, WAL crash recovery, load-balancing algorithms, cache stampedes, Count-Min Sketch, gossip, adaptive bitrate, SLO burn-rate alerts and more
- **Check yourself** — 3 lesson-specific questions per unit in a one-at-a-time slider with explanations and a score
- **Keyboard-first search** (`⌘K`) across all 200 topics
- **Progress tracking** persisted in localStorage

## Curriculum

### Part 1: Fundamentals (Modules 01–14)
Requirements clarification, APIs & protocols, SQL & data modeling, NoSQL & partitioning, caching, distributed coordination, storage engines, async streams, search & retrieval, analytics sketches, realtime & feeds, geo & matching, media & CDN, reliability & operations.

### Part 2: Real-World Systems (Modules 15–17)
URL shortener, distributed rate limiter, collaborative editing, e-commerce product listing, chat system, payment processing, ride matching, video transcoding pipeline, and more.

### Part 3: Case Studies (Module 18)
Instagram's early architecture, Stripe idempotency keys, Discord's trillion-message migration, Amazon Dynamo paper, GitLab database incident post-mortem.

## Tech Stack

Vanilla HTML/CSS/JavaScript. No build step. No frameworks. Serves directly from any HTTP server.

Visual design follows the Ved Gupta design system shared by vedgupta.in, sso.vedgupta.in and resume.vedgupta.in: Geist Sans / Geist Mono, a monochrome neutral palette (pure-black dark mode, white primary), 6px radii and hairline borders. All tokens live in `css/variables.css`.
