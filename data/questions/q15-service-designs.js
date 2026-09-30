window.QUESTION_BANK = window.QUESTION_BANK || {};

window.QUESTION_BANK["url-shortener-system-design"] = [
  {
    "id": "url-shortener-system-design-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Single-node storage math",
    "section": "Worked example: does it fit on one machine?",
    "prompt": "Your shortener creates 2 million links per day, and each row (code, URL, owner, timestamps) is about 500 bytes. Roughly how much new storage does one year of links need?",
    "options": [
      "About 36 GB per year",
      "About 3.6 TB per year",
      "About 1 TB per year",
      "About 365 GB per year"
    ],
    "answer": 3,
    "explanation": "2 million x 365 is about 730 million rows, and at 500 B each that is about 365 GB, which one PostgreSQL instance on NVMe still handles comfortably. The 3.6 TB answer comes from slipping a factor of ten in the row count.",
    "tags": [
      "url-shortener-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "url-shortener-system-design-c2",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Stopping enumeration",
    "section": "Code generation options",
    "prompt": "Codes are Base62 of an auto-increment ID, and a competitor is walking through b7, b8, b9 to scrape every link and estimate your volume. Which change stops this while keeping 7-character codes and zero collisions?",
    "options": [
      "Hash each URL with MD5 and keep the first 7 characters",
      "Encode a one-to-one permutation of the ID, such as a small Feistel network",
      "Switch to Snowflake IDs so codes include a timestamp and worker ID",
      "Append a random character to each sequential Base62 code"
    ],
    "answer": 1,
    "explanation": "A reversible permutation maps each ID to a unique, non-sequential value in the same space, so there are no collisions and nothing to enumerate. Truncated MD5 hides the sequence but reintroduces birthday collisions; Snowflake IDs need about 11 characters.",
    "tags": [
      "url-shortener-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "url-shortener-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Counting every click",
    "section": "Redirect status codes",
    "prompt": "Marketing complains that repeat clicks by the same user never show up in click analytics. The service returns 301 with no cache headers. What is the most robust fix?",
    "options": [
      "Keep 301 but add a query string with a timestamp to each short link",
      "Switch to 308 so the browser preserves the request method on redirect",
      "Return 302 or 307 with Cache-Control: private, max-age=0 on the redirect",
      "Return 301 and count clicks from the destination site's referrer logs"
    ],
    "answer": 2,
    "explanation": "Browsers cache a 301 aggressively, so repeat clicks never reach the origin; a temporary redirect with explicit no-cache headers makes each click hit you. 308 is also a permanent redirect and is cached like a 301, so it has the same problem.",
    "tags": [
      "url-shortener-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["rate-limiting-and-abuse-prevention-case-study"] = [
  {
    "id": "rate-limiting-and-abuse-prevention-case-study-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Token bucket burst",
    "section": "Comparison of Core Algorithms",
    "prompt": "A client's token bucket refills at 10 tokens per second with capacity 50. After a minute of idling, the client fires 80 requests at once. What happens?",
    "options": [
      "All 80 pass, because the idle minute accrued 600 tokens",
      "10 pass, because the refill rate caps each second to 10",
      "50 pass immediately and the rest are limited to about 10 per second",
      "None pass, because 80 exceeds the bucket capacity of 50"
    ],
    "answer": 2,
    "explanation": "Tokens accumulate only up to capacity b = 50, so a full bucket allows a 50-request burst and further requests are admitted at the refill rate r. The 600-token answer ignores the cap, which is exactly what bounds the burst.",
    "tags": [
      "rate-limiting-and-abuse-prevention-case-study",
      "apply",
      "inline"
    ]
  },
  {
    "id": "rate-limiting-and-abuse-prevention-case-study-c2",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Lease overshoot",
    "section": "Worked example: sizing a central limiter",
    "prompt": "To avoid a Redis call per request, each of 60 gateways leases 50 tokens at a time from the central bucket. A customer's limit is 1,000 requests per second. What is the trade-off?",
    "options": [
      "Redis calls fall about 50x, but the customer can overshoot by up to about 3,000 requests",
      "Redis calls fall about 60x, and accuracy stays exact because leases are atomic",
      "Redis calls fall about 50x, but every lease expiry forces a fail-closed window",
      "Redis calls stay the same, but latency drops because leases are cached in the CDN"
    ],
    "answer": 0,
    "explanation": "Each gateway can spend up to 50 tokens it already holds, so worst-case overshoot is 60 x 50 = 3,000 tokens, in exchange for about 50x fewer round trips. The lease is atomic when taken, but spending it locally is exactly what makes the overall limit approximate.",
    "tags": [
      "rate-limiting-and-abuse-prevention-case-study",
      "staff",
      "inline"
    ]
  },
  {
    "id": "rate-limiting-and-abuse-prevention-case-study-c3",
    "type": "mcq",
    "difficulty": "recall",
    "title": "429 versus 503",
    "section": "Client-facing contract",
    "prompt": "The backend is overloaded and you start shedding requests from clients who are all well within their quotas. What response should they receive?",
    "options": [
      "429 Too Many Requests with Retry-After",
      "503 Service Unavailable with Retry-After",
      "429 Too Many Requests with RateLimit-Remaining set to 0",
      "500 Internal Server Error with a JSON error body"
    ],
    "answer": 1,
    "explanation": "429 tells a client it exceeded its own quota; overload shedding is a server-side condition and should be 503 with Retry-After, because the client should behave differently. Using 429 is tempting but misleads clients into thinking they need to lower their own rate or upgrade their plan.",
    "tags": [
      "rate-limiting-and-abuse-prevention-case-study",
      "recall",
      "inline"
    ]
  }
];

window.QUESTION_BANK["url-shortener-at-scale"] = [
  {
    "id": "url-shortener-at-scale-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Snowflake code length",
    "section": "Distributed ID Generation: Range-Based & Snowflake",
    "prompt": "A team proposes using Snowflake IDs directly as short codes because they need no coordination. Why does this conflict with a 7-character code goal?",
    "options": [
      "Snowflake IDs repeat after 41 bits of time, so codes collide yearly",
      "Snowflake IDs need ZooKeeper to allocate ranges, adding coordination",
      "Snowflake IDs are 64 bits, which is about 11 Base62 characters",
      "Snowflake IDs include letters, which Base62 cannot encode directly"
    ],
    "answer": 2,
    "explanation": "62^7 is about 3.5 trillion, roughly 42 bits, while a 64-bit ID needs about 11 Base62 characters. Needing ZooKeeper describes range allocation, which is actually the scheme that does keep codes at 7 characters.",
    "tags": [
      "url-shortener-at-scale",
      "recall",
      "inline"
    ]
  },
  {
    "id": "url-shortener-at-scale-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Database reads after cache",
    "section": "Worked example: 100M writes and 1B reads per day",
    "prompt": "Redirects peak at 60,000 per second. The CDN and Redis together absorb 90% of them, and the link table is spread across 64 shards. Roughly what read load reaches each shard at peak?",
    "options": [
      "About 94 reads per second",
      "About 940 reads per second",
      "About 6,000 reads per second",
      "About 840 reads per second"
    ],
    "answer": 0,
    "explanation": "10% of 60,000 is 6,000 database reads per second, and 6,000 / 64 is about 94 per shard, which is trivial. The 6,000 figure is the total across all shards, not per shard.",
    "tags": [
      "url-shortener-at-scale",
      "apply",
      "inline"
    ]
  },
  {
    "id": "url-shortener-at-scale-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Takedown still redirects",
    "section": "Read path with analytics off the critical path",
    "prompt": "Trust and safety disables a malware link by flagging it in the database, yet it keeps redirecting users for another hour. What is the root cause and fix?",
    "options": [
      "Replica lag on the shard; route takedown checks to the primary",
      "Cached entries at the CDN and in Redis; purge both when a link is disabled",
      "Kafka click events replaying the old target; drop the analytics topic",
      "Consistent hashing sent reads to the wrong shard; rebalance the ring"
    ],
    "answer": 1,
    "explanation": "Redirects are served from the CDN and Redis without touching the database, so a DB flag is invisible until those entries expire; disabling must actively purge both. Replica lag lasts seconds, not an hour, and the database is not even on the cached path.",
    "tags": [
      "url-shortener-at-scale",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["ecommerce-product-listing-system-design"] = [
  {
    "id": "ecommerce-product-listing-system-design-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Why CDC over dual write",
    "section": "Change Data Capture (CDC) Sync",
    "prompt": "The catalog service currently writes each product change to PostgreSQL and then to Elasticsearch. Why does the lesson prefer streaming changes from the database log instead?",
    "options": [
      "CDC makes the index strongly consistent with the database at all times",
      "CDC removes the need for Kafka between the database and the index",
      "CDC lets the search index accept writes that the database rejected",
      "CDC derives every index update from committed changes, so a failed write cannot leave permanent drift"
    ],
    "answer": 3,
    "explanation": "With app-level dual writes, one side can succeed while the other fails and the two drift forever; CDC reads the committed log, so the index eventually reflects every change. It does not make the index strongly consistent, which is why price and stock are re-checked at checkout.",
    "tags": [
      "ecommerce-product-listing-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "ecommerce-product-listing-system-design-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Choosing shard count",
    "section": "Worked example: sizing the index",
    "prompt": "A catalog grows to 80 million SKUs at about 5 KB of indexed JSON each, and you target primary shards of 10 to 50 GB. Which primary shard count is most sensible?",
    "options": [
      "4 primaries of about 100 GB each",
      "16 primaries of about 25 GB each",
      "400 primaries of about 1 GB each",
      "2 primaries of about 200 GB each"
    ],
    "answer": 1,
    "explanation": "80 million x 5 KB is about 400 GB of primary data, and 16 shards puts each at about 25 GB, inside the target band. 400 tiny shards is tempting for parallelism, but many small shards waste heap and slow queries that fan out to every shard.",
    "tags": [
      "ecommerce-product-listing-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "ecommerce-product-listing-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Stock churn in the index",
    "section": "Handling fast-changing inventory",
    "prompt": "Stock updates at 3,000 per second trigger constant reindexing, and category pages reshuffle as items flip in and out of stock. Which approach does the lesson recommend?",
    "options": [
      "Raise refresh_interval to 30 s so stock changes are applied in larger batches",
      "Remove out-of-stock items from the index immediately so results stay accurate",
      "Index a coarse stock bucket, apply exact availability at display time, and rank out-of-stock items lower",
      "Move faceting into PostgreSQL so stock and product details share one transaction"
    ],
    "answer": 2,
    "explanation": "A coarse bucket means most stock changes do not touch the index, the page's 24 SKUs get exact availability from an inventory cache, and demoting rather than removing keeps pages stable. A longer refresh interval cuts indexing cost but makes stock staler while still reshuffling pages.",
    "tags": [
      "ecommerce-product-listing-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["collaborative-editing-system-design"] = [
  {
    "id": "collaborative-editing-system-design-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Transforming an insert",
    "section": "Worked example: one OT transform",
    "prompt": "The document is abcd. Concurrently, Alice inserts x at index 3 (giving abcxd) and Bob deletes index 1 (giving acd). The server applies Bob's delete first. What must Alice's operation become?",
    "options": [
      "insert(x, 3), giving acdx",
      "insert(x, 0), giving xacd",
      "insert(x, 1), giving axcd",
      "insert(x, 2), giving acxd"
    ],
    "answer": 3,
    "explanation": "Bob removed a character before Alice's position, so her index shifts down by one to 2, producing acxd on the server; Alice applies Bob's delete to abcxd and also reaches acxd. Leaving it at 3 is the untransformed mistake and puts x after d.",
    "tags": [
      "collaborative-editing-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "collaborative-editing-system-design-c2",
    "type": "mcq",
    "difficulty": "recall",
    "title": "What CRDTs do not remove",
    "section": "CRDTs (Conflict-free Replicated Data Types)",
    "prompt": "A team switching from OT to Yjs plans to delete their collaboration servers entirely. Which job still needs server-side coordination?",
    "options": [
      "Choosing a single global order for every character insertion",
      "Authentication, persistence, fan-out and history garbage collection",
      "Transforming concurrent operations against each other's indices",
      "Resolving conflicts by picking the last writer's whole document"
    ],
    "answer": 1,
    "explanation": "A CRDT removes the need for a central component that orders edits, but access control, durable storage, broadcasting and compaction still need infrastructure. Global ordering and index transforms are precisely what the CRDT makes unnecessary.",
    "tags": [
      "collaborative-editing-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "collaborative-editing-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Hot document fan-out",
    "section": "Service architecture and numbers",
    "prompt": "A document has 200 concurrent editors each sending about 5 operations per second, so the session server faces about 200,000 outbound messages per second. What is the best first lever?",
    "options": [
      "Batch outgoing operations every 30 to 50 ms and throttle ephemeral cursor updates",
      "Split the document across several session servers by paragraph range",
      "Persist cursor positions in the op log so clients can fetch them lazily",
      "Remove the session server and let clients broadcast peer to peer"
    ],
    "answer": 0,
    "explanation": "Batching collapses many ops into one message per client per window, and cursors are ephemeral traffic that should be throttled and never stored. Splitting the document across servers breaks the single-process ordering that sticky routing by doc_id exists to provide.",
    "tags": [
      "collaborative-editing-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["object-store-system-design"] = [
  {
    "id": "object-store-system-design-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Failure-domain placement",
    "section": "Durability via Erasure Coding vs. 3x Replication",
    "prompt": "An RS 8+4 object has its 12 chunks placed on only 6 racks, two chunks per rack. How many simultaneous whole-rack failures is it guaranteed to survive?",
    "options": [
      "Four, since the code tolerates any 4 lost chunks",
      "Three, since six racks minus three still hold enough data",
      "Two, since two racks hold four chunks",
      "One, since each rack holds more than one chunk"
    ],
    "answer": 2,
    "explanation": "Losing a rack loses two chunks, so two racks cost four chunks, the most the code can lose; a third rack takes the loss to six. Any 4 failures is only true for racks when each of the 12 chunks sits in its own failure domain.",
    "tags": [
      "object-store-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "object-store-system-design-c2",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Hidden cost of erasure coding",
    "section": "Worked example: 3x replication vs RS(8,4)",
    "prompt": "You move 10 PB of warm data from 3x replication to RS 8+4, saving 15 PB of raw disk. Which cost rises sharply and needs capacity planning?",
    "options": [
      "Metadata size, because each object now maps to 12 chunk locations",
      "Write amplification, because parity doubles the bytes written per object",
      "Durability risk, because erasure coding tolerates fewer failures than replicas",
      "Repair traffic, because rebuilding a lost 20 TB drive reads about 160 TB"
    ],
    "answer": 3,
    "explanation": "Each lost chunk is rebuilt from 8 surviving chunks, so repairing one drive reads about eight times its size, and slow repair lengthens the window for further failures. Parity adds 50% to writes, not double, and RS 8+4 tolerates more lost chunks (4) than 3x replication (2).",
    "tags": [
      "object-store-system-design",
      "staff",
      "inline"
    ]
  },
  {
    "id": "object-store-system-design-c3",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Crash before commit",
    "section": "Write path",
    "prompt": "A front end streams all 12 chunks of a new object version and gets checksums back, then crashes before the metadata commit. What does a reader of that key see?",
    "options": [
      "The previous version, and the new chunks become orphans for GC",
      "The new version, because the chunks are already durable",
      "A partial object assembled from whichever chunks it can find",
      "An error until an operator reconciles the chunks with metadata"
    ],
    "answer": 0,
    "explanation": "An object becomes visible only when the metadata commit maps the key to its chunks, which is how read-after-write consistency is achieved; unreferenced chunks are cleaned up later. Durable chunks alone are not enough, because no metadata points to them.",
    "tags": [
      "object-store-system-design",
      "recall",
      "inline"
    ]
  }
];

window.QUESTION_BANK["partitioned-log-system-design"] = [
  {
    "id": "partitioned-log-system-design-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Replaying for a new team",
    "section": "Offset-Based Consumer State",
    "prompt": "Billing has already consumed the last three days of order events from a Kafka topic with 7-day retention. A new analytics team wants those same three days. What do they do?",
    "options": [
      "Ask billing to re-publish the events to a new topic for analytics",
      "Start a new consumer group and reset its offsets to three days ago",
      "Join billing's consumer group so that the partitions are shared",
      "Restore the events from a backup, because acknowledged messages are gone"
    ],
    "answer": 1,
    "explanation": "Messages stay in the log for the retention period, and each consumer group keeps its own offsets, so a new group can start anywhere inside retention. Joining billing's group would split partitions between the two teams instead of giving each a full copy.",
    "tags": [
      "partitioned-log-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "partitioned-log-system-design-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Partition count sizing",
    "section": "Worked example: sizing a cluster",
    "prompt": "A topic ingests 200,000 messages per second at 2 KB each. One consumer instance can process about 8 MB/s. What partition count should you create?",
    "options": [
      "25 partitions, matching 200 MB/s divided by 8 MB/s",
      "400 partitions, one per 500 messages per second",
      "50 partitions, exactly the minimum needed to keep up",
      "64 or more partitions, leaving headroom above the minimum of 50"
    ],
    "answer": 3,
    "explanation": "Ingest is 400 MB/s, so at least 50 consumers and therefore 50 partitions are needed; choose more because adding partitions later changes the key-to-partition mapping. Exactly 50 has no headroom for growth or slow consumers.",
    "tags": [
      "partitioned-log-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "partitioned-log-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Duplicate charges",
    "section": "Delivery semantics",
    "prompt": "A consumer charges a card, then commits its offset. After a crash between the two steps, the customer is charged twice. The team proposes enabling Kafka exactly_once_v2. Does that fix it?",
    "options": [
      "No; the charge is outside Kafka, so it needs an idempotency key",
      "Yes, because idempotent producers prevent the message being read twice",
      "Yes, because transactions make the charge and the offset commit atomic",
      "No; the fix is committing the offset before charging the card"
    ],
    "answer": 0,
    "explanation": "Kafka's exactly-once covers writes to Kafka and offset commits, not external side effects, so the payment call must carry an idempotency key. Committing first switches to at-most-once, which avoids the duplicate by risking a lost charge.",
    "tags": [
      "partitioned-log-system-design",
      "staff",
      "inline"
    ]
  }
];
