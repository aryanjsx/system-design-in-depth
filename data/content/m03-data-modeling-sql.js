window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-data-sql"] = {
  "relational-database-design": {
    "title": "Relational database design",
    "video": {
      "youtubeId": "GFQaEYEc8_8",
      "title": "Learn Database Normalization - 1NF, 2NF, 3NF, 4NF, 5NF",
      "channel": "Decomplexify",
      "why": "The clearest normal-forms walkthrough on YouTube: one running example, each anomaly shown concretely before the rule that fixes it.",
      "length": "28:34"
    },
    "videos": [
      {
        "youtubeId": "oeYBdghaIjc",
        "title": "01 - Course Introduction & Relational Model (CMU Databases Systems / Fall 2019)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "Andy Pavlo's lecture on Codd's relational model and relational algebra, matching the operator table in this lesson.",
        "length": "1:06:44"
      },
      {
        "youtubeId": "TUcPS6dsWx4",
        "title": "Data Modeling in System Design Interviews w/ Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows how to turn access patterns into a schema and when to denormalize in an interview setting.",
        "length": "30:35"
      }
    ],
    "intuition": "<p>Think of a well-run library catalogue. Every author is written down once, on one card, and each book card just says which author it belongs to. If an author changes their name, you fix one card and every book is correct. If the author's name were copied onto every book card, you would have to find and fix hundreds of cards, and missing one leaves the catalogue contradicting itself.</p><p><strong>Mental model:</strong> normalization means <em>every fact lives in exactly one place</em>, and keys point to it. Denormalization is a deliberate, measured copy made for read speed, and you accept the job of keeping the copies correct.</p><ul><li><strong>Denormalizing too early:</strong> copying data \"for speed\" before any query plan shows the joins are the bottleneck. Indexed joins on a few tables are cheap.</li><li><strong>Confusing a snapshot with a duplicate:</strong> storing <code>unit_price</code> on an order line is not redundancy. It records the price at purchase time, which is a different fact from the product's current price.</li><li><strong>Forgetting constraints:</strong> a schema without foreign keys, <code>NOT NULL</code> and <code>UNIQUE</code> pushes integrity into application code, where concurrent requests will eventually break it.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Relational Invariants and Normal Forms</h2>\n      <p>Relational database design is the discipline of structuring data into strongly typed tables governed by relational algebra. The core objective is eliminating data redundancy while enforcing integrity constraints directly at the storage engine level.</p>\n\n      <h2>Relational Algebra: The Formal Foundation</h2>\n      <p>Relational algebra is the mathematical framework behind every SQL query. When you write <code>SELECT</code>, <code>WHERE</code>, <code>JOIN</code>, or <code>UNION</code>, you are invoking operators defined by E.F. Codd (1970). Understanding these operators explains <em>why</em> certain query patterns are expensive and others are not.</p>\n      <table>\n        <thead>\n          <tr><th>Operator</th><th>Symbol</th><th>What It Does</th><th>SQL Equivalent</th><th>Cost Implication</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Selection</strong></td><td>σ<sub>p</sub>(R)</td><td>Filters rows from relation R where predicate p is true.</td><td><code>WHERE</code> clause</td><td>O(N) full scan without index; O(log N) with B-Tree index.</td></tr>\n          <tr><td><strong>Projection</strong></td><td>π<sub>A,B</sub>(R)</td><td>Extracts only specified columns, discarding others.</td><td><code>SELECT A, B</code></td><td>Reduces I/O if columns are in a covering index; otherwise requires heap fetch.</td></tr>\n          <tr><td><strong>Cartesian Product</strong></td><td>R × S</td><td>Every row of R paired with every row of S. Produces |R| × |S| rows.</td><td><code>CROSS JOIN</code></td><td>Explosive row count: 1000 × 1000 = 1M rows. Almost always a bug in WHERE clause.</td></tr>\n          <tr><td><strong>Natural Join</strong></td><td>R ⋈ S</td><td>Combines rows where columns with matching names are equal; eliminates duplicate columns.</td><td><code>NATURAL JOIN</code> / <code>JOIN ... USING</code></td><td>Nested loop: O(N×M). Hash join: O(N+M). Merge join: O(N log N + M log M).</td></tr>\n          <tr><td><strong>Union</strong></td><td>R ∪ S</td><td>Combines all rows from R and S, removing duplicates.</td><td><code>UNION</code> (not <code>UNION ALL</code>)</td><td>Deduplication requires sorting or hashing, adding O(N log N) overhead.</td></tr>\n          <tr><td><strong>Set Difference</strong></td><td>R − S</td><td>Returns rows in R that are not in S.</td><td><code>EXCEPT</code> / <code>MINUS</code></td><td>Requires scanning both relations; anti-join optimization in some engines.</td></tr>\n          <tr><td><strong>Assignment</strong></td><td>R ← S</td><td>Stores result of an expression into a named relation (view or temp table).</td><td><code>CREATE VIEW</code> / CTE</td><td>Views are not pre-computed; CTE may be inlined or materialized by optimizer.</td></tr>\n        </tbody>\n      </table>\n      <p><strong>Key insight:</strong> SQL's declarative syntax hides these operators. When you write <code>SELECT name FROM orders JOIN customers ON orders.cust_id = customers.id WHERE status = 'active'</code>, the optimizer translates it to: π<sub>name</sub>(σ<sub>status='active'</sub>(orders ⋈<sub>cust_id=id</sub> customers)). The join algorithm (nested loop vs hash vs merge) determines physical performance; the algebra determines logical correctness.</p>\n\n      <h2>Relational Normalization and Foreign Key Enforcement</h2>\n      <div class=\"mermaid\">\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ ORDER_ITEM : contains\n    PRODUCT ||--o{ ORDER_ITEM : references\n    \n    CUSTOMER {\n        uuid id PK\n        varchar email UK\n        timestamp created_at\n    }\n    ORDER {\n        uuid id PK\n        uuid customer_id FK\n        numeric total_amount\n        varchar status\n    }\n    ORDER_ITEM {\n        uuid id PK\n        uuid order_id FK\n        uuid product_id FK\n        int quantity\n        numeric unit_price\n    }\n      </div>\n\n      <h2>Normalization vs. Selective Denormalization</h2>\n      <h3>1. The Three Normal Forms</h3>\n      <ul>\n        <li><strong>First Normal Form (1NF):</strong> Atomic values; zero repeating column groups or comma-separated lists.</li>\n        <li><strong>Second Normal Form (2NF):</strong> Must be in 1NF, and all non-key columns must depend on the <em>entire</em> primary key (eliminating partial functional dependencies in composite keys).</li>\n        <li><strong>Third Normal Form (3NF):</strong> Must be in 2NF, and zero non-key columns may depend on other non-key columns (eliminating transitive functional dependencies).</li>\n      </ul>\n\n      <h3>2. The Cost of Normalization: The Multi-Join Penalty</h3>\n      <p>While 3NF removes most update anomalies (BCNF closes the remaining gaps caused by overlapping candidate keys, and 4NF/5NF handle multi-valued and join dependencies), high-scale read queries (such as rendering an e-commerce order history page) require joining 6 or more tables. Each join traverses secondary B-Trees and random heap pages, consuming database memory buffers. High-throughput architectures use <strong>Selective Denormalization</strong> (e.g., storing a snapshot of product name and unit price directly on the <code>order_items</code> row) to turn multi-table joins into single-table lookups while preserving point-in-time order integrity.</p>\n\n      <h2>Failure Modes and Edge Cases</h2>\n      <ul>\n        <li><strong>Accidental Cartesian Product:</strong> Forgetting a JOIN condition produces |R| × |S| rows. A 10K × 10K join silently returns 100M rows, exhausting memory and causing OOM kills. Always verify row counts in query plans.</li>\n        <li><strong>N+1 Query Problem:</strong> ORMs that lazy-load related entities inside a loop execute 1 query for the parent + N queries for children. For 10,000 orders with 3 items each, this becomes 10,001 queries. Fix with eager loading or batch joins.</li>\n        <li><strong>Foreign Key Without Index:</strong> A foreign key column without an index forces a sequential scan of the child table on every DELETE (or key UPDATE) of a parent row, which is slow and holds row locks longer. Some engines (classically Oracle) also take a table-level lock on the unindexed child table. Always index foreign key columns.</li>\n        <li><strong>Over-Normalization in OLTP:</strong> A fully normalized schema with 15+ joins per query may be theoretically elegant but causes multi-second read latency. Measure actual query plans before denormalizing.</li>\n        <li><strong>NULL in UNIQUE Constraints:</strong> Most SQL engines (PostgreSQL, MySQL, Oracle) allow multiple NULLs in a UNIQUE column (NULL ≠ NULL in SQL), but SQL Server allows only one, and PostgreSQL 15+ can reject duplicate NULLs with <code>UNIQUE NULLS NOT DISTINCT</code>. Allowing multiple NULLs can cause unexpected duplicates in partial unique indexes.</li>\n      </ul>\n\n      <h2>Theoretical Framework: When to Normalize vs. Denormalize</h2>\n      <p>The <strong>Codd's relational model</strong> (1970) and <strong>C.J. Date's database design principles</strong> advocate 3NF as the default to prevent update, insertion, and deletion anomalies. In practice, the decision depends on workload:</p>\n      <ul>\n        <li><strong>Write-heavy OLTP (banking, inventory):</strong> Normalize to 3NF. Update anomalies are costly; joins are affordable at small row counts with proper indexes.</li>\n        <li><strong>Read-heavy OLAP (analytics, dashboards):</strong> Denormalize aggressively. Star schemas (Kimball methodology) trade write efficiency for query simplicity and scan performance.</li>\n        <li><strong>Mixed workloads (e-commerce):</strong> Normalize the transactional core; denormalize into materialized views or separate read-optimized stores (e.g., Elasticsearch for product search, Redis for session data).</li>\n      </ul>\n    </div>",
    "keyTakeaways": [
      "Relational design uses normalization (1NF, 2NF, 3NF) to eliminate update anomalies and enforce constraints.",
      "Selective denormalization optimizes read-heavy queries by embedding immutable point-in-time attributes.",
      "Foreign key constraints enforce referential integrity at the database layer, preventing dangling records."
    ],
    "furtherReading": [
      {
        "title": "Codd: A Relational Model of Data for Large Shared Data Banks (1970)",
        "url": "https://dl.acm.org/doi/10.1145/362384.362685"
      },
      {
        "title": "William Kent: A Simple Guide to Five Normal Forms in Relational Database Theory",
        "url": "https://www.bkent.net/Doc/simple5.htm"
      },
      {
        "title": "PostgreSQL Documentation: Constraints",
        "url": "https://www.postgresql.org/docs/current/ddl-constraints.html"
      },
      {
        "title": "Kimball: The Data Warehouse Toolkit — Star Schema Design",
        "url": "https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/"
      }
    ]
  },
  "sql-backed-key-value-store": {
    "title": "Design: a key-value store on SQL",
    "video": {
      "youtubeId": "KWaShWxJzxQ",
      "title": "I replaced my Redis cache with Postgres... Here's what happened",
      "channel": "Milan Jovanović",
      "why": "Builds exactly this unit's design, a key-value/cache table in PostgreSQL (including an UNLOGGED table), and benchmarks it against Redis so the trade-off has real numbers.",
      "length": "13:24"
    },
    "videos": [
      {
        "youtubeId": "eMotoFvgdUo",
        "title": "Optimistic Locking - What, When, Why, and How?",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Explains the version-column compare-and-swap that the lesson uses for put-if-version, including the retry loop and when it breaks down.",
        "length": "16:34"
      },
      {
        "youtubeId": "Ugf6IAsaJqk",
        "title": "PostgreSQL's secret NoSQL superpowers",
        "channel": "Citus Data",
        "role": "deep-dive",
        "why": "Conference talk on JSONB, hstore and GIN indexes, the features that let Postgres act as a flexible document/KV store.",
        "length": "58:35"
      }
    ],
    "intuition": "<p>Picture a coat check. You hand over a coat, get a numbered ticket, and later swap the ticket back for the coat. The attendant never cares what is in the pockets. A key-value store is that coat check: <code>put(key, value)</code>, <code>get(key)</code>, <code>delete(key)</code>. A relational table with a primary key already <em>is</em> a very reliable coat check. You just give up the joins and ad-hoc queries you are not using anyway.</p><p><strong>Mental model:</strong> one table, primary key equals the KV key, a version column for compare-and-swap, and an <code>expires_at</code> column for TTL. Durability, replication and backups come free with the database.</p><ul><li><strong>Trusting the sweeper for correctness:</strong> expired rows can live until the reaper runs, so every read must also filter <code>expires_at &gt; now()</code>.</li><li><strong>Ignoring write amplification:</strong> each update in PostgreSQL writes a new tuple version plus WAL. Hot, frequently rewritten keys cause bloat and heavy vacuum work.</li><li><strong>Assuming it is as fast as Redis:</strong> a well-tuned Postgres serves point reads in well under a millisecond on the server, but network round trips, connection limits and fsync on commit cap throughput well below an in-memory store.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Key-Value Semantics on Relational Engines</h2>\n      <p>Before introducing dedicated caching or NoSQL infrastructure (like Redis or DynamoDB), modern relational engines like PostgreSQL can reliably serve as high-throughput key-value stores using optimized schema designs, atomic compare-and-swap mutations, and partial indexing.</p>\n\n      <h2>Schema Design for an ACID Key-Value Table</h2>\n      <pre><code>-- Production-Grade Key-Value Table in PostgreSQL\nCREATE TABLE kv_store (\n    key VARCHAR(255) PRIMARY KEY,\n    value JSONB NOT NULL,\n    version BIGINT NOT NULL DEFAULT 1,\n    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n    expires_at TIMESTAMPTZ\n);\n\n-- Partial index for active key lookups and expiration sweeps\nCREATE INDEX idx_kv_expires ON kv_store(expires_at) \nWHERE expires_at IS NOT NULL;\n      </code></pre>\n\n      <h2>Atomic Mutations: Compare-and-Swap (CAS)</h2>\n      <p>To avoid lost updates without holding a lock across a read-modify-write round trip, execute conditional updates directly in SQL (the UPDATE itself still takes a short row-level lock until its transaction ends):</p>\n      <pre><code>-- Optimistic Concurrency Control: Put-If-Version\nUPDATE kv_store\nSET value = '{\"config\": \"v2\"}'::jsonb,\n    version = version + 1,\n    updated_at = NOW()\nWHERE key = 'feature_flags' AND version = 4;\n-- If 0 rows updated, client knows another thread won the race!\n      </code></pre>\n\n      <h2>Background Expiration Sweeper</h2>\n      <p>Because expired rows consume disk space and memory buffers, a background reaper periodically purges expired keys in bounded batches using the partial index:</p>\n      <pre><code>-- Bounded batches keep each transaction short (limits WAL bursts, replica lag and vacuum backlog)\nDELETE FROM kv_store\nWHERE key IN (\n    SELECT key FROM kv_store\n    WHERE expires_at &lt; NOW()\n    LIMIT 1000\n);\n      </code></pre>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a Postgres-backed config and session store</h2><p>Suppose a service keeps 20 million session keys. Each value is about 400 bytes of JSONB, and the load is 5,000 reads/s and 500 writes/s at peak.</p><ul><li><strong>Row size:</strong> about 24 bytes of tuple header, a key of about 40 bytes, a value of about 400 bytes, and three timestamps plus a version (about 32 bytes), so roughly 500 bytes. At 8 KB per page with fillfactor 90, that is about 14 rows per page. 20M rows is about 1.4M pages, or around 11 GB of heap.</li><li><strong>Primary key index:</strong> a B-tree on the key is 3 to 4 levels deep. The upper levels stay cached, so a <code>get</code> is typically one or two buffer hits. With enough RAM, a point lookup is well under 1 ms on the server.</li><li><strong>Writes:</strong> 500 updates/s produce 500 dead tuples/s, or about 43M per day, which is more than the live row count. Autovacuum must be tuned per table (for example <code>autovacuum_vacuum_scale_factor = 0.01</code>). A lower fillfactor enables HOT updates, which avoid index churn when indexed columns do not change.</li></ul><h3>Upsert and TTL-aware read</h3><p><code>INSERT INTO kv_store(key, value, expires_at) VALUES (?, ?, now() + interval '30 minutes') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = kv_store.version + 1, updated_at = now(), expires_at = EXCLUDED.expires_at;</code></p><p><code>SELECT value, version FROM kv_store WHERE key = ? AND (expires_at IS NULL OR expires_at &gt; now());</code></p><h3>Design choices</h3><table><thead><tr><th>Choice</th><th>Benefit</th><th>Cost</th></tr></thead><tbody><tr><td>Regular (logged) table</td><td>Crash-safe, replicated to standbys</td><td>WAL and fsync on every commit</td></tr><tr><td>UNLOGGED table</td><td>Several times faster writes, good for caches</td><td>Truncated after a crash; not replicated to physical standbys</td></tr><tr><td>Hash-partition by key</td><td>Smaller indexes, parallel vacuum</td><td>More objects to manage</td></tr><tr><td>Range-partition by expires_at</td><td>Expiry becomes a cheap <code>DROP</code> of an old partition instead of DELETE</td><td>Updates that change the TTL move rows between partitions</td></tr></tbody></table><h3>Failure modes</h3><ul><li><strong>Lost updates:</strong> a blind <code>UPDATE ... SET value</code> from two clients silently loses one write. Use the version predicate or <code>SELECT ... FOR UPDATE</code>.</li><li><strong>Connection exhaustion:</strong> Postgres uses one process per connection. Thousands of app instances need a pooler such as PgBouncer.</li><li><strong>Sweeper lag:</strong> if expiry deletes fall behind, the table grows without bound. Monitor dead-tuple counts and the age of the oldest expired row.</li></ul><p><strong>Who does this:</strong> Uber's Schemaless and FriendFeed's early design stored opaque JSON blobs in MySQL keyed by ID. Rails 8's Solid Cache keeps its cache in a SQL database. Many teams run feature flags and idempotency keys in Postgres tables before they ever need Redis.</p>\n</div>",
    "keyTakeaways": [
      "SQL engines can provide reliable ACID key-value storage using JSONB and optimistic concurrency control (version checks).",
      "Partial indexes on nullable expiration timestamps enable fast background cleanup without scanning the full table.",
      "Bounded batch deletions prevent long-running transactions, WAL bursts and replication lag during key reaping."
    ],
    "furtherReading": [
      {
        "title": "Bret Taylor: How FriendFeed uses MySQL to store schema-less data",
        "url": "https://backchannel.org/blog/friendfeed-schemaless-mysql"
      },
      {
        "title": "Uber Engineering: Designing Schemaless, Uber Engineering's Scalable Datastore Using MySQL",
        "url": "https://www.uber.com/blog/schemaless-part-one-mysql-datastore/"
      }
    ]
  },
  "database-indexing": {
    "title": "Database indexing",
    "video": {
      "youtubeId": "-qNSXK7s7_w",
      "title": "Database Indexing Explained (with PostgreSQL)",
      "channel": "Hussein Nasser",
      "why": "Hands-on in psql with EXPLAIN ANALYZE: seq scan vs index scan vs index-only scan on a real multi-million-row table, exactly this lesson's material.",
      "length": "18:19"
    },
    "videos": [
      {
        "youtubeId": "BHCSL_ZifI0",
        "title": "DB Indexing in System Design Interviews - B-tree, Geospatial, Inverted Index, and more!",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows when to bring up each index type in a design interview and how to justify it.",
        "length": "14:16"
      },
      {
        "youtubeId": "3G293is403I",
        "title": "How do indexes make databases read faster?",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "First-principles look at disk blocks and why an index cuts the number of pages read.",
        "length": "23:25"
      }
    ],
    "intuition": "<p>An index is the index at the back of a textbook. To find \"photosynthesis\" you do not read all 900 pages. You jump to the alphabetized index, get \"page 412\", and go straight there. The index takes extra pages to print and must be updated in every new edition, but lookups go from \"read the book\" to \"read two pages\".</p><p><strong>Mental model:</strong> an index is a <em>sorted copy of some columns plus a pointer to the row</em>. It helps any query that can use that sort order (equality, ranges, ORDER BY, prefix match) and costs extra work on every write.</p><ul><li><strong>Wrong column order in composite indexes:</strong> <code>(tenant_id, created_at)</code> serves \"tenant X, newest first\" but is little help for \"all rows from yesterday across tenants\". Put equality columns first and the range or sort column last.</li><li><strong>Indexing low-selectivity columns:</strong> a B-tree on a boolean that is true for 50% of rows is usually ignored by the planner, because a sequential scan is cheaper.</li><li><strong>Wrapping the column in a function:</strong> <code>WHERE lower(email) = ...</code> cannot use a plain index on <code>email</code>. You need an expression index.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: How Indexes Direct Disk I/O</h2>\n      <p>Without an index, finding a single row in a 50,000,000-record table requires a <strong>Sequential Scan (Seq Scan)</strong>: reading every single disk block into memory (O(N) I/O). An index is an auxiliary data structure stored on disk that maps column values to row locators (in PostgreSQL, physical tuple pointers: <code>ItemPointer</code> / <code>TID: (page_id, offset)</code>; InnoDB secondary indexes store the primary key instead), reducing lookup complexity to O(log N).</p>\n\n      <h2>Index Lookup vs. Sequential Scan</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Query[\"SELECT * FROM users WHERE email = 'alice@corp.com'\"] --> Planner{\"Query Planner\"}\n    Planner -->|\"No Index\"| SeqScan[\"Sequential Scan: Read about 1.4M heap pages into buffer pool (about 5,000ms cold)\"]\n    Planner -->|\"B-Tree Index Available\"| BTreeSearch[\"B-Tree Index Scan: Read 3 index pages -> Seek 1 heap page (0.8ms)\"]\n      </div>\n\n      <h2>Index Mechanics & Cardinality Rules</h2>\n      <h3>1. Multi-Column (Composite) Index Ordering (Left-to-Right Prefix Rule)</h3>\n      <p>If you create an index on <code>(tenant_id, status, created_at)</code>, the B-Tree sorts first by <code>tenant_id</code>, then by <code>status</code>, then by <code>created_at</code>. A query filtering by <code>tenant_id AND status</code> uses the index efficiently. A query filtering solely by <code>status</code> cannot use the index for an efficient seek because the leading column is missing. At best the planner scans the whole index, or uses a skip scan (Oracle, MySQL 8.0.13+, PostgreSQL 18+), which pays off only when the leading column has few distinct values.</p>\n\n      <h3>2. Covering Indexes (Index-Only Scan)</h3>\n      <p>An index lookup typically requires two steps: finding the tuple pointer in the index, then fetching the full row from the heap table. By using an index with included columns:</p>\n      <pre><code>CREATE INDEX idx_orders_covering ON orders(customer_id) INCLUDE (total_amount, status);</code></pre>\n      <p>The database can satisfy <code>SELECT customer_id, total_amount, status FROM orders WHERE customer_id = 42;</code> entirely from the index page in RAM without touching the table heap at all (an <strong>Index-Only Scan</strong>).</p>\n    \n<!-- enriched -->\n<h2>Worked example: what an index actually saves</h2><p>Take a <code>users</code> table with 50,000,000 rows of about 200 bytes each. At roughly 35 rows per 8 KB page, that is about 1.4M pages, or about 11 GB.</p><ul><li><strong>Seq scan for one email:</strong> read about 1.4M pages. From a cold NVMe drive at around 2 GB/s that is roughly 5-6 seconds. Even fully cached in RAM, it costs around 1 second of CPU to evaluate 50M rows.</li><li><strong>B-tree on email:</strong> index entries of about 40 bytes give roughly 200 per page. log base 200 of 50M is about 3.3, so the tree has 4 levels. The root and internal pages are cached, so a lookup is about 1-2 leaf and heap page reads, well under 1 ms.</li><li><strong>Write cost:</strong> every INSERT now also inserts into each index. Five secondary indexes means about six B-tree modifications per row plus their WAL. Write-heavy tables should carry only the indexes their queries prove they need.</li></ul><h3>Choosing an index type</h3><table><thead><tr><th>Index</th><th>Good for</th><th>Not good for</th></tr></thead><tbody><tr><td>B-tree (default)</td><td>Equality, ranges, ORDER BY, prefix LIKE 'abc%'</td><td>Suffix or contains search, very low selectivity</td></tr><tr><td>Hash</td><td>Pure equality with slightly smaller size</td><td>Ranges, sorting</td></tr><tr><td>GIN</td><td>JSONB containment, arrays, full-text</td><td>Write-heavy tables (slow updates)</td></tr><tr><td>BRIN</td><td>Huge append-only tables ordered by time</td><td>Randomly ordered data</td></tr><tr><td>Partial</td><td>Hot subsets such as <code>WHERE status = 'pending'</code></td><td>Queries that do not repeat the predicate</td></tr></tbody></table><h3>Composite index rule of thumb</h3><p>For <code>WHERE tenant_id = ? AND status = ? AND created_at &gt; ? ORDER BY created_at</code>, index <code>(tenant_id, status, created_at)</code>. Equality columns go first and the range and sort column last, so the database seeks to one contiguous slice and reads it in order with no sort step.</p><h3>Failure modes</h3><ul><li><strong>Index-only scan that is not:</strong> in PostgreSQL, heap fetches still happen for pages not marked all-visible in the visibility map. Vacuum is what keeps index-only scans cheap.</li><li><strong>Unused indexes:</strong> check <code>pg_stat_user_indexes.idx_scan = 0</code> and drop them. They slow every write and waste cache.</li><li><strong>Clustered vs heap:</strong> in MySQL InnoDB, secondary indexes store the primary key, not a physical pointer. A wide or random primary key (UUIDv4) bloats every secondary index.</li></ul>\n</div>",
    "keyTakeaways": [
      "Indexes map column values to row locators (physical tuple IDs in PostgreSQL heaps, primary-key values in InnoDB secondary indexes), bypassing table scans.",
      "Composite indexes support efficient seeks only when query predicates match the leftmost prefix of the indexed columns (skip scans are a limited exception).",
      "Covering indexes (INCLUDE clause) eliminate heap reads entirely by satisfying queries directly from index pages."
    ],
    "furtherReading": [
      {
        "title": "Markus Winand: Use The Index, Luke! (Table of Contents)",
        "url": "https://use-the-index-luke.com/sql/table-of-contents"
      },
      {
        "title": "Ramakrishnan & Gehrke: Database Management Systems (3rd Ed) — Query Processing",
        "url": "https://pages.cs.wisc.edu/~dbbook/"
      }
    ]
  },
  "b-tree": {
    "title": "B-tree",
    "video": {
      "youtubeId": "K1a2Bk8NrYQ",
      "title": "Understanding B-Trees: The Data Structure Behind Modern Databases",
      "channel": "Spanning Tree",
      "why": "Beautifully animated build-up from binary search trees to B-trees, including why high fanout matters for disk; still the best short explanation.",
      "length": "12:39"
    },
    "videos": [
      {
        "youtubeId": "u7ii_Lvm9rM",
        "title": "#08 - B+Trees: The Best Data Structure in the World (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "Andy Pavlo's full lecture on B+ tree node layout, splits and merges, sibling pointers, and design choices in real engines.",
        "length": "1:24:43"
      }
    ],
    "intuition": "<p>Imagine finding one name in a phone book for a city of 100 million people. A binary search tree is like asking \"is it before or after this name?\" one name at a time, which takes 27 questions and 27 trips to the warehouse where the pages are stored. A B-tree is like a book with thumb tabs: the first tab page splits the alphabet into 500 ranges, the next into 500 more, and after three or four flips you are on the right page.</p><p><strong>Mental model:</strong> a B+ tree is a <em>very short, very wide</em> sorted tree whose nodes are exactly one disk page. Internal pages hold only signposts, and all the data sits in leaves linked side by side for range scans.</p><ul><li><strong>Thinking depth grows fast:</strong> with fanout of a few hundred, 4 levels cover billions of keys. Depth is almost never the problem. Cache misses on leaves are.</li><li><strong>Ignoring page splits:</strong> inserting random keys (UUIDv4) splits pages all over the tree, leaving them half full and dirtying many pages. Sequential keys append to the rightmost leaf.</li><li><strong>Confusing B-tree and B+ tree:</strong> in a classic B-tree, internal nodes also hold values. Databases use B+ trees so internal nodes pack more keys and range scans walk the leaves.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The B+ Tree Storage Architecture</h2>\n      <p>Relational databases almost exclusively use <strong>B+ Trees</strong> rather than traditional binary search trees (BST or Red-Black trees). A binary tree has a fanout of 2, requiring 20 to 30 pointer hops across disk to locate a record in a million rows. A B+ Tree has a massive fanout (typically 100 to 1,000 keys per page), ensuring the tree depth remains <strong>3 or 4 levels</strong> even for hundreds of millions of rows.</p>\n\n      <h2>Physical Page Layout of a B+ Tree</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Root[\"Root Page (Level 3: in RAM)\"] --> Internal1[\"Internal Page 1\"]\n    Root --> Internal2[\"Internal Page 2\"]\n    \n    Internal1 --> Leaf1[\"Leaf Page A: [1..100]\"]\n    Internal1 --> Leaf2[\"Leaf Page B: [101..200]\"]\n    \n    Leaf1 &lt;-->|\"Doubly Linked List (range scan: O(log N + K))\"| Leaf2\n    Leaf2 &lt;--> Leaf3[\"Leaf Page C: [201..300]\"]\n    \n    Leaf1 -.-> Heap1[\"Table Heap Disk Tuple\"]\n    Leaf1 -.-> Heap2[\"Table Heap Disk Tuple\"]\n      </div>\n\n      <h2>B+ Tree Structural Invariants</h2>\n      <ul>\n        <li><strong>High Fanout:</strong> A single 8KB page can store roughly 200 key-pointer pairs for moderately wide keys (300-500 for narrow integer keys, as the worked example below shows). A 3-level tree indexes 200<sup>3</sup> = 8,000,000 rows with only 3 disk page reads.</li>\n        <li><strong>Data Resides Solely in Leaves:</strong> Unlike standard B-trees, internal B+ Tree nodes contain <em>only separator keys and child pointers</em>; actual tuple data (or tuple pointers) resides exclusively in leaf pages. This maximizes internal page fanout.</li>\n        <li><strong>Doubly-Linked Leaves:</strong> All leaf pages are connected via forward and backward pointers. Executing a range query (<code>WHERE age BETWEEN 25 AND 35</code>) locates the first leaf in O(log N) time and walks the linked list linearly with zero tree traversals.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: how tall is the tree?</h2><p>Suppose we index a <code>BIGINT</code> key in PostgreSQL. Each index tuple is about 16 bytes (8-byte key, 6-byte TID, header and alignment), so an 8 KB page holds about 400 entries at typical fill.</p><table><thead><tr><th>Levels</th><th>Max leaf entries (fanout about 400)</th><th>Memory for internal levels</th></tr></thead><tbody><tr><td>1 (root only)</td><td>400</td><td>8 KB</td></tr><tr><td>2</td><td>160,000</td><td>8 KB</td></tr><tr><td>3</td><td>64,000,000</td><td>about 3.2 MB</td></tr><tr><td>4</td><td>25,600,000,000</td><td>about 1.3 GB</td></tr></tbody></table><p>A 64M-row table needs only 3 levels. The root and all 400 internal pages (about 3.2 MB) fit in cache trivially, so a point lookup costs <strong>one leaf read</strong> plus one heap read. This is why B+ trees dominate OLTP.</p><h3>Insert and split, step by step</h3><div class=\"mermaid\">flowchart TD\nA[\"Insert key 250 into full leaf 201-300\"] --> B[\"Allocate new leaf page\"]\nB --> C[\"Move upper half 251-300 to new leaf\"]\nC --> D[\"Insert separator 251 into parent\"]\nD --> E{\"Parent full?\"}\nE -->|\"No\"| F[\"Done\"]\nE -->|\"Yes\"| G[\"Split parent, push separator up\"]\nG --> H[\"Root splits only when every level is full: tree grows by one level\"]\n</div><p>The tree grows at the root, not the leaves, so all leaves always stay at the same depth. That is the \"balanced\" guarantee.</p><h3>Sequential vs random keys</h3><ul><li><strong>Sequential (BIGSERIAL, UUIDv7, Snowflake):</strong> inserts always hit the rightmost leaf. PostgreSQL and InnoDB detect this and split unevenly (for example 90/10), leaving pages nearly full. The working set is just the right edge of the tree.</li><li><strong>Random (UUIDv4):</strong> each insert lands on a random leaf. With a 20 GB index and 4 GB of cache, most inserts miss cache and cause a random read, and 50/50 splits leave pages about 70% full on average.</li></ul><h3>How real systems vary</h3><ul><li><strong>InnoDB:</strong> the table itself is a B+ tree clustered on the primary key (16 KB pages). Secondary indexes store the primary key value.</li><li><strong>PostgreSQL nbtree:</strong> the Lehman-Yao variant with right-links, so readers do not block during splits. Deduplication (v13+) compresses repeated keys.</li><li><strong>LSM engines (RocksDB, Cassandra):</strong> trade B-tree in-place updates for sequential writes plus compaction. The Storage Engines module covers this.</li></ul>\n</div>",
    "keyTakeaways": [
      "B+ Trees maximize fanout (100-1000 keys per 8KB page), keeping tree depth at 3-4 levels for multi-million row datasets.",
      "Internal nodes contain only separator keys, while leaf nodes store all data pointers.",
      "Leaf nodes form a doubly linked list, enabling fast linear range scans without re-traversing parent nodes."
    ],
    "furtherReading": [
      {
        "title": "Bayer & McCreight: Organization and Maintenance of Large Ordered Indexes (Acta Informatica, 1972)",
        "url": "https://doi.org/10.1007/BF00288683"
      },
      {
        "title": "Knuth: The Art of Computer Programming, Vol. 3: Searching and Sorting",
        "url": "https://en.wikipedia.org/wiki/The_Art_of_Computer_Programming"
      }
    ]
  },
  "query-planning": {
    "title": "Query planning",
    "video": {
      "youtubeId": "P7EUFtjeAmI",
      "title": "Postgres Explain Explained - How Databases Prepare Optimal Query Plans to Execute SQL",
      "channel": "Hussein Nasser",
      "why": "Reads real EXPLAIN output node by node (cost, rows, width, scan types), which is the practical skill this lesson builds toward.",
      "length": "10:17"
    },
    "videos": [
      {
        "youtubeId": "-htbah3eCYg",
        "title": "How nested loop, hash, and merge joins work.",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Clear walkthrough of the three join algorithms and when the optimizer picks each, matching the lesson's join table.",
        "length": "11:08"
      },
      {
        "youtubeId": "pj7Fxr8cUJI",
        "title": "How PostgreSQL generates all possible query execution plans before choosing the best one.",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Explains how Postgres enumerates join orders and scan paths and prunes them by estimated cost.",
        "length": "8:33"
      }
    ],
    "intuition": "<p>A query planner is a GPS. You say where you want to go (\"orders for customer 42 from last week\"), not which streets to take. The GPS knows the road map (indexes), has traffic estimates (table statistics), and compares candidate routes by predicted travel time. If its traffic data is stale, say it thinks a highway is empty when it is jammed, it confidently sends you the wrong way.</p><p><strong>Mental model:</strong> the planner turns SQL into candidate plan trees, estimates <em>how many rows</em> flow out of each step using statistics, converts that to cost, and picks the cheapest. Almost every bad plan traces back to a bad row-count estimate.</p><ul><li><strong>Reading only the cost:</strong> in <code>EXPLAIN ANALYZE</code>, compare estimated <code>rows</code> with actual rows. A 1,000x gap is the real bug.</li><li><strong>Correlated columns:</strong> the planner assumes <code>city = 'Paris'</code> and <code>country = 'France'</code> are independent and underestimates the combined row count. Extended statistics (<code>CREATE STATISTICS</code>) fix this.</li><li><strong>Forcing plans blindly:</strong> disabling nested loops or adding hints fixes today's query and breaks when data changes. Fix statistics and indexes first.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Cost-Based Optimizer (CBO)</h2>\n      <p>SQL is a declarative language: you specify <em>what</em> data you want, not <em>how</em> to retrieve it. The database engine's <strong>Cost-Based Optimizer (CBO)</strong> evaluates hundreds of possible physical execution trees and selects the plan with the lowest estimated I/O and CPU cost.</p>\n\n      <h2>The Query Optimization Lifecycle</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    SQL[\"Raw SQL String\"] --> Parser[\"1. SQL Parser: Generates Abstract Syntax Tree (AST)\"]\n    Parser --> Rewriter[\"2. Query Rewriter: Unfolds subqueries & simplifies expressions\"]\n    Rewriter --> Planner[\"3. Cost-Based Optimizer: Estimates physical execution paths\"]\n    \n    subgraph StatsCatalog [\"Internal Database Catalog\"]\n      Stats[\"pg_statistic: MCV (Most Common Values), Histograms, Null Fractions\"]\n    end\n    Stats --> Planner\n    \n    Planner --> Executor[\"4. Execution Engine (Volcano Iterator Model: Next())\"]\n      </div>\n\n      <h2>Under the Hood: Join Algorithms Compared</h2>\n      <table>\n        <thead>\n          <tr><th>Join Algorithm</th><th>Mechanism & Complexity</th><th>Ideal Workload</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Nested Loop Join</strong></td><td>For each row in outer table, scan inner table (O(N × log M) with index).</td><td>Small outer table joining against an indexed inner table.</td></tr>\n          <tr><td><strong>Hash Join</strong></td><td>Builds an in-memory hash table on the smaller table, then streams the larger table (O(N + M)).</td><td>Large unindexed equi-joins that fit into memory (<code>work_mem</code>).</td></tr>\n          <tr><td><strong>Merge Join</strong></td><td>Sorts both tables on join keys (or uses B-Tree order) and walks pointers together (O(N log N + M log M)).</td><td>Large equi-joins on sorted inputs, or when indexes already supply sorted order. (PostgreSQL merge joins support only merge-joinable equality operators; range joins usually become nested loops.)</td></tr>\n        </tbody>\n      </table>\n      <p><strong>The Stale Statistics Trap:</strong> If table rows jump from 1,000 to 10,000,000 without running <code>ANALYZE</code>, the planner assumes the table is tiny and chooses a Nested Loop Join over sequential scans, causing massive latency regressions.</p>\n    \n<!-- enriched -->\n<h2>Worked example: reading a plan that went wrong</h2><p>Query: <code>SELECT o.* FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'NZ' AND o.created_at &gt; now() - interval '1 day';</code></p><p>Suppose <code>orders</code> has 200M rows, 2M of them from the last day, and <code>customers</code> has 10M rows, 50k of them in NZ.</p><table><thead><tr><th>Plan option</th><th>Estimated work</th><th>When the planner picks it</th></tr></thead><tbody><tr><td>Nested loop: scan NZ customers (50k), probe orders index on (customer_id, created_at) for each</td><td>50k index probes, about 150k page touches</td><td>When it believes few customers match</td></tr><tr><td>Hash join: hash the 50k NZ customers, stream the 2M recent orders through an index on created_at</td><td>2M rows streamed plus a small hash table</td><td>When both inputs are moderately large and memory is enough</td></tr><tr><td>Merge join: sort both inputs on customer_id</td><td>Sort 2M plus 50k rows</td><td>When inputs are already sorted by the join key</td></tr></tbody></table><p>Now suppose statistics are stale and the planner thinks NZ has 50 customers. It picks the nested loop, estimating 50 probes. The real run does 50,000 probes of random index pages, and <code>EXPLAIN ANALYZE</code> shows <code>rows=50</code> estimated against <code>rows=50000</code> actual on the customer scan. The fix is <code>ANALYZE customers;</code>, not a hint.</p><h3>What to look for in EXPLAIN ANALYZE</h3><ul><li><strong>Estimated vs actual rows</strong> on each node. The first node with a large mismatch is the root cause.</li><li><strong>loops=</strong> on the inner side of a nested loop. Actual time is per loop, so multiply by the loop count.</li><li><strong>Buffers: shared hit/read</strong> (with <code>BUFFERS</code>). Reads are cache misses, hits are RAM.</li><li><strong>Sort Method: external merge Disk</strong> or hash <strong>Batches &gt; 1</strong> means <code>work_mem</code> was too small and the operation spilled to disk.</li></ul><div class=\"mermaid\">flowchart TD\nQ[\"SQL text\"] --> P[\"Parse and rewrite\"]\nP --> E[\"Enumerate scan paths and join orders\"]\nS[\"Statistics: row counts, MCVs, histograms\"] --> C[\"Estimate rows per node\"]\nE --> C\nC --> K[\"Cost = pages x page cost + rows x cpu cost\"]\nK --> B[\"Pick cheapest plan\"]\nB --> X[\"Execute\"]\n</div><h3>How real systems differ</h3><ul><li><strong>PostgreSQL:</strong> exhaustive dynamic programming up to 12 relations (<code>geqo_threshold</code>), then a genetic optimizer. No built-in hints.</li><li><strong>MySQL:</strong> greedy join search, with hash joins only since 8.0.18. Supports optimizer hints.</li><li><strong>SQL Server and Oracle:</strong> plan caches with parameter sniffing, where a plan built for one parameter value is reused for very different values, a classic production incident.</li></ul>\n</div>",
    "keyTakeaways": [
      "The Cost-Based Optimizer chooses execution paths using statistical histograms and cost formulas.",
      "The three core join physical operators are Nested Loop, Hash Join, and Merge Join.",
      "Stale statistics cause catastrophic plan regressions; ensure autovacuum and ANALYZE run regularly."
    ],
    "furtherReading": [
      {
        "title": "PostgreSQL Documentation: Using EXPLAIN to Understand Query Plans",
        "url": "https://www.postgresql.org/docs/current/using-explain.html"
      },
      {
        "title": "Goetz Graefe: Volcano - An Extensible and Parallel Query Evaluation System (IEEE TKDE, 1994)",
        "url": "https://cs-people.bu.edu/mathan/reading-groups/papers-classics/volcano.pdf"
      }
    ]
  },
  "database-locking-and-isolation": {
    "title": "Database locking and isolation",
    "video": {
      "youtubeId": "5ZjhNTM8XU8",
      "title": "\"Transactions: myths, surprises and opportunities\" by Martin Kleppmann",
      "channel": "Strange Loop Conference",
      "why": "Kleppmann explains isolation levels, what each anomaly really means, and why write skew needs serializability; the definitive talk on this topic.",
      "length": "41:08"
    },
    "videos": [
      {
        "youtubeId": "nuBi2XbHH18",
        "title": "Row-Level Database Locks Explained - (Read vs Exclusive)",
        "channel": "Hussein Nasser",
        "role": "intro",
        "why": "Short demo of shared vs exclusive row locks and SELECT FOR UPDATE, the locking half of this unit.",
        "length": "8:21"
      },
      {
        "youtubeId": "eym48yrObhY",
        "title": "Write Skew and Phantom Writes | Systems Design Interview: 0 to 1 with Google Software Engineer",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "Focused explanation of write skew and phantoms with the on-call doctors example.",
        "length": "6:38"
      }
    ],
    "intuition": "<p>Picture a shared Google Doc where many people edit at once. The weakest setting lets you see someone's half-typed sentence they might delete (a dirty read). Stronger settings give you a frozen photo of the doc as of when you started (snapshot). The strongest guarantees the final doc looks as if everyone took turns, one at a time (serializable), even though they typed simultaneously.</p><p><strong>Mental model:</strong> an isolation level is a <em>promise about which interleavings you can observe</em>. Databases keep that promise with locks (block others), versions (show old snapshots), or validation (abort a transaction on conflict).</p><ul><li><strong>Assuming the default is serializable:</strong> PostgreSQL, Oracle and SQL Server default to Read Committed, and MySQL InnoDB to Repeatable Read. Neither prevents write skew.</li><li><strong>Check-then-act:</strong> <code>SELECT count(*)</code> then <code>INSERT</code> is a race at Read Committed. Use a constraint, <code>SELECT ... FOR UPDATE</code>, or Serializable with retries.</li><li><strong>Forgetting retries:</strong> Serializable and optimistic schemes abort transactions by design. Application code must catch serialization failures (SQLSTATE 40001) and retry.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Concurrency Anomalies & Isolation Levels</h2>\n      <p>When multiple client transactions execute concurrently, the database must prevent data corruption without serializing all execution. The SQL standard defines <strong>four isolation levels</strong> based on which concurrency anomalies they prevent.</p>\n\n      <h2>The Concurrency Anomaly Hierarchy</h2>\n      <table>\n        <thead>\n          <tr><th>Isolation Level</th><th>Dirty Read</th><th>Non-Repeatable Read</th><th>Phantom Read</th><th>Write Skew</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Read Uncommitted</strong></td><td>⚠️ Occurs</td><td>⚠️ Occurs</td><td>⚠️ Occurs</td><td>⚠️ Occurs</td></tr>\n          <tr><td><strong>Read Committed (Postgres Default)</strong></td><td>✅ Prevented</td><td>⚠️ Occurs</td><td>⚠️ Occurs</td><td>⚠️ Occurs</td></tr>\n          <tr><td><strong>Repeatable Read</strong></td><td>✅ Prevented</td><td>✅ Prevented</td><td>✅ Prevented (in Postgres MVCC)</td><td>⚠️ Occurs</td></tr>\n          <tr><td><strong>Serializable</strong></td><td>✅ Prevented</td><td>✅ Prevented</td><td>✅ Prevented</td><td>✅ Prevented</td></tr>\n        </tbody>\n      </table>\n\n      <p><strong>Two caveats on this table.</strong> The <em>lost update</em> anomaly (two read-modify-write cycles overwriting each other) occurs at Read Committed; PostgreSQL's Repeatable Read prevents it by aborting the second writer with a serialization error, while MySQL InnoDB's Repeatable Read does not. And the SQL standard <em>permits</em> phantoms at Repeatable Read: PostgreSQL's snapshot prevents them, while InnoDB prevents them for plain reads via its snapshot and for locking reads via next-key locks.</p>\n\n      <h2>Under the Hood: The Four Real-World Anomalies</h2>\n      <ul>\n        <li><strong>Dirty Read:</strong> Transaction A modifies row R. Transaction B reads the modified row <em>before</em> Transaction A commits. Transaction A rolls back; Transaction B has acted on phantom data.</li>\n        <li><strong>Non-Repeatable Read:</strong> Transaction A reads row R. Transaction B updates row R and commits. Transaction A reads row R again and observes different column values.</li>\n        <li><strong>Phantom Read:</strong> Transaction A queries <code>WHERE status = 'pending'</code> (retrieving 3 rows). Transaction B inserts a new row with <code>status = 'pending'</code> and commits. Transaction A executes the query again and observes 4 rows.</li>\n        <li><strong>Write Skew:</strong> Two doctors on on-call shift concurrently request leave. Rule: At least one doctor must remain on call. Both check: count is 2. Both submit leave transactions. Both commit. Zero doctors remain on call! Snapshot-based Repeatable Read permits this. Preventing it requires Serializable isolation (PostgreSQL's <strong>Serializable Snapshot Isolation (SSI)</strong> detects and aborts one transaction; lock-based Serializable in MySQL and SQL Server blocks it) or explicitly locking the rows the check depends on (<code>SELECT ... FOR UPDATE</code> on the doctors' rows).</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: the lost update and three fixes</h2><p>Two requests each add 10 to an account balance of 100.</p><table><thead><tr><th>Time</th><th>Transaction A</th><th>Transaction B</th></tr></thead><tbody><tr><td>t1</td><td><code>SELECT balance</code> returns 100</td><td></td></tr><tr><td>t2</td><td></td><td><code>SELECT balance</code> returns 100</td></tr><tr><td>t3</td><td><code>UPDATE SET balance = 110</code>, COMMIT</td><td></td></tr><tr><td>t4</td><td></td><td><code>UPDATE SET balance = 110</code>, COMMIT</td></tr></tbody></table><p>The final balance is 110 instead of 120, and this happens at Read Committed with no error. Three fixes:</p><ul><li><strong>Atomic update:</strong> <code>UPDATE accounts SET balance = balance + 10 WHERE id = 1;</code> The row lock serializes the two writers. This is the simplest and best option when possible.</li><li><strong>Pessimistic lock:</strong> <code>SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;</code> B blocks at t2 until A commits, then reads 110.</li><li><strong>Optimistic check:</strong> <code>UPDATE ... SET balance = 110, version = 8 WHERE id = 1 AND version = 7;</code> B updates 0 rows, then re-reads and retries.</li></ul><h3>Lock types you will meet</h3><table><thead><tr><th>Lock</th><th>Taken by</th><th>Blocks</th></tr></thead><tbody><tr><td>Row exclusive (FOR UPDATE)</td><td>UPDATE, DELETE, SELECT FOR UPDATE</td><td>Other writers and FOR UPDATE on the same row, but not plain MVCC reads</td></tr><tr><td>Row shared (FOR SHARE)</td><td>SELECT FOR SHARE, FK checks</td><td>Writers on that row</td></tr><tr><td>Gap / next-key (InnoDB)</td><td>Range reads at Repeatable Read</td><td>Inserts into the locked range, which prevents phantoms</td></tr><tr><td>Predicate SIRead (PostgreSQL SSI)</td><td>Reads at Serializable</td><td>Blocks nothing; tracked to detect dangerous read-write cycles</td></tr><tr><td>Table ACCESS EXCLUSIVE</td><td>ALTER TABLE, DROP, some DDL</td><td>Everything, including reads</td></tr></tbody></table><h3>Deadlocks</h3><p>A locks row 1 then wants row 2, while B locks row 2 then wants row 1. The database detects the cycle (PostgreSQL checks after <code>deadlock_timeout</code>, 1 s by default) and aborts one transaction. The prevention is to always lock rows in a consistent order, for example by ascending primary key.</p><h3>How real systems implement Serializable</h3><ul><li><strong>PostgreSQL:</strong> Serializable Snapshot Isolation, which runs optimistically and aborts on dangerous structures.</li><li><strong>MySQL InnoDB:</strong> Serializable turns plain SELECTs into locking reads (two-phase locking).</li><li><strong>CockroachDB:</strong> Serializable by default, using timestamps and transaction restarts.</li><li><strong>Spanner:</strong> strict serializability via two-phase locking plus TrueTime.</li></ul>\n</div>",
    "keyTakeaways": [
      "SQL isolation levels trade off concurrency throughput against anomaly prevention.",
      "PostgreSQL Read Committed generates a new snapshot for each query statement; Repeatable Read holds a single snapshot for the entire transaction.",
      "Write Skew occurs under Repeatable Read when disjoint updates violate cross-row constraints; Serializable isolation or explicit locking (SELECT ... FOR UPDATE) is required."
    ],
    "furtherReading": [
      {
        "title": "Berenson et al.: A Critique of ANSI SQL Isolation Levels",
        "url": "https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/"
      },
      {
        "title": "Daniel Abadi: Consistency Tradeoffs in Modern Distributed Database System Design (IEEE Computer, 2012)",
        "url": "https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf"
      }
    ]
  },
  "mvcc": {
    "title": "MVCC",
    "video": {
      "youtubeId": "TBmDBw1IIoY",
      "title": "PostgreSQL Internals in Action: MVCC",
      "channel": "Denis Magda",
      "why": "Live demo inspecting xmin/xmax and tuple versions while concurrent transactions run: exactly the tuple-header mechanics this lesson describes.",
      "length": "16:06"
    },
    "videos": [
      {
        "youtubeId": "AveRgUrC7FM",
        "title": "Postgres System Columns Explained (ctid, xmin,xmax)",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Explores ctid, xmin and xmax hands-on, showing how UPDATE creates a new tuple and moves ctid.",
        "length": "26:28"
      },
      {
        "youtubeId": "niLwbfE3V9Q",
        "title": "#19 - Multi-Version Concurrency Control (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "Lecture comparing MVCC designs (append-only vs time-travel vs delta/undo storage, garbage collection) across Postgres, MySQL and Oracle.",
        "length": "1:27:07"
      }
    ],
    "intuition": "<p>MVCC is like Wikipedia's page history. When someone edits an article, the old revision is not erased. A new revision is added, stamped with who made it and when. A reader who opened the page earlier keeps seeing the revision that was current when they started, while editors keep working. Periodically a janitor deletes revisions nobody could possibly still be looking at.</p><p><strong>Mental model:</strong> every row version carries <em>born-at</em> and <em>died-at</em> transaction IDs. Each transaction has a snapshot saying which IDs count as committed, and it sees exactly the versions alive in that snapshot. Readers never wait for writers.</p><ul><li><strong>\"MVCC means no locks\":</strong> two writers updating the same row still conflict. The second blocks on a row lock, and at Repeatable Read it gets a serialization error.</li><li><strong>Long-running transactions:</strong> one idle-in-transaction session holds back the oldest visible snapshot, so VACUUM cannot remove any dead versions newer than it and every table bloats.</li><li><strong>Transaction ID wraparound:</strong> PostgreSQL XIDs are 32-bit. If vacuum cannot freeze old rows, the database eventually refuses writes to protect data.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Multi-Version Concurrency Control (MVCC)</h2>\n      <p>In older database engines, readers blocked writers and writers blocked readers using shared and exclusive page locks. <strong>Multi-Version Concurrency Control (MVCC)</strong> eliminates read-write lock contention by ensuring that <em>readers never block writers, and writers never block readers</em>. (Writers updating the same row still block each other.)</p>\n\n      <h2>PostgreSQL MVCC Tuple Header Anatomy</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    subgraph TupleHeader [\"Physical Heap Tuple Header (23 Bytes)\"]\n      XMIN[\"xmin (32-bit: Creating Transaction ID)\"]\n      XMAX[\"xmax (32-bit: Deleting/Updating Transaction ID)\"]\n      CID[\"t_cid (Command ID in Transaction)\"]\n      TUP[\"Tuple Data Payload\"]\n    end\n      </div>\n\n      <h2>How Mutations Work in MVCC</h2>\n      <h3>1. Updating a Row (No In-Place Overwrites in PostgreSQL)</h3><p>This append-in-heap design is PostgreSQL's. InnoDB and Oracle instead update rows in place and keep old versions in undo logs (see the table below).</p>\n      <p>When you execute <code>UPDATE users SET email = 'new@corp.com' WHERE id = 1;</code>, PostgreSQL does <strong>not</strong> overwrite the existing bytes on disk:</p>\n      <ol>\n        <li>It records the current transaction ID into the old tuple's <code>xmax</code> field, marking it dead to future transactions.</li>\n        <li>It writes an entirely new tuple onto a disk page with <code>xmin = current_tx_id</code> and <code>xmax = 0</code>.</li>\n        <li>The old tuple remains on disk so active concurrent read transactions can continue reading the old version consistent with their snapshot.</li>\n      </ol>\n\n      <h3>2. The Vacuum Requirement (Dead Tuple Bloat)</h3>\n      <p>Because updates and deletes create dead tuples on disk, disk space bloats over time. The <strong>VACUUM daemon</strong> scans table pages, checks if any active transaction can still observe old versions, and marks the space of dead tuples as reusable within each page. Plain VACUUM returns space to the operating system only by truncating empty pages at the end of the table; shrinking a bloated table needs <code>VACUUM FULL</code> or pg_repack.</p>\n    \n<!-- enriched -->\n<h2>Worked example: two snapshots, one row</h2><p>Row <code>users id=1</code> is inserted by transaction 100, so it has xmin=100 and xmax=0.</p><table><thead><tr><th>Step</th><th>Action</th><th>Heap tuples for id=1</th></tr></thead><tbody><tr><td>1</td><td>T200 begins (Repeatable Read) and takes snapshot: sees commits up to 199</td><td>v1 (xmin 100, xmax 0)</td></tr><tr><td>2</td><td>T201 runs <code>UPDATE users SET email = 'b' WHERE id = 1</code></td><td>v1 (xmin 100, xmax 201), v2 (xmin 201, xmax 0)</td></tr><tr><td>3</td><td>T201 commits</td><td>unchanged; commit status recorded in the commit log (pg_xact)</td></tr><tr><td>4</td><td>T200 reads id=1</td><td>v1 is visible (201 is not in its snapshot) and v2 is invisible, so it sees the old email</td></tr><tr><td>5</td><td>New T202 reads id=1</td><td>v1 is dead (xmax 201 committed) and v2 is visible, so it sees 'b'</td></tr><tr><td>6</td><td>T200 ends, then VACUUM runs</td><td>v1 is no longer visible to anyone and its space is reclaimed</td></tr></tbody></table><h3>Where the old versions live</h3><table><thead><tr><th>Engine</th><th>Old versions stored in</th><th>Consequence</th></tr></thead><tbody><tr><td>PostgreSQL</td><td>The table heap itself (new tuple per update)</td><td>Table and index bloat; needs VACUUM; HOT updates avoid index writes when no indexed column changes</td></tr><tr><td>MySQL InnoDB</td><td>Undo log (row updated in place, previous image in undo)</td><td>Readers rebuild old versions by walking undo; a long transaction makes the history list grow</td></tr><tr><td>Oracle</td><td>Undo tablespace</td><td>\"Snapshot too old\" error if undo is overwritten before a long query finishes</td></tr><tr><td>CockroachDB</td><td>Multiple timestamped keys in the LSM</td><td>Garbage collected after gc.ttlseconds (default 4 hours in current versions)</td></tr></tbody></table><h3>Numbers that matter</h3><ul><li>An UPDATE-heavy table doing 1,000 updates/s produces 86M dead tuples per day. Default autovacuum triggers at 20% dead rows, which is too lazy for large hot tables. Set per-table scale factors near 0.01-0.05.</li><li>XID wraparound: about 2 billion transactions of headroom. At 20k transactions/s that is roughly 28 hours if freezing stalls completely, so monitor <code>age(datfrozenxid)</code>.</li></ul><h3>Failure modes</h3><ul><li><strong>Idle in transaction:</strong> set <code>idle_in_transaction_session_timeout</code>.</li><li><strong>Replica feedback:</strong> <code>hot_standby_feedback</code> on replicas also holds back vacuum on the primary.</li><li><strong>Write-write conflicts:</strong> at Repeatable Read, updating a row changed after your snapshot raises \"could not serialize access due to concurrent update\", so retry.</li></ul>\n</div>",
    "keyTakeaways": [
      "MVCC ensures readers never block writers and writers never block readers by maintaining multiple tuple versions.",
      "In PostgreSQL, updates never modify data in place; they set xmax on the old tuple and insert a new tuple with xmin (InnoDB and Oracle update in place and keep old versions in undo).",
      "Dead tuples accumulate on disk until VACUUM marks their space reusable (VACUUM FULL or pg_repack is needed to shrink the file)."
    ],
    "furtherReading": [
      {
        "title": "The Internals of PostgreSQL: Chapter 5 - Concurrency Control",
        "url": "https://www.interdb.jp/pg/pgsql05.html"
      },
      {
        "title": "Berenson et al.: A Critique of ANSI SQL Isolation Levels (Microsoft Research)",
        "url": "https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/"
      }
    ]
  },
  "database-wal-and-recovery": {
    "title": "Database WAL and recovery",
    "video": {
      "youtubeId": "s3hKYMOpp3E",
      "title": "Write-Ahead Logs. The secret to fast database queries.",
      "channel": "Ben Dicken",
      "why": "Ben Dicken (PlanetScale) animates the WAL write path, fsync, checkpoints and crash replay with excellent visuals: the clearest current explanation.",
      "length": "11:11"
    },
    "videos": [
      {
        "youtubeId": "wI4hKwl1Cn4",
        "title": "How does the database guarantee reliability using write-ahead logging?",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "The previous pick and still good: longer first-principles treatment of the WAL invariant and recovery.",
        "length": "22:06"
      },
      {
        "youtubeId": "yVpzHdAP0TY",
        "title": "#21 - Database Recovery with ARIES (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "Full lecture on ARIES analysis/redo/undo, LSNs and compensation log records.",
        "length": "1:12:55"
      }
    ],
    "intuition": "<p>A WAL is a pilot's flight log or a shop's receipt roll. The shopkeeper does not reorganize the stockroom after every sale. They write a line on the receipt roll (\"sold 2 apples\"), which is quick because it only ever appends, and tidy the shelves later. If the lights go out mid-day, they replay the roll from the last time the shelves were known to be correct.</p><p><strong>Mental model:</strong> <em>log first, data later.</em> A commit is durable once its log record is on stable storage. Data pages are flushed lazily, and after a crash the log is replayed to rebuild anything that did not reach the data files.</p><ul><li><strong>Thinking commit writes the table:</strong> it does not. It fsyncs the WAL. Table pages may stay dirty in memory for minutes.</li><li><strong>Disabling fsync for benchmarks:</strong> <code>fsync=off</code> or write-back caches without battery backup can corrupt the database after a power loss, not just lose recent commits.</li><li><strong>Checkpoint tuning ignored:</strong> checkpoints that are too frequent cause I/O spikes and full-page-write WAL bloat. Too rare, and crash recovery takes much longer.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Write-Ahead Logging & The ARIES Protocol</h2>\n      <p>When a transaction commits, writing modified data pages to random locations on disk would require dozens of slow random I/O seeks. To achieve both ACID durability and high throughput, relational databases enforce the <strong>Write-Ahead Logging (WAL) invariant</strong>: <em>No data page may be written to physical disk until the corresponding log entry recording the change is safely flushed to non-volatile storage</em>.</p>\n\n      <h2>The WAL Commit and Checkpoint Lifecycle</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Tx[\"Client Commit Transaction\"] --> WALBuffer[\"Append Record to In-Memory WAL Buffer\"]\n    WALBuffer -->|\"1. fsync() to Disk (group commit batches many transactions)\"| WALDisk[(\"WAL Log on Disk: O_APPEND (Sequential)\")]\n    WALDisk --> Ack[\"2. Return COMMIT OK to Client\"]\n    \n    subgraph AsyncBackground [\"Asynchronous Dirty Page Flusher\"]\n      Dirty[\"Dirty Pages in Shared Buffers (DRAM)\"] -->|\"3. Lazy write / Checkpoint (PostgreSQL default checkpoint_timeout: 5 min)\"| DataFile[(\"Database Table Pages (NVMe Disk)\")]\n    end\n      </div>\n\n      <h2>Under the Hood: Crash Recovery (ARIES Algorithm)</h2>\n      <p>If power fails, dirty pages in memory are lost. Upon reboot, ARIES-style engines (InnoDB, SQL Server, DB2) execute the three phases of the <strong>ARIES protocol (Algorithms for Recovery and Isolation Exploiting Semantics)</strong>. PostgreSQL uses a redo-only variant: it replays WAL from the last checkpoint's redo point and relies on MVCC to keep uncommitted changes invisible, so it has no undo phase or CLRs.</p>\n      <ul>\n        <li><strong>1. Analysis Phase:</strong> Scans the WAL forward from the last successful checkpoint to identify active transactions and dirty pages at the instant of failure.</li>\n        <li><strong>2. Redo Phase:</strong> Rolls the database forward starting from the smallest recLSN in the dirty page table (which can be earlier than the checkpoint), reapplying all changes (even for transactions that were subsequently aborted) to restore the exact physical state before the crash.</li>\n        <li><strong>3. Undo Phase:</strong> Scans backward, rolling back all transactions that were still uncommitted at the moment of the crash and writing Compensating Log Records (CLRs).</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: why group commit matters</h2><p>An NVMe SSD with power-loss protection completes an fsync in roughly 0.05-0.5 ms. A consumer SSD or cloud network volume may take 1-10 ms.</p><ul><li>With one fsync per commit at 2 ms per fsync, a single connection manages at most about 500 commits/s.</li><li>With <strong>group commit</strong>, the WAL writer flushes all commit records waiting in the buffer with one fsync. If 50 sessions commit within the same 2 ms window, one fsync makes all 50 durable, giving about 25,000 commits/s on the same disk.</li><li><code>synchronous_commit = off</code> in PostgreSQL acknowledges before the fsync. You may lose the last few hundred milliseconds of commits (about 3x <code>wal_writer_delay</code>) on a crash, but the database will not corrupt. It is a durability trade-off, not a consistency one.</li></ul><h3>Crash recovery timeline</h3><div class=\"mermaid\">sequenceDiagram\nparticipant C as \"Client\"\nparticipant B as \"Buffer pool\"\nparticipant W as \"WAL on disk\"\nparticipant D as \"Data files\"\nC->>B: \"UPDATE row, page dirtied in RAM\"\nB->>W: \"Append WAL record LSN 1000\"\nC->>W: \"COMMIT: fsync WAL up to LSN 1000\"\nW-->>C: \"COMMIT OK\"\nNote over B,D: \"Crash before page flush\"\nD->>W: \"Restart: find last checkpoint REDO point\"\nW->>D: \"Replay records after REDO point\"\nD-->>C: \"Database consistent, commit preserved\"\n</div><h3>Trade-offs in WAL configuration</h3><table><thead><tr><th>Setting</th><th>Lower value</th><th>Higher value</th></tr></thead><tbody><tr><td>checkpoint_timeout / max_wal_size</td><td>Faster recovery, more I/O and full-page writes</td><td>Smoother I/O, longer recovery after a crash</td></tr><tr><td>synchronous_commit</td><td>off: faster, may lose recent commits</td><td>remote_apply: waits for a replica, slower but no data loss on failover</td></tr><tr><td>full_page_writes</td><td>off: less WAL but torn pages possible</td><td>on (default): protects against partial 8 KB writes</td></tr></tbody></table><h3>How real systems use the log</h3><ul><li><strong>PostgreSQL:</strong> redo-only WAL. There is no undo phase, because MVCC makes aborted tuples invisible and vacuum removes them later. The same WAL feeds streaming replication and logical decoding (CDC).</li><li><strong>MySQL InnoDB:</strong> redo log plus separate undo logs, which is closer to ARIES. The binlog is a second, logical log used for replication, coordinated with the redo log via two-phase commit.</li><li><strong>Aurora and Neon:</strong> \"the log is the database\". Compute ships only WAL to a distributed storage layer, which materializes pages itself.</li><li><strong>Kafka and Raft:</strong> the same append-only log idea generalized to distributed systems.</li></ul>\n</div>",
    "keyTakeaways": [
      "The WAL invariant guarantees durability by flushing sequential append-only logs before dirty data pages touch disk.",
      "Transactions commit as soon as their WAL records are fsynced; data pages are flushed asynchronously in the background.",
      "The ARIES recovery protocol restores consistency after sudden power failure via Analysis, Redo, and Undo phases."
    ],
    "furtherReading": [
      {
        "title": "Mohan et al.: ARIES: A Transaction Recovery Method (IBM Research)",
        "url": "https://cs.stanford.edu/people/chrismre/cs345/rl/aries.pdf"
      },
      {
        "title": "PostgreSQL Documentation: Write-Ahead Logging (WAL)",
        "url": "https://www.postgresql.org/docs/current/wal-intro.html"
      }
    ]
  },
  "database-ticket-servers": {
    "title": "Database ticket servers",
    "video": {
      "youtubeId": "ogOKDhOa_cs",
      "title": "System Design - Part 12 | Design a Unique ID Generator | 4 Methods",
      "channel": "Nikhil Lohia",
      "why": "Walks through multi-master auto-increment, UUID, ticket server and Snowflake side by side, so the ticket-server approach is explained in context with its trade-offs.",
      "length": "20:52"
    },
    "videos": [
      {
        "youtubeId": "W6qURtqrldc",
        "title": "L15: Distributed System Design Example (Unique ID)",
        "channel": "Distributed Systems Course",
        "role": "deep-dive",
        "why": "Chris Colohan's lecture reasons from first principles through centralized counters, range allocation and decentralized schemes.",
        "length": "12:51"
      }
    ],
    "intuition": "<p>A ticket server is the \"take a number\" dispenser at a deli counter. Every customer pulls the next number from one machine, so numbers never repeat. To keep the line moving when one dispenser jams, Flickr put two dispensers side by side, one printing only odd numbers and the other only even ones.</p><p><strong>Mental model:</strong> <em>centralize only the counter</em>. Shards stay independent, and a tiny, dedicated database hands out globally unique 64-bit integers. Better still, it hands out whole blocks of them so that callers rarely need to ask.</p><ul><li><strong>Expecting global ordering:</strong> with two servers, ID 1001 may be issued after 1004. IDs are unique, not strictly time-ordered.</li><li><strong>One round trip per ID:</strong> at 50k inserts/s, a network hop per ID is the bottleneck. Lease ranges (for example 1,000 IDs at a time) and hand them out from memory.</li><li><strong>Gaps are normal:</strong> crashed callers, rolled-back transactions and unused leased ranges all leave holes. Never use these IDs for anything needing gap-free numbering, such as invoice numbers.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Flickr Ticket Servers and ID Generation</h2>\n      <p>Before Twitter created Snowflake, large-scale sharded MySQL databases (pioneered by Flickr in 2006) solved unique 64-bit ID generation across independent database shards using dedicated <strong>Ticket Servers</strong>.</p>\n\n      <h2>Dual Ticket Server Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"App Server Fleet\"] --> LB{\"Client-side round-robin (parity comes from each server's auto_increment_offset)\"}\n    \n    subgraph TicketServers [\"Dedicated Ticket Server Pair\"]\n      TS1[\"Ticket Server 1 (Generates Odd IDs)\"]\n      TS2[\"Ticket Server 2 (Generates Even IDs)\"]\n    end\n    \n    LB --> TS1\n    LB --> TS2\n    \n    TS1 --> S1[\"id = id + 2 (1, 3, 5, 7...)\"]\n    TS2 --> S2[\"id = id + 2 (2, 4, 6, 8...)\"]\n      </div>\n\n      <h2>Under the Hood: The MySQL REPLACE INTO Trick</h2>\n      <p>To generate sequential IDs without table bloat, Flickr used a 1-row table with <code>auto_increment_increment</code> and <code>auto_increment_offset</code>:</p>\n      <pre><code>-- Ticket Server Configuration\n-- Server 1: offset = 1, increment = 2 (Generates: 1, 3, 5, 7...)\n-- Server 2: offset = 2, increment = 2 (Generates: 2, 4, 6, 8...)\n\nCREATE TABLE Tickets64 (\n    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,\n    stub CHAR(1) NOT NULL DEFAULT '',\n    PRIMARY KEY (id),\n    UNIQUE KEY stub (stub)\n) ENGINE=InnoDB;\n\n-- Atomically update the single row and return the generated 64-bit ID\nREPLACE INTO Tickets64 (stub) VALUES ('a');\nSELECT LAST_INSERT_ID();\n      </code></pre>\n      <p><strong>Limitations:</strong> Requires a network round-trip for every ID generation, IDs from the two servers are not globally time-ordered, and scaling beyond two servers means reconfiguring every server's offset and increment. Running two independent servers is what removes the single point of failure: if one dies, clients keep drawing IDs from the other.</p>\n    \n<!-- enriched -->\n<h2>Worked example: range leasing (the \"segment\" or hi/lo pattern)</h2><p>Instead of one round trip per ID, each app server leases a block:</p><p><code>UPDATE id_alloc SET max_id = max_id + 1000 WHERE biz_tag = 'orders' RETURNING max_id;</code></p><p>If this returns 51000, the server owns IDs 50001-51000 and serves them from an in-memory counter.</p><ul><li><strong>Load:</strong> 100 app servers at 2,000 IDs/s each is 200k IDs/s. With 1,000-ID blocks, the allocator sees only 200 UPDATEs/s, which a single Postgres or MySQL handles easily.</li><li><strong>Waste on restart:</strong> a server that crashes loses at most 1,000 unused IDs. Out of 2^63, that is irrelevant.</li><li><strong>Latency spikes:</strong> fetch the next block asynchronously when the current one is 20% remaining (a double buffer), so no request ever waits on the allocator.</li></ul><h3>Comparison with the alternatives</h3><table><thead><tr><th>Scheme</th><th>Size</th><th>Ordering</th><th>Coordination</th><th>Main risk</th></tr></thead><tbody><tr><td>Single auto-increment</td><td>64-bit</td><td>Strict</td><td>Every insert</td><td>Single point of failure and throughput ceiling</td></tr><tr><td>Flickr odd/even ticket servers</td><td>64-bit</td><td>Roughly increasing</td><td>Every ID (one round trip)</td><td>Adding a third server needs reconfiguring offsets</td></tr><tr><td>Range lease (segment)</td><td>64-bit</td><td>Increasing per server, interleaved globally</td><td>Once per block</td><td>Allocator outage once blocks run out</td></tr><tr><td>Snowflake</td><td>64-bit</td><td>Time-ordered (k-sorted)</td><td>Only worker-ID assignment</td><td>Clock rollback</td></tr><tr><td>UUIDv4 / v7</td><td>128-bit</td><td>None / time-ordered</td><td>None</td><td>Index size (v4: random inserts)</td></tr></tbody></table><h3>Failure modes</h3><ul><li><strong>Both ticket servers configured with the same offset</strong> after a rebuild produces duplicate IDs. Guard with a startup check against the max ID already issued.</li><li><strong>Restoring a ticket server from an old backup</strong> rewinds the counter and reissues IDs. Always bump the counter well past the last known value after a restore.</li><li><strong>REPLACE INTO</strong> deletes and reinserts the row. Under heavy concurrency on InnoDB this can cause lock waits. Flickr's load was fine, but range leasing scales further.</li></ul><p><strong>Who does this:</strong> Flickr (2010 blog post, \"Ticket Servers: Distributed Unique Primary Keys on the Cheap\"), Meituan's Leaf-segment, Hibernate's hi/lo and pooled optimizers, and database sequences with <code>CACHE n</code> use the same leasing idea.</p>\n</div>",
    "keyTakeaways": [
      "Ticket servers generate unique, roughly increasing (not globally time-ordered) IDs across sharded databases using odd/even increments.",
      "MySQL REPLACE INTO generates auto-increment IDs on a single row without unbounded table bloat.",
      "Modern high-throughput systems prefer coordinate-free ID generators (Snowflake / UUIDv7) to avoid network hops."
    ],
    "furtherReading": [
      {
        "title": "Flickr Engineering: Ticket Servers: Distributed Unique Primary Keys on the Cheap",
        "url": "https://code.flickr.net/2010/02/08/ticket-servers-distributed-unique-primary-keys-on-the-cheap/"
      },
      {
        "title": "Twitter Engineering: Announcing Snowflake",
        "url": "https://blog.twitter.com/engineering/en_us/a/2010/announcing-snowflake"
      }
    ]
  },
  "relational-database-scaling": {
    "title": "Relational database scaling",
    "video": {
      "youtubeId": "_1IKwnbscQU",
      "title": "7 Must-know Strategies to Scale Your Database",
      "channel": "ByteByteGo",
      "why": "Covers the same ladder as the lesson (indexing, vertical scaling, caching, replication, partitioning, sharding) with clear diagrams and when to use each.",
      "length": "8:42"
    },
    "videos": [
      {
        "youtubeId": "iHNovZUZM3A",
        "title": "When should you shard your database?",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Argues for exhausting replicas, partitioning and caching first, and explains the operational cost sharding introduces.",
        "length": "21:20"
      },
      {
        "youtubeId": "P3mV3atVL2Q",
        "title": "How Figma built DBProxy for sharding Postgres",
        "channel": "pganalyze",
        "role": "case-study",
        "why": "Real-world case: Figma's move from vertical partitioning to horizontal sharding of Postgres via a query-routing proxy.",
        "length": "7:14"
      }
    ],
    "intuition": "<p>Scaling a database is like growing a restaurant. First you buy a bigger stove (vertical scaling). Then you hire waiters who only read the menu to customers (read replicas). Then you split into a bakery and a grill in separate kitchens (functional split). Only when one kitchen still cannot keep up do you open franchises that each serve a slice of customers (sharding), and from then on every \"combined\" order across franchises is expensive.</p><p><strong>Mental model:</strong> each step up the ladder buys capacity by giving up some guarantee: freshness (replicas), cross-domain joins (functional split), and single-node transactions and constraints (sharding). Climb only as far as measured load forces you.</p><ul><li><strong>Sharding too early:</strong> a single modern Postgres or MySQL box with 64+ cores, 512 GB of RAM and NVMe can serve tens of thousands of transactions per second and multiple terabytes.</li><li><strong>Ignoring replica lag in reads:</strong> read-after-write on a replica is a common source of \"my change disappeared\" bugs.</li><li><strong>Picking a shard key by data size alone:</strong> choose it by your most frequent access path (usually tenant or user), so most queries hit exactly one shard.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Read Replicas vs. Horizontal Sharding</h2>\n      <p>Scaling a relational database follows a predictable operational progression as traffic and data volume expand beyond single-host physical limits:</p>\n\n      <h2>The Progression of Relational Scaling</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Step1[\"1. Vertical Scaling: Upgrade CPU / RAM / NVMe\"] --> Step2[\"2. Read Replicas: Asynchronous WAL streaming (Offload SELECTs)\"]\n    Step2 --> Step3[\"3. Functional Decomposition: Separate Users, Orders, Billing into distinct DBs\"]\n    Step3 --> Step4[\"4. Horizontal Sharding: Partition single table across N database nodes\"]\n      </div>\n\n      <h2>Replication Lag & Read-Your-Own-Writes</h2>\n      <p>Adding read replicas offloads read volume. However, because replication is asynchronous, replicas lag behind the primary by tens or hundreds of milliseconds. If a user updates their profile and immediately refreshes the page, routing the read to a replica returns old data.</p>\n      <p><strong>Read-Your-Own-Writes Pattern:</strong> The application tracks the user's latest mutation timestamp. If <code>now() - last_write &lt; replication_lag_threshold</code> (e.g., 2 seconds; a heuristic, see the LSN-based version below), route the read to the <strong>primary database</strong>; otherwise, route to read replicas.</p>\n\n      <h2>Horizontal Sharding Challenges</h2>\n      <ul>\n        <li><strong>Cross-Shard Joins:</strong> Joining data across shards requires distributed scatter-gather queries in application memory, destroying performance.</li>\n        <li><strong>Two-Phase Commit (2PC):</strong> Atomic multi-shard transactions add at least one extra network round trip and a forced log write per participant, hold locks for that whole window, and block participants if the coordinator fails.</li>\n        <li><strong>Re-Sharding:</strong> Doubling shards requires moving terabytes of data over live production traffic without write downtime.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: when does each rung stop working?</h2><p>Suppose an app has 30,000 reads/s, 3,000 writes/s, 4 TB of data growing 150 GB/month, and a primary on 32 vCPUs.</p><ul><li><strong>Vertical:</strong> moving to 96 vCPUs and 768 GB of RAM keeps the hot set cached. That buys perhaps 2-3x on reads, less on writes if WAL fsync or lock contention is the limit.</li><li><strong>Replicas:</strong> 4 replicas at about 10k reads/s each absorb reads easily. Writes are unchanged, because every replica must replay all 3,000 writes/s.</li><li><strong>Functional split:</strong> moving the analytics/events tables (60% of writes) to their own cluster or a columnar store leaves the primary at about 1,200 writes/s.</li><li><strong>Sharding:</strong> needed only if single-primary writes, storage (for example over 10-20 TB per node, where backups and restores take too long), or blast radius become the limit.</li></ul><h3>Trade-off table</h3><table><thead><tr><th>Technique</th><th>Scales</th><th>You lose</th><th>Typical operational cost</th></tr></thead><tbody><tr><td>Vertical scaling</td><td>Everything, up to hardware limits</td><td>Nothing, except cost and one big failure domain</td><td>Low</td></tr><tr><td>Read replicas</td><td>Reads</td><td>Read-your-writes on replicas</td><td>Low-medium: lag monitoring, routing</td></tr><tr><td>Caching</td><td>Hot reads</td><td>Freshness; invalidation complexity</td><td>Medium</td></tr><tr><td>Table partitioning (same node)</td><td>Maintenance: vacuum, index size, retention drops</td><td>Some cross-partition uniqueness</td><td>Low-medium</td></tr><tr><td>Functional split</td><td>Writes per domain</td><td>Cross-domain joins and transactions</td><td>Medium</td></tr><tr><td>Horizontal sharding</td><td>Writes and storage, near-linearly</td><td>Cross-shard joins, global constraints, simple transactions</td><td>High: routing, resharding, schema changes on N shards</td></tr></tbody></table><h3>Read-your-writes, done precisely</h3><p>A time threshold (\"route to the primary for 2 s after a write\") is a heuristic. A precise version records the primary's WAL position after the write (<code>pg_current_wal_lsn()</code>) in the user's session, and reads from a replica only if its <code>pg_last_wal_replay_lsn()</code> is at or beyond that position. MySQL offers the equivalent with GTIDs (<code>WAIT_FOR_EXECUTED_GTID_SET</code>).</p><h3>How real companies climbed the ladder</h3><ul><li><strong>Figma:</strong> vertical partitioning by table groups first, then horizontal sharding with a custom proxy (DBProxy), keeping Postgres.</li><li><strong>Notion:</strong> sharded Postgres by workspace ID into 480 logical shards on 32 physical hosts, later expanded to 96.</li><li><strong>Shopify:</strong> \"pods\" that each hold a set of shops in their own MySQL, and moves shops between pods to fix hotspots.</li><li><strong>Instagram:</strong> thousands of logical shards mapped onto fewer Postgres servers, with IDs embedding the shard number.</li></ul>\n</div>",
    "keyTakeaways": [
      "Read replicas scale reads but introduce asynchronous replication lag.",
      "Enforce Read-Your-Own-Writes by routing recent writers to the primary database.",
      "Horizontal sharding provides horizontal scale but sacrifices cross-shard joins and ACID atomicity."
    ],
    "furtherReading": [
      {
        "title": "Vitess Documentation: What Is Vitess",
        "url": "https://vitess.io/docs/overview/whatisvitess/"
      },
      {
        "title": "Notion: Herding elephants: Lessons learned from sharding Postgres at Notion",
        "url": "https://www.notion.com/blog/sharding-postgres-at-notion"
      }
    ]
  },
  "online-indexing": {
    "title": "Online indexing",
    "video": {
      "youtubeId": "ykVumkmkbik",
      "title": "Why create Index blocks writes",
      "channel": "Hussein Nasser",
      "why": "Explains exactly why a plain CREATE INDEX blocks writes and how CREATE INDEX CONCURRENTLY works around it, including its cost.",
      "length": "11:16"
    },
    "videos": [
      {
        "youtubeId": "kKNZsGezZ4g",
        "title": "Anatomy of Table-Level Locks in PostgreSQL / Gulcin Yildirim Jelinek (xata.io)",
        "channel": "CSPUG",
        "role": "deep-dive",
        "why": "Conference talk mapping each DDL command to the lock it takes and how lock queues cause outages, which is essential context for online index builds.",
        "length": "45:54"
      }
    ],
    "intuition": "<p>Building an index on a busy table is like repainting road markings on a highway. The simple way is to close the road (block writes) until the paint dries. The online way keeps traffic flowing: paint one lane while cars use the others, then go back and touch up whatever the cars smudged, and only then open the new lanes. It takes longer and needs more passes, but nobody is stuck in a jam.</p><p><strong>Mental model:</strong> an online index build = <em>snapshot-build from existing rows + catch-up of changes made meanwhile + a short validation</em>, done under a weak lock that allows reads and writes.</p><ul><li><strong>Running it inside a transaction or migration wrapper:</strong> <code>CREATE INDEX CONCURRENTLY</code> cannot run inside a transaction block. Many migration tools wrap DDL in one by default.</li><li><strong>Ignoring the lock queue:</strong> even brief DDL locks wait behind long-running queries, and every new query then queues behind the DDL. Always set <code>lock_timeout</code>.</li><li><strong>Leaving INVALID indexes behind:</strong> a failed concurrent build leaves an index that is maintained on every write but never used for reads.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Non-Blocking Index Creation in Production</h2>\n      <p>Executing a standard <code>CREATE INDEX idx_orders ON orders(created_at);</code> on a 500,000,000-row table takes a <code>SHARE</code> lock for the whole build. This blocks all incoming <code>INSERT</code>, <code>UPDATE</code>, and <code>DELETE</code> statements (reads still proceed). In production, this causes application connection pools to exhaust within seconds, triggering an immediate site outage.</p>\n\n      <h2>PostgreSQL CREATE INDEX CONCURRENTLY Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Start[\"CREATE INDEX CONCURRENTLY\"] --> Scan1[\"Phase 1: Register index in catalog as invalid (SHARE UPDATE EXCLUSIVE lock), then wait for transactions that modified the table\"]\n    Scan1 --> Scan2[\"Phase 2: Full table scan to build B-Tree from existing tuples\"]\n    Scan2 --> Scan3[\"Phase 3: Index marked ready so ordinary writes maintain it, then a second scan adds tuples missed by Phase 2\"]\n    Scan3 --> Validate[\"Phase 4: Wait for older snapshots, then mark index VALID for the query planner\"]\n      </div>\n\n      <h2>Under the Hood: The Cost and Failure Modes of CONCURRENTLY</h2>\n      <ul>\n        <li><strong>Two Full Table Scans:</strong> Because it avoids taking a lock that blocks writes, <code>CONCURRENTLY</code> must scan the entire multi-gigabyte table twice, taking significantly longer than a standard index build.</li>\n        <li><strong>Invalid Indexes (Failed Builds):</strong> If a deadlock, a uniqueness violation, a cancellation, or a lock or statement timeout interrupts the build, the index is left in an <code>INVALID</code> state. It does not speed up reads, but <strong>continues to slow down every future write</strong>. You must detect and drop invalid indexes:\n          <pre><code>SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;\nDROP INDEX CONCURRENTLY IF EXISTS idx_orders_broken;\n          </code></pre>\n        </li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: adding an index to a 500M-row table</h2><p>Suppose the <code>orders</code> table is 500M rows and about 120 GB, with 4,000 writes/s.</p><table><thead><tr><th>Approach</th><th>Lock held</th><th>Writes blocked?</th><th>Approximate duration</th></tr></thead><tbody><tr><td><code>CREATE INDEX</code></td><td>SHARE (whole build)</td><td>Yes, for the whole build (reads OK)</td><td>About 20-40 min at 100-200 MB/s scan plus sort</td></tr><tr><td><code>CREATE INDEX CONCURRENTLY</code></td><td>SHARE UPDATE EXCLUSIVE</td><td>No</td><td>About 2-3x longer: two table scans plus waits for old transactions</td></tr><tr><td>MySQL 8 <code>ALTER TABLE ... ADD INDEX, ALGORITHM=INPLACE, LOCK=NONE</code></td><td>Brief metadata lock at start and end</td><td>No (changes buffered in an online log)</td><td>Similar to a normal build, plus log apply</td></tr><tr><td>gh-ost / pt-online-schema-change</td><td>Brief lock at cut-over</td><td>No</td><td>Hours: copies the whole table</td></tr></tbody></table><p>With 4,000 writes/s, a blocking 30-minute build would stall about 7.2M writes. Connection pools fill within seconds and the site goes down, which is why production uses the concurrent form.</p><h3>Safe runbook (PostgreSQL)</h3><ul><li><code>SET lock_timeout = '5s';</code> so the build gives up instead of queuing everyone behind it.</li><li><code>SET maintenance_work_mem = '2GB';</code> for faster sorts, and consider <code>max_parallel_maintenance_workers</code>.</li><li><code>CREATE INDEX CONCURRENTLY idx_orders_created ON orders(created_at);</code></li><li>Verify: <code>SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;</code> If the new index is listed, <code>DROP INDEX CONCURRENTLY</code> it and retry.</li><li>Watch progress in <code>pg_stat_progress_create_index</code>.</li></ul><div class=\"mermaid\">flowchart TD\nA[\"Create catalog entry, index marked not ready\"] --> B[\"Wait for all transactions that could miss the index\"]\nB --> C[\"Scan 1: build index from a snapshot\"]\nC --> D[\"Mark ready: new writes now maintain it\"]\nD --> E[\"Scan 2: validate and insert rows missed by scan 1\"]\nE --> F[\"Wait for older snapshots to finish\"]\nF --> G[\"Mark valid: planner may use it\"]\n</div><h3>Failure modes</h3><ul><li><strong>Waiting forever:</strong> CIC waits for every transaction older than its snapshot. One forgotten idle-in-transaction session stalls the build indefinitely.</li><li><strong>Unique index violations:</strong> a concurrent unique build fails if duplicates arrive mid-build, leaving an invalid index.</li><li><strong>Replica lag:</strong> the build generates heavy WAL, and replicas may lag during it.</li></ul>\n</div>",
    "keyTakeaways": [
      "Standard CREATE INDEX takes a SHARE lock that blocks all writes (not reads) for the whole build, causing production write outages.",
      "CREATE INDEX CONCURRENTLY uses a multi-phase build that allows uninterrupted concurrent writes.",
      "Failed concurrent index builds leave INVALID indexes on disk that slow writes until explicitly dropped."
    ],
    "furtherReading": [
      {
        "title": "PostgreSQL Documentation: Building Indexes Concurrently",
        "url": "https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY"
      },
      {
        "title": "MySQL 8.0 Reference Manual: InnoDB and Online DDL",
        "url": "https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl.html"
      }
    ]
  },
  "schema-evolution": {
    "title": "Schema evolution",
    "video": {
      "youtubeId": "cw5K2O4AHJc",
      "title": "How do software projects achieve zero downtime database migrations?",
      "channel": "Web Dev Cody",
      "why": "Concise, concrete walkthrough of the expand, dual-write, backfill and contract sequence for renaming a column while old and new app versions run side by side.",
      "length": "7:06"
    },
    "videos": [
      {
        "youtubeId": "2zksJnRSgv0",
        "title": "gh-ost: GitHub's online schema migrations tool for MySQL - GitHub Universe 2016",
        "channel": "GitHub",
        "role": "case-study",
        "why": "Shlomi Noach explains why GitHub built triggerless, binlog-driven shadow-table migrations and how the cut-over works.",
        "length": "44:10"
      },
      {
        "youtubeId": "mr_J5v398Qo",
        "title": "Zero-downtime migrations | Postgres.FM 048 | #PostgreSQL #Postgres podcast",
        "channel": "PostgresTV",
        "role": "deep-dive",
        "why": "Postgres experts on lock_timeout, lock queues, NOT VALID constraints and other traps in zero-downtime DDL.",
        "length": "31:33"
      }
    ],
    "intuition": "<p>Changing a live schema is like renovating a hotel while guests are still staying in it. You cannot knock down the old staircase before the new one is built and everyone has been told to use it. You build the new staircase next to the old one, put up signs, wait until nobody uses the old one, and only then remove it.</p><p><strong>Mental model:</strong> <em>every schema change must be compatible with both the currently deployed code and the next version</em>. So you split each breaking change into several small, individually backward-compatible steps (expand, migrate, contract) with deploys in between.</p><ul><li><strong>Rename in one step:</strong> <code>ALTER TABLE ... RENAME COLUMN</code> breaks every running instance of the old code instantly.</li><li><strong>Adding NOT NULL or a foreign key directly:</strong> this validates the whole table under a strong lock. In Postgres, add it as <code>NOT VALID</code> first, then <code>VALIDATE CONSTRAINT</code> separately.</li><li><strong>Dropping too early:</strong> keep the old column until every reader (including batch jobs, analytics and CDC consumers) has moved off it.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Zero-Downtime Database Migrations</h2>\n      <p>Renaming or modifying a database column in a distributed system cannot happen instantaneously. At any moment during a zero-downtime deployment, older application code (v1) and newer application code (v2) run concurrently. The industry standard pattern for zero-downtime schema evolution is the <strong>Expand and Contract Pattern (Parallel Run)</strong>.</p>\n\n      <h2>The Expand and Contract Migration Lifecycle</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    S1[\"1. Expand: Add new column 'full_name' as NULLABLE (v1 app still writes 'name')\"] --> S2[\"2. Dual-Write: v2 app deployed; writes to both 'name' and 'full_name'\"]\n    S2 --> S3[\"3. Backfill: Background batch job copies historical data from 'name' to 'full_name'\"]\n    S3 --> S4[\"4. Switch Reads: v2 app switches all read queries to 'full_name'\"]\n    S4 --> S5[\"5. Contract: Deprecate and drop old 'name' column safely\"]\n      </div>\n\n      <h2>Ghost Tables & Tools (GitHub gh-ost / pt-online-schema-change)</h2>\n      <p>For complex schema mutations (like changing column types or primary keys on MySQL), enterprise teams use shadow table tools. <strong>pt-online-schema-change</strong> keeps the shadow table in sync with triggers; <strong>gh-ost</strong> is triggerless and tails the binary log. The gh-ost flow:</p>\n      <ol>\n        <li>Create a phantom shadow table with the new schema: <code>_orders_new</code>.</li>\n        <li>Stream modifications from the primary database binary log (binlog) to continuously sync inserts/updates into the shadow table.</li>\n        <li>Run a throttled background copier to migrate historical rows without saturating CPU or replication lag.</li>\n        <li>Cut over with an atomic swap (<code>RENAME TABLE orders TO _orders_old, _orders_new TO orders;</code>) coordinated by gh-ost's lock-and-rename algorithm (a sentry table blocks the RENAME until gh-ost is ready). Queries on the table are blocked briefly, and the window depends on waiting for in-flight queries.</li>\n      </ol>\n    \n<!-- enriched -->\n<h2>Worked example: renaming name to full_name on a 200M-row table</h2><table><thead><tr><th>Step</th><th>DDL / code change</th><th>Why it is safe</th></tr></thead><tbody><tr><td>1. Expand</td><td><code>ALTER TABLE users ADD COLUMN full_name text;</code></td><td>A nullable column with no default is a metadata-only change in Postgres and MySQL 8 (instant ADD COLUMN)</td></tr><tr><td>2. Dual-write</td><td>Deploy v2: writes both columns, still reads <code>name</code></td><td>v1 and v2 can coexist; v1 ignores the new column</td></tr><tr><td>3. Backfill</td><td><code>UPDATE users SET full_name = name WHERE id BETWEEN ? AND ? AND full_name IS NULL;</code> in batches of 5-10k rows</td><td>Short transactions, bounded lock time and WAL, throttled on replica lag</td></tr><tr><td>4. Verify</td><td><code>SELECT count(*) WHERE full_name IS DISTINCT FROM name</code> returns 0</td><td>Proves the backfill and dual-writes are correct</td></tr><tr><td>5. Switch reads</td><td>Deploy v3: reads <code>full_name</code>, still dual-writes</td><td>Rollback to v2 remains possible</td></tr><tr><td>6. Stop old writes</td><td>Deploy v4: writes only <code>full_name</code></td><td>Nothing reads <code>name</code> anymore</td></tr><tr><td>7. Contract</td><td><code>ALTER TABLE users DROP COLUMN name;</code> with a lock_timeout</td><td>Metadata-only in Postgres; space is reclaimed on later rewrites</td></tr></tbody></table><p><strong>Backfill math:</strong> 200M rows in 10k-row batches is 20,000 batches. At about 50 ms each plus a 50 ms sleep, that is about 33 minutes, while replicas stay within a second of lag. An unbatched single UPDATE would rewrite 200M tuples in one transaction, doubling table size and blocking vacuum for its whole duration.</p><h3>Which operations are dangerous?</h3><table><thead><tr><th>Change</th><th>PostgreSQL</th><th>MySQL 8 InnoDB</th></tr></thead><tbody><tr><td>Add nullable column</td><td>Instant</td><td>Instant</td></tr><tr><td>Add column with constant default</td><td>Instant (PG 11+)</td><td>Instant (8.0.12+)</td></tr><tr><td>Change column type (int to bigint)</td><td>Full table rewrite under ACCESS EXCLUSIVE</td><td>Table copy; use gh-ost</td></tr><tr><td>Add NOT NULL</td><td>Full scan; use a CHECK constraint NOT VALID, then VALIDATE (PG 12+ can then set NOT NULL without a scan)</td><td>Table rebuild</td></tr><tr><td>Add foreign key</td><td>Use NOT VALID, then VALIDATE CONSTRAINT</td><td>Online, but checks the whole table</td></tr><tr><td>Add index</td><td>CREATE INDEX CONCURRENTLY</td><td>ALGORITHM=INPLACE, LOCK=NONE</td></tr></tbody></table><h3>Failure modes</h3><ul><li><strong>Lock queue pile-up:</strong> even an instant ALTER needs a brief ACCESS EXCLUSIVE lock. If it waits behind a 10-minute report query, all traffic queues behind it. Use <code>SET lock_timeout = '2s'</code> and retry.</li><li><strong>ORM caching:</strong> some ORMs cache column lists (for example Rails' <code>ignored_columns</code> exists for this reason), so dropping a column can break running processes.</li><li><strong>CDC and analytics consumers</strong> (Debezium, warehouses) often break on renames even when the app does not.</li></ul>\n</div>",
    "keyTakeaways": [
      "Never execute breaking schema changes in a single deployment; use the Expand and Contract pattern.",
      "Dual-writing during transitions ensures older and newer application pods can run concurrently without errors.",
      "Tools like GitHub gh-ost (binlog streaming) and pt-online-schema-change (triggers) use shadow tables to alter massive tables with zero downtime."
    ],
    "furtherReading": [
      {
        "title": "GitHub Engineering: gh-ost: GitHub's online schema migration tool for MySQL",
        "url": "https://github.blog/news-insights/company-news/gh-ost-github-s-online-migration-tool-for-mysql/"
      },
      {
        "title": "Fowler: Evolutionary Database Design",
        "url": "https://martinfowler.com/articles/evodb.html"
      }
    ]
  },
  "soft-delete": {
    "title": "Soft delete",
    "video": {
      "youtubeId": "lDYXtj95Jy8",
      "title": "Should you Delete or Soft Delete?",
      "channel": "CodeOpinion",
      "why": "Derek Comartin questions whether an is-deleted flag models the business correctly and offers event and state-based alternatives, which is the right framing for this unit.",
      "length": "6:38"
    },
    "videos": [
      {
        "youtubeId": "WL2NXQmUOC0",
        "title": "Partial Indexing | The Backend Engineering Show",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Covers partial indexes, the key tool for keeping unique constraints and hot queries fast on soft-deleted tables.",
        "length": "17:51"
      }
    ],
    "intuition": "<p>Soft delete is putting a file in the Recycle Bin instead of shredding it. It is easy to undo and the file is still around for auditors, but the bin keeps growing, every search has to skip the binned files, and you still cannot save a new file with the same name while the old one sits in the bin.</p><p><strong>Mental model:</strong> a soft-deleted row is <em>still a live row to the database</em>. Constraints, indexes, cache and backups all still pay for it. Only your queries pretend it is gone, and only if every single query remembers to.</p><ul><li><strong>Forgetting the filter:</strong> one missing <code>deleted_at IS NULL</code> in a report or join leaks \"deleted\" data, which is a privacy incident under GDPR.</li><li><strong>Soft delete is not erasure:</strong> right-to-be-forgotten requests need real deletion (or crypto-shredding), including in backups and replicas.</li><li><strong>Cascades do not happen:</strong> soft-deleting a parent leaves its children active, and foreign keys will not help.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Soft Deletes vs. Hard Deletes</h2>\n      <p>A <strong>Hard Delete</strong> executes <code>DELETE FROM users WHERE id = 42;</code>, permanently unlinking tuples and allowing VACUUM to reclaim space. A <strong>Soft Delete</strong> updates a flag: <code>UPDATE users SET deleted_at = NOW() WHERE id = 42;</code>, preserving historical data for audit compliance and recovery.</p>\n\n      <h2>The Pitfalls of Soft Deletes</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Soft[\"Soft Delete: UPDATE users SET deleted_at = NOW()\"] --> Prob1[\"1. Unique Constraint Failure: Cannot re-register same email!\"]\n    Soft --> Prob2[\"2. Logical Bloat: 80% of rows are soft-deleted but still live to the DB, so VACUUM never reclaims them\"]\n    Soft --> Prob3[\"3. Query Pollution: Every WHERE clause must append 'AND deleted_at IS NULL'\"]\n      </div>\n\n      <h2>Engineering Solutions for Soft Deletes</h2>\n      <h3>1. Partial Unique Indexes</h3>\n      <p>If you have a unique constraint on <code>email</code>, soft-deleted rows prevent a user from re-registering with the same email. Solve this with a <strong>Partial Unique Index</strong> that enforces uniqueness only on active records:</p>\n      <pre><code>CREATE UNIQUE INDEX uq_users_active_email ON users(email) \nWHERE deleted_at IS NULL;\n      </code></pre>\n\n      <h3>2. Archival Tables (The True Production Pattern)</h3>\n      <p>Keeping millions of soft-deleted records in your primary transactional table pollutes B-Trees and memory buffers. Instead, execute a true delete on the primary table while archiving the deleted record to an auxiliary <code>users_archive</code> or cold S3 Parquet dataset inside an atomic transaction.</p>\n    \n<!-- enriched -->\n<h2>Worked example: the cost of keeping deleted rows</h2><p>Consider a <code>messages</code> table where 5M messages are created per day and 40% are eventually deleted. After 3 years it has about 5.5B rows, 2.2B of them soft-deleted.</p><ul><li>Every index still contains 2.2B deleted entries. For a 40 GB index, about 16 GB of cache is spent on rows no user can see.</li><li>A query like <code>WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 50</code> must read past deleted rows. If a conversation is 80% deleted, it reads about 250 index entries to return 50.</li><li>The fix is a partial index: <code>CREATE INDEX ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;</code> This index contains only live rows, so it is 40% smaller and does no wasted reads.</li></ul><h3>Options compared</h3><table><thead><tr><th>Pattern</th><th>Undo / audit</th><th>Query complexity</th><th>Storage and performance</th><th>Compliance</th></tr></thead><tbody><tr><td>Hard delete</td><td>None (backups only)</td><td>Simplest</td><td>Best</td><td>Easiest to erase</td></tr><tr><td><code>deleted_at</code> column</td><td>Instant undo</td><td>Every query needs a filter; use a view or ORM default scope</td><td>Bloat unless partial indexes are used</td><td>Must still purge later</td></tr><tr><td>Archive table in the same transaction</td><td>Undo by moving the row back</td><td>Main table stays clean</td><td>Good; archive can be partitioned or cold</td><td>Purge the archive on schedule</td></tr><tr><td>Event log / audit table (CDC)</td><td>Full history of all changes</td><td>Main table clean</td><td>Log grows, but is append-only and cheap</td><td>Must also redact the log</td></tr><tr><td>Delete after grace period</td><td>Undo window of N days, then hard delete</td><td>Filter during the window only</td><td>Bounded bloat</td><td>Good</td></tr></tbody></table><h3>Archive-on-delete in one statement (PostgreSQL)</h3><p><code>WITH moved AS (DELETE FROM users WHERE id = 42 RETURNING *) INSERT INTO users_archive SELECT *, now() FROM moved;</code></p><p>This is atomic: either the row is in exactly one of the two tables or the transaction fails.</p><h3>Failure modes</h3><ul><li><strong>Unique constraints:</strong> the partial unique index <code>WHERE deleted_at IS NULL</code> works in Postgres and SQLite. MySQL has no partial indexes, so the usual workaround is a generated column that is NULL when deleted, included in the unique key.</li><li><strong>Foreign keys to soft-deleted rows</strong> remain valid, so orders can point to a \"deleted\" customer. Decide explicitly whether that is desired.</li><li><strong>Restores that collide:</strong> undeleting a user whose email has since been taken by a new account must be handled.</li></ul><p><strong>In practice:</strong> Stripe-style APIs return <code>deleted: true</code> objects for a while. Google Workspace and Slack offer a trash with a fixed retention period and then hard delete. Many teams use a Rails <code>discard</code>/<code>paranoia</code> gem or EF Core global query filters to apply the filter automatically.</p>\n</div>",
    "keyTakeaways": [
      "Soft deletes preserve data for recovery but cause table bloat, query pollution, and unique constraint conflicts.",
      "Use Partial Unique Indexes (WHERE deleted_at IS NULL) to allow reuse of unique values after soft deletion.",
      "The scalable pattern is archiving deleted records into separate cold storage tables, keeping hot tables lean."
    ],
    "furtherReading": [
      {
        "title": "Brandur Leach: Soft Deletion Probably Isn't What You Want",
        "url": "https://brandur.org/soft-deletion"
      },
      {
        "title": "Udi Dahan: Don't Delete - Just Don't",
        "url": "https://udidahan.com/2009/09/01/dont-delete-just-dont/"
      }
    ]
  }
};
