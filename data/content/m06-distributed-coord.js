window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-distributed-coordination"] = {
  "distributed-systems-foundations": {
    "title": "Distributed systems foundations",
    "video": {
      "youtubeId": "y8f7ZG_UnGI",
      "title": "Distributed Systems 2.3: System models",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's Cambridge lecture on system models covers exactly this lesson: reliable versus fair-loss links, crash-stop, crash-recovery and Byzantine nodes, and synchronous, partially synchronous and asynchronous timing.",
      "length": "20:45"
    },
    "videos": [
      {
        "youtubeId": "UEAMfLPZZhE",
        "title": "Distributed Systems 1.1: Introduction",
        "channel": "Martin Kleppmann",
        "role": "intro",
        "why": "The opening Cambridge lecture: why distribute at all, and what makes it hard. A gentle, precise start.",
        "length": "14:36"
      },
      {
        "youtubeId": "cQP8WApzIQQ",
        "title": "Lecture 1: Introduction",
        "channel": "MIT 6.824: Distributed Systems",
        "role": "deep-dive",
        "why": "MIT 6.824 Lecture 1 (Robert Morris) sets up fault tolerance, consistency and performance as the core tensions, with MapReduce as a worked example.",
        "length": "1:19:35"
      }
    ],
    "intuition": "<p>You text a friend \"are you coming?\" and hear nothing back. Maybe your message never arrived, maybe they replied and the reply got lost, maybe their phone is dead, or maybe they are just slow. From your side all four look identical. That is the defining problem of distributed systems: silence carries no information.</p><p><strong>Mental model:</strong> a distributed system is a set of computers that can only learn about each other through messages that may be delayed, lost, duplicated or reordered, running on machines that may pause or crash at any moment.</p><ul><li><strong>Treating a timeout as proof of failure.</strong> A timeout means \"I don't know.\" The remote node may have done the work, so retries must be idempotent.</li><li><strong>Ignoring process pauses.</strong> A 10-second GC pause or VM migration makes a healthy node look dead, and when it wakes up it still believes it is the leader.</li><li><strong>Assuming Byzantine tolerance is needed internally.</strong> Inside one organisation, crash-recovery plus checksums and authentication is the usual model. BFT is for mutually distrusting parties.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Reality of Distributed Physics: Why Networks Fail</h2>\n      <p>A distributed system is a collection of autonomous computing nodes that communicate over a network, coordinating actions by passing messages. In single-machine systems, memory reads and function calls are deterministic, microsecond operations. In distributed systems, computing across physical space introduces the <strong>8 Fallacies of Distributed Computing</strong> (the first seven listed by Peter Deutsch at Sun in 1994; the eighth, \"the network is homogeneous\", added by James Gosling around 1997):</p>\n      <ul>\n        <li>The network is reliable.</li>\n        <li>Latency is zero.</li>\n        <li>Bandwidth is infinite.</li>\n        <li>The network is secure.</li>\n        <li>Topology doesn't change.</li>\n        <li>There is one administrator.</li>\n        <li>Transport cost is zero.</li>\n        <li>The network is homogeneous.</li>\n      </ul>\n\n      <h2>Failure Models in Distributed Infrastructure</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    NodeA[\"Node A (Sender)\"] -->|\"1. Network Packet (SYN/DATA)\"| Net{\"Physical Network Layer: Routers / Fiber\"}\n    Net -->|\"Asymmetric Partition / Packet Drop\"| BlackHole[(\"Black Hole / Delay\")]\n    Net -->|\"Delivered After 5,000ms\"| NodeB[\"Node B (Receiver)\"]\n    \n    NodeA -->|\"Timeout Reached\"| Question{\"What Happened to the Request?\"}\n    Question --> F1[\"Case 1: Request crashed before processing\"]\n    Question --> F2[\"Case 2: Request processed, but ACK dropped on return\"]\n    Question --> F3[\"Case 3: Node B is paused in Garbage Collection (STW)\"]\n      </div>\n\n      <h2>The Three Distributed Failure Modes</h2>\n      <h3>1. Crash-Stop (Fail-Stop)</h3>\n      <p>A node halts operations abruptly (e.g., kernel panic, power loss, OOM kill). Once stopped, it never transmits another packet. This is the simplest failure model to design for, as dead nodes remain silent.</p>\n\n      <h3>2. Crash-Recovery</h3>\n      <p>A node crashes, restarts after several seconds or minutes, reads its persistent write-ahead log (WAL) from disk, and rejoins the cluster with state that lags behind the current state. Algorithms must handle stale reads and catch-up log streams.</p>\n\n      <h3>3. Byzantine Faults (Arbitrary / Malicious)</h3>\n      <p>Nodes transmit corrupted messages, lie about state, or act maliciously. Solved via Byzantine Fault Tolerant (BFT) consensus (e.g., PBFT, Tendermint, HotStuff; Proof-of-Stake chains pair stake-based Sybil resistance with protocols like these). In private datacenter environments, engineers assume non-Byzantine failure models (Crash-Recovery) to avoid BFT's O(N<sup>2</sup>) message complexity.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why a timeout cannot tell you what happened</h2><p>Service A calls B to charge a card, with a 1-second timeout. Measured p99 latency is 300 ms, but during GC pauses B sometimes takes 4 seconds. A times out and retries.</p><ul><li><strong>Case 1:</strong> the request was lost. Retrying is correct.</li><li><strong>Case 2:</strong> B charged the card and the response was lost. Retrying double-charges.</li><li><strong>Case 3:</strong> B is mid-GC and will process both the original and the retry.</li></ul><p>The only safe design is an <strong>idempotency key</strong>. A sends <code>charge_id=abc</code>, and B stores it with the result in the same transaction, so the retry returns the stored result.</p><h2>Timing models</h2><table><thead><tr><th>Model</th><th>Assumption</th><th>What is possible</th><th>Reality check</th></tr></thead><tbody><tr><td>Synchronous</td><td>Known upper bounds on message delay and processing time</td><td>Perfect failure detection by timeout</td><td>Not true of real networks or GC runtimes</td></tr><tr><td>Partially synchronous</td><td>Bounds hold eventually, after some unknown time</td><td>Consensus (Raft, Paxos) with safety always and liveness once stable</td><td>The practical model for datacentres</td></tr><tr><td>Asynchronous</td><td>No timing bounds at all</td><td>No deterministic consensus (FLP, 1985)</td><td>A useful worst case for proving safety</td></tr></tbody></table><h2>Node failure models</h2><table><thead><tr><th>Model</th><th>Behaviour</th><th>Typical defence</th></tr></thead><tbody><tr><td>Crash-stop</td><td>Halts and never returns</td><td>Replication plus failover</td></tr><tr><td>Crash-recovery</td><td>Halts, restarts, may lose in-memory state</td><td>Durable logs (fsync), rejoin and catch up</td></tr><tr><td>Omission</td><td>Drops some messages</td><td>Retries with idempotency</td></tr><tr><td>Byzantine</td><td>Arbitrary or malicious behaviour</td><td>BFT protocols with 3f+1 nodes to tolerate f faults, plus signatures</td></tr></tbody></table><h2>Real-world evidence</h2><ul><li>Bailis and Kingsbury's survey \"The Network is Reliable\" documents real partitions at Google, Microsoft, Amazon and others, including partial and asymmetric ones.</li><li>Jepsen tests have repeatedly found data loss in databases whose designs assumed clocks or networks behave well.</li><li>Google's Chubby and Spanner papers both treat long process pauses and clock uncertainty as normal operating conditions.</li></ul><h2>Design checklist</h2><ul><li>Every remote call has a timeout, and every retried operation is idempotent.</li><li>Every piece of state has exactly one owner, or an explicit conflict-resolution rule.</li><li>Failure detection is treated as a suspicion, never a certainty. Anything that acts on a suspicion, such as failover, must fence the old owner.</li></ul>\n</div>",
    "keyTakeaways": [
      "Networks are inherently asynchronous and unreliable; timeouts do not distinguish between server death and dropped return packets.",
      "Distributed systems design for Crash-Recovery models where nodes restart and rejoin with stale logs.",
      "Byzantine fault tolerance is reserved for untrusted peer networks (blockchain); internal systems use crash-fault-tolerant Paxos/Raft, usually inside coordination services and databases (etcd, ZooKeeper, Consul, Spanner) rather than in each microservice."
    ],
    "furtherReading": [
      {
        "title": "Peter Deutsch: The Eight Fallacies of Distributed Computing",
        "url": "https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing"
      },
      {
        "title": "Nancy Lynch: Distributed Algorithms (MIT Press)",
        "url": "https://mitpress.mit.edu/9780262122009/distributed-algorithms/"
      }
    ]
  },
  "consistency-models": {
    "title": "Consistency models",
    "video": {
      "youtubeId": "noUNH3jDLC0",
      "title": "Distributed Systems 7.2: Linearizability",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann defines linearizability with real-time precedence and shows the classic stale-read counterexamples. It is precise and short.",
      "length": "18:44"
    },
    "videos": [
      {
        "youtubeId": "9uCP3qHNbWw",
        "title": "Distributed Systems 7.3: Eventual consistency",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "The follow-up Cambridge lecture on eventual and strong eventual consistency, and where each is enough.",
        "length": "14:59"
      },
      {
        "youtubeId": "m4q7VkgDWrM",
        "title": "Data Consistency and Tradeoffs in Distributed Systems",
        "channel": "Gaurav Sen",
        "role": "intro",
        "why": "Gaurav Sen gives an intuition-first tour of consistency trade-offs across replicas, useful before the formal definitions.",
        "length": "25:42"
      }
    ],
    "intuition": "<p>Imagine a shared scoreboard in a stadium with several screens. Under <em>linearizability</em>, once any screen shows a goal, no screen anywhere may show the older score, as if there were only one screen. Under <em>causal</em> consistency, anyone who saw the goal also sees the celebration that followed it, but unrelated updates can appear in different orders. Under <em>eventual</em> consistency, the screens all agree once the updates stop.</p><p><strong>Mental model:</strong> a consistency model is a contract about which histories of reads and writes clients are allowed to observe. Stronger contracts need more coordination.</p><ul><li><strong>Confusing ACID C with distributed C.</strong> ACID consistency means your invariants hold. Linearizability is about recency and ordering across replicas. They are unrelated.</li><li><strong>Calling serializable the same as linearizable.</strong> Serializability is about multi-object transactions in some order. Linearizability is about single objects in real-time order. Strict serializability is both.</li><li><strong>Forgetting session guarantees.</strong> Read-your-writes and monotonic reads fix most user-visible anomalies cheaply, without global strong consistency.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A user updates a profile, then reads through another replica while a friend reads concurrently.</p><h2>Mechanics</h2><p>Linearizability makes each operation appear atomic between invocation and response and respects real-time precedence for completed operations. Sequential consistency preserves one order consistent with each client program order but not real time. Causal and session guarantees constrain only related operations or one client view. Implementations may use a leader, quorum protocol, or another serialization mechanism.</p><h2>Failure mode</h2><p>Replica lag can violate read-your-writes; failover can move a client to an older view; concurrent updates can be observed in different orders under weaker models. A majority partition may continue while a minority rejects operations.</p><h2>Trade-off</h2><p>Stronger guarantees simplify application reasoning but add coordination latency and can reduce availability during faults. Weaker guarantees improve locality and fault tolerance only if the product can reconcile stale or concurrent results.</p>\n<!-- enriched -->\n<h2>Worked example: the profile-photo bug</h2><p>Alice changes her profile photo. The write goes to the leader in us-east, and replication to the eu-west replica lags by 800 ms. Alice refreshes 200 ms later and her request is routed to eu-west.</p><ul><li><strong>Eventual consistency:</strong> she sees her old photo and thinks the upload failed. Allowed, but a bad experience.</li><li><strong>Read-your-writes (a session guarantee):</strong> the client remembers the log position or timestamp of her write, and the replica waits until it has caught up to that point, or the request is sent to the leader. She sees the new photo, while other users may still see the old one for 800 ms, which nobody notices.</li><li><strong>Linearizability:</strong> every reader, including her friend Bob, is guaranteed the new photo once the write has been acknowledged. That requires every read to go through the leader or a quorum, adding a cross-region round trip of about 80 ms to every photo read.</li></ul><p>For profile photos, read-your-writes is the right choice. For \"is this username taken?\" you need linearizability, or a uniqueness constraint enforced in one place.</p><h2>The consistency ladder</h2><table><thead><tr><th>Model</th><th>Guarantee</th><th>Cost</th><th>Example systems</th></tr></thead><tbody><tr><td>Strict serializable</td><td>Transactions appear atomic in real-time order</td><td>Highest: consensus plus clock bounds</td><td>Spanner, FoundationDB, CockroachDB (with caveats)</td></tr><tr><td>Linearizable</td><td>Single-object reads see the latest completed write</td><td>A quorum or leader round trip per operation</td><td>etcd, ZooKeeper writes, DynamoDB strongly consistent reads</td></tr><tr><td>Sequential</td><td>One global order that respects each client's program order</td><td>High</td><td>ZooKeeper reads served locally without sync</td></tr><tr><td>Causal</td><td>Causally related operations are seen in order</td><td>Dependency metadata</td><td>MongoDB causal sessions, COPS research</td></tr><tr><td>Session guarantees</td><td>Read-your-writes, monotonic reads and writes</td><td>Sticky routing or tokens</td><td>Cosmos DB session level (the default)</td></tr><tr><td>Eventual</td><td>Replicas converge if writes stop</td><td>Lowest</td><td>DNS, Cassandra at consistency level ONE</td></tr></tbody></table><h2>Checking claims</h2><p>Jepsen analyses have repeatedly shown databases advertising a model and violating it under partitions or clock skew. When a design depends on a guarantee, test it with fault injection. Do not rely on the marketing page.</p>\n</div>",
    "keyTakeaways": [
      "Linearizability respects real-time precedence for completed operations.",
      "Session and causal guarantees constrain narrower observations.",
      "Stronger guarantees add coordination and can reduce fault availability."
    ],
    "furtherReading": [
      {
        "title": "Kyle Kingsbury: Jepsen Consistency Models Guide",
        "url": "https://jepsen.io/consistency"
      },
      {
        "title": "Herlihy & Wing: Linearizability: A Correctness Condition for Concurrent Objects",
        "url": "https://dl.acm.org/doi/10.1145/78969.78972"
      }
    ]
  },
  "replication": {
    "title": "Replication",
    "video": {
      "youtubeId": "mBUCF1WGI_I",
      "title": "Distributed Systems 5.1: Replication",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's replication lecture covers leader-based and leaderless replication, retries and idempotence, and why concurrent writes need version metadata. It is directly on topic.",
      "length": "25:21"
    },
    "videos": [
      {
        "youtubeId": "uNxl3BFcKSA",
        "title": "Distributed Systems 5.2: Quorums",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "A focused lecture on read and write quorums, the W + R > N rule, and read repair. It pairs with the lesson's quorum caveats.",
        "length": "9:37"
      },
      {
        "youtubeId": "bI8Ry6GhMSE",
        "title": "Database Replication Explained (in 5 Minutes)",
        "channel": "Aced (formerly Exponent)",
        "role": "intro",
        "why": "The current five-minute explainer, kept as a quick intuition primer on sync versus async and leader versus leaderless.",
        "length": "5:00"
      }
    ],
    "intuition": "<p>A restaurant keeps its reservation book in the manager's office, with photocopies at the front desk and the bar. If only the manager can write (single leader), the copies are simply a bit behind. If the desk and the bar can both take bookings (multi-leader), two people can grab the same table and someone has to sort it out. If you phone any three staff and trust the majority (leaderless quorum), you need rules for when they disagree.</p><p><strong>Mental model:</strong> replication keeps copies of the same data on several machines. The design choices are who accepts writes, how many copies must confirm before you say \"done\", and how conflicts are resolved.</p><ul><li><strong>Thinking synchronous means every replica.</strong> Postgres synchronous replication usually waits for one named standby, and quorum commit waits for a configured subset. It does not wait for all replicas.</li><li><strong>Assuming failover loses nothing.</strong> Promoting an async replica discards whatever it had not received. That is your recovery point.</li><li><strong>Relying on last-write-wins with wall clocks.</strong> A node with a fast clock silently overwrites newer data.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A primary acknowledges an order and fails while one replica is caught up, another lags, and a read-only region is partitioned.</p><h2>Mechanics</h2><p>Single-leader replication orders writes at a leader; multi-leader accepts writes in several domains and needs conflict handling; leaderless systems contact configurable replica sets. Synchronous modes wait for a defined set of durable acknowledgments—not necessarily every replica. Read and write quorums overlap only under the actual routing and failure assumptions.</p><h2>Failure mode</h2><p>Acknowledging one replica does not guarantee zero loss under correlated failure, nondurable acknowledgment, or promotion of a stale node. W + R > N alone is insufficient with sloppy quorums, concurrent writes, failed writes, or weak version resolution.</p><h2>Trade-off</h2><p>More acknowledgments improve durability and freshness but add latency and may reject writes during faults. Asynchronous replicas improve latency and read scale while exposing lag and recovery-point risk.</p>\n<!-- enriched -->\n<h2>Worked example: what failover actually loses</h2><p>A primary handles 5,000 writes per second, replicating asynchronously to two replicas. Replica A lags by 50 ms and replica B by 2 seconds, because it is in another region. The primary's disk dies.</p><ul><li>Promote A: about 5,000 x 0.05 = 250 acknowledged writes are lost.</li><li>Promote B: about 10,000 acknowledged writes are lost.</li><li>With semi-synchronous replication to A (the primary waits for A to acknowledge receipt before acknowledging the client), promoting A loses nothing that was acknowledged, but every commit pays the round trip to A, roughly 0.5 to 1 ms in the same region.</li></ul><p>Now add a network blip. If A is slow to acknowledge, MySQL semi-sync by default falls back to async after <code>rpl_semi_sync_master_timeout</code> (10 seconds). Your zero-loss guarantee quietly degrades exactly when you need it. That is why Raft-based systems require a majority acknowledgement with no fallback.</p><h2>Topologies compared</h2><table><thead><tr><th>Topology</th><th>Write availability</th><th>Conflicts</th><th>Read freshness</th><th>Examples</th></tr></thead><tbody><tr><td>Single leader, async</td><td>Leader only</td><td>None</td><td>Replicas lag</td><td>MySQL and Postgres defaults</td></tr><tr><td>Single leader, consensus</td><td>Needs a majority</td><td>None</td><td>Linearizable through the leader</td><td>etcd, CockroachDB ranges, Kafka KRaft metadata</td></tr><tr><td>Multi-leader</td><td>Every region</td><td>Must be resolved</td><td>Regional</td><td>BDR for Postgres, CouchDB, collaborative editors</td></tr><tr><td>Leaderless quorum</td><td>Any W nodes</td><td>Must be resolved (vector clocks, LWW, CRDTs)</td><td>Tunable through R and W</td><td>Cassandra, Riak, DynamoDB internals</td></tr></tbody></table><h2>Quorum arithmetic and its limits</h2><p>With N = 3, W = 2 and R = 2, every read quorum overlaps every write quorum in at least one node, so a read can see the latest acknowledged write. It still breaks when:</p><ul><li><strong>Sloppy quorums and hinted handoff</strong> accept writes on nodes outside the key's home set, so the overlap is lost.</li><li>A <strong>failed write</strong> that reached one node is not rolled back. Later reads may or may not see it.</li><li><strong>Concurrent writes</strong> resolved by timestamp can drop one write silently.</li></ul><h2>Failure modes</h2><ul><li><strong>Split brain:</strong> the old primary comes back and accepts writes. Fence it (STONITH, epoch numbers) before promoting a new one.</li><li><strong>Replication lag spikes</strong> from a long transaction or a schema migration. Alert on lag in seconds, not just bytes.</li></ul>\n</div>",
    "keyTakeaways": [
      "Synchronous replication waits for a defined durable set, not necessarily all replicas.",
      "One replica acknowledgment does not universally guarantee zero data loss.",
      "W + R > N requires routing, versioning, and failure assumptions to provide freshness."
    ],
    "furtherReading": [
      {
        "title": "PostgreSQL Documentation: Streaming Replication Internals",
        "url": "https://www.postgresql.org/docs/current/warm-standby.html"
      },
      {
        "title": "Apache Cassandra: Architecture and Data Replication",
        "url": "https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html"
      }
    ]
  },
  "cap-and-pacelc": {
    "title": "CAP and PACELC",
    "video": {
      "youtubeId": "VdrEq0cODu4",
      "title": "CAP Theorem in System Design Interviews",
      "channel": "Hello Interview",
      "why": "Hello Interview frames CAP the way this lesson does: as a per-feature choice about behaviour during a partition, with concrete examples of when to choose consistency and when to choose availability.",
      "length": "13:56"
    },
    "videos": [
      {
        "youtubeId": "BHqjEjzAicA",
        "title": "CAP Theorem Simplified",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "ByteByteGo's quick visual of the partition scenario. It is the previous primary, kept as a warm-up.",
        "length": "5:33"
      },
      {
        "youtubeId": "rVF0Oi_R84Q",
        "title": "PACELC Theorem | Beyond CAP Theorem | System Design Primer",
        "channel": "Tech Primers",
        "role": "deep-dive",
        "why": "Tech Primers explains PACELC's 'else latency versus consistency' half, which most CAP videos skip, with database examples.",
        "length": "10:09"
      }
    ],
    "intuition": "<p>Two bank branches lose their phone line to each other. A customer walks into branch A and asks to withdraw money. Branch A can refuse until the line is back, because it cannot be sure branch B has not already paid out (consistency). Or it can pay and reconcile later (availability). There is no third option while the line is down. PACELC adds that even on a normal day, phoning the other branch before every withdrawal makes customers wait.</p><p><strong>Mental model:</strong> CAP applies only while a partition lasts: refuse some requests, or accept divergence. PACELC says that the rest of the time you trade latency against consistency.</p><ul><li><strong>\"Pick two of three.\"</strong> Partitions are not optional in a distributed system, so the real choice is C or A while partitioned.</li><li><strong>Labelling whole databases.</strong> Cassandra at QUORUM behaves differently from Cassandra at ONE. Classify operations and configurations, not products.</li><li><strong>Confusing CAP availability with uptime.</strong> CAP-available means every non-failed node answers, which is a much stronger requirement than 99.99 percent uptime.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>Two replicas cannot communicate, and clients can still reach each side.</p><h2>Mechanics</h2><p>CAP asks what a replicated service does during a partition: preserve a single-copy consistency guarantee by rejecting some operations, or return a non-error response from every non-failing node and permit divergent results. Partition tolerance means the specification accounts for lost or delayed messages, not that every operation continues. PACELC additionally highlights latency-versus-consistency choices when communication is healthy.</p><h2>Failure mode</h2><p>Calling an entire database CP or AP hides operation, topology, and configuration. Cassandra and Dynamo-style services expose tunable behavior; MongoDB and Redis behavior depends on write concern, read routing, failover, and which partition the client reaches.</p><h2>Trade-off</h2><p>The product chooses behavior per operation: a payment ledger may reject uncertain writes, while a feed can serve stale data. Systems without independent replicas do not face the same distributed partition choice, though they have other availability risks.</p>\n<!-- enriched -->\n<h2>Worked example: one product, two choices</h2><p>An e-commerce site runs in two regions with a replicated database. The transatlantic link drops for 3 minutes.</p><ul><li><strong>Shopping cart (choose A):</strong> both regions keep accepting \"add item\". When the link returns, merge the carts as a union, the way Amazon's Dynamo did for carts. A deleted item might reappear, which is an acceptable annoyance.</li><li><strong>Inventory decrement for the last unit (choose C):</strong> only the region that owns the item's primary can decrement. Users in the other region get \"try again shortly\" for 3 minutes. Overselling a limited edition is worse than a short error.</li><li><strong>Product descriptions (choose A, stale reads allowed):</strong> each region serves its local copy. Nobody cares about a 3-minute-old typo fix.</li></ul><p>On a normal day (the \"else\" branch of PACELC), linearizable inventory reads cost a cross-region round trip of about 70 to 90 ms. Local reads cost about 1 ms but may be up to about a second stale. Most systems pick latency for browsing and consistency only at checkout.</p><h2>PACELC classification (default configurations)</h2><table><thead><tr><th>System</th><th>During partition (P)</th><th>Else (E)</th><th>Notes</th></tr></thead><tbody><tr><td>DynamoDB, Cassandra, Riak</td><td>PA</td><td>EL</td><td>Tunable per request: QUORUM or strongly consistent reads shift towards C</td></tr><tr><td>Spanner, CockroachDB, etcd</td><td>PC</td><td>EC</td><td>Majority required. Latency paid on every write</td></tr><tr><td>MongoDB (majority write concern)</td><td>PC</td><td>EC or EL</td><td>Reads from secondaries are EL</td></tr><tr><td>PNUTS (Yahoo)</td><td>PC</td><td>EL</td><td>The per-record master example from Abadi's paper</td></tr></tbody></table><h2>Common interview traps</h2><ul><li>Claiming \"we are CA because we run in a single datacentre\". A rack switch failure is still a partition.</li><li>Forgetting that a CP system stays available on the majority side. Only the minority side rejects requests.</li><li>Mixing up CAP with ACID isolation levels. CAP says nothing about multi-key transactions.</li></ul><h2>What partitions look like in practice</h2><p>Real partitions are rarely a clean split. More often a single node loses connectivity to the leader but not to clients, a switch drops a fraction of packets, or one direction of a link fails. A CP system like etcd handles this by having the isolated node reject writes once it cannot reach a majority. An AP system like Cassandra keeps serving, stores hints for unreachable replicas, and relies on read repair and anti-entropy repair to converge afterwards.</p>\n</div>",
    "keyTakeaways": [
      "CAP describes consistency versus response availability during a partition.",
      "Partition tolerance defines behavior under message loss; it does not promise every operation continues.",
      "Classify operations and configurations, not whole products with one fixed label."
    ],
    "furtherReading": [
      {
        "title": "Daniel Abadi: Consistency Tradeoffs in Modern Distributed Database System Design (PACELC)",
        "url": "https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf"
      },
      {
        "title": "Gilbert and Lynch: Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services",
        "url": "https://users.ece.cmu.edu/~adrian/731-sp04/readings/GL-cap.pdf"
      }
    ]
  },
  "clocks-and-ordering": {
    "title": "Clocks and ordering",
    "video": {
      "youtubeId": "x-D8iFU1d-o",
      "title": "Distributed Systems 4.1: Logical time",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's lecture on Lamport and vector clocks is the clearest treatment of the one-way implication and concurrency detection the lesson emphasises.",
      "length": "24:02"
    },
    "videos": [
      {
        "youtubeId": "FQ_2N3AQu0M",
        "title": "Distributed Systems 3.1: Physical time",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "Physical time: quartz drift, NTP, leap seconds, and why monotonic and wall clocks differ. This covers the lesson's first half.",
        "length": "20:48"
      },
      {
        "youtubeId": "OKHIdpOAxto",
        "title": "Distributed Systems 3.3: Causality and happens-before",
        "channel": "Martin Kleppmann",
        "role": "deep-dive",
        "why": "Causality and happens-before, the conceptual foundation that logical clocks encode.",
        "length": "16:25"
      }
    ],
    "intuition": "<p>Two people in different cities each write \"9:00\" on a letter. That tells you nothing about which was written first, because their watches may disagree by minutes. But if Bob's letter says \"replying to Alice's letter\", you know Alice's came first whatever the watches said. Logical clocks capture the \"replying to\" relationship, not the watch reading.</p><p><strong>Mental model:</strong> wall clocks answer \"what time is it for humans?\", monotonic clocks answer \"how long did this take on this machine?\", and logical clocks answer \"could A have influenced B?\".</p><ul><li><strong>Measuring timeouts with wall-clock time.</strong> An NTP step can make elapsed time negative or huge. Use <code>clock_gettime(CLOCK_MONOTONIC)</code>, <code>System.nanoTime</code> or <code>time.monotonic</code>.</li><li><strong>Assuming a smaller Lamport timestamp means \"happened before\".</strong> The implication only runs one way. Concurrent events can have any timestamps.</li><li><strong>Relying on last-write-wins across machines.</strong> A clock skew of 100 ms means a later write can lose. Cassandra users hit this regularly.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>Node A sends a message to Node B, but B has an earlier wall-clock reading when it acts on the message.</p><h2>Mechanics</h2><p>Wall clocks represent calendar time and may be stepped or slewed by synchronization; monotonic clocks are local tools for elapsed durations but are not comparable across machines. Lamport clocks guarantee that causally prior events receive lower timestamps, but the reverse implication is false. Vector clocks can distinguish causal order from concurrency at metadata cost.</p><h2>Failure mode</h2><p>Last-write-wins using unsynchronized wall time can discard a causally later update. A timeout measured on a wall clock can be distorted by a clock adjustment, and vector metadata can grow with participants.</p><h2>Trade-off</h2><p>Physical time is useful for user timestamps and retention; logical time is useful for ordering. Hybrid logical clocks combine both but still require defined uncertainty, tie-breaking, and application conflict semantics.</p>\n<!-- enriched -->\n<h2>Worked example: Lamport versus vector clocks</h2><p>Three nodes, A, B and C, each start with a counter of 0.</p><ul><li>A performs a local event: Lamport A = 1. Vector A = [1,0,0].</li><li>A sends m1 to B: A = 2, and m1 carries 2 (vector [2,0,0]).</li><li>C performs a local event independently: C = 1, vector [0,0,1].</li><li>B receives m1: B = max(0,2)+1 = 3. Vector B = [2,1,0].</li><li>C sends m2 to B carrying 2 (vector [0,0,2]). B receives: B = max(3,2)+1 = 4. Vector B = [2,2,2].</li></ul><p>Compare A's send event (Lamport 2, vector [2,0,0]) with C's first event (Lamport 1, vector [0,0,1]). Lamport suggests C's event came first, but the vectors are incomparable (neither is less than or equal to the other in every component), so the events are really <strong>concurrent</strong>. Only vector clocks reveal that.</p><h2>Clock types</h2><table><thead><tr><th>Clock</th><th>Answers</th><th>Size</th><th>Detects concurrency</th><th>Used by</th></tr></thead><tbody><tr><td>Wall clock (NTP)</td><td>Calendar time, plus or minus a few ms (worse under load or skew)</td><td>8 bytes</td><td>No</td><td>Logs, TTLs, user-facing timestamps</td></tr><tr><td>Monotonic</td><td>Elapsed time on one host</td><td>8 bytes</td><td>Not applicable</td><td>Timeouts, latency metrics</td></tr><tr><td>Lamport</td><td>A total order consistent with causality</td><td>One integer</td><td>No</td><td>Log ordering, Raft terms (similar idea)</td></tr><tr><td>Vector / version vector</td><td>Exact causality</td><td>O(nodes)</td><td>Yes</td><td>Riak, Dynamo, CRDT libraries</td></tr><tr><td>Hybrid logical clock (HLC)</td><td>Causality plus closeness to physical time</td><td>Physical time plus a counter</td><td>No</td><td>CockroachDB, YugabyteDB, MongoDB cluster time</td></tr><tr><td>TrueTime</td><td>A bounded interval [earliest, latest]</td><td>Two timestamps</td><td>No, but supports external consistency</td><td>Google Spanner, which waits out the uncertainty, typically under 7 ms</td></tr></tbody></table><h2>How real systems order events</h2><ul><li><strong>Spanner</strong> uses GPS and atomic clocks to keep uncertainty small, and \"commit-waits\" until the timestamp is guaranteed to be in the past everywhere.</li><li><strong>CockroachDB</strong> uses HLC with a maximum offset (default 500 ms). A read that finds a value inside its uncertainty window restarts at a higher timestamp.</li><li><strong>Snowflake IDs</strong> (Twitter) combine milliseconds, a machine ID and a sequence number. They are roughly time-sortable, but they do not capture causality across machines.</li></ul>\n</div>",
    "keyTakeaways": [
      "Use monotonic clocks for local durations and wall clocks for calendar time.",
      "Lamport order preserves causality in one direction but cannot detect concurrency.",
      "Vector and hybrid clocks add metadata in exchange for stronger ordering information."
    ],
    "furtherReading": [
      {
        "title": "Kulkarni et al.: Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases",
        "url": "https://cse.buffalo.edu/tech-reports/2014-04.pdf"
      },
      {
        "title": "CockroachDB Architecture: Living Without Atomic Clocks",
        "url": "https://www.cockroachlabs.com/blog/living-without-atomic-clocks/"
      }
    ]
  },
  "consensus": {
    "title": "Consensus",
    "video": {
      "youtubeId": "rN6ma561tak",
      "title": "Distributed Systems 6.1: Consensus",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's consensus lecture explains what consensus guarantees, why FLP rules out a deterministic asynchronous solution, and how partial synchrony and leaders make it practical. It is the lesson's exact scope.",
      "length": "18:15"
    },
    "videos": [
      {
        "youtubeId": "s8JqcZtvnsM",
        "title": "Paxos Agreement - Computerphile",
        "channel": "Computerphile",
        "role": "intro",
        "why": "Computerphile's Paxos Agreement is an intuition-first walk through proposers, acceptors and majorities.",
        "length": "14:17"
      },
      {
        "youtubeId": "d7nAGI_NZPk",
        "title": "The Paxos Algorithm",
        "channel": "Google TechTalks",
        "role": "deep-dive",
        "why": "The previous primary, a Google TechTalk that walks Paxos phase by phase, kept as the detailed follow-up.",
        "length": "24:50"
      }
    ],
    "intuition": "<p>Five friends must agree on one restaurant by text message. Messages can be slow, and anyone can fall asleep mid-conversation. The rule that makes it work: a choice is final once a majority (three of five) have accepted it, because any two majorities share at least one person who will remember what was chosen. Ballot numbers stop an old, slow suggestion from overriding a newer agreement.</p><p><strong>Mental model:</strong> consensus is a way for a group to agree on a sequence of values so that a decision, once made, is never undone, even if a minority crashes or messages are delayed.</p><ul><li><strong>Thinking more nodes means more availability for writes.</strong> Five nodes tolerate two failures but every write needs three acknowledgements, and 4 nodes tolerate no more failures than 3.</li><li><strong>Believing consensus makes side effects exactly-once.</strong> It orders log entries. Sending an email from a deposed leader is still your problem.</li><li><strong>Deploying across only two sites.</strong> Losing the site holding the majority stops the whole cluster. Use three sites, or a tiebreaker.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>Three metadata nodes replicate a log; one crashes and messages between the remaining nodes are delayed.</p><h2>Mechanics</h2><p>Consensus protocols such as Raft and Paxos maintain safety through terms or ballots, quorum intersection, and durable log rules. Liveness requires assumptions stronger than a fully asynchronous network, commonly eventual synchrony plus fair scheduling; randomized election timeouts reduce repeated split votes but do not by themselves defeat FLP.</p><h2>Failure mode</h2><p>Without a majority, a safe cluster cannot commit new entries. A stale leader may still contact external systems, membership changes can break quorum assumptions if done incorrectly, and snapshots or log repair can prolong recovery.</p><h2>Trade-off</h2><p>Consensus is a foundation for replicated state, leader election, and coordination, not a complete solution for atomic external side effects or application invariants. It adds write latency and operational discipline in exchange for a durable agreed order.</p>\n<!-- enriched -->\n<h2>Worked example: quorum sizing and latency</h2><p>A Raft group replicates a metadata log. A commit needs acknowledgements from a majority, counting the leader.</p><table><thead><tr><th>Cluster size N</th><th>Majority</th><th>Failures tolerated</th><th>Write latency (leader in site 1)</th></tr></thead><tbody><tr><td>3 (one zone)</td><td>2</td><td>1</td><td>About 1 ms: one fast LAN round trip plus fsync</td></tr><tr><td>3 (three zones, same region)</td><td>2</td><td>1 (or one zone)</td><td>About 2 to 3 ms</td></tr><tr><td>5 (three regions: 2+2+1)</td><td>3</td><td>2 (or one region)</td><td>Round trip to the nearest other region, about 30 to 80 ms</td></tr><tr><td>4</td><td>3</td><td>1</td><td>Same fault tolerance as 3 but slower. Avoid even sizes</td></tr></tbody></table><p>Each commit also needs a durable fsync on each acknowledging node. On cloud SSDs that is typically 0.5 to 2 ms, which is why etcd's documentation stresses low-latency disks.</p><h2>What consensus guarantees</h2><ul><li><strong>Agreement:</strong> no two nodes decide different values for the same log slot.</li><li><strong>Validity:</strong> the decided value was proposed by someone.</li><li><strong>Termination:</strong> guaranteed only when the network is stable enough. FLP (1985) proves no deterministic protocol can guarantee it in a fully asynchronous system with even one crash.</li></ul><h2>Paxos, Raft and friends</h2><table><thead><tr><th>Protocol</th><th>Key idea</th><th>Where it runs</th></tr></thead><tbody><tr><td>Multi-Paxos</td><td>A stable leader skips phase 1 for successive slots</td><td>Chubby, Spanner (per split), many Google systems</td></tr><tr><td>Raft</td><td>A strong leader, term numbers, and a log-matching property. Designed for understandability</td><td>etcd, Consul, CockroachDB, TiKV, Kafka KRaft</td></tr><tr><td>Zab</td><td>Primary-backup atomic broadcast with epochs</td><td>ZooKeeper</td></tr><tr><td>Viewstamped Replication</td><td>View changes, predating Paxos's publication</td><td>Academic, and the basis for some storage systems</td></tr><tr><td>PBFT / HotStuff</td><td>Byzantine tolerance with 3f+1 nodes</td><td>Permissioned blockchains</td></tr></tbody></table><h2>Failure modes seen in production</h2><ul><li><strong>Disk stalls</strong> make the leader miss heartbeats, which triggers election churn.</li><li><strong>Membership changes</strong> done by editing config files on each node can create two disjoint majorities. Use joint consensus or single-server changes.</li><li><strong>Log growth</strong> without snapshots makes restarts replay millions of entries.</li></ul>\n</div>",
    "keyTakeaways": [
      "Consensus safety uses ballots or terms, durable state, and quorum intersection.",
      "Liveness depends on timing and scheduling assumptions stronger than full asynchrony.",
      "Consensus does not make external side effects or application invariants automatic."
    ],
    "furtherReading": [
      {
        "title": "Diego Ongaro & John Ousterhout: In Search of an Understandable Consensus Algorithm (Raft Paper)",
        "url": "https://raft.github.io/raft.pdf"
      },
      {
        "title": "Leslie Lamport: Paxos Made Simple",
        "url": "https://lamport.azurewebsites.net/pubs/paxos-simple.pdf"
      }
    ]
  },
  "leader-election": {
    "title": "Leader election",
    "video": {
      "youtubeId": "uXEYuDwm7e4",
      "title": "Distributed Systems 6.2: Raft",
      "channel": "Martin Kleppmann",
      "why": "Kleppmann's Raft lecture steps through terms, randomised election timeouts, vote requests and the up-to-date-log check, the precise mechanics this lesson relies on.",
      "length": "38:09"
    },
    "videos": [
      {
        "youtubeId": "ro2fU8_mr2w",
        "title": "\"Raft - The Understandable Distributed Protocol\" by Ben Johnson (2013)",
        "channel": "Strange Loop Conference",
        "role": "deep-dive",
        "why": "Ben Johnson's Strange Loop talk on Raft uses animated visualisation of elections and log replication, and is widely recommended.",
        "length": "36:33"
      },
      {
        "youtubeId": "IujMVjKvWP4",
        "title": "Understand RAFT without breaking your brain",
        "channel": "ankush",
        "role": "intro",
        "why": "The previous primary, a friendly under-9-minute Raft intuition primer, kept as an intro.",
        "length": "8:51"
      }
    ],
    "intuition": "<p>A group project needs one person to hold the pen. If nobody has heard from the pen-holder for a while, whoever's patience runs out first (a randomised timeout) asks the others \"vote for me for round 7?\". People vote once per round, and only for someone whose notes are at least as up to date as their own. Whoever gets a majority holds the pen for round 7, and anyone still claiming to be round 6's pen-holder is ignored.</p><p><strong>Mental model:</strong> leader election picks one node to coordinate, and term numbers make it possible to reject a stale leader.</p><ul><li><strong>\"There is only ever one leader.\"</strong> For a while two nodes can both believe they lead, the old one simply not having heard yet. Safety comes from followers rejecting the old term, not from the old leader stepping down.</li><li><strong>Tuning timeouts too low.</strong> An election timeout below GC pause or disk latency causes constant elections. etcd's defaults are a 100 ms heartbeat and a 1000 ms election timeout.</li><li><strong>Letting the leader act on external systems without fencing.</strong> A deposed leader may still send emails or write to S3.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A scheduler leader pauses for 20 seconds after its lease expires while a replacement begins running jobs.</p><h2>Mechanics</h2><p>Raft elects a leader by term and majority vote, with an up-to-date-log restriction that preserves committed entries. Election timeout ranges are deployment parameters, not universal constants. Leadership authorizes log coordination; external side effects still need idempotency or fencing accepted by the target.</p><h2>Failure mode</h2><p>Randomized timeouts reduce split votes but do not prevent every split-brain effect. A paused or partitioned old leader can continue local work, and clock-based leases can expire unnoticed by that process.</p><h2>Trade-off</h2><p>A leader simplifies ordering and ownership but creates failover pauses and a hotspot. Leaderless designs spread coordination differently but move conflict and quorum logic to each operation.</p>\n<!-- enriched -->\n<h2>Worked example: a Raft election timeline</h2><p>Five nodes, heartbeat 100 ms, election timeout randomised between 1000 and 2000 ms. The leader L (term 4) crashes at t = 0.</p><ul><li>t = 1,230 ms: follower B's timer fires first. B increments its term to 5, votes for itself, and sends RequestVote(term 5, lastLogIndex 812, lastLogTerm 4).</li><li>C, D and E have last index 812 or lower and have not voted in term 5, so they grant their votes. B has 4 of 5 votes, a majority, and becomes leader by about t = 1,235 ms.</li><li>B sends heartbeats immediately, which resets the others' timers before they fire. Total unavailability is about 1.2 seconds.</li></ul><p>Now suppose L was not dead but paused for 3 seconds. It wakes up still thinking it leads term 4 and sends AppendEntries. Every follower replies with \"term 5\", so L steps down. Any client write L accepted after waking cannot commit, because it can never reach a majority in term 4.</p><h2>Election approaches</h2><table><thead><tr><th>Approach</th><th>Safety basis</th><th>Failover time</th><th>Used by</th></tr></thead><tbody><tr><td>Raft or Zab internal election</td><td>Majority vote per term</td><td>About the election timeout</td><td>etcd, Consul, ZooKeeper</td></tr><tr><td>Lease in a consensus store</td><td>Store's linearizability plus lease TTL</td><td>Lease TTL, often 10 to 15 s</td><td>Kubernetes controllers (Lease objects), Patroni</td></tr><tr><td>ZooKeeper sequential ephemeral nodes</td><td>Lowest sequence number wins. Session expiry releases it</td><td>Session timeout</td><td>HBase, older Kafka controllers</td></tr><tr><td>Bully / ring algorithms</td><td>Highest ID wins. Assumes reliable failure detection</td><td>Varies</td><td>Textbooks. Unsafe under partitions</td></tr><tr><td>Database row lock or advisory lock</td><td>The database's locking</td><td>Connection timeout</td><td>Simple cron leaders</td></tr></tbody></table><h2>Failure modes</h2><ul><li><strong>Flapping leadership</strong> when timeouts sit near p99 network or disk latency. Raft's PreVote extension stops a partitioned node from disrupting the cluster with inflated terms when it rejoins.</li><li><strong>Leader in the wrong place:</strong> if the leader sits in a far region, every write pays the long round trip. Some systems support leader preferences or transfers.</li><li><strong>Clock-based leases on the leader</strong> (for fast local reads) are only safe with bounded clock drift. etcd and CockroachDB document this assumption.</li></ul>\n</div>",
    "keyTakeaways": [
      "Election timeouts are deployment parameters, not universal constants.",
      "A leader still needs fencing or idempotency for external effects.",
      "Randomization reduces split votes but does not alone prevent stale-owner work."
    ],
    "furtherReading": [
      {
        "title": "Ongaro & Ousterhout: In Search of an Understandable Consensus Algorithm (Raft paper)",
        "url": "https://raft.github.io/raft.pdf"
      },
      {
        "title": "Etcd Raft Module Implementation in Go",
        "url": "https://github.com/etcd-io/raft"
      }
    ]
  },
  "distributed-locks-and-leases": {
    "title": "Distributed locks and leases",
    "video": {
      "youtubeId": "Lp8oITg0MiI",
      "title": "21: Distributed Locking | Systems Design Interview Questions With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Jordan covers lock services, leases, the process-pause problem and fencing tokens, the full argument of this lesson, with interview framing.",
      "length": "28:13"
    },
    "videos": [
      {
        "youtubeId": "kX9Z0F-eTt4",
        "title": "Camille Fournier on The Chubby lock service for loosely-coupled distributed systems",
        "channel": "PapersWeLove",
        "role": "deep-dive",
        "why": "Camille Fournier (a ZooKeeper committer) presents the Chubby paper at Papers We Love: coarse-grained locks, leases, sequencers (Chubby's fencing tokens) and why Google built a lock service.",
        "length": "45:19"
      },
      {
        "youtubeId": "a-zatYN1Lx0",
        "title": "Distributed Lock using Zookeeper",
        "channel": "Better Dev with Anubhav",
        "role": "intro",
        "why": "A clear walkthrough of the ZooKeeper lock recipe with ephemeral sequential nodes and watches.",
        "length": "14:43"
      }
    ],
    "intuition": "<p>A hotel gives you a key card that works until noon: a lease. If you nap until 2pm and then stumble back to your room, the card should not open the door, because someone else checked in at 1pm. The front desk cannot stop you walking down the corridor, so the door lock itself has to check. A fencing token is the room door checking \"is this card newer than the last one I accepted?\".</p><p><strong>Mental model:</strong> a distributed lock is really a lease, ownership that expires. It is safe only if the protected resource can reject a holder whose lease has expired.</p><ul><li><strong>Checking the lease and then acting.</strong> A GC pause between \"am I still the holder?\" and the write breaks mutual exclusion. The check must happen at the resource.</li><li><strong>Locks without expiry.</strong> If the holder crashes, the lock is held forever. Every lock needs a TTL, and a TTL means a slow holder can lose it.</li><li><strong>Reaching for a lock first.</strong> A conditional update such as <code>UPDATE ... WHERE version = 7</code>, or a unique constraint, is often simpler and safer.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A worker pauses beyond its lease, then resumes after another worker has acquired the same lock.</p><h2>Mechanics</h2><p>A lease limits how long the coordinator recognizes ownership, but the old client cannot infer validity from its local clock. For external writes, use a monotonically increasing fencing token that the target rejects when stale, or an equivalent conditional write/version check enforced by the resource.</p><h2>Failure mode</h2><p>A lock service can expire ownership while paused code continues. If the target accepts both writers without fencing, mutual exclusion at the coordinator does not protect the data.</p><h2>Trade-off</h2><p>Fencing is powerful when the target can validate it, but it is not the only correctness design: transactions, compare-and-swap, idempotency, or single-owner logs may fit. Locks add availability and recovery dependencies.</p>\n<!-- enriched -->\n<h2>Worked example: the paused lock holder</h2><div class=\"mermaid\">sequenceDiagram\n  participant W1 as Worker1\n  participant L as LockService\n  participant W2 as Worker2\n  participant S as Storage\n  W1->>L: acquire lock, get token 33 with a 10s lease\n  Note over W1: GC pause of 15 seconds\n  L->>L: lease for token 33 expires\n  W2->>L: acquire lock, get token 34\n  W2->>S: write with token 34\n  S-->>W2: ok, highest token seen is now 34\n  W1->>S: write with token 33 after waking\n  S-->>W1: rejected because 33 is less than 34\n</div><p>Without the token check at storage, both writes succeed and W1 overwrites W2's newer data. Note that W1 did nothing wrong by its own reckoning: it cannot observe its own pause.</p><h2>Lease maths</h2><p>With a lease TTL T, a maximum clock drift rate d, and a holder that renews every T/3:</p><ul><li>The holder should stop working at about T x (1 - d) minus a safety margin, measured with a monotonic clock from when it <em>sent</em> the acquire request, not when it received the reply.</li><li>For T = 10 s the holder might stop at 8 s. But a 15-second pause makes any client-side check meaningless, which is why the check belongs at the resource.</li></ul><h2>Ways to get mutual exclusion</h2><table><thead><tr><th>Mechanism</th><th>Safe against pauses?</th><th>Needs resource support</th><th>Notes</th></tr></thead><tbody><tr><td>Lock plus fencing token</td><td>Yes</td><td>Yes: stores the maximum token and rejects lower ones</td><td>ZooKeeper zxid or etcd revision make good tokens</td></tr><tr><td>Compare-and-set or version column</td><td>Yes</td><td>Yes, but most databases already have it</td><td>Often removes the need for a lock</td></tr><tr><td>Database row lock (SELECT FOR UPDATE)</td><td>Yes, within a transaction</td><td>Same database only</td><td>Holds a connection</td></tr><tr><td>Single partition owner (Kafka consumer group)</td><td>Mostly, but zombies need fencing</td><td>Producer epochs fence zombies</td><td>Ownership via rebalance</td></tr><tr><td>Redis SET NX PX without a token check</td><td>No</td><td>No</td><td>Fine for efficiency and deduplication of work</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Chubby</strong> issues sequencers that servers can check. It also delays releasing a crashed holder's lock (the lock-delay, up to a minute) to reduce stale writes from services that ignore sequencers.</li><li><strong>Kubernetes</strong> leader election uses Lease objects with a resourceVersion compare-and-swap, a 15-second lease duration, and a 10-second renew deadline by default.</li><li><strong>HDFS</strong> NameNode HA uses fencing (SSH kill or shared-storage fencing) plus QJM epoch numbers so that an old active node cannot write to the edit log.</li></ul>\n</div>",
    "keyTakeaways": [
      "A paused client can continue after its lease expires.",
      "Targets can reject stale fencing tokens or enforce conditional versions.",
      "Transactions, idempotency, or single-owner logs may be better than locks."
    ],
    "furtherReading": [
      {
        "title": "Martin Kleppmann: How to Do Distributed Locking",
        "url": "https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html"
      },
      {
        "title": "Salvatore Sanfilippo (Antirez): Is Redlock Safe?",
        "url": "http://antirez.com/news/101"
      }
    ]
  },
  "redis-redlock-and-fencing-tokens": {
    "title": "Redis Redlock and fencing tokens",
    "video": {
      "youtubeId": "qY4MfWv01pI",
      "title": "How Distributed Lock works | ft Redis | System Design",
      "channel": "ByteMonk",
      "why": "ByteMonk builds a Redis lock step by step (SET NX PX, unique value, safe release), then Redlock's majority approach and its pitfalls. It matches this lesson's scope.",
      "length": "10:24"
    },
    "videos": [
      {
        "youtubeId": "1At8wV8fwp8",
        "title": "Google SWE teaches systems design | EP11: Fencing Tokens",
        "channel": "Jordan has no life",
        "role": "deep-dive",
        "why": "Jordan's focused explainer on fencing tokens: why a lease alone is unsafe, and how monotonically increasing tokens fix it.",
        "length": "8:06"
      },
      {
        "youtubeId": "Lp8oITg0MiI",
        "title": "21: Distributed Locking | Systems Design Interview Questions With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A longer interview-style treatment of Redlock versus consensus-backed locks, including the Kleppmann and antirez debate.",
        "length": "28:13"
      }
    ],
    "intuition": "<p>Five security guards each hold a copy of a sign-in sheet. Redlock says: sign in with at least three guards within a short window and you hold the room. It works well when watches are roughly right and nobody dozes off. But if you fall asleep holding the room, the guards cannot stop you walking in later. Only a door that checks ticket numbers can.</p><p><strong>Mental model:</strong> Redis locks are excellent for avoiding duplicate work. For correctness, the resource must reject stale holders, and Redlock alone cannot give you that.</p><ul><li><strong>Releasing with a plain DEL.</strong> If your lease expired and someone else took the lock, you delete their lock. Release with a compare-and-delete Lua script on your unique value.</li><li><strong>Treating a failover-replicated Redis as safe.</strong> A primary can acknowledge SET NX and then crash before replicating it, so the promoted replica grants the same lock again.</li><li><strong>Believing Redlock produces fencing tokens.</strong> Its random values are not monotonic. Use an etcd revision, a ZooKeeper zxid, or a database sequence.</li></ul>",
    "content": "<div class=\"lesson-content\"><h2>Concrete scenario</h2><p>A duplicate thumbnail is harmless wasted work, while two writers updating an account balance would violate correctness.</p><h2>Mechanics</h2><p>Redis locks use unique ownership tokens and atomic compare-and-delete release. Redlock seeks a majority of independent Redis instances within a validity window, but elapsed-time assumptions remain. For correctness-critical external writes, use a consensus-backed coordinator and ensure the downstream resource validates a fencing token or conditional version.</p><h2>Failure mode</h2><p>Etcd or ZooKeeper alone cannot stop a paused former owner from writing to an unrelated database. Redlock also cannot make an external resource reject stale clients unless that resource participates in the protocol.</p><h2>Trade-off</h2><p>A single Redis lock or Redlock may be adequate for efficiency work. Correctness-critical workflows usually favor durable serialization, conditional database updates, or fenced leases, accepting greater latency and operational cost.</p>\n<!-- enriched -->\n<h2>The single-instance Redis lock, done right</h2><pre><code>-- acquire: only if absent, auto-expire after 30s\nSET lock:invoice:42 9f1c-uuid NX PX 30000\n\n-- release: delete only if it is still ours\nif redis.call(\"GET\", KEYS[1]) == ARGV[1] then\n  return redis.call(\"DEL\", KEYS[1])\nelse\n  return 0\nend</code></pre><h2>Worked example: Redlock timing</h2><p>Five independent Redis masters, lease TTL 10,000 ms, clock drift allowance about 1 percent plus 2 ms.</p><ul><li>The client records its start time, then tries SET NX PX on each node with a short per-node timeout of about 50 ms.</li><li>It gets OK from 3 of 5 nodes, and elapsed time is 120 ms.</li><li>Validity = 10,000 - 120 - (0.01 x 10,000 + 2) = 9,778 ms. The lock is held if a majority was reached and validity is positive.</li><li>If fewer than 3 succeed, the client releases on all nodes and retries after a random delay.</li></ul><p>This still assumes no process pause longer than the remaining validity, and no clock jumps on the Redis nodes. Martin Kleppmann's 2016 critique showed that either assumption failing breaks mutual exclusion. Antirez replied that the assumptions are reasonable for many systems. Both agree that fencing requires the resource to participate.</p><h2>Choosing a lock</h2><table><thead><tr><th>Option</th><th>Mutual exclusion under failover</th><th>Fencing token available</th><th>Latency</th><th>Use for</th></tr></thead><tbody><tr><td>Single Redis, SET NX PX</td><td>No: lost if the primary fails before replication</td><td>No</td><td>Under 1 ms</td><td>Deduplicating cron runs, cache rebuilds</td></tr><tr><td>Redlock across 5 masters</td><td>Better, but depends on timing</td><td>No</td><td>A few ms</td><td>Efficiency where occasional double work is fine</td></tr><tr><td>etcd or ZooKeeper lock</td><td>Yes (linearizable)</td><td>Yes: revision or zxid</td><td>A few ms (consensus write)</td><td>Leader election, correctness with a fenced resource</td></tr><tr><td>Database row plus version column</td><td>Yes</td><td>The version itself</td><td>One DB transaction</td><td>Balance updates, inventory</td></tr></tbody></table><h2>Failure modes</h2><ul><li><strong>Node restart without persistence:</strong> a Redlock node that restarts empty can grant a lock that another client holds. The Redlock spec recommends delaying restarts for at least one maximum TTL, or using fsync-always AOF.</li><li><strong>Long work under a short TTL:</strong> renew the lease (a watchdog, as Redisson does) and abort if renewal fails.</li></ul>\n</div>",
    "keyTakeaways": [
      "Ownership tokens make lock release safe from deleting another client's lock.",
      "Redlock relies on independent nodes and elapsed-time assumptions.",
      "Correctness-critical external writes still need downstream fencing or conditional updates."
    ],
    "furtherReading": [
      {
        "title": "Redis Documentation: Distributed Locks with Redis (Redlock)",
        "url": "https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/"
      },
      {
        "title": "Martin Kleppmann: Critique of the Redlock Algorithm",
        "url": "https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html"
      }
    ]
  },
  "circuit-breakers-and-timeouts": {
    "title": "Circuit breakers and timeouts",
    "video": {
      "youtubeId": "ADHcBxEXvFA",
      "title": "Circuit Breaker Pattern - Fault Tolerant Microservices",
      "channel": "Defog Tech",
      "why": "Defog Tech explains why slow dependencies exhaust thread pools, and how the closed, open and half-open state machine fails fast. The current rate-limiter video is off-topic.",
      "length": "12:19"
    },
    "videos": [
      {
        "youtubeId": "0KHSr8Fzi5c",
        "title": "Patterns for building resilient software systems by Adrian Hornsby",
        "channel": "Devoxx",
        "role": "deep-dive",
        "why": "Adrian Hornsby (AWS) covers timeouts, retries with exponential backoff and jitter, circuit breakers and load shedding, with real incident stories.",
        "length": "53:34"
      },
      {
        "youtubeId": "HRS9mIfiNn4",
        "title": "Introduction to circuit breaker in microservices (for beginners)",
        "channel": "sudoCODE",
        "role": "intro",
        "why": "sudoCODE's beginner-friendly circuit breaker walkthrough with simple diagrams.",
        "length": "11:37"
      }
    ],
    "intuition": "<p>Your house has a fuse box. When a faulty kettle starts drawing too much current, the breaker trips so the wiring does not catch fire. Every other appliance loses nothing, and the kettle simply stops working until someone checks it and flips the switch back. A software circuit breaker does the same for a failing dependency: stop calling it, fail fast, and test it again cautiously later.</p><p><strong>Mental model:</strong> timeouts bound how long one call can hurt you, retries recover from blips, and circuit breakers stop you hammering something that is already down.</p><ul><li><strong>Retrying at every layer.</strong> Three layers with three retries each turn one failing call into 27 downstream calls. Retry at one layer, and use a retry budget.</li><li><strong>Setting timeouts larger than the caller's deadline.</strong> A 30-second DB timeout behind a 2-second HTTP deadline means the work continues after nobody is waiting. Propagate deadlines.</li><li><strong>Backoff without jitter.</strong> All clients retry at 100, 200 and 400 ms in lockstep. Full jitter spreads the retries.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Cascading Failures: How a Slow Downstream Kills the Fleet</h2>\n      <p>In a microservices mesh, a single degraded downstream dependency (e.g., a recommendation engine with latency spiking from 20ms to 5,000ms) is far more dangerous than a completely dead dependency. When a service stalls, upstream callers keep connections and worker threads open while waiting for response timeouts.</p>\n      <p>Within seconds, thread pools exhaust across the API gateway and web tiers, causing total application blackout: a <strong>cascading collapse</strong>.</p>\n\n      <h2>Circuit Breaker State Machine Under the Hood</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Closed[\"CLOSED State: Normal Traffic Flow\"] -->|\"Failure rate exceeds threshold (e.g. > 50% over 10s)\"| Open[\"OPEN State: Fail-Fast immediately without calling downstream\"]\n    Open -->|\"Sleep Window Expires (e.g. after 15s)\"| HalfOpen[\"HALF-OPEN State: Probe downstream with trial requests\"]\n    HalfOpen -->|\"Probe Succeeds\"| Closed\n    HalfOpen -->|\"Probe Fails\"| Open\n      </div>\n\n      <h2>Detailed Circuit Breaker Mechanics</h2>\n      <h3>1. Closed State</h3>\n      <p>All traffic flows through to the downstream service. The circuit breaker monitors responses in a sliding ring-buffer window (e.g., the last 100 requests). If the percentage of slow calls (latency > threshold) or HTTP 5xx errors exceeds the error rate threshold (typically 50%), the breaker trips to <strong>Open</strong>.</p>\n\n      <h3>2. Open State (Fail-Fast)</h3>\n      <p>The breaker immediately short-circuits all incoming calls without sending network packets downstream. Requests instantly execute fallback logic (serving cached data or returning <code>HTTP 503</code>). This grants the struggling downstream service time to recover its database connection pools.</p>\n\n      <h3>3. Half-Open State</h3>\n      <p>After a configured sleep window (e.g., 15 seconds), the breaker transitions to Half-Open. It permits a small number of trial requests (e.g., 5 probe requests). How the trial results are judged depends on the implementation: some breakers reopen on the first failed probe, while Resilience4j applies the failure-rate (and slow-call-rate) threshold to the permitted half-open calls, closing if the rate is below the threshold and reopening for another sleep interval otherwise.</p>\n\n      <h2>Exponential Backoff with Full Jitter Formula</h2>\n      <p>When clients retry failed requests simultaneously, they synchronize into devastating periodic retry waves (resonance). Clients must apply <strong>Exponential Backoff with Full Jitter</strong>:</p>\n      <pre><code>// Exponential Backoff with Full Jitter (AWS Recommended)\nfunction getBackoffTime(attempt, base = 100, cap = 10000) {\n  const temp = Math.min(cap, base * (2 ** attempt));\n  return Math.random() * temp; // Uniform random between 0 and temp\n}\n      </code></pre>\n    \n<!-- enriched -->\n<h2>Worked example: why slow is worse than dead</h2><p>An API tier has 200 worker threads per instance and handles 1,000 rps per instance. Each request calls a recommendations service, normally in 20 ms.</p><ul><li><strong>Recommendations dead</strong> (connection refused in 1 ms): threads are freed instantly. The API returns errors or fallbacks, but stays responsive.</li><li><strong>Recommendations slow</strong> (5 s responses, 10 s timeout): by Little's law, concurrent in-flight requests are 1,000 x 5 = 5,000, but only 200 threads exist. The pool is exhausted in 0.2 seconds, and <em>every</em> endpoint on the instance stalls, including ones that never call recommendations.</li><li><strong>With a 150 ms timeout and a breaker:</strong> at most 1,000 x 0.15 = 150 threads are tied up. Once the failure rate crosses 50 percent over a 10-second window, the breaker opens and calls return the fallback in microseconds. Thread use drops to near zero.</li></ul><h2>Choosing timeouts</h2><ul><li>Set the timeout from the dependency's measured p99.9 plus a margin, not a round number. Revisit it when latency changes.</li><li>Use separate connect and read timeouts. Connect should be short, around 100 to 500 ms in a datacentre.</li><li>Propagate a deadline, for example gRPC deadlines, so downstream services stop work when the caller has given up.</li></ul><h2>Resilience patterns compared</h2><table><thead><tr><th>Pattern</th><th>Protects</th><th>Failure it handles</th><th>Risk if misused</th></tr></thead><tbody><tr><td>Timeout</td><td>The caller's threads</td><td>Slow dependency</td><td>Too short a timeout causes false failures</td></tr><tr><td>Retry with backoff and jitter</td><td>Success rate</td><td>Transient errors</td><td>Retry storms, and duplicates if not idempotent</td></tr><tr><td>Retry budget (for example, at most 10 percent extra)</td><td>The dependency</td><td>Retry amplification</td><td>Slightly lower success during blips</td></tr><tr><td>Circuit breaker</td><td>Both sides</td><td>Sustained failure</td><td>Flapping if thresholds are noisy</td></tr><tr><td>Bulkhead (separate pools)</td><td>Other features</td><td>One dependency hogging threads</td><td>Under-used capacity</td></tr><tr><td>Load shedding</td><td>The server itself</td><td>Overload</td><td>Must shed low-priority work first</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Netflix Hystrix</strong> (now in maintenance) popularised breakers plus bulkheads. <strong>Resilience4j</strong> is the common JVM successor, with count- or time-based sliding windows and a configurable number of half-open trial calls.</li><li><strong>Envoy and Istio</strong> implement breaking as connection and pending-request limits plus outlier detection, which ejects failing hosts, rather than the classic three-state machine.</li><li><strong>AWS SDKs</strong> use exponential backoff with jitter and a client-side retry token bucket (retry quota).</li><li><strong>Google SRE</strong> recommends client-side adaptive throttling: reject locally with probability based on the recent ratio of accepted requests to total requests.</li></ul>\n</div>",
    "keyTakeaways": [
      "Slow dependencies exhaust thread pools faster than dead dependencies, causing catastrophic cascading fleet failure.",
      "Circuit breakers fail fast in Open state, shielding downstream services from traffic while they recover.",
      "Exponential backoff must incorporate Full Jitter to eliminate synchronized retry traffic spikes."
    ],
    "furtherReading": [
      {
        "title": "Netflix Hystrix: Latency and Fault Tolerance Architecture",
        "url": "https://github.com/Netflix/Hystrix/wiki/How-it-Works"
      },
      {
        "title": "AWS Architecture Blog: Exponential Backoff And Jitter",
        "url": "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/"
      }
    ]
  },
  "gossip-protocol": {
    "title": "Gossip protocol",
    "video": {
      "youtubeId": "0bAJ4iNnf5M",
      "title": "SWIM - Protocol to Build a Cluster SWIM gossip protocol, its implementation, and improvements",
      "channel": "FOSDEM",
      "why": "A FOSDEM talk that builds the SWIM gossip protocol from first principles: random probing, indirect pings, suspicion, and piggybacked dissemination. It is a thorough, on-topic replacement for the 100-second Cassandra promo.",
      "length": "41:03"
    },
    "videos": [
      {
        "youtubeId": "8dz0riI13j8",
        "title": "Google SWE teaches systems design | EP18: Gossip Protocol",
        "channel": "Jordan has no life",
        "role": "intro",
        "why": "Jordan's quick intuition for gossip-based membership and epidemic spread.",
        "length": "4:54"
      },
      {
        "youtubeId": "u-a7rVJ6jZY",
        "title": "Making Gossip More Robust with Lifeguard",
        "channel": "HashiCorp, an IBM Company",
        "role": "case-study",
        "why": "HashiCorp explains Lifeguard, their production fix for false-positive failure detection in SWIM-based Serf and Consul. This is real-world failure-detector tuning.",
        "length": "38:56"
      }
    ],
    "intuition": "<p>Office gossip spreads without a newsletter. Each person, every few minutes, tells a couple of random colleagues what they have heard. Within a few rounds the whole building knows, even though nobody talked to everyone, and even if a few people are off sick. Gossip protocols spread cluster state the same way: membership, who looks dead, and schema versions.</p><p><strong>Mental model:</strong> each node periodically exchanges state with a few random peers. Information reaches everyone in about log N rounds, with no central coordinator and graceful behaviour when nodes fail.</p><ul><li><strong>Expecting instant or strongly consistent membership.</strong> Gossip converges eventually. Two nodes can briefly disagree about who is alive, so do not use it for leader election or locks.</li><li><strong>Declaring nodes dead on one missed heartbeat.</strong> A slow node under GC gets evicted, rebalanced and re-added, which is churn. Use suspicion states or phi-accrual thresholds.</li><li><strong>Ignoring bandwidth.</strong> Full-state exchange grows with cluster size. Large clusters send digests or deltas.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Decentralized Cluster Membership Without Central Coordination</h2>\n      <p>In large-scale distributed clusters consisting of thousands of nodes (such as Apache Cassandra, Amazon Dynamo, or Consul), maintaining cluster membership via a centralized leader (like ZooKeeper) creates a scalability bottleneck. <strong>Gossip Protocols (Epidemic Algorithms)</strong> enable decentralized peer-to-peer discovery and failure detection with O(log N) message dissemination efficiency.</p>\n\n      <h2>The Periodic Peer Exchange Flow</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    NodeA[\"Node A: Selects k random peers periodically (e.g., every 1s)\"] --> NodeB[\"Node B\"]\n    NodeA --> NodeC[\"Node C\"]\n    \n    NodeA &lt;-->|\"SYN / ACK / ACK2 State Exchange\"| NodeB\n    NodeB -->|\"Relays State in Next Gossip Round\"| NodeD[\"Node D\"]\n    NodeC -->|\"Relays State in Next Gossip Round\"| NodeE[\"Node E\"]\n      </div>\n\n      <h2>Under the Hood: Gossip Dissemination Patterns</h2>\n      <h3>1. Dissemination Types</h3>\n      <ul>\n        <li><strong>Anti-Entropy:</strong> Nodes compare their entire state trees (often using Merkle Trees) and synchronize missing deltas. Highly reliable, but involves higher network bandwidth.</li>\n        <li><strong>Rumor-Mongering (Dissemination):</strong> When a node detects an event (e.g., Node X is unresponsive), it broadcasts the rumor to k randomly chosen peers. Each peer forwards it to k other peers. Within O(log N) rounds, almost all nodes receive the update with high probability; exact coverage depends on fanout, message loss and when nodes stop forwarding the rumor.</li>\n      </ul>\n\n      <h3>2. The Accrual Failure Detector (Φ-Accrual)</h3>\n      <p>Traditional failure detectors use a binary heartbeat timeout: if no ping is received within 5s, the node is declared dead. In lossy cross-datacenter networks, temporary network hiccups cause false-positive node churn.</p>\n      <p>Cassandra implements the <strong>Φ-Accrual Failure Detector</strong> (Hayashibara et al.). It records a sliding window of historical heartbeat arrival intervals, The original paper models them with a normal distribution; Cassandra simplifies this and approximates inter-arrival times with an exponential distribution based on the mean interval. It outputs a continuous probability metric Φ:</p>\n      $Φ = -log<sub>10</sub>(P<sub>later</sub>(t - t<sub>last</sub>))$\n      <p>A larger Φ means the observed silence is less likely under the historical arrival model; it is a suspicion score, not a guaranteed false-positive probability. Applications choose their own risk threshold: a conservative storage coordinator can wait for Φ = 12, while a soft read cache can fail over at Φ = 4.</p>\n    \n<!-- enriched -->\n<h2>Worked example: how fast gossip spreads</h2><p>A 1,000-node cluster, gossip interval 1 second, fanout 3 (each informed node tells 3 random peers per round). Ignoring overlap, the informed count roughly quadruples each round (1, 4, 16, 64, 256, 1,024), so about 5 rounds reach nearly everyone. Overlap slows the tail, so in practice expect about 7 to 10 rounds, that is 7 to 10 seconds, for effectively all nodes. At 10,000 nodes it is only a few rounds more: that is the log N property.</p><p>Bandwidth: if each exchange carries a 2 KB digest, each node sends 3 x 2 KB = 6 KB per second, regardless of cluster size. Compare that with all-to-all heartbeating, where 1,000 nodes send 999 messages each per interval.</p><h2>SWIM-style failure detection</h2><div class=\"mermaid\">sequenceDiagram\n  participant A as NodeA\n  participant B as NodeB\n  participant C as NodeC\n  A->>B: ping\n  Note over A: no ack within timeout\n  A->>C: ping-req asking C to probe B\n  C->>B: ping\n  B-->>C: ack\n  C-->>A: ack relayed, so B is alive\n</div><p>Indirect probing distinguishes \"B is dead\" from \"the A-to-B path is bad\". If nobody gets an ack, B is marked <em>suspect</em>, and that state is gossiped. B can refute it by gossiping a higher incarnation number. Only after the suspicion timeout is B declared dead.</p><h2>Design choices</h2><table><thead><tr><th>Choice</th><th>Option A</th><th>Option B</th><th>Trade-off</th></tr></thead><tbody><tr><td>What to send</td><td>Full state (anti-entropy)</td><td>Only recent changes (rumour mongering)</td><td>Reliability versus bandwidth</td></tr><tr><td>Exchange style</td><td>Push</td><td>Push-pull</td><td>Push-pull converges faster in the tail</td></tr><tr><td>Failure detection</td><td>Fixed heartbeat timeout</td><td>Phi-accrual or SWIM suspicion</td><td>Simplicity versus fewer false positives</td></tr><tr><td>Reconciliation</td><td>Version or heartbeat counters</td><td>Merkle trees</td><td>Merkle trees suit large data sets (Cassandra repair)</td></tr></tbody></table><h2>Who uses it</h2><ul><li><strong>Cassandra</strong>: a gossip round every second with up to three peers, a SYN, ACK and ACK2 exchange, and phi-accrual failure detection (<code>phi_convict_threshold</code> defaults to 8).</li><li><strong>Consul and Serf</strong> use memberlist (SWIM plus Lifeguard) for membership. Consul's servers still run Raft for the catalogue.</li><li><strong>Redis Cluster</strong> nodes gossip on the bus port (data port plus 10,000) to share slot maps and failure reports.</li><li><strong>Amazon S3</strong> had a 2008 outage in which a single corrupted bit in gossiped state spread across the system. Checksum gossip messages.</li></ul>\n</div>",
    "keyTakeaways": [
      "Gossip protocols provide decentralized O(log N) state dissemination across thousands of nodes without central servers.",
      "Rumor-mongering propagates state updates exponentially like an epidemic to k random peers per round.",
      "The Φ-Accrual failure detector calculates probabilistic suspicion curves instead of rigid binary timeouts."
    ],
    "furtherReading": [
      {
        "title": "Hayashibara, Défago, Yared, Katayama: The φ Accrual Failure Detector (SRDS 2004)",
        "url": "https://dspace.jaist.ac.jp/dspace/handle/10119/4784"
      },
      {
        "title": "Apache Cassandra: Gossip and Scuttlebutt Internals",
        "url": "https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html#gossip"
      }
    ]
  },
  "metadata-service-and-node-discovery": {
    "title": "Metadata service and node discovery",
    "video": {
      "youtubeId": "pbmyrNjzdDk",
      "title": "Lecture 8: Zookeeper",
      "channel": "MIT 6.824: Distributed Systems",
      "why": "MIT 6.824's ZooKeeper lecture (Robert Morris) explains the paper's API, ephemeral and sequential znodes, watches, and its consistency guarantees in depth. It is the canonical treatment of a coordination and metadata service.",
      "length": "1:20:32"
    },
    "videos": [
      {
        "youtubeId": "F06tdYgcz_A",
        "title": "What is ZooKeeper? - Coordination Services | Systems Design Interview 0 to 1 with Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "intro",
        "why": "Jordan's short intro to what coordination services such as ZooKeeper are for: config, membership, leader election.",
        "length": "7:32"
      },
      {
        "youtubeId": "DrtdrdwDpZE",
        "title": "Deep Dive: etcd - Jingyi Hu, Google",
        "channel": "CNCF [Cloud Native Computing Foundation]",
        "role": "deep-dive",
        "why": "A CNCF deep dive on etcd internals (Raft, MVCC revisions, leases, watches), the Kubernetes-era equivalent of ZooKeeper.",
        "length": "39:53"
      }
    ],
    "intuition": "<p>Think of an airport departures board. Airlines post and update their gates, and passengers watch the board instead of phoning every airline. If an airline goes bust (stops sending heartbeats), its entries vanish automatically. A metadata service is that board for a cluster: a small, strongly consistent store of who is alive, who leads, and which node owns which shard.</p><p><strong>Mental model:</strong> put a tiny amount of critical, rarely changing state in a consensus-backed store, attach it to sessions or leases so it self-cleans, and let clients subscribe to changes.</p><ul><li><strong>Using it as a general database.</strong> ZooKeeper and etcd are built for kilobytes per key and modest write rates (etcd's default request limit is 1.5 MB, with a few GB of total data). Bulk data belongs elsewhere.</li><li><strong>Assuming watches never miss events.</strong> Classic ZooKeeper watches are one-shot. Re-read state after each notification, and resume etcd watches from a revision.</li><li><strong>Hitting the service on every request.</strong> Clients should cache the topology and refresh on watch events, or the coordinator becomes the bottleneck.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Role of Distributed Coordination Systems</h2>\n      <p>Modern microservices and distributed storage systems (Kubernetes, HBase, Hadoop, and Kafka before KRaft) require a centralized, strongly consistent brain to manage cluster topology, service IP discovery, active leader registration, and feature flags. This is the domain of <strong>Distributed Consensus Key-Value Stores</strong>: Apache ZooKeeper, CoreOS Etcd, and HashiCorp Consul.</p>\n\n      <h2>Hierarchical Node Trees & Ephemeral Sessions</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Root[\"/ (Root Namespace)\"] --> Services[\"/services\"]\n    Root --> Locks[\"/locks\"]\n    \n    Services --> Payment[\"/services/payment-service\"]\n    Payment --> P1[\"/services/payment/node_01 (Ephemeral: 10.0.1.5:8080)\"]\n    Payment --> P2[\"/services/payment/node_02 (Ephemeral: 10.0.1.6:8080)\"]\n    \n    Watcher[\"Client API Gateway: Long-Polling / Watcher on /services/payment\"] -.->|\"Push Event: Node_01 Disconnected\"| P1\n      </div>\n\n      <h2>Under the Hood: Key Architectural Primitives</h2>\n      <h3>1. Ephemeral Nodes & Heartbeat Leases</h3>\n      <p>When a payment service instance boots, it opens a session with ZooKeeper/Etcd and registers an <strong>Ephemeral Node</strong> at <code>/services/payment-service/node_01</code> with its IP and port. Ephemeral nodes exist only as long as the client's heartbeat session remains active. If the instance crashes, the session times out, and the cluster manager <strong>automatically deletes the ephemeral node</strong>.</p>\n\n      <h3>2. Event Watchers (Push Notifications)</h3>\n      <p>Clients avoid polling the metadata service. Instead, they register <strong>Watchers</strong> on parent nodes (e.g., <code>watch('/services/payment-service')</code>). Etcd uses HTTP/2 multiplexed streams, while ZooKeeper uses persistent TCP connections. When a child node is added or deleted, the server pushes an event to all subscribed gateways, which then update their routing tables. Classic ZooKeeper watches are one-shot triggers: the client must re-read the node and re-register the watch, so changes in between are seen only through that re-read. Persistent and recursive watches arrived in ZooKeeper 3.6. etcd watches are streams that can resume from a revision.</p>\n\n      <h3>3. Distributed Leader Election via Sequential Ephemeral Nodes</h3>\n      <p>Candidates create a sequential ephemeral node: <code>/election/leader_000000001</code>, <code>/election/leader_000000002</code>. Whichever candidate holds the lowest numerical suffix is the elected leader. Non-leaders watch the node immediately preceding them in sequence, eliminating the 'herd effect' where all nodes wake up on leader crash.</p>\n    \n<!-- enriched -->\n<h2>Worked example: service registration with an etcd lease</h2><ol><li>An instance of <code>payments</code> starts up and grants a lease with a 10-second TTL (lease ID 0x6b).</li><li>It writes <code>/services/payments/10.0.1.5:8080</code> attached to lease 0x6b.</li><li>It sends a KeepAlive every 3 seconds.</li><li>The gateway watches the prefix <code>/services/payments/</code> starting from revision 5,120, and receives a PUT event.</li><li>The instance is killed by the OOM killer. KeepAlives stop, and within about 10 seconds etcd revokes the lease and deletes the key.</li><li>The gateway receives the DELETE event at revision 5,187 and removes the instance from its pool.</li></ol><p>The worst-case detection time is the TTL. A shorter TTL detects failures faster but risks false expiry during GC pauses or network blips. Most deployments land between 5 and 30 seconds and also use active health checks at the load balancer.</p><h2>Discovery approaches</h2><table><thead><tr><th>Approach</th><th>Consistency</th><th>Failure detection</th><th>Examples</th></tr></thead><tbody><tr><td>Consensus KV with sessions or leases</td><td>Linearizable writes</td><td>Lease or session expiry</td><td>ZooKeeper, etcd, Consul catalogue</td></tr><tr><td>Gossip membership</td><td>Eventual</td><td>SWIM or phi-accrual</td><td>Cassandra, Serf, memberlist</td></tr><tr><td>DNS-based</td><td>Eventual, and cached by TTL</td><td>External health checks</td><td>Kubernetes Services, AWS Cloud Map</td></tr><tr><td>Self-preservation registry</td><td>AP by design</td><td>Heartbeats, but eviction pauses during mass loss</td><td>Netflix Eureka</td></tr><tr><td>Control plane pushes to proxies</td><td>Eventual (xDS)</td><td>Health checks plus outlier detection</td><td>Envoy with Istio, Consul Connect</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Kubernetes</strong> stores all cluster state in etcd. Controllers use list-then-watch from a resourceVersion, and the API server caches state so clients do not hammer etcd.</li><li><strong>Kafka</strong> kept broker registrations and controller election in ZooKeeper for a decade, then replaced it with KRaft (a Raft metadata quorum inside Kafka). ZooKeeper mode was removed in Kafka 4.0.</li><li><strong>HBase</strong> finds the meta table and the active master through ZooKeeper, and RegionServers register ephemeral znodes.</li></ul><h2>Failure modes</h2><ul><li><strong>Herd effect</strong> when thousands of clients watch one key. Use the sequential \"watch your predecessor\" recipe, or a caching layer.</li><li><strong>Session expiry storms</strong> after a coordinator pause: many ephemeral nodes vanish at once and trigger mass rebalancing.</li><li><strong>An etcd database that fills its quota</strong> (2 GB by default) raises a NOSPACE alarm and the cluster becomes read-only until you compact and defragment it.</li></ul>\n</div>",
    "keyTakeaways": [
      "Distributed metadata stores (Etcd, ZooKeeper) provide strongly consistent consensus-backed coordination.",
      "Ephemeral nodes automatically unregister crashed instances when client heartbeat sessions expire.",
      "Event watchers use HTTP/2 streaming or persistent TCP to push topology updates instantly to API gateways."
    ],
    "furtherReading": [
      {
        "title": "etcd Documentation: Data model (MVCC key space and storage)",
        "url": "https://etcd.io/docs/v3.5/learning/data_model/"
      },
      {
        "title": "Hunt et al.: ZooKeeper: Wait-free coordination for Internet-scale systems (USENIX 2010)",
        "url": "https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf"
      }
    ]
  },
  "distributed-hash-tables": {
    "title": "Distributed hash tables",
    "video": {
      "youtubeId": "1QdKhNpsj8M",
      "title": "Kademlia, Explained",
      "channel": "number 0",
      "why": "'Kademlia, Explained' is a carefully animated walk-through of the XOR metric, k-buckets and iterative lookups, and is widely recommended as the clearest Kademlia explanation on YouTube.",
      "length": "24:22"
    },
    "videos": [
      {
        "youtubeId": "_kCHOpINA5g",
        "title": "Kademlia - a Distributed Hash Table implementation | Paper Dissection and Deep-dive",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Arpit Bhayani dissects the Kademlia paper: routing-table structure, node lookup, churn handling and why XOR works.",
        "length": "45:26"
      },
      {
        "youtubeId": "1wTucsUm64s",
        "title": "Distributed Hash Tables: In a nutshell (Reupload)",
        "channel": "Recessive",
        "role": "intro",
        "why": "A three-minute primer on what a DHT is and why peer-to-peer systems need one.",
        "length": "3:39"
      }
    ],
    "intuition": "<p>Imagine finding someone in a huge city with no phone book. You ask a neighbour who knows someone in the right district. That person knows someone on the right street, who knows the right building. Each hop at least halves the remaining \"distance\", so even among millions of people you arrive in a couple of dozen hops, and nobody had to know everyone. A DHT routes lookups for keys this way across peers that constantly join and leave.</p><p><strong>Mental model:</strong> nodes and keys share one ID space. Each key is stored on the nodes whose IDs are closest to it, and each node knows many near neighbours and a few distant ones, which is enough to route in O(log N) hops.</p><ul><li><strong>Confusing a DHT with consistent hashing in a datacentre.</strong> Dynamo and Cassandra give every node the full ring, a one-hop lookup. DHTs such as Kademlia and Chord suit huge, untrusted, churning peer sets.</li><li><strong>Assuming lookups are guaranteed.</strong> Under churn, stored values must be republished periodically, and Kademlia republishes hourly.</li><li><strong>Ignoring Sybil and eclipse attacks.</strong> In open networks an attacker can generate IDs near a target key. S/Kademlia and IP-diversity limits help.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Decentralized Key-Value Routing Across Millions of Nodes</h2>\n      <p>A <strong>Distributed Hash Table (DHT)</strong> is a decentralized distributed system that provides a lookup service similar to a hash table: key-value pairs are stored in the DHT, and any participating node can efficiently retrieve the value associated with a given key. Unlike client-side consistent hashing (where a client knows all servers), DHTs scale to <strong>millions of uncoordinated, churning peer nodes</strong> (used in BitTorrent Mainline DHT, IPFS, and Ethereum).</p>\n\n      <h2>Kademlia: The XOR Metric Space</h2>\n      <p>The gold standard of DHTs is <strong>Kademlia</strong> (Maymounkov & Mazières, 2002). Kademlia defines distance between two 160-bit keys x and y as their <strong>bitwise Exclusive OR (XOR)</strong>:</p>\n      <code>d(x, y) = x ⊕ y</code>\n      <p>The XOR metric is unidirectional, symmetric (d(x, y) = d(y, x)), and satisfies the triangle inequality (d(x, z) ≤ d(x, y) + d(y, z), with ordinary addition; with XOR in place of + it is the identity d(x, y) ⊕ d(y, z) = d(x, z)).</p>\n\n      <h2>K-Bucket Routing Tree Under the Hood</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Lookup[\"Find Key: 10100110... (Target Key)\"] --> Hop1[\"Query closest known node in k-bucket (Distance: 2^159)\"]\n    Hop1 --> Hop2[\"Next Node returns k closest peers in its routing table (Distance: 2^158)\"]\n    Hop2 --> Hop3[\"Each hop is expected to halve the remaining XOR distance\"]\n    Hop3 --> FinalNode[\"Final Destination Node holding key reached in O(log N) hops!\"]\n      </div>\n\n      <h2>Routing Efficiency: O(log N) Lookups via k-Buckets</h2>\n      <ul>\n        <li><strong>Routing Tables (k-Buckets):</strong> Each node maintains a list of routing contacts partitioned by distance. For each 0 ≤ i &lt; 160, a node keeps a list of k contacts (typically k=20) at distance between 2<sup>i</sup> and 2<sup>i+1</sup>.</li>\n        <li><strong>Lookup Routing:</strong> A lookup iteratively queries α nodes in parallel (concurrency parameter α=3). Each hop is expected to at least halve the remaining XOR distance to the target key. Finding a key among 10,000,000 nodes takes about log<sub>2</sub>(10<sup>7</sup>) ≈ 23 to 24 hops with high probability, and usually fewer in practice.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: a Kademlia lookup with 4-bit IDs</h2><p>Node 0010 wants key 1101. XOR distance = 0010 XOR 1101 = 1111 (15), the maximum distance, so the key lies in the far half of the space.</p><ul><li>0010's k-bucket for \"first bit differs\" contains node 1011. Distance 1011 XOR 1101 = 0110 (6).</li><li>0010 asks 1011 for its closest nodes to 1101. 1011 returns 1100 (distance 0001 = 1) and 1110 (distance 0011 = 3).</li><li>0010 asks 1100, which has nothing closer. The k closest nodes, 1100 and 1110, are the ones to STORE or FIND_VALUE the key.</li></ul><p>Every hop fixed at least one more leading bit. With 160-bit IDs and N nodes, the expected hop count is about log2 N. For 10 million peers that is about 23 hops, and in practice fewer, because each bucket holds k = 20 contacts and queries run α = 3 in parallel.</p><h2>DHT designs compared</h2><table><thead><tr><th>DHT</th><th>Distance</th><th>Routing state</th><th>Lookup hops</th><th>Used by</th></tr></thead><tbody><tr><td>Chord</td><td>Clockwise ring distance</td><td>O(log N) finger table</td><td>O(log N)</td><td>Research, and the basis of many variants</td></tr><tr><td>Pastry / Tapestry</td><td>Prefix matching</td><td>O(log N) with a leaf set</td><td>O(log N)</td><td>Research, and Microsoft PAST</td></tr><tr><td>Kademlia</td><td>XOR</td><td>k-buckets, about 160 x k contacts at most</td><td>O(log N) with parallel queries</td><td>BitTorrent Mainline DHT, IPFS/libp2p, Ethereum discv4/v5</td></tr><tr><td>One-hop (Dynamo-style)</td><td>Ring position</td><td>Full membership</td><td>1</td><td>Cassandra, Riak, DynamoDB internals</td></tr></tbody></table><h2>Why XOR works well</h2><ul><li>It is symmetric, so a node learns useful contacts from the queries it receives.</li><li>It is unidirectional: for a given point and distance there is exactly one other point, so lookups for the same key converge along the same paths, which makes caching along the path effective.</li><li>k-buckets prefer long-lived contacts. Measurements show nodes that have been up longer are more likely to stay up, so the routing table resists churn and flooding attacks.</li></ul><h2>Failure modes</h2><ul><li><strong>Churn:</strong> BitTorrent peers often stay minutes to hours. Values need replication to k nodes and periodic republishing.</li><li><strong>NAT and firewalls:</strong> many peers cannot accept inbound connections, which pollutes routing tables. libp2p uses AutoNAT and relays.</li></ul>\n</div>",
    "keyTakeaways": [
      "Distributed Hash Tables scale decentralized key-value lookups to millions of nodes without central servers.",
      "Kademlia defines routing distance using bitwise XOR (d(x, y) = x ⊕ y), ensuring symmetric, unidirectional routing.",
      "Routing via k-buckets finds keys in O(log N) network hops with high probability, even in very large networks."
    ],
    "furtherReading": [
      {
        "title": "Petar Maymounkov and David Mazières: Kademlia: A Peer-to-peer Information System Based on the XOR Metric (2002)",
        "url": "https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia.pdf"
      },
      {
        "title": "Stoica et al.: Chord: A Scalable Peer-to-peer Lookup Service for Internet Applications (SIGCOMM 2001)",
        "url": "https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf"
      }
    ]
  }
};
