window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["design-products"] = {
  "notification-system-design": {
    "title": "Design: a notification system",
    "video": {
      "youtubeId": "J-5JozlYIqI",
      "title": "19: Notification Service | Systems Design Interview Questions With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "A tight design walkthrough covering fan-out, priority queues, deduplication, provider retries and device-token handling. The current video is a YouTube Short.",
      "length": "21:01"
    },
    "videos": [
      {
        "youtubeId": "kIP8L-CSl2Y",
        "title": "Designing Notifications Service for Instagram",
        "channel": "Arpit Bhayani",
        "role": "case-study",
        "why": "Arpit designs notifications for a real product at Instagram scale, including batching and fan-out for high-follower accounts.",
        "length": "37:18"
      },
      {
        "youtubeId": "CUwt9_l0DOg",
        "title": "Notification Service System Design Interview Question to handle Billions of users & Notifications",
        "channel": "codeKarle",
        "role": "interview",
        "why": "Clear component-by-component interview answer, including preference and rate-limiter services.",
        "length": "20:32"
      }
    ],
    "intuition": "<p>A notification system works like a big post office. Letters come in from many senders, get sorted by <strong>urgency</strong> (a password-reset code goes out today, advertising flyers can wait), are checked against the recipient's <strong>\"no junk mail\" and \"not after 10pm\" preferences</strong>, and are handed to the right carrier: Apple, Google, an SMS gateway or an email provider. Carriers sometimes lose letters or bounce them back, so the post office keeps a record, retries, and removes addresses that no longer exist.</p><p><strong>Mental model:</strong> <em>accept quickly, queue by priority, fan out asynchronously, and treat the provider as unreliable</em>. Delivery is at-least-once, so deduplication and idempotency keys matter.</p><ul><li><strong>Trap: one queue for everything.</strong> A 50-million-user marketing blast then delays one-time passcodes for an hour. Give each priority its own queues and workers.</li><li><strong>Trap: assuming a push was delivered because APNs or FCM accepted it.</strong> Acceptance is not delivery. Offline devices, collapsed messages and OS throttling all drop notifications. Use in-app inboxes for anything that must not be lost.</li><li><strong>Trap: no global frequency cap.</strong> Each team's service sends \"just one\" notification, and together they spam the user. Enforce caps centrally, per user and per channel.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Problem Statement & Scale</h2>\n      <p>A modern notification system must reliably send millions of notifications per day across diverse channels: Apple Push Notification service (APNs), Firebase Cloud Messaging (FCM), SMS (via Twilio/Sinch), and Email (via SendGrid/Amazon SES). The primary challenges include handling massive traffic spikes (e.g., breaking news alerts to 50 million users), preventing duplicate sends, respecting user opt-out and quiet-hour rate limits, and guaranteeing high delivery rates with end-to-end telemetry.</p>\n\n      <h2>End-to-End Architecture</h2>\n      <p>Notifications should never be sent synchronously on user-facing API paths. The architecture relies on decoupled, prioritized event queues:</p>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Microservices / Events\"] --> Gateway[\"Notification API Service\"]\n    Gateway --> Dedup[\"Redis Deduplication & Rate Limiter\"]\n    Dedup --> DB[(\"User Prefs & Device DB\")]\n    Dedup --> Queue[\"Kafka / SQS Topics\"]\n    Queue --> P1[\"Critical / OTP Workers\"]\n    Queue --> P2[\"Transactional Workers\"]\n    Queue --> P3[\"Marketing / Bulk Workers\"]\n    P1 --> APNS[\"Apple APNs\"]\n    P1 --> FCM[\"Google FCM\"]\n    P2 --> Twilio[\"SMS Providers\"]\n    P3 --> SES[\"Email SES / SendGrid\"]\n    APNS & FCM & Twilio & SES --> Feedback[\"Delivery Status Webhooks\"]\n    Feedback --> Analytics[(\"ClickHouse / Metrics\")]\n      </div>\n\n      <h2>Key Architectural Components</h2>\n      <ul>\n        <li><strong>API Gateway & Validation:</strong> Authenticates microservices, validates payload schemas, and issues a tracking <code>notification_id</code>.</li>\n        <li><strong>Deduplication Cache:</strong> Computes a hash of <code>userId + notificationType + idempotencyKey</code> in Redis with an expiration window (e.g., 5 minutes) to avoid sending duplicate push alerts or charging customers twice for OTP messages.</li>\n        <li><strong>User Preference & Device Token Store:</strong> Stores multi-device tokens per user (iOS, Android, Web), timezone, language preferences, and opt-out flags. Device tokens that return <code>InvalidToken</code> or <code>Unregistered</code> errors from APNs/FCM are flagged and pruned asynchronously.</li>\n        <li><strong>Priority Queuing:</strong> Separates OTP/account alerts (Priority 1) from transactional updates (Priority 2) and bulk marketing campaigns (Priority 3). Bulk notifications must never starve real-time password resets.</li>\n        <li><strong>Rate Limiting & Fatigue Control:</strong> Enforces frequency capping (e.g., at most 3 push notifications per user per hour) to prevent app uninstalls caused by notification spam.</li>\n      </ul>\n\n      <h2>Retry, Dead-Letter Queues & Fallbacks</h2>\n      <p>External gateway providers experience intermittent outages. Workers employ exponential backoff with jitter for transient errors (HTTP 429, 500, network timeouts). Non-retryable errors (e.g., invalid phone number) are routed directly to a Dead-Letter Queue (DLQ) for alerting. If a primary SMS vendor fails, traffic automatically fails over to a secondary provider.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a breaking-news push to 50 million users</h2><ul><li>Product wants delivery within 5 minutes: 50,000,000 / 300 s is about <strong>167,000 sends per second</strong>.</li><li>A fan-out job reads the audience in pages of about 10,000 device tokens, filters out opt-outs and users in quiet hours, and enqueues batches partitioned by <code>user_id</code>.</li><li>APNs uses HTTP/2, so each connection can carry many concurrent streams. If one worker sustains about 2,000 sends per second over a pool of connections, you need about <strong>85 workers</strong>. Autoscale on queue lag, and pre-warm before scheduled campaigns.</li><li>Tokens that return <code>410 Unregistered</code> (APNs) or <code>UNREGISTERED</code> (FCM) are removed from the token store. After a big send, a few percent of tokens are typically stale.</li><li>Meanwhile the OTP queue has its own workers and provider connections, so its latency stays at a few seconds.</li></ul><h2>Channel trade-offs</h2><table><thead><tr><th>Channel</th><th>Typical latency</th><th>Cost per message</th><th>Delivery guarantees</th><th>Best for</th></tr></thead><tbody><tr><td>Mobile push (APNs/FCM)</td><td>Sub-second to seconds</td><td>Free to send</td><td>Best-effort. FCM keeps up to 100 pending non-collapsible messages per device; APNs keeps only the latest per app for offline devices</td><td>Engagement, real-time alerts</td></tr><tr><td>SMS</td><td>Seconds</td><td>Highest (varies widely by country)</td><td>Carrier-dependent; delivery receipts are available</td><td>OTP, critical alerts</td></tr><tr><td>Email</td><td>Seconds to minutes</td><td>Very low</td><td>Spam filtering; bounces and complaints come back via webhooks</td><td>Receipts, digests, long content</td></tr><tr><td>In-app inbox</td><td>On next app open (or live over a WebSocket)</td><td>Your own storage</td><td>Durable in your own database</td><td>Anything that must not be lost</td></tr></tbody></table><h2>State tracking</h2><div class=\"mermaid\">flowchart LR\n  A[\"Accepted with idempotency key\"] --> B[\"Filtered by prefs, caps, quiet hours\"]\n  B --> C[\"Queued by priority\"]\n  C --> D[\"Sent to provider\"]\n  D --> E[\"Provider accepted\"]\n  E --> F[\"Delivered or opened, from receipts\"]\n  D -->|\"transient error\"| C\n  D -->|\"permanent error\"| G[\"Dead-letter queue and token cleanup\"]</div><p>Store one row per notification and channel, with its state and timestamps, in a store that handles high write volume (Cassandra, DynamoDB), and send events to an analytics store. When a support agent asks \"did the user receive the reset code?\", this table is where the answer comes from.</p>\n</div>",
    "keyTakeaways": [
      "Always decouple notification creation from delivery using message queues (Kafka/SQS).",
      "Prioritize queues: critical OTP messages must never be blocked by batch marketing pushes.",
      "Implement idempotent deduplication with Redis to avoid sending duplicate alerts on retries.",
      "Actively clean invalid device tokens reported by APNs and FCM webhooks."
    ],
    "furtherReading": [
      {
        "title": "Firebase Cloud Messaging Architectural Overview",
        "url": "https://firebase.google.com/docs/cloud-messaging"
      },
      {
        "title": "Apple Push Notification service (APNs)",
        "url": "https://developer.apple.com/documentation/usernotifications"
      }
    ]
  },
  "ticket-booking-system-design": {
    "title": "Design: a ticket booking system",
    "video": {
      "youtubeId": "fhdPyoO6aXI",
      "title": "System Design Interview: Design Ticketmaster w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "The best-known walkthrough of this exact problem: seat holds with TTLs, preventing double booking, a virtual waiting room and search. It follows the lesson's structure closely.",
      "length": "58:39"
    },
    "videos": [
      {
        "youtubeId": "sMgxHf9AU_U",
        "title": "11: Design TicketMaster/StubHub | Systems Design Interview Questions With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A second, more database-heavy take on locking and hold expiry.",
        "length": "37:21"
      },
      {
        "youtubeId": "D3XhDu--uoI",
        "title": "System Design: Concurrency Control in Distributed System | Optimistic & Pessimistic Concurrency Lock",
        "channel": "Concept && Coding - by Shrayansh",
        "role": "deep-dive",
        "why": "Detailed explanation of the optimistic and pessimistic locking mechanisms that the seat transition relies on.",
        "length": "1:04:45"
      }
    ],
    "intuition": "<p>Picture a theatre box office on the morning a hit show goes on sale. A <strong>queue outside</strong> (the waiting room) lets people in a few at a time, so the counter is not mobbed. At the counter, the clerk <strong>puts a \"held\" card on your seat</strong> for 10 minutes while you get your wallet out (the hold with a TTL). The ledger only marks a seat as sold if the card still has <em>your</em> name on it and has not expired (the conditional update).</p><p><strong>Mental model:</strong> <em>the seat row in an ACID database is the single source of truth. Every state change is a compare-and-set on that row.</em> Caches and queues around it absorb load, but they never decide who gets a seat.</p><ul><li><strong>Trap: checking availability, then booking, in two steps.</strong> Two buyers both see \"available\" and both book. The check and the write must be one atomic statement or one transaction.</li><li><strong>Trap: using a Redis TTL as the only hold.</strong> If Redis evicts or expires the key while the database still says held (or the other way round), the two disagree. Store the expiry in the database row.</li><li><strong>Trap: forgetting that payment is asynchronous.</strong> A payment can succeed after the hold expired. You need an explicit refund path, not an assumption that the timing always works out.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Core Challenge: Concurrency & Hot Spots</h2>\n      <p>Designing a high-concurrency ticket reservation platform like Ticketmaster or BookMyShow revolves around a single critical invariant: <strong>a seat must never be double-booked</strong>, even when hundreds of thousands of users attempt to purchase tickets for the same concert within seconds. At the same time, holding a seat during checkout requires a temporary reservation with an automatic timeout if payment is not completed.</p>\n\n      <h2>Reservation State Lifecycle</h2>\n      <div class=\"mermaid\">\nstateDiagram-v2\n    [*] --> Available: Event Announced\n    Available --> Held: User selects seat (10 min TTL)\n    Held --> Available: TTL expires / User cancels\n    Held --> Booked: Payment Confirmed (Atomic)\n    Booked --> [*]\n      </div>\n\n      <h2>Architectural Strategy</h2>\n      <ul>\n        <li><strong>Distributed Virtual Waiting Room:</strong> When traffic exceeds venue capacity, users are assigned a position in a distributed queue (using Cloudflare Waiting Room or Redis sorted sets) before accessing the seat selection map.</li>\n        <li><strong>Temporary Seat Hold:</strong> Give each hold a unique token, owner, and authoritative expiry. Redis may accelerate reads or expiry notifications, but a separately expiring Redis key must not be the only proof that SQL is allowed to book the seat.</li>\n        <li><strong>Database Isolation & ACID Guarantees:</strong> The authoritative conditional transition verifies the same hold token, owner, state, and unexpired deadline in an ACID-compliant database. Row-level locking or optimistic concurrency can serialize competing transitions:\n          <pre><code>UPDATE seats SET status = 'BOOKED', user_id = :userId, version = version + 1 \nWHERE seat_id = :seatId AND status = 'HELD' AND hold_token = :holdToken\n  AND hold_expires_at > CURRENT_TIMESTAMP AND version = :currentVersion;</code></pre>\n        </li>\n        <li><strong>Read Scaling with In-Memory Caches:</strong> High-volume reads of the seating chart are served from Redis bitsets or memory-cached floor plans, while write traffic routes directly through the transactional reservation service.</li>\n      </ul>\n\n      <h2>Payment Reconciliation & Webhook Callbacks</h2>\n      <p>Payment processing is asynchronous, so signed callbacks can be duplicated, delayed, or reordered. If buyer A's hold expires, buyer B may acquire the seat before A's success callback arrives. The callback must idempotently attempt the token-bound booking transition; if it loses, record the payment as unmatched and run an explicit void/refund workflow with reconciliation rather than issuing two tickets or assuming an immediate refund always succeeds.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a 50,000-seat stadium on-sale</h2><ul><li>2 million fans arrive in the first 5 minutes. Without a waiting room, seat-map requests peak at hundreds of thousands per second, on data that changes every second.</li><li>The waiting room admits 3,000 users per minute. If an average buyer takes 6 minutes, about 18,000 people are in checkout at once, a load the reservation database can easily handle.</li><li>Holds last 10 minutes. With 50,000 seats and roughly 1 in 4 holds abandoned, expired holds release seats continuously, so the seat map must refresh often (poll every few seconds, or push updates to open sessions).</li><li>Contention is highest on the best seats. The conditional <code>UPDATE ... WHERE status = 'AVAILABLE'</code> returns 0 rows for everyone except the winner, who gets the seat. Everyone else is told immediately to choose another seat.</li></ul><h2>Concurrency options</h2><table><thead><tr><th>Technique</th><th>How it works</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>Conditional update / optimistic version</td><td><code>UPDATE ... WHERE status = 'AVAILABLE' AND version = v</code></td><td>No lock held while the user thinks; scales well</td><td>Losers must retry or pick again</td></tr><tr><td>Pessimistic row lock</td><td><code>SELECT ... FOR UPDATE</code> inside a short transaction</td><td>Simple reasoning</td><td>Lock waits pile up on hot rows; never hold it across user think time</td></tr><tr><td>Distributed lock (Redis, ZooKeeper)</td><td>Lock per seat, then write to the DB</td><td>Offloads contention from the DB</td><td>Needs fencing tokens; the lock and the DB can disagree</td></tr><tr><td>Serialised per-event queue</td><td>One consumer per event partition processes seat requests in order</td><td>No races by construction</td><td>Throughput limited by one partition; adds latency</td></tr></tbody></table><h2>General admission is a counter, not seats</h2><p>For standing-room tickets, inventory is a number: <code>UPDATE inventory SET remaining = remaining - :n WHERE event_id = :e AND remaining &gt;= :n</code>. A single counter row becomes a hotspot at thousands of updates per second. Split it into, say, 20 sub-counters of 2,500 tickets each, pick one at random, and fall back to the others when it runs out. This is the same idea as sharded counters.</p><h2>Fairness and bots</h2><ul><li>Randomise positions for everyone who arrives before the on-sale time, so refreshing early gives no advantage. Ticketmaster and Cloudflare Waiting Room both do this.</li><li>Limit tickets per account and per payment card, and require verified accounts for high-demand events (Ticketmaster Verified Fan).</li><li>Issue signed, expiring entry tokens from the waiting room, so bots cannot skip the queue by calling the checkout API directly.</li></ul>\n</div>",
    "keyTakeaways": [
      "Keep hold token, owner, and expiry in the authoritative conditional booking transition; use Redis only as a cache or accelerator unless it shares that authority safely.",
      "Deploy a virtual waiting room in front of checkout to flatten extreme traffic spikes.",
      "Use optimistic locking or atomic compare-and-swap to prevent race conditions during seat claims.",
      "Implement automated reconciliation for out-of-order or delayed payment gateway callbacks."
    ],
    "furtherReading": [
      {
        "title": "Martin Fowler: Optimistic Offline Lock Pattern",
        "url": "https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html"
      },
      {
        "title": "High-concurrency ticket booking architecture patterns",
        "url": "https://aws.amazon.com/blogs/architecture/"
      }
    ]
  },
  "payment-system-design": {
    "title": "Design: a payment system",
    "video": {
      "youtubeId": "olfaBgJrUBI",
      "title": "Design a Payment System - System Design Interview",
      "channel": "Code with Lucian",
      "why": "Kept: a well-regarded walkthrough of payment service, PSP integration, ledger, wallet and reconciliation, closely matching the lesson.",
      "length": "31:40"
    },
    "videos": [
      {
        "youtubeId": "m6DtqSb1BDM",
        "title": "Build a robust Payments service using Idempotency Keys",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Detailed look at the idempotency-key pattern, the lesson's central mechanism, including the unknown-outcome case.",
        "length": "16:36"
      },
      {
        "youtubeId": "u2O-QS-A7jo",
        "title": "Webhooks at scale: best practices and lessons learned",
        "channel": "Stripe Developers",
        "role": "case-study",
        "why": "Stripe engineers on handling webhooks that arrive late, twice or out of order. Payment state recovery depends on getting this right.",
        "length": "31:25"
      }
    ],
    "intuition": "<p>Handling payments is like being a careful bank clerk with carbon-copy forms. Every transfer is written as <strong>two matching lines</strong>, money out of one account and money into another, so the books always balance. Mistakes are never rubbed out; you write a correcting entry. If the phone line to the other bank drops mid-call, you do not simply try again with a new form. You call back quoting the <strong>same reference number</strong>, so they can tell you whether it already went through.</p><p><strong>Mental model:</strong> <em>idempotency keys make retries safe, the double-entry ledger makes balances provable, and reconciliation catches whatever the first two missed.</em></p><ul><li><strong>Trap: floating-point money.</strong> 0.1 + 0.2 is not 0.3 in floating point. Store integer minor units (cents) together with an ISO currency code.</li><li><strong>Trap: treating a timeout as a failure.</strong> The PSP may have charged the card. Mark the payment UNKNOWN, then query the PSP or wait for its webhook. Never charge again with a fresh key.</li><li><strong>Trap: a mutable balance column as the source of truth.</strong> Balances should be derived from, or checked against, the immutable ledger. A balance you can overwrite cannot be audited.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Foundational Requirements: Idempotent Operations & Double-Entry</h2>\n      <p>Financial systems operate under zero-tolerance constraints for data loss or incorrect balances. A production payment system must guarantee:</p>\n      <ul>\n        <li><strong>Idempotency:</strong> Retries of one intended payment use the same operation key and payload. Local uniqueness prevents duplicate local operations; preventing duplicate external charges additionally depends on the PSP's idempotency contract and reconciliation.</li>\n        <li><strong>Double-Entry Bookkeeping:</strong> Every financial transaction must record equal and offsetting debits and credits across balance sheet accounts. Money is never created or destroyed; money only moves between accounts.</li>\n        <li><strong>Auditability & Immutability:</strong> Ledger entries are append-only. Mistakes are corrected by recording reversing journal entries, never by mutating or deleting past records.</li>\n      </ul>\n\n      <h2>Payment Flow Architecture</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    Buyer[\"Buyer App\"] --> PayAPI[\"Payment Service\"]\n    PayAPI --> Idemp[\"Idempotency Check\"]\n    Idemp --> PSP[\"Payment Service Provider: Stripe / Adyen\"]\n    PSP --> PayAPI\n    PayAPI --> Ledger[(\"Double-Entry Ledger DB\")]\n    PayAPI --> Rec[\"Reconciliation Engine\"]\n    BankSettlement[\"Bank Settlement Files\"] --> Rec\n      </div>\n\n      <h2>Idempotency Execution Pattern</h2>\n      <p>Clients generate a cryptographically unique <code>Idempotency-Key</code> (UUID v4) for every checkout attempt. When the request reaches the payment gateway:</p>\n      <ol>\n        <li>An atomic database transaction creates a payment record in <code>PENDING</code> status indexed by the idempotency key. If a row already exists, the gateway returns the existing status without charging again.</li>\n        <li>After committing the local operation, the service calls the PSP with the same stable key and frozen payload. It does not hold a database transaction open across the network call.</li>\n        <li>If authorization is confirmed, a local transaction records <code>SUCCEEDED</code> and the corresponding ledger rows. If the call times out, retain <code>UNKNOWN</code>: the PSP may have charged the customer even though no reply arrived. Recover by repeating the identical provider operation where its contract permits, querying provider state, processing signed webhooks idempotently, and reconciling settlement data.</li>\n      </ol>\n\n      <h2>Nightly Reconciliation & Settlement</h2>\n      <p>External PSPs and acquiring banks transmit end-of-day settlement batch files. The internal <strong>Reconciliation Engine</strong> matches internal ledger journal entries against the bank statement transactions. Any discrepancy (missed charge, chargeback, foreign exchange difference) triggers automated alerting and dispute queues for accounting review.</p>\n    \n<!-- enriched -->\n<h2>Worked example: ledger entries for one card payment</h2><p>A merchant sells a 100.00 USD order. The PSP fee is 2.9% + 0.30, so 3.20 USD, and the PSP pays out the net amount. Amounts are stored in integer cents.</p><table><thead><tr><th>Journal entry</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody><tr><td rowspan=\"3\">Capture</td><td>PSP receivable (asset)</td><td>9680</td><td></td></tr><tr><td>Processing fees (expense)</td><td>320</td><td></td></tr><tr><td>Sales revenue</td><td></td><td>10000</td></tr><tr><td rowspan=\"2\">Payout (T+2)</td><td>Bank cash</td><td>9680</td><td></td></tr><tr><td>PSP receivable</td><td></td><td>9680</td></tr><tr><td rowspan=\"2\">Refund of 20.00</td><td>Sales returns (contra-revenue)</td><td>2000</td><td></td></tr><tr><td>PSP receivable (netted from the next payout)</td><td></td><td>2000</td></tr></tbody></table><p>In every journal entry, debits equal credits. A nightly check that each entry balances, plus matching the PSP receivable balance against the payout and settlement files, catches most bugs. Whether the original fee is returned on a refund depends on the PSP's pricing, which is one more line the reconciliation must check.</p><h2>Payment state machine</h2><div class=\"mermaid\">flowchart LR\n  C[\"CREATED\"] --> P[\"PENDING at PSP\"]\n  P --> A[\"AUTHORIZED\"]\n  P --> F[\"FAILED\"]\n  P --> U[\"UNKNOWN after timeout\"]\n  U -->|\"query PSP or webhook\"| A\n  U -->|\"query PSP or webhook\"| F\n  A --> K[\"CAPTURED\"]\n  A -->|\"expires or voided\"| V[\"VOIDED\"]\n  K --> S[\"SETTLED\"]\n  K --> R[\"REFUNDED or partially refunded\"]</div><p>Card authorisations usually expire after about 7 days (this varies by network and merchant category), so a capture must happen before then or the hold on the customer's funds lapses. Only move between states along allowed transitions, using a conditional update, the same pattern as seat booking.</p><h2>Reconciliation example</h2><table><thead><tr><th>Finding</th><th>Likely cause</th><th>Action</th></tr></thead><tbody><tr><td>In the PSP file, missing from the ledger</td><td>Timeout left the payment UNKNOWN, and the webhook was lost</td><td>Create ledger entries from the PSP record, and mark the order paid</td></tr><tr><td>In the ledger, missing from the PSP file</td><td>Capture never actually happened, or will settle in the next batch</td><td>Recheck the next day, then investigate</td></tr><tr><td>Amount differs</td><td>FX conversion, fee change, partial capture</td><td>Post an adjustment entry</td></tr><tr><td>Chargeback line</td><td>Customer disputed the payment with their bank</td><td>Open a dispute case, and reverse the merchant payable</td></tr></tbody></table><p>Stripe keeps idempotency keys for at least 24 hours and returns the original response for any repeated request with the same key. Your own idempotency table should keep keys at least as long as the longest client retry window.</p>\n</div>",
    "keyTakeaways": [
      "Every financial mutation must use double-entry ledger mechanics: Sum(Debits) == Sum(Credits).",
      "Use stable operation identities end to end, but verify each external provider's idempotency window and changed-payload behavior.",
      "Never mutate ledger records; use compensating transactions to correct errors.",
      "Asynchronous nightly reconciliation is required to verify internal records against external bank settlement files."
    ],
    "furtherReading": [
      {
        "title": "Stripe Engineering: Designing Robust and Idempotent APIs",
        "url": "https://stripe.com/blog/idempotency"
      },
      {
        "title": "Double-Entry Bookkeeping Principles for Engineers",
        "url": "https://en.wikipedia.org/wiki/Double-entry_bookkeeping"
      }
    ]
  },
  "search-engine-system-design": {
    "title": "Design: a search service",
    "video": {
      "youtubeId": "l38XL9914fs",
      "title": "Design FB Post Search: System Design Interview breakdown w/ ex Meta Interviewer",
      "channel": "Hello Interview",
      "why": "A full design of a search service: ingestion, the inverted index, sharding, ranking and freshness. The current video is about autocomplete, a different problem.",
      "length": "1:08:27"
    },
    "videos": [
      {
        "youtubeId": "iHHqnyThrqE",
        "title": "Inverted Index - The Data Structure Behind Search Engines",
        "channel": "Arpit Bhayani",
        "role": "deep-dive",
        "why": "Clear deep dive into posting lists and intersecting them, the core data structure of the lesson.",
        "length": "14:45"
      },
      {
        "youtubeId": "PuZvF2EyfBM",
        "title": "Elasticsearch Deep Dive w/ a Ex-Meta Senior Manager for System Design Interviews",
        "channel": "Hello Interview",
        "role": "deep-dive",
        "why": "How a production engine (Lucene and Elasticsearch) implements shards, segments, refresh and scoring.",
        "length": "44:03"
      }
    ],
    "intuition": "<p>An inverted index is the index at the back of a textbook. You do not read all 800 pages to find \"consensus\". You look up the word and it lists pages 112, 140 and 388. For \"consensus AND leader\", you take both page lists and keep the pages that appear in both. <strong>Ranking</strong> then decides which of those pages to show first: pages where the word appears several times in a short section beat a single passing mention in a long chapter, and rare words count for more than common ones.</p><p><strong>Mental model:</strong> <em>indexing does the expensive work up front (tokenise, build term-to-document lists); a query just looks up and merges lists, then scores the top candidates.</em></p><ul><li><strong>Trap: using SQL <code>LIKE '%term%'</code>.</strong> A leading wildcard cannot use a B-tree index, so every row is scanned. Use full-text indexes (Postgres <code>tsvector</code> with GIN) or a search engine.</li><li><strong>Trap: expecting a document to be searchable the moment it is written.</strong> Lucene-based engines only make new documents visible after a refresh (1 s by default in Elasticsearch). Read your own writes from the database if the user needs to see them immediately.</li><li><strong>Trap: fanning out to too many shards.</strong> A query waits for the slowest shard. More shards means worse tail latency.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Search Service Architecture Overview</h2>\n      <p>A production search service (like Elasticsearch, Solr, or internal enterprise search) consists of two decoupled subsystems: the <strong>Write/Indexing Pipeline</strong> and the <strong>Read/Query & Ranking Engine</strong>. The goal is to ingest documents, extract terms, compute relevance, and serve full-text queries in under 50 milliseconds across billions of documents.</p>\n\n      <h2>Indexing & Query Flow</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Doc[\"Raw Documents / Database\"] --> Parser[\"Text Tokenizer & Stemmer\"]\n    Parser --> InvertedIndex[(\"Inverted Index & Posting Lists\")]\n    Client[\"Search Query\"] --> QParser[\"Query Analyzer\"]\n    QParser --> Coordinator[\"Search Coordinator Node\"]\n    Coordinator --> S1[\"Shard 1\"]\n    Coordinator --> S2[\"Shard 2\"]\n    Coordinator --> S3[\"Shard 3\"]\n    S1 & S2 & S3 --> Aggregator[\"Merge & BM25 Scoring\"]\n    Aggregator --> Ranking[\"ML Re-ranking / Personalization\"]\n    Ranking --> Response[\"Top K Results\"]\n      </div>\n\n      <h2>Inverted Index & Posting Lists</h2>\n      <p>Rather than scanning records sequentially, search engines build an inverted index mapping each tokenized word to a sorted list of document IDs (called a <strong>posting list</strong>):</p>\n      <pre><code>\"distributed\" -> [Doc1, Doc4, Doc12, Doc98]\n\"systems\"     -> [Doc2, Doc4, Doc15, Doc98]</code></pre>\n      <p>Boolean conjunction queries (<code>distributed AND systems</code>) intersect sorted posting lists in O(N + M) time using skip lists or bitset operations.</p>\n\n      <h2>Relevance Scoring: BM25</h2>\n      <p>Relevance ranking evaluates how well a document matches a query based on Best Matching 25 (BM25), balancing:</p>\n      <ul>\n        <li><strong>Term Frequency (TF):</strong> How often the term appears in the document (with diminishing returns).</li>\n        <li><strong>Inverse Document Frequency (IDF):</strong> How rare the term is across the entire corpus (common words like \"the\" receive low weight).</li>\n        <li><strong>Field-Length Normalization:</strong> Term frequency is normalized by document length relative to the average (BM25's b parameter), so the same match counts for more in a short document than in a long one.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: BM25 inverse document frequency</h2><p>The corpus has N = 1,000,000 documents. Lucene's BM25 IDF is <code>ln(1 + (N - n + 0.5) / (n + 0.5))</code>, where n is the number of documents containing the term.</p><ul><li>\"kafka\" appears in n = 1,000 documents: <code>ln(1 + 999000.5 / 1000.5)</code>, which is about <code>ln(1000)</code>, about <strong>6.9</strong>.</li><li>\"system\" appears in n = 400,000 documents: <code>ln(1 + 600000.5 / 400000.5)</code>, which is <code>ln(2.5)</code>, about <strong>0.92</strong>.</li><li>\"the\" appears in n = 950,000 documents: about <code>ln(1.053)</code>, about <strong>0.05</strong>, which is effectively noise.</li></ul><p>The term-frequency part saturates. With Lucene's defaults k1 = 1.2 and b = 0.75, a term appearing 10 times scores only about 2 times as much as appearing once in a document of average length. Longer-than-average documents are damped by the b parameter. So a match on \"kafka\" is worth about 7 times a match on \"system\", no matter how often \"system\" repeats.</p><h2>How to partition the index</h2><table><thead><tr><th>Strategy</th><th>Query path</th><th>Write path</th><th>Used by</th></tr></thead><tbody><tr><td>Document-partitioned (each shard indexes a subset of documents)</td><td>Scatter to every shard, gather top K from each, merge</td><td>Each document goes to one shard</td><td>Elasticsearch, Solr, most production systems</td></tr><tr><td>Term-partitioned (each shard owns some terms)</td><td>Only the shards holding the query's terms</td><td>One document updates many shards</td><td>Rare; research systems and some early web search engines</td></tr><tr><td>Tiered (a small fresh index plus a large base index)</td><td>Query both and merge</td><td>New documents go to the fresh tier</td><td>Web search engines, Twitter's Earlybird real-time index</td></tr></tbody></table><h2>Latency budget and tail behaviour</h2><p>Suppose each of 20 shards has a p99 of 40 ms. The chance that at least one of the 20 is slower than its p99 is <code>1 - 0.99^20</code>, about 18%, so the query's p99 is much worse than any one shard's. Mitigations:</p><ul><li>Fewer, larger shards (Elastic suggests 10 to 50 GB per shard).</li><li>Replicas, with adaptive replica selection that routes to the least-loaded copy.</li><li>Hedged requests: after about the p95 wait time, send a duplicate request to another replica and take whichever answers first.</li><li>Return partial results with a timeout rather than failing the whole query.</li></ul><h2>Pipeline</h2><div class=\"mermaid\">flowchart LR\n  S[(\"Source DB\")] --> CDC[\"CDC stream\"]\n  CDC --> AN[\"Analyzer: tokenize, lowercase, stem, synonyms\"]\n  AN --> IX[\"Indexer writes segments\"]\n  IX --> SH[(\"Shards and replicas\")]\n  Q[\"Query\"] --> QA[\"Same analyzer\"]\n  QA --> SH\n  SH --> RR[\"Top 1000 by BM25, then ML re-rank to top 20\"]</div><p>The query must go through the <strong>same analyzer</strong> used at index time. If documents were stemmed (\"running\" became \"run\") but the query was not, nothing matches.</p>\n</div>",
    "keyTakeaways": [
      "Decouple the asynchronous indexing pipeline from the read/query coordinator tier.",
      "An inverted index with sorted posting lists powers sub-50ms multi-term queries.",
      "BM25 scoring combines term frequency, inverse document frequency, and length normalization.",
      "Shard indexes by document ID and use scatter-gather coordinator nodes to query shards in parallel."
    ],
    "furtherReading": [
      {
        "title": "Information Retrieval & BM25 Formulation",
        "url": "https://en.wikipedia.org/wiki/Okapi_BM25"
      },
      {
        "title": "Elasticsearch: From the Bottom Up",
        "url": "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html"
      }
    ]
  },
  "recommendation-system-design": {
    "title": "Design: a recommendation system",
    "video": {
      "youtubeId": "QrZTmiZSRcw",
      "title": "22: Recommendation Engine (YouTube, TikTok) | Systems Design Interview Questions With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "A systems-focused design of candidate generation, feature stores, ranking and serving, the multi-stage funnel this lesson teaches. The current CS50 lecture covers the ML theory, not the system.",
      "length": "43:30"
    },
    "videos": [
      {
        "youtubeId": "GncgOIiMII8",
        "title": "Recommendation System Infra Basics 1",
        "channel": "Hello Interview",
        "role": "intro",
        "why": "Short, clear primer on the retrieval-then-ranking infrastructure.",
        "length": "9:44"
      },
      {
        "youtubeId": "7_E4wnZGJKo",
        "title": "Instagram ML Question - Design a Ranking Model (Full Mock Interview with Senior Meta ML Engineer)",
        "channel": "Aced (formerly Exponent)",
        "role": "interview",
        "why": "A Meta ML engineer works through the ranking stage in depth: labels, features, multi-task objectives and evaluation.",
        "length": "48:20"
      }
    ],
    "intuition": "<p>A recommender works like a good bookshop assistant. They cannot read all 10 million books every time you walk in. First they <strong>grab a stack of about 1,000</strong> that might suit you: books similar to ones you have bought, bestsellers in your genres, what people like you are reading (<em>candidate generation</em>). Then they <strong>read the back cover of each one carefully</strong> with you in mind, and pick the best 50 (<em>ranking</em>). Finally they make sure the pile is not all by the same author and includes one wildcard (<em>re-ranking for diversity and exploration</em>).</p><p><strong>Mental model:</strong> <em>each stage is cheaper per item but sees more items than the stage after it. Retrieval optimises recall, ranking optimises precision, and re-ranking applies business rules.</em></p><ul><li><strong>Trap: training/serving skew.</strong> Features computed one way in the offline pipeline and another way online quietly damage the model. Use one feature definition, for example via a feature store.</li><li><strong>Trap: optimising clicks alone.</strong> Clickbait wins. Mix in dwell time, long-term satisfaction, \"not interested\" signals and survey responses.</li><li><strong>Trap: forgetting cold start.</strong> New users and new items have no history. Fall back to popularity, content embeddings and explicit exploration.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Two-Stage Recommendation Funnel</h2>\n      <p>Large-scale recommendation platforms (YouTube, Netflix, TikTok, Instagram) cannot run complex deep learning models over their entire catalog of millions of items in real time. Instead, industry systems use a multi-stage funnel:</p>\n\n      <div class=\"mermaid\">\nflowchart TD\n    Corpus[\"Entire Catalog: 10M+ Items\"] --> CandGen[\"Candidate Generation / Retrieval: Top 1,000\"]\n    CandGen --> Filtering[\"Hard Filters: Geo, Language, Watched\"]\n    Filtering --> Ranking[\"Heavy ML Scoring / Ranking: Top 50\"]\n    Ranking --> ReRank[\"Diversity, Freshness & Business Rules: Top 10\"]\n    ReRank --> User[\"User Feed\"]\n      </div>\n\n      <h2>Candidate Generation (Fast Retrieval)</h2>\n      <p>Reduces the candidate pool from millions down to hundreds using lightweight retrieval models:</p>\n      <ul>\n        <li><strong>Vector Embeddings & Approximate Nearest Neighbors (ANN):</strong> User history and items are mapped into dense vector spaces (using two-tower neural networks). High-speed vector indexes (Faiss, HNSW, Milvus) retrieve the top K nearest items in low single-digit milliseconds.</li>\n        <li><strong>Collaborative Filtering & Graph Walk:</strong> Recommends items interacted with by users with similar historical engagement patterns.</li>\n      </ul>\n\n      <h2>Deep Ranking & Scoring</h2>\n      <p>The candidate set passes to a heavier ranking model that evaluates hundreds of real-time features: user demographics, current device, time of day, context, and explicit interaction history. The model predicts probabilities of engagement: P(Click), P(WatchTime > 30s), and P(Like).</p>\n\n      <h2>Exploration vs. Exploitation</h2>\n      <p>A pure exploitation model traps users in filter bubbles. Production architectures introduce multi-armed bandit algorithms (e.g., Thompson Sampling or Upper Confidence Bound) to blend new or unrated content into the feed to gather engagement data.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a 100 ms latency budget</h2><table><thead><tr><th>Stage</th><th>Input to output</th><th>Budget</th><th>Typical technique</th></tr></thead><tbody><tr><td>Candidate retrieval</td><td>10M to about 1,500 (several sources merged)</td><td>15 ms</td><td>Two-tower embeddings with ANN (HNSW, ScaNN, Faiss IVF-PQ), co-visitation lists, followed creators</td></tr><tr><td>Filtering</td><td>1,500 to 1,000</td><td>5 ms</td><td>Already seen, blocked, region or age restrictions, via Bloom filters or lookups</td></tr><tr><td>Feature fetch</td><td>1,000 items x about 200 features</td><td>20 ms</td><td>Online feature store (Redis, Cassandra) with batched reads</td></tr><tr><td>Ranking</td><td>1,000 to top 100</td><td>40 ms</td><td>Deep model (for example DLRM or a multi-task network) scored in batches on GPU or CPU</td></tr><tr><td>Re-ranking</td><td>100 to 20 shown</td><td>5 ms</td><td>Diversity (for example maximal marginal relevance), freshness boost, ads insertion, exploration slots</td></tr></tbody></table><h2>Sizing the retrieval index</h2><ul><li>10 million items x 128-dimensional float32 embeddings is 10M x 512 B, about <strong>5 GB</strong>. It fits in RAM on one node, and replicas are added for query throughput.</li><li>HNSW typically reaches 90 to 98% recall@100 in a few milliseconds. Its graph links add memory on top of the raw vectors, roughly 25 to 50% more with common settings. Product quantisation shrinks vectors 8 to 32 times with some recall loss, which lets billion-item indexes fit in memory.</li><li>The item tower is recomputed offline, often daily, and the index rebuilt. The user tower runs online, using the user's latest actions, so recommendations react within the same session.</li></ul><h2>Architecture</h2><div class=\"mermaid\">flowchart LR\n  EV[\"User events stream\"] --> FS[(\"Feature store: online and offline\")]\n  EV --> TR[\"Training pipeline, daily and streaming\"]\n  TR --> MR[\"Model registry\"]\n  MR --> RK[\"Ranking service\"]\n  TR --> EMB[\"Item embeddings\"]\n  EMB --> ANN[(\"ANN index\")]\n  REQ[\"Feed request\"] --> ANN\n  ANN --> RK\n  FS --> RK\n  RK --> RR[\"Re-rank and log impressions\"]\n  RR --> EV</div><p>Log <strong>impressions</strong> (what was shown and in which position), not just clicks. Without them you cannot train on negatives, and you cannot correct for <em>position bias</em>: items at the top get clicked more simply because they are at the top. YouTube's 2016 paper \"Deep Neural Networks for YouTube Recommendations\" describes this two-stage design. TikTok's Monolith paper (2022) describes real-time training with collisionless embedding tables.</p>\n</div>",
    "keyTakeaways": [
      "Structure recommendations as a funnel: Candidate Generation (Retrieval) -> Scoring (Ranking) -> Diversity Re-ranking.",
      "Use vector embeddings with Approximate Nearest Neighbor (ANN) search for millisecond candidate retrieval.",
      "Balance exploitation of known interests with exploration of new content using multi-armed bandits.",
      "Incorporate real-time context (time of day, network speed, battery level) into ranking layers."
    ],
    "furtherReading": [
      {
        "title": "Deep Neural Networks for YouTube Recommendations (Covington et al.)",
        "url": "https://research.google/pubs/pub45530/"
      },
      {
        "title": "Faiss: A Library for Efficient Similarity Search",
        "url": "https://github.com/facebookresearch/faiss"
      }
    ]
  },
  "chat-and-messaging-system-design": {
    "title": "Design: chat and messaging",
    "video": {
      "youtubeId": "cr6p0n0N-VA",
      "title": "Design Whatsapp: System Design Interview w/ a Ex-Meta Senior Manager",
      "channel": "Hello Interview",
      "why": "Kept: a thorough design of connection gateways, routing, offline inboxes, receipts and group fan-out. It covers the lesson almost point for point.",
      "length": "58:12"
    },
    "videos": [
      {
        "youtubeId": "O3PwuzCvAjI",
        "title": "How Discord Stores TRILLIONS of Messages",
        "channel": "ByteByteGo",
        "role": "case-study",
        "why": "Real-world storage case study: Discord's move from Cassandra to ScyllaDB, with channel and time-bucket partitioning.",
        "length": "7:11"
      },
      {
        "youtubeId": "vvhC64hQZMk",
        "title": "WHATSAPP System Design: Chat Messaging Systems for Interviews",
        "channel": "Gaurav Sen",
        "role": "interview",
        "why": "A classic and very clear alternative walkthrough of the same problem.",
        "length": "25:15"
      }
    ],
    "intuition": "<p>A chat system is like a postal service where every home has a <strong>pneumatic tube</strong> straight to the local sorting office (a persistent WebSocket). When you send a note, the office looks up which sorting office your friend's tube is connected to (the connection registry). If they are home, the note shoots straight down their tube. If not, it waits in their <strong>PO box</strong> (the offline inbox), and a doorbell rings on their phone (the push notification). When they get home, they say \"the last note I got was number 41\" and receive 42 onward.</p><p><strong>Mental model:</strong> <em>store first, then deliver. Order messages with a per-conversation sequence number. Sync by cursor on reconnect.</em></p><ul><li><strong>Trap: relying on the socket for delivery.</strong> A message sent over a socket that dies a moment later is lost unless it was persisted and the recipient acknowledges it. Receipts are acknowledgements tracked by the application, not TCP ACKs.</li><li><strong>Trap: auto-increment IDs in a distributed store.</strong> Cassandra has no auto-increment. Use Snowflake-style time-ordered IDs, or a per-conversation sequencer.</li><li><strong>Trap: fanning out to 100,000-member channels on write.</strong> Large channels should be read from a shared, channel-partitioned log. Per-member inbox copies are only for small groups.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Key Functional Requirements</h2>\n      <p>A massive chat system (like WhatsApp, Discord, or Slack) must deliver 1-on-1 and group messages with sub-second latency, support offline delivery, provide accurate delivery receipts (Sent, Delivered, Read), and handle bidirectional connections at scale.</p>\n\n      <h2>Connection Management Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    UserA[\"User A Phone\"] &lt;-->|WebSocket| ConnServer[\"Gateway / Connection Manager\"]\n    ConnServer &lt;--> Presence[\"Presence Service & Redis Cluster\"]\n    ConnServer --> MessageRouter[\"Message Routing Service\"]\n    MessageRouter --> MessageStore[(\"NoSQL Message Store: Cassandra / ScyllaDB\")]\n    MessageRouter --> UserBOnline{\"Is User B Online?\"}\n    UserBOnline -->|Yes| ConnServerB[\"Connection Manager B\"]\n    ConnServerB &lt;-->|WebSocket| UserB[\"User B Phone\"]\n    UserBOnline -->|No| PushQueue[\"Push Notification Queue\"]\n    PushQueue --> APNS_FCM[\"APNs / FCM\"]\n      </div>\n\n      <h2>Stateful WebSockets & Gateway Tier</h2>\n      <p>HTTP polling introduces unacceptable overhead. Clients maintain persistent, stateful WebSocket or TCP connections. A centralized <strong>Connection Registry</strong> (often implemented using Redis or distributed hash tables) maps each <code>userId</code> to the specific gateway server IP currently hosting their active socket connection.</p>\n\n      <h2>Handling Offline Messages</h2>\n      <p>When User A sends a message to User B:</p>\n      <ol>\n        <li>The Message Router writes the message to an append-optimized distributed store (such as Cassandra or ScyllaDB) with a monotonic sequence ID per conversation, assigned by a per-conversation sequencer or a Snowflake-style generator (Cassandra and ScyllaDB have no auto-increment).</li>\n        <li>The router checks the connection registry. If User B is offline, the message is queued for offline delivery and a push notification is dispatched via APNs/FCM.</li>\n        <li>When User B reconnects, their client sends their last received message ID; the gateway queries the store for all subsequent messages and synchronizes them in order.</li>\n      </ol>\n\n      <h2>Group Chat Scaling: Fan-out Strategy</h2>\n      <p>For small group chats (e.g., up to 1,024 members in WhatsApp), the message router fans out a copy to each recipient's inbox queue. For large group channels (e.g., 100,000 members in Discord), fan-out-on-write is too expensive; instead, channels use shared pub/sub event streams where clients pull from a single channel partition.</p>\n    \n<!-- enriched -->\n<h2>Worked example: connection and message scale</h2><ul><li>100 million concurrently connected clients. If each gateway server holds about 500,000 sockets (feasible with epoll or kqueue and small per-connection buffers), you need about <strong>200 gateway servers</strong> plus headroom for rolling restarts. WhatsApp famously reported more than 2 million connections on a single Erlang server in 2012.</li><li>Heartbeats every 30 s from 100 million clients produce about 3.3 million small packets per second on their own. This is why mobile clients stretch keepalive intervals and rely on push when the app is in the background.</li><li>20 billion messages per day is about 230,000 per second on average. At about 200 B each with metadata, that is about 4 TB per day before replication. It goes in a wide-column store partitioned by <code>(conversation_id, time_bucket)</code>, so no single partition grows without bound. Discord uses channel ID plus a 10-day bucket.</li></ul><h2>Fan-out by group size</h2><table><thead><tr><th>Conversation type</th><th>Write strategy</th><th>Read strategy</th><th>Example</th></tr></thead><tbody><tr><td>1:1</td><td>Store once, then deliver to the recipient's gateway or push</td><td>Read the conversation partition since the cursor</td><td>WhatsApp, iMessage</td></tr><tr><td>Small group (up to about 1,000)</td><td>Store once, route to each online member's gateway</td><td>Each member syncs from their cursor</td><td>WhatsApp groups (limit raised to 1,024 members in 2022)</td></tr><tr><td>Large channel or server</td><td>Store once in the channel log, publish to a pub/sub topic</td><td>Online clients subscribe; others load recent history on open</td><td>Discord, Slack large channels</td></tr><tr><td>Broadcast</td><td>Store once; notify lazily</td><td>Pull on open</td><td>Telegram channels</td></tr></tbody></table><h2>Message lifecycle and receipts</h2><div class=\"mermaid\">sequenceDiagram\n  participant A as Sender app\n  participant G1 as Gateway A\n  participant R as Router and store\n  participant G2 as Gateway B\n  participant B as Recipient app\n  A->>G1: send msg with client_msg_id\n  G1->>R: persist, assign seq 42\n  R-->>A: ack, single tick\n  R->>G2: deliver seq 42\n  G2->>B: push over socket\n  B-->>R: delivered 42, double tick\n  B-->>R: read up to 42, blue ticks</div><p>The <code>client_msg_id</code> makes resends idempotent. If the sender's network drops before the acknowledgement arrives, the retry is deduplicated rather than stored twice. With end-to-end encryption (the Signal protocol, used by WhatsApp), the server stores and routes only ciphertext. Group messages use sender keys, so a sender encrypts once rather than once per member.</p>\n</div>",
    "keyTakeaways": [
      "Maintain persistent stateful WebSocket connections for low-latency bidirectional message delivery.",
      "Store connection location metadata (User -> Gateway Server IP) in a centralized, low-latency Redis cluster.",
      "Persist messages in append-optimized wide-column databases (Cassandra/ScyllaDB) partitioned by chat/channel ID.",
      "Use fan-out-on-write for personal and small group chats; use pub/sub channels for massive group rooms."
    ],
    "furtherReading": [
      {
        "title": "How Discord Stores Billions of Messages",
        "url": "https://discord.com/blog/how-discord-stores-billions-of-messages"
      },
      {
        "title": "WhatsApp Architecture Breakdown",
        "url": "https://highscalability.com/the-whatsapp-architecture-facebook-bought-for-19-billion/"
      }
    ]
  },
  "social-feed-system-design-case-study": {
    "title": "Design: a social feed",
    "video": {
      "youtubeId": "Qj4-GruzyDU",
      "title": "Design FB News Feed System Design Interview w/ ex: Meta Senior Manager",
      "channel": "Hello Interview",
      "why": "Compact, focused treatment of fan-out on write vs read and the hybrid for high-follower accounts, which is the core dilemma of this lesson.",
      "length": "26:12"
    },
    "videos": [
      {
        "youtubeId": "FEkXjNFrL1o",
        "title": "Twitter Timeline Architecture |  Fanout | System Design",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "A quick visual explanation of how Twitter actually fanned out tweets into Redis timelines.",
        "length": "5:43"
      },
      {
        "youtubeId": "Nfa-uUHuFHg",
        "title": "System Design Interview Walkthrough: Design Twitter",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "The previously used video. A good broader Twitter design that includes the feed.",
        "length": "23:04"
      }
    ],
    "intuition": "<p>Think about delivering newspapers. <strong>Fan-out on write</strong> is a paperboy who drops a copy on every subscriber's doorstep the moment the paper is printed. Reading is instant, but a paper with 80 million subscribers takes forever to deliver. <strong>Fan-out on read</strong> is everyone walking to each publisher's kiosk every morning. Publishing costs nothing, but reading is slow when you follow 500 publications. The <strong>hybrid</strong> delivers papers from ordinary publishers to your doorstep and has you pick up the few celebrity papers yourself at read time.</p><p><strong>Mental model:</strong> <em>precompute where writes are cheap relative to reads. Merge at read time where one write would fan out to millions of followers.</em></p><ul><li><strong>Trap: fanning out to inactive users.</strong> Most followers of a big account have not opened the app this week. Skip or delay fan-out for inactive users, and rebuild their feed when they return.</li><li><strong>Trap: storing whole posts in each timeline.</strong> Timelines hold post IDs only. Posts are fetched in batches from a post cache (hydration), so edits and deletes show up everywhere.</li><li><strong>Trap: offset pagination on a feed that keeps changing.</strong> New posts shift offsets and cause duplicates or gaps. Use a cursor such as the last seen score and ID.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Core Architectural Dilemma: Fan-out on Write vs. Fan-out on Read</h2>\n      <p>When designing news feeds (Twitter/X, Facebook, LinkedIn), the fundamental architectural choice is how and when to assemble the timeline for each user.</p>\n\n      <div class=\"mermaid\">\nflowchart TD\n    Author[\"Author Posts Tweet\"] --> Router{\"Fan-out Strategy\"}\n    Router -->|Regular User| FanoutWrite[\"Fan-out on Write: Push to all followers' timeline caches\"]\n    Router -->|Celebrity / High Follower| FanoutRead[\"Fan-out on Read: Store in author's tweet list only\"]\n    FanoutWrite --> Cache[(\"Redis Timeline Caches\")]\n    Consumer[\"User opens feed\"] --> Merge[\"Timeline Merger Service\"]\n    Cache --> Merge\n    FanoutRead --> Merge\n    Merge --> Feed[\"Ranked Home Feed\"]\n      </div>\n\n      <h2>Fan-out on Write (Push Model)</h2>\n      <p>When a user posts a status update, a background worker looks up all followers and immediately injects the post ID into each follower's pre-computed in-memory feed cache (e.g., Redis List or sorted set):</p>\n      <ul>\n        <li><strong>Pros:</strong> Generating the timeline when a user opens the app is virtually instant (O(1) read from Redis cache).</li>\n        <li><strong>Cons:</strong> Severe write amplification. If a celebrity with 80 million followers posts, the system must perform 80 million cache writes, overloading background queues.</li>\n      </ul>\n\n      <h2>Fan-out on Read (Pull Model)</h2>\n      <p>Posts are only written to the author's own timeline. When a follower opens their home feed, the system queries the latest posts of everyone they follow and merges them dynamically:</p>\n      <ul>\n        <li><strong>Pros:</strong> Writes are constant time O(1). No write amplification for celebrities.</li>\n        <li><strong>Cons:</strong> Read latency is high; fetching and merging posts from hundreds of followed accounts on every feed refresh causes database and CPU bottlenecks.</li>\n      </ul>\n\n      <h2>The Production Hybrid Solution</h2>\n      <p>Modern social networks implement a <strong>hybrid fan-out</strong> model:</p>\n      <ul>\n        <li>Standard users (e.g., &lt; 25,000 followers) use <strong>Fan-out on Write</strong>, pre-populating followers' Redis feeds.</li>\n        <li>Celebrity accounts (e.g., &gt; 25,000 followers) bypass fan-out on write. Instead, when a follower views their feed, the system fetches the celebrity's recent posts and merges them into the cached timeline in real time.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: write amplification</h2><ul><li>200 million daily active users, 40 million posts per day, and an average of 300 followers per author gives 12 billion timeline inserts per day, about <strong>140,000 per second</strong> on average and perhaps 500,000 at peak. That is manageable across a Redis fleet.</li><li>A single account with 80 million followers would add 80 million inserts for <em>one</em> post, taking minutes even at 500,000 per second. That is why the hybrid threshold exists.</li><li>Timeline memory: if each of 200 million users keeps 800 IDs at 8 B, that is about 1.3 TB of raw IDs, perhaps 3 to 4 TB with Redis overhead. Caching only active users, and capping lists (Twitter publicly described keeping about 800 entries per home timeline), keeps this bounded.</li></ul><h2>Strategy comparison</h2><table><thead><tr><th>Strategy</th><th>Post cost</th><th>Feed-read cost</th><th>Freshness</th><th>Weak spot</th></tr></thead><tbody><tr><td>Push (fan-out on write)</td><td>One insert per follower</td><td>One range read plus hydration</td><td>Seconds of fan-out lag</td><td>Celebrities, deletes (must also be fanned out)</td></tr><tr><td>Pull (fan-out on read)</td><td>One insert</td><td>Read N followees and k-way merge</td><td>Immediate</td><td>Users who follow many accounts; expensive at read time</td></tr><tr><td>Hybrid</td><td>Push for ordinary authors, skip for big ones</td><td>Cached timeline plus a merge of a few celebrity lists</td><td>Good</td><td>More complex; the threshold needs tuning</td></tr><tr><td>Ranked feed (Facebook, Instagram)</td><td>Candidates indexed per author</td><td>Gather thousands of candidates, then ML ranking</td><td>Good</td><td>Ranking latency and cost</td></tr></tbody></table><h2>Read path for the hybrid</h2><div class=\"mermaid\">flowchart LR\n  R[\"Open feed\"] --> T[(\"Home timeline cache: pushed IDs\")]\n  R --> C[\"Followed celebrity list\"]\n  C --> CP[(\"Recent posts per celebrity\")]\n  T --> M[\"Merge by score, dedupe\"]\n  CP --> M\n  M --> H[\"Hydrate posts, authors and counts in batches\"]\n  H --> F[\"Filter blocked or deleted posts, then rank\"]\n  F --> P[\"Page of 20 plus a cursor\"]</div><p>Meta's ranked News Feed gathers candidates from followed sources at read time and scores them with ML models. That is closer to \"pull plus ranking\" than to a pure pushed list, because the ordering depends on the viewer and the moment. Twitter's classic home timeline was mostly push into Redis, with celebrity tweets merged at read time.</p>\n</div>",
    "keyTakeaways": [
      "Understand the classic trade-off: Fan-out on Write (fast reads, heavy writes) vs Fan-out on Read (fast writes, slow reads).",
      "Employ a hybrid approach: push regular user updates to followers' Redis caches, but pull celebrity updates dynamically on read.",
      "Cap pre-computed timeline lengths (e.g., latest 800 tweet IDs) to control cache memory footprint.",
      "Store only post IDs in timeline caches and hydrate post text, images, and user profiles in a single batched multi-get."
    ],
    "furtherReading": [
      {
        "title": "Raffi Krikorian (Twitter): Timelines at Scale (InfoQ)",
        "url": "https://www.infoq.com/presentations/Twitter-Timeline-Scalability/"
      },
      {
        "title": "Engineering at Meta: Serving Facebook Multifeed: Efficiency, performance gains through redesign",
        "url": "https://engineering.fb.com/2015/03/10/production-engineering/serving-facebook-multifeed-efficiency-performance-gains-through-redesign/"
      }
    ]
  },
  "geospatial-nearby-search-case-study": {
    "title": "Design: nearby search",
    "video": {
      "youtubeId": "dQXdSxn7d1g",
      "title": "Proximity Search & Geospatial Indexes Explained",
      "channel": "Hello Interview",
      "why": "A focused explanation of geohash, quadtrees, S2/H3 and native spatial indexes, the exact comparison this lesson makes.",
      "length": "17:07"
    },
    "videos": [
      {
        "youtubeId": "M4lR_Va97cQ",
        "title": "FAANG System Design Interview: Design A Location Based Service (Yelp, Google Places)",
        "channel": "ByteByteGo",
        "role": "interview",
        "why": "Alex Xu's full proximity-service design, covering read-heavy caching, geohash precision choice and neighbour cells.",
        "length": "24:41"
      },
      {
        "youtubeId": "ay2uwtRO3QE",
        "title": "H3: Tiling the Earth with Hexagons",
        "channel": "Uber Engineering",
        "role": "deep-dive",
        "why": "Uber's engineers explain why they built H3 and how hexagonal cells behave.",
        "length": "25:39"
      }
    ],
    "intuition": "<p>Imagine finding coffee shops near you on a paper map divided into lettered squares. You do not measure the distance to every café in the country. You look at <strong>your square and the squares around it</strong>, list the cafés in those, and measure the exact distance only for that short list. Geohash, quadtrees, S2 and H3 are different ways of drawing those squares: fixed grids, grids that split where things are crowded, or hexagons.</p><p><strong>Mental model:</strong> <em>turn 2D proximity into a cheap lookup of 1D cell IDs to get a candidate set, then filter the candidates by exact distance.</em> The cell step is fast and approximate, and the distance filter makes the result exact.</p><ul><li><strong>Trap: searching only your own cell.</strong> A café 20 m away across a cell boundary has a completely different prefix. Always include the neighbouring cells that the search radius touches.</li><li><strong>Trap: one precision everywhere.</strong> A 1 km cell in Manhattan holds thousands of places; in rural areas it holds none. Adaptive structures (quadtrees) or multi-resolution queries handle density.</li><li><strong>Trap: writing moving objects to a disk-based index.</strong> A million drivers each sending an update every 4 s is 250,000 writes per second. Keep live positions in memory (Redis GEO, or a sharded in-memory grid) and persist them lazily.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Two-Dimensional Spatial Indexing Problem</h2>\n      <p>Two independent scalar B-tree indexes do not directly provide a nearest-neighbor search. An unindexed latitude/longitude bounding-box query may scan many rows, while databases with GiST, R-tree, geography, or other spatial indexes can serve this workload efficiently. The design choice is between those native spatial capabilities and an application-managed cell index—not SQL versus indexing.</p>\n\n      <h2>Spatial Indexing Strategies</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Coordinates[\"Latitude & Longitude\"] --> Choice{\"Indexing Algorithm\"}\n    Choice --> Geohash[\"Geohash: Base32 Z-order curve strings\"]\n    Choice --> QuadTree[\"QuadTree: Hierarchical 4-quadrant tree in memory\"]\n    Choice --> Cells[\"S2 quadrilateral cells / H3 mostly hexagonal cells\"]\n    Geohash --> KeyValue[(\"Redis Sorted Sets / NoSQL Prefix Query\")]\n    Cells --> Candidates[(\"Neighbor cells + exact distance filter\")]\n      </div>\n\n      <h2>Geohash & Peano Space-Filling Curves</h2>\n      <p>Geohashing recursively subdivides the globe into a grid and maps 2D coordinates into a 1D alphanumeric string using a Z-order space-filling curve. Locations sharing the same prefix are geographically proximate:</p>\n      <ul>\n        <li>Precision 5: ~4.9 km × 4.9 km cell (city district scale)</li>\n        <li>Precision 6: ~1.2 km × 0.6 km cell (neighborhood scale)</li>\n        <li>Precision 7: ~152 m × 152 m cell (street block scale)</li>\n      </ul>\n      <p>To find places within 1 kilometer, cover the search circle with every cell it intersects at the chosen precision, query those cells, and apply an exact spherical-distance filter. Center plus eight neighbors is a useful small-grid example, not a universal guarantee: geohash cell dimensions vary with precision and latitude, and a radius can span more cells.</p>\n\n      <h2>Dynamic Drivers vs. Static Places</h2>\n      <p>For static places (restaurants, ATMs in Yelp/Google Places), data is indexed into Geohash or QuadTree shards and heavily cached. For dynamic moving objects (Uber/Lyft drivers updating coordinates every 4 seconds), coordinates are written to an in-memory spatial index (like Redis Geospatial commands backed by sorted sets) to prevent database write saturation.</p>\n    \n<!-- enriched -->\n<h2>Worked example: 1 km search with geohash</h2><ul><li>The user is at latitude 40.7580, longitude -73.9855 (Times Square). At precision 6 a cell is about 1.2 km x 0.61 km at the equator; cells get narrower east to west as latitude increases.</li><li>A 1 km radius spans about two cells north to south and several east to west, so the covering set is roughly 9 to 15 cells, not always exactly 9.</li><li>Each cell lookup is a range scan on a geohash-prefixed key, in a Redis sorted set or a DB index. With Manhattan densities of 1,000 to 3,000 places per cell, you gather perhaps 20,000 candidates.</li><li>Exact haversine filtering of 20,000 points takes about 1 ms of CPU. Then sort by distance or rank, and return the top 20.</li><li>For sparse areas, widen progressively: precision 6, then 5, then 4, until at least K results are found.</li></ul><h2>Index options</h2><table><thead><tr><th>Index</th><th>Cell shape</th><th>Adapts to density</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>Geohash</td><td>Rectangles on a Z-order curve</td><td>No</td><td>Plain string prefixes; works in any KV store or Redis GEO</td><td>Edge discontinuities; cell shape varies with latitude</td></tr><tr><td>Quadtree</td><td>Squares split recursively</td><td>Yes (split when a leaf exceeds N points, for example 100)</td><td>Balanced load in dense and sparse areas</td><td>Usually an in-memory structure; rebuilding it is costly for moving points</td></tr><tr><td>S2 (Google)</td><td>Spherical quadrilaterals on a Hilbert curve</td><td>Multi-level coverings</td><td>Good locality; region coverings for arbitrary shapes</td><td>More complex library</td></tr><tr><td>H3 (Uber)</td><td>Hexagons, plus 12 pentagons</td><td>Multi-resolution</td><td>All six neighbours are equidistant; good for aggregation and pricing zones</td><td>Children do not exactly tile their parent</td></tr><tr><td>R-tree / GiST (PostGIS)</td><td>Bounding boxes</td><td>Yes</td><td>Native SQL; exact <code>ST_DWithin</code> queries with index support</td><td>Scaling writes means sharding the database yourself</td></tr></tbody></table><h2>Static places vs moving objects</h2><div class=\"mermaid\">flowchart LR\n  subgraph Static\n    P[(\"Places DB with PostGIS or geohash column\")] --> RC[\"Read replicas and a cache per cell\"]\n  end\n  subgraph Moving\n    D[\"Driver pings every 4 s\"] --> G[\"Location service sharded by city\"]\n    G --> M[(\"In-memory geo index, TTL 30 s\")]\n  end\n  Q[\"Nearby query\"] --> RC\n  Q --> M</div><p>Yelp-style place search is read-heavy and changes slowly, so cache the results for each cell for minutes. Driver search is write-heavy and every result is stale within seconds. Expire positions that have not been refreshed recently (for example after 30 s), so a phone that goes offline does not keep appearing as an available driver.</p>\n</div>",
    "keyTakeaways": [
      "Avoid unindexed 2D scans; use a database spatial index or a cell-based index selected for the query and update workload.",
      "Geohash converts 2D coordinates into 1D prefix-searchable strings using Z-order curves.",
      "Cover all cells intersecting the requested radius, then exact-distance filter candidates; eight neighbors are not sufficient for every radius, precision, or latitude.",
      "Decouple high-frequency moving objects (drivers) in Redis Geospatial from static location catalogs (restaurants)."
    ],
    "furtherReading": [
      {
        "title": "Movable Type Scripts: Geohash encoding/decoding",
        "url": "https://www.movable-type.co.uk/scripts/geohash.html"
      },
      {
        "title": "Uber H3: A Hexagonal Hierarchical Spatial Index",
        "url": "https://www.uber.com/blog/h3/"
      }
    ]
  }
};
