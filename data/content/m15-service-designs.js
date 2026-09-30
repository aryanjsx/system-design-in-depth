window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["design-services"] = {
  "url-shortener-system-design": {
    "title": "Design: a URL shortener, one machine",
    "video": {
      "youtubeId": "iUU4O1sWtJA",
      "title": "Beginner System Design Interview: Design Bitly w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "The clearest end-to-end walkthrough of the classic problem: API, short-code generation, 301 vs 302, and a single database and cache before scaling out.",
      "length": "59:30"
    },
    "videos": [
      {
        "youtubeId": "HHUi8F_qAXM",
        "title": "How Does a URL Shortener Work?",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Quick animated primer on hashing vs counter plus Base62, and on redirects.",
        "length": "6:44"
      }
    ],
    "intuition": "<p>A URL shortener works like a cloakroom. You hand over a bulky coat (the long URL) and get back a small numbered ticket (the short code). Later, anyone holding the ticket gets pointed to the coat. The ticket needs to be <strong>unique</strong> and <strong>short</strong>, and ideally <strong>hard to guess</strong>, so a stranger cannot walk up with ticket 1042 and find out what you checked in.</p><p><strong>Mental model:</strong> the service is a key-value lookup, <code>code</code> to <code>long_url</code>, with far more reads than writes. The design comes down to choosing the code format and deciding how cacheable the redirect should be.</p><ul><li><strong>Trap: sequential codes exposed directly.</strong> Base62 of an auto-increment ID (<code>b7</code>, <code>b8</code>, <code>b9</code>...) lets anyone enumerate every link and estimate your traffic. Scramble the ID with a reversible permutation, or use random codes.</li><li><strong>Trap: 301 when you need analytics.</strong> Browsers cache a 301, so repeat clicks never reach you. Use 302 (or 307) plus <code>Cache-Control: private, max-age=0</code> if each click must be counted.</li><li><strong>Trap: forgetting abuse.</strong> Shorteners are a favourite tool for phishing. Check destinations against safe-browsing lists and rate-limit link creation.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Problem & API Contract</h2>\n      <p>A URL shortening service (like TinyURL or Bitly) converts a long URL into an alias of around 7 characters. When accessed, the short URL issues an HTTP 301 (Permanent) or HTTP 302 (Found) redirect to the original destination URL.</p>\n\n      <h2>URL Encoding Strategies</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    LongURL[\"Original Long URL\"] --> Method{\"Encoding Strategy\"}\n    Method --> Hash[\"MD5 / SHA256 Hash + Truncate\"]\n    Method --> Counter[\"Monotonic Auto-Increment Counter + Base62\"]\n    Hash --> Collision[\"Collision Handling: Probe / Salt\"]\n    Counter --> Safe[\"Zero Collision Guarantee\"]\n      </div>\n\n      <h2>Base62 vs. MD5 Hash Truncation</h2>\n      <ul>\n        <li><strong>MD5 / SHA256 with Truncation:</strong> Hashing the URL yields a 128-bit (MD5) or 256-bit (SHA-256) digest, shown as 32 or 64 hex characters. Taking the first 7 characters introduces hash collision risks (the Birthday Paradox). Handling collisions requires checking the database on every insert and appending a salt if a collision occurs.</li>\n        <li><strong>Monotonic Counter with Base62 (Recommended):</strong> Using characters <code>[0-9, a-z, A-Z]</code> (62 distinct characters), a 7-character string supports 62<sup>7</sup> approx 3.52 trillion unique URLs. An incremental integer ID converted to Base62 guarantees zero collisions without database lookups (it fits in 7 characters while the ID stays below 62<sup>7</sup>; a full 64-bit value needs 11):\n          <pre><code>function toBase62(num) {\n  const chars = \"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\";\n  let str = \"\";\n  while (num > 0n) {\n    str = chars[Number(num % 62n)] + str;\n    num = num / 62n;\n  }\n  return str || \"0\";\n}</code></pre>\n        </li>\n      </ul>\n\n      <h2>HTTP 301 vs. HTTP 302 Redirects</h2>\n      <p><strong>301</strong> communicates a permanent redirect and is commonly cached; <strong>302</strong> communicates a temporary redirect but may also be cached when response headers permit it. Neither status alone guarantees whether every later navigation reaches the origin. Set explicit <code>Cache-Control</code> policy for the product's mutability and analytics needs, and distinguish origin request logs from CDN or edge logs.</p>\n    \n<!-- enriched -->\n<h2>Worked example: does it fit on one machine?</h2><ul><li><strong>Writes:</strong> 1 million new links per day is about 12 per second on average, perhaps 100 per second at peak.</li><li><strong>Reads:</strong> 100 million redirects per day is about 1,160 per second on average, perhaps 5,000 per second at peak.</li><li><strong>Storage:</strong> about 500 bytes per row (code, URL, owner, timestamps) x 365 million rows per year is about 180 GB per year, which a single PostgreSQL instance on NVMe handles easily.</li><li><strong>Hot set:</strong> if 20% of the links created in the last month receive most clicks, that is 6 million rows x 500 B = 3 GB. It fits in the database buffer cache, or in a local LRU cache inside the application.</li></ul><p>Conclusion: one primary database, a read replica for failover and one or two stateless app servers are enough. Scaling out (next unit) becomes necessary at 100x this load.</p><h2>Code generation options</h2><table><thead><tr><th>Approach</th><th>Collisions</th><th>Guessable?</th><th>Coordination</th><th>Notes</th></tr></thead><tbody><tr><td>Base62(auto-increment ID)</td><td>None</td><td>Yes, sequential</td><td>The database sequence</td><td>Short (a 7-character code covers 62^7, about 3.5 trillion)</td></tr><tr><td>Base62(permute(ID))</td><td>None (the permutation is one-to-one)</td><td>Not easily</td><td>The database sequence</td><td>For example a small Feistel network or multiplication by an odd constant modulo 62^7</td></tr><tr><td>Random 7 characters + unique insert</td><td>Rare; retry on conflict</td><td>No</td><td>None beyond a unique index</td><td>With 100 million codes in use, the chance a new code collides is 100M / 3.5T, about 0.003%</td></tr><tr><td>Hash(URL) truncated</td><td>Possible (birthday bound)</td><td>No</td><td>A unique index</td><td>Same URL gives the same code, which you may or may not want. Salt and retry on collision</td></tr></tbody></table><h2>Redirect status codes</h2><table><thead><tr><th>Code</th><th>Meaning</th><th>Browser caching</th><th>Method preserved?</th></tr></thead><tbody><tr><td>301</td><td>Moved permanently</td><td>Cached aggressively unless headers say otherwise</td><td>May change POST to GET</td></tr><tr><td>302</td><td>Found (temporary)</td><td>Only if Cache-Control or Expires allow it</td><td>May change POST to GET</td></tr><tr><td>307 / 308</td><td>Temporary / permanent</td><td>Same as 302 / 301</td><td>Yes</td></tr></tbody></table><p>Bitly returns 301 with short cache lifetimes. Whichever code you choose, set explicit <code>Cache-Control</code> so the behaviour is deliberate rather than dependent on browser defaults.</p>\n</div>",
    "keyTakeaways": [
      "Base62 encoding across 7 characters yields 3.52 trillion unique combinations.",
      "A monotonic counter converted to Base62 completely eliminates collision resolution logic.",
      "Choose redirect status and explicit cache headers together; a 302 does not guarantee that every future click reaches the origin.",
      "Always index the short code column with a unique index for sub-millisecond B-Tree point lookups."
    ],
    "furtherReading": [
      {
        "title": "Base62 Encoding and Short URLs",
        "url": "https://en.wikipedia.org/wiki/Base62"
      },
      {
        "title": "MDN: HTTP 301 vs 302 Redirection",
        "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections"
      }
    ]
  },
  "rate-limiting-and-abuse-prevention-case-study": {
    "title": "Design: rate limiting and abuse prevention",
    "video": {
      "youtubeId": "MIJFyUPG4Z4",
      "title": "Design a Distributed Rate Limiter w/ a Ex-Meta Staff Engineer: System Design Breakdown",
      "channel": "Hello Interview",
      "why": "Full design interview: requirements, algorithm choice, Redis with Lua, sharding the limiter, failure modes and client headers. This matches the case-study format.",
      "length": "55:58"
    },
    "videos": [
      {
        "youtubeId": "FU4WlwfS3G0",
        "title": "System Design Interview - Rate Limiting (local and distributed)",
        "channel": "System Design Interview",
        "role": "deep-dive",
        "why": "Deep dive on implementation details: the token bucket in code, and synchronising limits across hosts.",
        "length": "34:36"
      },
      {
        "youtubeId": "Oxy-6MAiYPw",
        "title": "Inside Stripe's Rate Limiter Architecture",
        "channel": "Arpit Bhayani",
        "role": "case-study",
        "why": "How a real payments company layers rate limiters and load shedders.",
        "length": "16:25"
      }
    ],
    "intuition": "<p>A rate limiter is a bank of turnstiles at a stadium. Each turnstile lets people through at a steady rate, and a small crowd can bunch up at the front and pass quickly (the <strong>burst</strong>), but the long-run flow is capped. In a distributed system there are many turnstiles, one per gateway server, so they need a <strong>shared counter</strong> (Redis). Otherwise a fan could queue at each of 50 gates in turn and get 50 times the allowance.</p><p><strong>Mental model:</strong> <em>token bucket = refill rate r (the average) + bucket size b (the largest burst)</em>. The distributed version keeps each bucket in Redis and updates it atomically in a single round trip.</p><ul><li><strong>Trap: the limiter becomes the outage.</strong> If Redis is down and the limiter fails closed, you have taken down your own API. Default to failing open, with local approximate limits as a backstop.</li><li><strong>Trap: a Redis round trip on every request at very high QPS.</strong> Consider local token leases, where each node takes 100 tokens at a time, trading a little accuracy for far fewer network calls.</li><li><strong>Trap: clients retrying immediately after a 429.</strong> Send <code>Retry-After</code> and document exponential backoff with jitter. Otherwise throttled clients produce a retry storm.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Why Rate Limiting is Critical</h2>\n      <p>Rate limiting protects downstream APIs from denial-of-service (DoS) attacks, brute-force credential stuffing, abusive web scrapers, and cascading microservice failures. When limits are reached, the system responds with <strong>HTTP 429 Too Many Requests</strong> and a <code>Retry-After</code> header.</p>\n\n      <h2>Comparison of Core Algorithms</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Req[\"Incoming API Request\"] --> Alg{\"Algorithm\"}\n    Alg --> TB[\"Token Bucket: Refill rate + Bucket capacity\"]\n    Alg --> LB[\"Leaking Bucket: Constant-rate FIFO queue\"]\n    Alg --> FW[\"Fixed Window: Reset counter every minute\"]\n    Alg --> SW[\"Sliding Window Log: Precise timestamps\"]\n    Alg --> SWC[\"Sliding Window Counter: Memory-efficient interpolation\"]\n      </div>\n\n      <ul>\n        <li><strong>Token Bucket:</strong> Tokens refill at a constant rate r up to capacity b. Allows bursts up to capacity while enforcing average rate. Used by Amazon AWS and Stripe.</li>\n        <li><strong>Fixed Window Counter:</strong> Counters reset at fixed intervals (e.g., top of every minute). Vulnerable to 2x burst traffic across window boundaries (e.g., 100 requests at 00:59 and 100 requests at 01:00).</li>\n        <li><strong>Sliding Window Counter (widely used, e.g., by Cloudflare):</strong> Blends the previous window counter with the current window counter based on timestamp overlap, providing smooth rate limiting with minimal memory footprint (O(1) memory per user).</li>\n      </ul>\n\n      <h2>Distributed Rate Limiting with Redis & Lua</h2>\n      <p>In distributed setups with multiple API gateway instances, local in-memory counters fail because traffic is spread across servers. Redis provides shared state. To prevent race conditions between <code>GET</code> and <code>INCR</code>, atomic Lua scripts are executed directly on the Redis node.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a central limiter</h2><p>The API tier has 60 gateway instances serving 300,000 requests per second at peak. Every request checks one bucket.</p><ul><li>A single Redis shard running a small Lua script sustains roughly 50,000 to 100,000 script calls per second before CPU saturates, since Redis runs commands on one thread.</li><li>300,000 checks per second therefore need about <strong>4 to 6 primary shards</strong> (Redis Cluster, sharded by bucket key), plus replicas.</li><li>Each check adds about 0.3 to 1 ms within one availability zone. For latency-critical paths, a <strong>lease model</strong> cuts Redis calls by about 50x: each gateway takes 50 tokens at a time and spends them locally, at the cost of possibly overshooting the limit by up to 50 tokens per gateway.</li></ul><h2>Architecture options</h2><table><thead><tr><th>Design</th><th>Accuracy</th><th>Latency</th><th>Failure impact</th><th>When to use</th></tr></thead><tbody><tr><td>Local in-memory per instance</td><td>Limit x N instances in the worst case</td><td>Nanoseconds</td><td>None</td><td>Coarse protection, rough fairness, and a backstop</td></tr><tr><td>Central Redis with Lua</td><td>Exact for the algorithm</td><td>+0.3 to 1 ms</td><td>Must decide fail-open or fail-closed</td><td>Per-customer quotas, billing-relevant limits</td></tr><tr><td>Local leases from central</td><td>Overshoot bounded by lease size</td><td>Mostly local</td><td>Leases in hand keep working</td><td>Very high QPS gateways</td></tr><tr><td>Async gossip or sync</td><td>Eventually accurate; overshoot during sync</td><td>Local</td><td>Tolerant</td><td>Multi-region global limits</td></tr></tbody></table><h2>Request path</h2><div class=\"mermaid\">sequenceDiagram\n  participant C as Client\n  participant G as API gateway\n  participant R as Redis shard for the key\n  participant S as Backend service\n  C->>G: GET /v1/orders with API key\n  G->>R: EVALSHA token_bucket key, rate, burst, now\n  R-->>G: allowed, remaining 42\n  G->>S: forward request\n  S-->>G: 200\n  G-->>C: 200 plus RateLimit headers\n  Note over G,R: If rejected, the gateway returns 429 with Retry-After and never calls the backend</div><h2>Client-facing contract</h2><ul><li>Return <strong>429 Too Many Requests</strong> with <code>Retry-After</code> in seconds. Many APIs also send <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code>; the IETF draft standardises <code>RateLimit</code> and <code>RateLimit-Policy</code> headers.</li><li>Use <strong>503 with Retry-After</strong> for load shedding, where the server is overloaded rather than the client being over its quota. The two situations need different client behaviour.</li><li>Publish limits per plan and per endpoint, so customers can design their integrations to stay within them.</li></ul>\n</div>",
    "keyTakeaways": [
      "Token Bucket and Sliding Window Counter are the primary algorithms for modern APIs.",
      "Fixed window counters suffer from boundary double-burst vulnerabilities.",
      "Use atomic Redis Lua scripts to avoid race conditions across multi-instance API gateways.",
      "Always return standard rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After."
    ],
    "furtherReading": [
      {
        "title": "Stripe: Scaling your API with rate limiters",
        "url": "https://stripe.com/blog/rate-limiters"
      },
      {
        "title": "Redis: Rate limiting pattern with Lua",
        "url": "https://redis.io/commands/eval/"
      }
    ]
  },
  "url-shortener-at-scale": {
    "title": "Design: a URL shortener at scale",
    "video": {
      "youtubeId": "xFeWVugaouk",
      "title": "Design a URL Shortener (TinyURL, Bit.ly) | Systems Design Questions 3.0 With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "A dense, scale-focused take: ID generation without coordination, sharding by short code, caching hot links and handling click analytics as a stream.",
      "length": "17:54"
    },
    "videos": [
      {
        "youtubeId": "iUU4O1sWtJA",
        "title": "Beginner System Design Interview: Design Bitly w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "The full interview version, useful for seeing how the single-machine design evolves into the scaled one.",
        "length": "59:30"
      }
    ],
    "intuition": "<p>Scaling a shortener is like scaling a cloakroom to a stadium. You no longer have one attendant with one ticket roll. Each attendant gets their <strong>own pre-numbered roll</strong> (range-based ID allocation), coats are spread across many <strong>rooms by ticket number</strong> (sharding by code), and the most popular coats wait on a <strong>rack by the door</strong> (the cache and CDN).</p><p><strong>Mental model:</strong> at scale the problem splits into three independent parts: <em>generating unique codes without a single bottleneck</em>, <em>serving about 10,000 or more redirects per second mostly from cache</em>, and <em>counting clicks asynchronously</em> so analytics never slow the redirect.</p><ul><li><strong>Trap: using Snowflake IDs directly as codes.</strong> A 64-bit Snowflake ID is 11 Base62 characters, not 7. Use range allocation with a smaller counter, or random codes, if short codes matter.</li><li><strong>Trap: incrementing a click counter in the database on the redirect path.</strong> A viral link then becomes one hot row that serialises every click. Emit an event instead and aggregate it elsewhere.</li><li><strong>Trap: caching only positive results.</strong> Bots hammering random codes that do not exist bypass the cache. Cache \"not found\" briefly, or put a Bloom filter in front of the database.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>High-Scale Architecture: 100M Daily Writes, 1B Daily Reads</h2>\n      <p>Scaling a URL shortener to internet scale requires addressing three distinct bottlenecks: distributed ID generation without coordination, caching hot links to avoid database overload, and partitioning URL records horizontally.</p>\n\n      <h2>Scale Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Global Clients\"] --> CDN[\"Cloudflare CDN Edge Cache\"]\n    CDN -->|Cache Miss| LB[\"Global Anycast Load Balancer\"]\n    LB --> App[\"App Web Tier\"]\n    App --> RedisCluster[(\"Redis Distributed Cache: LRU 80/20 Rule\")]\n    RedisCluster -->|Cache Miss| DBShards[(\"Sharded Database Tier\")]\n    App --> KGS[\"Key Generation Service / Snowflake\"]\n    App --> AnalyticsQueue[\"Kafka Click Event Stream\"]\n    AnalyticsQueue --> AnalyticsWorker[\"ClickHouse Aggregators\"]\n      </div>\n\n      <h2>Distributed ID Generation: Range-Based & Snowflake</h2>\n      <ul>\n        <li><strong>Range Allocation:</strong> A coordination service (e.g., Apache ZooKeeper) allocates distinct numeric ranges (e.g., Node 1 gets IDs 1–1,000,000; Node 2 gets 1,000,001–2,000,000). Nodes generate IDs entirely in local memory with zero inter-server network calls.</li>\n        <li><strong>Twitter Snowflake:</strong> Generates 64-bit IDs containing timestamp (41 bits), datacenter ID (5 bits), worker ID (5 bits), and local sequence number (12 bits). A 64-bit ID encodes to about 11 Base62 characters, so on its own it does not meet a 7-character code goal.</li>\n      </ul>\n\n      <h2>Database Sharding by Short Code Hash</h2>\n      <p>With billions of mappings, storage must be sharded. Partitioning by a hash of the short key distributes read and write traffic evenly across database nodes. Avoid a plain <code>hash(short_key) % N_shards</code>, which remaps most keys when N changes; use consistent hashing or a fixed set of logical shards mapped to nodes.</p>\n\n      <h2>Caching & The 80/20 Pareto Principle</h2>\n      <p>Read traffic heavily follows the Pareto distribution: 20% of short links drive 80% of click traffic. Caching top links in Redis with an LRU (Least Recently Used) eviction policy allows 80%+ of reads to be served in under 2 milliseconds from memory.</p>\n    \n<!-- enriched -->\n<h2>Worked example: 100M writes and 1B reads per day</h2><ul><li><strong>Write rate:</strong> 100 million / 86,400 is about 1,160 per second on average, perhaps 3,000 at peak.</li><li><strong>Read rate:</strong> 1 billion / 86,400 is about 11,600 per second on average, perhaps 40,000 at peak.</li><li><strong>Storage over 5 years:</strong> 100 million x 365 x 5 = about 183 billion links. At about 500 B each that is about 90 TB before replication, so the data must be sharded. For example, 64 shards of about 1.4 TB each.</li><li><strong>Code space:</strong> 183 billion is well under 62^7 (about 3.5 trillion), so 7 characters are enough for many years.</li><li><strong>Cache:</strong> if the hottest 50 million links serve 80% of reads, at about 600 B per entry including overhead that is 30 GB in Redis. Cache-hit reads cost under a millisecond, and the database sees about 20% of 40,000, or 8,000 reads per second across 64 shards, which is trivial per shard.</li></ul><h2>ID generation at scale</h2><table><thead><tr><th>Scheme</th><th>Code length</th><th>Coordination per ID</th><th>Failure behaviour</th></tr></thead><tbody><tr><td>Single database sequence</td><td>7</td><td>Every insert</td><td>Single bottleneck and single point of failure</td></tr><tr><td>Range allocation (a key service hands out blocks of 1 million)</td><td>7</td><td>Once per block</td><td>A crashed node wastes the rest of its block, which is harmless</td></tr><tr><td>Snowflake (41-bit time + 10-bit worker + 12-bit sequence)</td><td>About 11</td><td>None</td><td>Depends on clocks; must refuse to issue IDs if the clock moves backwards</td></tr><tr><td>Random + conditional insert</td><td>7</td><td>A unique-index check on the target shard</td><td>Rare retries</td></tr></tbody></table><h2>Read path with analytics off the critical path</h2><div class=\"mermaid\">flowchart LR\n  U[\"Browser\"] --> E[\"CDN edge, short TTL\"]\n  E -->|\"miss\"| A[\"Redirect service\"]\n  A --> C[(\"Redis hot links\")]\n  C -->|\"miss\"| D[(\"Shard chosen by hash of code\")]\n  A -->|\"click event\"| K[\"Kafka\"]\n  K --> F[\"Stream aggregator\"]\n  F --> W[(\"ClickHouse counts by link, hour and country\")]</div><p>Caching redirects at the CDN makes clicks cheap but hides them from the origin, so the CDN's logs become part of the analytics pipeline. Bitly-style products usually keep the TTL short, or count clicks at the edge. Deleting or disabling a link must purge it from the CDN and from Redis. Otherwise a link taken down for malware keeps redirecting until the cached entries expire.</p>\n</div>",
    "keyTakeaways": [
      "Distribute ID generation using pre-allocated numeric ranges or 64-bit Snowflake algorithms to avoid synchronization bottlenecks.",
      "Partition databases using consistent hashing on the short URL key.",
      "Apply the 80/20 Pareto principle with Redis LRU caching to absorb the vast majority of read traffic.",
      "Stream click tracking data asynchronously through Kafka into columnar storage (ClickHouse) for real-time analytics."
    ],
    "furtherReading": [
      {
        "title": "Twitter Snowflake ID Generator Paper",
        "url": "https://github.com/twitter-archive/snowflake"
      },
      {
        "title": "Facebook Tao: Distributed Data Store for Social Graph",
        "url": "https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson"
      }
    ]
  },
  "ecommerce-product-listing-system-design": {
    "title": "Design: a product listing",
    "video": {
      "youtubeId": "PuZvF2EyfBM",
      "title": "Elasticsearch Deep Dive w/ a Ex-Meta Senior Manager for System Design Interviews",
      "channel": "Hello Interview",
      "why": "Kept: the lesson centres on the search index behind faceted listing, and this is the clearest system-design explanation of how Elasticsearch indexing, sharding and aggregations actually work.",
      "length": "44:03"
    },
    "videos": [
      {
        "youtubeId": "2BWr0fsDSs0",
        "title": "System Design Interview: Architecture of Amazon, Flipkart like e-commerce system with @gkcs",
        "channel": "sudoCODE",
        "role": "interview",
        "why": "Full e-commerce design with Gaurav Sen, showing where the catalog and search service sit alongside inventory, cart and orders.",
        "length": "45:23"
      }
    ],
    "intuition": "<p>A product listing page works like a big supermarket with a great directory. The <strong>stockroom ledger</strong> (the primary database) is the source of truth for what exists and what it costs. The <strong>directory at the entrance</strong> (the search index) is a copy, reorganised so shoppers can ask \"red, size M, under 40, 4 stars or more\" and get the answer immediately, along with how many items match each other filter. When the stockroom changes, a clerk updates the directory shortly afterwards (CDC).</p><p><strong>Mental model:</strong> <em>write to the database, read from the index</em>. The index is a derived, eventually consistent view built for full-text search and counting facets.</p><ul><li><strong>Trap: dual-writing to the DB and the index from the app.</strong> If one write fails, the two drift apart for good. Stream changes from the database log (Debezium, DynamoDB Streams) or use an outbox table.</li><li><strong>Trap: trusting the index for price or stock at checkout.</strong> The index can be seconds behind. Re-check price and availability against the source of truth when adding to the cart and at payment.</li><li><strong>Trap: deep pagination.</strong> <code>from=10000</code> makes every shard gather and sort 10,000 or more hits. Use <code>search_after</code> cursors, and cap how many pages users can reach.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Requirements: Complex Faceting & Extreme Read/Write Asymmetry</h2>\n      <p>An e-commerce product catalog (like Amazon or Shopify) must support sub-100ms multi-attribute filtering (brand, size, color, price range, customer rating), full-text search across titles and descriptions, and instant inventory availability updates.</p>\n\n      <h2>CQRS (Command Query Responsibility Segregation) Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Merchant[\"Merchant Admin / ERP\"] -->|Write: Update Product| WriteService[\"Catalog Management Service\"]\n    WriteService --> PrimaryDB[(\"PostgreSQL / DynamoDB Primary\")]\n    PrimaryDB --> CDC[\"Debezium Change Data Capture\"]\n    CDC --> Kafka[\"Kafka Events\"]\n    Kafka --> IndexWorker[\"Search Index Sync Worker\"]\n    IndexWorker --> SearchIndex[(\"Elasticsearch / OpenSearch Facet Engine\")]\n    Buyer[\"Buyer Search & Browse\"] --> ReadService[\"Product Browse Service\"]\n    ReadService --> SearchIndex\n    ReadService --> Cache[(\"Redis Aggregations Cache\")]\n      </div>\n\n      <h2>When a Dedicated Search Index Helps Faceting</h2>\n      <p>Relational systems can support faceting with normalized attributes, arrays or JSON indexes, generated columns, and engine-specific bitmap or spatial structures. At large catalog scale, combining full-text relevance with many dynamic filters and facet counts may be easier to scale in a dedicated search index. Choose from measured query shapes, update freshness, operational cost, and consistency needs rather than assuming SQL must full-scan or fail.</p>\n\n      <h2>Elasticsearch & Doc Values for Faceting</h2>\n      <p>Search engines like Elasticsearch or OpenSearch index documents in inverted indexes for full-text search and simultaneously build <strong>Doc Values</strong> (columnar disk structures). Columnar storage makes aggregation and facet counting across millions of matching products fast, though high-cardinality facets cost more, and terms-aggregation counts across shards can be approximate (tuned with <code>shard_size</code>).</p>\n\n      <h2>Change Data Capture (CDC) Sync</h2>\n      <p>To avoid dual-write inconsistencies between the transactional database and the search index, production architectures deploy Change Data Capture (via Debezium reading Postgres WAL or DynamoDB Streams) to stream mutations reliably into Kafka.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing the index</h2><ul><li>The catalog has 50 million SKUs at about 4 KB of indexed JSON each (title, description, brand, attributes, price and rating). That is about 200 GB of primary data, or roughly 400 GB with one replica. The on-disk index size varies with mappings, so measure it.</li><li>With shards targeted at 10 to 50 GB, about 8 to 12 primary shards is sensible. Too many small shards waste heap memory and slow down queries that fan out to every shard.</li><li>Merchants and inventory systems send about 3,000 updates per second at peak (price and stock). With <code>refresh_interval</code> at 1 s, changes become searchable within about a second. Bulk-index updates in batches of 1,000 to 5,000 documents instead of sending one request per document.</li><li>Queries peak at 5,000 per second, each with 6 facet aggregations. Scale reads by adding replicas, and cache common category landing pages (the first page of popular categories) for 30 to 60 s.</li></ul><h2>Where should faceting live?</h2><table><thead><tr><th>Option</th><th>Strength</th><th>Weakness</th><th>Good fit</th></tr></thead><tbody><tr><td>Relational DB (Postgres with GIN on JSONB, or generated columns)</td><td>Transactional, one system</td><td>Relevance ranking and many dynamic facet counts get hard beyond a few million rows</td><td>Small and medium catalogs</td></tr><tr><td>Search engine (Elasticsearch / OpenSearch / Solr)</td><td>BM25 relevance, fast aggregations over doc values, typo tolerance</td><td>Second system to run; eventual consistency</td><td>Large catalogs with rich search</td></tr><tr><td>Hosted search (Algolia, Typesense Cloud)</td><td>Low operational load, fast</td><td>Cost per record and per operation; less control</td><td>Teams without search specialists</td></tr><tr><td>Precomputed category pages in a KV store or cache</td><td>Fastest reads</td><td>Combinations of filters explode</td><td>The top N category and sort combinations only</td></tr></tbody></table><h2>Handling fast-changing inventory</h2><p>Stock levels change much more often than titles. Common patterns:</p><ul><li>Index a coarse <strong>stock bucket</strong> (in stock, low, out) instead of the exact count, so most stock changes do not require reindexing.</li><li>Apply exact availability at <strong>display time</strong>, by looking up the 24 SKUs on the page in an inventory cache.</li><li>Rank out-of-stock items lower rather than removing them, so pages do not reshuffle every time stock changes.</li></ul><p>Amazon, Shopify and Zalando have all described this split publicly: a source-of-truth catalog service, change streams, and a search layer tuned for relevance and facets.</p>\n</div>",
    "keyTakeaways": [
      "Use CQRS: separate transactional product management writes from read-heavy faceted browsing.",
      "Relational databases can serve faceting with suitable models and indexes; use Elasticsearch or OpenSearch when measured full-text and distributed aggregation needs justify a separate read model.",
      "Employ Change Data Capture (CDC) via Kafka to keep the search index in sync with transactional databases without dual-write bugs.",
      "Decouple volatile inventory quantities from static product details using lightweight real-time stock services."
    ],
    "furtherReading": [
      {
        "title": "Elasticsearch: Aggregations & Faceted Navigation",
        "url": "https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html"
      },
      {
        "title": "Debezium: Change Data Capture Architecture",
        "url": "https://debezium.io/documentation/reference/stable/architecture.html"
      }
    ]
  },
  "collaborative-editing-system-design": {
    "title": "Design: a collaborative editor",
    "video": {
      "youtubeId": "EX5uZV3Tzss",
      "title": "Real-Time Collaboration Explained - System Design",
      "channel": "Hello Interview",
      "why": "Focused explanation of OT vs CRDT and the server architecture for real-time editing (document sessions, broadcast, persistence), matching the scope of this lesson.",
      "length": "15:36"
    },
    "videos": [
      {
        "youtubeId": "x7drE24geUw",
        "title": "CRDTs: The Hard Parts",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "Martin Kleppmann, co-creator of Automerge, on interleaving anomalies, moves and undo, which is where naive CRDTs break.",
        "length": "1:10:10"
      },
      {
        "youtubeId": "YCjVIDv0zQY",
        "title": "12: Design Google Docs/Real Time Text Editor | Systems Design Interview Questions With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "Interview-style design covering the storage, snapshot and websocket fan-out choices.",
        "length": "47:11"
      }
    ],
    "intuition": "<p>Two people are editing the same paper map with pencils, and each phones the other with changes: \"I added a café at position 5.\" If your friend has just inserted a road at position 2, your \"position 5\" is now wrong. <strong>OT</strong> fixes this by having a coordinator adjust each instruction for the edits that came before it (\"they meant position 6 now\"). <strong>CRDTs</strong> avoid numeric positions altogether and anchor each edit to a unique, permanent ID (\"after the letter with ID A-17\"), so edits can be applied in any order and every copy ends up the same.</p><p><strong>Mental model:</strong> <em>OT transforms operations against each other. CRDTs give every character a stable identity, so concurrent edits commute.</em></p><ul><li><strong>Trap: last-write-wins on the whole document.</strong> Saving whole-document snapshots throws away one user's edits. Collaboration needs operations at character or range level.</li><li><strong>Trap: \"CRDT means no server\".</strong> You still need a server for authentication, persistence, fan-out, presence and compaction. The CRDT only removes the need for a single component that orders every edit.</li><li><strong>Trap: unbounded history.</strong> Tombstones and operation logs grow forever. Take snapshots periodically and garbage-collect the history once every client has seen it.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Concurrency Challenge in Real-Time Documents</h2>\n      <p>When multiple users edit the same document concurrently (like Google Docs, Notion, or Figma), edits arrive out of order due to network latency. Without structured conflict resolution, character offsets shift and documents diverge into corrupted states.</p>\n\n      <h2>The Two Core Paradigms: OT vs. CRDT</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Approach{\"Concurrency Resolution\"}\n    Approach --> OT[\"Operational Transformation: OT\"]\n    Approach --> CRDT[\"Conflict-free Replicated Data Types: CRDT\"]\n    OT --> CentralServer[\"Often uses an authoritative server: Google Docs\"]\n    CRDT --> P2P[\"Peer-to-Peer & Decentralized Capable: Yjs, Automerge\"]\n      </div>\n\n      <h2>Operational Transformation (OT)</h2>\n      <p>OT transforms edit operations (Insert, Delete, Retain) against concurrent operations based on character indices:</p>\n      <ul>\n        <li>If User A inserts character 'x' at position 2, and User B concurrently inserts 'y' at position 0, User A's operation must be transformed to position 3 to account for User B's insertion.</li>\n        <li><strong>Tradeoff:</strong> Many production OT systems use an authoritative server to order operations and simplify recovery, but decentralized OT algorithms also exist. Correct transformation, history, acknowledgements, and reconnect behavior remain complex.</li>\n      </ul>\n\n      <h2>CRDTs (Conflict-free Replicated Data Types)</h2>\n      <p>Modern collaborative systems increasingly adopt CRDTs (e.g., RGA, Yjs, Automerge):</p>\n      <ul>\n        <li>Sequence CRDTs use stable element identities or another mergeable ordering representation; not every CRDT uses fractional positions or stores one identifier per visible character.</li>\n        <li>Under the algorithm's delivery and causality assumptions, replicas can apply concurrent operations in different orders and converge without a central serialization point. Transport, persistence, access control, and garbage collection still need coordination.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: one OT transform</h2><p>The document is <code>abc</code>. At the same moment, Alice inserts <code>x</code> at index 2 (to get <code>abxc</code>) and Bob deletes index 0 (to get <code>bc</code>). The server receives Bob's operation first.</p><ul><li>The server applies Bob's delete: <code>bc</code>.</li><li>Alice's insert at 2 was based on the old document. Bob deleted a character <em>before</em> index 2, so the transform shifts Alice's index down by one, to <code>insert(x, 1)</code>, giving <code>bxc</code>.</li><li>Alice's client receives Bob's delete at 0. Her own insert at 2 is after it, so she applies <code>delete(0)</code> to <code>abxc</code> and also gets <code>bxc</code>. Both sides converge.</li></ul><p>A CRDT reaches the same result differently. Alice's <code>x</code> is recorded as \"after the element with ID <code>b</code>\", so deleting <code>a</code> does not affect where it goes.</p><h2>OT vs CRDT</h2><table><thead><tr><th>Aspect</th><th>OT (Google Docs, CKEditor, ShareDB)</th><th>CRDT (Yjs, Automerge, Loro)</th></tr></thead><tbody><tr><td>Ordering</td><td>Usually a central server orders operations</td><td>No central ordering needed; merges commute</td></tr><tr><td>Offline editing</td><td>Possible but hard after long divergence</td><td>Natural; merge on reconnect</td></tr><tr><td>Metadata overhead</td><td>Small (just the operations)</td><td>IDs per element; modern encodings (Yjs, Automerge 2) compress runs well</td></tr><tr><td>Correctness risk</td><td>Transform functions are notoriously hard to get right</td><td>Interleaving and intent anomalies (Kleppmann)</td></tr><tr><td>Rich text and structure</td><td>Mature in production editors</td><td>Improving (Peritext, Yjs types)</td></tr></tbody></table><p>Figma, often cited as a CRDT example, actually uses a <strong>server-authoritative</strong> model inspired by CRDTs. Each object property is last-writer-wins, and the server decides the order. It is not a peer-to-peer text CRDT.</p><h2>Service architecture and numbers</h2><div class=\"mermaid\">flowchart LR\n  C1[\"Editor client A\"] &lt;-->|\"WebSocket\"| S[\"Doc session server, sticky by doc_id\"]\n  C2[\"Editor client B\"] &lt;-->|\"WebSocket\"| S\n  S --> L[(\"Append-only op log\")]\n  S --> P[(\"Snapshot store, every N ops\")]\n  S --> R[\"Presence and cursors, not persisted\"]</div><ul><li>Route all clients of one document to the same session server (consistent hashing on <code>doc_id</code>). The document state then lives in one process's memory, and ordering is local to that process.</li><li>With 50 concurrent editors each sending about 5 operations per second, the server receives 250 operations per second and must broadcast about 12,500 messages per second. Batch outgoing operations every 30 to 50 ms to cut message counts.</li><li>Snapshot every 500 to 1,000 operations, so opening a document loads the latest snapshot plus a short tail of operations instead of the entire history.</li><li>Throttle cursor and selection updates (for example to 10 per second) and never store them; they are ephemeral.</li></ul>\n</div>",
    "keyTakeaways": [
      "Character offset coordinates are fragile under concurrent editing; they require transformation or fractional identifiers.",
      "Many OT deployments use a centralized coordinator, but centralization is an architectural choice rather than a mathematical requirement of all OT algorithms.",
      "CRDTs assign immutable IDs to every token and converge deterministically in peer-to-peer or server topologies.",
      "Use WebSockets for real-time operation transport and snapshot document states periodically to compact mutation logs."
    ],
    "furtherReading": [
      {
        "title": "Yjs Docs: Introduction",
        "url": "https://docs.yjs.dev/"
      },
      {
        "title": "Figma: How Figma's multiplayer technology works",
        "url": "https://www.figma.com/blog/how-figmas-multiplayer-technology-works/"
      }
    ]
  },
  "object-store-system-design": {
    "title": "Design: an object store (S3)",
    "video": {
      "youtubeId": "zplIwqWBhwg",
      "title": "Amazon S3 (Object Stores) - In Practice | Distributed Systems Deep Dives With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Explains how an S3-like store is built internally: the metadata and data split, chunking, replication vs erasure coding, and consistency. The current video is about using object storage in interviews, not designing one.",
      "length": "17:40"
    },
    "videos": [
      {
        "youtubeId": "sYDJYqvNeXU",
        "title": "AWS re:Invent 2023 - Dive deep on Amazon S3 (STG314)",
        "channel": "AWS Events",
        "role": "deep-dive",
        "why": "S3 engineers describe how durability, request scaling and the fleet of drives work at real scale.",
        "length": "51:25"
      },
      {
        "youtubeId": "i_400CkR0lk",
        "title": "DropBox Magic Pocket - Blob Stores At Scale | Distributed Systems Deep Dives With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "case-study",
        "why": "Walks through Dropbox's exabyte-scale in-house blob store as a concrete second design.",
        "length": "29:52"
      }
    ],
    "intuition": "<p>An object store works like a huge warehouse with a card catalogue. The <strong>catalogue</strong> (metadata service) records, for every item name, its size, checksum, owner and which shelves hold its pieces. The <strong>shelves</strong> (storage nodes) just hold numbered boxes and have no idea what is in them. To survive a shelf collapsing, you either keep three copies of every box (replication), or you split each item into 8 boxes plus 4 \"recovery\" boxes on 12 different shelves, so any 8 of them can rebuild the item (erasure coding).</p><p><strong>Mental model:</strong> <em>a small, strongly consistent metadata system in front of a huge, dumb, append-mostly data system</em>. Durability comes from spreading pieces across independent failure domains.</p><ul><li><strong>Trap: erasure coding everything.</strong> Small objects (a few KB) cost more to erasure-code than they save. Pack small objects into large volumes first (Facebook's Haystack, Dropbox's Magic Pocket), or replicate them.</li><li><strong>Trap: ignoring repair traffic.</strong> Rebuilding one lost chunk under an 8+4 code means reading 8 surviving chunks. Durability depends on how <em>quickly</em> you repair before a second or third failure.</li><li><strong>Trap: treating a bucket listing like a directory.</strong> Keys are flat strings. \"Folders\" are just prefixes, and listing is a range scan on the metadata index.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Object Storage vs. Block & File Systems</h2>\n      <p>Object storage (like Amazon S3, Google Cloud Storage, or MinIO) is designed for large binary objects such as images, videos, and backups. It generally does not support in-place byte mutation, but many services do allow a key to be replaced or deleted; immutable names, retention controls, or versioning are separate policies. Unlike POSIX file systems, object APIs commonly expose key-oriented operations such as <code>GET</code>, <code>PUT</code>, <code>DELETE</code>, and <code>HEAD</code>.</p>\n\n      <h2>Storage Tiering Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"HTTP Client\"] --> Edge[\"API & Load Balancer Tier\"]\n    Edge --> MetaService[\"Metadata Service & KV Store\"]\n    Edge --> StorageNode[\"Storage Engine / Data Nodes\"]\n    StorageNode --> Disk1[(\"Disk 1: Chunk\")]\n    StorageNode --> Disk2[(\"Disk 2: Chunk\")]\n    StorageNode --> Disk3[(\"Disk 3: Erasure Coding Parity\")]\n      </div>\n\n      <h2>Separation of Metadata and Payload Data</h2>\n      <ul>\n        <li><strong>Metadata Tier:</strong> Stores object key, bucket name, size, ETag/checksum, ownership, and mapping to physical disk blocks. Stored in high-speed distributed KV stores (like Spanner, CockroachDB, or Cassandra).</li>\n        <li><strong>Data Storage Tier:</strong> Large object payloads are split into fixed-size chunks (e.g., 64MB or 128MB) and written append-only to storage daemon drives.</li>\n      </ul>\n\n      <h2>Durability via Erasure Coding vs. 3x Replication</h2>\n      <p>Standard 3x replication carries a 200% storage overhead (300GB disk used for 100GB data). Modern object stores implement <strong>Reed-Solomon Erasure Coding</strong> (e.g., 8 + 4 scheme):</p>\n      <ul>\n        <li>Data is split into 8 data chunks, and 4 parity chunks are generated (total 12 chunks).</li>\n        <li>The object can survive the loss of any 4 of its 12 chunks simultaneously (so any 4 drives, nodes or racks only if the 12 chunks are placed in 12 independent failure domains) while imposing only a 50% storage overhead, saving millions of dollars in hardware costs.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: 3x replication vs RS(8,4)</h2><table><thead><tr><th>Scheme</th><th>Raw storage for 10 PB logical</th><th>Failures tolerated</th><th>Read to repair one lost 20 TB drive</th><th>Read latency</th></tr></thead><tbody><tr><td>3x replication</td><td>30 PB</td><td>2 copies lost</td><td>About 20 TB (copy from one replica)</td><td>Read from 1 node</td></tr><tr><td>Reed-Solomon 8+4</td><td>15 PB</td><td>Any 4 of 12 chunks lost</td><td>About 160 TB (8 chunks per lost chunk)</td><td>Read 8 chunks in parallel; slow nodes add tail latency</td></tr><tr><td>Hybrid (replicate recent objects, erasure-code them after N days)</td><td>Between the two</td><td>Both</td><td>Both</td><td>Fast for new objects</td></tr></tbody></table><p>Saving 15 PB of raw disk is worth millions per year, which is why large stores erasure-code warm and cold data. The extra repair traffic is why codes that reduce repair reads, such as Local Reconstruction Codes used in Azure Storage, exist.</p><h2>Write path</h2><div class=\"mermaid\">sequenceDiagram\n  participant C as Client\n  participant F as Front end\n  participant M as Metadata service\n  participant D as Data nodes x12\n  C->>F: PUT bucket/key, 1 GB\n  F->>D: Stream erasure-coded chunks to 12 nodes in separate racks\n  D-->>F: Checksums acknowledged\n  F->>M: Commit key to chunk map, size and ETag\n  M-->>F: Committed, new version is now visible\n  F-->>C: 200 OK with ETag</div><p>The object only becomes visible when the <strong>metadata commit</strong> happens, after the data is durable. That ordering is how S3 provides strong read-after-write consistency, which it has done for all operations since December 2020. A crash before the commit leaves orphaned chunks, which a background garbage collector cleans up.</p><h2>Numbers worth knowing</h2><ul><li>S3 is designed for 99.999999999% (eleven nines) annual durability, and advertises at least 3,500 writes and 5,500 reads per second <em>per prefix</em>, scaling out by adding prefixes.</li><li>Multipart upload: parts of 5 MiB to 5 GiB, at most 10,000 parts, objects up to 5 TiB. Parts upload in parallel and can be retried individually.</li><li>Metadata scale: 100 billion objects at about 300 B of metadata each is about 30 TB. It must be sharded by bucket and key range, which is why listing a prefix is fast but \"find all objects larger than X\" is not supported natively.</li></ul>\n</div>",
    "keyTakeaways": [
      "Decouple metadata management from high-volume binary payload data storage.",
      "Object APIs generally avoid in-place byte mutation, but keys may still be replaced or deleted unless versioning or retention policy prevents it.",
      "Erasure coding reduces storage overhead for a chosen fault tolerance; end-to-end durability also depends on failure-domain placement, checksums, repair speed, and operations.",
      "Multipart uploads allow large files to be uploaded concurrently and resumed seamlessly on network interruptions."
    ],
    "furtherReading": [
      {
        "title": "MinIO High Performance Object Storage Architecture",
        "url": "https://min.io/docs/minio/linux/index.html"
      },
      {
        "title": "Erasure Coding in Ceph and Distributed Storage",
        "url": "https://docs.ceph.com/en/latest/architecture/"
      }
    ]
  },
  "partitioned-log-system-design": {
    "title": "Design: a Kafka-style log",
    "video": {
      "youtubeId": "DU8o-OTeoCc",
      "title": "Kafka System Design Deep Dive w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Covers topics, partitions, keys, consumer groups, replication and retention from the angle of designing with and like Kafka. The current video is about database sharding.",
      "length": "43:31"
    },
    "videos": [
      {
        "youtubeId": "-RDyEFvnTXI",
        "title": "Apache Kafka Fundamentals You Should Know",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Five-minute animated overview of the log abstraction.",
        "length": "4:55"
      },
      {
        "youtubeId": "d89W_GzWnRw",
        "title": "Diving into Kafka Internals with David Jacot",
        "channel": "The Geek Narrator",
        "role": "deep-dive",
        "why": "A Kafka committer explains the replication protocol, ISR, the group coordinator and KRaft internals.",
        "length": "1:10:42"
      }
    ],
    "intuition": "<p>A partitioned log is like a set of numbered notebooks, one per partition, where people may only write on the next blank line and nobody ever erases anything. Every reader keeps a bookmark (the <strong>offset</strong>) and reads forward at their own pace. Two different teams can read the same notebook with separate bookmarks, and anyone can move their bookmark back to reread last Tuesday.</p><p><strong>Mental model:</strong> <em>order is guaranteed only within a partition. The message key decides the partition, and the number of partitions caps how many consumers in one group can work in parallel.</em></p><ul><li><strong>Trap: expecting global ordering.</strong> Events for the same order ID must share a key so they land in the same partition. There is no ordering across partitions.</li><li><strong>Trap: acks=1 for important data.</strong> The leader can acknowledge and then die before followers copy the write. Use <code>acks=all</code> with <code>min.insync.replicas=2</code> and a replication factor of 3.</li><li><strong>Trap: hot keys.</strong> One huge tenant or a celebrity user ID can overload a single partition while the others sit idle. Split hot keys (for example key plus a bucket number) if strict per-key order is not required.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Fundamental Abstraction: The Partitioned Append-Only Log</h2>\n      <p>A distributed log (like Apache Kafka or Apache Pulsar) is an ordered, append-only sequence of immutable records. It serves as the durable event backbone of modern event-driven architectures, decoupling producers from consumers with multi-gigabyte/sec throughput.</p>\n\n      <h2>Partitioning & Consumer Group Architecture</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    P[\"Producers\"] --> T[\"Topic: Orders\"]\n    T --> P0[\"Partition 0: Append-Only Log\"]\n    T --> P1[\"Partition 1: Append-Only Log\"]\n    T --> P2[\"Partition 2: Append-Only Log\"]\n    P0 --> C1[\"Consumer 1: Offset Tracker\"]\n    P1 --> C2[\"Consumer 2: Offset Tracker\"]\n    P2 --> C3[\"Consumer 3: Offset Tracker\"]\n      </div>\n\n      <h2>Why Append-Only Logs Achieve Immense Throughput</h2>\n      <ul>\n        <li><strong>Sequential Disk I/O:</strong> Random I/O is slow on HDDs, and even on SSDs sequential writes are cheaper (less write amplification, better prefetching). Appending to the end of a log segment operates purely on sequential I/O, approaching raw physical disk bandwidth.</li>\n        <li><strong>Zero-Copy Network Transfers:</strong> Traditional servers read data into kernel memory, copy it to application user-space memory, and copy it back to the socket buffer. Kafka leverages the Linux <code>sendfile()</code> system call (Zero-Copy), streaming data directly from OS PageCache into the network socket without CPU copying. This applies to plaintext listeners: with TLS enabled on the broker, data must be encrypted in user space and zero-copy is lost.</li>\n        <li><strong>Batching:</strong> Producers and consumers batch messages together, amortizing network packet overhead and compression costs across thousands of records.</li>\n      </ul>\n\n      <h2>Offset-Based Consumer State</h2>\n      <p>Traditional message queues (RabbitMQ classic and quorum queues, SQS) delete messages as soon as they are acknowledged by a consumer, incurring state overhead per message. In a distributed log, messages are retained for a configurable time window (e.g., 7 days). Consumers simply advance a lightweight 64-bit integer offset, allowing multiple independent consumer groups to read the same data at their own pace or replay historical events.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a cluster</h2><ul><li><strong>Ingest:</strong> 500,000 messages per second x 1 KB = about 500 MB/s. With replication factor 3, the cluster writes 1.5 GB/s to disk and moves about 1 GB/s of replication traffic between brokers.</li><li><strong>Retention:</strong> 7 days x 500 MB/s is about 302 TB of logical data, or about 907 TB raw. With 12 brokers that is about 76 TB each. Tiered storage (KIP-405, generally available in Kafka 3.9) can move older segments to object storage instead.</li><li><strong>Partitions:</strong> if one consumer instance can process about 5 MB/s, you need at least 100 partitions to keep up. Choose 128 or more to leave headroom, because adding partitions later changes which partition each key maps to.</li><li><strong>Consumer lag</strong> is the number to alert on: the latest offset minus the committed offset, per partition. Growing lag means consumers cannot keep up.</li></ul><h2>Log vs queue</h2><table><thead><tr><th>Property</th><th>Kafka / Kinesis / Pulsar (log)</th><th>RabbitMQ / SQS (queue)</th></tr></thead><tbody><tr><td>Consumption</td><td>Offset per consumer group; messages stay after being read</td><td>Message removed after acknowledgement (classic queues)</td></tr><tr><td>Replay</td><td>Yes, within retention</td><td>No, except RabbitMQ Streams</td></tr><tr><td>Ordering</td><td>Per partition</td><td>Per queue (FIFO variants), weaker with competing consumers</td></tr><tr><td>Per-message routing and retries</td><td>Limited; you build retry topics yourself</td><td>Rich: routing keys, dead-letter queues, delays</td></tr><tr><td>Throughput</td><td>Very high with batching</td><td>High, lower per node</td></tr><tr><td>Best for</td><td>Event streams, CDC, analytics fan-out</td><td>Task queues and work distribution</td></tr></tbody></table><h2>Delivery semantics</h2><div class=\"mermaid\">flowchart LR\n  P[\"Producer, idempotent, acks all\"] --> L[\"Leader replica\"]\n  L --> F1[\"Follower 1, in ISR\"]\n  L --> F2[\"Follower 2, in ISR\"]\n  L -->|\"high watermark\"| C[\"Consumer reads committed offsets\"]\n  C --> O[\"Commit offset after processing\"]</div><ul><li><strong>At-least-once</strong> (the default pattern): process the message, then commit the offset. A crash between the two causes reprocessing, so make handlers idempotent.</li><li><strong>At-most-once:</strong> commit before processing. A crash loses the message.</li><li><strong>Exactly-once within Kafka:</strong> idempotent producers plus transactions that atomically write the output and commit the input offsets (Kafka Streams <code>exactly_once_v2</code>). Side effects outside Kafka, such as sending email or charging a card, still need idempotency keys.</li><li><strong>Metadata:</strong> Kafka 4.0 removed ZooKeeper entirely. Clusters now use the built-in KRaft Raft quorum for controller metadata.</li></ul>\n</div>",
    "keyTakeaways": [
      "Append-only logs maximize performance by utilizing purely sequential disk I/O.",
      "Linux Zero-Copy (sendfile system call) streams data from OS page cache directly to network sockets without user-space overhead.",
      "Topics are partitioned to enable horizontal scaling and parallel consumption across consumer groups.",
      "Consumers maintain their own offset state, allowing effortless replaying and multi-consumer independence."
    ],
    "furtherReading": [
      {
        "title": "Jay Kreps: I Heart Logs (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/i-heart-logs/9781491909379/"
      },
      {
        "title": "Kafka Documentation: Design Principles",
        "url": "https://kafka.apache.org/documentation/#design"
      }
    ]
  }
};
