window.QUESTION_BANK = window.QUESTION_BANK || {};

window.QUESTION_BANK["ride-matching-system-design"] = [
  {
    "id": "ride-matching-system-design-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Ranking by ETA",
    "section": "Understanding the Ride Matching Problem",
    "prompt": "The geo index returns a driver 300 m away across a river and another 1.2 km away on the same road as the rider. How should the matching service rank them?",
    "options": [
      "By straight-line distance, so the 300 m driver is offered first",
      "By driver rating alone, since both are inside the search radius",
      "By routing-engine ETA with live traffic, which may favour the 1.2 km driver",
      "By geohash prefix length, so the driver in the rider's own cell wins"
    ],
    "answer": 2,
    "explanation": "The index only produces candidates; ranking uses a routing service's ETA because a driver close as the crow flies can be ten minutes away by road. Straight-line distance is the tempting shortcut the lesson warns against.",
    "tags": [
      "ride-matching-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "ride-matching-system-design-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Location write rate",
    "section": "Worked example: location ingestion",
    "prompt": "800,000 drivers are online, each sending a 100-byte ping every 5 seconds. What are the global write rate and payload bandwidth?",
    "options": [
      "About 16,000 writes per second and 1.6 MB/s",
      "About 4 million writes per second and 400 MB/s",
      "About 800,000 writes per second and 80 MB/s",
      "About 160,000 writes per second and 16 MB/s"
    ],
    "answer": 3,
    "explanation": "800,000 / 5 s is 160,000 writes per second, and at 100 B each that is 16 MB/s, spread across city shards with only the latest position kept in memory. The 800,000 option assumes one ping per second rather than one every five.",
    "tags": [
      "ride-matching-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "ride-matching-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Late accept",
    "section": "Driver state machine with locking",
    "prompt": "An offer to a driver times out after 15 s, the driver returns to AVAILABLE, and a new offer for another rider is sent. Then the driver's accept for the first offer arrives. What stops it stealing the driver?",
    "options": [
      "The accept must quote the current offer_id, so the stale one fails its conditional write",
      "The matching service always processes accepts in the order the offers were sent",
      "The driver app hides expired offers, so a late accept cannot be sent at all",
      "A distributed lock on the rider prevents two riders from sharing one driver"
    ],
    "answer": 0,
    "explanation": "Binding the accept to the offer_id recorded by the compare-and-set to OFFERED makes a late accept for an expired offer match zero rows. Relying on the app to hide expired offers is fragile, because network delay means the accept may already be in flight.",
    "tags": [
      "ride-matching-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["video-platform-system-design"] = [
  {
    "id": "video-platform-system-design-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Adaptive bitrate",
    "section": "Designing a Video Streaming Platform",
    "prompt": "A viewer watching a 1080p HLS stream moves into weak coverage and throughput drops sharply. What does adaptive bitrate streaming do?",
    "options": [
      "The server re-transcodes the current segment to a lower resolution on demand",
      "The player picks the next segment from a lower rendition listed in the manifest",
      "The CDN compresses the 1080p segment further before sending it to the device",
      "The player pauses and buffers the full 1080p video before resuming playback"
    ],
    "answer": 1,
    "explanation": "Every rendition is pre-encoded and segmented, and the manifest lists them, so the player simply requests its next few seconds at a lower bitrate. Nothing is transcoded on demand; that work happened once, offline, after upload.",
    "tags": [
      "video-platform-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "video-platform-system-design-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Egress and CDN hit ratio",
    "section": "Worked example: storage and egress",
    "prompt": "A live event has 4 million concurrent viewers at an average of 5 Mbps, and the CDN hit ratio is 95%. How much bandwidth does the origin serve?",
    "options": [
      "About 20 Tbps, the full audience demand",
      "About 100 Gbps, from 5% of 2 Tbps",
      "About 1 Tbps, 5% of 20 Tbps",
      "About 19 Tbps, 95% of 20 Tbps"
    ],
    "answer": 2,
    "explanation": "Total demand is 4,000,000 x 5 Mbps = 20 Tbps, and the 5% of requests that miss the CDN reach the origin, about 1 Tbps. 19 Tbps is what the edges serve, not the origin, which shows why hit ratio is the lever that matters.",
    "tags": [
      "video-platform-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "video-platform-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Segments for live sports",
    "section": "Segment length trade-off",
    "prompt": "A sports streamer using 6-second segments hears that viewers see goals 20 or more seconds after TV viewers and that quality adapts slowly. What change fits, and at what cost?",
    "options": [
      "Switch from H.264 to AV1, cutting bitrate but raising encoding cost",
      "Lengthen segments to 10 s, improving compression but raising start time",
      "Raise the CDN TTL, so segments stay cached longer at the edge",
      "Use 2 s or low-latency partial segments, at the cost of more requests and worse compression"
    ],
    "answer": 3,
    "explanation": "Shorter segments, or LL-HLS/DASH partial segments, cut glass-to-glass latency and let the player switch renditions sooner, but they add requests, manifest entries and CDN complexity. A better codec saves bandwidth but does nothing for latency, which is governed by segment duration.",
    "tags": [
      "video-platform-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["file-sync-system-design"] = [
  {
    "id": "file-sync-system-design-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Offline edit conflict",
    "section": "Designing a File Sync Service (Dropbox/Google Drive)",
    "prompt": "Two laptops edit the same .docx while offline and both come online. What is the standard way a file-sync service handles this?",
    "options": [
      "Keep the version with the later device timestamp and discard the other",
      "Keep both, saving the second arrival as a conflicted copy for the user",
      "Merge the two binary files block by block using their chunk hashes",
      "Reject both uploads until the user picks one on the web interface"
    ],
    "answer": 1,
    "explanation": "The service cannot merge an opaque binary format safely, so it preserves both and lets the user resolve the conflicted copy. Picking the later timestamp silently loses work, and device clocks drift so the later timestamp may not even be the later edit.",
    "tags": [
      "file-sync-system-design",
      "recall",
      "inline"
    ]
  },
  {
    "id": "file-sync-system-design-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Insert near the start",
    "section": "Worked example: editing a 100 MB file",
    "prompt": "A 200 MB file is stored as 4 MB chunks. The user inserts 2 KB near the beginning. Roughly how much is uploaded with fixed-size chunks versus content-defined chunking?",
    "options": [
      "About 4 MB with either approach",
      "About 200 MB with either approach",
      "About 200 MB fixed versus about 4 MB content-defined",
      "About 4 MB fixed versus about 200 MB content-defined"
    ],
    "answer": 2,
    "explanation": "With fixed boundaries the insertion shifts every later chunk, so all 50 hashes change and the whole file is re-sent. A rolling hash re-anchors boundaries to content, so only the chunk containing the insertion changes. Fixed chunks work well only for appends or in-place replacements.",
    "tags": [
      "file-sync-system-design",
      "apply",
      "inline"
    ]
  },
  {
    "id": "file-sync-system-design-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Dedup leaks information",
    "section": "Chunking and sync choices",
    "prompt": "With global cross-user deduplication, an upload of a known leaked document completes instantly with upload skipped. Why is this a problem, and what is the safer design?",
    "options": [
      "It reveals another account already stores that content; deduplicate per user or require proof of possession",
      "It wastes metadata space on duplicate references; compact references nightly",
      "It breaks conflict detection between devices; use server revisions instead",
      "It exposes the chunk size to clients; switch to content-defined chunk sizes"
    ],
    "answer": 0,
    "explanation": "An instant skip is an oracle telling an attacker that someone else has the file, so global dedup trades storage savings for privacy. Per-user or per-team scope, or proof that the client actually holds the bytes, closes the leak. The other options describe unrelated concerns.",
    "tags": [
      "file-sync-system-design",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["observability-slo-case-study"] = [
  {
    "id": "observability-slo-case-study-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Symptoms not causes",
    "section": "Designing Observability and SLOs",
    "prompt": "A team pages on CPU above 80%. Why does the lesson prefer paging on SLO burn rate instead?",
    "options": [
      "CPU metrics are too expensive to scrape at the resolution paging needs",
      "Burn-rate alerts need no metrics backend because they use logs",
      "CPU pages when users are fine and can stay quiet while every request fails fast",
      "CPU alerts cannot be routed through Alertmanager to PagerDuty"
    ],
    "answer": 2,
    "explanation": "Cause-based alerts are both noisy and blind: high CPU with happy users wakes people for nothing, and a fast-failing outage can leave CPU idle. Burn-rate alerts fire on what users experience. The cost and tooling options are simply not true.",
    "tags": [
      "observability-slo-case-study",
      "recall",
      "inline"
    ]
  },
  {
    "id": "observability-slo-case-study-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Budget consumed by a deploy",
    "section": "Worked example: SLOs for a checkout service",
    "prompt": "Checkout handles 3 million requests in 28 days with a 99.9% availability SLO. A bad deploy fails 10% of requests for 30 minutes at about 75 requests per minute. What share of the budget did it burn?",
    "options": [
      "About 0.75% of the budget",
      "About 75% of the budget",
      "About 25% of the budget",
      "About 7.5% of the budget"
    ],
    "answer": 3,
    "explanation": "The budget is 0.1% of 3 million, or 3,000 failed requests. The deploy served 2,250 requests and failed 10% of them, 225, which is 7.5% of the budget. The 75% answer comes from dividing all 2,250 requests, not just the failures, into the budget.",
    "tags": [
      "observability-slo-case-study",
      "apply",
      "inline"
    ]
  },
  {
    "id": "observability-slo-case-study-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Why two windows",
    "section": "Prometheus rules for the fast-burn page",
    "prompt": "A fast-burn page fires only on the 1-hour error ratio exceeding 14.4 x 0.001. After a rollback fixes the problem, the page keeps firing for most of an hour. What does adding the 5-minute condition achieve?",
    "options": [
      "It makes the page fire earlier for slow, gradual budget burns",
      "It lets the alert resolve quickly once recent errors drop, while the long window keeps it meaningful",
      "It replaces the long window, so pages depend only on the latest 5 minutes",
      "It halves the threshold, so smaller incidents also page the on-call"
    ],
    "answer": 1,
    "explanation": "Requiring both windows means the 1-hour ratio proves the burn is significant, and the 5-minute ratio proves it is still happening, so the alert clears soon after mitigation. Slow burns are caught by the separate 6-hour and 30-minute ticket rule, not by the short window.",
    "tags": [
      "observability-slo-case-study",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["zero-downtime-database-migration-case-study"] = [
  {
    "id": "zero-downtime-database-migration-case-study-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Why pause writes",
    "section": "Zero Downtime Database Migrations",
    "prompt": "During a CDC-based move from MySQL to PostgreSQL, why does the cutover briefly pause application writes?",
    "options": [
      "So the final transactions replicate and nothing is written to both databases at once",
      "So the CDC tool can take a fresh full snapshot of the source",
      "So PostgreSQL can rebuild its indexes before accepting traffic",
      "So the application can run its schema migrations on MySQL"
    ],
    "answer": 0,
    "explanation": "With writes stopped, CDC lag can reach exactly zero, the final position is verified, and the connection switches with no writes lost or split between two primaries. A fresh snapshot is not needed at cutover, since CDC has been streaming changes since the initial copy.",
    "tags": [
      "zero-downtime-database-migration-case-study",
      "recall",
      "inline"
    ]
  },
  {
    "id": "zero-downtime-database-migration-case-study-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Snapshot duration",
    "section": "Worked example: 6 TB MySQL to PostgreSQL",
    "prompt": "You must migrate 12 TB with a parallel initial copy running at about 400 MB/s. How long does the snapshot take, and what must you record at its start?",
    "options": [
      "About 3 hours; the row count of every table",
      "About 30 hours; the current wall-clock time",
      "About 8 hours; the binlog position or GTID",
      "About 8 hours; a checksum of each table"
    ],
    "answer": 2,
    "explanation": "12,000,000 MB / 400 MB/s is 30,000 s, a little over 8 hours, and the GTID at snapshot start is where CDC must resume so no change is missed or applied twice. Checksums matter for verification later, but they do not tell CDC where to begin.",
    "tags": [
      "zero-downtime-database-migration-case-study",
      "apply",
      "inline"
    ]
  },
  {
    "id": "zero-downtime-database-migration-case-study-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Rollback after cutover",
    "section": "Cutover sequence",
    "prompt": "Three days after switching writes to PostgreSQL, a serious bug appears and the team wants to return to MySQL without losing those three days of writes. What must already be in place?",
    "options": [
      "A final MySQL dump taken just before the cutover began",
      "Row counts that matched between both databases at cutover",
      "Shadow reads against MySQL for the week after cutover",
      "Reverse CDC from PostgreSQL to MySQL started before writes resumed"
    ],
    "answer": 3,
    "explanation": "Only reverse replication, started before writes were re-enabled, keeps MySQL current with post-cutover changes, so rollback is a connection switch rather than data loss. A pre-cutover dump is tempting but is missing exactly the three days of writes you need.",
    "tags": [
      "zero-downtime-database-migration-case-study",
      "staff",
      "inline"
    ]
  }
];

window.QUESTION_BANK["interview-design-instagram"] = [
  {
    "id": "interview-design-instagram-c1",
    "type": "mcq",
    "difficulty": "recall",
    "title": "Pre-signed uploads",
    "section": "Designing a Photo-Sharing App (Instagram)",
    "prompt": "In the recommended upload design, how do photo bytes get from the phone into object storage?",
    "options": [
      "The app PUTs them directly to S3 using a pre-signed URL from the API",
      "The app sends them over the feed WebSocket in small frames",
      "The app streams them to the post API, which forwards them to S3",
      "The app uploads them to the CDN edge, which writes them back to S3"
    ],
    "answer": 0,
    "explanation": "The API only issues a pre-signed URL and a media_id, so large bytes bypass the application tier and API servers stay small and stateless. Routing bytes through the API works, but it wastes API capacity and is the trap the lesson calls out.",
    "tags": [
      "interview-design-instagram",
      "recall",
      "inline"
    ]
  },
  {
    "id": "interview-design-instagram-c2",
    "type": "mcq",
    "difficulty": "apply",
    "title": "Image read rate",
    "section": "Worked example: back-of-the-envelope numbers",
    "prompt": "300 million daily users each view about 80 images per day, and the CDN absorbs 95% of fetches. Roughly what image request rate reaches the origin?",
    "options": [
      "About 278,000 per second",
      "About 1,400 per second",
      "About 139,000 per second",
      "About 14,000 per second"
    ],
    "answer": 3,
    "explanation": "300 million x 80 is 24 billion fetches per day, about 278,000 per second on average, and 5% of that is roughly 14,000 per second at the origin. 278,000 is the total demand before the CDN takes its share.",
    "tags": [
      "interview-design-instagram",
      "apply",
      "inline"
    ]
  },
  {
    "id": "interview-design-instagram-c3",
    "type": "mcq",
    "difficulty": "staff",
    "title": "Viral like counter",
    "section": "Storage by data type",
    "prompt": "A viral post receives thousands of likes per second and UPDATE posts SET likes = likes + 1 causes lock contention on that row. What is the better design?",
    "options": [
      "Store each like as its own row and maintain the count with sharded or asynchronous counters",
      "Wrap the UPDATE in a serializable transaction so no increments are lost",
      "Move the posts table to a larger primary so the row lock is released faster",
      "Cache the like count in the CDN and recompute it from the database hourly"
    ],
    "answer": 0,
    "explanation": "Likes are write-heavy, so they go in a wide-column store as individual rows, with counts aggregated asynchronously or spread over sharded counters to avoid one hot row. Stronger isolation makes the contention worse, and a bigger primary does not change that every increment serialises on the same row.",
    "tags": [
      "interview-design-instagram",
      "staff",
      "inline"
    ]
  }
];
