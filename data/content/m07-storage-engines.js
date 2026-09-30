window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-storage-engines"] = {
  "storage-engine-design-constraints": {
    "title": "Storage engine design constraints",
    "video": {
      "youtubeId": "dSxV5Sob5V8",
      "title": "#03 - Database Storage: Files & Pages ✸ Neon Database Talk (CMU Intro to Database Systems)",
      "channel": "CMU Database Group",
      "why": "Andy Pavlo builds the storage hierarchy, sequential-vs-random I/O and why a DBMS manages its own pages instead of trusting the OS: the exact constraints this unit covers.",
      "length": "1:22:28"
    },
    "videos": [
      {
        "youtubeId": "1VWIGBQLtxo",
        "title": "PostgreSQL vs. fsync How is it possible that PostgreSQL used fsync incorrectly for 20 years, and wh…",
        "channel": "FOSDEM",
        "role": "deep-dive",
        "why": "The \"fsyncgate\" talk shows what happens when durability assumptions about fsync and the page cache are wrong, a concrete lesson in why these kernel details matter.",
        "length": "43:44"
      },
      {
        "youtubeId": "FqR5vESuKe0",
        "title": "Latency Numbers Programmer Should Know: Crash Course System Design #1",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "A six-minute tour of latency numbers that gives the intuition for why disk access dominates storage-engine design.",
        "length": "6:22"
      }
    ],
    "intuition": "<p>Picture a chef, a countertop and a warehouse across town. The countertop (RAM) is tiny but instant. The warehouse (disk) holds everything, but every trip costs a drive, and a trip for one onion costs almost as much as a trip for a whole crate. A storage engine is the chef's plan for making as few warehouse trips as possible, and making each one carry as much as it can.</p>\n<p><strong>Mental model:</strong> a storage engine is a strategy for turning many small logical reads and writes into a few large, well-ordered physical I/Os, and for knowing exactly when data is really safe.</p>\n<ul>\n<li><strong>Trap: assuming <code>write()</code> means durable.</strong> It usually lands in the OS page cache. Only a successful <code>fsync</code>/<code>fdatasync</code> (and a directory fsync for new files) gives crash durability.</li>\n<li><strong>Trap: treating SSDs like fast HDDs.</strong> Random reads are cheap on NVMe, but small random overwrites still cause internal garbage collection and wear. Sequential, batched writes are still preferred.</li>\n<li><strong>Trap: one fsync per transaction.</strong> Real engines use group commit so one flush covers many commits.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Hardware Hierarchy & Kernel I/O Constraints</h2>\n      <p>A storage engine is the low-level software component responsible for persisting, indexing, and retrieving records from physical non-volatile storage. Storage engine design is fundamentally constrained by the physical physics and kernel interfaces of modern computer architectures:</p>\n      <ul>\n        <li><strong>Memory Latency Gap:</strong> L1 CPU Cache (~1ns) vs DRAM (~100ns) vs NVMe SSD (~10-100µs) vs HDD seek (~5-10ms). Accessing disk is 1,000x to 100,000x slower than accessing main memory.</li>\n        <li><strong>Sequential vs Random I/O:</strong> On mechanical HDDs, random I/O incurs a physical actuator arm seek and platter rotation penalty (~100 IOPS, ~1MB/s). On NVMe SSDs, flash memory cannot be overwritten in place; cells must be written in 4KB/16KB pages and erased in 2MB/8MB blocks. Random writes trigger severe SSD controller garbage collection and high Write Amplification Factors (WAF). Sequential writes achieve over 5GB/s on PCIe Gen4 NVMe.</li>\n        <li><strong>Linux Page Cache & VFS:</strong> Standard POSIX <code>write()</code> writes to the OS kernel page cache (DRAM dirty pages). Durability requires calling <code>fsync()</code> or <code>fdatasync()</code> to flush physical drive write buffers to non-volatile NAND cells. Some engines (InnoDB when configured with O_DIRECT, ScyllaDB) bypass the page cache using <code>O_DIRECT</code> and manage their own buffer pools, while others such as PostgreSQL deliberately use buffered I/O plus <code>fsync</code>.</li>\n      </ul>\n\n      <h2>The Storage Engine I/O Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    App[\"Application Thread\"] -->|\"1. write(fd, buf, len)\"| VFS[\"Virtual File System (VFS)\"]\n    VFS -->|\"2. Dirty Page\"| PageCache[\"Kernel Page Cache (DRAM)\"]\n    PageCache -->|\"3. Periodic flusher / fsync()\"| BlockLayer[\"I/O Scheduler & Block Device\"]\n    BlockLayer -->|\"4. NVMe PCIe Queue\"| Controller[\"SSD Controller Flash Translation Layer (FTL)\"]\n    Controller -->|\"5. Erase Block & Program Page\"| FlashNAND[(\"Physical NAND Flash Chips\")]\n      </div>\n\n      <h2>Under the Hood: fsync vs fdatasync vs O_DIRECT</h2>\n      <p>Ensuring ACID durability without catastrophic latency spikes requires precise systems programming:</p>\n      <ul>\n        <li><code>fsync(int fd)</code>: Requests persistence of a file's modified data and metadata required by the filesystem's durability contract. Publishing a newly created or renamed filename may also require synchronizing the containing directory; a file <code>fsync</code> alone does not make that directory entry durable.</li>\n        <li><code>fdatasync(int fd)</code>: Requests persistence of data and metadata required to retrieve it, such as a changed file size, while it may omit unrelated metadata. Whether it saves I/O depends on the filesystem, workload, and device.</li>\n        <li><code>O_DIRECT</code> and <code>O_DSYNC</code> solve different problems. <code>O_DIRECT</code> requests direct I/O with filesystem- and device-specific alignment constraints; <code>O_DSYNC</code> changes write-completion semantics and does not itself bypass the page cache. Engines that use direct I/O must manage buffering, prefetching, and eviction explicitly.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: why group commit exists</h2>\n<p>Suppose an OLTP service needs 20,000 committed transactions per second, and each commit must survive power loss. Assume a device where one <code>fdatasync</code> takes about 1 ms (typical for consumer NVMe without power-loss protection; enterprise drives with capacitors can be far faster, a spinning disk is 5-10 ms).</p>\n<ul>\n<li><strong>One flush per commit:</strong> at most about 1,000 commits per second per log. The target is missed by 20x.</li>\n<li><strong>Group commit:</strong> commits that arrive while a flush is in progress wait and are flushed together. If each flush carries 25 commits, 1,000 flushes per second yields 25,000 commits per second. Each commit waits roughly one flush interval, trading a little latency for a lot of throughput.</li>\n</ul>\n<p>PostgreSQL, MySQL InnoDB and RocksDB all implement variants of this: the log is a single sequential file, and the durability point is the flush, not the write.</p>\n<h2>Buffered vs direct I/O</h2>\n<table>\n<thead><tr><th>Approach</th><th>Who caches</th><th>Strength</th><th>Cost</th><th>Used by</th></tr></thead>\n<tbody>\n<tr><td>Buffered I/O plus fsync</td><td>OS page cache (plus DB buffers)</td><td>Simple; kernel readahead and write-back for free</td><td>Double caching; eviction and write-back timing controlled by the kernel</td><td>PostgreSQL</td></tr>\n<tr><td>Direct I/O (<code>O_DIRECT</code>)</td><td>The engine's own buffer pool</td><td>Predictable memory use, no double caching, engine controls eviction</td><td>Alignment rules; engine must implement prefetch and write-back itself</td><td>InnoDB (commonly configured), ScyllaDB, optional in RocksDB</td></tr>\n<tr><td>Memory-mapped files</td><td>OS page cache via page faults</td><td>Very little code; zero-copy reads</td><td>Little control over flush order and eviction; I/O errors surface as signals; stalls on page faults</td><td>LMDB (reads); CMU lecture argues against it for general DBMSs</td></tr>\n</tbody>\n</table>\n<h2>Failure modes worth knowing</h2>\n<ul>\n<li><strong>fsync error handling:</strong> in 2018 PostgreSQL developers found that on Linux a failed fsync could drop the dirty pages, so a retried fsync reported success while data was lost. PostgreSQL now treats fsync failure as fatal and recovers from the WAL.</li>\n<li><strong>Volatile device caches:</strong> a drive that acknowledges flushes without persisting them (or with write caching and no power-loss protection) breaks every guarantee above. Engines rely on the device honoring flush or FUA commands.</li>\n<li><strong>Torn pages:</strong> a 16 KB database page is larger than the atomic write unit of most devices, so a crash can leave half a page. InnoDB's doublewrite buffer and PostgreSQL's full-page writes exist for this reason.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Storage engines exist to bridge the 100,000x latency gap between DRAM and persistent physical disk.",
      "Flash storage cannot overwrite in place; random writes cause internal erase block garbage collection and wear.",
      "Many engines use fdatasync() to skip unneeded metadata flushes, and some (InnoDB, ScyllaDB) use O_DIRECT to avoid double-caching, while PostgreSQL relies on buffered I/O plus fsync."
    ],
    "furtherReading": [
      {
        "title": "Andy Pavlo: Database Storage, Part I (CMU 15-445/645 Lecture Notes, Fall 2024)",
        "url": "https://15445.courses.cs.cmu.edu/fall2024/notes/03-storage1.pdf"
      },
      {
        "title": "Brendan Gregg: Linux Storage Stack & I/O Performance",
        "url": "https://www.brendangregg.com/linuxperf.html"
      }
    ]
  },
  "storage-engine-tradeoffs": {
    "title": "Storage engine tradeoffs",
    "video": {
      "youtubeId": "Q9xD4J3tezw",
      "title": "How Databases Actually Store Your Data (B-Trees vs LSM Trees Explained)",
      "channel": "ByteMonk",
      "why": "A focused, well-animated side-by-side of B-trees and LSM-trees that walks the read, write and space costs, which is exactly the tradeoff frame of this unit.",
      "length": "11:22"
    },
    "videos": [
      {
        "youtubeId": "Hxj6g0sKu5A",
        "title": "Read, write and space efficiency – pick two",
        "channel": "Association for Computing Machinery (ACM)",
        "role": "deep-dive",
        "why": "Mark Callaghan (MyRocks/RocksDB at Facebook) on read, write and space efficiency as a pick-two problem: the practitioner version of the RUM conjecture.",
        "length": "1:01:03"
      },
      {
        "youtubeId": "K1a2Bk8NrYQ",
        "title": "Understanding B-Trees: The Data Structure Behind Modern Databases",
        "channel": "Spanning Tree",
        "role": "intro",
        "why": "Spanning Tree's beautifully animated B-tree explainer, useful before comparing it against LSM designs.",
        "length": "12:39"
      }
    ],
    "intuition": "<p>Think of three ways to keep a household filing cabinet. You can file every letter in its exact folder the moment it arrives (slow to write, fast to find). You can toss letters into an inbox tray and sort them into folders every weekend (fast to write, slower to find until the weekend sort). Or you can keep a big index card box telling you where everything is (fast both ways, but the index costs space and upkeep). You cannot have all three for free.</p>\n<p><strong>Mental model:</strong> every storage engine picks a point among read cost, write cost and memory or space cost. B-trees pay at write time; LSM-trees pay later, during compaction and on reads.</p>\n<ul>\n<li><strong>Trap: \"LSM is faster.\"</strong> It is faster for write-heavy workloads; for read-heavy point lookups a well-cached B-tree often wins.</li>\n<li><strong>Trap: quoting one write-amplification number.</strong> It depends heavily on key size, update pattern, page size, compaction style and caching. Measure with your workload.</li>\n<li><strong>Trap: forgetting space amplification.</strong> Old versions in an LSM, or half-empty pages in a B-tree, change how much disk you actually buy.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The RUM Conjecture</h2>\n      <p>Formulated by researchers Manos Athanassoulis and Stratos Idreos at Harvard, the <strong>RUM Conjecture</strong> describes a lower-bound tradeoff among read overhead, update overhead, and memory overhead: reducing one usually consumes more of at least one other resource. It is a design lens, not a rule that every engine cleanly optimizes exactly two:</p>\n      <ul>\n        <li><strong>R (Read Amplification):</strong> The ratio of bytes read from physical storage to the bytes returned to the application. High read amplification means multiple disk blocks must be read to satisfy a single point or range query.</li>\n        <li><strong>U (Update / Write Amplification):</strong> The ratio of bytes written to physical storage to the bytes updated by the application. High write amplification exhausts disk bandwidth and accelerates SSD wear.</li>\n        <li><strong>M (Memory Overhead):</strong> The auxiliary in-memory state required by the access method, such as indexes, filters, and routing metadata. Disk-space amplification is a related operational metric, but it is not the M in the RUM formulation.</li>\n      </ul>\n\n      <h2>The RUM Tradeoff Frontier</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Tradeoff{\"Storage Engine Architecture\"}\n    Tradeoff -->|\"B+ Tree (InnoDB / Postgres)\"| BTree[\"Optimize Read & Space Amplification (1-2 disk reads, 1.2x space) at the cost of high Write Amplification (10x-50x 16KB page rewrites)\"]\n    Tradeoff -->|\"LSM Tree (RocksDB / Cassandra)\"| LSM[\"Optimize Write Amplification (sequential appends) at the cost of high Read Amplification (multi-SSTable scans) and Space Amplification (compaction debt)\"]\n    Tradeoff -->|\"Fractal Tree / B-epsilon Tree\"| Fractal[\"Balanced compromise: Buffer messages in internal tree nodes to trade write I/O for tree depth\"]\n      </div>\n\n      <h2>Detailed Comparison: B+ Trees vs LSM Trees</h2>\n      <table>\n        <thead>\n          <tr><th>Dimension</th><th>B+ Tree Storage Engine</th><th>LSM-Tree Storage Engine</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Write Pattern</strong></td><td>In-place update of 8KB/16KB pages on disk</td><td>Sequential append to WAL + memory buffer</td></tr>\n          <tr><td><strong>Point Read Latency</strong></td><td>Fast: O(log_B N), typically 2-3 page reads from cache</td><td>Slower: Requires checking memtable, bloom filters, and multiple SSTables</td></tr>\n          <tr><td><strong>Write Throughput</strong></td><td>Moderate: Limited by random I/O and locking page latches</td><td>High: bursts are limited by sequential bandwidth, but sustained throughput is bounded by compaction bandwidth (engines stall writes when compaction falls behind)</td></tr>\n          <tr><td><strong>Write Amplification Factor</strong></td><td>Often high and workload-dependent: a 50-byte update can dirty a full 16KB page, though buffer pools absorb many updates per page flush</td><td>Moderate: roughly 10x-30x for leveled compaction, lower (often under 10x) for tiered compaction</td></tr>\n          <tr><td><strong>Space Utilization</strong></td><td>Moderate: after random inserts pages average about 69% full (about 30% free space) because of page splits</td><td>High: Sorted keys allow dense prefix compression (ZSTD / Snappy)</td></tr>\n        </tbody>\n      </table>\n    </div>",
    "keyTakeaways": [
      "The RUM tradeoff connects read overhead, update overhead, and auxiliary memory; disk-space amplification should be measured separately.",
      "B+ Trees optimize for point reads and predictable space at the expense of random write amplification.",
      "LSM-Trees optimize for sequential write throughput and compression at the expense of point read complexity and background compaction."
    ],
    "furtherReading": [
      {
        "title": "Athanassoulis et al.: Designing Access Methods: The RUM Conjecture (EDBT, 2016)",
        "url": "https://openproceedings.org/2016/conf/edbt/paper-12.pdf"
      },
      {
        "title": "Andy Pavlo: Database Storage, Part II: Log-Structured Storage (CMU 15-445/645 Lecture Notes, Fall 2024)",
        "url": "https://15445.courses.cs.cmu.edu/fall2024/notes/04-storage2.pdf"
      },
      {
        "title": "Luo & Carey: LSM-based Storage Techniques: A Survey (The VLDB Journal, 2020)",
        "url": "https://link.springer.com/article/10.1007/s00778-019-00555-y"
      }
    ]
  },
  "file-backed-dictionary-storage-engine": {
    "title": "A file-backed dictionary",
    "video": {
      "youtubeId": "XS7EGm-15Cg",
      "title": "Chapter 3.1 - Append only log and hash indexes (Storage and retrieval)",
      "channel": "Rahul Raja",
      "why": "A clear chapter walk-through of DDIA's append-only log plus in-memory hash index, covering segments, tombstones, compaction and crash recovery exactly as this unit does.",
      "length": "18:19"
    },
    "videos": [
      {
        "youtubeId": "r73zJYEQ6HY",
        "title": "Designing a Disk based key value store in Golang - Karan Sharma (Zerodha)",
        "channel": "Emerging Technology Trust",
        "role": "case-study",
        "why": "Karan Sharma (Zerodha) explains building a real disk-based key-value store in Go on this design, including file formats and merge.",
        "length": "22:59"
      }
    ],
    "intuition": "<p>Imagine a notebook where you never erase anything. To change your friend's phone number, you just write the new number on the next empty line. On a sticky note on the cover you keep \"Alice: page 12, line 4\". Looking someone up is one glance at the sticky note plus one flip to the right page. Writing is always \"next empty line\", which is the fastest possible way to write.</p>\n<p><strong>Mental model:</strong> the file is an append-only history; the in-memory hash map is the current table of contents pointing at the newest version of each key.</p>\n<ul>\n<li><strong>Trap: forgetting recovery.</strong> The hash map lives in RAM. After a crash you must rebuild it by scanning the log (or a hint or snapshot file). Plan for startup time.</li>\n<li><strong>Trap: ignoring torn tail records.</strong> A crash mid-append leaves a half-written record. Each record needs a length and checksum so recovery can detect and truncate it.</li>\n<li><strong>Trap: expecting range queries.</strong> A hash index gives point lookups only; \"all keys between A and B\" needs a sorted structure.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Related design: an append-only mutable dictionary</h2>\n      <p>One simple dictionary design publishes immutable snapshots that are rebuilt periodically (for example weekly). When updates must arrive continuously, a different design is an append-only log paired with an in-memory hash table, as in Bitcask. This variant trades cheap incremental writes for recovery and compaction work; it complements rather than replaces a snapshot-publication design.</p>\n\n      <h2>The Architecture of an Append-Only Dictionary</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    subgraph MemoryRAM [\"DRAM: In-Memory Index (Hash Map)\"]\n      K1[\"'user:101' -> Offset: 0, Size: 84\"]\n      K2[\"'user:102' -> Offset: 84, Size: 92\"]\n      K1U[\"'user:101' -> Offset: 176, Size: 88 (Updated)\"]\n    end\n\n    subgraph DiskData [\"Persistent Storage: Append-Only Data File\"]\n      R1[\"[0..83] Record 1: key='user:101', val='Alice'\"]\n      R2[\"[84..175] Record 2: key='user:102', val='Bob'\"]\n      R3[\"[176..263] Record 3: key='user:101', val='Alice V2' (Append)\"]\n    end\n\n    K1U -.->|\"Seek(176), Read(88)\"| R3\n      </div>\n\n      <h2>Internal Mechanics & Step-by-Step Operations</h2>\n      <h3>1. The Write Operation (Set Key-Value)</h3>\n      <p>To insert or update a key:</p>\n      <ol>\n        <li>Encode the key and value into a binary record structure containing timestamp, key length, value length, key bytes, and value payload.</li>\n        <li>Append the record to the end of the active data file using <code>write(fd, buffer, len)</code>. Record the byte offset where the write began.</li>\n        <li>Update the in-memory hash map: <code>index[key] = { file_id, offset, size, timestamp }</code>.</li>\n        <li>Because writes are strictly append-only, disk head movement is minimized and write throughput reaches hundreds of megabytes per second.</li>\n      </ol>\n\n      <h3>2. The Read Operation (Get Key)</h3>\n      <p>To read a key: Query the in-memory hash map. If the key exists, retrieve the file descriptor, byte offset, and record length. Execute <code>pread(fd, buf, size, offset)</code>. Verify checksum and extract payload. Requires at most <strong>one logical range read</strong> (one seek on a cold HDD; the page cache may serve it with no disk I/O at all).</p>\n\n      <h3>3. The Delete Operation (Tombstone)</h3>\n      <p>Deletions cannot modify existing bytes in an append-only log. Instead, append a special record called a <strong>Tombstone</strong> (a record with value size set to -1 or a tombstone flag bit). Remove the key from the in-memory hash index.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a log plus hash index</h2>\n<p>Store 10 million keys, average key 20 bytes, average value 1 KB.</p>\n<ul>\n<li><strong>Data on disk:</strong> about 10 million x (1 KB value + 20 B key + ~20 B header) which is roughly 10.4 GB for one live copy. With updates, dead versions accumulate until compaction.</li>\n<li><strong>Index in RAM:</strong> each entry holds the key plus file id, offset, length and timestamp (about 24 bytes), and a hash map adds pointer and bucket overhead. Budget roughly 80-100 bytes per key, so about 0.8-1 GB of RAM for 10 million keys.</li>\n<li><strong>Cold start:</strong> rebuilding the index by scanning 10.4 GB at 1 GB/s takes about 10 seconds; a compact hint file holding only keys and offsets (about 0.5 GB here) shrinks that to under a second of sequential reading.</li>\n</ul>\n<h2>Write, read and recover, step by step</h2>\n<ol>\n<li>Write <code>put(\"user:42\", v)</code>: encode <code>crc | timestamp | key_len | value_len | key | value</code>, append at offset 7,340,032 in <code>data-0005</code>, then set <code>index[\"user:42\"] = (5, 7340032, len)</code>.</li>\n<li>Read: look up the index, issue one <code>pread</code> at that offset, verify the CRC, return the value.</li>\n<li>Crash: on restart, scan segments oldest to newest; later records overwrite earlier index entries; tombstones remove keys; a final record whose CRC fails is the torn tail and is truncated.</li>\n</ol>\n<h2>Design comparison</h2>\n<table>\n<thead><tr><th>Design</th><th>Write cost</th><th>Point read</th><th>Range scan</th><th>RAM need</th></tr></thead>\n<tbody>\n<tr><td>Immutable snapshot (rebuild weekly)</td><td>Whole rebuild</td><td>One read with an offset index</td><td>Good if sorted</td><td>Small (sparse index)</td></tr>\n<tr><td>Append-only log plus hash index</td><td>One sequential append</td><td>One read</td><td>Not supported</td><td>All keys in RAM</td></tr>\n<tr><td>B-tree file</td><td>Page rewrite plus WAL</td><td>Few page reads</td><td>Excellent</td><td>Only cached pages</td></tr>\n</tbody>\n</table>\n<p>Real systems: Bitcask (Riak) is exactly this design; Kafka uses append-only segments with a sparse offset index; many embedded caches use it because writes never seek.</p>\n</div>",
    "keyTakeaways": [
      "An append-only log with an in-memory hash index can locate a value with one logical range read; caches, filesystems, and devices determine the physical I/O.",
      "Updates never overwrite previous data; they append new versions and update the in-memory byte offset pointer.",
      "Deletions are recorded as append-only tombstone records that invalidate previous entries during compaction."
    ],
    "furtherReading": [
      {
        "title": "Bitcask: A High Performance Key-Value Store",
        "url": "https://riak.com/assets/bitcask-intro.pdf"
      },
      {
        "title": "Andy Pavlo: Database Storage, Part I (CMU 15-445/645 Lecture Notes, Fall 2024)",
        "url": "https://15445.courses.cs.cmu.edu/fall2024/notes/03-storage1.pdf"
      },
      {
        "title": "Riak Bitcask Documentation: Design and Internals",
        "url": "https://docs.riak.com/riak/kv/latest/learn/storage/bitcask/"
      }
    ]
  },
  "custom-binary-file-format": {
    "title": "Custom binary file format",
    "video": {
      "youtubeId": "haz2h7_xFDk",
      "title": "How databases store data on disk?",
      "channel": "Architecture Weekly",
      "why": "Oskar Dudycz explains how databases lay records out on disk (pages, headers, offsets) in a compact, concrete way that matches this unit's focus on binary layout.",
      "length": "10:36"
    },
    "videos": [
      {
        "youtubeId": "dSxV5Sob5V8",
        "title": "#03 - Database Storage: Files & Pages ✸ Neon Database Talk (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "CMU 15-445 lecture on files, pages, page headers and slotted pages: the rigorous version of designing an on-disk format.",
        "length": "1:22:28"
      }
    ],
    "intuition": "<p>A shipping container works because every port agrees on its exact size, where the door is and where the label goes. Nobody opens it to find out what shape it is. A binary file format is that agreement for bytes: a fixed header says what the file is and which version, and every record starts with a small label giving its length and a checksum, so a reader can jump straight to record 1,000,000 or detect a damaged box.</p>\n<p><strong>Mental model:</strong> a binary format is a contract of magic bytes, version, explicit lengths and checksums that lets you locate, validate and evolve records without parsing everything before them.</p>\n<ul>\n<li><strong>Trap: no version field.</strong> The first schema change will force a painful migration. Always reserve a version number and ideally feature flags.</li>\n<li><strong>Trap: trusting length fields.</strong> A corrupt length can make a reader allocate gigabytes or read past the file. Bound-check lengths and verify checksums before using data.</li>\n<li><strong>Trap: forgetting endianness.</strong> Pick one byte order (usually little-endian) and write it down.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Binary Serialization & Disk Layout</h2>\n      <p>Text formats such as JSON and CSV favor inspectability and interoperability, but parsing and locating individual records can cost more CPU and I/O than a purpose-built representation. When measurements justify that tradeoff, a storage engine can use a versioned binary format with explicit record boundaries and validation.</p>\n\n      <h2>Physical Record Binary Memory Layout</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    CRC[\"CRC32 Checksum (4 Bytes)\"] --> TS[\"Timestamp (8 Bytes)\"]\n    TS --> KLen[\"Key Length (2 Bytes)\"]\n    KLen --> VLen[\"Value Length (4 Bytes)\"]\n    VLen --> Flags[\"Flags / Tombstone (1 Byte)\"]\n    Flags --> KeyPayload[\"Key Bytes (Variable: KLen)\"]\n    KeyPayload --> ValPayload[\"Value Bytes (Variable: VLen)\"]\n      </div>\n\n      <h2>Header Specification & Hardware Alignment</h2>\n      <h3>1. File Header (Magic Bytes & Metadata)</h3>\n      <p>One possible format starts with a fixed-size header block:</p>\n      <ul>\n        <li><strong>Magic Bytes (4 Bytes):</strong> A unique signature (e.g. <code>0x53444231</code> for \"SDB1\") verifying that the file is indeed a valid database file.</li>\n        <li><strong>Format Version (2 Bytes):</strong> Allows future database upgrades to read older file formats or migrate them on the fly.</li>\n        <li><strong>Block Size (2 Bytes):</strong> Defines page size alignment (e.g. 4096 bytes or 16384 bytes).</li>\n        <li><strong>Endianness Marker (2 Bytes):</strong> Resolves Little-Endian vs Big-Endian integer encoding differences across CPU architectures.</li>\n      </ul>\n\n      <h3>2. The 4KB Memory Alignment Rule</h3>\n      <p>Filesystems and devices expose different logical blocks, physical sectors, pages, and direct-I/O alignment constraints. Packing records into blocks can bound the number of reads and simplify checksums, but padding every record may waste space. Choose and record the block size from the actual I/O contract rather than assuming a universal 4KB rule.</p>\n    \n<!-- enriched -->\n<h2>Worked example: one record, byte by byte</h2>\n<p>A simple length-prefixed record format (this is essentially Bitcask's layout):</p>\n<table>\n<thead><tr><th>Field</th><th>Size</th><th>Example value</th></tr></thead>\n<tbody>\n<tr><td>CRC32C over the rest of the record</td><td>4 B</td><td>computed last</td></tr>\n<tr><td>Timestamp (ms, little-endian)</td><td>8 B</td><td>1,790,000,000,000</td></tr>\n<tr><td>Key length</td><td>4 B</td><td>7</td></tr>\n<tr><td>Value length</td><td>4 B</td><td>100</td></tr>\n<tr><td>Key bytes</td><td>7 B</td><td><code>user:42</code></td></tr>\n<tr><td>Value bytes</td><td>100 B</td><td>payload</td></tr>\n</tbody>\n</table>\n<p>Total 127 bytes, with 20 bytes of fixed header. To read the record at offset 4096, read 20 bytes, check that 4096 + 20 + 7 + 100 does not exceed the file size, read the remaining 107 bytes, recompute the CRC and compare. If a crash truncated the file mid-record, the length check or CRC fails and recovery truncates the file back to 4096.</p>\n<h2>Choosing a representation</h2>\n<table>\n<thead><tr><th>Format</th><th>Seek to record N</th><th>Parse cost</th><th>Schema evolution</th><th>Debuggability</th></tr></thead>\n<tbody>\n<tr><td>JSON lines</td><td>Scan, or keep a side index</td><td>High (text parsing)</td><td>Easy, loose</td><td>Excellent</td></tr>\n<tr><td>Length-prefixed binary with CRC</td><td>Offset index gives one read</td><td>Very low</td><td>Needs a version field</td><td>Needs a dump tool</td></tr>\n<tr><td>Protobuf or FlatBuffers records</td><td>Needs framing plus index</td><td>Low (FlatBuffers near zero-copy)</td><td>Strong field-number rules</td><td>Tooling available</td></tr>\n<tr><td>Fixed-width slotted pages</td><td>Page id times page size</td><td>Very low</td><td>Harder</td><td>Needs tooling</td></tr>\n</tbody>\n</table>\n<h2>How real formats do it</h2>\n<ul>\n<li><strong>SQLite:</strong> a 100-byte file header beginning with the string <code>SQLite format 3</code>, including page size and format version numbers.</li>\n<li><strong>LevelDB/RocksDB WAL:</strong> 32 KB blocks; each record fragment has a 7-byte header (checksum, length, type) with types FULL, FIRST, MIDDLE and LAST so records can span blocks and a torn block is detectable.</li>\n<li><strong>Parquet:</strong> the magic <code>PAR1</code> at both ends, with the metadata footer at the end so a writer can stream data first and a reader can find the footer with one small read from the tail.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Custom binary formats avoid text-parsing CPU overhead, and combined with an offset index or fixed-size slots they enable single-read random access by offset.",
      "A binary format should include only the boundaries, versioning, integrity checks, and mutation metadata required by its recovery and compatibility contract.",
      "Block sizing and alignment should follow measured filesystem and device constraints; padding trades simpler I/O for extra space."
    ],
    "furtherReading": [
      {
        "title": "SQLite Database File Format Specification",
        "url": "https://www.sqlite.org/fileformat.html"
      },
      {
        "title": "Google FlatBuffers: Efficient Cross-Platform Serialization Library",
        "url": "https://google.github.io/flatbuffers/"
      },
      {
        "title": "Verbitski et al.: Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Databases (SIGMOD, 2017)",
        "url": "https://www.amazon.science/publications/amazon-aurora-design-considerations-for-high-throughput-cloud-native-relational-databases"
      }
    ]
  },
  "byte-range-indexed-object-storage": {
    "title": "Byte-range indexed object storage",
    "video": {
      "youtubeId": "k3RBmZiFF9M",
      "title": "Facebook's Photo Storage System",
      "channel": "Smruti R. Sarangi",
      "why": "A full university lecture on Facebook's Haystack photo store, the canonical example of packing many blobs into large volumes and serving them by offset-and-length.",
      "length": "59:35"
    },
    "videos": [
      {
        "youtubeId": "34e_g-Ji_30",
        "title": "F4 - Photo Storage at Facebook",
        "channel": "@Scale",
        "role": "case-study",
        "why": "Facebook's own @Scale talk on f4, the warm-storage successor to Haystack, showing how volume-plus-index storage evolves with erasure coding.",
        "length": "21:02"
      },
      {
        "youtubeId": "RvaMHMxHjp4",
        "title": "Object Storage in System Design Interviews w/ Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Hello Interview covers range GETs, multipart uploads and presigned URLs in the object-storage interview context.",
        "length": "12:37"
      }
    ],
    "intuition": "<p>A long audiobook on a single cassette is awful if you must rewind from the start to reach chapter 9. Put a table of contents on the label, \"chapter 9 starts at minute 212\", and a player with a counter can jump straight there. Byte-range storage is that label for big files: an index turns \"give me this part\" into \"read these exact bytes\".</p>\n<p><strong>Mental model:</strong> a large blob plus an offset index equals random access. HTTP range requests (<code>Range: bytes=a-b</code>, answered with <code>206 Partial Content</code>) and <code>pread(fd, buf, len, offset)</code> are the two interfaces that expose it.</p>\n<ul>\n<li><strong>Trap: tiny ranges.</strong> Each range request has fixed latency (tens of milliseconds on object stores). Fetch meaningful chunks, commonly 8-16 MB for parallel downloads.</li>\n<li><strong>Trap: forgetting the index lives somewhere.</strong> Haystack keeps it in memory; Parquet keeps it in a footer you fetch first.</li>\n<li><strong>Trap: assuming ranges survive rewrites.</strong> If the object changes, old offsets are wrong. Use versioned or immutable objects, or send <code>If-Match</code> with the ETag.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Random Access Over Large Objects</h2>\n      <p>When storing massive binary assets (e.g. 100GB video files, multi-gigabyte ZIP archives, or Parquet datasets), requiring an application to download the entire file to access a small subset of bytes is unacceptable. <strong>Byte-range indexed storage</strong> enables random access within contiguous blobs using offset and length metadata.</p>\n\n      <h2>HTTP Byte-Range Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Video Player Client\"] -->|\"1. GET /video.mp4 (Range: bytes=1048576-2097151)\"| CDN[\"Cloudflare Edge CDN\"]\n    CDN -->|\"2. Forward Range Request\"| ObjectStore[\"Object Storage Engine (S3 / Custom)\"]\n    ObjectStore -->|\"3. Read Index: Seek(1MB), Read(1MB)\"| DiskStorage[(\"NVMe Storage Volume\")]\n    DiskStorage -->|\"4. Return 1MB Buffer\"| ObjectStore\n    ObjectStore -->|\"5. HTTP 206 Partial Content (Content-Range: bytes 1048576-2097151/524288000)\"| Client\n      </div>\n\n      <h2>Implementation Mechanics: Sparse Indexes & Offset Maps</h2>\n      <p>To serve range reads with a direct index lookup instead of a scan (sub-millisecond only for local, cached or NVMe-resident data; remote object stores typically take tens of milliseconds to first byte):</p>\n      <ul>\n        <li><strong>The Index Chunk Table:</strong> Store an auxiliary index file mapping logical offsets to physical block locations. For example, a 10GB video is indexed in 4MB chunk intervals: <code>chunk_0 -> block_id_492</code>, <code>chunk_1 -> block_id_812</code>.</li>\n        <li><strong>The POSIX <code>pread()</code> System Call:</strong> Traditional <code>lseek()</code> + <code>read()</code> modifies the kernel file pointer, making it unsafe for concurrent threads. <code>pread(fd, buf, count, offset)</code> performs thread-safe atomic reads at an explicit offset without locking.</li>\n        <li><strong>Virtual File Aggregation:</strong> Engines like Facebook Haystack aggregate millions of small images into single 100GB container files. An in-memory index maps <code>photo_id -> { haystack_file_id, byte_offset, size }</code>, avoiding the per-photo filesystem metadata lookups (directory and inode reads) that cost extra disk I/Os.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: seeking inside a 10 GiB video</h2>\n<p>A 10 GiB (10,737,418,240 byte) file is indexed in 4 MiB chunks, giving 2,560 index entries. At about 24 bytes per entry (chunk number, storage location, length, checksum) the whole index is about 60 KB, small enough to cache anywhere.</p>\n<p>A player seeks to byte 104,857,600 (100 MiB) and wants 4 MiB:</p>\n<ul>\n<li>Request: <code>Range: bytes=104857600-109051903</code></li>\n<li>Chunk number: 104,857,600 / 4,194,304 = 25, and the last byte 109,051,903 is also in chunk 25, so exactly one chunk is read.</li>\n<li>Response: <code>206 Partial Content</code> with <code>Content-Range: bytes 104857600-109051903/10737418240</code>.</li>\n</ul>\n<h2>Reading a Parquet file from object storage</h2>\n<ol>\n<li>Range-read the last 8 bytes: a 4-byte footer length plus the magic <code>PAR1</code>.</li>\n<li>Range-read the footer, which lists every row group and column chunk with offsets and sizes.</li>\n<li>Range-read only the column chunks the query needs. A query touching 2 of 50 columns may fetch a few percent of the file.</li>\n</ol>\n<h2>Access patterns compared</h2>\n<table>\n<thead><tr><th>Pattern</th><th>Bytes transferred</th><th>Requests</th><th>Best for</th></tr></thead>\n<tbody>\n<tr><td>Whole-object GET</td><td>Entire object</td><td>1</td><td>Small objects, full downloads</td></tr>\n<tr><td>Single range GET</td><td>Just the range</td><td>1 per range</td><td>Seeking media, reading footers</td></tr>\n<tr><td>Parallel range GETs</td><td>Entire object, split</td><td>Many concurrent</td><td>Maximizing throughput on large downloads</td></tr>\n<tr><td>Packed volume plus offset index (Haystack)</td><td>Just the needle</td><td>1 disk read</td><td>Billions of small blobs</td></tr>\n</tbody>\n</table>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Stale offsets:</strong> the object was overwritten between reading the footer and the data. Pin a version id or use conditional requests.</li>\n<li><strong>Index loss:</strong> Haystack can rebuild its in-memory index from the volume file, but it keeps index checkpoint files to make restarts fast.</li>\n<li><strong>Request-rate limits:</strong> thousands of small range reads can hit per-prefix request limits before bandwidth limits.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Byte-range storage uses HTTP 206 Partial Content and pread() to access sub-regions of massive files without downloading the full blob.",
      "Auxiliary index tables map logical byte intervals to physical storage block IDs for constant-time seek operations.",
      "Large container files aggregate millions of small assets to avoid per-file filesystem metadata overhead (extra inode and directory reads per access)."
    ],
    "furtherReading": [
      {
        "title": "Facebook Engineering: Finding a Needle in Haystack (Photo Storage)",
        "url": "https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Beaver.pdf"
      },
      {
        "title": "Muralidhar et al.: f4: Facebook's Warm BLOB Storage System (USENIX OSDI, 2014)",
        "url": "https://www.usenix.org/conference/osdi14/technical-sessions/presentation/muralidhar"
      },
      {
        "title": "IETF RFC 9110: HTTP Semantics (Section 14: Range Requests)",
        "url": "https://www.rfc-editor.org/rfc/rfc9110.html#section-14"
      }
    ]
  },
  "immutable-versioned-data-files": {
    "title": "Immutable versioned data files",
    "video": {
      "youtubeId": "tEa5sAh-kVk",
      "title": "Howard Chu - LMDB [The Databaseology Lectures - CMU Fall 2015]",
      "channel": "CMU Database Group",
      "why": "Howard Chu, LMDB's author, explains copy-on-write B+trees, the dual meta pages that make commits atomic, and how readers avoid locks: the precise mechanics this unit describes.",
      "length": "1:09:29"
    },
    "videos": [
      {
        "youtubeId": "kEd2HowSW-U",
        "title": "Apache Iceberg data modifications, snapshots, and time travel | Starburst Academy",
        "channel": "Starburst",
        "role": "case-study",
        "why": "A short Starburst Academy walk-through of how Apache Iceberg writes new immutable files and snapshots, with time travel via old metadata pointers.",
        "length": "7:57"
      }
    ],
    "intuition": "<p>Think of editing a shared document by never touching the original: you photocopy the pages you change, mark up the copies, and then swap in a new cover page that points at the new set. Anyone still reading the old copy keeps reading a complete, consistent version. When everyone is done with the old version, you recycle its pages.</p>\n<p><strong>Mental model:</strong> write new versions beside the old ones, then publish them with one durable pointer update. Readers see either the old version or the new one, never half of each.</p>\n<ul>\n<li><strong>Trap: thinking an atomic pointer swap in memory equals a durable commit.</strong> The new pages must be flushed before the root or metadata that references them.</li>\n<li><strong>Trap: ignoring long-lived readers.</strong> A reader that holds an old snapshot pins its pages, so space cannot be reclaimed and files grow (a well-known LMDB operational issue).</li>\n<li><strong>Trap: forgetting the path copy cost.</strong> Changing one leaf in a copy-on-write tree rewrites every page from that leaf to the root.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Copy-on-Write (CoW) & Persistent Data Structures</h2>\n      <p>Traditional database engines (like MySQL InnoDB) overwrite pages in-place. If the server crashes mid-write, the page is corrupt (torn write), requiring complex Doublewrite Buffers and WAL replay. <strong>Copy-on-write storage engines</strong> (LMDB, CouchDB, ZFS) never overwrite live pages on disk. Instead, every mutation writes a new version of the page and swings an atomic root pointer. Table formats such as Apache Iceberg apply the same idea at file granularity (immutable data files plus a new snapshot metadata file), not as a page tree.</p>\n\n      <h2>Copy-on-Write B-Tree Pointer Swapping</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph Version1 [\"Version 1 (Old Root: Pointer A)\"]\n      R1[\"Root Page V1\"] --> N1[\"Internal Node 1\"]\n      R1 --> N2[\"Internal Node 2\"]\n      N1 --> L1[\"Leaf Page A (Unchanged)\"]\n      N1 --> L2[\"Leaf Page B (Target of Update)\"]\n    end\n\n    subgraph Version2 [\"Version 2 (New Root: Pointer B)\"]\n      R2[\"Root Page V2 (New)\"] --> N1New[\"Internal Node 1 (New)\"]\n      R2 --> N2\n      N1New --> L1\n      N1New --> L2New[\"Leaf Page B' (Updated Copy)\"]\n    end\n      </div>\n\n      <h2>Why Immutability Eliminates Concurrency Locks</h2>\n      <ul>\n        <li><strong>Lock-Free Readers:</strong> Readers take a reference to the active root pointer at transaction start. Because pages are immutable, readers traverse the tree without page locks or latches and without risk of reading inconsistent or partial writes (in LMDB a reader still registers its snapshot in a reader table so the writer does not reuse pages it needs).</li>\n        <li><strong>Single Atomic Root Swap:</strong> When a writer finishes constructing the new branch, it must persist the new pages before publishing durable commit metadata that identifies the new root. Implementations commonly use checksummed or redundant metadata pages, a WAL, and explicit flush ordering so recovery can select a complete generation after a crash; a CPU-atomic pointer store alone is not a durable commit.</li>\n        <li><strong>Instant Time Travel & Snapshots:</strong> Creating a snapshot is free: simply preserve the root pointer of that version. Older versions are reclaimed by background garbage collection only when all referencing reader transactions terminate.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: one update in a copy-on-write B+tree</h2>\n<p>A tree of depth 3 with 4 KB pages (root, internal, leaf). Updating one key:</p>\n<ol>\n<li>Write a new leaf containing the change (4 KB).</li>\n<li>Write a new internal page whose pointer now targets the new leaf (4 KB).</li>\n<li>Write a new root pointing at the new internal page (4 KB).</li>\n<li>Flush those pages, then write and flush a meta page: <code>txn_id = 1042, root = page 9913, checksum</code>.</li>\n</ol>\n<p>That is 12 KB of page writes plus a meta page for a 100-byte change, the price of never overwriting. LMDB keeps two meta pages and alternates between them; on startup it picks the valid one with the highest transaction id, so a crash during step 4 simply leaves the previous version in force. Pages from transaction 1041 are freed only when no active reader still uses that snapshot.</p>\n<h2>Table formats do the same thing at file granularity</h2>\n<p>In Apache Iceberg, a commit writes new data files, new manifest files and a new table metadata file, then atomically swaps the catalog's pointer from <code>v41.metadata.json</code> to <code>v42.metadata.json</code> using compare-and-swap. If another writer committed first, the swap fails and the writer retries against the new base (optimistic concurrency). Old snapshots remain queryable until expired.</p>\n<h2>Comparison</h2>\n<table>\n<thead><tr><th>Approach</th><th>Crash safety mechanism</th><th>Reader isolation</th><th>Space cost</th><th>Examples</th></tr></thead>\n<tbody>\n<tr><td>In-place pages plus WAL</td><td>Log replay, doublewrite or full-page writes</td><td>Locks, latches, MVCC undo</td><td>Low</td><td>InnoDB, PostgreSQL</td></tr>\n<tr><td>Copy-on-write B+tree</td><td>Flush pages, then meta page</td><td>Snapshots by root pointer</td><td>Path copies; pinned old pages</td><td>LMDB, Btrfs, ZFS</td></tr>\n<tr><td>Append-only B-tree</td><td>Header written after data</td><td>Snapshots</td><td>High until compaction</td><td>CouchDB</td></tr>\n<tr><td>Immutable files plus metadata pointer</td><td>Atomic catalog swap</td><td>Snapshot isolation</td><td>Old files until expiry</td><td>Iceberg, Delta Lake</td></tr>\n</tbody>\n</table>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Snapshot pinning:</strong> a forgotten read transaction stops reclamation; monitor oldest reader age.</li>\n<li><strong>Metadata explosion:</strong> frequent tiny commits create thousands of small files and snapshots; table formats need regular compaction and snapshot expiry.</li>\n<li><strong>Single writer:</strong> LMDB serializes writers; high write concurrency needs a different engine.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Copy-on-write preserves older pages while building a new generation, but commit metadata, flush ordering, checksums, and writer coordination still determine crash safety.",
      "Immutable published pages can let readers avoid page-update latches when lifetime and reclamation are coordinated correctly.",
      "A CoW commit publishes a new root only after its referenced pages are durable, and recovery must distinguish a complete generation from a torn publication."
    ],
    "furtherReading": [
      {
        "title": "Howard Chu: LMDB Architecture and Implementation",
        "url": "http://www.lmdb.tech/doc/"
      },
      {
        "title": "Conway et al.: copy-on-write in the Linux kernel (Linux Plumbers Conference)",
        "url": "https://lwn.net/Articles/689444/"
      },
      {
        "title": "Armbrust et al.: Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores (VLDB, 2020)",
        "url": "https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf"
      }
    ]
  },
  "log-structured-storage": {
    "title": "Log-structured storage",
    "video": {
      "youtubeId": "KTCkW_6zz2k",
      "title": "Log-Structured File Systems",
      "channel": "David Evans",
      "why": "A crisp university lecture on the Log-Structured File System: why appends beat in-place writes, and why the segment cleaner is the hard part.",
      "length": "15:05"
    },
    "videos": [
      {
        "youtubeId": "IrWMU_46dJI",
        "title": "PWLTO#21 – Ding Yuan on The Design and Implementation of a Log-Structured File System",
        "channel": "PapersWeLove",
        "role": "deep-dive",
        "why": "Papers We Love walk-through of the original Rosenblum and Ousterhout LFS paper, including cleaning policies and write-cost analysis.",
        "length": "1:46:04"
      },
      {
        "youtubeId": "_5vrfuwhvlQ",
        "title": "How databases scale writes: The power of the log ✍️🗒️",
        "channel": "Gaurav Sen",
        "role": "intro",
        "why": "Gaurav Sen's intuitive explanation of how appending to a log lets databases scale writes, leading into LSM-trees.",
        "length": "17:22"
      }
    ],
    "intuition": "<p>A ship's logbook is never edited. Every event, even \"correction to entry 14\", is written on the next line. Writing is effortless because you always know where the pen goes. The downside is that the book fills with outdated entries, so every so often someone copies the still-relevant entries into a fresh book and throws the old one away.</p>\n<p><strong>Mental model:</strong> log-structured storage turns every update into a sequential append and pays for it later with garbage collection (cleaning or compaction) that copies live data forward.</p>\n<ul>\n<li><strong>Trap: \"appends are free.\"</strong> The cleaner rewrites live data. If segments are mostly live when cleaned, write cost explodes.</li>\n<li><strong>Trap: running disks full.</strong> Log-structured systems need free space headroom to clean; near 100% utilization they stall.</li>\n<li><strong>Trap: forgetting reads.</strong> Recent versions are scattered by time, not key, so you need an index to find anything.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Core Thesis of Log-Structured Systems</h2>\n      <p>In 1991, Mendel Rosenblum and John Ousterhout published the seminal paper on Log-Structured File Systems (LFS). Their core thesis remains the foundation of high-performance database engineering today: <strong>disks handle large sequential writes far more efficiently than small random ones</strong>. By transforming all updates, deletes, and insertions into a single append-only sequential log, write performance approaches theoretical hardware limits.</p>\n\n      <h2>Log-Structured Write Flow</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    Writes[\"Random Application Writes: (K1, V1), (K8, V2), (K3, V3)\"] --> AppendBuffer[\"In-Memory Buffer / Memtable\"]\n    AppendBuffer -->|\"Sequential Flushes\"| LogSegment1[\"Log Segment 001.log (Immutable)\"]\n    AppendBuffer -->|\"Sequential Flushes\"| LogSegment2[\"Log Segment 002.log (Immutable)\"]\n    AppendBuffer -->|\"Active Tail\"| ActiveLog[\"Active Segment 003.log (Append Only)\"]\n      </div>\n\n      <h2>The Fundamental Challenge: The Cleaner & Space Reclaim</h2>\n      <p>Because every update appends a new record and every delete appends a tombstone, the log grows without bound until it is cleaned. A log-structured engine requires a background <strong>Cleaner / Compaction Engine</strong>:</p>\n      <ol>\n        <li>The cleaner selects cold or fragmented log segments.</li>\n        <li>It reads the segment into RAM and identifies the latest valid version of each key by consulting an index.</li>\n        <li>It discards overwritten values and tombstones.</li>\n        <li>It writes the active surviving records into a new, contiguous log segment and unlinks the old files.</li>\n      </ol>\n    \n<!-- enriched -->\n<h2>Worked example: the cost of cleaning</h2>\n<p>The LFS paper models cleaning with segment utilization <code>u</code>, the fraction of a segment that is still live when the cleaner picks it. To free one segment's worth of space, the cleaner reads the whole segment (1), writes back the live part (u), and gains room for 1 - u of new data. The paper's write cost, total bytes moved per byte of new data, is 2 / (1 - u).</p>\n<table>\n<thead><tr><th>Utilization of cleaned segments</th><th>Write cost</th><th>Interpretation</th></tr></thead>\n<tbody>\n<tr><td>0.2</td><td>2.5</td><td>Cheap: mostly garbage</td></tr>\n<tr><td>0.5</td><td>4</td><td>Moderate</td></tr>\n<tr><td>0.8</td><td>10</td><td>Expensive: 10 bytes of I/O per byte written</td></tr>\n<tr><td>0.9</td><td>20</td><td>Near-stall territory</td></tr>\n</tbody>\n</table>\n<p>This is why cleaning policy matters. LFS found that a cost-benefit policy (prefer segments with lots of free space and old, stable data) beats greedy \"emptiest segment first\", because cold data stays put and hot data dies quickly in its own segments.</p>\n<h2>In-place versus log-structured</h2>\n<table>\n<thead><tr><th>Property</th><th>Update in place</th><th>Log-structured</th></tr></thead>\n<tbody>\n<tr><td>Write pattern</td><td>Random</td><td>Sequential appends</td></tr>\n<tr><td>Crash recovery</td><td>WAL replay plus torn-page protection</td><td>Replay from last checkpoint in the log</td></tr>\n<tr><td>Space overhead</td><td>Low</td><td>Dead versions until cleaned</td></tr>\n<tr><td>Background work</td><td>Checkpointing</td><td>Cleaning or compaction, often the bottleneck</td></tr>\n<tr><td>Read locality</td><td>Stable, by key or page</td><td>By write time unless compacted</td></tr>\n</tbody>\n</table>\n<h2>Where the idea shows up</h2>\n<ul>\n<li><strong>SSD firmware:</strong> the flash translation layer is itself log-structured, with its own garbage collector.</li>\n<li><strong>Kafka:</strong> append-only segments; retention deletes whole old segments, and log compaction keeps only the latest record per key.</li>\n<li><strong>LSM-trees (RocksDB, Cassandra, Bigtable):</strong> the log becomes sorted runs, and cleaning becomes compaction.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Log-structured storage converts all random updates into high-throughput sequential disk appends.",
      "Deletions and updates leave obsolete versions in place, requiring background compaction to reclaim space.",
      "LFS principles power modern storage engines including RocksDB, Bigtable, Kafka, and Cassandra."
    ],
    "furtherReading": [
      {
        "title": "Rosenblum & Ousterhout: The Design and Implementation of a Log-Structured File System",
        "url": "https://people.eecs.berkeley.edu/~brewer/cs262/LFS.pdf"
      },
      {
        "title": "Andy Pavlo: Database Storage, Part II: Log-Structured Storage (CMU 15-445/645 Lecture Notes, Fall 2024)",
        "url": "https://15445.courses.cs.cmu.edu/fall2024/notes/04-storage2.pdf"
      },
      {
        "title": "Lu et al.: WiscKey: Separating Keys from Values in SSD-conscious Storage (USENIX FAST, 2016)",
        "url": "https://www.usenix.org/conference/fast16/technical-sessions/presentation/lu"
      }
    ]
  },
  "bitcask-storage-engine": {
    "title": "Bitcask storage engine",
    "video": {
      "youtubeId": "0WI_tJRUMqM",
      "title": "Bitcask Explained - A Log-Structured fast KV Store Used By Uber",
      "channel": "Arpit Bhayani",
      "why": "Arpit Bhayani walks through the Bitcask paper end to end: keydir, append-only data files, merge and hint files, exactly this unit's scope.",
      "length": "15:42"
    },
    "videos": [
      {
        "youtubeId": "r73zJYEQ6HY",
        "title": "Designing a Disk based key value store in Golang - Karan Sharma (Zerodha)",
        "channel": "Emerging Technology Trust",
        "role": "case-study",
        "why": "A conference talk building a Bitcask-style store in Go (barreldb), grounding the paper in real code and file layouts.",
        "length": "22:59"
      }
    ],
    "intuition": "<p>A coat check keeps coats in the back room in whatever order they arrive, but the attendant holds a small card box in front: \"ticket 1432, rail 7, hook 19\". Taking a coat means one walk to one hook; accepting a coat means hanging it on the next free hook. The card box must fit on the counter, but the coats can fill a warehouse.</p>\n<p><strong>Mental model:</strong> Bitcask keeps every key in an in-memory hash table (the keydir) and every value in append-only files, so writes are one sequential append and reads are one positioned read.</p>\n<ul>\n<li><strong>Trap: forgetting the RAM bound.</strong> All keys, plus per-key overhead, must fit in memory on every node. Many small keys can exhaust RAM long before disk fills.</li>\n<li><strong>Trap: expecting range scans or ordering.</strong> The keydir is a hash table; there is no sorted iteration.</li>\n<li><strong>Trap: confusing hint files with data files.</strong> Hint files hold keys and value positions, not values, and exist only to rebuild the keydir quickly.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Bitcask Architecture</h2>\n      <p>Originated as the default storage engine for Basho's Riak distributed database, <strong>Bitcask</strong> is an ultra-fast key-value storage engine designed for workloads where the entire keyspace fits in RAM, but values exceed available memory. It provides predictable O(1) read and write latencies with no seeks on write (appends land in the page cache; durability depends on the configured sync strategy) and at most one disk seek on read.</p>\n\n      <h2>Bitcask Internal Components</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph RAM [\"In-Memory Hash Table: 'Keydir'\"]\n      KD1[\"'user:101' -> {file_id: 2, offset: 512, size: 128, ts: 16900010}\"]\n      KD2[\"'user:102' -> {file_id: 2, offset: 640, size: 96, ts: 16900015}\"]\n    end\n\n    subgraph DiskFiles [\"Disk Storage: Segment Files\"]\n      Active[\"Active File (Append-Only: Write Allowed)\"]\n      Older1[\"Immutable File 001.data (Read-Only)\"]\n      Older2[\"Immutable File 002.data (Read-Only)\"]\n    end\n\n    WriteOp[\"Write: Set(K, V)\"] -->|\"1. Append Record\"| Active\n    Active -->|\"2. Return Offset\"| KD1\n    ReadOp[\"Read: Get(K)\"] -->|\"1. Lookup Offset\"| KD1\n    KD1 -->|\"2. pread(offset, size)\"| Older2\n      </div>\n\n      <h2>Compaction & The Hint File Optimization</h2>\n      <p>When log segments accumulate stale records, a background merge process reads immutable data files and writes only the latest valid keys to new files. To prevent having to read multi-gigabyte data files on restart to rebuild the in-memory Keydir, Bitcask writes a companion <strong>Hint File</strong> alongside each merged data file.</p>\n      <p>Each hint file entry holds the timestamp, key size, value size, value position and key: the value bytes are replaced by the <em>position of the value</em> in the data file. On startup, Bitcask scans the tiny hint files linearly into RAM, rebuilding the million-key Keydir in seconds.</p>\n    \n<!-- enriched -->\n<h2>Worked example: capacity planning</h2>\n<p>Riak's Bitcask guidance budgets a fixed overhead of roughly 40-50 bytes per key in the keydir, plus the key itself. For 200 million keys averaging 36 bytes:</p>\n<ul>\n<li>RAM per replica: 200 million x (36 + about 45) bytes is roughly 16 GB.</li>\n<li>With 3 replicas across a cluster, about 48 GB of keydir RAM in total, spread over nodes.</li>\n<li>If values average 2 KB, disk per replica is about 400 GB for one live version, plus dead versions awaiting merge.</li>\n</ul>\n<p>The design wins when values are large relative to keys; with 30-byte keys and 50-byte values the keydir costs as much as the data.</p>\n<h2>What is actually stored</h2>\n<table>\n<thead><tr><th>Structure</th><th>Fields</th><th>Purpose</th></tr></thead>\n<tbody>\n<tr><td>Data file entry</td><td>crc, timestamp, key size, value size, key, value</td><td>The durable record</td></tr>\n<tr><td>Keydir entry (RAM)</td><td>file id, value size, value position, timestamp</td><td>Find the latest value in one read</td></tr>\n<tr><td>Hint file entry</td><td>timestamp, key size, value size, value position, key</td><td>Rebuild the keydir without reading values</td></tr>\n</tbody>\n</table>\n<h2>Merge, step by step</h2>\n<ol>\n<li>Select immutable (non-active) data files whose fragmentation or dead bytes exceed a threshold.</li>\n<li>For each record, keep it only if the keydir still points at that exact file and offset.</li>\n<li>Write survivors to new merged data files and emit matching hint files.</li>\n<li>Atomically update keydir entries to the new locations, then delete the old files.</li>\n</ol>\n<h2>Bitcask versus an LSM-tree</h2>\n<table>\n<thead><tr><th>Property</th><th>Bitcask</th><th>LSM-tree</th></tr></thead>\n<tbody>\n<tr><td>Keys in RAM</td><td>All</td><td>Only indexes and filters</td></tr>\n<tr><td>Point read</td><td>One read, predictable</td><td>Memtable, filters, one or more blocks</td></tr>\n<tr><td>Range scan</td><td>No</td><td>Yes</td></tr>\n<tr><td>Write amplification</td><td>Low (merge only)</td><td>Higher (multi-level compaction)</td></tr>\n</tbody>\n</table>\n</div>",
    "keyTakeaways": [
      "Bitcask stores all keys in an in-memory hash table (Keydir) and all values in append-only disk segments.",
      "Reads require exactly 1 disk seek; writes are sequential appends requiring 0 seeks.",
      "Hint files store keys and byte offsets without values, enabling instant startup and crash recovery."
    ],
    "furtherReading": [
      {
        "title": "Basho: Bitcask Architecture Whitepaper",
        "url": "https://riak.com/assets/bitcask-intro.pdf"
      },
      {
        "title": "Arpit Bhayani: Bitcask - A Log-Structured Fast KV Store",
        "url": "https://arpitbhayani.me/blogs/bitcask/"
      },
      {
        "title": "Riak KV Documentation: Bitcask Backend",
        "url": "https://docs.riak.com/riak/kv/latest/setup/planning/backend/bitcask/index.html"
      }
    ]
  },
  "lsm-tree-storage-engine": {
    "title": "LSM-tree storage engine",
    "video": {
      "youtubeId": "9Plg3Oi1MT8",
      "title": "FAST database writes with LSM (Log-Structured Merge trees)",
      "channel": "Ben Dicken",
      "why": "Ben Dicken (PlanetScale) builds up memtables, SSTables, levels and compaction with excellent interactive visuals and clear reasoning about costs.",
      "length": "15:03"
    },
    "videos": [
      {
        "youtubeId": "IHtVWGhG0Xg",
        "title": "#04 - Database Storage: Log-Structured Merge Trees & Tuples (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "CMU 15-445 lecture covering LSM-trees rigorously, including levels, compaction and read paths, alongside tuple storage.",
        "length": "1:22:41"
      },
      {
        "youtubeId": "I6jB0nM9SKU",
        "title": "The Secret Sauce Behind NoSQL: LSM Tree",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "ByteByteGo's seven-minute overview of the LSM-tree, a good first pass before the deeper material.",
        "length": "7:35"
      }
    ],
    "intuition": "<p>Picture a library that receives thousands of returned books an hour. Shelving each one immediately would mean running all over the building. Instead, returns go onto a sorted cart. When the cart is full, it is rolled into the stacks as one sorted batch. Periodically, librarians merge batches together so that finding a book means checking only a few sorted batches, not hundreds.</p>\n<p><strong>Mental model:</strong> an LSM-tree buffers writes in a sorted in-memory table, flushes them as immutable sorted files, and merges those files in the background into progressively larger levels.</p>\n<ul>\n<li><strong>Trap: \"writes are free.\"</strong> Every byte is rewritten several times by compaction. Compaction bandwidth sets the real sustained write rate.</li>\n<li><strong>Trap: deletes that do not delete.</strong> A delete writes a tombstone; space returns only after compaction pushes the tombstone past all older versions.</li>\n<li><strong>Trap: ignoring Level 0.</strong> L0 files overlap, so too many of them slow every read; engines throttle writes when L0 grows.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Log-Structured Merge-Tree (LSM-Tree)</h2>\n      <p>While Bitcask requires all keys to fit in memory, real-world big-data systems (Google Bigtable, Apache Cassandra, RocksDB, ScyllaDB) handle datasets where both keys and values vastly exceed RAM. The <strong>LSM-Tree</strong> organizes sorted data into a memory buffer and a hierarchy of disk-resident levels, enabling high write throughput, efficient range scans, and dense data compression.</p>\n\n      <h2>The Multi-Tier LSM-Tree Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Application Write\"] --> WAL[\"Write-Ahead Log (Disk: Append-Only)\"]\n    Client --> Memtable[\"Active Memtable: SkipList (RAM)\"]\n    \n    Memtable -->|\"Flushed when full (64MB)\"| ImmMemtable[\"Immutable Memtable (RAM)\"]\n    ImmMemtable -->|\"Background Flush\"| L0[\"Level 0 SSTables (Disk: Keys Overlap)\"]\n    \n    L0 -->|\"Leveled Compaction\"| L1[\"Level 1 SSTables (Disk: Non-Overlapping)\"]\n    L1 -->|\"Leveled Compaction (10x Size)\"| L2[\"Level 2 SSTables (Disk: Non-Overlapping)\"]\n      </div>\n\n      <h2>Core Invariants of the LSM-Tree</h2>\n      <ul>\n        <li><strong>Sorted Invariant:</strong> Data inside every Memtable and SSTable is strictly sorted by key. This enables binary search within blocks, efficient merge-sort during compaction, and fast range scans.</li>\n        <li><strong>Immutability Invariant:</strong> Once an SSTable is written to disk, it is NEVER modified. Deletes and updates are handled by appending newer entries or tombstones.</li>\n        <li><strong>Compaction-dependent layout:</strong> Level 0 files commonly overlap. Leveled compaction usually keeps files within each lower level non-overlapping, while size-tiered or universal strategies may retain overlapping sorted runs. The read path must follow the selected strategy's invariant.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: how many levels for 2 TB?</h2>\n<p>Using RocksDB-style defaults: 64 MB memtable, level 1 target 256 MB, and a size multiplier of 10 per level.</p>\n<table>\n<thead><tr><th>Level</th><th>Target size</th><th>Cumulative</th></tr></thead>\n<tbody>\n<tr><td>L1</td><td>256 MB</td><td>0.25 GB</td></tr>\n<tr><td>L2</td><td>2.56 GB</td><td>2.8 GB</td></tr>\n<tr><td>L3</td><td>25.6 GB</td><td>28 GB</td></tr>\n<tr><td>L4</td><td>256 GB</td><td>284 GB</td></tr>\n<tr><td>L5</td><td>2.56 TB</td><td>2.8 TB</td></tr>\n</tbody>\n</table>\n<p>So 2 TB needs five levels below L0. Because each level is ten times the one above, about 90% of the data lives in the last level, which is why space amplification of leveled compaction is roughly 1.1x.</p>\n<h2>A point lookup, worst case</h2>\n<ol>\n<li>Active memtable, then any immutable memtables: in RAM.</li>\n<li>Each L0 file, newest first (often up to about 4 before compaction is triggered).</li>\n<li>At most one file per level in L1 to L5, found by key range metadata.</li>\n</ol>\n<p>That is up to about 9 candidate files. Bloom filters at 10 bits per key (about 1% false positives) mean a lookup for a key that exists costs roughly one data block read, plus a few percent extra from false positives, and a lookup for a missing key usually costs no data block reads at all.</p>\n<h2>Where LSM-trees are used</h2>\n<ul>\n<li><strong>RocksDB:</strong> embedded engine inside MyRocks, CockroachDB (historically; now Pebble, a Go LSM), TiKV and Kafka Streams state stores.</li>\n<li><strong>Cassandra and ScyllaDB:</strong> per-table LSM storage with selectable compaction strategies.</li>\n<li><strong>Bigtable and HBase:</strong> tablets or regions made of SSTables or HFiles plus a memtable.</li>\n</ul>\n<div class=\"mermaid\">flowchart LR\n  W[\"Write\"] --> WAL[\"WAL append\"]\n  W --> MT[\"Memtable\"]\n  MT -->|\"flush when full\"| L0[\"L0 SSTables\"]\n  L0 -->|\"compaction\"| L1[\"L1 256 MB\"]\n  L1 -->|\"compaction\"| L2[\"L2 2.56 GB\"]\n  L2 -->|\"compaction\"| LN[\"L3 to L5\"]\n</div>\n</div>",
    "keyTakeaways": [
      "LSM-trees buffer writes in memory (Memtable) and persist them as immutable sorted files (SSTables).",
      "Data is always kept sorted by key, enabling range queries and merge-sort compaction.",
      "RocksDB and Cassandra use LSM-trees to absorb massive write workloads with minimal write latency."
    ],
    "furtherReading": [
      {
        "title": "O'Neil et al.: The Log-Structured Merge-Tree (Original 1996 Paper)",
        "url": "https://www.cs.umb.edu/~poneil/lsmtree.pdf"
      },
      {
        "title": "RocksDB Wiki: Wiki Start (LSM-Tree based storage engine)",
        "url": "https://github.com/facebook/rocksdb/wiki"
      },
      {
        "title": "Luo & Carey: LSM-based Storage Techniques: A Survey (The VLDB Journal, 2020)",
        "url": "https://link.springer.com/article/10.1007/s00778-019-00555-y"
      }
    ]
  },
  "memtable-wal-and-sstable": {
    "title": "Memtable, WAL, and SSTable",
    "video": {
      "youtubeId": "ciGAVER_erw",
      "title": "LSM Tree + SSTable Database Indexes | Systems Design Interview: 0 to 1 with Google Software Engineer",
      "channel": "Jordan has no life",
      "why": "Jordan walks the write path through WAL, memtable and SSTable, plus sparse indexes and compaction, at exactly the depth this unit targets.",
      "length": "15:35"
    },
    "videos": [
      {
        "youtubeId": "V_C-T5S-w8g",
        "title": "RocksDB: A High Performance Embedded Key-Value Store for Flash Storage - Data@Scale",
        "channel": "Meta Developers",
        "role": "deep-dive",
        "why": "Dhruba Borthakur's Data@Scale talk on RocksDB's design at Facebook: memtables, WAL, SST files and why it was built for flash.",
        "length": "27:14"
      }
    ],
    "intuition": "<p>A busy restaurant takes orders three ways at once. The waiter shouts the order to the kitchen log (so it is not forgotten if the waiter faints), pins the ticket on a sorted rail the cooks work from (fast to see, but it would be lost in a fire), and at closing, all the day's tickets are filed into a bound ledger that never changes.</p>\n<p><strong>Mental model:</strong> the WAL gives durability, the memtable gives a fast sorted view in memory, and the SSTable is the immutable sorted file the memtable becomes when it fills.</p>\n<ul>\n<li><strong>Trap: assuming every write is fsynced.</strong> Many engines default to leaving WAL writes in the OS page cache (RocksDB <code>sync=false</code>, Cassandra periodic commitlog sync every 10 s). A process crash is safe; a power loss can lose the last moments.</li>\n<li><strong>Trap: deleting the WAL too early.</strong> A WAL segment can be dropped only after the memtable it covers is durably flushed.</li>\n<li><strong>Trap: huge memtables.</strong> Bigger memtables mean fewer flushes but longer recovery replay and more RAM.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Triad of LSM Engines: Write Path Deep Dive</h2>\n      <p>Every write operation in an LSM-tree database coordinates between three distinct components to provide durability (once the WAL append is synced), high concurrency, and rapid searchability.</p>\n\n      <h2>The Write Path Coordination</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    Req[\"Mutation: Put(Key, Val)\"] --> WAL[\"1. Append to WAL (Disk: O_APPEND)\"]\n    Req --> Memtable[\"2. Insert into SkipList (DRAM)\"]\n    Memtable --> LimitCheck{\"Memtable Full? (> 64MB)\"}\n    LimitCheck -->|\"No\"| Ack[\"Return Success to Client\"]\n    LimitCheck -->|\"Yes\"| Freeze[\"Freeze as Immutable Memtable\"]\n    Freeze --> FlushWorker[\"Background Flush Thread\"]\n    FlushWorker --> SSTable[\"Write New SSTable to L0 (Disk)\"]\n    SSTable --> Truncate[\"Truncate Obsolete WAL Log\"]\n      </div>\n\n      <h2>Under the Hood: Component Mechanics</h2>\n      <h3>1. The Write-Ahead Log (WAL)</h3>\n      <p>Because the in-memory Memtable is volatile, a server power failure would lose uncommitted writes. Before inserting into the Memtable, the engine appends the operation to the WAL on disk. Because the WAL is append-only, disk throughput reaches hundreds of megabytes per second. Upon recovery, the engine replays the WAL to reconstruct the Memtable.</p>\n\n      <h3>2. The Memtable (Concurrent SkipList)</h3>\n      <p>The Memtable is an in-memory sorted collection. Balanced trees such as red-black trees need rebalancing that is hard to make lock-free, whereas <strong>concurrent skiplists</strong> can be updated with atomic compare-and-swap (CAS) on forward pointers. Multiple application threads can write concurrently without mutex contention while maintaining sorted key order.</p>\n\n      <h3>3. The Sorted String Table (SSTable)</h3>\n      <p>When the Memtable exceeds its threshold (typically 64MB or 128MB), it transitions to an immutable state and a fresh Memtable is allocated. A background thread iterates over the sorted Memtable sequentially, writing it to disk as an <strong>SSTable</strong>. An SSTable consists of data blocks (typically about 4KB before compression), an index block mapping keys to block offsets, and a Bloom filter.</p>\n    \n<!-- enriched -->\n<h2>Worked example: one write, one flush, one crash</h2>\n<ol>\n<li><code>put(\"k17\", v)</code> is appended to <code>000123.log</code> and inserted into the active 64 MB memtable (a skiplist).</li>\n<li>After roughly 64 MB of writes (about 60,000 records of 1 KB), the memtable becomes immutable and a new memtable and a new log file start.</li>\n<li>A background thread iterates the immutable memtable in key order and writes <code>000124.sst</code>: data blocks of about 4 KB (before compression), an index block with one entry per data block, a filter block (Bloom filter), and a fixed-size footer pointing to the index.</li>\n<li>After the SST is synced and recorded in the MANIFEST, <code>000123.log</code> can be deleted.</li>\n<li>If the process crashes before step 4, recovery reads the MANIFEST to learn the live SSTs and replays any log files not yet covered, rebuilding the memtable.</li>\n</ol>\n<h2>Durability knobs</h2>\n<table>\n<thead><tr><th>Mode</th><th>What is lost on power failure</th><th>Throughput</th><th>Example</th></tr></thead>\n<tbody>\n<tr><td>Sync every write</td><td>Nothing acknowledged</td><td>Lowest, bounded by flush latency</td><td>RocksDB <code>sync=true</code></td></tr>\n<tr><td>Group or batch sync</td><td>Nothing acknowledged; writes wait for the next group flush</td><td>High</td><td>Cassandra batch or group commitlog modes</td></tr>\n<tr><td>Periodic sync</td><td>Up to the sync interval</td><td>Highest</td><td>Cassandra default periodic, 10 s</td></tr>\n<tr><td>No WAL</td><td>Entire memtable</td><td>Highest</td><td>Bulk loads that can be redone</td></tr>\n</tbody>\n</table>\n<h2>Why a skiplist</h2>\n<p>A skiplist keeps keys sorted with expected O(log n) inserts and is easy to make safe for concurrent readers with a single writer (LevelDB) or concurrent writers using compare-and-swap on forward pointers (RocksDB's concurrent memtable writes). Sorted order is what makes the flush a single sequential pass.</p>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Write stalls:</strong> if flushes cannot keep up, immutable memtables pile up and the engine blocks writers.</li>\n<li><strong>Slow recovery:</strong> many large WAL files mean long replay after a crash.</li>\n<li><strong>Torn WAL tail:</strong> per-record checksums let recovery stop at the last complete record.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "WAL provides durability (once appends are synced) via fast sequential appends, while Memtable provides fast concurrent in-memory sorting.",
      "SkipLists are preferred over balanced trees for Memtables because CAS pointers allow lock-free concurrent writes.",
      "Flushing Memtables sequentially writes immutable SSTables containing data blocks, sparse indexes, and Bloom filters."
    ],
    "furtherReading": [
      {
        "title": "RocksDB Architecture Guide: Memtable and WAL",
        "url": "https://github.com/facebook/rocksdb/wiki/RocksDB-Basics"
      },
      {
        "title": "Andy Pavlo: Database Logging (CMU 15-445/645 Lecture Notes, Fall 2024)",
        "url": "https://15445.courses.cs.cmu.edu/fall2024/notes/20-logging.pdf"
      },
      {
        "title": "Google LevelDB: Implementation Notes (Log, Memtable, Sorted Tables, Compactions)",
        "url": "https://github.com/google/leveldb/blob/main/doc/impl.md"
      }
    ]
  },
  "lsm-read-path-bloom-and-sparse-index": {
    "title": "LSM read path: Bloom filters and sparse index",
    "video": {
      "youtubeId": "kfFacplFY4Y",
      "title": "What Are Bloom Filters?",
      "channel": "Spanning Tree",
      "why": "Spanning Tree's animated explanation of Bloom filters, including false positives and why there are no false negatives, is the clearest route to the core idea of this unit.",
      "length": "6:03"
    },
    "videos": [
      {
        "youtubeId": "auI8BTws-f8",
        "title": "Monkey: Optimal Navigable Key-Value Store - Teaser",
        "channel": "Harvard DASlab",
        "role": "deep-dive",
        "why": "Harvard DASlab's Monkey teaser shows how Bloom-filter memory should be allocated across LSM levels to minimize lookup cost.",
        "length": "6:09"
      },
      {
        "youtubeId": "IHtVWGhG0Xg",
        "title": "#04 - Database Storage: Log-Structured Merge Trees & Tuples (CMU Intro to Database Systems)",
        "channel": "CMU Database Group",
        "role": "deep-dive",
        "why": "CMU 15-445 lecture that walks the full LSM read path, including filters and per-file indexes.",
        "length": "1:22:41"
      }
    ],
    "intuition": "<p>Imagine searching for a book across ten branch libraries. Before driving to each, you phone and ask: \"Could you possibly have it?\" Each branch has a quick lookup that sometimes says \"maybe\" when the answer is really no, but never says \"no\" when it actually has the book. You drive only to the \"maybe\" branches. Once there, a floor directory tells you which single shelf to check.</p>\n<p><strong>Mental model:</strong> Bloom filters decide which SSTables are worth opening; the sparse index decides which single block inside that SSTable to read.</p>\n<ul>\n<li><strong>Trap: expecting Bloom filters to help range scans.</strong> Point filters answer \"is this exact key present?\"; range scans need prefix filters or must visit every overlapping file.</li>\n<li><strong>Trap: forgetting filter memory.</strong> At 10 bits per key, 10 billion keys need about 12.5 GB of filters.</li>\n<li><strong>Trap: thinking false positives are rare everywhere.</strong> A 1% rate per file, checked across many files, adds up.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The LSM Read Penalty (Read Amplification)</h2>\n      <p>While LSM-trees achieve stellar write throughput, read operations face a significant challenge: a key may reside in the active Memtable, an immutable Memtable, or across multiple SSTables spanning several disk levels. Without optimizations, a single <code>Get(key)</code> could require dozens of random disk reads. To achieve sub-millisecond reads, modern LSM engines combine <strong>Sparse Indexes</strong> and <strong>Bloom Filters</strong>.</p>\n\n      <h2>The Multi-Layer Read Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Req[\"Client: Get('user:8821')\"] --> CheckMem[\"1. Active Memtable (RAM)\"]\n    CheckMem -->|\"Hit\"| Return[\"Return Value\"]\n    CheckMem -->|\"Miss\"| CheckImm[\"2. Immutable Memtables (RAM)\"]\n    CheckImm -->|\"Hit\"| Return\n    CheckImm -->|\"Miss\"| CheckBloom{\"3. Check Bloom Filter (RAM)\"}\n    \n    CheckBloom -->|\"Negative (Definite No)\"| SkipSST[\"Skip SSTable Entirely (0 Disk Reads)\"]\n    CheckBloom -->|\"Positive (Maybe)\"| SparseIndex[\"4. Binary Search Sparse Index (RAM)\"]\n    \n    SparseIndex --> FetchBlock[\"5. Read 4KB Block from SSTable (Disk)\"]\n    FetchBlock --> SearchBlock[\"6. Binary Search Inside Block\"]\n    SearchBlock --> Return\n      </div>\n\n      <h2>Under the Hood: Bloom Filter Mathematics</h2>\n      <p>A Bloom filter is a space-efficient probabilistic data structure that tests set membership with <strong>zero false negatives</strong> (if it says the key is not in the SSTable, it is 100% guaranteed not to be there) and a tunable false positive rate p.</p>\n      <p>Given n keys and target false positive probability p, the optimal number of bits m and hash functions k are:</p>\n      <pre><code>m = - (n * ln(p)) / (ln(2)^2)\nk = (m / n) * ln(2)</code></pre>\n      <p>Allocating just <strong>10 bits per key</strong> achieves a false positive rate of ~ 1%, allowing the engine to bypass physical disk reads for 99% of non-existent key lookups.</p>\n\n      <h2>The Sparse Index</h2>\n      <p>Rather than indexing every single key in the SSTable (which would consume excessive RAM), the engine creates a <strong>Sparse Index</strong> storing only one key for every 4KB data block (the first key of each block). To find key K, the engine performs a binary search in RAM over the sparse index to identify the single 4KB block that could contain K, and reads only that 4KB chunk from disk.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing filters and indexes</h2>\n<p>One SSTable holds 1 million keys. With 10 bits per key the filter is 10 million bits, about 1.25 MB. The optimal number of hash functions is k = (m / n) x ln 2, which is about 6.9, so 7. The false positive rate is about (1 - e^(-k n / m))^k, roughly 0.8%.</p>\n<table>\n<thead><tr><th>Bits per key</th><th>Best k</th><th>False positive rate</th></tr></thead>\n<tbody>\n<tr><td>5</td><td>3</td><td>about 9%</td></tr>\n<tr><td>10</td><td>7</td><td>about 0.8%</td></tr>\n<tr><td>15</td><td>10</td><td>about 0.07%</td></tr>\n</tbody>\n</table>\n<p>For a whole node holding 1 TB in 4 KB blocks, the index has about 268 million entries. At roughly 30 bytes per entry (separator key plus block handle), that is about 8 GB, too much to pin in RAM. RocksDB addresses this with partitioned index and filter blocks that are loaded on demand through the block cache, keeping only the top-level partition index resident.</p>\n<h2>A lookup for a missing key</h2>\n<p>A key absent from all 6 sorted runs it might be in: without filters, 6 block reads. With 1% false positive filters the expected cost is 6 x 0.01 = 0.06 block reads. That is why negative lookups, such as \"does this username exist?\", are nearly free in LSM engines.</p>\n<h2>Optimizations real engines use</h2>\n<ul>\n<li><strong>Prefix Bloom filters (RocksDB):</strong> hash a key prefix so bounded range scans within one prefix can skip files.</li>\n<li><strong>Monkey-style allocation:</strong> giving smaller, upper levels lower false positive rates and the huge last level a higher one minimizes total expected I/O for the same memory.</li>\n<li><strong>Ribbon filters (RocksDB):</strong> about 30% less memory than Bloom filters for the same false positive rate, at more CPU to build.</li>\n<li><strong>Block cache:</strong> hot index, filter and data blocks stay in memory, so most reads never reach the device.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Bloom filters eliminate 99% of negative disk reads by guaranteeing zero false negatives using ~10 bits per key in RAM.",
      "Sparse indexes store only one boundary key per 4KB disk block, minimizing memory footprint while directing reads to exact disk blocks.",
      "The read path queries in order: Active Memtable -> Immutable Memtables -> Level 0 SSTables -> Level 1..N SSTables."
    ],
    "furtherReading": [
      {
        "title": "Google Guava BloomFilter Implementation & Math",
        "url": "https://github.com/google/guava/wiki/HashingExplained"
      },
      {
        "title": "Burton H. Bloom: Space/Time Trade-offs in Hash Coding with Allowable Errors (Communications of the ACM, 1970)",
        "url": "https://dl.acm.org/doi/10.1145/362686.362692"
      },
      {
        "title": "Dayan & Idreos: Dostoevsky: Better Space-Time Trade-Offs for LSM-Tree Based Key-Value Stores via Adaptive Removal of Superfluous Merging (SIGMOD, 2018)",
        "url": "https://dl.acm.org/doi/10.1145/3183713.3196927"
      }
    ]
  },
  "compaction-and-amplification": {
    "title": "Compaction and amplification",
    "video": {
      "youtubeId": "fmXgXripmh0",
      "title": "Niv Dayan, Harvard University, Dostoevsky: Better Space-Time Trade-Offs for LSM-Tree Based Key-Value",
      "channel": "Sigmod 2018",
      "why": "Niv Dayan's SIGMOD talk explains exactly how tiering and leveling trade write, read and space amplification, and how lazy leveling picks a better point: the heart of this unit.",
      "length": "21:08"
    },
    "videos": [
      {
        "youtubeId": "TyTXOjFMi7k",
        "title": "DS210.16 Size-Tiered Compaction | Operations with Apache Cassandra",
        "channel": "DataStax Developers",
        "role": "intro",
        "why": "DataStax's operations lesson on size-tiered compaction in Cassandra, with practical triggers, disk headroom and tombstone behavior.",
        "length": "13:26"
      },
      {
        "youtubeId": "hkMkBZn2mGs",
        "title": "Dissecting, Designing, and Optimizing LSM-based Data Stores (Tutorial at SIGMOD 2022)",
        "channel": "Data-Intensive Systems and Computing Lab - BU",
        "role": "deep-dive",
        "why": "Boston University's SIGMOD 2022 tutorial dissecting the LSM compaction design space in depth.",
        "length": "1:20:25"
      }
    ],
    "intuition": "<p>Think of tidying a messy garage. You can tidy a little every day, moving each item into its proper bin as soon as possible (lots of handling, but the garage always looks neat and things are easy to find). Or you can let piles build and, when there are four similar piles, combine them into one bigger pile (much less handling, but more piles to dig through and you need floor space for the merge).</p>\n<p><strong>Mental model:</strong> compaction chooses how often each byte gets rewritten. Leveled compaction rewrites more to keep reads and space tight; tiered compaction rewrites less but leaves more overlapping files and duplicate data.</p>\n<ul>\n<li><strong>Trap: leaving too little free disk.</strong> A size-tiered merge of large files can temporarily need as much free space as the files being merged.</li>\n<li><strong>Trap: tombstone pile-ups.</strong> Queue-like delete patterns in Cassandra make reads scan thousands of tombstones until compaction and gc_grace_seconds (default 10 days) allow purging.</li>\n<li><strong>Trap: ignoring write amplification on SSD budgets.</strong> 100 MB/s of user writes at 20x amplification is 2 GB/s of device writes.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Garbage Collection for Storage Engines</h2>\n      <p>Because LSM-trees never overwrite data in place, updates and deletes create duplicate entries and tombstones that accumulate across SSTable files. Without maintenance, disk space would grow indefinitely and read performance would degrade catastrophically. <strong>Compaction</strong> is the background merge-sort process that reconciles versions, purges tombstones, and reorganizes data.</p>\n\n      <h2>Size-Tiered Compaction (STCS) vs Leveled Compaction (LCS)</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph STCS [\"Size-Tiered Compaction (Cassandra Style)\"]\n      T1[\"SSTable A (~100MB)\"]\n      T2[\"SSTable B (~100MB)\"]\n      T3[\"SSTable C (~100MB)\"]\n      T4[\"SSTable D (~100MB)\"]\n      T1 & T2 & T3 & T4 -->|\"Merge Sort\"| LargeT[\"New Single SSTable (~400MB)\"]\n    end\n\n    subgraph LCS [\"Leveled Compaction (RocksDB Style)\"]\n      L0S[\"L0: Overlapping Files\"] -->|\"Compaction\"| L1S[\"L1: 10MB Non-Overlapping Files (Total: 10MB)\"]\n      L1S -->|\"10x Growth\"| L2S[\"L2: 10MB Non-Overlapping Files (Total: 100MB)\"]\n      L2S -->|\"10x Growth\"| L3S[\"L3: 10MB Non-Overlapping Files (Total: 1GB)\"]\n    end\n      </div>\n\n      <h2>Compaction Strategies Compared</h2>\n      <table>\n        <thead>\n          <tr><th>Metric</th><th>Size-Tiered Compaction (STCS)</th><th>Leveled Compaction (LCS)</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Algorithm</strong></td><td>Triggers when N SSTables of similar size accumulate in a tier. Merges them into one larger SSTable.</td><td>Each level L has a fixed capacity (10× L<sub>prev</sub>). Merges an SSTable from L into overlapping SSTables in L+1.</td></tr>\n          <tr><td><strong>Write Amplification</strong></td><td><strong>Low</strong> (~4x - 8x): Data is rewritten fewer times during its lifecycle.</td><td><strong>High</strong> (~10x - 30x): Data is rewritten repeatedly at each level down to the base tier.</td></tr>\n          <tr><td><strong>Space Amplification</strong></td><td><strong>High</strong> (Up to 100%): Requires 50% free disk headroom to perform merges of giant files.</td><td><strong>Low</strong> (~10% - 20%): Non-overlapping levels guarantee minimal redundant versions.</td></tr>\n          <tr><td><strong>Read Performance</strong></td><td>Moderate: Point reads must probe multiple overlapping SSTables in each tier.</td><td><strong>Exceptional</strong>: Non-overlapping files guarantee a key exists in at most ONE SSTable per level below L0 (L0 files overlap and may all need checking).</td></tr>\n        </tbody>\n      </table>\n    \n<!-- enriched -->\n<h2>Worked example: what amplification costs in hardware</h2>\n<p>A service ingests 50 MB/s of new data into a leveled LSM with a size ratio of 10 and 5 levels.</p>\n<ul>\n<li>Each level merge rewrites the incoming data plus the overlapping part of the next level, which with a ratio of 10 costs up to about 10 bytes written per byte moved down. Across levels, practical leveled write amplification is typically quoted around 10-30x.</li>\n<li>At 20x, the device absorbs 1 GB/s of writes, around 86 TB per day. A drive rated for 1 drive-write-per-day at 7.68 TB would wear out many times faster than rated, which is why write-heavy clusters use tiered or hybrid compaction, bigger memtables, or key-value separation (BlobDB, WiscKey).</li>\n<li>With size-tiered compaction at 4 files per tier, each byte is rewritten about once per tier, so perhaps 4-6x total, but a point read may probe several overlapping files per tier and space can temporarily double during large merges.</li>\n</ul>\n<h2>Strategy map</h2>\n<table>\n<thead><tr><th>Strategy</th><th>Write amp</th><th>Read cost</th><th>Space amp</th><th>Default in</th></tr></thead>\n<tbody>\n<tr><td>Leveled</td><td>High</td><td>Low: at most one file per level below L0</td><td>About 1.1x</td><td>RocksDB, ScyllaDB and Cassandra option LCS</td></tr>\n<tr><td>Size-tiered</td><td>Low</td><td>Higher: several runs per tier</td><td>Up to 2x during merges</td><td>Cassandra (STCS)</td></tr>\n<tr><td>Universal (RocksDB tiered)</td><td>Low to moderate</td><td>Moderate</td><td>Can reach 2x</td><td>RocksDB option</td></tr>\n<tr><td>Time-window</td><td>Low for time series</td><td>Good for recent windows</td><td>Low if data expires by TTL</td><td>Cassandra TWCS for time series</td></tr>\n<tr><td>Lazy leveling (Dostoevsky)</td><td>Tiered on upper levels</td><td>Leveled on last level</td><td>Low</td><td>Research, influenced hybrid designs</td></tr>\n</tbody>\n</table>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Write stalls:</strong> when L0 file counts or pending compaction bytes exceed limits, RocksDB slows and then stops writes.</li>\n<li><strong>Compaction debt after bulk loads:</strong> read latency stays poor until the backlog clears; ingest pre-sorted files instead.</li>\n<li><strong>Tombstone thresholds:</strong> Cassandra warns at 1,000 tombstones scanned per query and fails the query at 100,000 by default.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Compaction is the multi-way merge sort that reclaims space from obsolete versions and tombstones.",
      "Size-Tiered Compaction minimizes write amplification, making it ideal for write-heavy append workloads (Cassandra).",
      "Leveled Compaction minimizes space amplification and maximizes read performance, making it the standard for RocksDB."
    ],
    "furtherReading": [
      {
        "title": "RocksDB Leveled Compaction Architecture",
        "url": "https://github.com/facebook/rocksdb/wiki/Leveled-Compaction"
      },
      {
        "title": "Sarkar et al.: Constructing and Analyzing the LSM Compaction Design Space (VLDB, 2021)",
        "url": "https://www.vldb.org/pvldb/vol14/p2216-sarkar.pdf"
      },
      {
        "title": "RocksDB Wiki: Universal Compaction",
        "url": "https://github.com/facebook/rocksdb/wiki/Universal-Compaction"
      }
    ]
  },
  "object-storage-vs-database": {
    "title": "Object storage vs database",
    "video": {
      "youtubeId": "RvaMHMxHjp4",
      "title": "Object Storage in System Design Interviews w/ Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Kept: Hello Interview's object-storage video is squarely about when to put blobs in object storage versus a database, presigned URLs and metadata-in-DB patterns.",
      "length": "12:37"
    },
    "videos": [
      {
        "youtubeId": "KhHr4chx_ZM",
        "title": "Data Storage Types: File,  Block, & Object",
        "channel": "Sunny Classroom",
        "role": "intro",
        "why": "A five-minute, clearly illustrated explanation of block, file and object storage, matching the unit's three-primitives framing.",
        "length": "5:21"
      }
    ],
    "intuition": "<p>A bank keeps two very different things: a ledger of balances that changes constantly and must be exact to the cent, and a vault of safety deposit boxes that are rarely opened and are just handed over whole. You would never store gold bars in the ledger, and you would never track balances by rewriting the entire vault. Databases are the ledger; object storage is the vault.</p>\n<p><strong>Mental model:</strong> put small, mutable, queryable facts in a database; put large, write-once blobs in object storage; connect them with a row that stores the object key, size and checksum.</p>\n<ul>\n<li><strong>Trap: blobs in the database by default.</strong> Multi-megabyte values bloat backups, replication and cache. Store them as objects unless you truly need transactional atomicity with the row.</li>\n<li><strong>Trap: forgetting the two-system consistency gap.</strong> Upload succeeds and the DB insert fails (orphan), or the row exists and the object does not (dangling). Plan cleanup.</li>\n<li><strong>Trap: ignoring request costs.</strong> Millions of tiny objects cost more in requests than in storage.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Three Storage Abstractions</h2>\n      <p>Enterprise infrastructure categorizes persistent storage into three distinct fundamental primitives: <strong>Block Storage</strong>, <strong>File Storage</strong>, and <strong>Object Storage</strong>. Choosing the wrong primitive leads to catastrophic scaling bottlenecks and astronomical cloud bills.</p>\n\n      <h2>Storage Primitive Comparison</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph Block [\"1. Block Storage (EBS / SAN)\"]\n      B1[\"Raw 512B / 4KB Sectors\"] --> OS[\"Filesystem mounted by single OS kernel (ext4, XFS)\"]\n    end\n\n    subgraph File [\"2. File Storage (EFS / NFS)\"]\n      F1[\"POSIX Tree Hierarchy (/usr/bin/...)\"] --> Locks[\"Distributed locking and shared network mounts\"]\n    end\n\n    subgraph Object [\"3. Object Storage (S3 / GCS)\"]\n      O1[\"Flat Namespace (Bucket + Key)\"] --> REST[\"HTTP REST API (GET, PUT, DELETE) - Immutable Blobs\"]\n    end\n      </div>\n\n      <h2>Detailed Architectural Differences</h2>\n      <table>\n        <thead>\n          <tr><th>Feature</th><th>Relational / NoSQL Database</th><th>Object Storage (S3 / GCS)</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Data Granularity</strong></td><td>Fine-grained: Mutate single columns, rows, or key-value fields.</td><td>Coarse-grained: Entire blobs (bytes 0 to N). Partial in-place mutation is not supported; an object can only be replaced or deleted as a whole.</td></tr>\n          <tr><td><strong>Access Protocol</strong></td><td>Binary database protocols (TCP sockets, prepared statements, gRPC).</td><td>HTTP/1.1 and HTTP/2 REST APIs (<code>PUT /bucket/key</code>, <code>GET /bucket/key</code>).</td></tr>\n          <tr><td><strong>Latency Profile</strong></td><td>Sub-millisecond to low single-digit milliseconds (100µs - 5ms).</td><td>Tens to low hundreds of milliseconds time-to-first-byte (AWS cites roughly 100-200 ms for small objects on S3 Standard; S3 Express One Zone offers single-digit milliseconds).</td></tr>\n          <tr><td><strong>Throughput & Scaling</strong></td><td>Bound by cluster instance size and replication topologies.</td><td>Virtually infinite: Scale to millions of concurrent requests across petabytes.</td></tr>\n          <tr><td><strong>Cost per Gigabyte</strong></td><td>High (~$0.10 - $0.50 / GB / month on managed SSD volumes).</td><td>Ultra-Low (~$0.015 - $0.023 / GB / month on standard tiers).</td></tr>\n        </tbody>\n      </table>\n    \n<!-- enriched -->\n<h2>Worked example: 50 million photos</h2>\n<p>50 million images averaging 500 KB is 25 TB.</p>\n<table>\n<thead><tr><th>Option</th><th>Approximate monthly storage cost</th><th>Notes</th></tr></thead>\n<tbody>\n<tr><td>S3 Standard, about USD 0.023 per GB-month</td><td>About USD 575</td><td>Durability across multiple AZs is included</td></tr>\n<tr><td>Database on gp3 SSD, about USD 0.08 per GB-month, 3 replicas</td><td>About USD 6,000 before instance costs</td><td>Plus larger backups and slower replica rebuilds</td></tr>\n</tbody>\n</table>\n<p>Request costs matter too. At roughly USD 0.005 per 1,000 PUTs and USD 0.0004 per 1,000 GETs, 50 million uploads cost about USD 250 once and 100 million monthly reads cost about USD 40; a CDN in front usually removes most reads. Prices vary by region and change over time, so treat these as orders of magnitude.</p>\n<h2>The standard pattern</h2>\n<ol>\n<li>Client asks the API for an upload; the API creates a pending row <code>(photo_id, owner, status=pending)</code> and returns a presigned PUT URL for key <code>photos/ab/photo_id</code>.</li>\n<li>Client uploads directly to object storage, bypassing the application servers.</li>\n<li>An upload-complete event or client callback verifies size and checksum, then marks the row <code>active</code>.</li>\n<li>A periodic sweeper deletes objects with no active row older than a day, and alerts on active rows whose object is missing.</li>\n</ol>\n<h2>When a database blob is reasonable</h2>\n<ul>\n<li>Values are small (kilobytes) and read together with the row.</li>\n<li>You need the blob to commit or roll back atomically with other rows.</li>\n<li>The total volume is modest and the operational simplicity of one system wins.</li>\n</ul>\n<p>Since December 2020, S3 provides strong read-after-write consistency for PUTs and LISTs, which removes an old class of \"row says active but GET returns 404\" races.</p>\n</div>",
    "keyTakeaways": [
      "Databases provide low-latency sub-millisecond access to mutable, fine-grained structured records.",
      "Object storage provides named blob versions over an HTTP API; keys can usually be overwritten or deleted, while retained versions may be immutable. Cost and latency depend on provider, tier, request mix, and data transfer.",
      "For large independently accessed payloads, compare object storage with database blobs using transactionality, backup, access size, request cost, and operational simplicity rather than applying a universal prohibition."
    ],
    "furtherReading": [
      {
        "title": "AWS S3 Documentation: Overview of Object Storage",
        "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"
      },
      {
        "title": "Sears, van Ingen & Gray: To BLOB or Not To BLOB: Large Object Storage in a Database or a Filesystem? (Microsoft Research, 2006)",
        "url": "https://www.microsoft.com/en-us/research/publication/to-blob-or-not-to-blob-large-object-storage-in-a-database-or-a-filesystem/"
      },
      {
        "title": "AWS DynamoDB Documentation: Best Practices for Storing Large Items and Attributes (Use Amazon S3)",
        "url": "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-use-s3-too.html"
      }
    ]
  },
  "s3-object-storage-architecture": {
    "title": "S3 object storage architecture",
    "video": {
      "youtubeId": "sc3J4McebHE",
      "title": "FAST '23 - Building and Operating a Pretty Big Storage System (My Adventures in Amazon S3)",
      "channel": "USENIX",
      "why": "Andy Warfield's FAST '23 keynote is the most authoritative public account of how S3 is built and operated at scale, from drives to ShardStore to durability culture.",
      "length": "53:21"
    },
    "videos": [
      {
        "youtubeId": "NXehLy7IiPM",
        "title": "AWS re:Invent 2024 - Dive deep on Amazon S3 (STG302)",
        "channel": "AWS Events",
        "role": "deep-dive",
        "why": "AWS's own re:Invent 2024 deep dive on S3 internals: request routing, the index, storage fleet, and how scale shapes design.",
        "length": "52:09"
      },
      {
        "youtubeId": "5vL6aCvgQXU",
        "title": "How AWS S3 is built",
        "channel": "The Pragmatic Engineer",
        "role": "case-study",
        "why": "The Pragmatic Engineer interview with S3 leadership on the history, architecture and engineering practices behind S3.",
        "length": "1:18:14"
      }
    ],
    "intuition": "<p>A giant coat check for the whole planet splits the work into three roles: the front desk checks your ticket and ID, a ledger records which rack holds your coat, and the racks themselves just hold coats. Each role can grow independently: more desks when lines are long, a bigger ledger when there are more coats, more racks when space runs out.</p>\n<p><strong>Mental model:</strong> S3-like systems separate a stateless front end, a strongly consistent metadata index (key to data location), and a massive storage fleet that holds chunks spread across failure domains.</p>\n<ul>\n<li><strong>Trap: treating a key prefix like a directory.</strong> There are no real folders; \"directories\" are key prefixes, and listing is a range scan over the index.</li>\n<li><strong>Trap: ignoring per-prefix request rates.</strong> S3 supports at least 3,500 writes and 5,500 reads per second per partitioned prefix, and scales by splitting prefixes.</li>\n<li><strong>Trap: guessing internals.</strong> Public talks describe the shape; specific coding parameters and databases are not all public.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>A representative disaggregated object-storage architecture</h2>\n      <p>Large object stores commonly separate metadata lookup from payload placement. The topology below is a representative design, not a claim that AWS publicly uses these exact chunk sizes, coding parameters, databases, or placement rules for every S3 object.</p>\n\n      <h2>S3 Disaggregated System Topology</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client HTTP Request: PUT /photos/vacation.jpg\"] --> Edge[\"S3 Frontend API Gateway\"]\n    \n    subgraph MetadataPlane [\"Metadata Plane (Index Subsystem)\"]\n      Edge -->|\"1. Resolve bucket & permissions\"| MetaEngine[\"LSM-Tree Metadata Index (Sharded Key-Value)\"]\n      MetaEngine -->|\"2. Record object metadata, version, ETag\"| MetaStore[(\"Distributed Inode & Parts DB\")]\n    end\n    \n    subgraph PayloadPlane [\"Payload Storage Plane (Chunk Nodes)\"]\n      Edge -->|\"3. Stream 64MB Chunks\"| ChunkManager[\"Storage Node Orchestrator\"]\n      ChunkManager -->|\"4. Reed-Solomon Erasure Coding (8+4)\"| StorageNodes[\"Fragments placed across independent failure domains\"]\n    end\n      </div>\n\n      <h2>Internal Subsystems of S3</h2>\n      <ul>\n        <li><strong>Frontend API Routers:</strong> Thousands of stateless reverse proxies terminating TLS, validating AWS SigV4 cryptographic signatures, and enforcing per-prefix rate limits.</li>\n        <li><strong>Metadata Subsystem (Index):</strong> A specialized key-value store optimized for lexicographical prefix scanning. Because S3 supports list operations (<code>GET /bucket?prefix=users/</code>), the metadata tier organizes keys in partitioned B-trees or LSM-trees rather than simple hash rings.</li>\n        <li><strong>Storage Node Fleet:</strong> Commodity servers packed with 3.5-inch high-density HDDs. Each node runs ShardStore, a Rust key-value store that maps shard identifiers to data using an LSM-tree over extents it manages directly on disk.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: the life of a PUT</h2>\n<ol>\n<li>DNS routes <code>PUT /my-bucket/logs/2026/09/30/app.gz</code> to a front-end fleet host, which terminates TLS and verifies the SigV4 signature and bucket policy.</li>\n<li>The front end asks placement for storage targets and streams the body, splitting it into shards that are replicated or erasure coded across devices in different Availability Zones (for S3 Standard, at least three AZs).</li>\n<li>Only after enough shards are durably stored does the front end write the index entry mapping the key and version to the shard locations.</li>\n<li>The index write is the commit point; the client receives <code>200 OK</code> with an ETag. Since 2020, a subsequent GET or LIST observes the new object (strong read-after-write consistency).</li>\n</ol>\n<h2>Public numbers worth knowing</h2>\n<table>\n<thead><tr><th>Fact</th><th>Value</th></tr></thead>\n<tbody>\n<tr><td>Maximum object size</td><td>5 TB</td></tr>\n<tr><td>Maximum single PUT</td><td>5 GB; larger objects use multipart upload</td></tr>\n<tr><td>Multipart parts</td><td>Up to 10,000 parts, 5 MB to 5 GB each (last part may be smaller)</td></tr>\n<tr><td>Request rate per partitioned prefix</td><td>At least 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD per second</td></tr>\n<tr><td>Designed durability (S3 Standard)</td><td>11 nines annually</td></tr>\n<tr><td>Scale cited by AWS in recent talks</td><td>Hundreds of trillions of objects, over 100 million requests per second at peak</td></tr>\n</tbody>\n</table>\n<h2>What ShardStore actually is</h2>\n<p>ShardStore is the storage-node software that S3 runs on its disks: a Rust key-value store, organized as an LSM-tree over disk extents, that maps shard identifiers to their data. AWS described validating it with lightweight formal methods in an SOSP 2021 paper. It is not the object metadata index.</p>\n<h2>Failure modes the architecture is designed for</h2>\n<ul>\n<li><strong>Drive and host loss:</strong> constant; repaired by rebuilding shards elsewhere from surviving shards.</li>\n<li><strong>AZ loss:</strong> shards spread across AZs so objects remain readable.</li>\n<li><strong>Hot prefixes:</strong> the index automatically partitions busy key ranges; sudden spikes can see 503 Slow Down responses until it adapts, so clients retry with backoff.</li>\n<li><strong>Heat skew on drives:</strong> Warfield describes spreading new data so that each drive holds a mix of hot and cold data, balancing I/O across a fleet of millions of disks.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "A scalable object-store design can separate a strongly controlled metadata plane from a payload storage plane.",
      "Payloads may be chunked, replicated or erasure-coded across independent failure domains according to the service's durability contract.",
      "The metadata engine indexes keys lexicographically to support fast delimiter and prefix searches."
    ],
    "furtherReading": [
      {
        "title": "Amazon Science: Using Lightweight Formal Methods to Validate S3 (ShardStore)",
        "url": "https://www.amazon.science/publications/using-lightweight-formal-methods-to-validate-a-key-value-storage-node-in-amazon-s3"
      },
      {
        "title": "Andy Warfield (All Things Distributed): Building and Operating a Pretty Big Storage System Called S3",
        "url": "https://www.allthingsdistributed.com/2023/07/building-and-operating-a-pretty-big-storage-system.html"
      },
      {
        "title": "S3 API Reference: Amazon Simple Storage Service (REST API)",
        "url": "https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html"
      }
    ]
  },
  "range-partitioning-vs-consistent-hashing-storage": {
    "title": "Range partitioning vs consistent hashing for storage",
    "video": {
      "youtubeId": "Bt8ZMC_Yuys",
      "title": "Introduction to Partitioning | Systems Design Interview 0 to 1 with Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Jordan directly contrasts range-based and hash-based partitioning, their hotspot and range-query consequences, which is exactly this unit's comparison.",
      "length": "10:55"
    },
    "videos": [
      {
        "youtubeId": "vccwdhfqIrI",
        "title": "Consistent Hashing: Easy Explanation for System Design Interviews",
        "channel": "Hello Interview",
        "role": "intro",
        "why": "Hello Interview's short, clear explanation of consistent hashing and virtual nodes.",
        "length": "7:14"
      },
      {
        "youtubeId": "YvRm6HVEJEE",
        "title": "Chapter 6 - Partitioning - Designing Data Intensive applications book review",
        "channel": "Kunal Cholera",
        "role": "deep-dive",
        "why": "A chapter review of DDIA Chapter 6 on partitioning, covering key-range vs hash partitioning, secondary indexes and rebalancing.",
        "length": "14:48"
      }
    ],
    "intuition": "<p>Two ways to split a phone book among 26 volunteers. Give each a letter range (A, B, C...): finding everyone named \"Sm\" through \"Sn\" is one person's job, but in some towns the \"S\" volunteer is swamped. Or give each volunteer the names whose hash lands on their number: work is evenly spread, but finding \"everyone between Sm and Sn\" means asking all 26.</p>\n<p><strong>Mental model:</strong> range partitioning keeps adjacent keys together (great scans, hotspot risk); hash partitioning scatters them (even load, no efficient range scans). Most real systems combine them: hash on a partition key, sort within it.</p>\n<ul>\n<li><strong>Trap: timestamp or auto-increment keys under range partitioning.</strong> All new writes hit the last range. Prefix with a hash or tenant id.</li>\n<li><strong>Trap: believing hashing removes hot keys.</strong> One celebrity key still lands on one owner. You need splitting, caching or replication of that key.</li>\n<li><strong>Trap: plain modulo hashing.</strong> Changing N remaps nearly every key; consistent hashing moves about 1/N.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Fundamental Partitioning Dilemma</h2>\n      <p>When a storage system grows beyond a single physical server, the keyspace must be split across hundreds or thousands of nodes. Distributed systems rely on two foundational partitioning paradigms: <strong>Range Partitioning</strong> and <strong>Consistent Hashing</strong>.</p>\n\n      <h2>Architectural Comparison</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph RangePart [\"Range Partitioning (Bigtable / Spanner / HBase)\"]\n      RNode1[\"Node 1: Keys a to g\"]\n      RNode2[\"Node 2: Keys g to p\"]\n      RNode3[\"Node 3: Keys p to z\"]\n    end\n\n    subgraph HashPart [\"Consistent Hashing (Dynamo / Cassandra / Riak)\"]\n      Ring[\"Token Ring [0 .. 2^64-1]\"]\n      HNode1[\"Node A (Token 1000)\"]\n      HNode2[\"Node B (Token 5000)\"]\n      HNode3[\"Node C (Token 9000)\"]\n    end\n      </div>\n\n      <h2>Tradeoff Matrix</h2>\n      <table>\n        <thead>\n          <tr><th>Dimension</th><th>Range Partitioning</th><th>Consistent Hashing</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Range Queries</strong></td><td><strong>Extremely Efficient</strong>: Sequential keys reside on contiguous nodes. <code>BETWEEN '2026-01-01' AND '2026-01-31'</code> hits exactly 1-2 nodes.</td><td><strong>Terrible</strong>: Adjacent keys hash to completely random positions on the ring. Range queries across partition keys require scatter-gather to every node (ranges within one partition key, via clustering or sort keys, stay efficient).</td></tr>\n          <tr><td><strong>Hot Spot Vulnerability</strong></td><td><strong>High</strong>: Monotonically increasing keys (auto-increment IDs, timestamps) direct 100% of write traffic to the single tail partition.</td><td>Spreads distinct sequential keys, but a single hot key or skewed request distribution can still overload one owner.</td></tr>\n          <tr><td><strong>Metadata Coordination</strong></td><td>Requires a centralized Partition Manager / Coordinator to track split boundaries and rebalance tablets.</td><td>Decentralized: Nodes determine partition ownership locally via token ring ranges and gossip protocols.</td></tr>\n        </tbody>\n      </table>\n    \n<!-- enriched -->\n<h2>Worked example: how much data moves when you add a node</h2>\n<p>A cluster has 10 nodes holding 10 TB. You add an 11th.</p>\n<table>\n<thead><tr><th>Scheme</th><th>Fraction of keys that move</th><th>Data moved</th></tr></thead>\n<tbody>\n<tr><td>hash(key) mod N</td><td>About 10/11, roughly 91%</td><td>About 9.1 TB</td></tr>\n<tr><td>Consistent hashing with many virtual nodes</td><td>About 1/11, roughly 9%</td><td>About 0.9 TB, taken evenly from all nodes</td></tr>\n<tr><td>Range partitioning with split and move</td><td>Only the ranges assigned to the new node</td><td>Chosen by the balancer, for example about 0.9 TB</td></tr>\n</tbody>\n</table>\n<h2>Worked example: the timestamp hotspot</h2>\n<p>An event table keyed by <code>event_time</code> under range partitioning receives 50,000 writes per second. Every new key is greater than all existing keys, so 100% of writes land on the tail range, whatever the cluster size. Fixes:</p>\n<ul>\n<li><strong>Composite key:</strong> <code>(device_id, event_time)</code> spreads writes across devices while keeping each device's events in time order.</li>\n<li><strong>Salting:</strong> prefix with <code>hash(event_id) mod 16</code>; writes spread over 16 ranges, but a time-range query must fan out to 16 ranges.</li>\n<li><strong>Pre-splitting:</strong> HBase and Bigtable users create split points ahead of time so a new table does not start on one server.</li>\n</ul>\n<h2>How real systems choose</h2>\n<table>\n<thead><tr><th>System</th><th>Scheme</th><th>Range queries</th></tr></thead>\n<tbody>\n<tr><td>Bigtable, HBase, Spanner, CockroachDB, TiKV</td><td>Range, with automatic splits</td><td>Efficient across the whole keyspace</td></tr>\n<tr><td>Cassandra, ScyllaDB</td><td>Hash of partition key on a token ring</td><td>Only within a partition, via clustering columns</td></tr>\n<tr><td>DynamoDB</td><td>Hash of partition key into internal partitions, sort key ordered within</td><td>Only within a partition key</td></tr>\n<tr><td>MongoDB</td><td>Either ranged or hashed shard keys</td><td>Depends on the choice</td></tr>\n</tbody>\n</table>\n</div>",
    "keyTakeaways": [
      "Range partitioning keeps data sorted, enabling ultra-fast range queries but risking severe write hotspots on sequential keys.",
      "Consistent hashing uniformly distributes writes across nodes via hash tokens, but makes multi-key range scans prohibitively expensive.",
      "Spanner and Bigtable choose Range Partitioning; Cassandra uses a consistent-hashing token ring, and DynamoDB hash-partitions the partition key into internally managed partitions (sort-key ordered within each)."
    ],
    "furtherReading": [
      {
        "title": "Corbett et al.: Spanner: Google's Globally-Distributed Database (USENIX OSDI, 2012)",
        "url": "https://research.google/pubs/spanner-googles-globally-distributed-database-2/"
      },
      {
        "title": "Karger et al.: Consistent Hashing and Random Trees: Distributed Caching Protocols for Relieving Hot Spots (STOC, 1997)",
        "url": "https://dl.acm.org/doi/10.1145/258533.258660"
      },
      {
        "title": "DeCandia et al.: Dynamo: Amazon's Highly Available Key-value Store (SOSP, 2007)",
        "url": "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf"
      }
    ]
  },
  "partition-manager-and-map-table": {
    "title": "Partition manager and map table",
    "video": {
      "youtubeId": "x2MdvCTWh3o",
      "title": "BigTable - One Database to Rule Them All?. | Distributed Systems Deep Dives With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Jordan's Bigtable paper deep dive covers the master, tablet servers, the three-level METADATA location hierarchy and tablet splits, which is exactly this unit's model.",
      "length": "38:38"
    },
    "videos": [
      {
        "youtubeId": "LgbrmIjH0cU",
        "title": "How data is managed: the Keyspace, Replicas, and Ranges",
        "channel": "CockroachDB",
        "role": "intro",
        "why": "CockroachDB's three-minute explanation of keyspace, ranges and replicas, a modern take on range maps.",
        "length": "3:21"
      },
      {
        "youtubeId": "OJySfiMKXLs",
        "title": "CockroachDB: Architecture of a Geo-Distributed SQL Database | Cockroach Labs",
        "channel": "AI Council",
        "role": "deep-dive",
        "why": "Cockroach Labs' architecture talk including how ranges split, how meta ranges route requests and how replicas rebalance.",
        "length": "37:42"
      }
    ],
    "intuition": "<p>A huge encyclopedia set on a library floor: the front desk has a small card saying which aisle holds which volume range, each aisle has a sign saying which shelf holds which letters, and the shelf holds the books. When a volume grows too thick it is split in two, and only the aisle sign needs updating. Visitors remember the directions they used last time and only ask again when they find the book is not where they expected.</p>\n<p><strong>Mental model:</strong> a range-partitioned store keeps a map from key ranges to servers, stored as a small hierarchy of tables that are themselves ranges. Clients cache the map and refresh it lazily on misses.</p>\n<ul>\n<li><strong>Trap: routing every request through a coordinator.</strong> The map should be cached by clients; the manager only handles splits, moves and failures.</li>\n<li><strong>Trap: assuming a split copies data.</strong> With immutable SSTables, children can reference the parent's files; data is rewritten later by compaction.</li>\n<li><strong>Trap: ignoring the split-brain case.</strong> Only one server may serve a range at a time; this needs leases or locks (Chubby in Bigtable, Raft leases in CockroachDB).</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Coordinating Range-Partitioned Tablets</h2>\n      <p>In range-partitioned storage engines (like Google Bigtable, CockroachDB, and Apache HBase), data is divided into contiguous dynamic ranges called <strong>Tablets</strong> or <strong>Ranges</strong>. As tablets grow through writes, they must split and migrate across the server fleet. The <strong>Partition Manager</strong> and <strong>Routing Map Table</strong> orchestrate this distributed metadata.</p>\n\n      <h2>Three-Level Routing Hierarchy (Bigtable Model)</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client SDK\"] -->|\"1. Fetch Root Location\"| Chubby[\"Chubby / Etcd Consensus Lock Service\"]\n    Chubby -->|\"Points to\"| RootTablet[\"Root Tablet (Metadata Level 1)\"]\n    RootTablet -->|\"Points to\"| MetaTablets[\"Metadata Tablets (Metadata Level 2)\"]\n    MetaTablets -->|\"Points to\"| UserTablets[\"User Data Tablets (Thousands of Nodes)\"]\n    Client -->|\"2. Cache Routing Entries Locally\"| LocalCache[\"Client Route Cache\"]\n      </div>\n\n      <h2>Under the Hood: The Tablet Split</h2>\n      <p>When a user tablet exceeds a size threshold (e.g. 256MB):</p>\n      <ol>\n        <li>The tablet server hosting the range picks a split row key (typically near the middle of its data) and splits the tablet into two child ranges locally.</li>\n        <li>Because underlying SSTable data files are immutable, the split is instantaneous: child tablets reference the parent's SSTables with restricted start/end key boundaries (zero data copying).</li>\n        <li>The tablet server commits the split by recording the new tablet in the METADATA table, then notifies the master (Bigtable describes no two-phase transaction here).</li>\n        <li>Clients with stale cached locations discover them on a miss (the server no longer serves that row range), then invalidate the entry and walk back up the METADATA hierarchy for a fresh location.</li>\n      </ol>\n    \n<!-- enriched -->\n<h2>Worked example: Bigtable's location hierarchy capacity</h2>\n<p>The Bigtable paper stores each tablet's location as a METADATA row of about 1 KB, and caps METADATA tablets at 128 MB.</p>\n<ul>\n<li>One METADATA tablet holds 128 MB / 1 KB, about 2^17 (131,072) locations.</li>\n<li>The root tablet (never split) points at up to 2^17 METADATA tablets, which together point at about 2^17 x 2^17 = 2^34 user tablets.</li>\n<li>At 128 MB per user tablet, that addresses 2^61 bytes, far beyond any deployment.</li>\n</ul>\n<p>Lookup cost from the paper: with an empty client cache, locating a tablet takes three network round trips (Chubby file, root tablet, METADATA tablet). With a stale cache, it can take up to six, because stale entries are discovered only on misses.</p>\n<h2>How systems implement the map</h2>\n<table>\n<thead><tr><th>System</th><th>Range unit and default size</th><th>Map location</th><th>Who decides placement</th></tr></thead>\n<tbody>\n<tr><td>Bigtable</td><td>Tablet, roughly 100-200 MB in the paper</td><td>Chubby file, root tablet, METADATA table</td><td>Master (single, with Chubby lock)</td></tr>\n<tr><td>HBase</td><td>Region, split around 10 GB by default</td><td><code>hbase:meta</code> table, location in ZooKeeper</td><td>HMaster</td></tr>\n<tr><td>CockroachDB</td><td>Range, up to 512 MiB by default</td><td>Two-level meta1 and meta2 ranges</td><td>Distributed per-node allocators and replicate queues</td></tr>\n<tr><td>TiKV</td><td>Region</td><td>Placement Driver (PD)</td><td>PD cluster</td></tr>\n</tbody>\n</table>\n<h2>A split, step by step (CockroachDB style)</h2>\n<ol>\n<li>A range exceeds its size threshold; the leaseholder picks a split key.</li>\n<li>A distributed transaction updates the range descriptors and the meta2 addressing records for both halves atomically.</li>\n<li>Both halves initially live on the same replicas; the rebalancer later moves one half elsewhere.</li>\n<li>Clients sending to the old descriptor get a range-key-mismatch error, refresh their cache from meta2 and retry.</li>\n</ol>\n</div>",
    "keyTakeaways": [
      "A 3-level hierarchical metadata table maps hundreds of millions of user ranges with zero central bottleneck.",
      "Clients cache range-to-node routing tables locally; stale entries are discovered on misses and refreshed lazily (up to six round trips in Bigtable).",
      "Tablet splits are instant metadata-only operations because immutable SSTables are partitioned by key boundaries without copying files."
    ],
    "furtherReading": [
      {
        "title": "Chang et al.: Bigtable: A Distributed Storage System for Structured Data",
        "url": "https://research.google/pubs/pub27898/"
      },
      {
        "title": "CockroachDB Docs: Distribution Layer (Ranges and Meta Ranges)",
        "url": "https://docs.cockroachlabs.com/docs/stable/architecture/distribution-layer"
      },
      {
        "title": "Shute et al.: F1: A Distributed SQL Database That Scales (VLDB, 2013)",
        "url": "https://www.vldb.org/pvldb/vol6/p1232-shute.pdf"
      }
    ]
  },
  "metadata-db-for-object-storage": {
    "title": "Metadata database for object storage",
    "video": {
      "youtubeId": "aN2KysHRsZA",
      "title": "FAST '21 - Facebook's Tectonic Filesystem: Efficiency from Exascale",
      "channel": "USENIX",
      "why": "Meta's FAST '21 Tectonic talk shows a real exabyte-scale design where metadata is disaggregated into name, file and block layers on a sharded key-value store, precisely this unit's concern.",
      "length": "12:00"
    },
    "videos": [
      {
        "youtubeId": "BS_noBr-UlI",
        "title": "Design a S3-like File System - Most Frequently Asked Question in Databricks",
        "channel": "ShowOffer - Tech Interview Coaching Platform",
        "role": "interview",
        "why": "A full S3-like storage design walkthrough that spends real time on the metadata service, listing, and partitioning choices.",
        "length": "50:47"
      }
    ],
    "intuition": "<p>A giant self-storage facility is useless without the front office's records: which unit holds whose belongings, when it was rented, who may open it. The records are tiny compared to what is stored, but every single visit touches them, so the office, not the warehouse, is what gets overwhelmed first.</p>\n<p><strong>Mental model:</strong> the metadata database is a sorted, strongly consistent map from (bucket, key, version) to object attributes and data locations; listing a \"folder\" is a range scan over that map.</p>\n<ul>\n<li><strong>Trap: hash-partitioning keys you need to list.</strong> Prefix listing needs keys stored in sorted order, at least within a bucket or directory.</li>\n<li><strong>Trap: sequential key names.</strong> Keys like timestamps concentrate writes on one index partition until it splits.</li>\n<li><strong>Trap: forgetting pagination.</strong> A prefix may hold billions of keys; LIST must return pages with a continuation token.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: High-Throughput Inode Engines</h2>\n      <p>In an object storage system, object metadata (bucket, key, size, ETag, owner, ACLs, creation timestamp, and chunk pointers) is tiny (~500 bytes per object), but queries against it are astronomical. The metadata database must support millions of transactions per second, atomic key updates, and instantaneous lexicographical delimiter listings (e.g. <code>GET /bucket?prefix=logs/2026/&delimiter=/</code>).</p>\n\n      <h2>Metadata Schema and Index Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph Request [\"API Request\"]\n      Req[\"GET /photos/2026/march/beach.jpg\"]\n    end\n\n    subgraph MetaDB [\"Distributed Metadata Storage Tier (FoundationDB / CockroachDB)\"]\n      Schema[\"Primary Key: (bucket_id, object_prefix, object_name, version_id)\"]\n      Attributes[\"Columns: { size: 4194304, etag: 'a1b2c3d4', chunks: [chunk_id_1, chunk_id_2] }\"]\n      PrefixIdx[\"Inverted Prefix Index: 'photos/2026/march/' -> [beach.jpg, sunset.jpg]\"]\n    end\n\n    Req --> Schema\n      </div>\n\n      <h2>Under the Hood: Lexicographical Prefix Traversal</h2>\n      <p>Unlike traditional POSIX filesystems that represent directories as physical inode link trees (which require walking directory paths sequentially), object storage engines treat paths as flat string keys. By storing keys in a sorted B-tree or LSM-tree ordered by <code>(bucket_id, key_name)</code>, listing the contents of a \"virtual directory\" reduces to an efficient range scan that starts at <code>photos/2026/march/</code> and continues while keys still begin with that prefix.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a delimiter listing</h2>\n<p>Index rows for bucket <code>photos</code>, in sorted order:</p>\n<ul>\n<li><code>2026/march/a.jpg</code></li>\n<li><code>2026/march/b.jpg</code></li>\n<li><code>2026/march/trip/c.jpg</code></li>\n<li><code>2026/march/trip/d.jpg</code></li>\n<li><code>2026/may/e.jpg</code></li>\n</ul>\n<p>Request <code>GET /photos?prefix=2026/march/&amp;delimiter=/</code>:</p>\n<ol>\n<li>Seek to the first key at or after <code>2026/march/</code>.</li>\n<li>Return <code>a.jpg</code> and <code>b.jpg</code> as objects.</li>\n<li><code>2026/march/trip/c.jpg</code> contains another <code>/</code> after the prefix, so emit the common prefix <code>2026/march/trip/</code> once and skip ahead past every key starting with it.</li>\n<li>Stop at <code>2026/may/e.jpg</code>, which no longer matches the prefix.</li>\n</ol>\n<p>S3 returns up to 1,000 entries per page and an opaque continuation token that encodes where the scan stopped, so the next call resumes the range scan exactly there instead of starting over.</p>\n<h2>Sizing</h2>\n<p>100 billion objects at about 500 bytes of metadata each is 50 TB, or 150 TB with 3 replicas. At 1 million metadata operations per second and 50,000 operations per second per shard, you need at least 20 shards before headroom, and realistically hundreds to allow for hot spots.</p>\n<h2>Partitioning the metadata</h2>\n<table>\n<thead><tr><th>Approach</th><th>Listing</th><th>Hotspots</th><th>Example</th></tr></thead>\n<tbody>\n<tr><td>Range partition on (bucket, key)</td><td>Efficient range scans</td><td>Sequential names concentrate load; needs automatic splits</td><td>S3 index partitions by key prefix</td></tr>\n<tr><td>Hash partition by directory id</td><td>Efficient within one directory</td><td>Very hot directories</td><td>Tectonic name layer on ZippyDB</td></tr>\n<tr><td>Hash partition by object or file id</td><td>Needs a separate name index</td><td>Well spread</td><td>Tectonic file and block layers</td></tr>\n<tr><td>Metadata stored in a general-purpose distributed DB</td><td>Depends on schema</td><td>Depends on schema</td><td>Colossus metadata in Bigtable</td></tr>\n</tbody>\n</table>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Commit ordering:</strong> write data first, then the metadata entry; otherwise readers see entries pointing at nothing.</li>\n<li><strong>Orphaned data:</strong> data written but metadata commit failed; needs garbage collection by scanning for unreferenced chunks.</li>\n<li><strong>Listing large prefixes:</strong> expensive scans; systems often offer inventory reports as an alternative.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Object storage metadata treats directory paths as flat strings sorted lexicographically in distributed B-tree/LSM stores.",
      "Virtual folder listing reduces to a single contiguous range scan over composite index keys.",
      "Hyperscale storage systems keep metadata in strongly consistent, sorted distributed stores, but the engines differ (FoundationDB at Apple and Snowflake, Bigtable for Google Colossus, ZippyDB for Meta Tectonic, a purpose-built index for S3)."
    ],
    "furtherReading": [
      {
        "title": "Zhou et al.: FoundationDB: A Distributed Unbundled Transactional Key Value Store (SIGMOD, 2021)",
        "url": "https://www.foundationdb.org/files/fdb-paper.pdf"
      },
      {
        "title": "Rick Cattell: Scalable SQL and NoSQL Data Stores (ACM SIGMOD Record, 2011)",
        "url": "https://dl.acm.org/doi/10.1145/1978915.1978919"
      },
      {
        "title": "Pan et al.: Facebook's Tectonic Filesystem: Efficiency from Exascale (USENIX FAST, 2021)",
        "url": "https://www.usenix.org/conference/fast21/presentation/pan"
      }
    ]
  },
  "append-only-object-storage-stream-layer": {
    "title": "Append-only stream layer",
    "video": {
      "youtubeId": "QnYdbQO0yj4",
      "title": "11 Windows Azure Storage: A Highly Available Cloud Storage Service with Strong Consistency",
      "channel": "sosp2011",
      "why": "The SOSP 2011 Windows Azure Storage talk introduces the stream layer, extents, sealing and the partition layer on top, which is the original source of this unit's design.",
      "length": "29:52"
    },
    "videos": [
      {
        "youtubeId": "2nmmyjDrNpg",
        "title": "5 Minutes About Pulsar | How BookKeeper keeps your data safe",
        "channel": "DataStax Developers",
        "role": "intro",
        "why": "A five-minute DataStax explainer of how Apache BookKeeper replicates append-only ledgers and protects them during failures.",
        "length": "4:32"
      }
    ],
    "intuition": "<p>Picture a courtroom stenographer's tape, copied live by three stenographers. Nobody ever edits earlier pages; they only add to the end. If the lead stenographer collapses, the judge declares \"the record ends here\", sealing the tape at the last line everyone agrees on, and hands a fresh tape to a new lead. Anything the old lead tries to add afterwards is refused.</p>\n<p><strong>Mental model:</strong> a stream is an ordered list of append-only extents; only the last extent accepts appends, and failover seals it at an agreed length before a new writer continues on a new extent.</p>\n<ul>\n<li><strong>Trap: acknowledging before all replicas have the bytes.</strong> Sealing at the shortest replica's length is safe only if no append was acknowledged until every replica had it (Azure's approach) or a quorum rule is used consistently (BookKeeper).</li>\n<li><strong>Trap: no fencing.</strong> A paused old writer that wakes up can corrupt the log unless storage nodes reject its stale epoch.</li>\n<li><strong>Trap: confusing sealing with deleting.</strong> Sealed extents stay readable; they just never change again, which makes them easy to erasure code later.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Low-Level Storage Stream Engine</h2>\n      <p>Modern cloud object storage engines (such as Azure Storage and Apache BookKeeper / Pulsar) do not write directly to arbitrary filesystem files. Instead, they operate on top of an internal <strong>Append-Only Stream Layer</strong>. A stream is an unbounded, durable sequence of immutable bytes composed of ordered extents (Azure's term; this unit also calls them chunks).</p>\n\n      <h2>The Chunk Append Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    Writer[\"Primary Storage Worker\"] -->|\"Append(data)\"| ChunkServer1[\"Storage Node 1 (Primary)\"]\n    ChunkServer1 -->|\"Replicate Append\"| ChunkServer2[\"Storage Node 2 (Replica)\"]\n    ChunkServer1 -->|\"Replicate Append\"| ChunkServer3[\"Storage Node 3 (Replica)\"]\n    \n    ChunkServer2 & ChunkServer3 -->|\"Ack\"| ChunkServer1\n    ChunkServer1 -->|\"Committed Offset\"| Writer\n      </div>\n\n      <h2>Handling Network Partitions: Lease Fencing & Sealed Chunks</h2>\n      <p>The hardest challenge in distributed append-only storage is network split-brain: what happens if a primary storage node experiences a network blip and another node is promoted to take its place?</p>\n      <ul>\n        <li><strong>Sealing Chunks:</strong> To prevent two writers from appending conflicting data to the same chunk, chunks are strictly <strong>sealed</strong>. When a master promotes a new stream writer, it contacts the storage node quorum and updates the chunk status to <code>SEALED</code> at the last universally agreed byte offset.</li>\n        <li><strong>Fencing (BookKeeper style):</strong> In Apache BookKeeper, ledger recovery fences the ledger on the storage nodes (bookies), so appends from the old, zombie writer are rejected; Kafka achieves the same with leader epochs. Azure's stream layer instead relies on the stream manager sealing the extent and allocating a new one for the new writer.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: sealing after a failure</h2>\n<p>An extent is replicated on three extent nodes, and the primary acknowledges an append only after all three replicas have written it.</p>\n<ol>\n<li>Appends up to byte 800 have been acknowledged to clients.</li>\n<li>The primary sends the next append (bytes 800-1000) to the replicas and crashes. Replicas A and B have written it; replica C has not.</li>\n<li>The stream manager seals the extent. It asks reachable replicas for their lengths: A = 1000, B = 1000, C = 800. It seals at the smallest length among the replicas it can reach, 800.</li>\n<li>Is anything lost? No: bytes 800-1000 were never acknowledged, so the client will retry. A and B trim to 800 when the seal is applied.</li>\n<li>The stream manager creates a new extent on a fresh set of nodes and the writer continues there.</li>\n</ol>\n<p>If replica C were unreachable at seal time, the manager would seal at 1000; when C returns, it syncs to the sealed length. Either way all replicas of a sealed extent become byte-identical.</p>\n<h2>Comparing append-only log layers</h2>\n<table>\n<thead><tr><th>System</th><th>Unit</th><th>Replication and acknowledgement</th><th>Split-brain protection</th></tr></thead>\n<tbody>\n<tr><td>Azure Storage stream layer</td><td>Extent, sealed around 1 GB</td><td>Chain to 3 replicas; ack after all</td><td>Stream manager (Paxos) seals and reassigns</td></tr>\n<tr><td>Apache BookKeeper</td><td>Ledger, split into entries</td><td>Ensemble with write quorum and ack quorum</td><td>Recovery sets a fence on bookies so the old writer's adds are rejected</td></tr>\n<tr><td>Kafka</td><td>Partition log split into segments</td><td>Leader plus in-sync replicas; acks=all</td><td>Leader epochs; controller fences stale leaders</td></tr>\n<tr><td>HDFS</td><td>Block in a file</td><td>Pipeline to 3 datanodes</td><td>NameNode lease recovery and generation stamps</td></tr>\n</tbody>\n</table>\n<h2>Why build object storage on streams</h2>\n<ul>\n<li>Sequential appends are the cheapest disk pattern and make replication simple to reason about.</li>\n<li>Sealed extents are immutable, so they can be erasure coded, scrubbed and moved without coordination with writers.</li>\n<li>The partition layer above (Azure's tables, blobs and queues) keeps its own logs and checkpoints in streams, so every higher layer inherits the same durability model.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Stream layers provide append-only chunk sequences that serve as the durable foundation for object storage.",
      "To prevent split-brain write corruption, chunks are sealed at fixed byte offsets before promoting new writers.",
      "Storage nodes enforce fencing tokens to immediately reject zombie writer nodes."
    ],
    "furtherReading": [
      {
        "title": "Calder et al.: Windows Azure Storage: A Highly Available Cloud Storage Service with Strong Consistency",
        "url": "https://sigops.org/s/conferences/sosp/2011/current/2011-Cascais/printable/11-calder.pdf"
      },
      {
        "title": "Hunt et al.: ZooKeeper: Wait-free Coordination for Internet-scale Systems (USENIX ATC, 2010)",
        "url": "https://www.usenix.org/legacy/events/atc10/tech/full_papers/Hunt.pdf"
      },
      {
        "title": "Chang et al.: Bigtable: A Distributed Storage System for Structured Data (OSDI, 2006)",
        "url": "https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/"
      }
    ]
  },
  "object-storage-durability-and-replication": {
    "title": "Durability and replication",
    "video": {
      "youtubeId": "gysjTDu5F90",
      "title": "AWS re:Invent 2022 - Beyond 11 9s of durability: Data protection with Amazon S3 (STG338)",
      "channel": "AWS Events",
      "why": "AWS's own re:Invent session on how S3 reaches and goes beyond 11 nines: failure-domain placement, repair, and the human and software processes that durability actually depends on.",
      "length": "55:00"
    },
    "videos": [
      {
        "youtubeId": "jgO09opx56o",
        "title": "Reed Solomon Tutorial: Backblaze Reed Solomon Encoding Example Case",
        "channel": "Backblaze",
        "role": "intro",
        "why": "Backblaze's five-minute worked example of Reed-Solomon encoding from a company that runs it in production.",
        "length": "5:04"
      },
      {
        "youtubeId": "VUxXH4uo4AY",
        "title": "Erasure Coding in Action: How Big Tech Saves Petabytes of Data",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "A visual, concise explanation of erasure coding versus replication and why large storage systems adopt it.",
        "length": "7:42"
      }
    ],
    "intuition": "<p>Suppose you must protect a 12-page contract. You could photocopy it three times and store copies in three buildings (simple, but triple the paper). Or you could store the 12 pages plus 4 cleverly computed \"summary\" pages across 16 buildings, such that any 12 of the 16 sheets let you rebuild the whole contract. You use a third more paper, not triple, and can lose any four buildings.</p>\n<p><strong>Mental model:</strong> durability is a race between failures and repair. Replication and erasure coding decide how many losses you can absorb; placement across failure domains and fast repair decide whether you ever reach that limit.</p>\n<ul>\n<li><strong>Trap: counting only tolerated failures.</strong> Repair speed matters just as much; slow rebuilds widen the window for further losses.</li>\n<li><strong>Trap: correlated failures.</strong> Fragments in the same rack or power domain can fail together; spread them.</li>\n<li><strong>Trap: durability is not availability.</strong> Data can be safe but temporarily unreadable.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: 11 9s Durability & Reed-Solomon Erasure Coding</h2>\n      <p>Achieving 99.999999999% (11 9s) annual durability means that if you store 10,000,000 objects, you can expect to lose a single object once every 10,000 years. Physical hard drives have an Annualized Failure Rate (AFR) of 1% to 4%. To survive constant disk, server, and datacenter failures at scale, storage architectures transition from simple replication to <strong>Reed-Solomon Erasure Coding</strong>.</p>\n\n      <h2>Replication (3x) vs Erasure Coding (8+4)</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph Rep [\"3-Way Replication (3x Storage, 200% Overhead)\"]\n      Data[\"Original 100MB Blob\"] --> R1[\"Copy 1 (100MB)\"]\n      Data --> R2[\"Copy 2 (100MB)\"]\n      Data --> R3[\"Copy 3 (100MB)\"]\n      Note1[\"Total Storage: 300MB. Can survive 2 disk failures.\"]\n    end\n\n    subgraph EC [\"Reed-Solomon 8+4 Erasure Coding (1.5x Storage, 50% Overhead)\"]\n      ECData[\"Original 100MB Blob\"] --> Split[\"Split into 8 Data Chunks (12.5MB each)\"]\n      Split --> Parity[\"Generate 4 Parity Chunks via Galois Field Matrix Math\"]\n      Parity --> Distribute[\"Distribute 12 chunks across independent failure domains\"]\n      Note2[\"Total Storage: 150MB. Can survive ANY 4 lost fragments (4 disk or rack failures if each fragment is in its own failure domain)\"]\n    end\n      </div>\n\n      <h2>Under the Hood: Erasure Coding Math</h2>\n      <p>An RS(k, m) scheme splits an object into k data fragments and generates m parity fragments using matrix multiplication over Galois finite fields GF(2<sup>w</sup>):</p>\n      <ul>\n        <li><strong>Storage Overhead:</strong> (k + m)/k. For RS(8, 4), the overhead is 12/8 = 1.5× (50% storage overhead), compared to 3.0× (200% overhead) for 3-way replication.</li>\n        <li><strong>Fault Tolerance:</strong> The system can reconstruct the entire original object from <em>any</em> k surviving fragments out of the total k + m fragments. In an RS(8, 4) cluster, the code can tolerate any four unavailable fragments. Real durability also depends on placing fragments in independent failure domains, detecting corruption, repairing before additional losses, and keeping metadata recoverable.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: how often do disks fail?</h2>\n<p>A cluster of 10,000 drives with a 2% annualized failure rate loses about 200 drives per year, one every 1.8 days. If each drive holds 16 TB and repair runs at 200 MB/s per drive rebuilt, rebuilding one drive's data serially takes about 22 hours. Real systems rebuild in parallel from many peers, so a drive's contents are re-protected in minutes to hours. The shorter that window, the less likely additional failures overlap it.</p>\n<h2>Replication and erasure codes compared</h2>\n<table>\n<thead><tr><th>Scheme</th><th>Storage overhead</th><th>Losses tolerated</th><th>Repair reads per lost fragment</th><th>Used by</th></tr></thead>\n<tbody>\n<tr><td>3-way replication</td><td>3.0x</td><td>2</td><td>1 copy</td><td>HDFS default, many databases</td></tr>\n<tr><td>RS(6,3)</td><td>1.5x</td><td>3</td><td>6 fragments</td><td>HDFS erasure coding policy</td></tr>\n<tr><td>RS(10,4)</td><td>1.4x</td><td>4</td><td>10 fragments</td><td>Facebook HDFS warehouse</td></tr>\n<tr><td>RS(17,3)</td><td>about 1.18x</td><td>3</td><td>17 fragments</td><td>Backblaze Vaults</td></tr>\n<tr><td>LRC(12,2,2)</td><td>about 1.33x</td><td>Any 3, plus many 4-failure patterns</td><td>6 fragments for a single loss</td><td>Azure Storage</td></tr>\n</tbody>\n</table>\n<p>The repair column is the hidden cost: rebuilding one lost fragment in RS(10,4) reads ten fragments across the network. Local Reconstruction Codes add local parities so the common single-failure case reads fewer fragments.</p>\n<h2>What 11 nines really means</h2>\n<p>AWS phrases it as: store 10 million objects and you can expect, on average, to lose one object every 10,000 years. That design target assumes independent failure domains (S3 Standard spreads data across at least three Availability Zones), continuous integrity checking, and fast repair. It does not protect against a user deleting their own data; versioning, Object Lock and replication to another region address that.</p>\n<h2>Failure modes</h2>\n<ul>\n<li><strong>Correlated failures:</strong> a firmware bug or bad batch of drives hitting many disks at once.</li>\n<li><strong>Repair storms:</strong> a rack loss triggers massive rebuild traffic that competes with user traffic; systems throttle and prioritize the most at-risk objects.</li>\n<li><strong>Silent corruption:</strong> without checksums and scrubbing, a fragment can be bad long before you need it.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "3-way replication incurs a 200% storage overhead and survives 2 drive failures.",
      "Reed-Solomon Erasure Coding (e.g. 8+4) reduces storage overhead to 50% while surviving any 4 lost fragments, which means 4 rack or drive failures only when each of the 12 fragments sits in a separate rack or drive.",
      "Galois field matrix math allows perfect reconstruction of data from any k surviving chunks."
    ],
    "furtherReading": [
      {
        "title": "James Plank: A Tutorial on Reed-Solomon Coding for Fault-Tolerance in RAID-like Systems",
        "url": "https://web.eecs.utk.edu/~jplank/plank/papers/CS-96-332.html"
      },
      {
        "title": "Weil et al.: Ceph: A Scalable, High-Performance Distributed File System (USENIX OSDI, 2006)",
        "url": "https://www.usenix.org/legacy/events/osdi06/tech/weil.html"
      },
      {
        "title": "Calder et al.: Windows Azure Storage: A Highly Available Cloud Storage Service with Strong Consistency (SOSP, 2011)",
        "url": "https://sigops.org/s/conferences/sosp/2011/current/2011-Cascais/printable/11-calder.pdf"
      }
    ]
  },
  "end-to-end-checksums": {
    "title": "End-to-end checksums",
    "video": {
      "youtubeId": "NNx9eZcbLnU",
      "title": "AWS re:Invent 2023 - Get started with checksums in Amazon S3 for data integrity checking (STG350)",
      "channel": "AWS Events",
      "why": "AWS explains how S3 computes and verifies checksums end to end, from client upload through storage and back, with supported algorithms: the exact practice this unit teaches.",
      "length": "16:31"
    },
    "videos": [
      {
        "youtubeId": "NRoUC9P1PmA",
        "title": "ZFS: The Last Word in File Systems Part 1",
        "channel": "Deirdré Straughan",
        "role": "deep-dive",
        "why": "Jeff Bonwick and Bill Moore's classic ZFS talk on why storage must checksum every block in the parent pointer to catch silent corruption, misdirected writes and phantom writes.",
        "length": "1:01:27"
      }
    ],
    "intuition": "<p>When you mail a valuable parcel you weigh it before sending and the recipient weighs it on arrival. If the weights differ, something happened in transit, even if the box looks fine. Storage needs the same habit, because disks, memory, cables and firmware can change bytes without reporting any error at all.</p>\n<p><strong>Mental model:</strong> compute a checksum as close to the data's origin as possible, carry it with the data through every hop, verify it at each boundary and on every read, and periodically re-verify data at rest.</p>\n<ul>\n<li><strong>Trap: trusting the layers below.</strong> TCP's 16-bit checksum and disk ECC catch many errors but not all; only an end-to-end check covers the whole path.</li>\n<li><strong>Trap: storing the checksum next to the data only.</strong> A misdirected write can land valid-looking data and checksum in the wrong place; ZFS stores the checksum in the parent pointer for this reason.</li>\n<li><strong>Trap: CRC is not security.</strong> CRC32C detects accidents; use SHA-256 or an HMAC when tampering is a concern.</li>\n</ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Silent Data Corruption & Bit Rot</h2>\n      <p>Modern storage systems do not fail merely by crashing or throwing I/O errors. Physical hardware experiences <strong>Silent Data Corruption (Bit Rot)</strong>: firmware bugs, misdirected or lost writes, media errors, cable noise and memory bit flips (for example from cosmic rays hitting DRAM) corrupt data without returning an operating system error code. High-durability systems implement <strong>End-to-End Checksums</strong>: CRCs to catch accidental corruption, and cryptographic hashes where tampering matters.</p>\n\n      <h2>The End-to-End Verification Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client SDK\"] -->|\"1. Compute CRC32C / MD5: '0x8A4B291F'\"| Gateway[\"API Gateway\"]\n    Gateway -->|\"2. Verify Checksum during ingest\"| ChunkServer[\"Storage Node\"]\n    ChunkServer -->|\"3. Write Block + Checksum Footer to Disk\"| Disk[(\"NVMe / HDD Media\")]\n    \n    subgraph Scrubber [\"Background Scrubbing Daemon\"]\n      Cron[\"Weekly Scrubbing Worker\"] -->|\"4. Read Block & Recalculate CRC32C\"| Verifier{\"Checksum Matches Footer?\"}\n      Verifier -->|\"Yes\"| OK[\"Data Valid\"]\n      Verifier -->|\"No (Bit Rot Detected!)\"| Heal[\"Trigger Auto-Repair: Rebuild Chunk via Erasure Coding\"]\n    end\n      </div>\n\n      <h2>Under the Hood: Checksum Algorithms & Hardware Acceleration</h2>\n      <ul>\n        <li><strong>CRC32C (Castagnoli):</strong> The gold standard for storage engines. Modern Intel and AMD x86 CPUs feature dedicated hardware instructions (<code>SSE 4.2 CRC32</code>) capable of calculating CRC32C at several GB/s per core for a single stream, and 20+ GB/s per core with interleaved multi-stream implementations.</li>\n        <li><strong>Block-Level Checksum Footers:</strong> Instead of computing one checksum per 100GB file, storage engines compute a 32-bit checksum for every 4KB block. This enables immediate corruption detection during random reads without scanning the entire file.</li>\n        <li><strong>Continuous Background Scrubbing:</strong> A low-priority background daemon continuously reads cold disks sequentially, re-verifies block checksums, and invokes erasure coding repair before a second disk failure causes catastrophic data loss.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: an upload verified end to end</h2>\n<ol>\n<li>The client computes CRC32C of the 64 MB file while reading it from local disk and sends it in <code>x-amz-checksum-crc32c</code>.</li>\n<li>The service computes the checksum of the bytes it received and rejects the PUT if it does not match; the client retries.</li>\n<li>Each stored shard carries its own block-level checksums, verified when written and on every read.</li>\n<li>On download the service returns the stored checksum, and the client verifies the bytes it received.</li>\n<li>Background scrubbers re-read data at rest, and a bad block is rebuilt from replicas or parity before it is needed.</li>\n</ol>\n<h2>Overhead of block checksums</h2>\n<p>1 PB stored in 4 KB blocks is about 244 billion blocks. At 4 bytes of CRC32C each, that is about 1 TB of checksums, roughly 0.1% overhead. With hardware CRC instructions, a single core can checksum many gigabytes per second, so the CPU cost is small compared to the I/O.</p>\n<h2>Choosing an algorithm</h2>\n<table>\n<thead><tr><th>Algorithm</th><th>Size</th><th>Speed</th><th>Detects</th><th>Typical use</th></tr></thead>\n<tbody>\n<tr><td>CRC32C</td><td>32 bits</td><td>Very fast with SSE4.2 or ARMv8 CRC</td><td>All burst errors up to 32 bits, most random errors</td><td>RocksDB blocks, iSCSI, ext4 metadata, S3 option</td></tr>\n<tr><td>xxHash64 or XXH3</td><td>64 bits</td><td>Very fast in software</td><td>Accidental corruption, lower collision rate</td><td>RocksDB option, many caches</td></tr>\n<tr><td>MD5</td><td>128 bits</td><td>Moderate</td><td>Accidental corruption; broken against attackers</td><td>Legacy ETags and Content-MD5</td></tr>\n<tr><td>SHA-256</td><td>256 bits</td><td>Slower without hardware support</td><td>Accidental and malicious changes</td><td>Content addressing, ZFS dedup, S3 option</td></tr>\n</tbody>\n</table>\n<h2>Where silent corruption comes from</h2>\n<ul>\n<li><strong>Memory bit flips:</strong> the reason servers use ECC RAM; checksums computed after a flip will faithfully protect the wrong data, so compute early.</li>\n<li><strong>Firmware bugs:</strong> misdirected writes (right data, wrong place) and phantom writes (acknowledged but never written).</li>\n<li><strong>Defective CPUs:</strong> Google and Meta have both published on \"silent data corruption\" from faulty cores that compute wrong results.</li>\n<li><strong>Media decay:</strong> latent sector errors on disks that are only discovered when read, which is why scrubbing matters.</li>\n</ul>\n</div>",
    "keyTakeaways": [
      "Silent bit rot corrupts bytes on physical media without triggering OS or hardware controller errors.",
      "CRC32C is hardware-accelerated by modern CPU instruction sets, delivering several GB/s per core for a single stream and over 20GB/s per core with interleaved multi-stream implementations.",
      "Continuous background scrubbers detect bit flips early and trigger automatic erasure-code repairs."
    ],
    "furtherReading": [
      {
        "title": "CERN Data Center: Silent Data Corruption in Large Scale Commodity Storage",
        "url": "https://indico.cern.ch/event/13797/contributions/1362288/attachments/115080/163419/chep07-silente-corruption.pdf"
      },
      {
        "title": "Schroeder & Gibson: Disk Failures in the Real World: What Does an MTTF of 1,000,000 Hours Mean to You? (USENIX FAST, 2007)",
        "url": "https://www.usenix.org/conference/fast-07/disk-failures-real-world-what-does-mttf-1000000-hours-mean-you"
      },
      {
        "title": "Bairavasundaram et al.: An Analysis of Data Corruption in the Storage Stack (USENIX FAST, 2008)",
        "url": "https://www.usenix.org/conference/fast-08/analysis-data-corruption-storage-stack"
      }
    ]
  }
};
