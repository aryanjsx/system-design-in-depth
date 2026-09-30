window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-nosql-partitioning"] = {
  "nosql-decision-boundaries": {
    "title": "NoSQL decision boundaries",
    "video": {
      "youtubeId": "6GebEqt6Ynk",
      "title": "Choosing a Database for Systems Design: All you need to know in one video",
      "channel": "Jordan has no life",
      "why": "Picks databases by storage engine, replication and transaction semantics rather than by the SQL vs NoSQL label, which is exactly this lesson's thesis.",
      "length": "23:58"
    },
    "videos": [
      {
        "youtubeId": "kkeFE6iRfMM",
        "title": "How To Choose The Right Database?",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Seven-minute visual map of database families and the workloads each fits.",
        "length": "6:58"
      },
      {
        "youtubeId": "TUcPS6dsWx4",
        "title": "Data Modeling in System Design Interviews w/ Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows how to justify a database choice from access patterns and consistency needs in an interview.",
        "length": "30:35"
      }
    ],
    "intuition": "<p>Choosing a database is like choosing a vehicle. A family car (a relational database) handles 90% of trips well: groceries, commuting, the occasional road trip. A semi-truck (a wide-column store) moves enormous loads on fixed routes but is awful for parallel parking. A motorbike (an in-memory KV store) is blazing fast for one rider and nothing else. You do not buy a semi-truck because you once carried a sofa.</p><p><strong>Mental model:</strong> decide from <em>access patterns, consistency and transaction needs, and scale</em>, in that order. The \"NoSQL\" label tells you almost nothing. DynamoDB has transactions, Postgres stores JSON, and Spanner is SQL and horizontally scalable.</p><ul><li><strong>\"NoSQL scales, SQL doesn't\":</strong> sharded MySQL runs at YouTube (Vitess), Shopify and Meta scale. What scales is a partitionable access pattern.</li><li><strong>Choosing a schemaless store to skip design:</strong> the schema still exists, just implicitly in application code, where migrations are harder.</li><li><strong>Polyglot persistence without a sync plan:</strong> writing to Postgres and Elasticsearch separately (dual writes) drifts. Use CDC or an outbox.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A product needs transactions for orders but also ingests a very high-volume append-only device stream.</p><h2>Mechanics</h2><p>SQL versus NoSQL is not B-tree versus LSM. PostgreSQL uses heap tables with indexes; InnoDB is a MySQL engine with a clustered B+ tree; some relational and non-relational products use LSM trees. Choose per workload: access patterns, transactions, consistency, latency, geography, scale, and operating skill.</p><h2>Failure mode</h2><p>Moving to a store without matching transaction or query semantics can create dual-write inconsistency and expensive application joins. Conversely, keeping an unbounded write stream in a poorly configured single write domain can miss capacity targets.</p><h2>Trade-off</h2><p>Relational systems offer flexible queries and constraints; specialized stores may offer simpler partitioned access or write scaling. Capacity is one reason to change, not the only one, and category labels do not determine guarantees.</p>\n<!-- enriched -->\n<h2>Worked example: one product, three stores</h2><p>Consider an IoT platform with 50k customers, orders and billing, and 2M devices each sending a reading every 10 s.</p><ul><li><strong>Orders and billing:</strong> about 50 writes/s that need multi-row transactions, foreign keys and ad-hoc finance queries. This belongs in PostgreSQL. One primary plus replicas is plenty.</li><li><strong>Device telemetry:</strong> 2M / 10 s is 200k writes/s, append-only, queried as \"device X, last 24 h\". At about 100 bytes per reading that is roughly 1.7 TB/day. This fits a wide-column or time-series store (Cassandra, ScyllaDB, Bigtable, TimescaleDB) partitioned by <code>(device_id, day)</code>.</li><li><strong>Fleet analytics:</strong> \"p95 temperature by region last month\" scans billions of rows, which belongs in a columnar store (ClickHouse, BigQuery) fed by a stream.</li></ul><p>The mistake would be to force all three into one system. The opposite mistake is to add all three on day one when telemetry is 2k writes/s, which a single Postgres (partitioned by time) handles easily.</p><h3>Decision table</h3><table><thead><tr><th>If you need...</th><th>Lean towards</th><th>Watch out for</th></tr></thead><tbody><tr><td>Multi-entity transactions, constraints, ad-hoc queries</td><td>Relational (Postgres, MySQL)</td><td>Single-writer limits before sharding</td></tr><tr><td>Relational semantics plus horizontal writes plus multi-region</td><td>Distributed SQL (Spanner, CockroachDB, YugabyteDB)</td><td>Higher per-write latency (consensus), cost</td></tr><tr><td>Predictable single-digit-ms access by key at any scale</td><td>Key-value / document (DynamoDB, MongoDB)</td><td>Query flexibility; design around access patterns up front</td></tr><tr><td>Massive append-heavy writes, queried by partition and time</td><td>Wide-column (Cassandra, ScyllaDB, Bigtable)</td><td>No joins, limited secondary indexes, tombstones</td></tr><tr><td>Aggregations over billions of rows</td><td>Columnar OLAP (ClickHouse, BigQuery, Snowflake)</td><td>Poor for point updates and high-QPS OLTP</td></tr><tr><td>Deep, variable-length relationship traversal</td><td>Graph (Neo4j, Neptune)</td><td>Sharding connected data; another query language</td></tr><tr><td>Sub-millisecond ephemeral state</td><td>In-memory (Redis, Memcached)</td><td>Durability and memory cost</td></tr></tbody></table><h3>Interview checklist</h3><ul><li>State the top 2-3 queries and their QPS before naming any product.</li><li>State the consistency requirement per entity (for example, balance must be strongly consistent, feed can be eventual).</li><li>Estimate data size and growth, and whether it fits on one node for 2-3 years.</li><li>Name what you give up with the chosen store and how you compensate (for example, no joins, so denormalize at write time).</li></ul>\n</div>",
    "keyTakeaways": [
      "SQL versus NoSQL does not determine one storage engine or consistency model.",
      "Choose from access patterns, transactions, consistency, latency, scale, and operations.",
      "Capacity is one decision input, not the only reason to choose a datastore."
    ],
    "furtherReading": [
      {
        "title": "Martin Kleppmann: Designing Data-Intensive Applications (Storage Engines)",
        "url": "https://dataintensive.net/"
      },
      {
        "title": "Amazon Dynamo Paper (2007)",
        "url": "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf"
      }
    ]
  },
  "document-vs-key-value-stores": {
    "title": "Document vs key-value stores",
    "video": {
      "youtubeId": "TUcPS6dsWx4",
      "title": "Data Modeling in System Design Interviews w/ Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Contrasts modeling the same entities in relational, document and key-value stores, driven by access patterns: exactly the 'select by required operations' point of this unit.",
      "length": "30:35"
    },
    "videos": [
      {
        "youtubeId": "Dwt8R0KPu7k",
        "title": "How Key value Stores Work (Redis, DynamoDB, Memcached)?",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Short visual primer on the key-value model and how Redis, DynamoDB and Memcached differ.",
        "length": "6:00"
      },
      {
        "youtubeId": "ONzdr4SmOng",
        "title": "MongoDB Internal Architecture",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "How a document store actually stores and indexes documents (WiredTiger, clustered collections, _id index).",
        "length": "43:25"
      }
    ],
    "intuition": "<p>A key-value store is a wall of numbered lockers. Give it a locker number and you get back whatever box is inside, with no questions asked about the contents. A document store is a filing cabinet of labelled folders. It can still fetch folder #42, but it can also find \"all folders where city is Berlin and status is open\" because it understands the fields written on each page.</p><p><strong>Mental model:</strong> key-value means <em>the database knows the key, you know the value</em>. Document means <em>the database knows the structure too</em>, so it can index, filter and partially update fields, at the cost of parsing and index maintenance.</p><ul><li><strong>Treating the line as sharp:</strong> DynamoDB is key-value but supports typed attributes, secondary indexes and filter expressions. Redis has hashes, sets and sorted sets. MongoDB lookups by <code>_id</code> are pure key-value.</li><li><strong>Unbounded documents:</strong> embedding an ever-growing array (all comments on a post) hits size limits (16 MB in MongoDB, 400 KB per DynamoDB item) and rewrites large documents on every change.</li><li><strong>Hand-rolled secondary indexes:</strong> maintaining your own \"email to user_id\" key alongside the user record will drift after partial failures unless it is written transactionally.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>Sessions need lookup by token, while a catalog needs predicates on nested product attributes.</p><h2>Mechanics</h2><p>A minimal key-value store exposes opaque bytes by key, but products vary: Redis has server-side structured types and DynamoDB supports attributes and secondary indexes. Document stores expose fields and indexes inside records, paying parsing and index-maintenance costs.</p><h2>Failure mode</h2><p>Manually maintained secondary structures can diverge after a partial write. Too many document indexes amplify writes, and large documents can create contention or transfer waste.</p><h2>Trade-off</h2><p>Key-based access is simple and predictable; document queries improve flexibility. Select by required operations rather than assuming every key-value value is opaque or every document store provides relational constraints.</p>\n<!-- enriched -->\n<h2>Worked example: sessions vs product catalog</h2><p><strong>Sessions:</strong> 10M active sessions, each about 1 KB, with 50k reads/s and 5k writes/s. Access is always <code>get(token)</code> and <code>set(token, blob, ttl)</code>. That makes it a key-value workload. In Redis, 10M x about 1.1 KB is about 11 GB of RAM, with sub-millisecond reads and native TTL. In DynamoDB, 50k eventually consistent reads/s of items up to 4 KB cost 25k RCUs, with DynamoDB TTL for expiry. No secondary index is needed.</p><p><strong>Catalog:</strong> 5M products with nested attributes (size, colour, specs). Queries include \"category = shoes AND brand = X AND price &lt; 100 sorted by rating\". That is a document workload. MongoDB with a compound index <code>{category: 1, brand: 1, price: 1}</code> serves it, and partial updates with the set operator (for example setting only <code>stock.warehouse3</code> to 12) avoid rewriting the whole document. Putting this in a pure KV store means building and maintaining every index yourself.</p><h3>Comparison</h3><table><thead><tr><th>Aspect</th><th>Key-value (Redis, Memcached, DynamoDB core)</th><th>Document (MongoDB, Couchbase, Firestore)</th></tr></thead><tbody><tr><td>Lookup</td><td>By key (plus sort key in DynamoDB)</td><td>By key or any indexed field, including nested fields</td></tr><tr><td>Update</td><td>Usually replace the whole value (Redis types and DynamoDB UpdateExpression are exceptions)</td><td>Field-level update operators (set, inc, push)</td></tr><tr><td>Secondary indexes</td><td>None (Redis, Memcached) or limited (DynamoDB GSI/LSI, eventually consistent GSIs)</td><td>Many, including multikey (array) and text</td></tr><tr><td>Write cost</td><td>Lowest: one key</td><td>Grows with the number of indexes</td></tr><tr><td>Latency profile</td><td>Very predictable</td><td>Depends on query shape and index use</td></tr><tr><td>Typical fit</td><td>Sessions, caches, carts, feature flags, idempotency keys</td><td>Catalogs, CMS content, user profiles, event payloads</td></tr></tbody></table><h3>Modeling rules for documents</h3><ul><li><strong>Embed</strong> what is read together and bounded (an order and its line items).</li><li><strong>Reference</strong> what is unbounded or shared (a post's comments, a product shared by many orders).</li><li><strong>Keep hot, frequently updated fields</strong> (view counters) out of large documents, or in a separate KV counter.</li></ul><h3>Failure modes</h3><ul><li><strong>GSI lag in DynamoDB:</strong> a read from a global secondary index right after a write may not see it.</li><li><strong>Index explosion:</strong> 15 indexes on a document collection can make each insert cost 16 B-tree updates.</li><li><strong>Hot documents:</strong> a single \"global counters\" document serializes all writers on one lock.</li></ul>\n</div>",
    "keyTakeaways": [
      "Key-value products differ: some expose opaque bytes and others structured values or indexes.",
      "Document indexes improve field queries while amplifying writes.",
      "Select from required operations and guarantees rather than category labels."
    ],
    "furtherReading": [
      {
        "title": "MongoDB Architecture Guide: WiredTiger Internals",
        "url": "https://www.mongodb.com/docs/manual/core/wiredtiger/"
      },
      {
        "title": "Redis Documentation: Redis data types",
        "url": "https://redis.io/docs/latest/develop/data-types/"
      }
    ]
  },
  "columnar-vs-wide-column-stores": {
    "title": "Columnar vs wide-column stores",
    "video": {
      "youtubeId": "Vw1fCeD06YI",
      "title": "Column vs Row Oriented Databases Explained",
      "channel": "Hussein Nasser",
      "why": "Walks through how row and column layouts physically store and read the same table, and why analytics and OLTP favour opposite layouts; the key idea this unit needs.",
      "length": "34:16"
    },
    "videos": [
      {
        "youtubeId": "TD3-INhm60Q",
        "title": "Cassandra Deep Dive w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "deep-dive",
        "why": "Explains the wide-column side properly: partition keys, clustering keys, LSM storage and query-first modeling.",
        "length": "29:51"
      },
      {
        "youtubeId": "yWnToWrskXE",
        "title": "#06 - Column-Store Databases (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "Pavlo's lecture on column-store storage, compression and vectorized execution.",
        "length": "1:21:20"
      }
    ],
    "intuition": "<p>Imagine a school's records. A <strong>wide-column store</strong> is a filing cabinet with one drawer per class (the partition key), and inside each drawer the students' full cards sorted by surname (the clustering key). Fetching \"all of class 7B\" is one drawer pull. A <strong>columnar store</strong> is a set of long ledgers, one per attribute: a ledger of every student's height, another of every student's grade. Averaging all heights reads just one ledger, but reassembling one student's card means visiting every ledger.</p><p><strong>Mental model:</strong> wide-column is <em>row-oriented, partitioned OLTP</em> (a distributed sorted map). Columnar is <em>column-at-a-time OLAP</em> built for scans and aggregates. The shared word \"column\" is an accident of naming.</p><ul><li><strong>Running analytics on Cassandra:</strong> a \"sum over all partitions\" is a full-cluster scan with no column pruning. Export to a columnar store instead.</li><li><strong>High-QPS point updates in ClickHouse:</strong> mutations rewrite whole parts. Use it for append-mostly data.</li><li><strong>Modeling Cassandra like SQL:</strong> tables are designed per query, and unbounded partitions (for example all events for one user forever) become hot and slow.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Vectorized OLAP Engines vs. Distributed LSM Tables</h2>\n      <p>Engineers often confuse <strong>Wide-Column stores</strong> (Apache Cassandra, ScyllaDB, Google Cloud Bigtable) with true <strong>Columnar databases</strong> (ClickHouse, Snowflake, DuckDB, AWS Redshift, Apache Parquet). Despite both referencing 'columns', their underlying storage engines serve diametrically opposed workloads:</p>\n      <ul>\n        <li><strong>Wide-Column (Cassandra / ScyllaDB):</strong> An <strong>OLTP engine</strong> designed for massive horizontal distributed writes. Under the hood, data is organized around a <code>Partition Key</code> and a <code>Clustering Key</code>. Rows are stored in an LSM-tree sorted by clustering key. It is effectively a two-dimensional key-value store: <code>Map&lt;PartitionKey, SortedMap&lt;ClusteringKey, Columns>></code>. Within a single SSTable a row's columns are stored together, but one logical row can be spread across several SSTables (and the memtable) until compaction merges them.</li>\n        <li><strong>Columnar (ClickHouse / Parquet):</strong> An <strong>OLAP engine</strong> designed for aggregate analytical queries across billions of rows (e.g., <code>SELECT avg(latency), sum(bytes) FROM logs WHERE status = 500</code>). On disk, values for a single column across millions of rows are packed sequentially into compressed data blocks.</li>\n      </ul>\n\n      <h2>Disk Layout: Row-Oriented vs. Pure Columnar</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph RowLayout [\"Row / Wide-Column Storage (Cassandra / Postgres)\"]\n      R1[\"Row 1: [ID: 1 | Timestamp: 10:00 | Status: 200 | Latency: 42ms | Payload: ...]\"]\n      R2[\"Row 2: [ID: 2 | Timestamp: 10:01 | Status: 500 | Latency: 980ms | Payload: ...]\"]\n      R3[\"Row 3: [ID: 3 | Timestamp: 10:02 | Status: 200 | Latency: 35ms | Payload: ...]\"]\n    end\n\n    subgraph ColumnarLayout [\"Pure Columnar Storage (ClickHouse / Parquet)\"]\n      C_ID[\"Col ID: 1, 2, 3 - bit-packed\"]\n      C_Time[\"Col Timestamp: 10:00, 10:01, 10:02 - delta-encoded\"]\n      C_Status[\"Col Status: 200, 500, 200 - dictionary compressed\"]\n      C_Latency[\"Col Latency: 42, 980, 35 - SIMD vectorized scan\"]\n    end\n      </div>\n\n      <h2>Why Columnar Storage Wins for Analytics: Vectorization & Compression</h2>\n      <p>When calculating an average across 100 million logs, a row-oriented database must read all row data (including user agents, payloads, request URLs) from disk into RAM, discarding 95% of the bytes read. A columnar engine only reads the <code>latency</code> column file from disk.</p>\n      <p>Furthermore, because identical data types sit adjacent on disk, columnar engines often achieve around 10:1 compression (highly workload-dependent) using specialized codecs:</p>\n      <ul>\n        <li><strong>Run-Length Encoding (RLE):</strong> Sequences of identical values (e.g., <code>[200, 200, 200, 200]</code>) compress to <code>[200, count=4]</code>.</li>\n        <li><strong>Delta Encoding:</strong> Timestamps (<code>1600000000, 1600000001, 1600000003</code>) store only the small deltas (<code>+1, +2</code>), which compress down to single bytes.</li>\n        <li><strong>SIMD Vectorization:</strong> Modern CPUs can execute mathematical operations on 512-bit registers (AVX-512) processing 16 32-bit integers per instruction (actual per-cycle throughput depends on the microarchitecture).</li>\n      </ul>\n    </div>",
    "keyTakeaways": [
      "Wide-Column stores (Cassandra) are distributed OLTP databases storing each row's columns together within SSTables indexed by partition keys (fragments across SSTables are merged by compaction).",
      "Pure Columnar engines (ClickHouse) store each column in a dedicated compressed file, scanning only the necessary columns.",
      "Columnar formats leverage Delta encoding, Dictionary compression, and SIMD CPU vectorization for orders-of-magnitude faster aggregations compared to row-oriented storage (see: Abadi et al., 'Column-Stores vs. Row-Stores', SIGMOD 2008)."
    ],
    "furtherReading": [
      {
        "title": "ClickHouse Architecture: Why ClickHouse is so Fast",
        "url": "https://clickhouse.com/docs/en/development/architecture"
      },
      {
        "title": "Apache Cassandra Documentation: Storage Engine",
        "url": "https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html"
      }
    ]
  },
  "graph-database-decision-boundary": {
    "title": "Graph database decision boundary",
    "video": {
      "youtubeId": "Sdw_D-Gllac",
      "title": "How are Graph Databases So Fast?? (Neo4j) | Systems Design Interview 0 to 1 with Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Explains index-free adjacency vs repeated index lookups per join hop, the exact mechanical reason behind this decision boundary, in under 10 minutes.",
      "length": "9:32"
    },
    "videos": [
      {
        "youtubeId": "oPNw82wijKE",
        "title": "What Are Graph Databases? What Are Pros and Cons vs. Relational Databases?",
        "channel": "OtterTune",
        "role": "intro",
        "why": "Short, balanced take from Andy Pavlo's company on when a relational database with recursive queries is enough.",
        "length": "4:54"
      },
      {
        "youtubeId": "jaex3DuugxA",
        "title": "Fraud Detection and What We Can Learn from the Panama Papers — Dr. Jesús Barrasa, Neo4j",
        "channel": "Neo4j",
        "role": "case-study",
        "why": "A concrete fraud-ring and ownership-chain traversal use case, matching the lesson's scenario.",
        "length": "19:05"
      }
    ],
    "intuition": "<p>Think of finding \"friends of friends of friends\" at a party. In a relational database, every hop means walking to the front desk and looking up a guest list by name (an index lookup). In a graph database, each person is holding hands with their friends, so you just follow the hands. For one hop, both are quick. For five variable-length hops through millions of people, following hands wins.</p><p><strong>Mental model:</strong> a graph database stores <em>relationships as first-class, directly linked records</em>, so traversal cost scales with the part of the graph you touch, not with total table size. Choose it when the questions are about paths and patterns, not rows.</p><ul><li><strong>Using a graph DB for 1-hop lookups:</strong> \"list my direct friends\" is one indexed query in SQL. A second database is not justified.</li><li><strong>Supernodes:</strong> a celebrity with 50M followers turns any traversal through them into a 50M-edge expansion. Cap degree, filter by edge type or time, or special-case such nodes.</li><li><strong>Assuming it shards easily:</strong> connected data spans partitions, so cross-machine hops add network latency. Many graph deployments scale up, not out.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A fraud check must traverse variable-depth relationships among accounts, devices, and cards, while a user page needs only direct friends.</p><h2>Mechanics</h2><p>Relational recursive queries and graph adjacency traversal both cost work proportional to the visited structure, filters, indexes, and cache behavior; there is no general O(log N)^D rule. Graph stores make relationships first-class and can avoid repeated global index lookups for each hop.</p><h2>Failure mode</h2><p>A supernode can expand to millions of edges, exhausting a latency budget. Partitioning a connected graph and maintaining relationship updates can also be difficult.</p><h2>Trade-off</h2><p>Graph databases improve expressive traversals and relationship-centric models, but add another query language and operational system. Bounded indexed joins can remain simpler and fast in SQL.</p>\n<!-- enriched -->\n<h2>Worked example: fraud ring detection</h2><p>Question: \"Find accounts within 4 hops of a flagged account through shared devices, cards, phone numbers or addresses.\"</p><ul><li>Graph: 100M accounts, 300M devices, cards and phones, and 1B edges. Average degree per account is about 5.</li><li>A naive 4-hop expansion touches roughly 5^4 = 625 nodes, but real graphs have skew. One shared public-WiFi \"device\" might connect 200k accounts.</li></ul><p><strong>In SQL (Postgres recursive CTE):</strong></p><p><code>WITH RECURSIVE reach(id, depth) AS (SELECT 'acct_1', 0 UNION SELECT e.dst, r.depth + 1 FROM reach r JOIN edges e ON e.src = r.id WHERE r.depth &lt; 4) SELECT DISTINCT id FROM reach;</code></p><p>Each hop is an index lookup on <code>edges(src)</code>: about 3-4 B-tree page touches per expanded node. For 625 nodes that is about 2,500 page touches, a few milliseconds when cached, which is perfectly fine. Trouble starts with deeper or variable-length paths, cycle detection, shortest-path and pattern matching, where the SQL becomes hard to write and optimize.</p><p><strong>In a native graph (Neo4j):</strong></p><p><code>MATCH (a:Account {id:'acct_1'})-[:USES*1..4]-(b:Account) RETURN DISTINCT b</code></p><p>Each hop follows stored relationship pointers. The query is also far easier to express and change.</p><h3>Decision table</h3><table><thead><tr><th>Workload</th><th>Relational</th><th>Graph database</th></tr></thead><tbody><tr><td>Fixed 1-2 hop joins (friends list, order to items)</td><td>Best: simple, indexed</td><td>Overkill</td></tr><tr><td>Hierarchies (org chart, categories)</td><td>Good: recursive CTE, ltree, closure table</td><td>Good</td></tr><tr><td>Variable-depth paths, shortest path, cycles</td><td>Painful SQL, unpredictable plans</td><td>Natural fit</td></tr><tr><td>Pattern matching (fraud rings, knowledge graphs)</td><td>Hard</td><td>Natural fit</td></tr><tr><td>Heavy aggregation over all nodes (PageRank on billions)</td><td>Poor</td><td>Better done in batch graph engines (Spark GraphX, Pregel-style)</td></tr><tr><td>Planet-scale social graph lookups</td><td>Sharded SQL behind a graph-aware cache</td><td>Rarely a general graph database</td></tr></tbody></table><h3>How real systems do it</h3><ul><li><strong>Meta TAO:</strong> a graph API (\"objects and associations\") backed by sharded MySQL and a massive cache. Mostly 1-hop queries at huge scale.</li><li><strong>LinkedIn:</strong> custom in-memory graph services (LIquid) for degree-of-connection queries.</li><li><strong>Banks and fraud teams:</strong> commonly Neo4j, TigerGraph or Amazon Neptune for investigative multi-hop queries.</li></ul>\n</div>",
    "keyTakeaways": [
      "Traversal cost depends on visited relationships, filters, indexes, and locality.",
      "Graph stores make adjacency first-class but still face supernodes and partitioning.",
      "Bounded indexed SQL traversal can remain the simpler choice."
    ],
    "furtherReading": [
      {
        "title": "Neo4j: Native vs. Non-Native Graph Database Architecture & Technology",
        "url": "https://neo4j.com/blog/cypher-and-gql/native-vs-non-native-graph-technology/"
      },
      {
        "title": "Meta TAO: How Facebook Serves the Social Graph",
        "url": "https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson"
      }
    ]
  },
  "sharding-and-partitioning": {
    "title": "Sharding and partitioning",
    "video": {
      "youtubeId": "L521gizea4s",
      "title": "Sharding in System Design Interviews w/ Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Thorough treatment of shard-key selection, range vs hash vs directory sharding, hot spots, cross-shard queries and resharding, framed the way senior interviews probe it.",
      "length": "30:34"
    },
    "videos": [
      {
        "youtubeId": "wXvljefXyEo",
        "title": "Database Sharding and Partitioning",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Separates partitioning (logical) from sharding (physical) and walks through the strategies and their failure modes.",
        "length": "23:53"
      },
      {
        "youtubeId": "be6PLMKKSto",
        "title": "The Basics of Database Sharding and Partitioning in System Design",
        "channel": "Aced (formerly Exponent)",
        "role": "intro",
        "why": "The previous pick: a quick 6-minute intro to the vocabulary.",
        "length": "6:02"
      }
    ],
    "intuition": "<p>Sharding is splitting a phone book into volumes. Split by surname ranges (A-F, G-M, ...) and it is easy to list everyone named \"Sm...\", but the \"S\" volume may be much thicker than \"X\". Split by a hash of the name and every volume is equally thick, but \"everyone starting with Sm\" now means opening every volume.</p><p><strong>Mental model:</strong> <em>partitioning</em> divides one dataset into pieces, and <em>sharding</em> places those pieces on different machines. The shard key decides which queries stay on one machine (cheap) and which fan out to all of them (expensive), so choose it from your dominant query.</p><ul><li><strong>Low-cardinality or skewed keys:</strong> sharding by country puts 40% of traffic on the \"US\" shard.</li><li><strong>Monotonic keys with range sharding:</strong> <code>created_at</code> or auto-increment IDs send every new write to the last shard.</li><li><strong>Physical shards equal to logical shards:</strong> start with many logical shards (for example 1,024) mapped onto a few machines, so rebalancing means moving whole logical shards rather than rehashing every row.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>One tenant dominates writes and the primary no longer meets latency or recovery targets.</p><h2>Mechanics</h2><p>Shard when measured capacity, locality, or fault-domain requirements cannot be met safely by one write domain; there is no universal 2 TB or writes-per-second threshold. Range partitioning aids scans but can hotspot monotonic keys; hashing spreads keys but scatters ranges.</p><h2>Failure mode</h2><p>A poor shard key creates hot partitions, cross-shard joins, and distributed transactions. Rebalancing can consume network and disk while old and new routers disagree.</p><h2>Trade-off</h2><p>Sharding adds capacity and isolation at the cost of routing, rebalancing, global constraints, and operations. Vertical scaling or partitioning within one database is often simpler first.</p>\n<!-- enriched -->\n<h2>Worked example: sharding a multi-tenant SaaS</h2><p>Suppose there are 20k tenants and 12 TB of data, with a single primary at 70% CPU on writes. The dominant queries are all scoped to one tenant.</p><ul><li><strong>Shard key:</strong> <code>tenant_id</code>. Every dominant query becomes single-shard, and per-tenant transactions and foreign keys still work within the shard.</li><li><strong>Logical shards:</strong> <code>logical = hash(tenant_id) mod 1024</code>, then a lookup table maps logical shards to 8 physical clusters (128 logical per cluster, about 1.5 TB each).</li><li><strong>Big tenants:</strong> the largest tenant has 8% of the data. Pin it to its own cluster via a directory entry, so it does not overload a hashed neighbour.</li><li><strong>Growth:</strong> to go from 8 to 16 clusters, move 64 logical shards off each cluster using logical replication or CDC, then flip the directory entry. No rows are rehashed.</li></ul><h3>Strategy comparison</h3><table><thead><tr><th>Strategy</th><th>Routing</th><th>Range scans</th><th>Hotspot risk</th><th>Rebalancing</th><th>Used by</th></tr></thead><tbody><tr><td>Range</td><td>Key-range table</td><td>Efficient</td><td>High for monotonic keys</td><td>Split and move ranges</td><td>Bigtable, HBase, Spanner, CockroachDB</td></tr><tr><td>Hash (mod N)</td><td>Compute</td><td>Scatter to all shards</td><td>Low (except hot keys)</td><td>Painful: most keys move</td><td>Simple app-level sharding</td></tr><tr><td>Consistent hashing / vnodes</td><td>Ring lookup</td><td>Scatter</td><td>Low</td><td>About 1/N of keys move</td><td>Cassandra, DynamoDB (internally), Riak</td></tr><tr><td>Directory / lookup</td><td>Metadata service</td><td>Depends on key</td><td>Controllable</td><td>Move individual entries</td><td>Vitess (vindexes), Notion, Figma</td></tr></tbody></table><h3>What you lose after sharding</h3><ul><li><strong>Cross-shard joins:</strong> push them to an analytics store, denormalize, or run scatter-gather with limits.</li><li><strong>Global unique constraints:</strong> email uniqueness across shards needs a separate global table or service.</li><li><strong>Cross-shard transactions:</strong> use 2PC (slow, blocking on coordinator failure) or sagas with compensation.</li><li><strong>Globally sorted pagination:</strong> needs a merge across shards, so prefer per-shard cursors.</li></ul><div class=\"mermaid\">flowchart LR\nA[\"App\"] --> R[\"Router: tenant_id to logical shard\"]\nR --> D[\"Directory: logical shard to cluster\"]\nD --> C1[\"Cluster 1: logical 0-127\"]\nD --> C2[\"Cluster 2: logical 128-255\"]\nD --> C8[\"Cluster 8: logical 896-1023\"]\n</div>\n</div>",
    "keyTakeaways": [
      "No universal size or throughput threshold requires sharding.",
      "Range and hash partitioning exchange scan locality for distribution.",
      "Sharding adds routing, rebalancing, and cross-shard coordination."
    ],
    "furtherReading": [
      {
        "title": "CockroachDB Architecture: How Sharding and Ranges Work",
        "url": "https://www.cockroachlabs.com/docs/stable/architecture/overview.html"
      },
      {
        "title": "Pinterest: Sharding Pinterest Databases",
        "url": "https://medium.com/pinterest-engineering/sharding-pinterest-how-we-scaled-our-mysql-fleet-3f341e96ca6f"
      }
    ]
  },
  "hot-partitions": {
    "title": "Hot partitions",
    "video": {
      "youtubeId": "jHx4psu1C0k",
      "title": "Avoiding rolling hot keys with Amazon DynamoDB - Amazon DynamoDB Nuggets | Amazon Web Services",
      "channel": "Amazon Web Services",
      "why": "AWS's own explanation of how time-based and skewed keys concentrate load on one partition, and the write-sharding/salting fixes the lesson describes.",
      "length": "15:31"
    },
    "videos": [
      {
        "youtubeId": "xynXjChKkJc",
        "title": "How Discord Stores Trillions of Messages | Deep Dive",
        "channel": "Hussein Nasser",
        "role": "case-study",
        "why": "Discord's hot-partition problems on Cassandra, and the request coalescing and bucketing they used on ScyllaDB.",
        "length": "1:08:33"
      },
      {
        "youtubeId": "7v-wrJjcg4k",
        "title": "How @ShopifyEngineering avoids hot shards by moving data across databases without any downtime",
        "channel": "Arpit Bhayani",
        "role": "case-study",
        "why": "How Shopify rebalances hot tenants between database pods without downtime.",
        "length": "20:58"
      }
    ],
    "intuition": "<p>A hot partition is one supermarket checkout lane with a celebrity signing autographs in it. The store has 20 lanes and plenty of total capacity, but everyone wants lane 7. Adding more lanes does not help. You either split the celebrity's queue across several lanes or hand out pre-signed photos at the door (a cache).</p><p><strong>Mental model:</strong> a partitioned system's capacity is bounded by its <em>busiest</em> partition, not by the average. Hashing spreads <em>keys</em> evenly, but it cannot spread <em>traffic to a single key</em>.</p><ul><li><strong>Adding nodes to fix a hot key:</strong> one key lives on one partition (and its replicas). More nodes do not dilute it.</li><li><strong>Salting everything:</strong> salting multiplies read cost by K. Apply it only to keys detected as hot, or only to write-heavy counters.</li><li><strong>Time-bucketed keys:</strong> a partition key like <code>date</code> sends all of today's writes to one partition, a \"rolling\" hotspot.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Anatomy of a Hotspot: When Hashing Fails</h2>\n      <p>Hash-based sharding guarantees uniform key distribution across shards—<strong>assuming keys are accessed uniformly</strong>. In real-world systems, access distributions follow Zipf's Law or Pareto distributions (80/20 rule). When a single entity (such as a celebrity with 100 million followers, a Black Friday flash sale item, or a major breaking news thread) receives millions of concurrent reads and writes, the single shard hosting that partition key collapses under CPU saturation, lock contention, or connection pool exhaustion, causing cascading cluster latency spikes.</p>\n\n      <h2>Architectural Mitigation: Compound Key Salting & Scatter-Gather</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Incoming Writes to Hot Entity: 'product_1001'\"] --> Salt[\"Key Salting Middleware: Append Random Salt 0..9\"]\n    Salt --> W1[\"Write to 'product_1001_salt0' on Shard 1\"]\n    Salt --> W2[\"Write to 'product_1001_salt4' on Shard 5\"]\n    Salt --> W3[\"Write to 'product_1001_salt9' on Shard 9\"]\n\n    subgraph ReadPath [\"Read Aggregation Path\"]\n      Reader[\"Read Aggregation: 'product_1001'\"] --> QueryAll[\"Scatter-Gather Query Across All 10 Salt Sub-Keys\"]\n      QueryAll --> Merge[\"In-Memory Sum / Merge Reducer\"]\n      Merge --> ReturnVal[\"Accurate Inventory Count\"]\n    end\n      </div>\n\n      <h2>Production Mitigation Patterns</h2>\n      <h3>1. Write Salting (Compound Partition Keys)</h3>\n      <p>To distribute write throughput for a hot counter (e.g., likes on a viral video), append a random salt suffix to the partition key: <code>partition_key = video_id + \"_\" + random(0, K-1)</code> where K is the number of sub-partitions. Writes spread evenly across K physical shards. When reading the total count, the application queries all K sub-keys in parallel and sums them.</p>\n\n      <h3>2. Two-Tier In-Memory Caching (L1 Local + L2 Distributed)</h3>\n      <p>For read hotspots (e.g., Taylor Swift's profile or high-volume API configuration), routing all requests to Redis can overwhelm the single Redis node hosting that key. High-performance systems deploy an <strong>in-process L1 cache</strong> (e.g., Guava/Caffeine in JVM or sync.Map in Go) with a short TTL (1-5 seconds) directly inside the API instances. Most reads for the hot key (often 99%+) are served from this in-process memory cache, never touching the network or database.</p>\n\n      <h3>3. Read Replica Fan-out & Read Quorums</h3>\n      <p>In leaderless systems such as Cassandra, hot read keys can be served by increasing the replication factor (N=5) and allowing reads to hit any replica with read consistency level <code>ONE</code>. DynamoDB does not let users set the replication factor, so there the answer is DAX or an application cache.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a viral like counter</h2><p>A DynamoDB partition supports about 1,000 WCU/s (1,000 writes/s of items up to 1 KB) and 3,000 RCU/s. A viral post receives 20,000 likes/s.</p><ul><li><strong>Single key:</strong> 20k writes/s against a 1k/s partition limit means 95% of writes are throttled. Adaptive capacity and split-for-heat help, but cannot split a single item.</li><li><strong>Salted with K = 32:</strong> keys <code>post#123#0</code> to <code>post#123#31</code> receive about 625 writes/s each, which is under the limit.</li><li><strong>Read cost:</strong> the total is 32 GetItems (or one BatchGetItem) per read. Cache the summed total for 1-2 s so reads do not multiply the problem.</li><li><strong>Alternative:</strong> buffer likes in a stream (Kinesis or Kafka) and apply one aggregated increment per post per second. That is 1 write/s instead of 20k.</li></ul><h3>Mitigations compared</h3><table><thead><tr><th>Technique</th><th>Fixes</th><th>Cost</th><th>Example</th></tr></thead><tbody><tr><td>Key salting / write sharding</td><td>Write-hot keys</td><td>Reads fan out K ways</td><td>DynamoDB write sharding, counter shards</td></tr><tr><td>Local in-process cache (1-5 s TTL)</td><td>Read-hot keys</td><td>Staleness; memory per instance</td><td>Caffeine/Guava near-cache in front of Redis</td></tr><tr><td>Request coalescing (single-flight)</td><td>Thundering herd on a miss</td><td>Slight latency for waiters</td><td>Discord data services, Go singleflight</td></tr><tr><td>Write buffering / batching</td><td>High-frequency increments</td><td>Delay before visible</td><td>Stream aggregation, Redis INCR then periodic flush</td></tr><tr><td>Split or move partition</td><td>Hot ranges or tenants</td><td>Data movement</td><td>Bigtable/Spanner load-based splitting, Shopify pod moves</td></tr><tr><td>More replicas for reads</td><td>Read-hot keys</td><td>Replication cost; consistency level ONE</td><td>Cassandra RF, Redis read replicas</td></tr></tbody></table><h3>Detecting hot keys</h3><ul><li>DynamoDB CloudWatch Contributor Insights lists the most-accessed keys.</li><li>Redis: <code>redis-cli --hotkeys</code> (with an LFU eviction policy) or client-side sampling.</li><li>Cassandra: <code>nodetool toppartitions</code>.</li><li>Alert on per-partition p99 latency or throttles, not on cluster averages, which hide the hotspot.</li></ul><h3>Failure modes of the fixes themselves</h3><ul><li><strong>Salting a key that needs strong reads:</strong> summing K sub-keys is not atomic, so a reader may see a total that never existed at any instant. That is fine for likes, wrong for inventory that must never oversell. Use a reservation or queue for those.</li><li><strong>Static K:</strong> choosing K = 32 for every key wastes 32x reads on cold keys. Promote keys to salted mode dynamically once they cross a rate threshold, and record the K in a small metadata item.</li><li><strong>Near-cache stampede:</strong> if every API instance expires its local copy at the same moment, the backend gets N simultaneous misses. Add TTL jitter and single-flight.</li></ul>\n</div>",
    "keyTakeaways": [
      "Hot partitions occur when entity popularity violates uniform distribution assumptions, saturating a single physical shard.",
      "Write hotspots are mitigated by key salting (appending random suffixes) and scatter-gather read aggregation.",
      "Read hotspots are eliminated by local in-process L1 caching (1-5 second TTL) on the application tier."
    ],
    "furtherReading": [
      {
        "title": "AWS DynamoDB Best Practices for Handling Hot Partitions",
        "url": "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html"
      },
      {
        "title": "Discord: How Discord Stores Trillions of Messages",
        "url": "https://discord.com/blog/how-discord-stores-trillions-of-messages"
      }
    ]
  },
  "consistent-hashing": {
    "title": "Consistent hashing",
    "video": {
      "youtubeId": "UF9Iqmg94tk",
      "title": "Consistent Hashing | Algorithms You Should Know #1",
      "channel": "ByteByteGo",
      "why": "The cleanest visual explanation of the ring, why modulo hashing remaps most keys, and how virtual nodes fix skew.",
      "length": "8:04"
    },
    "videos": [
      {
        "youtubeId": "Jvimt56KPnk",
        "title": "Consistent Hashing and Its Implementation From the First Principles",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Builds the ring from scratch, including the sorted-array plus binary-search implementation and node add/remove.",
        "length": "13:55"
      },
      {
        "youtubeId": "vccwdhfqIrI",
        "title": "Consistent Hashing: Easy Explanation for System Design Interviews",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "How and when to invoke consistent hashing in an interview answer.",
        "length": "7:14"
      }
    ],
    "intuition": "<p>Picture a round table with seats numbered around the edge like a clock, and servers sitting at a few seats. Each guest (key) walks clockwise from their own seat number and joins the first server they meet. When a new server sits down, only the guests between it and the previous server move over. Everyone else stays put. With plain <code>hash mod N</code>, adding one server reshuffles nearly every guest.</p><p><strong>Mental model:</strong> hash keys and nodes onto the same circle, and each key belongs to the next node clockwise. Membership changes move about <em>1/N</em> of the keys instead of nearly all of them. Virtual nodes (many points per server) even out the load.</p><ul><li><strong>Forgetting virtual nodes:</strong> with 4 physical points on the ring, one server can easily own 2-3x its fair share.</li><li><strong>Thinking it fixes hot keys:</strong> it balances <em>keys</em>, not <em>traffic</em>. A single hot key still lands on one node.</li><li><strong>Inconsistent membership views:</strong> if clients disagree about who is on the ring, they route the same key to different nodes. Membership must be distributed reliably (gossip, ZooKeeper or etcd, or a config service).</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A cache fleet adds a node without wanting modulo hashing to remap most keys.</p><h2>Mechanics</h2><p>Place keys and weighted virtual nodes on a ring and route each key to its successor. Under uniform assumptions, adding one similarly weighted node moves an expected fraction near 1/(N+1), rather than the large fraction changed by modulo hashing.</p><h2>Failure mode</h2><p>A hot key remains hot, stale membership views route clients differently, and moved keys cause misses until warmed or replicated. Virtual nodes reduce expected skew but do not guarantee a fixed balance.</p><h2>Trade-off</h2><p>Consistent hashing limits topology-change movement and supports weighting, but requires membership distribution, replication, skew monitoring, and careful failure handling.</p>\n<!-- enriched -->\n<h2>Worked example: modulo vs ring when adding a cache node</h2><p>Suppose 10M cached keys sit on 10 nodes, and you add an 11th.</p><ul><li><strong>hash(key) mod N:</strong> a key stays only if <code>h mod 10 == h mod 11</code>, which holds for about 1 in 11 keys. So about 91% of keys (9.1M) move, and the cache hit rate collapses to about 9%. The database behind it absorbs a miss storm.</li><li><strong>Consistent hashing:</strong> the new node takes over about 1/11 of the ring, so about 909k keys (9%) move, and hit rate dips only about 9 points.</li></ul><h3>How many virtual nodes?</h3><p>With V virtual nodes per server, the standard deviation of load is roughly proportional to 1/sqrt(V).</p><table><thead><tr><th>Vnodes per server</th><th>Approximate load spread (max vs mean)</th><th>Ring size for 10 servers</th></tr></thead><tbody><tr><td>1</td><td>Often 2-3x the mean</td><td>10 points</td></tr><tr><td>10</td><td>About 1.3-1.5x</td><td>100 points</td></tr><tr><td>100-256</td><td>About 1.1x</td><td>1,000-2,560 points</td></tr></tbody></table><p>Cassandra historically defaulted to 256 vnodes per node (<code>num_tokens</code>), and 4.0 changed the default to 16 with a smarter token allocator, trading perfect balance for faster repairs and streaming.</p><h3>Lookup implementation</h3><p>Store the vnode positions in a sorted array. To route a key, compute <code>h = hash(key)</code>, binary-search for the first position at or after h, and wrap around to index 0 if past the end. That is O(log(N x V)), microseconds even for thousands of points. For replication, keep walking clockwise to collect the next R <em>distinct physical</em> nodes.</p><div class=\"mermaid\">flowchart LR\nK[\"Key hash 0x7A\"] --> S[\"Binary search sorted ring\"]\nS --> N1[\"First vnode at or after 0x7A: node B\"]\nN1 --> R2[\"Next distinct node: D (replica 2)\"]\nR2 --> R3[\"Next distinct node: A (replica 3)\"]\n</div><h3>Alternatives</h3><ul><li><strong>Rendezvous (HRW) hashing:</strong> score every node with hash(key, node) and pick the highest. Also minimal movement, no ring to maintain, O(N) per lookup.</li><li><strong>Jump consistent hash (Google):</strong> no memory and perfectly balanced, but nodes can only be added or removed at the end. Good for numbered shards.</li><li><strong>Fixed slots:</strong> Redis Cluster uses 16,384 hash slots assigned to nodes, which is simpler and explicit to rebalance.</li><li><strong>Bounded loads (Google, Vimeo):</strong> consistent hashing with a capacity cap per node to limit hot-node overload.</li></ul>\n</div>",
    "keyTakeaways": [
      "Consistent hashing limits expected remapping under topology changes.",
      "Virtual nodes reduce expected skew but do not guarantee balance.",
      "Hot keys, membership drift, and warming still need explicit handling."
    ],
    "furtherReading": [
      {
        "title": "Karger et al.: Consistent Hashing and Random Trees (1997)",
        "url": "https://www.cs.princeton.edu/courses/archive/fall09/cos518/papers/chash.pdf"
      },
      {
        "title": "AWS Dynamo Paper: Consistent Hashing Implementation",
        "url": "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf"
      }
    ]
  },
  "distributed-id-generation": {
    "title": "Distributed ID generation",
    "video": {
      "youtubeId": "W6qURtqrldc",
      "title": "L15: Distributed System Design Example (Unique ID)",
      "channel": "Distributed Systems Course",
      "why": "Chris Colohan reasons through the design space (central counter, range allocation, random IDs, time-based IDs) from first principles instead of jumping to Snowflake.",
      "length": "12:51"
    },
    "videos": [
      {
        "youtubeId": "ogOKDhOa_cs",
        "title": "System Design - Part 12 | Design a Unique ID Generator | 4 Methods",
        "channel": "Nikhil Lohia",
        "role": "interview",
        "why": "Interview-style comparison of multi-master increments, UUID, ticket server and Snowflake.",
        "length": "20:52"
      }
    ],
    "intuition": "<p>Imagine several ticket booths at a stadium that must never print the same ticket number and cannot phone each other for every sale. Options: each booth gets its own prefix (booth 3 prints 3-0001, 3-0002, ...), each booth grabs a roll of 1,000 numbers from the office at a time, or each booth prints a timestamp plus its booth number plus a counter.</p><p><strong>Mental model:</strong> uniqueness comes from <em>partitioning the ID space</em>, by node ID, by leased range, or by sheer randomness, so generation needs no per-ID coordination. Then pick for the properties you need: size, sortability, and what the ID leaks.</p><ul><li><strong>Assuming time-ordered means strictly ordered:</strong> Snowflake-style IDs from different machines are only roughly ordered (k-sorted), within clock skew.</li><li><strong>Leaking business data:</strong> sequential IDs reveal volume, and Snowflake IDs reveal creation time. Expose opaque public IDs if that matters.</li><li><strong>Random UUIDs as a clustered primary key:</strong> UUIDv4 in InnoDB scatters inserts across the whole B-tree. Prefer UUIDv7 or Snowflake.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Distributed Identifier Challenge</h2>\n      <p>In a single-instance relational database, generating unique primary keys is trivial via auto-incrementing sequences (e.g., PostgreSQL <code>BIGSERIAL</code> or MySQL <code>AUTO_INCREMENT</code>). However, in horizontally partitioned distributed architectures, generating unique IDs across dozens of database shards introduces severe architectural bottlenecks:</p>\n      <ul>\n        <li><strong>Single Point of Failure (SPOF):</strong> A centralized database generating auto-increments creates a throughput ceiling and a single point of failure.</li>\n        <li><strong>Information Leakage:</strong> Monotonically incrementing sequential IDs (1, 2, 3...) expose sensitive business intelligence (competitors can monitor order ID changes to calculate daily revenue). Time-ordered IDs such as Snowflake and UUIDv7 also leak each record's creation timestamp.</li>\n        <li><strong>Cross-Shard Uniqueness:</strong> When independent database shards insert records concurrently without central coordination, duplicate IDs will corrupt data.</li>\n      </ul>\n\n      <h2>Core Approaches to Distributed ID Generation</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Req[\"ID Generation Request\"] --> Approach{\"Architecture Choice\"}\n    Approach -->|\"Random 128-Bit\"| UUID[\"UUID v4: No Coordination, High Index Fragmentation\"]\n    Approach -->|\"Central Ticket Service\"| Ticket[\"Flickr Ticket Servers: Central DB, one ID per REPLACE INTO round trip\"]\n    Approach -->|\"Timed 64-Bit, coordination only for worker IDs\"| Snowflake[\"Twitter Snowflake: 64-Bit Time-Ordered (ULID and UUIDv7 are 128-bit)\"]\n    \n    Snowflake --> BitLayout[\"Bitwise Layout: 41-bit Time + 10-bit Node + 12-bit Sequence\"]\n      </div>\n\n      <h2>Detailed Trade-offs of Generation Patterns</h2>\n      <h3>1. Multi-Master Increment with Offsets (MySQL Pattern)</h3>\n      <p>If you have k database instances, instance 1 generates 1, 1+k, 1+2k, instance 2 generates 2, 2+k, 2+2k, etc. While simple, this does not scale dynamically when adding servers, nor does it guarantee time-ordering.</p>\n\n      <h3>2. UUIDv4 (Universally Unique Identifier)</h3>\n      <p>Generates 128-bit pseudo-random values. Generation requires zero network coordination (O(1) locally). However, UUIDv4 values are completely random, causing severe <strong>B-Tree Index Page Splitting</strong> and high storage overhead (16 bytes vs 8 bytes for <code>BIGINT</code>).</p>\n\n      <h3>3. Time-Sorted 64-Bit IDs (Twitter Snowflake)</h3>\n      <p>Encodes millisecond timestamps, physical node identifiers, and in-millisecond sequence numbers into a single 64-bit integer. It fits directly into standard <code>BIGINT</code> fields, requires zero network coordination during generation, and sorts naturally in B-Tree indexes.</p>\n    </div>",
    "keyTakeaways": [
      "Auto-incrementing database sequences create bottlenecks and leak business metrics.",
      "UUIDv4 allows decentralized generation but ruins B-tree index locality due to random page splitting.",
      "Snowflake-style 64-bit time-sorted IDs provide optimal performance, B-tree locality, and 4M+ IDs/sec per node."
    ],
    "furtherReading": [
      {
        "title": "Twitter Engineering: Announcing Snowflake",
        "url": "https://blog.twitter.com/engineering/en_us/a/2010/announcing-snowflake"
      },
      {
        "title": "Flickr Ticket Servers: Distributed Primary Keys",
        "url": "https://code.flickr.net/2010/02/08/ticket-servers-distributed-unique-primary-keys-on-the-cheap/"
      }
    ]
  },
  "uuid-objectid-and-snowflake": {
    "title": "UUID, ObjectId, and Snowflake",
    "video": {
      "youtubeId": "OAOQ7U0XAi0",
      "title": "The effect of Random UUID on database performance",
      "channel": "Hussein Nasser",
      "why": "Explains, at the page and buffer-pool level, why random 128-bit keys hurt B-tree inserts and what time-ordered IDs fix: the core trade-off in this unit's comparison table.",
      "length": "18:51"
    },
    "videos": [
      {
        "youtubeId": "f53-Iw_5ucA",
        "title": "How Shopify’s engineering improved database writes by 50% with ULID",
        "channel": "Hussein Nasser",
        "role": "case-study",
        "why": "Real production case where switching to time-ordered ULIDs cut write cost dramatically.",
        "length": "31:23"
      },
      {
        "youtubeId": "aLYKd7h7vgY",
        "title": "How Snowflake IDs work",
        "channel": "loops",
        "role": "intro",
        "why": "Three-minute visual of the Snowflake bit layout.",
        "length": "3:05"
      }
    ],
    "intuition": "<p>Think of three ways to label boxes in a warehouse. <strong>UUIDv4</strong> is a random lottery number: never collides, but boxes get shelved all over the building, so every new box needs a walk to a random aisle. <strong>ObjectId, UUIDv7 and Snowflake</strong> start the label with the date and time, so new boxes always go at the end of the newest aisle, which is fast and tidy. The difference between them is mostly label length and how much of it is clock versus machine versus counter.</p><p><strong>Mental model:</strong> choose an ID by <em>size</em> (8, 12 or 16 bytes), <em>sort order</em> (random vs time-first), and <em>coordination</em> (none vs needing a unique worker ID).</p><ul><li><strong>Storing UUIDs as text:</strong> a 36-character string is 36+ bytes versus 16 as a native <code>uuid</code> or <code>BINARY(16)</code>, and every secondary index in InnoDB copies it.</li><li><strong>JavaScript and 64-bit IDs:</strong> JSON numbers above 2^53 lose precision in JS, which is why Twitter and Discord APIs return Snowflakes as strings.</li><li><strong>Parsing timestamps out of IDs for business logic:</strong> fine for debugging, but it couples you to the ID format forever.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Byte-Level Anatomical Breakdown of Distributed IDs</h2>\n      <p>Comparing distributed identifier standards requires examining their exact binary memory footprints and bitwise layout:</p>\n\n      <h3>1. UUID Family (RFC 9562, which obsoletes RFC 4122) — 128 Bits (16 Bytes)</h3>\n      <ul>\n        <li><strong>UUIDv4:</strong> 122 random bits (RFC 9562 recommends a CSPRNG, but actual quality depends on the implementation), 4 bits of version (<code>0100</code>), and 2 bits of variant (<code>10</code>). Total combinations: 2<sup>122</sup> ≈ 5.3 × 10<sup>36</sup>. Collision probability is negligible, but randomness creates chaotic memory layouts.</li>\n        <li><strong>UUIDv7 (Modern Standard):</strong> Solves UUIDv4's B-Tree problem by encoding a 48-bit Unix millisecond timestamp at the highest-order bits, followed by version and 74 random bits. Highly index-friendly while maintaining 128-bit global uniqueness.</li>\n      </ul>\n\n      <h3>2. MongoDB ObjectId — 96 Bits (12 Bytes)</h3>\n      <p>Consists of 12 bytes formatted as 24 hexadecimal characters:</p>\n      <ul>\n        <li><strong>4 Bytes:</strong> Unix timestamp in seconds.</li>\n        <li><strong>5 Bytes:</strong> Process unique value (generated once per machine/process).</li>\n        <li><strong>3 Bytes:</strong> Monotonically incrementing counter initialized to a random value.</li>\n      </ul>\n\n      <h3>3. Twitter Snowflake — 64 Bits (8 Bytes)</h3>\n      <div class=\"mermaid\">\nflowchart LR\n    S1[\"1 Bit: Sign (Always 0)\"] --- S2[\"41 Bits: Millisecond Timestamp (69 Years)\"]\n    S2 --- S3[\"10 Bits: Machine / Datacenter ID (1,024 Nodes)\"]\n    S3 --- S4[\"12 Bits: Sequence Counter (4,096 IDs/ms)\"]\n      </div>\n\n      <h2>Bitwise Memory & Index Performance Comparison</h2>\n      <table>\n        <thead>\n          <tr><th>Identifier</th><th>Size (Bytes)</th><th>B-Tree Locality</th><th>Time Sortable?</th><th>Throughput per Node</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>UUIDv4</strong></td><td>16 bytes (128 bits)</td><td>Poor (random inserts; worst for clustered indexes such as InnoDB and SQL Server, milder for PostgreSQL heap tables where only the index suffers)</td><td>No</td><td>Practically unlimited (local PRNG)</td></tr>\n          <tr><td><strong>UUIDv7</strong></td><td>16 bytes (128 bits)</td><td>Excellent (append-only)</td><td>Yes (millisecond)</td><td>Practically unlimited</td></tr>\n          <tr><td><strong>ObjectId</strong></td><td>12 bytes (96 bits)</td><td>Good</td><td>Yes (second)</td><td>16.7M IDs / sec per process (2<sup>24</sup> counter)</td></tr>\n          <tr><td><strong>Snowflake</strong></td><td>8 bytes (64 bits)</td><td>Optimal (fits in <code>BIGINT</code>)</td><td>Yes (millisecond)</td><td>4,096,000 IDs / sec</td></tr>\n        </tbody>\n      </table>\n    </div>",
    "keyTakeaways": [
      "UUIDv4 wastes storage (16 bytes) and causes random B-tree page splits; UUIDv7 solves this with a 48-bit timestamp prefix.",
      "MongoDB ObjectId packs 12 bytes: 4s timestamp + 5-byte process unique + 3-byte counter.",
      "Snowflake IDs fit into standard 64-bit integers, providing natural chronological sorting and high memory compactness."
    ],
    "furtherReading": [
      {
        "title": "IETF RFC 9562: New UUID Formats (UUIDv6, UUIDv7, UUIDv8)",
        "url": "https://datatracker.ietf.org/doc/rfc9562/"
      },
      {
        "title": "MongoDB ObjectId Specification",
        "url": "https://www.mongodb.com/docs/manual/reference/method/ObjectId/"
      }
    ]
  },
  "snowflake-id-design": {
    "title": "Snowflake ID design",
    "video": {
      "youtubeId": "ogOKDhOa_cs",
      "title": "System Design - Part 12 | Design a Unique ID Generator | 4 Methods",
      "channel": "Nikhil Lohia",
      "why": "Builds up to the Snowflake layout and explains the timestamp, datacenter/worker and sequence fields and their limits in a design-interview flow; no better-produced dedicated Snowflake video was found.",
      "length": "20:52"
    },
    "videos": [
      {
        "youtubeId": "aLYKd7h7vgY",
        "title": "How Snowflake IDs work",
        "channel": "loops",
        "role": "intro",
        "why": "Three-minute animation of the 64-bit layout.",
        "length": "3:05"
      },
      {
        "youtubeId": "mAyW-4LeXZo",
        "title": "Distributed Systems 3.2: Clock synchronisation",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "Explains NTP slewing and stepping, and why clocks can jump backwards: the root cause of Snowflake's main failure mode.",
        "length": "15:58"
      }
    ],
    "intuition": "<p>A Snowflake ID is like a receipt number printed as <em>date-time + till number + receipt count within that second</em>. Two tills can never print the same number because their till numbers differ, and one till never repeats because the count resets only when the clock moves forward. It all works as long as each till has a unique number and its clock never runs backwards.</p><p><strong>Mental model:</strong> <code>id = (ms_since_epoch &lt;&lt; 22) | (worker_id &lt;&lt; 12) | sequence</code>. Uniqueness depends on two invariants: <em>worker IDs are never shared concurrently</em>, and <em>each worker's timestamp never goes backwards</em>.</p><ul><li><strong>Deriving worker ID from hostname or IP hash:</strong> collisions are likely with 1,024 slots. Lease IDs from ZooKeeper, etcd or a database with a TTL.</li><li><strong>Ignoring clock rollback:</strong> NTP can step the clock back, and VM migration can resume with an old clock. The generator must detect <code>now &lt; last_ts</code>.</li><li><strong>Default epoch:</strong> using the Unix epoch wastes about 55 years of the 69-year range. Use a custom recent epoch (Twitter's is in 2010, Discord's 2015).</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>Several workers generate sortable IDs concurrently, then one virtual machine resumes with an older clock and a reused worker ID.</p><h2>Mechanics</h2><p>Pack a custom-epoch timestamp, unique worker ID, and per-tick sequence into an integer. Concurrent callers need an atomic counter, lock, or single-threaded owner; worker IDs need leases or durable assignment. On rollback, wait with a bound, change an epoch/worker component, or fail safely according to the contract.</p><h2>Failure mode</h2><p>Clock rollback plus worker-ID reuse can duplicate IDs. Sequence exhaustion blocks until a later tick, and restarting without preserving assignment can overlap another generator.</p><h2>Trade-off</h2><p>Snowflake-style IDs are compact and roughly time ordered, but depend on clock and worker management. UUIDv4 avoids those dependencies; UUIDv7 offers time locality with a larger representation.</p>\n<!-- enriched -->\n<h2>Worked example: the numbers behind the 64 bits</h2><table><thead><tr><th>Field</th><th>Bits</th><th>Capacity</th><th>Design note</th></tr></thead><tbody><tr><td>Sign</td><td>1</td><td>Always 0</td><td>Keeps IDs positive in signed BIGINT and Java long</td></tr><tr><td>Timestamp (ms since custom epoch)</td><td>41</td><td>2^41 ms, about 69.7 years</td><td>Twitter epoch 1288834974657 (Nov 2010)</td></tr><tr><td>Worker ID (datacenter 5 + machine 5)</td><td>10</td><td>1,024 generators</td><td>Must be unique among live generators</td></tr><tr><td>Sequence</td><td>12</td><td>4,096 per ms per worker</td><td>Resets each millisecond</td></tr></tbody></table><p><strong>Throughput:</strong> 4,096 per ms is 4.096M IDs/s per worker, and 1,024 workers give about 4.2B IDs/s cluster-wide. If a worker exhausts 4,096 in one millisecond, it spins until the next millisecond.</p><p><strong>Tuning the split:</strong> if you only ever need 64 workers but bursts of 50k IDs/ms, use 6 worker bits and 16 sequence bits. Sonyflake uses 39 bits of 10 ms units (about 174 years), 8-bit sequence and 16-bit machine ID, trading per-ms throughput for lifespan and more machines. Instagram uses 41 bits of time, 13 bits of logical shard ID and 10 bits of per-shard sequence, generated inside Postgres.</p><h3>Generator logic</h3><div class=\"mermaid\">flowchart TD\nA[\"next_id called\"] --> B[\"now = current ms\"]\nB --> C{\"now less than last_ts?\"}\nC -->|\"Yes, small gap\"| D[\"Wait until now reaches last_ts\"]\nC -->|\"Yes, large gap\"| E[\"Refuse: raise error and alert\"]\nC -->|\"No\"| F{\"now equals last_ts?\"}\nF -->|\"Yes\"| G[\"seq = seq + 1\"]\nG --> H{\"seq overflow?\"}\nH -->|\"Yes\"| I[\"Spin to next ms, seq = 0\"]\nH -->|\"No\"| J[\"Compose id\"]\nF -->|\"No\"| K[\"seq = 0\"]\nK --> J\nD --> B\nI --> J\nJ --> L[\"last_ts = now, return id\"]\n</div><h3>Failure modes and defences</h3><ul><li><strong>Clock rollback:</strong> keep <code>last_ts</code> in memory, wait out small regressions (a few ms), and refuse on large ones. Persisting a high-water mark periodically (for example, every second) defends against restarts with a bad clock. Configure NTP (chrony) to slew rather than step.</li><li><strong>Worker ID reuse:</strong> two processes with the same worker ID in the same ms will collide. Use leases with fencing: a process that loses its lease must stop issuing IDs before the lease can be reassigned.</li><li><strong>Multi-threading:</strong> the (last_ts, seq) pair must update atomically, using a mutex or a CAS on a packed 64-bit state.</li><li><strong>Ordering is only k-sorted:</strong> IDs from different workers interleave within clock skew, so do not use them for strict global ordering.</li></ul>\n</div>",
    "keyTakeaways": [
      "Snowflake IDs require unique worker assignment and synchronized sequence generation.",
      "Clock rollback and worker reuse can cause collisions.",
      "Compact ordering comes with clock and lifecycle dependencies."
    ],
    "furtherReading": [
      {
        "title": "Twitter Snowflake Open Source Repository",
        "url": "https://github.com/twitter-archive/snowflake"
      },
      {
        "title": "BWMarrin: Snowflake ID Implementation in Go",
        "url": "https://github.com/bwmarrin/snowflake"
      }
    ]
  },
  "clock-skew-and-id-ordering": {
    "title": "Clock skew and ID ordering",
    "video": {
      "youtubeId": "FQ_2N3AQu0M",
      "title": "Distributed Systems 3.1: Physical time",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's Cambridge lecture on quartz drift, UTC, leap seconds and why physical timestamps cannot order events; rigorous and very clear.",
      "length": "20:48"
    },
    "videos": [
      {
        "youtubeId": "x-D8iFU1d-o",
        "title": "Distributed Systems 4.1: Logical time",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "Lamport and vector clocks, with the happens-before proofs this lesson sketches.",
        "length": "24:02"
      },
      {
        "youtubeId": "oeycOVX70aE",
        "title": "Distributed Systems 8.2: Google's Spanner",
        "channel": "Martin Kleppmann",
        "role": "case-study",
        "why": "How TrueTime's uncertainty interval and commit-wait give externally consistent timestamps.",
        "length": "18:41"
      }
    ],
    "intuition": "<p>Imagine two people in different cities each writing the time on letters using their own wristwatches. One watch runs a few seconds fast. A reply can end up stamped <em>earlier</em> than the letter it answers, so sorting letters by their stamps tells a false story. Logical clocks fix this by writing \"this is my reply to letter #7\" on each letter, so the order comes from cause and effect, not wristwatches.</p><p><strong>Mental model:</strong> physical timestamps are <em>approximately</em> right and can disagree across machines by milliseconds or more, and can even jump backwards. If correctness depends on order, use causality (Lamport or vector clocks, hybrid logical clocks) or bounded uncertainty (TrueTime), not raw wall-clock time.</p><ul><li><strong>Last-write-wins by wall clock:</strong> a node with a fast clock silently wins every conflict, and a correct later write can be discarded.</li><li><strong>Measuring durations with wall time:</strong> use a monotonic clock for timeouts and latency. The wall clock can step.</li><li><strong>Assuming Lamport order equals causality:</strong> L(a) &lt; L(b) does <em>not</em> imply a happened before b. Only vector clocks can detect concurrency.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Why Physical Clocks Lie in Distributed Systems</h2>\n      <p>Modern computers track physical time using quartz crystal oscillators. Due to temperature fluctuations and voltage noise, quartz crystals drift—commodity oscillators are typically specified at about 10-50 ppm, roughly 1-4 seconds per day if left unsynchronized. Distributed clusters synchronize physical time using <strong>NTP (Network Time Protocol)</strong>. However, because network packets experience asymmetric network delay, NTP synchronization itself carries residual error: from under a millisecond on a well-run datacenter LAN (for example with chrony) to tens of milliseconds or more over the internet. PTP with hardware timestamping reaches microseconds.</p>\n      \n      <p>Consequently, <strong>physical wall clocks cannot guarantee causality in distributed systems</strong>. If Node A writes record X at physical time t<sub>1</sub>, and sends a message to Node B who writes record Y at physical time t<sub>2</sub>, clock skew can cause t<sub>2</sub> &lt; t<sub>1</sub>. Relying on physical timestamps for Last-Write-Wins (LWW) silently corrupts data.</p>\n\n      <h2>Google Spanner's TrueTime API: Bounding Uncertainty</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    GPS[\"GPS Master Receivers in Datacenter\"] --> TT[\"TrueTime API: tt.now()\"]\n    Atomic[\"Atomic Clocks - very low drift, independent failure modes from GPS\"] --> TT\n    TT --> Window[\"Time interval earliest..latest with uncertainty ε of a few ms\"]\n    Window --> CommitWait[\"Commit Wait: Hold Transaction until latest &lt; commit_timestamp\"]\n    CommitWait --> GuaranteedOrder[\"Strict Serializability Across Continents Guaranteed\"]\n      </div>\n\n      <h2>Under the Hood: Lamport Timestamps & Vector Clocks</h2>\n      <h3>1. Lamport Timestamps (Causal Ordering)</h3>\n      <p>Each process maintains a single integer counter L. When an event occurs locally, L = L + 1. When sending a message, the process attaches L. When a process receives a message with timestamp L<sub>msg</sub>, it sets its local counter: L = max(L, L<sub>msg</sub>) + 1. If event A caused event B, then L(A) &lt; L(B). However, identical Lamport timestamps do not tell us whether events were concurrent.</p>\n\n      <h3>2. Vector Clocks (Detecting Concurrency & Conflicts)</h3>\n      <p>In a cluster of N nodes, every node maintains a vector of N integers: V = [v<sub>1</sub>, v<sub>2</sub>, …, v<sub>N</sub>]. When node i mutates state, it increments V[i]. When comparing two versions V<sub>A</sub> and V<sub>B</sub>:</p>\n      <ul>\n        <li>If every element of V<sub>A</sub> ≤ V<sub>B</sub> and at least one is &lt;, then V<sub>A</sub> causally preceded V<sub>B</sub>.</li>\n        <li>If V<sub>A</sub> has components greater than V<sub>B</sub> and vice versa, the updates are <strong>concurrent conflicts</strong> that must be resolved via application merging (Dynamo sibling reconciliation).</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: how big is skew, really?</h2><ul><li><strong>Quartz drift:</strong> typical server oscillators are specified at about 10-50 ppm. 20 ppm is 1.7 seconds per day of drift if left unsynchronized, so clocks <em>must</em> be disciplined continuously.</li><li><strong>NTP over the internet:</strong> tens of ms of error is typical. <strong>Within a datacenter</strong> with chrony: often under 1 ms. <strong>PTP with hardware timestamping</strong> (AWS Time Sync, Meta's PTP rollout): microseconds.</li><li><strong>Spanner TrueTime:</strong> the uncertainty epsilon sawtooths between about 1 and 7 ms (average about 4 ms in the 2012 paper). Commit-wait therefore adds a few ms per write.</li></ul><h3>Lamport timestamps step by step</h3><table><thead><tr><th>Event</th><th>Node A clock</th><th>Node B clock</th></tr></thead><tbody><tr><td>A local write</td><td>1</td><td>0</td></tr><tr><td>A sends message (carries 1)</td><td>2</td><td>0</td></tr><tr><td>B local write</td><td>2</td><td>1</td></tr><tr><td>B receives message: max(1, 2) + 1</td><td>2</td><td>3</td></tr><tr><td>B writes reply</td><td>2</td><td>4</td></tr></tbody></table><p>The reply (4) is guaranteed to sort after the original send (2), whatever the wall clocks say. Ties are broken by node ID to produce a total order.</p><h3>Choosing an ordering tool</h3><table><thead><tr><th>Tool</th><th>Size</th><th>Gives you</th><th>Used by</th></tr></thead><tbody><tr><td>Wall clock / Snowflake</td><td>64 bits</td><td>Rough order, human-readable time</td><td>Twitter, Discord IDs</td></tr><tr><td>Lamport clock</td><td>One integer</td><td>Total order consistent with causality</td><td>Consensus logs, simple replication</td></tr><tr><td>Vector clock</td><td>One counter per node</td><td>Detects concurrent (conflicting) writes</td><td>Dynamo, Riak (dotted version vectors)</td></tr><tr><td>Hybrid logical clock</td><td>64 bits (physical + logical)</td><td>Close to wall time and causally consistent</td><td>CockroachDB, YugabyteDB, MongoDB cluster time</td></tr><tr><td>TrueTime</td><td>Interval</td><td>External consistency (real-time order)</td><td>Google Spanner</td></tr></tbody></table><h3>Failure modes</h3><ul><li><strong>Leap seconds and NTP steps:</strong> historical outages (2012 Linux leap-second bug). Use leap smearing (Google, AWS).</li><li><strong>VM pause or live migration:</strong> a process can resume seconds later without noticing. Leases based on local time must account for this, which is the motivation for fencing tokens.</li><li><strong>Cassandra LWW:</strong> writes carry client or coordinator timestamps, so a skewed client can make a delete lose to an older write or vice versa.</li></ul>\n</div>",
    "keyTakeaways": [
      "Physical wall clocks experience drift and NTP network latency, making physical timestamps unsafe for distributed causality.",
      "Google Spanner uses GPS and atomic clocks to bound uncertainty (ε typically 1-7 ms) and enforces commit waits.",
      "Vector clocks track causality across distributed nodes, exposing concurrent write conflicts for explicit reconciliation."
    ],
    "furtherReading": [
      {
        "title": "Leslie Lamport: Time, Clocks, and the Ordering of Events in a Distributed System (1978)",
        "url": "https://lamport.azurewebsites.net/pubs/time-clocks.pdf"
      },
      {
        "title": "Google Spanner: TrueTime and External Consistency",
        "url": "https://research.google/pubs/spanner-googles-globally-distributed-database/"
      }
    ]
  },
  "keyset-pagination": {
    "title": "Keyset pagination",
    "video": {
      "youtubeId": "zwDIN04lIpc",
      "title": "Pagination in MySQL - offset vs. cursor",
      "channel": "PlanetScale",
      "why": "Aaron Francis demonstrates with real queries why OFFSET degrades with depth and how cursor/keyset pagination with a tie-breaker fixes it, including the multi-column WHERE.",
      "length": "13:20"
    },
    "videos": [
      {
        "youtubeId": "14K_a2kKTxU",
        "title": "API Pagination: Making Billions of Products Scrolling Possible",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Three-minute overview of offset vs cursor pagination at the API level.",
        "length": "3:12"
      }
    ],
    "intuition": "<p>Offset pagination is reading page 500 of a book by counting pages from the front every time. Keyset pagination is using a bookmark: \"continue after the last line I read\". Counting gets slower the deeper you go, while a bookmark takes you straight there, and it does not get confused if someone inserts new pages at the front.</p><p><strong>Mental model:</strong> instead of <code>OFFSET n</code>, remember the sort key of the last row you returned and ask for rows <em>after</em> it: <code>WHERE (created_at, id) &lt; (last_created_at, last_id) ORDER BY created_at DESC, id DESC LIMIT 20</code>. With a matching index, each page costs one index seek plus 20 rows, at any depth.</p><ul><li><strong>No tie-breaker:</strong> sorting by <code>created_at</code> alone skips or duplicates rows that share a timestamp. Always append a unique column such as <code>id</code>.</li><li><strong>Expanding the row comparison wrong:</strong> <code>created_at &lt;= X AND id &lt; Y</code> is not equivalent to the tuple comparison. Use row-value syntax or the full OR expansion.</li><li><strong>Exposing raw cursors:</strong> encode the cursor opaquely (base64 JSON, possibly signed) so clients cannot craft or depend on it.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>An orders API must browse deep pages while new orders arrive.</p><h2>Mechanics</h2><p>Use a unique deterministic order such as (created_at,id) and encode the last tuple in an opaque cursor. The index seek costs roughly O(log N) plus the page scan; work is largely independent of page depth, not literally constant.</p><h2>Failure mode</h2><p>Updating a sort key or deleting unseen rows changes later results, and a cursor without all tie-breakers can skip or duplicate records. Arbitrary page-number jumps are not directly available.</p><h2>Trade-off</h2><p>Keyset pagination gives stable deep-page performance and handles inserts ahead of the cursor well. Offset pagination is simpler for small data and random page jumps but scans and discards deeper prefixes.</p>\n<!-- enriched -->\n<h2>Worked example: page 5,000 of an orders feed</h2><p>Consider a table of 100M orders with 20 rows per page.</p><ul><li><strong>OFFSET:</strong> <code>ORDER BY created_at DESC LIMIT 20 OFFSET 100000</code> must walk and discard 100,000 index entries (and often fetch their heap rows) to return 20. Page 1 takes about 1 ms and page 5,000 might take 100-300 ms. A crawler walking every page does O(n^2) total work.</li><li><strong>Keyset:</strong> <code>WHERE (created_at, id) &lt; ('2026-09-01 10:00:00', 98231) ORDER BY created_at DESC, id DESC LIMIT 20</code> with index <code>(created_at DESC, id DESC)</code> seeks directly. That is about 1 ms at any depth.</li></ul><h3>Portable form (when row-value comparison is not indexed)</h3><p><code>WHERE created_at &lt; :ts OR (created_at = :ts AND id &lt; :id)</code></p><p>PostgreSQL uses the index for the row-value form <code>(a, b) &lt; (x, y)</code> directly. MySQL historically optimized it poorly, so the OR form is safer there.</p><h3>Comparison</h3><table><thead><tr><th>Aspect</th><th>Offset</th><th>Keyset (cursor)</th></tr></thead><tbody><tr><td>Cost of page k</td><td>O(k x pagesize)</td><td>O(log N + pagesize)</td></tr><tr><td>Jump to page 57</td><td>Yes</td><td>No (only next/previous, or from a known key)</td></tr><tr><td>Total count and page numbers</td><td>Easy (but COUNT(*) is itself expensive)</td><td>Usually omitted</td></tr><tr><td>Inserts during browsing</td><td>Rows shift, causing duplicates or skips</td><td>Stable: new rows ahead of the cursor do not affect later pages</td></tr><tr><td>Sort by arbitrary column</td><td>Any</td><td>Needs a matching index plus a unique tie-breaker</td></tr><tr><td>Sharded data</td><td>Very expensive (each shard returns offset + limit rows)</td><td>Each shard seeks, then merge top-k</td></tr></tbody></table><h3>Cursor design</h3><ul><li>Encode <code>{\"ts\": \"2026-09-01T10:00:00Z\", \"id\": 98231, \"dir\": \"next\"}</code> as base64url and optionally sign it with an HMAC.</li><li>Include the sort and filter parameters in the cursor, or reject a cursor used with different filters.</li><li>Return <code>next_cursor: null</code> when fewer than <code>limit</code> rows come back.</li></ul><p><strong>Who uses it:</strong> the Stripe API (<code>starting_after</code>), the Slack API (<code>next_cursor</code>), GitHub GraphQL (Relay connection cursors), and Twitter/X timelines (<code>max_id</code> and <code>since_id</code>, where Snowflake IDs double as cursors).</p>\n</div>",
    "keyTakeaways": [
      "Keyset seeks cost roughly O(log N) plus page scanning.",
      "A complete unique sort key prevents tie-related skips.",
      "Updates and deletions can still change subsequent pages."
    ],
    "furtherReading": [
      {
        "title": "Markus Winand: Use The Index, Luke! (No Offset)",
        "url": "https://use-the-index-luke.com/sql/partial-results/fetch-next-page"
      },
      {
        "title": "Slack Engineering: Evolving API Pagination at Slack",
        "url": "https://slack.engineering/evolving-api-pagination-at-slack/"
      }
    ]
  },
  "bloom-filters": {
    "title": "Bloom filters",
    "video": {
      "youtubeId": "kfFacplFY4Y",
      "title": "What Are Bloom Filters?",
      "channel": "Spanning Tree",
      "why": "Animated build-up of the bit array and k hashes, with an intuitive derivation of why false positives happen and false negatives cannot. Clearer than any other short treatment.",
      "length": "6:03"
    },
    "videos": [
      {
        "youtubeId": "V3pzxngeLqw",
        "title": "Bloom Filters | Algorithms You Should Know #2 | Real-world Examples",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Short tour of real uses: LSM engines, CDNs and malicious-URL checks.",
        "length": "5:40"
      },
      {
        "youtubeId": "IgyU0iFIoqM",
        "title": "Data Structures for Big Data in Interviews - Bloom Filters, Count-Min Sketch, HyperLogLog",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "When to reach for a Bloom filter (and its sibling sketches) in a design interview.",
        "length": "25:51"
      }
    ],
    "intuition": "<p>A Bloom filter is a nightclub bouncer with a bad memory for faces but a perfect memory for traits. For each guest on the list, the bouncer ticks boxes: \"tall\", \"red jacket\", \"glasses\". When someone arrives, if <em>any</em> of their traits is unticked, they are definitely not on the list. If all are ticked, they <em>might</em> be. Check the real list to be sure.</p><p><strong>Mental model:</strong> <em>\"definitely not\" or \"probably yes\"</em>. A tiny bit array and k hash functions let you skip expensive lookups for things that do not exist, at a tunable false-positive rate and about 10 bits per item for 1%.</p><ul><li><strong>Deleting by clearing bits:</strong> a bit may be shared with other items, so clearing it creates false negatives. Use a counting Bloom filter or a cuckoo filter, or rebuild.</li><li><strong>Undersizing:</strong> the false-positive rate climbs steeply once you exceed the planned item count. Size for peak, not today.</li><li><strong>Using it for presence:</strong> \"all bits set\" never proves the item exists, so always confirm against the source.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>An LSM engine wants to avoid disk reads for keys absent from each immutable table.</p><h2>Mechanics</h2><p>A Bloom filter sets k hash-selected bits in an m-bit array. If any queried bit is unset, a correctly constructed and current append-only filter proves the key was not inserted; if all are set, the answer may be a false positive. Size m and k from expected items and target false-positive rate.</p><h2>Failure mode</h2><p>Deleting bits from a standard filter can create false negatives. An undersized or stale filter raises error rates, so mutable sets need rebuilds, counting filters, or another design.</p><h2>Trade-off</h2><p>Bloom filters save memory and negative lookup I/O but cannot return values or prove presence. Lower false-positive rates consume more memory and hash work.</p>\n<!-- enriched -->\n<h2>Worked example: sizing a filter</h2><p>For n items and a target false-positive rate p:</p><ul><li>Bits needed: <code>m = -n x ln(p) / (ln 2)^2</code>, about <code>9.6 x n</code> bits for p = 1%.</li><li>Best number of hash functions: <code>k = (m / n) x ln 2</code>, about 7 for p = 1%.</li></ul><table><thead><tr><th>Target FP rate</th><th>Bits per item</th><th>Hash functions k</th><th>Memory for 100M items</th></tr></thead><tbody><tr><td>10%</td><td>4.8</td><td>3</td><td>about 60 MB</td></tr><tr><td>1%</td><td>9.6</td><td>7</td><td>about 120 MB</td></tr><tr><td>0.1%</td><td>14.4</td><td>10</td><td>about 180 MB</td></tr><tr><td>0.01%</td><td>19.2</td><td>13</td><td>about 240 MB</td></tr></tbody></table><p>Each 10x reduction in false positives costs only about 4.8 more bits per item. Compare that with storing the 100M keys themselves (for example 16-byte IDs, about 1.6 GB).</p><h3>Worked example: LSM read path</h3><p>A RocksDB/Cassandra key lookup may need to check 10 SSTables. Without filters, a miss costs up to 10 disk reads. With a 1% filter per SSTable, the expected wasted reads for a missing key are 10 x 0.01 = 0.1, a 100x reduction. RocksDB's default configuration uses about 10 bits per key, and Cassandra's <code>bloom_filter_fp_chance</code> defaults to 0.01 (0.1 for LeveledCompaction).</p><div class=\"mermaid\">flowchart TD\nQ[\"get key\"] --> M[\"Memtable\"]\nM -->|\"miss\"| F1{\"SSTable 1 Bloom filter\"}\nF1 -->|\"definitely not\"| F2{\"SSTable 2 Bloom filter\"}\nF1 -->|\"maybe\"| R1[\"Read SSTable 1 index and block\"]\nF2 -->|\"definitely not\"| F3[\"... next SSTable\"]\nF2 -->|\"maybe\"| R2[\"Read SSTable 2 index and block\"]\n</div><h3>Variants</h3><table><thead><tr><th>Variant</th><th>Adds</th><th>Cost</th></tr></thead><tbody><tr><td>Counting Bloom filter</td><td>Deletes (4-bit counters)</td><td>About 4x memory</td></tr><tr><td>Cuckoo filter</td><td>Deletes, better space below about 3% FP</td><td>Inserts can fail when nearly full</td></tr><tr><td>Scalable Bloom filter</td><td>Growth without knowing n up front</td><td>Chain of filters, slightly slower lookups</td></tr><tr><td>Blocked Bloom filter</td><td>One cache line per lookup (fast)</td><td>Slightly higher FP rate at the same size</td></tr><tr><td>Xor / ribbon filters</td><td>About 20-30% less space, static sets</td><td>Must be built all at once</td></tr></tbody></table><p><strong>Real uses:</strong> LSM engines (RocksDB, Cassandra, HBase, LevelDB), Chrome's old Safe Browsing malicious-URL prefilter, Akamai's \"one-hit-wonder\" cache admission (only cache on the second request), and Medium's \"already recommended\" checks.</p>\n</div>",
    "keyTakeaways": [
      "A current append-only Bloom filter can prove absence but only probable presence.",
      "Deletion requires rebuilding, counting filters, or another design.",
      "False-positive rate trades memory and hash work against avoided I/O."
    ],
    "furtherReading": [
      {
        "title": "Burton Bloom: Space/Time Trade-offs in Hash Coding with Allowable Errors (1970)",
        "url": "https://dl.acm.org/doi/10.1145/362686.362692"
      },
      {
        "title": "RocksDB Wiki: Bloom Filter Implementation",
        "url": "https://github.com/facebook/rocksdb/wiki/RocksDB-Bloom-Filter"
      }
    ]
  },
  "hot-cold-storage-archival": {
    "title": "Hot and cold storage, archival",
    "video": {
      "youtubeId": "qwO4u5zRckg",
      "title": "AWS re:Invent 2021 - Best practices for cost optimization with Amazon S3",
      "channel": "AWS Events",
      "why": "The S3 team walks through storage classes, lifecycle transitions, Intelligent-Tiering and the retrieval-cost traps, which is exactly the tiering economics this lesson models.",
      "length": "47:24"
    },
    "videos": [
      {
        "youtubeId": "RvaMHMxHjp4",
        "title": "Object Storage in System Design Interviews w/ Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "The previous pick: how object storage fits into interview designs (blob vs metadata split, presigned URLs).",
        "length": "12:37"
      },
      {
        "youtubeId": "QB2TUII3wtc",
        "title": "Amazon S3 Intelligent-Tiering Overview",
        "channel": "AWS Developers",
        "role": "intro",
        "why": "Short explainer of automatic tiering by access pattern, the no-lifecycle-rules alternative.",
        "length": "5:52"
      }
    ],
    "intuition": "<p>Think of how you store your belongings. Things you use daily sit on your desk (hot: fast, expensive space). Last season's clothes go in the wardrobe (warm). Old tax records go in boxes in the attic (cold: cheap, but you need a ladder). Documents you must keep for 7 years but will probably never read go to a storage unit across town (archive: dirt cheap, but retrieval takes a day and costs a trip).</p><p><strong>Mental model:</strong> data access decays with age, so <em>move data down tiers as it cools</em>, trading retrieval latency and retrieval fees for much lower cost per GB. Design the tiering around your real query patterns and retention or compliance rules.</p><ul><li><strong>Ignoring retrieval and request costs:</strong> Glacier storage is cheap, but restoring 100 TB in a hurry, or reading millions of small objects, can cost more than years of storage.</li><li><strong>Minimum storage durations:</strong> S3 IA (30 days), Glacier Flexible Retrieval (90) and Deep Archive (180) bill the minimum even if you delete early.</li><li><strong>Tiny objects:</strong> IA and Glacier have per-object overhead (128 KB minimum billable size for IA, 40 KB of metadata per Glacier object). Pack small records into large Parquet files first.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Economics and Hardware of Data Lifecycles</h2>\n      <p>In large-scale platforms, data often exhibits steep temporal access decay: in many workloads the large majority of reads (for example 90%) target data written in the last few days. Measure your own access pattern before choosing tier boundaries. Keeping multi-year historical logs or audit records on high-performance NVMe SSDs in primary transactional clusters costs hundreds of thousands of dollars per month in idle compute and storage provisioned IOPS.</p>\n\n      <h2>Multi-Tier Storage Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    App[\"Application Tier\"] --> Tier1[\"Hot Tier: NVMe SSDs (PostgreSQL / Redis / Cassandra)\"]\n    \n    Tier1 -.->|\"Batch ETL / Parquet Compaction (After 30 Days)\"| Tier2[\"Warm Tier: AWS S3 Standard / GCS\"]\n    Tier2 -.->|\"Lifecycle Policy (After 90 Days)\"| Tier3[\"Cold Tier: S3 Glacier Flexible Retrieval\"]\n    Tier3 -.->|\"Archive Policy (After 365 Days)\"| Tier4[\"Deep Archive: S3 Glacier Deep Archive ($0.00099/GB/mo)\"]\n\n    subgraph QueryEngines [\"Analytical Query Engines\"]\n      Tier2 --> Athena[\"Serverless Queries: AWS Athena / DuckDB\"]\n      Tier1 --> Primary[\"Transactional Queries (&lt; 5ms)\"]\n    end\n      </div>\n\n      <h2>Hardware, Latency, and Cost Breakdown</h2>\n      <table>\n        <thead>\n          <tr><th>Storage Tier</th><th>Underlying Hardware</th><th>P99 Access Latency</th><th>Cost per TB / Month</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Hot (Transactional)</strong></td><td>Local NVMe SSD / Provisioned IOPS EBS (io2)</td><td>Sub-millisecond to 5ms</td><td>$100.00 - $180.00</td></tr>\n          <tr><td><strong>Warm (Infrequent)</strong></td><td>Multi-tenant Cloud Object Store (S3 Standard / Infrequent)</td><td>50ms - 150ms</td><td>$12.50 - $23.00</td></tr>\n          <tr><td><strong>Cold (Glacier)</strong></td><td>Not disclosed by AWS</td><td>Flexible Retrieval: 1-5 min (Expedited), 3-5 h (Standard), 5-12 h (Bulk). Glacier Instant Retrieval: milliseconds</td><td>$3.60</td></tr>\n          <tr><td><strong>Deep Archive</strong></td><td>Not disclosed by AWS</td><td>12 - 48 hours retrieval</td><td>$0.99 (99% cost reduction)</td></tr>\n        </tbody>\n      </table>\n\n      <h2>Tombstones and Lifecycle Compaction</h2>\n      <p>When archiving data from distributed databases like Cassandra, deleted rows, expired TTLs and null writes leave <strong>tombstone markers</strong>. If cold archival jobs blindly export tables without compacting tombstones, query engines reading the archived Parquet files encounter performance degradation. Modern pipelines run compaction jobs before compressing data into columnar Parquet/ORC chunks for cold storage.</p>\n    </div>",
    "keyTakeaways": [
      "Reads typically concentrate on recent data (for example, 90% on the last week in many workloads); tiered storage migrates aged data to reduce storage bills by up to 99%.",
      "Hot tiers use local NVMe SSDs; cold tiers (S3 Glacier classes) trade retrieval latency and fees for cost; AWS does not disclose the underlying media.",
      "Compaction to columnar Parquet formats before object storage migration enables serverless querying via Athena and DuckDB."
    ],
    "furtherReading": [
      {
        "title": "AWS S3 Storage Classes and Lifecycle Rules",
        "url": "https://aws.amazon.com/s3/storage-classes/"
      },
      {
        "title": "Uber Engineering: From Archival to Access: Config-Driven Data Pipelines",
        "url": "https://www.uber.com/blog/from-archival-to-access/"
      }
    ]
  }
};
