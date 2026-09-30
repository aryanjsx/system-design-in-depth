window.QUESTION_BANK = window.QUESTION_BANK || {};

window.QUESTION_BANK["case-instagram-early-architecture"] = [
  {
    "id": "case-instagram-early-architecture-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Routing by photo ID",
    "section": "Case: Instagram's First Architecture",
    "prompt": "Instagram's 64-bit photo IDs embed a 13-bit logical shard number. Given a photo ID, how does the application find the PostgreSQL server that holds the photo?",
    "options": [
      "It hashes the full ID modulo the number of physical servers",
      "It looks the ID up in a per-photo location table in a central database",
      "It extracts the logical shard bits, then consults a small logical-to-physical map",
      "It reads the physical server address directly from the ID's middle bits"
    ],
    "answer": 2,
    "explanation": "The ID yields only the logical shard; a small map from thousands of logical shards to a few physical servers completes routing, and that indirection is what allows shards to move. Assuming the ID encodes the server itself is the trap, since then no shard could ever be relocated.",
    "tags": [
      "case-instagram-early-architecture",
      "recall",
      "inline"
    ]
  },
  {
    "id": "case-instagram-early-architecture-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Sequence bits",
    "section": "Worked example: building and decoding an Instagram ID",
    "prompt": "While generating an ID, a shard's sequence returns 2050. What value goes into the low 10 bits, and what limit does this imply?",
    "options": [
      "2050, and each shard can issue 2,050 IDs per millisecond",
      "2, and each shard can issue 1,024 IDs per millisecond",
      "1026, and each shard can issue 8,192 IDs per millisecond",
      "1024, and each shard can issue one ID per microsecond"
    ],
    "answer": 1,
    "explanation": "10 bits hold values 0 to 1023, so the sequence is taken modulo 1024: 2050 mod 1024 = 2. Within one millisecond a shard therefore has 1,024 distinct IDs. 8,192 is the number of logical shards from the 13 shard bits, not a per-millisecond limit.",
    "tags": [
      "case-instagram-early-architecture",
      "apply",
      "inline"
    ]
  },
  {
    "id": "case-instagram-early-architecture-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Rebalancing a hot server",
    "section": "Why logical shards matter",
    "prompt": "One physical PostgreSQL server hosting 2,000 logical shards is overloaded. How did Instagram's design let them relieve it without touching any existing IDs?",
    "options": [
      "Move some shard schemas to a new server, for example by promoting a replica, then update the map",
      "Change the hash function so new IDs spread across more servers",
      "Split each logical shard in two and rewrite the shard bits of affected IDs",
      "Add a Redis cache in front so reads for the hot shards skip the database"
    ],
    "answer": 0,
    "explanation": "Because there are many more logical shards than servers, whole schemas can be relocated and only the logical-to-physical map changes; no ID is re-hashed or rewritten. Rewriting shard bits is exactly the costly re-keying this design was built to avoid.",
    "tags": [
      "case-instagram-early-architecture",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["case-stripe-idempotency-keys"] = [
  {
    "id": "case-stripe-idempotency-keys-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Replaying an error",
    "section": "Every case the server must handle",
    "prompt": "A charge request with key k-12 finished with a 402 card_declined response. The client retries with the same key and the same parameters. What should the server return?",
    "options": [
      "Re-run the charge, since the first attempt did not succeed",
      "A 409 Conflict, since the key was already used once",
      "A 400 error, since the key is being misused after a failure",
      "The stored 402 response, replayed exactly as before"
    ],
    "answer": 3,
    "explanation": "A finished key with identical parameters replays the stored status and body, even when that result was an error; a new attempt needs a new key. 409 is reserved for a key that is still in progress, which is the tempting mix-up.",
    "tags": [
      "case-stripe-idempotency-keys",
      "apply",
      "inline"
    ]
  },
  {
    "id": "case-stripe-idempotency-keys-c2",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Crash mid-request",
    "section": "Designing the recovery points",
    "prompt": "The server records recovery points started, charge_created and finished. It crashes after committing charge_created but before finishing. What makes the retry with the same key safe?",
    "options": [
      "The retry resumes from charge_created, and the processor call uses a stable idempotent reference",
      "The retry starts over from started, because partial work is rolled back",
      "The retry returns 409 until an operator marks the key as finished",
      "The retry is treated as a new key, since the old one never finished"
    ],
    "answer": 0,
    "explanation": "Each local phase commits atomically with its recovery point, so the retry picks up at charge_created; foreign calls between phases carry a stable reference, so re-executing them cannot double-charge. Starting over from scratch is dangerous, because the external charge may already exist.",
    "tags": [
      "case-stripe-idempotency-keys",
      "staff",
      "inline"
    ]
  },
  {
    "id": "case-stripe-idempotency-keys-c3",
    "type": "mcq",
    "difficulty": "recall",
    "title": "When to create the key",
    "section": "Client-side rules",
    "prompt": "A mobile app retries charge requests on timeout. When should it generate and store the idempotency key?",
    "options": [
      "Fresh for each HTTP attempt, so every retry is uniquely traceable",
      "Once per app session, reused for every charge in that session",
      "Once per intended charge, persisted before the first request is sent",
      "Only after a timeout, so the first attempt needs no key at all"
    ],
    "answer": 2,
    "explanation": "The key names one intended operation, so every retry of that charge must carry it, and persisting it first means an app restart still retries with the same key. A fresh key per attempt is the classic trap: each retry then looks like a new charge.",
    "tags": [
      "case-stripe-idempotency-keys",
      "recall",
      "inline"
    ]
  }
];

window.QUESTION_BANK["case-discord-message-storage"] = [
  {
    "id": "case-discord-message-storage-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Buckets and hot channels",
    "section": "Case: How Discord Stores Trillions of Messages",
    "prompt": "Discord's partition key is (channel_id, bucket) with roughly 10-day buckets. A channel suddenly goes viral. What does bucketing do for its write load?",
    "options": [
      "It spreads the viral channel's writes evenly across every node",
      "It caps writes per bucket, so excess messages overflow to a new bucket",
      "It bounds partition size over time, but the current bucket stays on one replica set",
      "It routes the viral channel to dedicated ScyllaDB shards automatically"
    ],
    "answer": 2,
    "explanation": "Buckets stop a channel's lifetime history becoming one unbounded partition, but every write in the current window still hits the same partition's replicas. Believing buckets spread hot traffic is the trap the lesson names explicitly.",
    "tags": [
      "case-discord-message-storage",
      "recall",
      "inline"
    ]
  },
  {
    "id": "case-discord-message-storage-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Sizing a bucket",
    "section": "Worked example: why buckets bound partitions",
    "prompt": "A channel receives 600 messages per minute of about 1 KB each. Roughly how large is one 10-day bucket, and how large would an unbucketed year be?",
    "options": [
      "About 860 MB per bucket and about 31 GB per year",
      "About 8.6 GB per bucket and about 315 GB per year",
      "About 86 GB per bucket and about 3.1 TB per year",
      "About 8.6 GB per bucket and about 86 GB per year"
    ],
    "answer": 1,
    "explanation": "600 x 1,440 minutes x 10 days is about 8.6 million messages, roughly 8.6 GB per bucket, while a year is about 315 million messages or 315 GB in one partition. The last option mistakes the yearly total for ten buckets instead of about 36.",
    "tags": [
      "case-discord-message-storage",
      "apply",
      "inline"
    ]
  },
  {
    "id": "case-discord-message-storage-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Why route by channel",
    "section": "Request coalescing in the data services",
    "prompt": "Discord's data services coalesce identical in-flight queries. Why must requests be routed to instances by channel ID rather than spread by a round-robin load balancer?",
    "options": [
      "Round-robin cannot keep the long-lived connections the data services need",
      "Channel routing lets each instance cache whole channels in memory indefinitely",
      "Channel routing is required for ScyllaDB's shard-per-core model to work",
      "Identical requests can only merge if they reach the same instance at the same moment"
    ],
    "answer": 3,
    "explanation": "Coalescing merges queries that are simultaneously in flight within one process, so 100,000 requests for channel 42 must converge on one instance to become a handful of database reads. Caching is the tempting answer, but the lesson stresses these services shape traffic and are not a cache.",
    "tags": [
      "case-discord-message-storage",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["case-amazon-dynamo"] = [
  {
    "id": "case-amazon-dynamo-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Permanent failure repair",
    "section": "The paper's problem-technique table, restated",
    "prompt": "A Dynamo replica was down for a long time and has missed many writes. Which technique does the paper use to bring it back in sync in the background?",
    "options": [
      "Hinted handoff from fallback nodes",
      "Anti-entropy using Merkle trees",
      "Vector clock reconciliation on read",
      "Gossip-based membership detection"
    ],
    "answer": 1,
    "explanation": "Merkle trees let replicas compare key ranges cheaply and exchange only the parts that differ, which is how Dynamo recovers from permanent failures. Hinted handoff is the tempting pick, but it covers temporary failures, delivering writes that a fallback node held on the replica's behalf.",
    "tags": [
      "case-amazon-dynamo",
      "recall",
      "inline"
    ]
  },
  {
    "id": "case-amazon-dynamo-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Concurrent or descended",
    "section": "Worked example: vector clocks from the paper",
    "prompt": "A read returns two versions of a cart: A with clock [Sx:3, Sy:1] and B with clock [Sx:2, Sy:1, Sz:1]. What should the client conclude?",
    "options": [
      "A supersedes B, because A has the higher Sx counter",
      "B supersedes A, because B has entries from more nodes",
      "They are concurrent, so the client must merge them",
      "They are identical, because both include Sx and Sy"
    ],
    "answer": 2,
    "explanation": "A version descends from another only if every counter is greater or equal; A is ahead on Sx but has no Sz entry, while B has Sz:1, so neither dominates. Picking the higher Sx counter is last-writer thinking and would silently drop B's changes.",
    "tags": [
      "case-amazon-dynamo",
      "apply",
      "inline"
    ]
  },
  {
    "id": "case-amazon-dynamo-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Quorums under sloppy quorum",
    "section": "Worked example: quorum settings",
    "prompt": "With N = 3, R = 2 and W = 2, a partition cuts off two of a key's preferred replicas, and a write is accepted by fallback nodes. A later read from two preferred replicas misses it. Why is this possible despite R + W exceeding N?",
    "options": [
      "Vector clocks discard the newer version when two replicas disagree",
      "R + W must exceed 2N for the overlap guarantee to hold",
      "Consistent hashing moved the key to a different ring position",
      "The write landed on nodes outside the preference list, so read and write sets need not overlap"
    ],
    "answer": 3,
    "explanation": "Overlap only holds for a fixed replica set; with a sloppy quorum the write can be satisfied by fallback nodes and handed back later, so the read quorum may contain none of them. Vector clocks never discard concurrent versions; they return them for merging.",
    "tags": [
      "case-amazon-dynamo",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["case-gitlab-database-incident"] = [
  {
    "id": "case-gitlab-database-incident-c1",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Effective RPO and RTO",
    "section": "Timeline (from GitLab's postmortem, times UTC)",
    "prompt": "The usable snapshot was taken at about 17:20, the deletion happened at about 23:25, and GitLab.com was back online at about 18:00 the next day. What were the effective RPO and RTO?",
    "options": [
      "RPO about 6 hours and RTO about 18.5 hours",
      "RPO about 18.5 hours and RTO about 6 hours",
      "RPO about 6 hours and RTO about 24.5 hours",
      "RPO near zero and RTO about 18.5 hours"
    ],
    "answer": 0,
    "explanation": "Data loss ran from the 17:20 snapshot to the 23:25 deletion, about 6 hours, and downtime ran from the deletion to about 18:00 the next day, about 18.5 hours. The 24.5-hour figure measures from the snapshot rather than from the incident, which confuses the two objectives.",
    "tags": [
      "case-gitlab-database-incident",
      "apply",
      "inline"
    ]
  },
  {
    "id": "case-gitlab-database-incident-c2",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Why pg_dump failed silently",
    "section": "What each safety net actually did",
    "prompt": "GitLab's automated pg_dump backups had been failing for some time, yet nobody knew. What combination caused this?",
    "options": [
      "The S3 bucket was full, and the cron job had been disabled",
      "A 9.2 pg_dump ran against a 9.6 server, and failure emails were rejected by DMARC",
      "The dumps were encrypted with a lost key, and alerts went to a former employee",
      "Disk snapshots overwrote the dumps, and monitoring only checked replication lag"
    ],
    "answer": 1,
    "explanation": "The job used an incompatible binary, so every run failed, and the failure notifications were bounced, so the failure was invisible; the empty S3 bucket was a consequence, not the cause. This is why the lesson says to monitor backups as rigorously as production.",
    "tags": [
      "case-gitlab-database-incident",
      "recall",
      "inline"
    ]
  },
  {
    "id": "case-gitlab-database-incident-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "The drill that finds everything",
    "section": "Turning it into practice",
    "prompt": "GitLab had five safety nets that failed in five different ways. Which single practice would most likely have exposed all of those weaknesses before the incident?",
    "options": [
      "Adding a sixth backup mechanism in a different cloud provider",
      "Using different terminal prompt colours for production hosts",
      "Scheduled automated restores to a scratch host with sanity queries, paging on failure",
      "Increasing LVM snapshot frequency from daily to every hour"
    ],
    "answer": 2,
    "explanation": "Restore drills test the outcome that matters, so a failing dump, an empty bucket and slow copy speed would all surface, along with real RTO. Another mechanism is the tempting answer, but GitLab's lesson is that untested mechanisms add a feeling of safety, not recoverability.",
    "tags": [
      "case-gitlab-database-incident",
      "staff",
      "inline"
    ]
  }
];
