window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-analytics-sketches"] = {
  "counting-at-scale": {
    "title": "Counting at scale",
    "video": {
      "youtubeId": "RLdh1vQsVIQ",
      "title": "Design the Facebook Like Button | Systems Design Questions 3.0 With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "A focused design of a hot counter: contention on one row, sharded counters, stream aggregation and idempotent batching, exactly this unit.",
      "length": "17:35"
    },
    "videos": [
      {
        "youtubeId": "kBHd7kn_1EU",
        "title": "Peeking into assembly code to understand why count++ is not atomic",
        "channel": "Arpit Bhayani",
        "role": "intro",
        "why": "Shows at the machine level why a naive increment loses updates, the root problem that every scaled counter solves.",
        "length": "14:12"
      },
      {
        "youtubeId": "V1HlNh4IhUo",
        "title": "System Design: Distributed Counter (12 approaches)",
        "channel": "System Design Fight Club",
        "role": "deep-dive",
        "why": "Exhaustive comparison of twelve counter designs, from locked rows to CRDTs and stream aggregation, with their trade-offs.",
        "length": "1:55:44"
      }
    ],
    "intuition": "<p>Imagine a stadium turnstile counter. If every fan had to walk to one clerk who updates a single ledger, the queue would stretch for miles. Instead, each gate keeps its own tally and a runner collects the tallies every few minutes. Scaled counting is exactly that: many local tallies, merged in batches.</p>\n<p><strong>Mental model:</strong> <em>never make every event contend for one row</em>. Absorb events into a durable log, pre-aggregate them in memory or across sharded keys, and apply one combined update per batch, recording which events that update covered so retries do not double count.</p>\n<ul>\n<li><strong>Trap:</strong> <code>UPDATE ... SET count = count + 1</code> per event on a viral item. Row lock contention caps throughput and causes timeouts.</li>\n<li><strong>Trap:</strong> assuming the queue gives exactly-once. Kafka delivers at least once to your code; idempotency must be designed in by committing offsets and aggregates together.</li>\n<li><strong>Trap:</strong> forgetting reads. Sharded counters make writes cheap but reads must sum all shards; cache the sum.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Challenge of Counting at Scale</h2>\n      <p>Counting seems simple: <code>UPDATE table SET count = count + 1 WHERE id = 123</code>. However, in a distributed system with millions of events per second, this synchronous, locked approach creates severe bottlenecks. Database row locks lead to contention, timeouts, and system failure.</p>\n      \n      <h3>Batching and Asynchronous Processing</h3>\n      <p>To scale counting, we must decouple the event generation from the database update. Instead of updating the database immediately, events (like clicks, views, or impressions) are pushed to a high-throughput message queue like Apache Kafka.</p>\n      <p>Consumer services read from this queue, buffer the events in memory for a short window (e.g., 5 seconds), aggregate them (e.g., \"Video A got 500 views\"), and then execute a single batch update to the database. This reduces database write load by orders of magnitude.</p>\n      \n      <h3>Idempotency and Exactly-Once Processing</h3>\n      <p>Distributed queues commonly provide at-least-once delivery, so a worker can crash after incrementing the aggregate but before committing its input position. A retry then increments twice. Make the aggregate update and a durable event/partition receipt atomic, or publish immutable per-partition deltas and replace a partition's prior contribution during reconciliation. A separate cache check followed by an increment has its own crash race unless both actions share one atomic boundary.</p>\n      <p><strong>Concrete tradeoff:</strong> sharding one viral post's counter across 64 keys reduces write contention, but reads must sum 64 values and repairs must know which shards are complete. Keep the accepted events or durable deltas long enough to rebuild a disputed total.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a viral post</h2>\n<p>A post receives 50,000 likes per second at peak. A single relational row under heavy contention might sustain on the order of a few thousand updates per second, far short of what is needed.</p>\n<table><thead><tr><th>Design</th><th>DB writes per second</th><th>Read cost</th><th>Freshness</th></tr></thead><tbody>\n<tr><td>Per-event UPDATE on one row</td><td>50,000, fails</td><td>1 row</td><td>Immediate</td></tr>\n<tr><td>Sharded counter, 64 keys</td><td>About 780 per key</td><td>Sum 64 keys, or cache the sum</td><td>Immediate</td></tr>\n<tr><td>Kafka plus 1 s in-memory aggregation, 32 partitions</td><td>32, one per partition per second</td><td>1 row</td><td>About 1 to 2 s behind</td></tr>\n<tr><td>Redis INCR in front, periodic flush to DB</td><td>Redis handles about 50,000 easily; DB sees one write per flush</td><td>1 key</td><td>Immediate in Redis; DB lags</td></tr>\n</tbody></table>\n<h2>Making the batch idempotent</h2>\n<p>The consumer for partition 7 aggregates events up to offset 1,204,500 into \"post 42: +48,210\". It then runs one transaction that both adds 48,210 to the count and records \"partition 7 processed through offset 1,204,500\". If it crashes before the commit, nothing was applied and the batch is replayed. If it crashes after, the stored offset tells the restarted consumer to skip those events. Kafka transactions or a Flink sink with two-phase commit achieve the same effect.</p>\n<h2>Other options</h2>\n<ul>\n<li><strong>CRDT counters:</strong> a G-counter keeps one slot per replica and merges by taking the per-slot maximum; a PN-counter pairs two G-counters for decrements. Used for multi-region active-active counting, for example Redis Enterprise active-active and Riak.</li>\n<li><strong>Approximate display:</strong> most products show \"1.2M likes\"; exact counts matter only for billing or payouts, which can come from a slower batch job.</li>\n</ul>\n<p><strong>Failure mode to name in interviews:</strong> hot partitions. If all events for one viral key hash to one Kafka partition, that consumer becomes the bottleneck; salt the key with a small random suffix and merge the salted partial counts downstream.</p>\n</div>",
    "keyTakeaways": [
      "Synchronous database increments cause lock contention at scale.",
      "Decouple writes using message queues (Kafka) and background aggregation.",
      "Handling duplicate events is critical for accurate counting."
    ],
    "furtherReading": [
      {
        "title": "Netflix Tech Blog: Netflix's Distributed Counter Abstraction",
        "url": "https://netflixtechblog.com/netflixs-distributed-counter-abstraction-8d0c45eb66b2"
      },
      {
        "title": "Jay Kreps: I Heart Logs (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/i-heart-logs/9781491909379/"
      },
      {
        "title": "Apache Kafka Documentation: Design",
        "url": "https://kafka.apache.org/documentation/#design"
      }
    ]
  },
  "view-counting-at-scale": {
    "title": "View counting at scale",
    "video": {
      "youtubeId": "0V-Ns9vovzE",
      "title": "Twitter Likes Count Design | Youtube Views Count Design | Near Realtime Counter System Design",
      "channel": "Think Software",
      "why": "Directly designs a YouTube-style view counter with near-real-time aggregation and a reconciled batch path.",
      "length": "16:18"
    },
    "videos": [
      {
        "youtubeId": "LGOnP9Udffo",
        "title": "How Facebook & YouTube Handle BILLIONS of Likes & Views!",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "Short animated overview of write buffering, sharded counters and eventual consistency for view and like counts.",
        "length": "8:16"
      }
    ],
    "intuition": "<p>Think of an election night. Early tallies from polling stations are announced quickly so people have a sense of the result, but the certified count comes later, after audits and challenged ballots are resolved. A view counter has the same two tracks: a fast, provisional number and a slower, verified one.</p>\n<p><strong>Mental model:</strong> <em>speed layer for display, batch layer for truth</em>. The real-time path aggregates heartbeats into an approximate count; the batch path deduplicates, removes bots and applies business rules, then overwrites the displayed number.</p>\n<ul>\n<li><strong>Trap:</strong> counting page loads as views. A \"view\" is a business definition (minimum watch time, one per user per window, not a bot), so it needs dedup state.</li>\n<li><strong>Trap:</strong> letting the two paths drift silently. Reconcile and publish the batch result as the authoritative version.</li>\n<li><strong>Trap:</strong> storing a counter per video in one shard key when a video goes viral; spread or pre-aggregate hot keys.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Designing a View Counter (Like YouTube)</h2>\n      <p>YouTube's view counter is one of the most famous examples of scaled counting. It must handle billions of views while preventing fraud and abuse.</p>\n      \n      <h3>The Architecture</h3>\n      <p>When a user watches a video, the client sends a \"heartbeat\" or log event to an API gateway. This event is immediately pushed to a Kafka stream. The architecture splits into two paths:</p>\n      <ol>\n        <li><strong>Real-time Path (Approximate):</strong> Stream processors (like Flink) consume the stream, aggregate counts in memory, and update a fast NoSQL database (like Redis or Cassandra) to provide immediate feedback to creators.</li>\n        <li><strong>Batch Path (Accurate & Audited):</strong> The raw logs are dumped into a data lake (HDFS/S3). MapReduce or Spark jobs run periodically to analyze the logs, remove bot traffic, deduplicate views based on strict business logic, and update the authoritative \"true\" view count in the main database.</li>\n      </ol>\n      \n      <h3>Why do views sometimes freeze?</h3>\n      <p>Famously, YouTube view counts used to stall at \"301+\". The commonly cited explanation is that the fast counter was shown until roughly 300 views, after which public updates paused while slower verification checked that the traffic was not from bots; YouTube never fully documented the internal mechanics. This is historical: in August 2015 YouTube retired the 301+ freeze, and it now counts views it is confident come from real people as they are recorded while continuing to review the rest.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing</h2>\n<table><thead><tr><th>Quantity</th><th>Assumption</th><th>Result</th></tr></thead><tbody>\n<tr><td>Views per day</td><td>1 billion</td><td>about 11,600 per second average</td></tr>\n<tr><td>Peak</td><td>5 times average</td><td>about 58,000 per second</td></tr>\n<tr><td>Heartbeat events</td><td>One every 10 s of watch time, 3 minute average watch</td><td>about 18 events per view, about 1 million events per second at peak</td></tr>\n<tr><td>Raw log volume</td><td>18 billion events x 200 bytes</td><td>about 3.6 TB per day</td></tr>\n<tr><td>Dedup state</td><td>Keys of user and video for a 24 hour window</td><td>up to 1 billion keys; use keyed state in Flink with TTL, or approximate with Bloom filters</td></tr>\n</tbody></table>\n<p>Heartbeats dominate volume, so the first stream stage collapses them into one \"qualified view\" event per user and video once the watch threshold is reached.</p>\n<h2>Speed layer vs batch layer</h2>\n<table><thead><tr><th>Aspect</th><th>Real-time path</th><th>Batch path</th></tr></thead><tbody>\n<tr><td>Latency</td><td>Seconds</td><td>Hours</td></tr>\n<tr><td>Dedup</td><td>Short window, best effort</td><td>Full history, exact</td></tr>\n<tr><td>Fraud filtering</td><td>Simple rules, rate limits</td><td>ML models, cross-signal analysis</td></tr>\n<tr><td>Used for</td><td>Displayed count, creator dashboards</td><td>Monetisation, official counts, corrections</td></tr>\n</tbody></table>\n<h2>Handling corrections</h2>\n<p>When the batch job decides 30,000 views were bots, the displayed count can drop. Products handle this by publishing the batch result as a new version of the count and letting the real-time path add only events newer than the batch watermark: displayed = batch count as of time T plus stream count since T. This is the classic Lambda architecture pattern; a Kappa-style alternative replays the full log through one improved streaming job.</p><h2>Failure modes</h2><ul><li><strong>Hot video:</strong> a premiere sends a large share of all heartbeats for one video ID to one partition. Pre-aggregate at the edge or salt the key, then merge.</li><li><strong>Replay double counting:</strong> if the stream job restarts from an old checkpoint and its sink is not idempotent, the displayed count jumps. Write per-window results keyed by video and window, overwriting rather than incrementing.</li><li><strong>Bot bursts:</strong> view farms produce many short, identical sessions. Rate-limit per device and IP in the fast path and let the batch path apply heavier models before counts become official or monetised.</li></ul><h2>Interview framing</h2><p>State the definition of a view first, then the two paths, then how the displayed number reconciles. Interviewers mainly probe dedup, hot keys and what happens when the paths disagree.</p>\n</div>",
    "keyTakeaways": [
      "Use Lambda Architecture: separate paths for fast/approximate and slow/accurate counting.",
      "Fraud detection must happen offline on raw logs.",
      "Event heartbeats are better than single 'play' events for verifying true engagement."
    ],
    "furtherReading": [
      {
        "title": "Lambda Architecture",
        "url": "https://en.wikipedia.org/wiki/Lambda_architecture"
      },
      {
        "title": "Questioning the Lambda Architecture (Jay Kreps)",
        "url": "https://www.oreilly.com/radar/questioning-the-lambda-architecture/"
      },
      {
        "title": "Martin Kleppmann: Designing Data-Intensive Applications, Ch. 11 Stream Processing (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/ch11.html"
      }
    ]
  },
  "impression-counting-system-design": {
    "title": "Impression counting",
    "video": {
      "youtubeId": "Zcv_899yqhI",
      "title": "Design an Ad Click Aggregator w/ a Ex-Meta Staff Engineer System Design Interview",
      "channel": "Hello Interview",
      "why": "The canonical ad event aggregation walkthrough: durable ingest, Flink windowing, idempotency, reconciliation and OLAP serving, all central to impression counting.",
      "length": "1:02:22"
    },
    "videos": [
      {
        "youtubeId": "6TroztUV3f8",
        "title": "Design an Ad Click Aggregator | Systems Design Questions 3.0 With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A tighter alternative walkthrough focusing on exactly-once aggregation and late data.",
        "length": "17:59"
      }
    ],
    "intuition": "<p>Think of a taxi meter. The fare is money, so every metre must be counted once, never twice, and a lost connection cannot erase the trip. Ad impressions are billed like fares: each one is a small piece of revenue, so the pipeline is built like an accounting system, not like a like-button.</p>\n<p><strong>Mental model:</strong> <em>durable, deduplicated event log first; aggregates second; reconciliation always</em>. Acknowledge an impression only after it is in a replicated log, aggregate by event time with watermarks, and reconcile streaming totals against a batch recomputation before invoicing.</p>\n<ul>\n<li><strong>Trap:</strong> aggregating by arrival time. A mobile impression shown at 14:00 but delivered at 16:00 belongs in the 14:00 bucket.</li>\n<li><strong>Trap:</strong> no impression ID. Without a unique ID per impression, client retries double count and inflate bills.</li>\n<li><strong>Trap:</strong> confusing \"served\" with \"viewable\". Industry standards define viewability separately from ad delivery.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Scaling Ad Impressions</h2>\n      <p>Impression counting is critical for advertising platforms. Advertisers pay per 1,000 impressions (CPM), so accuracy translates directly to revenue. Unlike standard view counting, losing an ad impression means losing money.</p>\n      \n      <h3>The Data Pipeline</h3>\n      <p>When an ad renders, a pixel fires a request. The ingest servers must acknowledge this immediately. They write the event to a highly durable write-ahead log (like Kafka) before returning 200 OK. From there, Stream Processing engines (Spark Streaming, Flink) group events by Ad ID, Campaign ID, and time window.</p>\n      \n      <h3>Handling Late Data</h3>\n      <p>In mobile environments, users go offline. An impression might happen at 2:00 PM, but the device only connects and sends the event at 4:00 PM. The system must support Event Time processing. It maintains \"watermarks\" to decide when a time window can be closed, but allows late-arriving data to update historical tables.</p>\n      \n      <h3>Database Choice</h3>\n      <p>Real-time OLAP (columnar analytical) databases like Druid, Pinot, or ClickHouse are the industry standard for this; they are distinct from time-series databases such as Prometheus, InfluxDB or TimescaleDB, though they handle time-partitioned event data well. They ingest massive streams of data, organize it by time, and support sub-second analytical queries (e.g., \"Show impressions for Campaign X broken down by hour\").</p>\n    \n<!-- enriched -->\n<h2>Worked example: volumes</h2>\n<table><thead><tr><th>Quantity</th><th>Assumption</th><th>Result</th></tr></thead><tbody>\n<tr><td>Impressions per day</td><td>10 billion</td><td>about 116,000 per second average, 300,000 or more at peak</td></tr>\n<tr><td>Raw event size</td><td>About 200 bytes</td><td>about 2 TB per day</td></tr>\n<tr><td>Minute aggregates</td><td>1 million active ads, sparse, only minutes with traffic</td><td>at most 1.44 billion rows per day, typically far fewer</td></tr>\n<tr><td>Revenue at 2 dollars CPM</td><td>10 billion divided by 1,000 x 2</td><td>20 million dollars per day; a 1 percent double count is 200,000 dollars per day of wrongful billing</td></tr>\n</tbody></table>\n<h2>Pipeline</h2>\n<div class=\"mermaid\">\nflowchart LR\n  A[\"Ad SDK fires impression with unique ID\"] --> B[\"Ingest service\"]\n  B --> C[\"Kafka, replicated\"]\n  C --> D[\"Flink: dedup by impression ID, window by event time\"]\n  D --> E[\"OLAP store: Druid, Pinot or ClickHouse\"]\n  C --> F[\"Object storage raw archive\"]\n  F --> G[\"Daily batch recompute\"]\n  G --> H[\"Reconciliation and invoicing\"]\n  E --> H\n</div>\n<h2>Late data policy</h2>\n<table><thead><tr><th>Arrival delay</th><th>Handling</th></tr></thead><tbody>\n<tr><td>Within watermark, for example 5 minutes</td><td>Counted in the live window</td></tr>\n<tr><td>Within allowed lateness, for example 24 hours</td><td>Emitted as a correction to the historical bucket</td></tr>\n<tr><td>Beyond allowed lateness</td><td>Routed to a late-data table; included in batch reconciliation or dropped per contract</td></tr>\n</tbody></table>\n<h2>Definitions matter</h2>\n<p>The Media Rating Council viewability guideline counts a display ad as viewable when at least 50 percent of its pixels are in view for at least one continuous second, and a video ad at 50 percent for two continuous seconds. Systems usually store both \"served\" and \"viewable\" impressions as separate measures, because advertisers may buy on either.</p>\n<p><strong>Dedup at scale:</strong> keep impression IDs in keyed state with a TTL a little longer than the allowed lateness; at hundreds of thousands of events per second over 24 hours that is billions of keys, so state lives in RocksDB-backed Flink state, not heap memory.</p><h2>Interview framing</h2><p>Lead with correctness requirements: at-least-once ingest plus dedup equals effectively-once counting; event-time windows; and a batch reconciliation that is the source for invoices. Then discuss the query side: advertisers want per-campaign, per-hour breakdowns with sub-second latency, which is why pre-aggregated rollups live in an OLAP store rather than being computed from raw events on each dashboard load.</p>\n</div>",
    "keyTakeaways": [
      "Impression counting directly impacts revenue, requiring high durability.",
      "Systems must handle late-arriving events using Event Time logic.",
      "Real-time OLAP databases (Druid, Pinot, ClickHouse) are ideal for querying ad metrics."
    ],
    "furtherReading": [
      {
        "title": "Apache Druid Architecture",
        "url": "https://druid.apache.org/docs/latest/design/"
      },
      {
        "title": "Uber Engineering: Real-Time Exactly-Once Ad Event Processing with Apache Flink, Kafka, and Pinot",
        "url": "https://www.uber.com/blog/real-time-exactly-once-ad-event-processing/"
      }
    ]
  },
  "hyperloglog-cardinality-estimation": {
    "title": "HyperLogLog cardinality estimation",
    "video": {
      "youtubeId": "tOsb-tFoPCg",
      "title": "Hyperloglog and Cardinality Estimation",
      "channel": "Arpit Bhayani",
      "why": "Recent, engineer-focused explanation of registers, leading-zero ranks, harmonic mean and the memory versus error trade-off.",
      "length": "13:22"
    },
    "videos": [
      {
        "youtubeId": "B_PexYrEcEw",
        "title": "HyperLogLog Hit Counter - Computerphile",
        "channel": "Computerphile",
        "role": "intro",
        "why": "Quick coin-flip intuition for why the longest run of leading zeros estimates how many distinct items were seen.",
        "length": "4:20"
      },
      {
        "youtubeId": "2PlrMCiUN_s",
        "title": "The Algorithm with the Best Name - HyperLogLog Explained #SoME1",
        "channel": "Victor Sanches Portella",
        "role": "deep-dive",
        "why": "Mathematically careful explanation of why stochastic averaging and the harmonic mean make the estimate accurate.",
        "length": "11:02"
      }
    ],
    "intuition": "<p>If someone tells you the longest streak of heads they flipped today was 10 in a row, you can guess they flipped about a thousand coins, because a streak of 10 happens roughly once in 2 to the power 10 tries. HyperLogLog hashes each item into random-looking bits and remembers only the longest run of leading zeros, many times over in separate buckets.</p>\n<p><strong>Mental model:</strong> <em>hash, bucket by the first p bits, keep the max leading-zero rank per bucket, combine with a harmonic mean</em>. Memory is fixed (about 12 KB in Redis) no matter whether you saw a thousand or a billion distinct items; error is about 1.04 divided by the square root of the number of buckets.</p>\n<ul>\n<li><strong>Trap:</strong> using HLL where exact counts are required, such as billing or unique-voter checks.</li>\n<li><strong>Trap:</strong> estimating intersections by subtraction. A minus B via inclusion-exclusion of two HLLs has error far larger than either estimate; use Theta sketches for set operations.</li>\n<li><strong>Trap:</strong> mixing sketches built with different precision or hash functions; they cannot be merged.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>HyperLogLog for Unique Counting</h2>\n      <p>Counting the exact number of <em>unique</em> visitors (cardinality) over a month requires storing every single user ID in a Set. At Facebook or Google scale, this demands Terabytes of memory just to track unique counts.</p>\n      \n      <h3>The Magic of HyperLogLog (HLL)</h3>\n      <p>HyperLogLog is a probabilistic data structure that estimates cardinality with extreme memory efficiency. Instead of storing IDs, it hashes the ID and looks at the binary representation of the hash. It tracks the maximum number of leading zeros seen in any hash. If you see a hash with 10 leading zeros, that hints you have processed on the order of 2^10 unique items. A single such observation is a very noisy estimate (one lucky hash can be off by orders of magnitude), so the real algorithm splits hashes across many registers and averages them, as described below.</p>\n      \n      <h3>Memory vs Accuracy Trade-off</h3>\n      <p>Standard HLL uses one well-distributed hash per identity. The first <code>p</code> bits select one of <code>m = 2^p</code> registers; the remaining bits supply a rank based on the first set bit. Each register retains its maximum observed rank, and the estimator combines all registers with bias corrections. More registers use more memory and reduce standard error. Redis's implementation uses about 12 KB in its dense representation and targets roughly 0.81% standard error, but serialized format and sparse behavior are implementation-specific.</p>\n      <p>If you don't need exact accounting (e.g., displaying \"1.2M Unique Views\" on a dashboard), HLL is the perfect tool, replacing Terabytes of RAM with Kilobytes.</p>\n      \n      <pre><code>PFADD unique_visitors_today \"user_123\"\nPFCOUNT unique_visitors_today // Returns estimated count</code></pre>\n    \n<!-- enriched -->\n<h2>Worked example: precision vs memory</h2>\n<table><thead><tr><th>Precision p</th><th>Registers m = 2 to the power p</th><th>Memory at 6 bits per register</th><th>Standard error, 1.04 divided by sqrt m</th><th>1 sigma at 100 million uniques</th></tr></thead><tbody>\n<tr><td>10</td><td>1,024</td><td>768 bytes</td><td>3.25 percent</td><td>plus or minus 3.25 million</td></tr>\n<tr><td>12</td><td>4,096</td><td>3 KB</td><td>1.63 percent</td><td>plus or minus 1.63 million</td></tr>\n<tr><td>14, Redis default</td><td>16,384</td><td>12 KB</td><td>0.81 percent</td><td>plus or minus 812,000</td></tr>\n<tr><td>16</td><td>65,536</td><td>48 KB</td><td>0.41 percent</td><td>plus or minus 406,000</td></tr>\n</tbody></table>\n<p>Compare exact counting: 100 million 8-byte user IDs in a hash set is at least 800 MB, and several GB with typical hash table overhead, per metric per day. HLL at 12 KB is roughly five orders of magnitude smaller.</p>\n<h2>Walking one item through</h2>\n<p>With p = 14, hash \"user_123\" to 64 bits. The first 14 bits, say 00000101101001, select register 361. In the remaining 50 bits, the first 1 appears at position 4, so the rank is 4. If register 361 currently holds 2, it becomes 4; if it holds 6, it stays 6. Re-adding \"user_123\" produces the same hash and changes nothing, which is why HLL naturally ignores duplicates.</p>\n<h2>Practical refinements</h2>\n<ul>\n<li><strong>Small-range correction:</strong> when many registers are still zero, the estimator switches to linear counting, which is far more accurate for small cardinalities.</li>\n<li><strong>HyperLogLog++ (Google, 2013):</strong> 64-bit hashes, empirical bias correction, and a sparse representation for small sets. Redis similarly uses a sparse encoding until the set grows.</li>\n<li><strong>Where it is used:</strong> Redis PFADD and PFCOUNT, BigQuery APPROX_COUNT_DISTINCT and HLL_COUNT functions, Presto and Trino approx_distinct, Druid and Pinot HLL aggregators.</li>\n</ul><h2>Common interview uses</h2><table><thead><tr><th>Question</th><th>Why HLL fits</th></tr></thead><tbody><tr><td>Daily active users per country</td><td>One 12 KB sketch per country per day; merge for weekly or monthly</td></tr><tr><td>Unique visitors per page</td><td>Millions of pages x 12 KB can still be large; use lower precision or sparse encoding for small pages</td></tr><tr><td>Distinct IPs hitting an endpoint, for abuse detection</td><td>Fixed memory per endpoint regardless of attack size</td></tr><tr><td>Distinct search queries per day</td><td>Accurate to about 1 percent without storing queries</td></tr></tbody></table><p>When the interviewer asks for exact counts, switch to a keyed set in a database or a batch COUNT DISTINCT; when they ask for intersections, mention Theta sketches.</p>\n</div>",
    "keyTakeaways": [
      "Exact cardinality counting requires linear memory (O(N)).",
      "HyperLogLog uses a fixed register array whose size is selected from the required error; Redis's dense representation is about 12 KB.",
      "Use HLL when a small error rate (~1%) is acceptable for unique counting."
    ],
    "furtherReading": [
      {
        "title": "Redis HyperLogLog",
        "url": "https://redis.io/docs/data-types/probabilistic/hyperloglogs/"
      },
      {
        "title": "Flajolet, Fusy, Gandouet, Meunier: HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm (AofA 2007)",
        "url": "https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf"
      }
    ]
  },
  "mergeable-sketches-for-analytics": {
    "title": "Mergeable sketches for analytics",
    "video": {
      "youtubeId": "WPwCnswDbOU",
      "title": "A Production Quality Sketching Library for the Analysis of Big Data",
      "channel": "Databricks",
      "why": "Apache DataSketches authors explain why mergeability is the property that makes sketches usable across partitions and time, with HLL, Theta and quantile sketches.",
      "length": "28:43"
    },
    "videos": [
      {
        "youtubeId": "CFVkahVFtaQ",
        "title": "How Theta Sketches Provide Huge Speed Advantages via Approximation",
        "channel": "Imply",
        "role": "intro",
        "why": "Short explanation of how Druid pre-aggregates Theta sketches at ingestion and merges them at query time.",
        "length": "4:33"
      },
      {
        "youtubeId": "WUOYVIL_-vg",
        "title": "KDD 2020: Lecture Style Tutorials: Data Sketching for Real Time Analytics Theory and Practice",
        "channel": "Association for Computing Machinery (ACM)",
        "role": "deep-dive",
        "why": "A full tutorial on sketch theory and practice, including merge semantics and error guarantees.",
        "length": "3:31:42"
      }
    ],
    "intuition": "<p>Imagine ten ticket inspectors counting distinct passengers on different carriages. Adding their counts double counts anyone who changed carriage. But if each inspector keeps a tiny summary card built the same way, you can stack the cards and read off the total distinct count, with no need to collect everyone's ticket. Mergeable sketches are those cards.</p>\n<p><strong>Mental model:</strong> a sketch is mergeable if <em>merge(sketch of A, sketch of B) equals sketch of A union B</em>, with the same error guarantee. That lets you compute per partition or per hour, store the small sketch, and combine any subset later.</p>\n<ul>\n<li><strong>Trap:</strong> adding distinct counts from shards or hours. Distinct counts are not additive; sketches are.</li>\n<li><strong>Trap:</strong> merging incompatible sketches with different precision, width or hash seeds. The result is silently wrong or rejected.</li>\n<li><strong>Trap:</strong> expecting every sketch to support every operation. HLL supports union but not reliable intersection; Theta sketches support both.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Mergeable Sketches in Distributed Systems</h2>\n      <p>The true power of probabilistic data structures (sketches like HyperLogLog or Count-Min Sketch) is that they are <strong>mergeable</strong>. This property is critical for distributed analytics.</p>\n      \n      <h3>The Distributed Aggregation Problem</h3>\n      <p>Suppose you have 10 servers ingesting web traffic. Server A calculates 10,000 unique IPs. Server B calculates 15,000 unique IPs. The total unique IPs across your site is NOT 25,000, because users might have visited both servers. To find the exact total, you must ship all raw IPs to a central server and run a <code>UNION</code>, which is slow and network-heavy.</p>\n      \n      <h3>Merging Sketches</h3>\n      <p>Instead of shipping raw data, each server creates a HyperLogLog sketch (12KB). They send these tiny 12KB sketches to a central coordinator. The mathematical properties of HLL allow the coordinator to merge the sketches together without any raw data. The merged sketch estimates the unique count across all servers with the same error bound as a single sketch of that precision (about 0.81% standard error at 12 KB).</p>\n      \n      <h3>Time Window Rollups</h3>\n      <p>This mergeability also applies to time. You can compute an HLL sketch for every hour. To find the daily unique count, you don't rescan the raw data; you simply merge the 24 hourly sketches. This is how databases like Apache Druid achieve lightning-fast dashboard queries over massive datasets.</p>\n    \n<!-- enriched -->\n<h2>Worked example: hourly to daily uniques</h2>\n<p>A site stores one HLL sketch (12 KB) per hour per country for 200 countries.</p>\n<table><thead><tr><th>Question</th><th>Without sketches</th><th>With mergeable sketches</th></tr></thead><tbody>\n<tr><td>Daily uniques, one country</td><td>Rescan a day of raw events, often terabytes</td><td>Merge 24 sketches: 24 x 12 KB, register-wise max, microseconds</td></tr>\n<tr><td>Weekly uniques, all countries</td><td>Rescan a week</td><td>Merge 168 x 200 = 33,600 sketches, about 400 MB of sketch data</td></tr>\n<tr><td>Storage per day</td><td>Raw user IDs per bucket</td><td>24 x 200 x 12 KB, about 58 MB</td></tr>\n</tbody></table>\n<p>Summing hourly distinct counts instead would count a user who visited in 10 different hours 10 times.</p>\n<h2>How each sketch merges</h2>\n<table><thead><tr><th>Sketch</th><th>Answers</th><th>Merge operation</th><th>Requirements</th></tr></thead><tbody>\n<tr><td>HyperLogLog</td><td>Distinct count</td><td>Register-wise maximum</td><td>Same precision and hash</td></tr>\n<tr><td>Theta sketch</td><td>Distinct count, union, intersection, difference</td><td>Keep smallest hash values under a shared threshold</td><td>Same seed</td></tr>\n<tr><td>Count-Min sketch</td><td>Item frequency</td><td>Element-wise addition of counters</td><td>Same width, depth and hash functions</td></tr>\n<tr><td>KLL or t-digest</td><td>Quantiles</td><td>Combine compactors or centroids, then compress</td><td>Compatible parameters; error guarantees vary by algorithm</td></tr>\n<tr><td>Space-Saving</td><td>Heavy hitters</td><td>Combine counters, keep top k</td><td>Merged error bound is the sum of inputs' bounds</td></tr>\n</tbody></table>\n<h2>Where this shows up</h2>\n<p>Apache Druid and Pinot store HLL or Theta sketches as pre-aggregated columns during ingestion rollup, so dashboards merge sketches instead of scanning rows. BigQuery exposes HLL_COUNT.INIT and HLL_COUNT.MERGE so teams can persist sketches in tables and merge them later. Apache DataSketches, originally from Yahoo, provides the Theta, HLL, KLL and frequent-items sketches used by many of these systems.</p>\n<p><strong>Failure mode:</strong> you cannot subtract with HLL. To answer \"users active this week but not last week\", use Theta sketch set difference, or accept that inclusion-exclusion on HLL estimates can produce errors larger than the answer.</p><h2>Interview framing</h2><p>When a design needs distinct counts, frequencies or percentiles across shards and time ranges, say: each node builds a sketch per time bucket, sketches are stored as small blobs or columns, and queries merge the relevant buckets. Then name the compatibility rule (same parameters and hashing) and the operation limits of the chosen sketch.</p>\n</div>",
    "keyTakeaways": [
      "Sketches allow you to compress data locally before aggregating globally.",
      "HLL union avoids double-counting the same hashed identity, but additive sketches and repeated partition contributions still need receipt or deduplication protocols.",
      "Time-based rollups of sketches dramatically speed up analytical queries."
    ],
    "furtherReading": [
      {
        "title": "Apache DataSketches: The Challenge: Fast, Approximate Analysis of Big Data",
        "url": "https://datasketches.apache.org/docs/Background/TheChallenge.html"
      },
      {
        "title": "Agarwal, Cormode, Huang, Phillips, Wei, Yi: Mergeable Summaries (PODS 2012)",
        "url": "https://users.cs.utah.edu/~jeffp/papers/merge-summ.pdf"
      }
    ]
  },
  "bucketed-time-window-aggregation": {
    "title": "Bucketed time-window aggregation",
    "video": {
      "youtubeId": "sdhwpUAjqaI",
      "title": "Event Time and Watermarks | Apache Flink 101",
      "channel": "Confluent, an IBM Company",
      "why": "Clear, focused lesson on event-time windows, watermarks and late events, the part of this unit where most designs go wrong.",
      "length": "11:58"
    },
    "videos": [
      {
        "youtubeId": "7eO1toucB74",
        "title": "Kafka Streams 101: Windowing (2023)",
        "channel": "Confluent, an IBM Company",
        "role": "intro",
        "why": "Concise tour of tumbling, hopping, sliding and session windows with diagrams.",
        "length": "8:23"
      },
      {
        "youtubeId": "YO95iAkwapQ",
        "title": "Foundations of Streaming SQL or: How I learned to love stream & table theory [Strata NYC 2017]",
        "channel": "Tyler Akidau",
        "role": "deep-dive",
        "why": "The Dataflow/Beam author on windowing, triggers, watermarks and how windowed aggregates evolve as tables.",
        "length": "46:25"
      }
    ],
    "intuition": "<p>Think of a parking garage that reports cars per hour. Each hour gets its own tally sheet. At 10:00 you start a fresh sheet; the 09:00 sheet is filed. But a ticket stamped 09:58 might reach the office at 10:03, so you keep the 09:00 sheet open a little longer before declaring it final. Windowed aggregation is tally sheets plus a rule for when a sheet is closed.</p>\n<p><strong>Mental model:</strong> <em>bucket = key plus time range; watermark = the system's belief that no older events are still coming</em>. Tumbling windows give each event one bucket; sliding and hopping windows let one event contribute to several.</p>\n<ul>\n<li><strong>Trap:</strong> bucketing by processing time when the question is about event time. Replays and backlogs then land in the wrong bucket.</li>\n<li><strong>Trap:</strong> closing windows too early. Late events are silently dropped unless you define allowed lateness or a correction path.</li>\n<li><strong>Trap:</strong> forgetting time zones. A \"daily\" bucket in UTC is not a daily bucket for a customer in Tokyo.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Time-Window Aggregation</h2>\n      <p>In streaming analytics, we rarely care about all data since the beginning of time. We want metrics over specific intervals: \"views per minute,\" \"errors per hour.\"</p>\n      \n      <h3>Tumbling vs Sliding Windows</h3>\n      <ul>\n        <li><strong>Tumbling Windows:</strong> Fixed, non-overlapping intervals (e.g., 1:00-1:05, 1:05-1:10). An event belongs to exactly one window.</li>\n        <li><strong>Sliding Windows:</strong> Overlapping intervals (e.g., last 5 minutes, updated every 1 minute). An event can belong to multiple windows.</li>\n      </ul>\n      \n      <h3>Implementation with Redis</h3>\n      <p>A common pattern for a 1-minute tumbling window is to use a timestamp rounded down to the minute as the cache key: <code>INCR api_errors:2026-09-19T17:10</code>. This is highly efficient and requires no complex stream processing. You set an expiry (TTL) on the key to automatically clean up old data.</p>\n      \n      <h3>Stream Processors</h3>\n      <p>For event-time windows, crossing the wall-clock boundary does not prove all events have arrived. Suppose a 10:00–10:05 bucket first publishes 90 views, then a mobile event with occurrence time 10:04 arrives at 10:08. A watermark and allowed-lateness policy decide whether to update the bucket to 91, emit a retraction/correction, or route the event to a late-data path. Retaining state longer improves completeness but consumes more memory and delays finality; discarding it early makes published results cheaper but permanently excludes accepted late events.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sliding window from small buckets</h2>\n<p>Requirement: \"errors in the last 5 minutes, updated every minute\" for 10,000 API endpoints.</p>\n<ul>\n<li>Keep 1-minute tumbling buckets per endpoint: key <code>errors:endpoint:2026-09-30T10:07</code>, incremented with INCR and given a TTL of 10 minutes.</li>\n<li>At 10:08 the 5-minute value is the sum of buckets 10:03 through 10:07: one MGET of 5 keys.</li>\n<li>Memory: 10,000 endpoints x 10 live buckets = 100,000 small keys, a few MB.</li>\n</ul>\n<p>This approximates a true sliding window with 1-minute granularity. If you need exactness to the second, use smaller buckets (more keys) or a sliding log of timestamps (more memory per event).</p>\n<h2>Window types compared</h2>\n<table><thead><tr><th>Window</th><th>Definition</th><th>Event belongs to</th><th>Typical use</th></tr></thead><tbody>\n<tr><td>Tumbling</td><td>Fixed size, no overlap, such as every 5 minutes</td><td>Exactly one window</td><td>Per-minute dashboards, billing buckets</td></tr>\n<tr><td>Hopping</td><td>Fixed size, fixed advance, such as 5 minutes every 1 minute</td><td>Size divided by advance windows, here 5</td><td>Smoothed moving metrics</td></tr>\n<tr><td>Sliding</td><td>Window ends at each event or query time</td><td>Every window that covers it</td><td>Rate limiting, anomaly detection</td></tr>\n<tr><td>Session</td><td>Closes after an inactivity gap, such as 30 minutes</td><td>One session, size varies</td><td>User sessions, engagement</td></tr>\n</tbody></table>\n<h2>Watermark trade-off in numbers</h2>\n<p>Suppose 99 percent of mobile events arrive within 2 minutes and 99.9 percent within 20 minutes. A 2-minute watermark publishes results fast but leaves about 1 percent to arrive as late corrections; a 20-minute watermark leaves about 0.1 percent late, but every dashboard is 20 minutes behind and the stream processor holds 10 times more open window state. Many teams publish early with a short watermark, emit updates as late data arrives, and mark a bucket \"final\" after the longer bound.</p>\n<p><strong>Real systems:</strong> Flink and Beam support allowed lateness and triggers that re-emit updated results; Kafka Streams uses a grace period per window; Prometheus-style systems avoid the problem by scraping at a fixed interval and defining the sample time as the scrape time.</p>\n</div>",
    "keyTakeaways": [
      "Tumbling windows do not overlap; sliding windows overlap.",
      "Rounded timestamps make excellent cache keys for simple bucketed counting.",
      "Stream processors are needed for complex windowing and handling late events."
    ],
    "furtherReading": [
      {
        "title": "Windowing in Apache Flink",
        "url": "https://nightlies.apache.org/flink/flink-docs-release-1.14/docs/dev/datastream/operators/windows/"
      },
      {
        "title": "The Dataflow Model (Google, Akidau et al.)",
        "url": "https://research.google/pubs/pub41378/"
      }
    ]
  },
  "raw-events-vs-derived-analytics": {
    "title": "Raw events vs derived analytics",
    "video": {
      "youtubeId": "fU9hR3kiOK0",
      "title": "\"Turning the database inside out with Apache Samza\" by Martin Kleppmann",
      "channel": "Strange Loop Conference",
      "why": "The definitive talk on treating an immutable event log as the source of truth and every aggregate, index or cache as a rebuildable derived view.",
      "length": "47:43"
    },
    "videos": [
      {
        "youtubeId": "OxskDWkgqTU",
        "title": "06 Lambda and Kappa Architectures | Data Processing Architectures in Big Data",
        "channel": "Ease With Data",
        "role": "intro",
        "why": "Quick diagram-level comparison of Lambda (batch plus speed layers) and Kappa (replayable log only).",
        "length": "3:06"
      }
    ],
    "intuition": "<p>A photographer keeps the RAW files and also exports JPEGs. The JPEGs load instantly and are what everyone looks at; the RAW files are big and slow, but if you want a different crop or colour grade next year, only RAW lets you do it. Raw events and derived aggregates are the same deal.</p>\n<p><strong>Mental model:</strong> <em>raw events are the source of truth; aggregates are cached answers to questions you already knew to ask</em>. Keep enough raw history to rebuild aggregates when definitions change, and version every derived table so you know which rules produced it.</p>\n<ul>\n<li><strong>Trap:</strong> keeping only aggregates. The first time a PM asks a new question or a bug is found in the pipeline, the data needed to fix it is gone.</li>\n<li><strong>Trap:</strong> keeping raw data forever by default. It carries storage cost, privacy risk and deletion obligations.</li>\n<li><strong>Trap:</strong> fixing a derived table in place. Rebuild into a new version and switch atomically, or reports mix old and new definitions.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Raw Events vs Derived Analytics</h2>\n      <p>A fundamental debate in analytics architecture is whether to store raw events forever, or to pre-aggregate (derive) the data and throw the raw events away to save storage.</p>\n      \n      <h3>The Value of Raw Events</h3>\n      <p>Raw event data (e.g., every single click, JSON payload, and timestamp stored in S3) is the ground truth. The primary advantage is flexibility. If a product manager asks a totally new question (\"How many users clicked X, then Y, but only on iOS 14?\"), you can write a Spark job to query the raw data and get the answer. If you only saved pre-aggregated daily counts, you cannot answer this question retroactively.</p>\n      \n      <h3>The Necessity of Derived Analytics</h3>\n      <p>However, running complex queries over petabytes of raw data is extremely slow and expensive. Dashboards cannot wait 10 minutes for a Hadoop job to finish. Therefore, systems build ETL pipelines to continuously pre-aggregate data (derived analytics) into OLAP databases (like ClickHouse) so dashboards load instantly.</p>\n      \n      <h3>The Best of Both Worlds</h3>\n      <p>Modern architectures often retain bounded raw history in object storage and serve versioned derived tables from an OLAP store. For example, if fraud rule v2 excludes two impressions that rule v1 counted, rebuild into a new aggregate version, validate it, then atomically switch the report; mutating rows in place can leave mixed definitions. Raw retention enables replay but increases privacy, deletion, schema-evolution, and storage obligations. Record event schema, transformation version, source range, and correction lineage, and define what happens when source history has expired.</p>\n    \n<!-- enriched -->\n<h2>Worked example: storage and query cost</h2>\n<table><thead><tr><th>Layer</th><th>Assumption</th><th>Size</th><th>Query latency</th></tr></thead><tbody>\n<tr><td>Raw JSON events</td><td>10 billion events per day x 500 bytes</td><td>5 TB per day</td><td>Minutes to hours</td></tr>\n<tr><td>Raw in Parquet</td><td>Columnar, compressed about 5 to 10 times</td><td>0.5 to 1 TB per day; 90 days is about 45 to 90 TB</td><td>Seconds to minutes with a query engine</td></tr>\n<tr><td>Hourly aggregates by ad, country, device</td><td>Sparse rollup</td><td>Tens of GB per day</td><td>Sub-second in an OLAP store</td></tr>\n<tr><td>Dashboard tiles</td><td>Pre-computed top-level metrics</td><td>MB</td><td>Milliseconds</td></tr>\n</tbody></table>\n<p>The 1,000 to 100,000 times reduction from raw to aggregate is what makes dashboards instant, and also what makes new questions impossible once raw data is gone.</p>\n<h2>Trade-offs</h2>\n<table><thead><tr><th>Approach</th><th>Flexibility</th><th>Cost</th><th>Risk</th></tr></thead><tbody>\n<tr><td>Aggregates only</td><td>Low</td><td>Lowest</td><td>Cannot fix bugs or answer new questions</td></tr>\n<tr><td>Raw only, query on demand</td><td>Highest</td><td>High compute per query</td><td>Slow dashboards, unpredictable bills</td></tr>\n<tr><td>Raw with bounded retention plus versioned aggregates</td><td>High</td><td>Moderate</td><td>Needs lineage and a deletion process</td></tr>\n</tbody></table>\n<h2>Lambda vs Kappa</h2>\n<p>Lambda runs a batch layer over raw storage for correctness and a speed layer for freshness, then merges them; the cost is two codebases computing the same logic. Kappa, popularised by Jay Kreps at LinkedIn, keeps a replayable log and reprocesses history by running a new version of the streaming job from the beginning of the retained log, then switching readers. Kappa needs long log retention or tiered storage, which Kafka and Pulsar now offer.</p>\n<h2>Privacy obligations</h2>\n<p>Under GDPR-style deletion requests, raw events containing a user ID must be deleted or anonymised within the required period, including in backups and derived tables that are not fully aggregated. Common patterns are partitioning raw data by date so whole partitions age out, pseudonymising user IDs with a per-user key that can be destroyed (crypto-shredding), and aggregating to levels where individuals cannot be identified.</p>\n</div>",
    "keyTakeaways": [
      "Raw events provide ground-truth flexibility for retroactive, ad-hoc queries.",
      "Derived analytics (pre-aggregations) are required for fast dashboard rendering.",
      "Store raw data in cheap storage (S3/Parquet) and derived data in fast databases."
    ],
    "furtherReading": [
      {
        "title": "Data Lake vs Data Warehouse",
        "url": "https://aws.amazon.com/big-data/datalakes-and-analytics/what-is-a-data-lake/"
      },
      {
        "title": "Joe Reis & Matt Housley: Fundamentals of Data Engineering (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/fundamentals-of-data/9781098108298/"
      }
    ]
  },
  "count-min-sketch": {
    "title": "Count-min sketch",
    "video": {
      "youtubeId": "hJitoHv4rAU",
      "title": "CountMin sketch, part 1",
      "channel": "Ben Langmead",
      "why": "Johns Hopkins lecture that builds the Count-Min sketch step by step and explains why it only overestimates, with worked numbers.",
      "length": "26:48"
    },
    "videos": [
      {
        "youtubeId": "mPxslXpg8wA",
        "title": "Advanced Data Structures: Count-Min Sketches",
        "channel": "Niema Moshiri",
        "role": "intro",
        "why": "Short, clear animation of inserts and min-of-rows queries.",
        "length": "7:19"
      },
      {
        "youtubeId": "IgyU0iFIoqM",
        "title": "Data Structures for Big Data in Interviews - Bloom Filters, Count-Min Sketch, HyperLogLog",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows when to reach for Count-Min in system design interviews, alongside Bloom filters and HLL.",
        "length": "25:51"
      }
    ],
    "intuition": "<p>Imagine counting how often each song is played using a few rows of pigeonholes. For each play, you drop a marble into one hole per row, chosen by that row's hash. Different songs sometimes share a hole, so a hole can only overstate a song's count, never understate it. To estimate a song, look at its hole in every row and take the smallest pile: the row with the least collision noise.</p>\n<p><strong>Mental model:</strong> <em>d rows by w counters; add 1 at d hashed positions; estimate = minimum</em>. Width controls how big the overcount can be; depth controls how often you are unlucky.</p>\n<ul>\n<li><strong>Trap:</strong> trusting counts for rare items. The error is relative to the total stream size, so small counts are dominated by noise.</li>\n<li><strong>Trap:</strong> expecting it to list the top items. It answers \"how many for this key?\" but does not remember keys; pair it with a heap or Space-Saving.</li>\n<li><strong>Trap:</strong> decrementing or using negative updates and still assuming the never-undercounts guarantee.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Estimating Frequencies with Count-Min Sketch</h2>\n      <p>If you need to know how many times a specific user has visited a site (frequency), keeping a hash map of UserID -> Count works until you hit millions of users, at which point memory becomes a bottleneck.</p>\n      \n      <h3>How Count-Min Sketch Works</h3>\n      <p>The Count-Min Sketch is a probabilistic data structure used to estimate the frequency of events. It is essentially a 2D matrix of counters and a set of independent hash functions.</p>\n      <p>When an item arrives, you hash it using each hash function. The results correspond to column indices. You increment the counter in each corresponding row. To query the frequency of an item, you hash it again, look at the values in the corresponding cells, and take the <strong>minimum</strong> value.</p>\n      \n      <h3>Overcounting, Never Undercounting</h3>\n      <p>Because multiple items might hash to the same cell, a cell can include mass from other items. Taking the minimum mitigates that error. With non-negative updates, no counter overflow, and consistent hashes, the standard estimate does not fall below the true processed frequency; signed updates, overflow, decay, or incompatible merges require different guarantees. Width controls additive error, while depth controls failure probability.</p>\n      <p>It is heavily used in NLP (counting word frequencies), networking (tracking heavy traffic flows), and recommendation engines where perfect frequency accuracy isn't required but memory is strictly constrained.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing from error targets</h2>\n<p>Target: overcount at most 0.1 percent of the stream (epsilon = 0.001) with 99 percent confidence (delta = 0.01).</p>\n<table><thead><tr><th>Parameter</th><th>Formula</th><th>Value</th></tr></thead><tbody>\n<tr><td>Width w</td><td>ceil(e divided by epsilon)</td><td>2,719</td></tr>\n<tr><td>Depth d</td><td>ceil(ln(1 divided by delta))</td><td>5</td></tr>\n<tr><td>Counters</td><td>w x d</td><td>13,595</td></tr>\n<tr><td>Memory at 4 bytes per counter</td><td></td><td>about 54 KB</td></tr>\n</tbody></table>\n<p>Guarantee: for every item, estimate is at least the true count, and with probability at least 99 percent it is at most true count plus epsilon x N, where N is the total number of events.</p>\n<p>With N = 100 million events, epsilon x N = 100,000. An item that truly occurred 5 million times is estimated within 2 percent. An item that occurred 50 times could be reported as anything up to about 100,050. That is why Count-Min is great for heavy hitters and useless for the long tail.</p>\n<h2>A tiny example</h2>\n<p>Width 4, depth 2. Insert \"a\" (row 1 col 0, row 2 col 3), \"b\" (row 1 col 0, row 2 col 1), \"a\" again. Row 1 col 0 now holds 3 (a, b, a); row 2 col 3 holds 2. Query \"a\": minimum of 3 and 2 is 2, correct, because row 2 had no collision.</p>\n<h2>Variants and alternatives</h2>\n<table><thead><tr><th>Structure</th><th>Strength</th><th>Weakness</th></tr></thead><tbody>\n<tr><td>Count-Min</td><td>Simple, mergeable by adding counters</td><td>Overestimates; error scales with total N</td></tr>\n<tr><td>Count-Min with conservative update</td><td>Much lower overcount: only raise counters that equal the current minimum</td><td>No longer mergeable by simple addition in all cases; no deletes</td></tr>\n<tr><td>Count sketch</td><td>Unbiased, error scales with L2 norm, better for skewed data</td><td>Can under- or overestimate; uses median</td></tr>\n<tr><td>Exact hash map</td><td>Exact</td><td>Memory grows with distinct keys</td></tr>\n</tbody></table>\n<p><strong>In the wild:</strong> Redis Stack exposes CMS.INCRBY and CMS.QUERY; network devices use Count-Min style sketches to find heavy flows; the Caffeine cache's TinyLFU admission policy uses a compact frequency sketch with periodic halving so old popularity decays.</p>\n</div>",
    "keyTakeaways": [
      "Count-Min Sketch estimates frequency using a tiny, fixed memory footprint.",
      "With non-negative updates, sufficient counter width, and compatible hashes, collision error is one-sided; other update models need separate guarantees.",
      "Uses a 2D array of counters and takes the minimum value upon query to reduce error."
    ],
    "furtherReading": [
      {
        "title": "Count-Min Sketch Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch"
      },
      {
        "title": "Cormode & Muthukrishnan: An Improved Data Stream Summary: The Count-Min Sketch and Its Applications (LATIN 2004)",
        "url": "https://link.springer.com/chapter/10.1007/978-3-540-24698-5_7"
      }
    ]
  },
  "top-k-heavy-hitters": {
    "title": "Top-k heavy hitters",
    "video": {
      "youtubeId": "kx-XDoPjoHw",
      "title": "System Design Interview - Top K Problem (Heavy Hitters)",
      "channel": "System Design Interview",
      "why": "Still the clearest end-to-end treatment: exact vs Count-Min plus heap, fast and slow paths, and distributed merging.",
      "length": "36:18"
    },
    "videos": [
      {
        "youtubeId": "y-tA2NW4LNY",
        "title": "Top-K System Design Interview Breakdown w/ Ex-Meta Senior Manager",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "A newer, very thorough walkthrough of windowed top-K with Flink, precomputed rollups and serving.",
        "length": "1:31:38"
      },
      {
        "youtubeId": "CA2_0ZhVW2g",
        "title": "How Instagram efficiently serves HashTags ordered by count",
        "channel": "Arpit Bhayani",
        "role": "case-study",
        "why": "How Instagram stores and serves hashtag counts at scale, a real-world top-K relative.",
        "length": "12:18"
      }
    ],
    "intuition": "<p>Picture a busy nightclub bouncer asked \"who are the 10 most frequent visitors this month?\" They cannot remember everyone, so they keep a clipboard with 100 names and tallies. A new face either gets a free line or replaces the name with the smallest tally, inheriting that tally plus one. Frequent regulars can never be pushed off; only the noise churns. That is the Space-Saving algorithm, the workhorse of heavy hitters.</p>\n<p><strong>Mental model:</strong> <em>bounded candidate set plus frequency estimates</em>. Either keep a fixed number of counters that guarantee any item above N divided by k is tracked, or combine a Count-Min sketch with a heap of candidates.</p>\n<ul>\n<li><strong>Trap:</strong> merging each shard's local top 10 and calling it global. A key that is 11th everywhere can be first overall.</li>\n<li><strong>Trap:</strong> forgetting the time window. \"Trending\" means top K in the last hour, so counts must expire or decay.</li>\n<li><strong>Trap:</strong> updating the heap with stale entries. Each key must appear once, with its current estimate.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Finding the Heavy Hitters (Top-K)</h2>\n      <p>Finding the most frequent items in a massive data stream (e.g., \"Trending Hashtags\", \"Top 10 IP addresses DDOSing us\", \"Most viewed videos today\") is a classic system design problem known as the Top-K or Heavy Hitters problem.</p>\n      \n      <h3>The Exact Approach</h3>\n      <p>The exact way is to maintain a HashMap of frequencies, and a Min-Heap (Priority Queue) of size K. For every event, update the hash map, then update the heap. If the stream is infinite and the cardinality is high, the HashMap will exhaust memory.</p>\n      \n      <h3>The Probabilistic Approach (Count-Min Sketch + Heap)</h3>\n      <p>A Count-Min Sketch can estimate a supplied key's frequency, but it does not remember every key and therefore cannot discover candidates by itself. Pair it with a bounded candidate algorithm such as Space-Saving, or maintain an explicitly evaluated candidate set. A heap entry also needs updates when its estimate changes; simply inserting every estimate above the current minimum can retain stale entries and duplicates.</p>\n      \n      <h3>Distributed Top-K</h3>\n      <p>Merging only each worker's local K is approximate and can miss the global winner: one key can rank just below K on every shard yet have the largest combined count. Use a mergeable heavy-hitters sketch with a stated error bound, send an oversampled candidate set and obtain global estimates for its union, or compute exact counts when correctness requires it. Partitioning by key makes exact merging easier but can create a hot owner.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why local top-K merging fails</h2>\n<p>Three shards each report their local top 2.</p>\n<table><thead><tr><th>Key</th><th>Shard 1</th><th>Shard 2</th><th>Shard 3</th><th>Global total</th></tr></thead><tbody>\n<tr><td>A</td><td>1,000</td><td>10</td><td>10</td><td>1,020</td></tr>\n<tr><td>B</td><td>10</td><td>1,000</td><td>10</td><td>1,020</td></tr>\n<tr><td>C</td><td>10</td><td>10</td><td>1,000</td><td>1,020</td></tr>\n<tr><td>X</td><td>900, ranked 2nd</td><td>900, ranked 2nd</td><td>900, ranked 2nd</td><td>2,700</td></tr>\n</tbody></table>\n<p>Here X happens to be second on every shard, so it survives, but with local top 1 it would vanish entirely, even though it is the global winner by a wide margin. The fixes: send an oversampled candidate list, for example top 10 times K from each shard, then ask every shard for the exact counts of the union of candidates; or partition the stream by key so each key's total lives on one node.</p>\n<h2>Worked example: Space-Saving guarantee</h2>\n<p>An hour contains N = 1 billion hashtag uses. With k = 10,000 counters, every counter's overestimate is at most N divided by k = 100,000. Any hashtag used more than 100,000 times is guaranteed to be in the summary. Memory: 10,000 entries of key plus two integers, well under 1 MB.</p>\n<h2>Approaches compared</h2>\n<table><thead><tr><th>Approach</th><th>Memory</th><th>Accuracy</th><th>Notes</th></tr></thead><tbody>\n<tr><td>Exact hash map plus min-heap</td><td>Grows with distinct keys</td><td>Exact</td><td>Fine when cardinality is millions, not billions</td></tr>\n<tr><td>Count-Min plus heap of K candidates</td><td>Sketch plus K entries</td><td>Overestimates by at most epsilon x N</td><td>Candidate discovery happens as items stream past</td></tr>\n<tr><td>Space-Saving, Misra-Gries</td><td>k counters</td><td>Deterministic bound N divided by k</td><td>Mergeable with additive error</td></tr>\n<tr><td>Batch MapReduce or SQL</td><td>Distributed</td><td>Exact</td><td>Minutes to hours late; used to correct the fast path</td></tr>\n</tbody></table>\n<p><strong>Time windows:</strong> keep one summary per minute and merge the last 60 for an hourly view, or use exponential decay, multiplying all counts by a factor such as 0.99 per minute, so trending reflects recent activity. Twitter and similar platforms also normalise against a baseline, because a hashtag that is always popular is not trending.</p>\n</div>",
    "keyTakeaways": [
      "The exact Top-K approach requires too much memory for high-cardinality streams.",
      "Frequency estimation and candidate discovery are separate jobs; combine compatible sketches with a bounded candidate algorithm.",
      "Merging only local K can miss a global heavy hitter; oversample candidates or use a mergeable algorithm with explicit guarantees."
    ],
    "furtherReading": [
      {
        "title": "Heavy Hitters Problem",
        "url": "https://en.wikipedia.org/wiki/Streaming_algorithm#Heavy_hitters"
      },
      {
        "title": "Manku & Motwani: Approximate Frequency Counts over Data Streams (VLDB 2002)",
        "url": "https://www.vldb.org/conf/2002/S10P03.pdf"
      }
    ]
  },
  "reservoir-sampling": {
    "title": "Reservoir sampling",
    "video": {
      "youtubeId": "Buzn4tQz-ZY",
      "title": "Algorithms to Sample From Streams - Reservoir Sampling & Variants by Jonathan Arfa",
      "channel": "PyCon Israel",
      "why": "Covers the classic algorithm, why it is uniform, and the weighted and distributed variants this unit discusses.",
      "length": "16:17"
    },
    "videos": [
      {
        "youtubeId": "A1iwzSew5QY",
        "title": "Reservoir Sampling",
        "channel": "Eric Laber",
        "role": "intro",
        "why": "A compact whiteboard explanation of Algorithm R.",
        "length": "4:24"
      },
      {
        "youtubeId": "dWfo9XGrqKU",
        "title": "Reservoir Sampling Proof (by induction)",
        "channel": "Bizillion Proofs",
        "role": "deep-dive",
        "why": "Walks through the induction proof that every item ends up in the reservoir with probability K divided by N.",
        "length": "6:21"
      }
    ],
    "intuition": "<p>You are at a conveyor belt of unknown length and can hold only 10 items. You want your 10 to be a fair random sample of everything that passed, even though you do not know how many will come. Keep the first 10. When the 11th arrives, keep it with probability 10 out of 11 by swapping out a random held item. For the 1,000th, keep it with probability 10 out of 1,000. Every item that passed ends up equally likely to be in your hands.</p>\n<p><strong>Mental model:</strong> <em>item i replaces a random slot with probability K divided by i</em>. The falling acceptance rate exactly offsets the longer time early items must survive.</p>\n<ul>\n<li><strong>Trap:</strong> merging reservoirs from workers by picking equally from each. A worker that saw 10 times more events must contribute proportionally more.</li>\n<li><strong>Trap:</strong> confusing reservoir sampling with fixed-rate sampling. Keeping 1 percent gives an unbounded sample; a reservoir gives exactly K items.</li>\n<li><strong>Trap:</strong> using it when items have different importance. Use weighted reservoir sampling instead.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Random Sampling Over Infinite Streams</h2>\n      <p>Suppose you have a continuing stream of log events and want to retain 1,000 items as a uniform sample of the finite prefix observed so far. There is no uniform sample over a completed infinite population; the guarantee is evaluated at each current count N.</p>\n      \n      <h3>The Reservoir Sampling Algorithm</h3>\n      <p>Reservoir Sampling is an elegant algorithmic solution to this problem.</p>\n      <ol>\n        <li>Create a \"reservoir\" array of size K (e.g., 1000).</li>\n        <li>Fill the array with the first K elements of the stream.</li>\n        <li>For every subsequent element at index <code>i</code> (where <code>i > K</code>), generate a random number <code>j</code> between 1 and <code>i</code>.</li>\n        <li>If <code>j &lt;= K</code>, replace the element at index <code>j</code> in the reservoir with the new element. Otherwise, discard the new element.</li>\n      </ol>\n      \n      <h3>Why it works</h3>\n      <p>Through inductive mathematical proof, this algorithm guarantees that at any point in time, every element seen so far has an equal probability (K/N) of being in the reservoir. It requires only O(K) memory and O(N) time (a single pass through the stream).</p>\n      <p>A retained reservoir differs from independent head sampling that immediately keeps roughly 1% of traces: later arrivals can replace earlier reservoir members. Combining worker reservoirs also requires each worker's original population size; choosing equally from equal-sized local samples biases small partitions. Use a weighted merge algorithm or sample from a globally keyed priority, and record the randomization/version needed for reproducibility.</p>\n    \n<!-- enriched -->\n<h2>Worked example: K = 2 over a, b, c</h2>\n<ul>\n<li>After a and b, the reservoir is [a, b].</li>\n<li>c arrives as item 3; it is kept with probability 2 out of 3, replacing a or b with equal chance.</li>\n<li>Probability that a survives = probability c is rejected (1/3) plus probability c is kept and replaces b (2/3 x 1/2) = 1/3 + 1/3 = 2/3.</li>\n<li>Probability that c is in the reservoir = 2/3. All three items have probability 2/3 = K divided by N. Uniform.</li>\n</ul>\n<h2>Worked example: merging two workers correctly</h2>\n<p>Worker 1 saw 900,000 events, worker 2 saw 100,000, each kept a reservoir of 1,000. For a merged sample of 1,000, each slot should come from worker 1 with probability 0.9 and worker 2 with probability 0.1, drawn without replacement from each reservoir. Taking 500 from each would over-represent worker 2's events by a factor of 5. Alternatively, give every event a random key and keep the K smallest keys globally (bottom-K sampling), which merges trivially by taking the K smallest of the union.</p>\n<h2>Variants</h2>\n<table><thead><tr><th>Algorithm</th><th>What it adds</th><th>Cost</th></tr></thead><tbody>\n<tr><td>Algorithm R (Vitter)</td><td>Uniform sample of K</td><td>One random number per item</td></tr>\n<tr><td>Algorithm L (Li, 1994)</td><td>Computes how many items to skip before the next replacement</td><td>Far fewer random numbers for long streams</td></tr>\n<tr><td>Weighted, A-Res (Efraimidis and Spirakis)</td><td>Item kept with probability proportional to weight: key = u to the power 1/w, keep the K largest keys</td><td>A heap of size K</td></tr>\n<tr><td>Bottom-K with hashed keys</td><td>Deterministic, reproducible, trivially mergeable</td><td>Needs a good hash; sample depends on key choice</td></tr>\n</tbody></table>\n<h2>Where it is used</h2>\n<p>Distributed tracing systems use tail-based sampling that holds recent traces and keeps a bounded, representative subset, often combined with rules that always keep errors and slow requests. Metrics libraries such as Dropwizard Metrics used exponentially decaying reservoirs to estimate latency histograms. Databases use reservoir-style sampling to build column statistics for query planners without a full scan.</p>\n</div>",
    "keyTakeaways": [
      "Reservoir sampling maintains a uniform random sample of the finite stream prefix observed so far.",
      "It requires only O(K) memory, completely independent of the stream size.",
      "Distributed reservoirs require population-aware merging and are not interchangeable with immediate per-trace sampling."
    ],
    "furtherReading": [
      {
        "title": "Reservoir Sampling Proof",
        "url": "https://en.wikipedia.org/wiki/Reservoir_sampling"
      },
      {
        "title": "Jeffrey Vitter: Random Sampling with a Reservoir (ACM TOMS, 1985)",
        "url": "https://dl.acm.org/doi/10.1145/3147.3165"
      }
    ]
  },
  "tdigest-quantile-sketch": {
    "title": "t-digest quantile sketch",
    "video": {
      "youtubeId": "CR4-aVvjE6A",
      "title": "Berlin Buzzwords 2015: Ted Dunning – Practical t-digest Applications #bbuzz",
      "channel": "Plain Schwarz",
      "why": "The inventor of t-digest explains the centroid idea, why tails get small clusters, and practical uses.",
      "length": "14:50"
    },
    "videos": [
      {
        "youtubeId": "ETUYhEZRtWE",
        "title": "Sketching Data with T Digest In Apache Spark: Spark Summit East talk by Erik Erlandson",
        "channel": "Spark Summit",
        "role": "deep-dive",
        "why": "Shows how t-digests are built, merged across partitions and queried in a distributed engine.",
        "length": "22:50"
      },
      {
        "youtubeId": "3JdQOExKtUY",
        "title": "Percentile Tail Latency Explained (95%, 99%) Monitor Backend performance with this metric",
        "channel": "Hussein Nasser",
        "role": "intro",
        "why": "Quick grounding in why p95 and p99 matter more than averages, the motivation for quantile sketches.",
        "length": "6:15"
      }
    ],
    "intuition": "<p>Summarising a city's incomes, you could list every salary, or you could group people into bands. For the middle class, a wide band like \"40 to 60 thousand\" is fine. For the very top, you want tiny bands, because the difference between the 99th and 99.9th percentile is exactly what you are asked about. t-digest groups values into clusters that are big in the middle and tiny at the tails.</p>\n<p><strong>Mental model:</strong> <em>a sorted list of centroids (mean, count), with a size limit that shrinks toward the extremes</em>. To answer p99, walk the cumulative counts to 99 percent and interpolate between neighbouring centroids.</p>\n<ul>\n<li><strong>Trap:</strong> averaging p99 values from different hosts. Percentiles are not averageable; merge the digests instead.</li>\n<li><strong>Trap:</strong> assuming a fixed error bound. t-digest has excellent empirical tail accuracy but no hard worst-case guarantee; DDSketch or HDR histograms give explicit relative-error bounds.</li>\n<li><strong>Trap:</strong> ignoring the compression parameter. Higher compression means more centroids, more memory, better accuracy.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Accurate Percentiles with t-digest</h2>\n      <p>When measuring system latency, averages are misleading. We care about percentiles (p95, p99) to understand the tail latency experienced by users. Calculating exact percentiles requires keeping all data points: O(N) memory (or multiple passes over the data). Sorting costs O(N log N), and a selection algorithm such as quickselect finds one percentile in expected O(N) time, but the memory is the real obstacle for high-throughput metric streams.</p>\n      \n      <h3>The t-digest Algorithm</h3>\n      <p>t-digest is a data structure designed specifically to estimate quantiles (percentiles) from massive datasets with high accuracy, especially near the tails (p1, p99, p99.9). It works by clustering data points into \"centroids\" (a mean and a weight).</p>\n      <p>The brilliance of t-digest is that it restricts the size of the centroids near the extremes (the tails) to be very small, meaning it retains high accuracy where it matters most for SLAs, while allowing centroids in the middle (the median) to be larger, saving memory.</p>\n      \n      <h3>Mergeable and Distributed</h3>\n      <p>Like HyperLogLog, t-digests are mergeable. You can compute a t-digest of latency on Server A, and another on Server B, send compatible summaries to an aggregator and merge them to estimate the global p99. Do not average host p99 values; validate the deployed sketch, merge tree, duplicates, and representative distributions against exact references.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why averaging p99 lies</h2>\n<table><thead><tr><th>Host</th><th>Requests</th><th>Latencies</th><th>Host p99</th></tr></thead><tbody>\n<tr><td>A</td><td>9,850</td><td>All 10 ms</td><td>10 ms</td></tr>\n<tr><td>B</td><td>150</td><td>All 1,000 ms</td><td>1,000 ms</td></tr>\n</tbody></table>\n<p>Average of host p99s = 505 ms. True global p99 over 10,000 requests: the slowest 1 percent is 100 requests, and all of them come from host B, so global p99 = 1,000 ms. The averaged number is off by half, and in other distributions it can be wrong in the opposite direction. Merging the two digests produces the correct answer because it combines the underlying distributions.</p>\n<h2>Worked example: memory</h2>\n<p>With compression parameter delta = 100, a t-digest keeps on the order of a hundred or so centroids regardless of whether it has seen a thousand or a billion values. At 16 bytes per centroid (mean and count as doubles or long), that is a few KB per series. Exact percentiles over 1 billion values would need 8 GB just to hold the doubles.</p>\n<h2>Quantile summaries compared</h2>\n<table><thead><tr><th>Structure</th><th>Error type</th><th>Mergeable</th><th>Best for</th></tr></thead><tbody>\n<tr><td>Exact, sort all values</td><td>None</td><td>Yes, by concatenation, but huge</td><td>Small datasets, offline audits</td></tr>\n<tr><td>t-digest</td><td>Empirically very accurate at tails; no hard bound</td><td>Yes, approximately</td><td>General analytics: Elasticsearch percentiles, many databases</td></tr>\n<tr><td>HDR Histogram</td><td>Fixed relative precision, such as 3 significant digits</td><td>Yes, exactly, by adding buckets</td><td>Latency with a known value range</td></tr>\n<tr><td>DDSketch</td><td>Guaranteed relative error, such as 1 percent</td><td>Yes, exactly</td><td>Datadog distributions, wide value ranges</td></tr>\n<tr><td>KLL</td><td>Guaranteed rank error</td><td>Yes</td><td>Apache DataSketches; uniform rank accuracy</td></tr>\n<tr><td>Fixed-bucket histogram</td><td>Depends on bucket boundaries</td><td>Yes, by adding counts</td><td>Prometheus classic histograms</td></tr>\n</tbody></table>\n<p><strong>Rule of thumb:</strong> if you need a stated guarantee for an SLA, prefer a sketch with a relative-error bound; if you need flexible ad-hoc analytics, t-digest is a strong default and is what Elasticsearch's percentiles aggregation uses.</p><h2>Failure modes</h2><p>Merging many digests in different orders can give slightly different answers, and repeated merge-then-compress cycles slowly lose accuracy; merge in a tree and validate against exact percentiles on sampled data. Very small datasets are better served by storing values exactly.</p>\n</div>",
    "keyTakeaways": [
      "Exact percentiles over massive streams need O(N) memory or multiple passes, which is impractical at high throughput.",
      "t-digest estimates percentiles with low memory, preserving high accuracy at the tails (p99).",
      "Compatible t-digests are mergeable, but merge order, duplicate contributions, and implementation behavior require validation."
    ],
    "furtherReading": [
      {
        "title": "The t-digest paper",
        "url": "https://arxiv.org/abs/1902.04023"
      },
      {
        "title": "Merging t-Digests (Cramer, 2019)",
        "url": "https://arxiv.org/abs/1906.04032"
      }
    ]
  },
  "streaming-percentile-analytics": {
    "title": "Streaming percentile analytics",
    "video": {
      "youtubeId": "lJ8ydIuPFeU",
      "title": "\"How NOT to Measure Latency\" by Gil Tene",
      "channel": "Strange Loop Conference",
      "why": "The essential talk on measuring percentiles correctly: coordinated omission, why averages and averaged percentiles mislead, and HdrHistogram.",
      "length": "42:59"
    },
    "videos": [
      {
        "youtubeId": "4bl-PmcYDQU",
        "title": "Druid Summit 2022: Percentiles at Scale with Netflix",
        "channel": "Imply",
        "role": "case-study",
        "why": "Netflix engineers on storing and merging quantile sketches in Druid to serve percentile dashboards at scale.",
        "length": "18:34"
      },
      {
        "youtubeId": "yYbXak-1hew",
        "title": "Understanding Prometheus Histograms | Motivation and Concepts, Instrumentation, Querying in PromQL",
        "channel": "Prometheus Monitoring with Julius | PromLabs",
        "role": "deep-dive",
        "why": "How mergeable histogram buckets and histogram_quantile compute percentiles across instances and time in Prometheus.",
        "length": "22:05"
      }
    ],
    "intuition": "<p>A marathon organiser wants to know the finishing time that 99 percent of runners beat, updated live, across 50 checkpoints. They cannot collect every runner's time centrally in real time, so each checkpoint sends a compact summary every 10 seconds, and headquarters merges summaries for any time range. Streaming percentiles are exactly that pipeline.</p>\n<p><strong>Mental model:</strong> <em>emit a mergeable sketch per series per time bucket, store sketches, merge at query time, and roll up old buckets into coarser ones</em>. The sketch, not the percentile, is the unit of storage.</p>\n<ul>\n<li><strong>Trap:</strong> storing only the computed p99 per bucket. You can never correctly combine buckets or hosts again.</li>\n<li><strong>Trap:</strong> coordinated omission. A load generator that waits for slow responses before sending the next request under-records exactly the slow cases.</li>\n<li><strong>Trap:</strong> merging thousands of fine-grained sketches per dashboard query. Precompute rollups at 1 minute and 1 hour.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Architecting Streaming Percentiles</h2>\n      <p>To provide real-time SLA dashboards, a system must process millions of latency metrics and output p90, p95, and p99 metrics instantaneously. This requires combining stream processing with sketch data structures.</p>\n      \n      <h3>The Pipeline</h3>\n      <p>Applications emit raw latency events to a message broker (Kafka). A stream processing framework (Apache Flink) reads these events in time windows (e.g., 10-second tumbling windows). Inside the Flink operators, a t-digest or HDRHistogram sketch is updated in memory. At the end of the 10 seconds, the sketch is emitted to a Time-Series Database (TSDB).</p>\n      \n      <h3>Query Time Rollups</h3>\n      <p>When a user opens an SLA dashboard and requests the p99 latency for the last 24 hours, the TSDB retrieves the thousands of stored 10-second sketches and merges them together on the fly. Merging thousands of sketches at every query can still be expensive, so retain hierarchical rollups with compatible parameters and contribution IDs. Validate approximation error against exact samples, and define whether late windows replace or add to a prior contribution.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why rollups are needed</h2>\n<p>A service has 50 hosts and 20 endpoints, so 1,000 series. Sketches are emitted every 10 seconds.</p>\n<table><thead><tr><th>Query</th><th>Sketches merged without rollups</th><th>With 1-minute and 1-hour rollups</th></tr></thead><tbody>\n<tr><td>p99 last 5 minutes, one endpoint across all hosts</td><td>30 buckets x 50 hosts = 1,500</td><td>5 x 50 = 250, or 5 if hosts are pre-merged</td></tr>\n<tr><td>p99 last 24 hours, whole service</td><td>8,640 buckets x 1,000 series = 8.64 million</td><td>24 hourly service-level sketches</td></tr>\n</tbody></table>\n<p>At a few KB per sketch, 8.64 million sketches is tens of GB read per query, which is unusable. With rollups it is under a megabyte. Rollups must use the same sketch parameters so that merges remain valid, and must record which inputs were included so that late windows replace their contribution rather than being counted twice.</p>\n<h2>Pipeline</h2>\n<div class=\"mermaid\">\nflowchart LR\n  A[\"Services emit latency events\"] --> B[\"Kafka\"]\n  B --> C[\"Flink: sketch per series per 10 s\"]\n  C --> D[\"Sketch store\"]\n  D --> E[\"Rollup jobs: 1 min, 1 h, 1 day\"]\n  E --> D\n  D --> F[\"Query service merges sketches\"]\n  F --> G[\"Dashboards and SLO alerts\"]\n</div>\n<h2>Client-side vs server-side aggregation</h2>\n<table><thead><tr><th>Where the sketch is built</th><th>Pros</th><th>Cons</th></tr></thead><tbody>\n<tr><td>In the application, as HdrHistogram or Prometheus buckets</td><td>No per-request events on the wire; cheap</td><td>Fixed configuration at instrumentation time</td></tr>\n<tr><td>In the stream processor from raw events</td><td>Can re-slice by any dimension; replayable</td><td>Ships every event; higher cost</td></tr>\n<tr><td>In the database at query time from raw rows</td><td>Maximum flexibility</td><td>Slowest; scans raw data</td></tr>\n</tbody></table>\n<p><strong>SLO alerting tip:</strong> for \"99 percent of requests under 300 ms\" it is often simpler and exact to count requests above and below 300 ms per bucket, two additive counters, rather than estimating the p99 and comparing it. Google's SRE guidance on SLOs uses exactly this good-events over total-events formulation.</p><h2>Coordinated omission in one example</h2><p>A load tester sends one request every 10 ms. The server stalls for 2 seconds. A naive tester that waits for each response records one 2-second sample and then continues, so the percentile report shows one slow request out of thousands. In reality about 200 requests (the ones that should have been sent during the stall) would have waited up to 2 seconds. HdrHistogram's recordValueWithExpectedInterval corrects for this; alternatively, use an open-loop load generator that sends on schedule regardless of responses.</p>\n</div>",
    "keyTakeaways": [
      "Real-time percentiles rely on in-memory sketches (t-digest, HDRHistogram).",
      "Stream processors build sketches over small time windows and persist them.",
      "Dashboards merge historical sketches on the fly for fast, accurate aggregations."
    ],
    "furtherReading": [
      {
        "title": "Gil Tene: HdrHistogram: A High Dynamic Range Histogram (GitHub)",
        "url": "https://github.com/HdrHistogram/HdrHistogram"
      },
      {
        "title": "Ted Dunning & Otmar Ertl: Computing Extremely Accurate Quantiles Using t-Digests (arXiv)",
        "url": "https://arxiv.org/abs/1902.04023"
      }
    ]
  },
  "live-reactions-high-throughput-design": {
    "title": "Design: live reactions at high throughput",
    "video": {
      "youtubeId": "yqc3PPmHvrA",
      "title": "Streaming a Million Likes/Second: Real-Time Interactions on Live Video",
      "channel": "InfoQ",
      "why": "LinkedIn engineer Akhilesh Gupta explains the real production design for live-video likes: persistent connections, subscription-based fan-out and multi-data-center dispatch.",
      "length": "49:36"
    },
    "videos": [
      {
        "youtubeId": "LjLx0fCd1k8",
        "title": "System Design Interview: Design Live Comments w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Interview walkthrough of the closely related live comments problem: SSE vs WebSockets, pub/sub partitioning and fan-out to millions of viewers.",
        "length": "56:15"
      }
    ],
    "intuition": "<p>At a concert, you do not hear each of 50,000 people clap individually; you hear a roar whose loudness tells you how excited the crowd is. Live reactions work the same way. The system does not deliver every heart to every viewer; it delivers a summary, such as \"+500 hearts in the last half second\", and the client animates it.</p>\n<p><strong>Mental model:</strong> <em>aggregate on the way in, fan out summaries on the way out</em>. Ingest is many writers, one counter per stream; delivery is one message per interval per viewer, routed only to servers that actually hold viewers of that stream.</p>\n<ul>\n<li><strong>Trap:</strong> fanning out every individual reaction. Deliveries per second are reactions times viewers, which explodes.</li>\n<li><strong>Trap:</strong> broadcasting every stream's updates to every edge server. Track which servers have viewers for which stream.</li>\n<li><strong>Trap:</strong> letting a slow client back up a server. Bound per-connection queues and drop stale visual updates; they are cosmetic.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>System Design: Live Stream Reactions</h2>\n      <p>During live events (Apple keynotes, Twitch streams), users can send reactions (hearts, claps) that float across everyone's screen. The challenge is ingesting tens of thousands of clicks per second and broadcasting them with sub-second latency.</p>\n      \n      <h3>Ingestion and Local Buffering</h3>\n      <p>If millions of users click \"heart\", we cannot send every click to the database. The client app throttles clicks, sending a batch (e.g., \"5 hearts\") every second. The API gateway receives these and routes them to an ingestion service. The ingestion service buffers these counts in memory for 1-2 seconds, aggregating the total counts per reaction type.</p>\n      \n      <h3>Pub/Sub Broadcast</h3>\n      <p>The aggregated counts (e.g., \"Stream123: +500 hearts, +200 claps\") are published to a Redis Pub/Sub topic. The WebSocket servers handling the viewer connections subscribe to this topic. When they receive the aggregated update, they push it down to the clients. The client-side JavaScript then renders the floating animations based on these aggregated numbers, creating the illusion of continuous individual clicks.</p>\n      \n      <h3>Decoupled Analytics</h3>\n      <p>Do not make volatile buffers the only accepted record if permanent counts matter. Persist an event or idempotent delta before acknowledging it, then derive coarse broadcast updates separately. If Redis Pub/Sub drops an update or a WebSocket server restarts, clients should refetch a versioned snapshot and resume from a sequence boundary. Batching lowers fanout bandwidth, but it sacrifices one-to-one animation fidelity and adds up to one batch interval of delay; bound per-client queues and drop visual updates rather than exhausting memory for a slow viewer.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why aggregation is mandatory</h2>\n<p>A live event has 2 million concurrent viewers; 5 percent react each second.</p>\n<table><thead><tr><th>Design</th><th>Messages delivered per second</th></tr></thead><tbody>\n<tr><td>Forward every reaction to every viewer</td><td>100,000 reactions x 2,000,000 viewers = 200 billion, impossible</td></tr>\n<tr><td>Aggregate per stream every 500 ms, send one summary to each viewer</td><td>2 updates x 2,000,000 viewers = 4 million</td></tr>\n<tr><td>Spread over 200 edge servers at 10,000 connections each</td><td>20,000 messages per second per server, very manageable</td></tr>\n</tbody></table>\n<p>On the ingest side, clients batch taps locally (for example, send \"5 hearts\" once per second), so 100,000 reactions per second become at most one request per active user per second, and ingest nodes sum them per stream before publishing.</p>\n<h2>Fan-out design</h2>\n<table><thead><tr><th>Approach</th><th>How it routes</th><th>Trade-off</th></tr></thead><tbody>\n<tr><td>Broadcast to all edge servers</td><td>Every server receives every stream's updates</td><td>Simple; wasteful with thousands of concurrent streams</td></tr>\n<tr><td>Subscription registry</td><td>Edge servers register \"I have viewers of stream S\"; dispatcher sends only there</td><td>Efficient; registry must handle churn as viewers join and leave</td></tr>\n<tr><td>Pub/sub channel per stream, such as Redis Pub/Sub or a Kafka partition</td><td>Edge servers subscribe to channels for their streams</td><td>Leverages existing infrastructure; hot channels need sharding</td></tr>\n</tbody></table>\n<p>LinkedIn's talk describes the subscription approach: frontend nodes hold persistent connections and track which live videos their clients watch, and a dispatcher layer forwards each like only to frontend nodes with subscribers for that video, including across data centers.</p>\n<h2>Durability vs display</h2>\n<p>If the reaction total is a permanent metric, write an idempotent delta (stream ID, ingest node, batch sequence) to a durable log before acknowledging, and derive the displayed counter from that log. The animation path can be lossy: if a pub/sub message is dropped or an edge server restarts, clients simply fetch the current total and continue. Protocol choice: server-sent events suit one-way push of summaries; WebSockets suit apps that also send reactions and comments over the same connection.</p>\n</div>",
    "keyTakeaways": [
      "Client-side throttling and batching is the first line of defense against high throughput.",
      "Server-side memory buffering aggregates raw events into periodic updates.",
      "Visualizing high-volume data relies on client-side rendering interpolation, not 1-to-1 event mapping."
    ],
    "furtherReading": [
      {
        "title": "Akhilesh Gupta (LinkedIn): Streaming a Million Likes/Second: Real-Time Interactions on Live Video (InfoQ)",
        "url": "https://www.infoq.com/presentations/linkedin-play-akka-distributed-systems/"
      },
      {
        "title": "Scaling WebSockets with Redis Pub/Sub (Redis)",
        "url": "https://redis.io/docs/latest/develop/interact/pubsub/"
      }
    ]
  }
};
