window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-async-streams"] = {
  "delegation-and-async-work": {
    "title": "Delegation and async work",
    "video": {
      "youtubeId": "1ISRd0bS714",
      "title": "Message Queues in System Design Interviews w/ Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Hello Interview explains when to move work off the request path: decoupling, buffering bursts, retries, dead-letter queues and back-pressure. It is a more complete and current treatment than the 2018 intro.",
      "length": "26:46"
    },
    "videos": [
      {
        "youtubeId": "oUJbuFMyBDk",
        "title": "What is a MESSAGE QUEUE and Where is it used?",
        "channel": "Gaurav Sen",
        "role": "intro",
        "why": "The previous primary, Gaurav Sen's pizza-shop analogy for asynchronous processing. It is still the best short intuition, so it stays as the intro.",
        "length": "9:59"
      },
      {
        "youtubeId": "r-nQsyguU1Y",
        "title": "14. Task queues and background jobs",
        "channel": "Sriniously",
        "role": "deep-dive",
        "why": "A backend-engineering lecture on task queues and background jobs: producers, brokers, workers, retries, idempotency and scheduling in practice.",
        "length": "55:47"
      }
    ],
    "intuition": "<p>At a busy restaurant the waiter does not stand in the kitchen until your meal is cooked. They write the order on a ticket, pin it on the rail, and go back to serve other tables. The cooks pull tickets when they are ready. The ticket rail is a queue: it lets the fast front of house keep going while the slower kitchen works at its own pace, and nothing is forgotten if a cook steps out.</p><p><strong>Mental model:</strong> do only what the user must wait for inside the request. Record everything else durably, answer quickly (often <code>202 Accepted</code>), and let workers finish it.</p><ul><li><strong>Enqueuing work before the DB commit, or after it without an outbox.</strong> A crash between the two steps loses or duplicates work. Use a transactional outbox.</li><li><strong>Assuming exactly-once delivery.</strong> Queues deliver at least once. Workers must be idempotent, keyed by job ID.</li><li><strong>Hiding failures.</strong> Async work can fail silently. Give the client a status endpoint or a callback, and alert on dead-letter queue growth.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Cost of Synchronous Blocking RPCs</h2>\n      <p>In a thread-per-request server, a synchronous downstream call can hold a worker while the dependency computes. Event-loop and asynchronous runtimes can overlap that wait without one operating-system thread per request, but the request still occupies connection, memory, deadline, and downstream capacity. This model suffers from fatal scaling bottlenecks:</p>\n      <ul>\n        <li><strong>Thread Memory & Context Switching:</strong> Each OS thread allocates 1MB to 8MB of virtual memory for its stack. Ten thousand concurrent blocked connections reserve gigabytes of virtual address space (resident memory is usually much smaller, because stack pages are committed only when touched) and add significant kernel context-switching overhead.</li>\n        <li><strong>Cascading Outages:</strong> If a downstream billing or notification service experiences a latency spike from 50ms to 5,000ms, upstream connection pools fill to capacity within seconds, exhausting web server worker threads and crashing unrelated endpoints.</li>\n        <li><strong>Temporal Coupling:</strong> Synchronous systems require the sender, the network, and the receiver to be online and available at the exact same millisecond.</li>\n      </ul>\n\n      <h2>Synchronous Blocking vs Asynchronous Delegation</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph SyncFlow [\"1. Synchronous Blocking (Fragile)\"]\n      Client1[\"User Client\"] -->|\"POST /order (Blocked)\"| API1[\"Order API\"]\n      API1 -->|\"Blocking RPC\"| Pay1[\"Payment Service\"]\n      Pay1 -->|\"Blocking RPC\"| Inv1[\"Inventory Service\"]\n      Inv1 -->|\"Slow DB Query (5s)\"| DB1[(\"DB\")]\n      Note1[\"Thread held hostage for 5 seconds. If Inv fails, Order fails.\"]\n    end\n\n    subgraph AsyncFlow [\"2. Asynchronous Delegation (Resilient)\"]\n      Client2[\"User Client\"] -->|\"POST /order\"| API2[\"Order API\"]\n      API2 -->|\"1. Persist Order & Enqueue Event\"| Queue[(\"Durable Message Broker\")]\n      API2 -->|\"2. HTTP 202 Accepted (5ms TTFB)\"| Client2\n      Queue -->|\"3. Pull when ready\"| Worker1[\"Worker: Payment\"]\n      Queue -->|\"3. Pull when ready\"| Worker2[\"Worker: Inventory\"]\n    end\n      </div>\n\n      <h2>Under the Hood: Kernel Event Multiplexing</h2>\n      <p>High-throughput asynchronous systems decouple I/O from thread allocation using kernel multiplexing primitives: <strong>Linux <code>epoll</code></strong>, <strong>BSD/macOS <code>kqueue</code></strong>, and modern <strong>Linux <code>io_uring</code></strong>. A single worker thread registers hundreds of thousands of non-blocking sockets with the kernel. The kernel notifies the application event loop only when bytes arrive on the socket, allowing a small number of event-loop threads to coordinate many connections. Capacity still depends on kernel socket buffers, application state, TLS, message rates, and per-connection limits; connection count alone is not a throughput result.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sign-up flow</h2><p>A sign-up request writes the user row (5 ms), then synchronously sends a welcome email through a provider (p50 300 ms, p99 4 s), resizes the avatar (800 ms) and notifies the CRM (200 ms, sometimes down). The user waits about 1.3 seconds normally and more than 5 seconds at p99, and a CRM outage breaks sign-up entirely.</p><p>Delegated version: in one transaction, insert the user plus three outbox rows (<code>send_welcome</code>, <code>resize_avatar</code>, <code>sync_crm</code>) and return <code>201</code> in about 10 ms. A relay publishes the outbox rows to a queue, and workers process each job with retries and backoff. A CRM outage now just grows one queue. Sign-up keeps working, and the jobs drain when the CRM recovers.</p><h2>Sync or async?</h2><table><thead><tr><th>Question</th><th>Keep synchronous</th><th>Delegate</th></tr></thead><tbody><tr><td>Does the user need the result to continue?</td><td>Yes: payment authorisation, login</td><td>No: emails, thumbnails, analytics</td></tr><tr><td>Latency of the work</td><td>Milliseconds</td><td>Seconds to hours</td></tr><tr><td>Downstream reliability</td><td>Highly available</td><td>Flaky or rate-limited third party</td></tr><tr><td>Traffic shape</td><td>Smooth</td><td>Bursty, where the queue absorbs peaks</td></tr><tr><td>Failure handling</td><td>The user can retry</td><td>The system retries and dead-letters</td></tr></tbody></table><h2>What you take on when you go async</h2><ul><li><strong>Idempotency:</strong> every job carries a stable ID, and workers record processed IDs, or make the effect naturally idempotent (upsert, set state).</li><li><strong>Visibility:</strong> job status (queued, running, succeeded, failed), oldest-message age, and DLQ size.</li><li><strong>Ordering:</strong> generally not guaranteed across workers. If \"update then delete\" order matters, partition by entity key.</li><li><strong>Poison messages:</strong> cap retries (for example, 5 attempts with exponential backoff), then send to the DLQ with the error attached.</li></ul><h2>How real systems do it</h2><ul><li><strong>Shopify</strong> runs huge volumes of background jobs (webhooks, emails, imports) on Redis-backed job queues with per-shop throttling.</li><li><strong>GitHub</strong> moved many web-request side effects into background jobs (Resque, and later Aqueduct), so request latency does not depend on third parties.</li><li><strong>AWS SQS</strong> uses visibility timeouts: a received message is hidden for N seconds and reappears if it is not deleted, which gives at-least-once delivery with automatic redelivery.</li></ul>\n</div>",
    "keyTakeaways": [
      "Synchronous blocking architectures suffer from thread exhaustion, cascading failures, and tight temporal coupling.",
      "Asynchronous delegation returns HTTP 202 Accepted immediately, buffering work in durable messaging queues.",
      "Kernel event multiplexing (epoll, io_uring) lets a small number of event-loop threads watch very large numbers (100,000+) of mostly idle connections, though connection count alone says nothing about throughput."
    ],
    "furtherReading": [
      {
        "title": "Martin Fowler: What do you mean by 'Event-Driven'?",
        "url": "https://martinfowler.com/articles/201701-event-driven.html"
      },
      {
        "title": "Chris Richardson: Pattern: Messaging (microservices.io)",
        "url": "https://microservices.io/patterns/communication-style/messaging.html"
      },
      {
        "title": "Microsoft Azure Architecture Center: Asynchronous Request-Reply Pattern",
        "url": "https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply"
      }
    ]
  },
  "task-queue-vs-event-stream": {
    "title": "Task queue vs event stream",
    "video": {
      "youtubeId": "1HOVtQ-_fcE",
      "title": "Kafka vs RabbitMQ",
      "channel": "Hello Interview",
      "why": "Hello Interview contrasts RabbitMQ's per-message acknowledgement and deletion with Kafka's retained, offset-based log, which is exactly the task-queue versus stream divide. The current video (also mislabelled as ByteByteGo) only covers queues.",
      "length": "10:56"
    },
    "videos": [
      {
        "youtubeId": "e_ldsz7xzmY",
        "title": "Stream, Event Bus or Queue? What's the Difference?",
        "channel": "James Eastham",
        "role": "deep-dive",
        "why": "James Eastham (AWS) separates streams, event buses and queues by delivery semantics, retention and consumer model, with concrete AWS services.",
        "length": "12:20"
      },
      {
        "youtubeId": "_5mu7lZz5X4",
        "title": "Kafka vs. RabbitMQ - who wins and why? | Systems Design Interview 0 to 1 with Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "Jordan's interview-oriented comparison: when each wins, partitioning and ordering, and replay.",
        "length": "11:36"
      }
    ],
    "intuition": "<p>A task queue is a to-do pile at a job centre: each card is handed to one worker, and once the job is done the card is shredded. An event stream is a newspaper archive: every edition is kept in order, and any number of readers (analytics, fraud, search) can read it at their own pace, pick up where they left off, or go back and re-read last week's issues.</p><p><strong>Mental model:</strong> a queue distributes <em>work</em> (one consumer per message, delete on ack). A stream records <em>facts</em> (an ordered, retained log that many consumer groups read by offset).</p><ul><li><strong>Using Kafka as a job queue with slow, uneven jobs.</strong> One slow message blocks its whole partition (head-of-line blocking), and parallelism is capped at the partition count. Share groups (KIP-932, early access in Kafka 4.0) are only starting to address this.</li><li><strong>Using a queue when several teams need the same event.</strong> You end up duplicating queues per consumer. Use a stream or a pub/sub fan-out.</li><li><strong>Assuming a stream means global ordering.</strong> Ordering holds only within a partition. Choose the partition key to match the entity that needs ordering.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Architectural Divide: Message Queues vs Event Streams</h2>\n      <p>Engineers frequently confuse message task queues (RabbitMQ, Amazon SQS, Celery) with distributed event streams (Apache Kafka, Redpanda, AWS Kinesis). While both buffer asynchronous data, they represent fundamentally different architectural models.</p>\n\n      <h2>Comparison: Task Queue vs Partitioned Event Stream</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph TaskQueue [\"Task Queue: Claim, Ack, Redeliver\"]\n      P1[\"Producer\"] -->|\"Push Job\"| Q[\"Central Queue FIFO\"]\n      Q -->|\"Deliver Job\"| W1[\"Worker 1 (Processes Job)\"]\n      Q -->|\"Deliver Job\"| W2[\"Worker 2\"]\n      W1 -->|\"Ack completed job\"| Q\n      NoteA[\"Broker tracks availability and in-flight ownership; retention varies.\"]\n    end\n\n    subgraph EventStream [\"Event Stream (Kafka / Kinesis): Append-Only Commit Log\"]\n      P2[\"Producer\"] -->|\"Append Event\"| Log[\"Partition Log [0, 1, 2, 3, 4, 5, 6, 7]\"]\n      Log -->|\"Read from Offset 2\"| CG1[\"Consumer Group: Analytics (Offset: 2)\"]\n      Log -->|\"Read from Offset 6\"| CG2[\"Consumer Group: Fraud Detection (Offset: 6)\"]\n      NoteB[\"Data is immutable on disk. Multiple consumer groups read independently and replay.\"]\n    end\n      </div>\n\n      <h2>Detailed Tradeoff Matrix</h2>\n      <table>\n        <thead>\n          <tr><th>Dimension</th><th>Task Queue (RabbitMQ / SQS)</th><th>Event Stream (Kafka / Redpanda)</th></tr>\n        </thead>\n        <tbody>\n          <tr><td><strong>Message Lifecycle</strong></td><td>Usually tracks each job through available, leased/in-flight, acknowledged, and redelivery states; deletion or retention behavior is broker-specific.</td><td>Records are retained by time or size policy independently of one consumer group's progress.</td></tr>\n          <tr><td><strong>Replayability</strong></td><td>Often limited after acknowledgement, though dead-lettering, mirroring, or explicit retention can preserve history.</td><td>Possible while records remain retained; replay must still handle changed code, schemas, and duplicate effects.</td></tr>\n          <tr><td><strong>Consumer Tracking</strong></td><td>Broker commonly tracks availability, lease/visibility, acknowledgement, and redelivery per job.</td><td>A group commits progress per partition, plus application state needed to make effects and retries safe.</td></tr>\n          <tr><td><strong>Ordering Guarantees</strong></td><td>Depends on queue type, worker concurrency, leases, and retries.</td><td>Offsets order records within a partition; concurrent handlers and retries can still complete side effects out of order.</td></tr>\n          <tr><td><strong>Throughput Profile</strong></td><td colspan=\"2\">Measure with the required payload, durability, replication, partition count, acknowledgement policy, and consumer work; product labels do not determine a universal rate.</td></tr>\n        </tbody>\n      </table>\n    \n<!-- enriched -->\n<h2>Worked example: the same workload on each</h2><p>An image-processing workload: 2,000 jobs per second, each taking 50 ms to 30 s (heavily skewed).</p><ul><li><strong>SQS or RabbitMQ:</strong> 500 workers each pull the next job. A 30-second job occupies one worker while the others continue. Scale by adding workers, and there is no partition limit.</li><li><strong>Kafka with 50 partitions:</strong> at most 50 consumers in a group. A 30-second job at offset 1,000 of partition 7 holds up every later message in partition 7 unless the consumer hands work to an internal thread pool, which then complicates offset commits.</li></ul><p>Now an order-events workload: 5,000 OrderPlaced events per second, needed by billing, search, the email service and a data lake, with the ability to replay the last 7 days after a bug fix. On Kafka this is one topic with 7-day retention and four consumer groups, each with its own offsets, and a replay is an offset reset. On a queue it would take four queues fed by a fan-out, and no replay once messages are acknowledged.</p><h2>Semantics side by side</h2><table><thead><tr><th>Aspect</th><th>Task queue (SQS, RabbitMQ classic)</th><th>Log stream (Kafka, Kinesis, Pulsar)</th></tr></thead><tbody><tr><td>Unit of tracking</td><td>Per message: in flight, acked, redelivered</td><td>Per partition: a committed offset</td></tr><tr><td>After consumption</td><td>Deleted</td><td>Retained until time or size limits</td></tr><tr><td>Multiple consumers of one message</td><td>Needs a fan-out (SNS to SQS, exchanges)</td><td>Native: one consumer group per use</td></tr><tr><td>Parallelism</td><td>Any number of workers</td><td>At most the partition count per group</td></tr><tr><td>Per-message retry or delay</td><td>Native (visibility timeout, DLQ, delay)</td><td>Build it with retry topics</td></tr><tr><td>Ordering</td><td>Best effort (SQS FIFO per message group)</td><td>Strict per partition</td></tr><tr><td>Replay</td><td>No, unless archived</td><td>Yes, within retention</td></tr></tbody></table><h2>Convergence</h2><p>The line is blurring. RabbitMQ Streams add a retained log, Kafka share groups add queue-like per-record acknowledgement, and Pulsar supports both subscription models on one topic. In interviews, reason about the <em>semantics</em> you need (per-message ack versus retained log, fan-out, replay, ordering) rather than brand names.</p>\n</div>",
    "keyTakeaways": [
      "Task queues coordinate ownership and acknowledgement of individual jobs; retention and deletion semantics vary by broker.",
      "Event streams retain ordered partition records independently of a consumer group's committed progress, permitting replay within retention.",
      "Use RabbitMQ/SQS for discrete background jobs; use Kafka for event-driven pub/sub, audit logs, and streaming analytics."
    ],
    "furtherReading": [
      {
        "title": "Apache Kafka Documentation: Design",
        "url": "https://kafka.apache.org/42/design/design/"
      },
      {
        "title": "RabbitMQ Tutorial: Work Queues",
        "url": "https://www.rabbitmq.com/tutorials/tutorial-two-python"
      },
      {
        "title": "Apache Kafka Documentation: Introduction (Event Streaming Concepts)",
        "url": "https://kafka.apache.org/42/getting-started/introduction/"
      }
    ]
  },
  "event-bus-for-product-events": {
    "title": "Event bus for product events",
    "video": {
      "youtubeId": "STKCRSUsyP0",
      "title": "The Many Meanings of Event-Driven Architecture • Martin Fowler • GOTO 2017",
      "channel": "GOTO Conferences",
      "why": "Martin Fowler's GOTO talk separates event notification, event-carried state transfer, event sourcing and CQRS. That is the core design choice when broadcasting product events to many services.",
      "length": "50:06"
    },
    "videos": [
      {
        "youtubeId": "5YLpjPmsPCA",
        "title": "What is the Transactional Outbox Pattern? | Designing Event-Driven Microservices",
        "channel": "Confluent, an IBM Company",
        "role": "intro",
        "why": "Confluent's concise explanation of the transactional outbox, the dual-write fix at the centre of this lesson.",
        "length": "5:31"
      },
      {
        "youtubeId": "88j7EEiyqzM",
        "title": "Debezium - Capturing Data the Instant it Happens (with Gunnar Morling)",
        "channel": "Developer Voices",
        "role": "deep-dive",
        "why": "Gunnar Morling (Debezium lead) on log-based change data capture, the outbox event router, and the operational realities of CDC pipelines.",
        "length": "1:02:47"
      }
    ],
    "intuition": "<p>A town crier stands in the square and announces \"the bakery has opened\", and anyone who cares (hungry people, the tax office, the newspaper) reacts in their own way. The bakery does not need to know who is listening. An event bus is that crier for your company: services announce business facts such as <code>OrderPlaced</code>, and any number of other services subscribe without the producer changing.</p><p><strong>Mental model:</strong> events are immutable, past-tense facts owned by one producer, published reliably from the same transaction as the state change, and described by a versioned schema that consumers can depend on.</p><ul><li><strong>Dual writes.</strong> Writing to the DB and then publishing to Kafka loses events on a crash. Use an outbox or CDC.</li><li><strong>Publishing commands disguised as events.</strong> <code>SendWelcomeEmail</code> couples the producer to a consumer. Publish <code>UserSignedUp</code> and let the email service decide.</li><li><strong>Breaking schemas.</strong> Renaming or removing a field breaks unknown consumers. Enforce compatibility in a schema registry, and add fields with defaults.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Enterprise Product Event Bus</h2>\n      <p>In a microservices organization, business changes (e.g. <code>OrderPlaced</code>, <code>UserSignedUp</code>, <code>SubscriptionCanceled</code>) must be broadcast to dozens of downstream services (search indexing, email marketing, fraud detection, analytics, and accounting). An enterprise event bus coordinates these product events safely.</p>\n\n      <h2>The Event-Driven Topology with Outbox & Schema Registry</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    App[\"Order Service\"] -->|\"1. Atomic ACID Transaction\"| DB[(\"PostgreSQL: orders + outbox table\")]\n    DB -->|\"2. Tail WAL Log (No Application Dual Write)\"| Debezium[\"Debezium Change Data Capture (CDC)\"]\n    Debezium -->|\"3. Validate Schema\"| SchemaReg[(\"Confluent Schema Registry (Avro/Protobuf)\")]\n    Debezium -->|\"4. Publish Event\"| Kafka[(\"Kafka Topic: orders.events\")]\n    \n    Kafka --> CG1[\"Search Index Worker\"]\n    Kafka --> CG2[\"Fraud Detection Worker\"]\n    Kafka --> CG3[\"Email Notification Worker\"]\n      </div>\n\n      <h2>Under the Hood: Solving the Dual-Write Disaster</h2>\n      <p>A fatal anti-pattern in distributed systems is writing to a database and publishing to a message broker in application code:</p>\n      <pre><code>// THE DUAL-WRITE DISASTER: NEVER DO THIS\nawait db.orders.insert(order);\nawait kafka.publish(\"order_events\", order); // What if this network call fails or server crashes?\n      </code></pre>\n      <p>If the Kafka write fails or the process crashes between lines, the database has the order but downstream workers never receive the event. If you reverse the order, the event is emitted but the database write could fail.</p>\n      <p><strong>The Transactional Outbox Pattern:</strong> The application writes both the order record and an outbox event into the <em>same local database transaction</em>. A Change Data Capture (CDC) engine such as Debezium tails committed database changes and publishes them to Kafka. This closes the application dual-write window, but publication can be delayed or repeated, so consumers still need schema handling, idempotent effects, monitoring, and retention sufficient for recovery.</p>\n    \n<!-- enriched -->\n<h2>Worked example: an outbox row to three consumers</h2><pre><code>BEGIN;\nINSERT INTO orders (id, user_id, total_cents, status)\n  VALUES ('o_981', 'u_42', 4599, 'PLACED');\nINSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload)\n  VALUES ('evt_7f3', 'order', 'o_981', 'OrderPlaced',\n          '{\"orderId\":\"o_981\",\"userId\":\"u_42\",\"totalCents\":4599,\"schemaVersion\":3}');\nCOMMIT;</code></pre><p>Debezium reads the committed outbox insert from the Postgres WAL and routes it to topic <code>order.events</code>, keyed by <code>o_981</code> so that all events for this order stay in one partition, in order. Search, fraud and email each consume in their own consumer group. If Debezium crashes after publishing but before recording its WAL position, it republishes <code>evt_7f3</code> on restart. Consumers deduplicate on the event ID.</p><h2>Event styles (Fowler's taxonomy)</h2><table><thead><tr><th>Style</th><th>Payload</th><th>Consumer coupling</th><th>Trade-off</th></tr></thead><tbody><tr><td>Event notification</td><td>ID plus type only</td><td>Consumers call back the producer's API</td><td>Small events, but a callback load spike on the producer</td></tr><tr><td>Event-carried state transfer</td><td>Full relevant state</td><td>Consumers keep local copies</td><td>No callbacks, but larger events and schema weight</td></tr><tr><td>Event sourcing</td><td>Every state change is the source of truth</td><td>Rebuild state by replay</td><td>Full audit trail, but hard schema evolution</td></tr></tbody></table><h2>Schema evolution rules (Avro or Protobuf with a registry)</h2><ul><li><strong>Backward compatible</strong> (new consumers read old events): you may delete fields, or add fields that have defaults.</li><li><strong>Forward compatible</strong> (old consumers read new events): you may add fields, or delete fields that have defaults.</li><li><strong>Never</strong> change a field's type or reuse a Protobuf field number.</li><li>Include an envelope: event ID, type, source, occurrence time, schema version, and optionally a trace ID. CloudEvents standardises these attributes.</li></ul><h2>Failure modes</h2><ul><li><strong>Outbox table growth:</strong> delete or partition rows once they are published, or the CDC-read table bloats.</li><li><strong>WAL retention:</strong> a stopped Debezium replication slot makes Postgres keep WAL indefinitely, which can fill the disk. Alert on slot lag.</li><li><strong>Event storms:</strong> a backfill publishes 50 million events and swamps consumers. Throttle backfills, or give them a separate topic.</li></ul>\n</div>",
    "keyTakeaways": [
      "A transactional outbox commits domain state and the publication obligation together, removing the application dual-write race; CDC retries and consumer effects still require recovery and deduplication.",
      "Schema registries can enforce backward and forward compatibility for Avro or Protocol Buffers schemas, but only when producers register and validate schemas through the registry and a compatibility mode is configured for the subject.",
      "Use a documented event envelope with stable identity, type, producer, schema version, and occurrence time; CloudEvents is one optional standard."
    ],
    "furtherReading": [
      {
        "title": "Debezium Documentation: The Outbox Pattern",
        "url": "https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html"
      },
      {
        "title": "Chris Richardson: Pattern: Transactional Outbox (microservices.io)",
        "url": "https://microservices.io/patterns/data/transactional-outbox.html"
      },
      {
        "title": "Pat Helland: Life Beyond Distributed Transactions (ACM Queue, 2016)",
        "url": "https://dl.acm.org/doi/10.1145/3012426.3025012"
      }
    ]
  },
  "queue-lag": {
    "title": "Queue lag",
    "video": {
      "youtubeId": "jguxDV1gWk8",
      "title": "BEWARE of Consumer Lag! Event Driven Architecture Monitoring",
      "channel": "CodeOpinion",
      "why": "CodeOpinion (Derek Comartin) explains consumer lag as an operational signal: why it grows, what to measure (including message age), and how to react. It is directly on topic.",
      "length": "10:39"
    },
    "videos": [
      {
        "youtubeId": "-Dwb6RhNDNU",
        "title": "Apache Kafka Consumer Lag Analysis in-depth intuition",
        "channel": "Knowledge Amplifier",
        "role": "deep-dive",
        "why": "A Kafka-specific walkthrough of how lag is computed per partition from log-end and committed offsets, and how to diagnose it.",
        "length": "14:57"
      },
      {
        "youtubeId": "DU8o-OTeoCc",
        "title": "Kafka System Design Deep Dive w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Hello Interview's Kafka deep dive covers partitions, consumer-group scaling limits and hot partitions, the levers you pull when lag grows.",
        "length": "43:31"
      }
    ],
    "intuition": "<p>A supermarket checkout queue grows when customers arrive faster than cashiers can scan. Counting the people in line (offset lag) tells you part of the story, but a manager cares more about how long the person at the back will wait (time lag). Opening more tills only helps if there are more tills to open, which for Kafka means partitions.</p><p><strong>Mental model:</strong> lag is backlog, and backlog only shrinks when service rate exceeds arrival rate. Time to drain = backlog / (service rate - arrival rate).</p><ul><li><strong>Alerting on message count alone.</strong> 100,000 messages is nothing for a fast consumer and hours of delay for a slow one. Alert on oldest-message age.</li><li><strong>Scaling consumers beyond the partition count.</strong> Extra Kafka consumers in a group sit idle. Parallelism is capped at the number of partitions.</li><li><strong>Ignoring skew.</strong> The total lag may look fine while one hot partition is hours behind.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Consumer Lag & Little's Law</h2>\n      <p>In distributed message processing, <strong>Consumer Lag</strong> is the delta between the latest message produced to a partition (the latest offset a consumer can read: the high watermark, or the last stable offset under read_committed; lag tools often label this the log-end offset) and the latest message offset committed by the consumer group:</p>\n      <pre><code>Consumer_Lag = Log_End_Offset - Current_Consumer_Offset</code></pre>\n      <p>Offset lag is one useful indicator, but oldest-event age, arrival and service rates, retry volume, partition skew, and downstream latency are often needed to explain user-visible delay. For a stable system over a defined window, <strong>Little's Law</strong> (L = λ W) relates average in-flight work, throughput, and average time in system. If arrivals exceed service capacity, the system is not stable: backlog and age continue growing until capacity increases, intake is limited, or work is shed.</p>\n\n      <h2>Consumer Lag and Auto-Scaling Loop</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    Producers[\"Producers (Burst: 50,000 msg/sec)\"] --> Partition[\"Kafka Topic Partition (High Watermark: 95,000)\"]\n    Partition -->|\"Lag = 45,000\"| Consumer[\"Consumer Worker Pool (Current Offset: 50,000)\"]\n    \n    Consumer -->|\"Report Metrics\"| Prom[\"Prometheus (kafka_consumergroup_lag)\"]\n    Prom -->|\"Threshold Exceeded (> 10,000)\"| KEDA[\"KEDA / Kubernetes HPA\"]\n    KEDA -->|\"Scale Pods (Workers: 2 -> 16)\"| Consumer\n      </div>\n\n      <h2>Backpressure & Flow Control Strategies</h2>\n      <p>When downstream consumers cannot keep up with upstream producers, the system must exert <strong>Backpressure</strong> rather than crashing:</p>\n      <ul>\n        <li><strong>Pull-Based Flow Control:</strong> Unlike push delivery with no limit on unacknowledged messages (RabbitMQ bounds this with consumer prefetch via <code>basic.qos</code>, and SQS is itself pull-based), Kafka consumers pull batches of records using <code>poll(Duration timeout)</code>, with the batch size capped by the <code>max.poll.records</code> setting. Workers dictate their own ingestion rate based on available processing capacity.</li>\n        <li><strong>Dead-Letter Queues (DLQ):</strong> If a poisoned message repeatedly causes worker crashes or exceeds retry thresholds, the consumer routes it to an isolated DLQ topic and advances its offset, preventing a single poisoned message from stalling the entire consumer group.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: how long until we catch up?</h2><p>A topic receives 20,000 messages per second. Ten consumers each process 2,500 per second, 25,000 in total. A deploy pauses consumption for 5 minutes.</p><ul><li>Backlog built up: 20,000 x 300 s = 6,000,000 messages.</li><li>Net drain rate: 25,000 - 20,000 = 5,000 per second.</li><li>Time to drain: 6,000,000 / 5,000 = 1,200 s = <strong>20 minutes</strong>, four times longer than the outage.</li><li>Scale to 20 consumers (if there are at least 20 partitions): drain at 50,000 - 20,000 = 30,000 per second, done in <strong>200 s</strong>.</li><li>With only 12 partitions, 12 consumers give 30,000 capacity and a 10,000 per second net drain, so 10 minutes. Consumers beyond 12 do nothing.</li></ul><p>Little's law cross-check: at steady state, 20,000 messages per second arriving with an average of 50 ms in the system means about 1,000 messages in flight. A lag of 6 million means that much excess backlog on top of normal.</p><h2>Metrics that matter</h2><table><thead><tr><th>Metric</th><th>What it tells you</th><th>Caveat</th></tr></thead><tbody><tr><td>Offset lag per partition</td><td>Messages behind</td><td>Not comparable across topics with different processing costs</td></tr><tr><td>Time lag (age of the oldest unconsumed message)</td><td>User-visible delay</td><td>Needs timestamps. Burrow and Kafka Lag Exporter estimate it</td></tr><tr><td>Consume rate against produce rate</td><td>Whether lag is shrinking</td><td>Look at trends, not snapshots</td></tr><tr><td>Rebalance count</td><td>Group instability</td><td>Frequent rebalances stall consumption</td></tr><tr><td>DLQ and retry topic rate</td><td>Poison or failing messages</td><td>Retries can hide lag in another topic</td></tr></tbody></table><h2>Levers when lag grows</h2><ul><li><strong>Scale out</strong>, up to the partition count. Adding partitions later remaps keys, so plan for peak throughput up front.</li><li><strong>Batch downstream writes:</strong> one bulk insert of 500 rows instead of 500 single inserts.</li><li><strong>Fix slow handlers:</strong> tune <code>max.poll.records</code> and <code>max.poll.interval.ms</code> so slow batches do not trigger rebalances.</li><li><strong>Shed or defer:</strong> drop low-value events, such as analytics pings, during incidents.</li><li><strong>Autoscale on lag:</strong> KEDA's Kafka scaler targets lag per partition. Cap maximum replicas at the partition count.</li></ul>\n</div>",
    "keyTakeaways": [
      "Consumer lag measures the delta between the broker high watermark and consumer committed offset.",
      "Pull-based consumption naturally enforces backpressure by allowing workers to control their ingestion rate.",
      "Automated scaling (via KEDA/Kubernetes HPA) dynamically adds worker pods when consumer lag breaches thresholds."
    ],
    "furtherReading": [
      {
        "title": "Confluent Documentation: Monitor Consumer Lag",
        "url": "https://docs.confluent.io/platform/current/monitor/monitor-consumer-lag.html"
      },
      {
        "title": "John D. C. Little: Little's Law as Viewed on Its 50th Anniversary (Operations Research, 2011)",
        "url": "https://people.cs.umass.edu/~emery/classes/cmpsci691st/readings/OS/Littles-Law-50-Years-Later.pdf"
      },
      {
        "title": "David Yanacek (Amazon Builders' Library): Avoiding Insurmountable Queue Backlogs",
        "url": "https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/"
      }
    ]
  },
  "distributed-task-scheduler": {
    "title": "Distributed task scheduler",
    "video": {
      "youtubeId": "pzDwYHRzEnk",
      "title": "20: Distributed Job Scheduler | Systems Design Interview Questions With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Jordan designs a distributed job scheduler end to end: durable job storage, claiming due jobs without double execution, leases and retries, and partitioning the scheduler. It replaces the current low-view AI-podcast-style video.",
      "length": "30:28"
    },
    "videos": [
      {
        "youtubeId": "RtW4UEYGdME",
        "title": "Aaron David Goldman on \"Hashed and Hierarchical Timing Wheels\"",
        "channel": "Aaron Goldman",
        "role": "deep-dive",
        "why": "A Papers-We-Love-style walkthrough of Varghese and Lauck's hashed and hierarchical timing wheels, the in-process timer structure the lesson mentions.",
        "length": "1:01:35"
      },
      {
        "youtubeId": "WTxG5880EH8",
        "title": "Distributed Job Scheduler Design Deep Dive with Google SWE! | Systems Design Interview Question 25",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "Jordan's earlier and shorter scheduler design, useful as a compact interview-length version.",
        "length": "19:40"
      }
    ],
    "intuition": "<p>Picture a post office that accepts letters marked \"deliver on 3 March\". It files them in pigeonholes by date. Each morning a clerk takes today's pigeonhole, hands the letters to couriers, and ticks each one off only after the courier confirms pickup. If a clerk faints mid-morning, another clerk sees the unticked letters and hands them out again. A few letters might go out twice, but none are lost.</p><p><strong>Mental model:</strong> a scheduler is a durable index sorted by due time, plus a claim protocol (lease, publish, acknowledge) that gives at-least-once execution, plus idempotent workers that make duplicates harmless.</p><ul><li><strong>Deleting a job before its handoff is confirmed.</strong> A crash between delete and publish loses the job forever. Move it to a leased state instead.</li><li><strong>Running one scheduler node.</strong> It is a single point of failure. Partition jobs across schedulers or elect a leader, and fence the old one.</li><li><strong>Firing all \"midnight\" jobs at 00:00:00.</strong> A million cron jobs at the same instant is a self-inflicted DDoS. Add jitter.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: High-Throughput Delayed Job Scheduling</h2>\n      <p>Scheduling millions of future tasks (e.g. \"Send reminder email in 2 hours\", \"Charge card in 3 days\", \"Retry webhook in 30 seconds\") requires coordinating delayed execution across a distributed cluster without race conditions or dropped jobs.</p>\n\n      <h2>Redis Sorted Set (ZSET) Delayed Scheduler</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Application Producer\"] -->|\"ZADD delayed_jobs &lt;timestamp> &lt;job_id>\"| Redis[(\"Redis Cluster\")]\n    \n    subgraph PollerLoop [\"Distributed Worker Polling Engine\"]\n      Worker1[\"Scheduler Worker 1\"]\n      Worker2[\"Scheduler Worker 2\"]\n      Worker1 & Worker2 -->|\"Atomic claim: scheduled -> leased\"| Redis\n    end\n    \n    PollerLoop -->|\"Publish with stable job ID; retry if uncertain\"| ExecutionQueue[(\"Execution Queue (RabbitMQ / SQS)\")]\n    ExecutionQueue --> Workers[\"Execution Workers\"]\n      </div>\n\n      <h2>Under the Hood: The Atomic Lua Script Pattern</h2>\n      <p>A claim must prevent two schedulers from owning the same attempt without deleting the only durable obligation. Atomically move due IDs from the scheduled set into a leased set whose score is the lease deadline:</p>\n      <pre><code>-- Claim due jobs without forgetting them\nlocal due_jobs = redis.call('ZRANGEBYSCORE', KEYS[1], 0, ARGV[1], 'LIMIT', 0, ARGV[2])\nif #due_jobs > 0 then\n    redis.call('ZREM', KEYS[1], unpack(due_jobs))\n    for _, job_id in ipairs(due_jobs) do\n        redis.call('ZADD', KEYS[2], ARGV[3], job_id)\n    end\n    return due_jobs\nend\nreturn {}\n      </code></pre>\n\n      <p>On Redis Cluster, <code>KEYS[1]</code> and <code>KEYS[2]</code> must hash to the same slot, so name them with a hash tag such as <code>{jobs}:scheduled</code> and <code>{jobs}:leased</code>; otherwise the script fails with a CROSSSLOT error.</p><p>After claiming, publish each job with its stable ID. Only clear the lease after the broker confirms acceptance. If the scheduler crashes first, a reaper returns expired leases to the scheduled set. If publication succeeded but its acknowledgement was lost, retry may publish a duplicate, so the execution queue or worker must deduplicate by job ID. Removing a job before this recoverable handoff creates a lost-job window.</p>\n\n      <h2>Hierarchical Hashed Wheel Timers</h2>\n      <p>For in-process ultra-high-frequency scheduling (sub-millisecond to seconds), distributed databases use the <strong>Hashed Wheel Timer</strong> algorithm (Varghese & Lauck). A circular array of buckets advances like a clock hand and can provide constant-time insertion and tick work under specific implementations. Cancellation cost and worst-case bucket work depend on the data structure and timer distribution; this is an in-process timer, not a durable distributed scheduler.</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a delayed-job store</h2><p>A reminders product schedules 50 million jobs per day, spread unevenly, with 5 times the average during the evening peak.</p><ul><li>Average rate: 50,000,000 / 86,400 = about 580 jobs due per second. Peak is about 2,900 per second.</li><li>Pending jobs (scheduled up to 7 days ahead): up to about 350 million entries. In a Redis sorted set at about 100 bytes each that is about 35 GB, so shard by job ID hash into, say, 16 sorted sets (about 2.2 GB each), with one scheduler owning each shard.</li><li>Poll loop: each shard's owner runs the claim script every 100 ms with <code>LIMIT 500</code>, a capacity of about 5,000 per second per shard, far above the peak of about 180 per shard.</li><li>Durability: Redis with AOF <code>everysec</code> can lose about a second of new schedules on a crash. For payment retries, keep the source of truth in Postgres or DynamoDB and use Redis only as an index.</li></ul><h2>Implementation options</h2><table><thead><tr><th>Store</th><th>Due-time query</th><th>Claim mechanism</th><th>Durability</th><th>Scale notes</th></tr></thead><tbody><tr><td>Redis sorted set</td><td>ZRANGEBYSCORE</td><td>Lua move to a leased set</td><td>AOF or RDB. Can lose recent writes</td><td>Keep both keys in one slot with a hash tag</td></tr><tr><td>Postgres table plus index on run_at</td><td>WHERE run_at at or before now</td><td>FOR UPDATE SKIP LOCKED</td><td>Strong</td><td>Thousands per second per primary. Watch vacuum</td></tr><tr><td>DynamoDB or Cassandra time buckets</td><td>Partition per minute bucket</td><td>Conditional write on status</td><td>Strong</td><td>Hot bucket risk. Shard buckets</td></tr><tr><td>SQS delay or EventBridge Scheduler</td><td>Managed</td><td>Managed</td><td>Managed</td><td>SQS delays max out at 15 minutes</td></tr><tr><td>Temporal timers</td><td>Durable timers in history</td><td>Workflow task</td><td>Strong</td><td>Built for long-running workflows</td></tr></tbody></table><h2>Correctness checklist</h2><ul><li>Every job has a stable ID, and workers deduplicate on (job ID, scheduled time).</li><li>The reaper returns jobs whose lease has expired to the scheduled state.</li><li>The scheduler owner per shard is fenced (a lease epoch stored with each claim).</li><li>Clock skew: compute \"now\" on the store where possible (Redis <code>TIME</code>, or <code>now()</code> in the database), not on each client.</li><li>Missed-run policy for recurring jobs after downtime: run once, run all missed, or skip.</li></ul><h2>How real systems do it</h2><ul><li><strong>Airbnb's Dynein</strong> keeps delayed jobs durably in DynamoDB and hands due jobs to SQS for execution. <strong>Slack</strong> rebuilt its job queue by putting Kafka in front of Redis, so that job enqueues survive Redis failures.</li><li><strong>Kafka</strong> uses a hierarchical timing wheel in-process for request timeouts (purgatory). It is not used for durable scheduling.</li></ul>\n</div>",
    "keyTakeaways": [
      "Redis sorted sets (ZSET) store delayed jobs using future Unix execution timestamps as the score.",
      "Atomically moving due jobs into a leased set prevents competing claims without erasing the durable obligation.",
      "Hashed wheel timers efficiently manage many in-memory deadlines, but durable scheduling still needs persisted state and recovery."
    ],
    "furtherReading": [
      {
        "title": "Varghese & Lauck: Hashed and Hierarchical Timing Wheels",
        "url": "http://www.cs.columbia.edu/~nahum/w6998/papers/ton97-timing-wheels.pdf"
      },
      {
        "title": "Dropbox Tech: How We Designed Dropbox ATF: An Async Task Framework",
        "url": "https://dropbox.tech/infrastructure/asynchronous-task-scheduling-at-dropbox"
      },
      {
        "title": "Slack Engineering: Scaling Slack's Job Queue",
        "url": "https://slack.engineering/scaling-slacks-job-queue/"
      }
    ]
  },
  "postgres-skip-locked-work-queue": {
    "title": "Postgres SKIP LOCKED work queue",
    "video": {
      "youtubeId": "WIRy1Ws47ic",
      "title": "Queues in PostgreSQL | Citus Con: An Event for Postgres 2022",
      "channel": "Microsoft Developer",
      "why": "A Citus Con talk on building queues in PostgreSQL: SKIP LOCKED claiming, indexing, vacuum and bloat, and throughput limits. It is exactly this lesson, from Postgres practitioners.",
      "length": "29:30"
    },
    "videos": [
      {
        "youtubeId": "xzmd6cVoggc",
        "title": "How to implement Work Queues with Relational Databases and SQL SKIP LOCKED",
        "channel": "Vlad Mihalcea",
        "role": "intro",
        "why": "Vlad Mihalcea (a database performance expert) shows the SKIP LOCKED work-queue query and why plain FOR UPDATE serialises workers.",
        "length": "7:27"
      },
      {
        "youtubeId": "DOaDpHh1FsQ",
        "title": "Using your Database as a Queue? Good or bad idea?",
        "channel": "CodeOpinion",
        "role": "deep-dive",
        "why": "CodeOpinion weighs when a database-as-queue is a good idea and when to move to a broker: the trade-off discussion the lesson needs.",
        "length": "9:31"
      }
    ],
    "intuition": "<p>Picture a deli counter with numbered tickets on a board. With plain row locks, every worker reaches for ticket 1 and all but one stand there waiting for it. With SKIP LOCKED, a worker who sees ticket 1 already in someone's hand simply takes ticket 2, the next takes ticket 3, and nobody waits.</p><p><strong>Mental model:</strong> <code>SELECT ... FOR UPDATE SKIP LOCKED LIMIT n</code> lets concurrent workers each atomically claim different rows. The job table becomes a transactional queue, and job creation can share a transaction with your business data.</p><ul><li><strong>Holding the transaction open during slow work.</strong> A 10-minute job holding a row lock also holds back vacuum. Claim by updating to <code>running</code> with a lease timestamp, commit, then work.</li><li><strong>Forgetting the partial index.</strong> Without an index on the pending rows, every poll scans completed jobs.</li><li><strong>Tight polling.</strong> 50 workers polling every 10 ms hammer the database. Use <code>LISTEN/NOTIFY</code> to wake workers, with backoff when idle.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Why Naive SQL Work Queues Collapse</h2>\n      <p>For small to medium workloads, standing up dedicated Kafka or RabbitMQ clusters introduces operational complexity. Engineers often attempt to use PostgreSQL as a work queue. Naive implementations collapse under load:</p>\n      <ul>\n        <li><code>SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE;</code> locks the first row. Every other concurrent worker blocks waiting on the row lock, turning parallel workers into a completely serialized bottleneck.</li>\n        <li>Polling without row locks causes double-processing race conditions.</li>\n      </ul>\n\n      <h2>The Breakthrough: SKIP LOCKED</h2>\n      <p>PostgreSQL 9.5 introduced <code>FOR UPDATE SKIP LOCKED</code>. When a transaction executes this query, the database engine checks if candidate rows are currently locked by another active transaction. Instead of blocking and waiting, it <strong>instantly skips past locked rows</strong> and locks the next available unlocked row.</p>\n\n      <h2>SKIP LOCKED Worker Execution Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    W1[\"Worker 1\"] -->|\"SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1\"| J1[\"Job 1: LOCKED by W1\"]\n    W2[\"Worker 2\"] -->|\"SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1\"| J2[\"Job 2: LOCKED by W2\"]\n    W3[\"Worker 3\"] -->|\"SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1\"| J3[\"Job 3: LOCKED by W3\"]\n    \n    J1 -->|\"Process & DELETE / UPDATE status='completed'\"| Done1[\"Transaction Commit\"]\n    J2 -->|\"Process & Commit\"| Done2[\"Transaction Commit\"]\n      </div>\n\n      <h2>Production-Grade Implementation SQL</h2>\n      <pre><code>-- Atomically fetch and lock 1 pending job without blocking other workers\nWITH next_job AS (\n  SELECT id\n  FROM job_queue\n  WHERE status = 'pending' AND scheduled_at &lt;= NOW()\n  ORDER BY priority DESC, id ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT 1\n)\nUPDATE job_queue\nSET status = 'processing',\n    locked_at = NOW(),\n    worker_id = 'worker_pod_42'\nWHERE id = (SELECT id FROM next_job)\nRETURNING *;\n      </code></pre>\n      <p><strong>Operational Caution: Table Bloat:</strong> Frequent inserts and deletes create dead tuples. Queue tables require aggressive PostgreSQL autovacuum settings (e.g. <code>autovacuum_vacuum_scale_factor = 0.05</code>) to prevent sequential scan performance collapse.</p>\n    \n<!-- enriched -->\n<h2>Production-grade claim query</h2><pre><code>CREATE TABLE jobs (\n  id          bigserial PRIMARY KEY,\n  queue       text        NOT NULL,\n  payload     jsonb       NOT NULL,\n  status      text        NOT NULL DEFAULT 'pending',\n  run_at      timestamptz NOT NULL DEFAULT now(),\n  attempts    int         NOT NULL DEFAULT 0,\n  locked_until timestamptz\n);\nCREATE INDEX jobs_ready ON jobs (queue, run_at) WHERE status = 'pending';\n\n-- claim up to 10 jobs, lease them for 5 minutes, commit immediately\nWITH next AS (\n  SELECT id FROM jobs\n  WHERE queue = 'email' AND status = 'pending' AND run_at &lt;= now()\n  ORDER BY run_at\n  LIMIT 10\n  FOR UPDATE SKIP LOCKED\n)\nUPDATE jobs j\nSET status = 'running', attempts = attempts + 1,\n    locked_until = now() + interval '5 minutes'\nFROM next WHERE j.id = next.id\nRETURNING j.id, j.payload;</code></pre><p>A reaper periodically runs <code>UPDATE jobs SET status='pending' WHERE status='running' AND locked_until &lt; now()</code>, so crashed workers' jobs are retried. On success, delete the row or mark it done. On failure, set <code>run_at = now() + backoff</code>.</p><h2>Worked example: throughput budget</h2><p>Each claim-and-complete cycle costs about 3 statements (claim, process, delete), roughly 1 to 2 ms of database time with batching of 10. A modest primary sustaining 5,000 simple writes per second supports on the order of 1,500 to 2,500 jobs per second before queue traffic competes with application traffic. Each processed job leaves at least one dead tuple, so at 2,000 jobs per second that is 170 million dead tuples per day for autovacuum to clean.</p><h2>Database queue versus broker</h2><table><thead><tr><th>Factor</th><th>Postgres SKIP LOCKED</th><th>Dedicated broker (SQS, RabbitMQ)</th></tr></thead><tbody><tr><td>Transactional enqueue with business data</td><td>Yes: same commit</td><td>Needs an outbox</td></tr><tr><td>Throughput</td><td>Hundreds to a few thousand per second</td><td>Tens of thousands per second or more</td></tr><tr><td>Operational cost</td><td>None extra</td><td>Another system to run</td></tr><tr><td>Visibility and queries</td><td>Full SQL over jobs</td><td>Limited</td></tr><tr><td>Load on the primary</td><td>Competes with app queries. Adds vacuum pressure</td><td>Isolated</td></tr><tr><td>Delayed jobs, priorities</td><td>Just columns and ORDER BY</td><td>Varies by broker</td></tr></tbody></table><h2>Who uses it</h2><ul><li><strong>Oban</strong> (Elixir), <strong>Solid Queue</strong> (Rails), <strong>River</strong> (Go), <strong>Graphile Worker</strong> (Node) and <strong>pg-boss</strong> are all built on SKIP LOCKED.</li><li>Solid Queue became the Rails 8 default, which shows how far \"just use Postgres\" goes for most apps.</li></ul><h2>Failure modes</h2><ul><li><strong>Long-running transactions elsewhere</strong> (analytics queries, idle-in-transaction sessions) stop vacuum from removing dead job tuples, and the queue table bloats. Set <code>idle_in_transaction_session_timeout</code>.</li><li><strong>ORDER BY with SKIP LOCKED is not strict FIFO:</strong> locked rows are skipped, so ordering is best effort.</li></ul>\n</div>",
    "keyTakeaways": [
      "FOR UPDATE SKIP LOCKED lets many concurrent workers claim distinct jobs without blocking on each other's row locks; contention shifts to index scans over skipped rows and to vacuum pressure from dead tuples, and ordering is not strict FIFO.",
      "Common Table Expressions (CTE) atomically lock and mark jobs as 'processing' in a single round-trip query.",
      "High-throughput SQL queues must tune autovacuum aggressively to prevent dead tuple table bloat."
    ],
    "furtherReading": [
      {
        "title": "Crunchy Data: Message Queuing Using Native PostgreSQL (SKIP LOCKED)",
        "url": "https://www.crunchydata.com/blog/message-queuing-using-native-postgresql"
      },
      {
        "title": "Hannam et al.: PostgreSQL 9.5 Feature: FOR UPDATE SKIP LOCKED",
        "url": "https://www.postgresql.org/docs/9.5/release-9-5.html"
      },
      {
        "title": "PostgreSQL Documentation: SELECT, The Locking Clause (FOR UPDATE ... SKIP LOCKED)",
        "url": "https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE"
      }
    ]
  },
  "dag-workflow-orchestration": {
    "title": "DAG workflow orchestration",
    "video": {
      "youtubeId": "wMUKhtRhlmY",
      "title": "Intro to Temporal Architecture: Workflow Engine",
      "channel": "Temporal",
      "why": "Temporal's architecture talk explains the event-sourced history, task queues, workers and deterministic replay, the exact mechanism this lesson centres on. The current Devoxx microservices talk is off-topic.",
      "length": "31:37"
    },
    "videos": [
      {
        "youtubeId": "2HjnQlnA5eY",
        "title": "Temporal in 7 Minutes - the TL;DR Intro",
        "channel": "Temporal",
        "role": "intro",
        "why": "A seven-minute intro to durable execution: workflows as code, activities, automatic retries.",
        "length": "7:06"
      },
      {
        "youtubeId": "9TDR-17wFY4",
        "title": "Apache Airflow - DAGs and Batches | Distributed Systems Deep Dives With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "deep-dive",
        "why": "Jordan explains Airflow's DAG model (scheduler, executor, task dependencies, batch runs), the classic DAG-orchestrator counterpart to Temporal.",
        "length": "21:59"
      }
    ],
    "intuition": "<p>Think of a wedding planner with a checklist: book the venue, then send invitations and order the cake in parallel, then seat the guests once RSVPs are in. The planner does not bake cakes. They track what is done, what is next, and what to undo if the venue cancels (refund the deposit). If the planner falls ill, their replacement reads the notebook and carries on exactly where it stopped.</p><p><strong>Mental model:</strong> an orchestrator durably records each step's outcome and decides the next step from that record. The workers do the actual work, and crashes are recovered by replaying the record.</p><ul><li><strong>Putting side effects in workflow code.</strong> Calling an API, <code>random()</code> or <code>now()</code> directly breaks deterministic replay. Put them in activities, or use the SDK's deterministic helpers.</li><li><strong>Assuming activities run exactly once.</strong> Activities are retried after timeouts, so they must be idempotent.</li><li><strong>Using a batch DAG tool for per-request workflows.</strong> Airflow is built for scheduled data pipelines, not millions of per-order flows. Temporal-style engines target the latter.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Orchestrating Complex Business Processes</h2>\n      <p>Real-world engineering workflows (e.g. customer onboarding, food delivery fulfillment, ML model training pipelines) consist of multiple steps that must execute across heterogeneous services. These steps have dependencies forming a <strong>Directed Acyclic Graph (DAG)</strong>.</p>\n\n      <h2>The Temporal Event-Sourced Orchestration Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client: StartOrderWorkflow()\"] --> Cluster[\"Temporal Cluster (Orchestrator)\"]\n    \n    subgraph HistoryEngine [\"Durable Event Sourcing History Engine\"]\n      Cluster --> History[(\"Append-Only Execution History Log\")]\n    end\n    \n    subgraph WorkerFleet [\"Distributed Worker Fleet\"]\n      Cluster -->|\"Task: ChargeCard\"| W1[\"Payment Worker\"]\n      W1 -->|\"Result: Success\"| Cluster\n      Cluster -->|\"Task: ReserveInventory\"| W2[\"Inventory Worker\"]\n      W2 -->|\"Result: Failed\"| Cluster\n      Cluster -->|\"Compensating Task: RefundCard\"| W1\n    end\n      </div>\n\n      <h2>Under the Hood: Deterministic Workflow Replay</h2>\n      <p>Traditional orchestrators store current state in database tables (e.g. <code>step = 'STEP_3'</code>). Modern engines like <strong>Temporal</strong> and <strong>Cadence</strong> use <strong>Event Sourcing</strong>:</p>\n      <ul>\n        <li>Workflows are written as standard code (Go, TypeScript, Java). Workers normally keep running workflows cached in memory and apply only new events. When a worker fails or restarts, or a cached workflow is evicted, a worker rebuilds the workflow state by replaying the recorded event history from the beginning.</li>\n        <li>During replay, previously executed external calls (Activities) are not re-executed; their recorded results are returned instantaneously from the history log.</li>\n        <li><strong>The Determinism Rule:</strong> Workflow code must be 100% deterministic (no random UUID generation, direct system clock reads, or direct HTTP calls inside the workflow function). Non-deterministic operations must reside in Activities, or use the SDK's deterministic equivalents (for example <code>workflow.Now</code> and <code>workflow.SideEffect</code> in Go, <code>Workflow.currentTimeMillis()</code> and <code>Workflow.randomUUID()</code> in Java).</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: an order saga with compensation</h2><div class=\"mermaid\">flowchart TD\n  A[\"Start order workflow\"] --> B[\"Charge card\"]\n  B -->|\"ok\"| C[\"Reserve inventory\"]\n  C -->|\"ok\"| D[\"Create shipment\"]\n  D -->|\"ok\"| E[\"Done\"]\n  C -->|\"out of stock\"| F[\"Refund card\"]\n  D -->|\"carrier down after 5 retries\"| G[\"Release inventory\"]\n  G --> F\n  F --> H[\"Mark order failed\"]\n</div><p>The Temporal history for a failure path might read: WorkflowStarted, ActivityScheduled ChargeCard, ActivityCompleted ChargeCard (txn t_55), ActivityScheduled ReserveInventory, ActivityFailed ReserveInventory (OutOfStock), ActivityScheduled RefundCard, ActivityCompleted RefundCard, WorkflowCompleted (failed). If the worker crashes after ChargeCard completes, a new worker replays the history: the ChargeCard call returns t_55 from history without charging again, and execution continues at ReserveInventory.</p><h2>Engine comparison</h2><table><thead><tr><th>Engine</th><th>Model</th><th>Best for</th><th>State storage</th><th>Watch out for</th></tr></thead><tbody><tr><td>Airflow</td><td>Python-defined static DAGs, scheduled runs</td><td>Batch ETL, ML pipelines</td><td>Metadata DB of task states</td><td>Scheduler latency of seconds. Not for per-request flows</td></tr><tr><td>Temporal / Cadence</td><td>Workflows as code, event-sourced replay</td><td>Long-running business processes, sagas</td><td>History per workflow (Cassandra, Postgres, MySQL)</td><td>Determinism rules, history size limits (about 50,000 events), versioning</td></tr><tr><td>AWS Step Functions</td><td>JSON state machine (Amazon States Language)</td><td>Serverless glue on AWS</td><td>Managed</td><td>Per-transition cost. Standard workflows run up to 1 year</td></tr><tr><td>Argo Workflows</td><td>DAG of Kubernetes pods</td><td>CI/CD, ML training on Kubernetes</td><td>Kubernetes CRDs</td><td>Pod startup overhead per step</td></tr><tr><td>Choreography (events only)</td><td>No central orchestrator</td><td>Loosely coupled, simple flows</td><td>Spread across services</td><td>Hard to see or change end-to-end flow</td></tr></tbody></table><h2>Operational concerns</h2><ul><li><strong>Versioning:</strong> changing workflow code while old executions are in flight breaks replay. Use Temporal's patching or versioning APIs, or run old and new side by side.</li><li><strong>Continue-as-new</strong> for long-lived workflows (subscriptions, polling), so history does not grow without bound.</li><li><strong>Compensation is not rollback:</strong> a refund is a new transaction that may itself fail, so compensations need retries and alerting too.</li></ul><h2>Who uses it</h2><ul><li><strong>Uber</strong> built Cadence, and Temporal is its fork by the original authors. Stripe, Netflix, Snap and Coinbase use Temporal for payments, infrastructure and CI workflows.</li><li><strong>Airbnb</strong> created Airflow for data pipelines. It is now an Apache project.</li></ul>\n</div>",
    "keyTakeaways": [
      "DAG engines model complex multi-step workflows with strict dependency ordering and automatic retries.",
      "Temporal uses event sourcing to recover state by deterministically replaying history logs without re-executing completed tasks.",
      "The Saga pattern executes compensating transactions in reverse order when any intermediate workflow step fails."
    ],
    "furtherReading": [
      {
        "title": "Temporal Architecture and Execution Model",
        "url": "https://docs.temporal.io/temporal-explained"
      },
      {
        "title": "Hohpe & Woolf: Enterprise Integration Patterns (Chapter 12: Process Manager)",
        "url": "https://www.enterpriseintegrationpatterns.com/patterns/messaging/ProcessManager.html"
      },
      {
        "title": "Apache Airflow Documentation: Dags",
        "url": "https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html"
      }
    ]
  },
  "rule-engine-trigger-framework": {
    "title": "Rule engine and trigger framework",
    "video": {
      "youtubeId": "lCzEPLxt7f4",
      "title": "Rete Algorithm: Optimizing the Match",
      "channel": "NPTEL-NOC IITM",
      "why": "An IIT Madras (NPTEL) lecture that explains Rete's alpha and beta networks and how caching partial matches avoids re-evaluating every rule on every fact, the core algorithm of this lesson.",
      "length": "23:34"
    },
    "videos": [
      {
        "youtubeId": "CmxHPJTAF3I",
        "title": "Jeremy Ary: (Rule engine) BRAINSSSS! Rete Algorithm Rundown",
        "channel": "Jason Orendorff",
        "role": "intro",
        "why": "Jeremy Ary (a Drools contributor) gives a quick, practical rundown of how Rete works inside a production rule engine.",
        "length": "11:11"
      },
      {
        "youtubeId": "Fuac__g928E",
        "title": "Microservices and Rules Engines – a blast from the past - Udi Dahan",
        "channel": "NDC Conferences",
        "role": "case-study",
        "why": "Udi Dahan's NDC talk on where rule engines fit in a microservice architecture and where they go wrong: the trigger-framework design trade-offs.",
        "length": "52:49"
      }
    ],
    "intuition": "<p>A security guard has a thick binder of rules: \"stop anyone carrying a large bag after 10pm if they are not staff\". Re-reading the whole binder for every visitor is slow. Instead the guard pre-sorts: one glance tells them \"large bag?\", another \"after 10pm?\", and only people who pass both get the staff check. Rete is that pre-sorting, compiled once and shared by every rule that asks the same question.</p><p><strong>Mental model:</strong> a rule engine separates <em>when</em> (conditions over events and facts) from <em>then</em> (actions), and indexes the conditions so that each new event touches only the rules it could possibly match.</p><ul><li><strong>Letting business users write unbounded rules.</strong> Arbitrary scripts can loop, call networks or leak data. Use a sandboxed, non-Turing-complete language such as CEL, with cost limits.</li><li><strong>Actions triggering rules that trigger actions.</strong> Rule A updates a field, which fires rule B, which fires A again. Add loop detection, depth limits and idempotent actions.</li><li><strong>Forgetting rule versioning.</strong> When a fraud rule changes at 14:02, you need to know which version judged each transaction.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: High-Throughput Rule Evaluation</h2>\n      <p>Modern platforms process millions of real-time events per second against dynamic rule collections: fraud prevention (\"Flag transaction if amount > 10,000 and country != user.home_country\"), promotional pricing, and security firewalls. Naive evaluation (O(N × M) linear checking) creates crippling CPU bottlenecks.</p>\n\n      <h2>The Rete Pattern Matching Network</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Event[\"Transaction Event: {amount: 15000, country: 'RO', type: 'WIRE'}\"] --> RootNode[\"Root Alpha Node\"]\n    \n    subgraph AlphaNetwork [\"Alpha Network (Single-Attribute Filters)\"]\n      RootNode --> A1{\"amount > 10000?\"}\n      RootNode --> A2{\"type == 'WIRE'?\"}\n    end\n    \n    subgraph BetaNetwork [\"Beta Network (Multi-Object Joins)\"]\n      A1 & A2 --> B1{\"country != user.registered_country?\"}\n    end\n    \n    B1 --> Terminal[\"Terminal Node: Trigger Alert & Block Transaction\"]\n      </div>\n\n      <h2>Under the Hood: The Rete Algorithm & JIT Compilation</h2>\n      <ul>\n        <li><strong>The Rete Algorithm (Forgy):</strong> Avoids redundant evaluations by compiling rules into a directed acyclic evaluation graph. Alpha nodes filter single-fact conditions; Beta nodes perform stateful cross-entity comparisons. Partial matches are kept in beta memories, so when a fact is added or changed only the affected parts of the network are re-evaluated (incremental matching) instead of re-running every rule.</li>\n        <li><strong>Abstract Syntax Tree (AST) JIT Compilation:</strong> High-performance engines parse business rules written in domain-specific languages (e.g. JSON-rules or CEL - Common Expression Language) into an AST that is parsed and type-checked once, then evaluated in microseconds. The reference CEL implementations interpret the checked AST; some other engines go further and compile rules to JVM bytecode or native functions.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: why indexing matters</h2><p>A fraud platform has 5,000 rules and receives 20,000 transactions per second. The naive approach evaluates every rule on every event: 100 million rule evaluations per second, about 50 ms per event at 1 microsecond each. That is unacceptable.</p><p>Most rules start with a selective predicate such as <code>country == \"RO\"</code> or <code>type == \"WIRE\"</code>. Index rules by their first discriminating attribute, a hash map from (field, value) to candidate rules. A typical event then matches about 40 candidate rules, which are evaluated fully: 20,000 x 40 = 800,000 evaluations per second, about 40 microseconds per event. Rete generalises this by sharing identical condition nodes across rules and caching partial joins, which matters when rules join several facts, such as a transaction plus the user profile plus the last 5 transactions.</p><h2>Trigger framework architecture</h2><ul><li><strong>Ingest:</strong> events arrive from Kafka, keyed by user or account, so per-entity state stays on one partition.</li><li><strong>Enrich:</strong> join with profile and feature data from a low-latency store, and cache hot profiles.</li><li><strong>Evaluate:</strong> compiled CEL or JSON-logic expressions, or a Rete engine such as Drools for complex joins.</li><li><strong>Act:</strong> emit decisions (block, review, notify) as new events. Actions are idempotent, keyed by (rule version, event ID).</li><li><strong>Audit:</strong> store the event, rule version, inputs and outcome for every decision.</li></ul><h2>Engine options</h2><table><thead><tr><th>Approach</th><th>Expressiveness</th><th>Safety</th><th>Latency</th><th>Examples</th></tr></thead><tbody><tr><td>Hard-coded if statements</td><td>Anything</td><td>Code review</td><td>Fastest</td><td>Early-stage products</td></tr><tr><td>Expression language</td><td>Boolean expressions, no loops</td><td>High: bounded cost</td><td>Microseconds</td><td>CEL (Kubernetes, Envoy, Firebase rules), JSON-logic</td></tr><tr><td>Rete production-rule engine</td><td>Multi-fact joins, forward chaining</td><td>Medium</td><td>Microseconds to milliseconds</td><td>Drools, CLIPS</td></tr><tr><td>Stream processor with windows</td><td>Time windows, aggregates such as 5 wires in 10 minutes</td><td>Code-level</td><td>Milliseconds</td><td>Flink CEP, Kafka Streams</td></tr><tr><td>Decision tables and DMN</td><td>Tabular business logic</td><td>High</td><td>Fast</td><td>Camunda DMN</td></tr></tbody></table><h2>Failure modes</h2><ul><li><strong>Rule explosion:</strong> thousands of overlapping rules that nobody understands. Track the hit rate per rule and retire dead rules.</li><li><strong>Shadow mode skipped:</strong> deploy new rules in log-only mode first to measure false positives before they block real customers.</li><li><strong>Enrichment outage:</strong> decide whether rules fail open (allow) or fail closed (block) when profile data is unavailable.</li></ul>\n</div>",
    "keyTakeaways": [
      "Rule engines evaluate millions of incoming events against dynamic criteria without modifying application code.",
      "The Rete algorithm shares common condition evaluations across rules, eliminating redundant CPU computation.",
      "CEL defines a bounded, non-Turing-complete expression language; implementations may interpret, compile, or otherwise optimize checked expressions."
    ],
    "furtherReading": [
      {
        "title": "Google Common Expression Language (CEL) Specification",
        "url": "https://github.com/google/cel-spec"
      },
      {
        "title": "Charles Forgy: Rete: A Fast Algorithm for the Many Pattern/Many Object Pattern Match Problem (Artificial Intelligence, 1982)",
        "url": "https://www.sciencedirect.com/science/article/pii/0004370282900200"
      },
      {
        "title": "Martin Fowler: Rules Engine",
        "url": "https://martinfowler.com/bliki/RulesEngine.html"
      }
    ]
  },
  "fanout-patterns": {
    "title": "Fanout patterns",
    "video": {
      "youtubeId": "Qj4-GruzyDU",
      "title": "Design FB News Feed System Design Interview w/ ex: Meta Senior Manager",
      "channel": "Hello Interview",
      "why": "Hello Interview's news feed breakdown centres on fanout-on-write versus fanout-on-read and the celebrity hybrid, the exact trade-off this lesson covers, with capacity reasoning. The current video is a generic message-queue intro.",
      "length": "26:12"
    },
    "videos": [
      {
        "youtubeId": "FEkXjNFrL1o",
        "title": "Twitter Timeline Architecture |  Fanout | System Design",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "ByteMonk's short visual of Twitter's timeline fanout and the celebrity problem.",
        "length": "5:43"
      },
      {
        "youtubeId": "QmX2NPkJTKg",
        "title": "Designing INSTAGRAM: System Design of News Feed",
        "channel": "Gaurav Sen",
        "role": "deep-dive",
        "why": "Gaurav Sen designs an Instagram feed and reasons through push, pull and hybrid delivery, with pre-computation trade-offs.",
        "length": "24:29"
      }
    ],
    "intuition": "<p>A newspaper can be delivered to every subscriber's doorstep each morning (push), or subscribers can walk to the newsstand and pick up the papers they follow (pull). Doorstep delivery makes reading instant but costs a lot for a paper with 100 million subscribers. The newsstand costs nothing up front but makes every reader do the walking. Real feeds deliver most papers to the doorstep and leave a few giant ones at the newsstand.</p><p><strong>Mental model:</strong> fanout-on-write pays at post time, once per follower. Fanout-on-read pays at read time, once per followee. Hybrid systems push for normal accounts and pull for celebrities.</p><ul><li><strong>Pushing full posts into every inbox.</strong> Push post IDs, and store the post once. Edits and deletes then happen in one place.</li><li><strong>Fanning out to inactive users.</strong> Most followers may not open the app this week. Skip or lazily rebuild feeds for dormant users.</li><li><strong>A synchronous fanout on the post request.</strong> Always enqueue the fanout job. The author should see \"posted\" in milliseconds.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Fanout Dilemma: Social Feeds & Notifications</h2>\n      <p>When a user publishes content (a tweet, an Instagram photo, or a LinkedIn post), how is that content distributed to all of their followers? Social network engineering relies on two foundational strategies: <strong>Fanout-on-Write (Push)</strong> and <strong>Fanout-on-Read (Pull)</strong>.</p>\n\n      <h2>Architectural Comparison: Push vs Pull</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    subgraph Push [\"1. Fanout-on-Write (Push Model: Default)\"]\n      Author1[\"Alice Posts Tweet\"] --> WriteWorker[\"Background Fanout Worker\"]\n      WriteWorker -->|\"Push Tweet ID to Inboxes\"| Box1[\"Bob's Redis Feed\"]\n      WriteWorker -->|\"Push Tweet ID\"| Box2[\"Charlie's Redis Feed\"]\n      WriteWorker -->|\"Push Tweet ID\"| Box3[\"Dave's Redis Feed\"]\n      Note1[\"Feed Read: one fast range read from Redis, e.g. LRANGE on a list or ZRANGE at O(log N + M) on a sorted set\"]\n    end\n\n    subgraph Pull [\"2. Fanout-on-Read (Pull Model: Celebrities)\"]\n      Celebrity[\"Taylor Swift (100M Followers) Posts\"] --> PostDB[(\"Taylor's Outbox Table\")]\n      Follower[\"Follower Opens App\"] --> ReadAgg[\"Feed Aggregation Service\"]\n      ReadAgg -->|\"Fetch Posts\"| PostDB\n      Note2[\"Zero write amplification. Read aggregates followed accounts on the fly.\"]\n    end\n      </div>\n\n      <h2>Under the Hood: The Hybrid Fanout Architecture</h2>\n      <p>Neither pure push nor pure pull works at scale:</p>\n      <ul>\n        <li><strong>The Push Catastrophe (Write Amplification):</strong> If an account with 100,000,000 followers tweets, fanout-on-write requires generating and writing 100,000,000 Redis entries. At 50,000 writes/sec, the fanout pipeline takes 33 minutes to complete.</li>\n        <li><strong>The Pull Catastrophe (Read Latency):</strong> If every user load requires fetching and merging posts from 1,000 followees, p99 feed load latency skyrockets to seconds.</li>\n        <li><strong>The Twitter / Instagram Solution (Hybrid Model):</strong> Standard users (below some follower threshold; no exact public figure exists) use <strong>Fanout-on-Write</strong>. Celebrities above the threshold do not fan out on write. When a follower opens their feed, the system reads their pre-materialized Redis timeline and merges the recent posts of any followed celebrities on the fly.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: capacity maths</h2><p>Assume 200 million daily active users, 500 million posts per day (about 5,800 per second on average, 3 times that at peak), an average of 200 followers, and 20 billion feed reads per day (about 230,000 per second).</p><ul><li><strong>Pure push:</strong> 5,800 x 200 = 1.16 million inbox inserts per second on average, about 3.5 million at peak. Feasible on a sharded Redis or Cassandra tier. Reads are a single range query.</li><li><strong>A celebrity with 100 million followers</strong> posting once needs 100 million inserts. At a fanout budget of 1 million per second that is 100 seconds of the whole pipeline for one post, and some celebrities post many times a day.</li><li><strong>Pure pull:</strong> each feed read merges recent posts from about 200 followees, so 230,000 x 200 = 46 million post-list reads per second. Too expensive.</li><li><strong>Hybrid:</strong> push for authors below a threshold (commonly discussed in the range of about 10,000 to 1 million followers), and pull for the rest. A feed read fetches the precomputed inbox and merges the recent posts of the few followed celebrities, cached hot, so about 5 to 10 extra reads per feed load.</li></ul><h2>Strategy comparison</h2><table><thead><tr><th>Strategy</th><th>Write cost</th><th>Read cost</th><th>Freshness</th><th>Storage</th><th>Best for</th></tr></thead><tbody><tr><td>Fanout on write (push)</td><td>O(followers) per post</td><td>One range read</td><td>Seconds of fanout delay</td><td>An inbox per user</td><td>Typical accounts, read-heavy feeds</td></tr><tr><td>Fanout on read (pull)</td><td>O(1)</td><td>O(followees) merge</td><td>Instant</td><td>Minimal</td><td>Celebrities, rarely read feeds</td></tr><tr><td>Hybrid</td><td>Bounded</td><td>Inbox plus a few merges</td><td>Mixed</td><td>Moderate</td><td>Large social networks</td></tr><tr><td>Message fanout (SNS to SQS, Kafka consumer groups)</td><td>One publish</td><td>One queue per subscriber</td><td>Near real time</td><td>Per-subscriber copies or offsets</td><td>Service-to-service events</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Twitter</strong> (per Raffi Krikorian's \"Timelines at Scale\" talk) kept home timelines as lists of tweet IDs in Redis, capped at about 800 entries, fanned out on write. Very high-follower accounts were merged at read time.</li><li><strong>Instagram and Facebook</strong> rank feeds at read time from candidate sets. Fanout builds candidates and ranking picks the order.</li><li>Inbox caps (for example the last 800 IDs) bound storage. Older history falls back to pull.</li></ul><h2>Failure modes</h2><ul><li><strong>Fanout backlog</strong> during viral events. Prioritise active followers first.</li><li><strong>Deletes and blocks</strong> must be filtered at read time, because inboxes may still hold the IDs.</li></ul>\n</div>",
    "keyTakeaways": [
      "Fanout-on-Write delivers fast single-range-read feeds but collapses on high-follower celebrity posts.",
      "Fanout-on-Read eliminates write amplification but incurs heavy multi-query latency on user feed loads.",
      "Modern platforms use a hybrid model: push for normal users, dynamic pull-and-merge for celebrities."
    ],
    "furtherReading": [
      {
        "title": "Raffi Krikorian (Twitter): Timelines at Scale (QCon SF 2012, InfoQ)",
        "url": "https://www.infoq.com/presentations/Twitter-Timeline-Scalability/"
      },
      {
        "title": "AWS SNS Documentation: Fanout Amazon SNS Notifications to Amazon SQS Queues",
        "url": "https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html"
      },
      {
        "title": "Silberstein et al.: Feeding Frenzy: Selectively Materializing Users' Event Feeds (SIGMOD, 2010)",
        "url": "https://dl.acm.org/doi/10.1145/1807167.1807257"
      }
    ]
  },
  "flash-sale-inventory-locking": {
    "title": "Flash sale inventory locking",
    "video": {
      "youtubeId": "fhdPyoO6aXI",
      "title": "System Design Interview: Design Ticketmaster w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Hello Interview's Ticketmaster design is the best-explained treatment of reserving scarce inventory under a surge: reservation holds with TTLs, avoiding row-lock contention, virtual waiting rooms and consistency. The current rate-limiter video is off-topic.",
      "length": "58:39"
    },
    "videos": [
      {
        "youtubeId": "-I4tIudkArY",
        "title": "Flash Sale Engineering",
        "channel": "Shopify Engineering",
        "role": "case-study",
        "why": "Shopify Engineering on how they survive flash sales (celebrity product drops): load testing, throttling checkout and protecting the database.",
        "length": "17:51"
      },
      {
        "youtubeId": "mka-KSHsCJo",
        "title": "Use Redis to build a business system for handling flash sales, Alibaba Cloud Ltd.",
        "channel": "Redis",
        "role": "case-study",
        "why": "Alibaba Cloud on the Redis channel: using Redis atomic operations and Lua for flash-sale stock deduction, as done for Singles' Day.",
        "length": "15:16"
      }
    ],
    "intuition": "<p>A shop has 1,000 concert tickets and 500,000 people rush the door. If every buyer has to walk to the single manager's desk to have a ticket crossed off a ledger (a row lock), the queue stretches round the block and the manager collapses. Instead, you give a greeter at the door a clicker counting down from 1,000. Anyone who gets a click gets a paper voucher and 10 minutes to pay. Everyone else is told \"sold out\" at the door.</p><p><strong>Mental model:</strong> separate the fast, atomic decision \"did you get one?\" from the slow, durable work of taking payment and creating the order, and bound how many people reach either stage.</p><ul><li><strong>Check-then-decrement in application code.</strong> Two requests both read stock = 1 and both sell. Use an atomic <code>UPDATE ... WHERE stock &gt; 0</code>, a Redis <code>DECR</code>, or a Lua script.</li><li><strong>Treating Redis as the source of truth.</strong> Redis can lose recent writes on failover. Reconcile against the database and keep a small buffer, or accept rare overselling with a refund policy.</li><li><strong>No reservation expiry.</strong> Abandoned carts lock stock forever. Holds need a TTL and a reliable release.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Flash Sale Concurrency Challenge</h2>\n      <p>During a mega flash sale (e.g. 1,000 PlayStation 5 consoles offered to 500,000 concurrent shoppers), hundreds of thousands of requests hit the inventory service in the exact same second. Traditional relational database transactions cause catastrophic failures:</p>\n      <pre><code>-- THE FLASH SALE KILLER: ROW LOCK CONVOY\nBEGIN TRANSACTION;\nSELECT stock FROM items WHERE id = 123 FOR UPDATE;\nIF stock > 0 THEN\n    UPDATE items SET stock = stock - 1 WHERE id = 123;\nEND IF;\nCOMMIT;\n      </code></pre>\n      <p>When 50,000 concurrent database connections attempt to acquire a row lock on item 123, the database connection pool exhausts in milliseconds, lock waits pile up until queries hit lock-wait timeouts, and every other query that needs a connection stalls behind the hot row.</p>\n\n      <h2>The Multi-Layer In-Memory Locking Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Traffic[\"500,000 Concurrent Buyers\"] --> RateLimit[\"1. Nginx Token Bucket Rate Limiter (Drop 80%)\"]\n    RateLimit --> App[\"2. Flash Sale Application Service\"]\n    \n    App -->|\"3. Atomic Lua Script: EVALSHA\"| Redis[(\"Redis Cluster (Single-Threaded RAM)\")]\n    \n    Redis --> StockCheck{\"Stock > 0?\"}\n    StockCheck -->|\"No\"| SoldOut[\"Return 'Sold Out' (fast path, a few ms)\"]\n    StockCheck -->|\"Yes (Atomic DECR)\"| Reserve[\"Generate Reservation Token: 'res_88192'\"]\n    \n    Reserve --> OrderQueue[(\"Kafka: order_reservations\")]\n    OrderQueue --> DBWorker[\"Asynchronous DB Worker (Batched INSERT)\"]\n    DBWorker --> Postgres[(\"PostgreSQL Orders DB\")]\n      </div>\n\n      <h2>Under the Hood: Atomic Redis Lua Script</h2>\n      <p>Redis executes Lua scripts atomically in its single-threaded event loop. No other command can execute between reading the stock and decrementing it, eliminating race conditions with zero database locks:</p>\n      <pre><code>-- Keys: 1 = item_stock_key, 2 = user_reservations_set\n-- Args: 1 = user_id\nlocal stock = tonumber(redis.call('GET', KEYS[1]) or '0')\nif stock &lt;= 0 then\n    return -1 -- Sold out\nend\nif redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then\n    return -2 -- Already reserved by this user\nend\nredis.call('DECR', KEYS[1])\nredis.call('SADD', KEYS[2], ARGV[1])\nreturn 1 -- Success: stock reserved\n      </code></pre>\n      <p><strong>Delayed Release Timer:</strong> If the user does not complete payment within 15 minutes, a delayed scheduler (Redis ZSET) automatically re-increments the Redis stock and invalidates the reservation token.</p>\n    \n<!-- enriched -->\n<h2>Worked example: funnel sizing</h2><p>1,000 units, 500,000 users arriving within 10 seconds.</p><ul><li><strong>Edge or waiting room:</strong> admit users at a controlled rate, for example 5,000 per second, and send the rest to a queue page with a position number. This protects everything behind it.</li><li><strong>Reservation step:</strong> an atomic Redis Lua script checks per-user limits and decrements stock. At 5,000 attempts per second, all 1,000 units are reserved within about 0.2 seconds of opening. After that the script just returns SOLD_OUT, at tens of thousands of operations per second on one shard.</li><li><strong>Order persistence:</strong> 1,000 reservations are written to Kafka and then batch-inserted into Postgres. That is trivial load, where 500,000 concurrent <code>SELECT ... FOR UPDATE</code> on one row would have been fatal.</li><li><strong>Payment:</strong> 10-minute holds. If 15 percent abandon, 150 units return to stock at expiry and are re-offered to the waiting room.</li></ul><h2>The atomic reservation (Redis Lua)</h2><pre><code>-- KEYS[1]=stock:{sku1}  KEYS[2]=buyers:{sku1}   ARGV[1]=user_id\nif redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return -2 end\nlocal s = tonumber(redis.call('GET', KEYS[1]) or '0')\nif s &lt;= 0 then return -1 end\nredis.call('DECR', KEYS[1])\nredis.call('SADD', KEYS[2], ARGV[1])\nreturn s - 1</code></pre><h2>Inventory strategies compared</h2><table><thead><tr><th>Strategy</th><th>Correctness</th><th>Throughput on one SKU</th><th>Complexity</th></tr></thead><tbody><tr><td>SELECT FOR UPDATE then UPDATE</td><td>Strong</td><td>Hundreds per second (serialised on one row)</td><td>Low</td></tr><tr><td>Single atomic UPDATE with WHERE stock &gt; 0</td><td>Strong</td><td>A few thousand per second (still one hot row)</td><td>Low</td></tr><tr><td>Stock split into N bucket rows</td><td>Strong</td><td>N times higher</td><td>Medium: pick buckets, rebalance near zero</td></tr><tr><td>Redis Lua counter plus async DB</td><td>Strong at Redis, with a failover risk</td><td>Tens of thousands per second or more</td><td>Medium: reconciliation</td></tr><tr><td>Pre-generated tokens in a queue</td><td>Strong: each token is claimed once</td><td>High</td><td>Medium</td></tr><tr><td>Waiting room in front of any of the above</td><td>Unchanged</td><td>Protects backends</td><td>Adds a UX component</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Alibaba's Singles' Day</strong> uses layered throttling, cached stock checks, and database hot-row optimisations (queued updates on a hot row in AliSQL).</li><li><strong>Ticketmaster's Smart Queue</strong> and <strong>Cloudflare's Waiting Room</strong> meter admission so that the inventory system only sees a manageable rate.</li><li><strong>Shopify</strong> throttles checkout per shop and load-tests flash-sale merchants ahead of drops.</li></ul>\n</div>",
    "keyTakeaways": [
      "Relational database row-level locking (FOR UPDATE) collapses under flash sales due to thread lock convoys.",
      "In-memory Redis atomic Lua scripts decrement inventory in sub-milliseconds without database contention, but Redis replication is asynchronous, so a failover can lose decrements and oversell unless counts are reconciled against the database.",
      "Successful reservations are queued asynchronously to Kafka for batched database persistence with delayed release timers."
    ],
    "furtherReading": [
      {
        "title": "Alibaba Technology: How Taobao Handles Flash Sales at 500k QPS",
        "url": "https://www.alibabacloud.com/blog/how-does-alibaba-handle-the-double-11-shopping-festival_595277"
      },
      {
        "title": "Redis Documentation: Transactions (WATCH/MULTI/EXEC)",
        "url": "https://redis.io/docs/latest/develop/using-commands/transactions/"
      },
      {
        "title": "PostgreSQL Documentation: Explicit Locking (Row-Level Locks)",
        "url": "https://www.postgresql.org/docs/current/explicit-locking.html"
      }
    ]
  }
};
