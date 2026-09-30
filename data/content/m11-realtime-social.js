window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-realtime-social"] = {
  "realtime-database-and-websocket-scaling": {
    "title": "Realtime database and WebSocket scaling",
    "video": {
      "youtubeId": "vXJsJ52vwAA",
      "title": "How to scale WebSockets to millions of connections",
      "channel": "Ably Realtime",
      "why": "Focused, clear walkthrough of exactly this unit's problems: stateful connections, horizontal scaling, pub/sub fan-out between nodes, load balancing, and reconnect storms.",
      "length": "14:01"
    },
    "videos": [
      {
        "youtubeId": "6w6E_B55p0E",
        "title": "Scaling Push Messaging for Millions of Devices @Netflix",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "Netflix's Zuul Push talk shows a real push registry, connection draining, and the operational pain of millions of long-lived connections.",
        "length": "49:10"
      },
      {
        "youtubeId": "gzIcGhJC8hA",
        "title": "Scaling Websockets with Redis, HAProxy and Node JS - High-availability Group Chat Application",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Builds the multi-node WebSocket plus Redis pub/sub plus HAProxy architecture hands-on, making the cross-node routing problem concrete.",
        "length": "20:36"
      }
    ],
    "intuition": "<p>Picture an old hotel switchboard. Every guest's phone line is physically wired into one specific switchboard room. When a call comes in for room 512, the front desk has to know <em>which</em> room holds that line. If a switchboard room catches fire, the guests redial, land on a different room, and ask \"what did I miss since message 41?\"</p><p><strong>Mental model:</strong> a WebSocket fleet is a stateful routing layer sitting in front of a durable log. Connections are disposable; positions in the log are not.</p><ul><li><strong>Treating Redis Pub/Sub as delivery.</strong> It is fire-and-forget: a node that is restarting or a client that is offline simply misses the message. Durability must come from a store the client can resume from.</li><li><strong>Relying on sticky sessions for correctness.</strong> Affinity reduces churn, but after a crash or deploy the client lands elsewhere, so resume-from-position must work on any node.</li><li><strong>Ignoring slow consumers and reconnect storms.</strong> Unbounded per-socket queues exhaust memory, and 200k clients reconnecting in the same second after a node dies will flatten auth and the registry unless clients use jittered backoff.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Scaling Real-Time Connections</h2>\n      <p>Traditional HTTP follows a request-response model, which is inefficient for real-time applications like chat, live sports updates, or collaborative editing. To push data from the server to the client instantly, we need persistent connections, most commonly achieved via WebSockets.</p>\n      \n      <h3>The Stateful Nature of WebSockets</h3>\n      <p>Unlike stateless HTTP REST APIs, WebSocket connections are stateful. Once a client connects to a specific server (e.g., Server A), that TCP connection remains open. If a message needs to be sent to that user, the system must know exactly which server holds their active connection.</p>\n      \n      <h3>The Connection Manager & Pub/Sub</h3>\n      <p>To scale WebSockets across millions of users, a single server cannot hold all connections. We use a cluster of WebSocket servers. The architecture requires two main components:</p>\n      <ol>\n        <li><strong>Connection registry:</strong> Track each connection or device, not only one node per user: <code>(user, connection_id) -> node, expiry, capabilities</code>. Heartbeats and node-generation fencing remove stale registrations after crashes.</li>\n        <li><strong>Routing and recovery:</strong> Ephemeral Pub/Sub can notify the nodes holding a user's sockets, but it is not a durable inbox. Give durable messages per-conversation or per-recipient positions. After disconnect or node failure, the client resumes from its last acknowledged position and fetches gaps from the source of truth.</li>\n      </ol>\n      \n      <h3>Load Balancing</h3>\n      <p>Load balancers must support long-lived upgraded connections and drain them during deployments. Affinity can reduce reconnect churn but cannot be the recovery mechanism: a reconnect may land on another node. Bound outbound queues per connection; disconnect or coalesce updates for a slow client before one socket consumes unbounded memory.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: sizing a WebSocket fleet</h2><p>Assume 10 million concurrent users with an average of 1.3 devices each, so about 13 million sockets. If one gateway node comfortably holds 200,000 sockets (kernel buffers plus application state at roughly 20 KB per socket is about 4 GB of RAM), we need 65 nodes at steady state. Add about 30 percent headroom so a node can be drained or lost without overloading its neighbours: roughly 85 nodes.</p><ul><li><strong>Heartbeats:</strong> a 30 second ping interval across 13 million sockets is about 433,000 pings per second fleet-wide, which is cheap per node (about 5,000 per second) but must not touch a shared database.</li><li><strong>Node loss:</strong> 200,000 clients reconnect. With exponential backoff plus random jitter spread over 30 seconds that is about 6,700 reconnects per second, each doing auth, a registry write and a resume query. Without jitter it can be 200,000 in one or two seconds.</li><li><strong>Deploys:</strong> draining one node at a time with a 60 second drain window means a full rollout of 85 nodes takes well over an hour, so many teams drain several nodes in parallel and cap the reconnect rate.</li></ul><h2>Routing strategies</h2><table><thead><tr><th>Strategy</th><th>How a message finds the socket</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>Broadcast to all nodes</td><td>Every node receives every message and drops the ones it does not own</td><td>No registry to keep consistent</td><td>Traffic grows with nodes times messages; fails beyond a few dozen nodes</td></tr><tr><td>Connection registry plus direct send</td><td>Look up (user, connection) to node, then RPC or per-node queue</td><td>Precise, scales well</td><td>Registry must be fenced against stale entries after crashes</td></tr><tr><td>Topic subscription per node</td><td>Each node subscribes to the channels or conversations its local users care about</td><td>Natural for group chat and live rooms</td><td>Subscription churn when users join and leave rooms quickly</td></tr><tr><td>Consistent hashing of channels</td><td>A channel server owns each channel; gateways forward to it</td><td>Ordering per channel is easy</td><td>Rebalancing on membership change must hand off state</td></tr></tbody></table><h2>Resume protocol</h2><div class=\"mermaid\">sequenceDiagram\n    participant C as \"Client\"\n    participant G2 as \"Gateway B\"\n    participant S as \"Message Store\"\n    C->>G2: \"RESUME session, last_seq 41\"\n    G2->>S: \"fetch conversation positions after 41\"\n    S-->>G2: \"messages 42 to 47\"\n    G2-->>C: \"replay 42 to 47 then live stream\"\n</div><h2>How real systems do it</h2><ul><li><strong>Discord</strong> gateway sessions carry a sequence number; a client that drops sends a Resume with its session id and last sequence to receive missed events instead of a full re-sync.</li><li><strong>Slack</strong> separates gateway servers (hold sockets) from channel servers (own channels via consistent hashing), so fan-out and connection holding scale independently.</li><li><strong>Netflix Zuul Push</strong> keeps a push registry mapping client to server and treats connections as ephemeral, deliberately recycling them to rebalance load.</li></ul><h2>Failure modes to name in an interview</h2><ul><li>Split-brain registry entries after a network partition: fence with a node generation or epoch and expire entries without heartbeats.</li><li>Slow client: bound the outbound queue, coalesce state updates (send the latest presence, not all of them), then disconnect.</li><li>Thundering herd after a regional failover: server-sent retry hints plus client jitter.</li></ul>\n</div>",
    "keyTakeaways": [
      "WebSockets require stateful, persistent TCP connections.",
      "Scaling requires a registry (like Redis) to map users to their connected servers.",
      "Ephemeral Pub/Sub can route live hints, while durable positions and gap fetches recover messages missed during disconnects or node failure."
    ],
    "furtherReading": [
      {
        "title": "Slack Engineering: Real-time Messaging",
        "url": "https://slack.engineering/real-time-messaging/"
      },
      {
        "title": "The WebSocket Protocol (RFC 6455)",
        "url": "https://datatracker.ietf.org/doc/html/rfc6455"
      },
      {
        "title": "Discord: How Discord Scaled Elixir to 5,000,000 Concurrent Users",
        "url": "https://discord.com/blog/how-discord-scaled-elixir-to-5-000-000-concurrent-users"
      }
    ]
  },
  "websockets-vs-sse-vs-long-polling": {
    "title": "WebSockets vs SSE vs long polling",
    "video": {
      "youtubeId": "fIwOd4PToAY",
      "title": "Long Polling, Websockets, Server Sent Events - Who Wins? | Systems Design  with Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Directly compares all three transports with the system-design trade-offs (connection cost, direction, load balancing) rather than just API syntax.",
      "length": "11:17"
    },
    "videos": [
      {
        "youtubeId": "4HlNv1qpZFY",
        "title": "Server-Sent Events Crash Course",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "The clearest deep explanation of how SSE actually works on the wire, including reconnection and its limits.",
        "length": "29:48"
      },
      {
        "youtubeId": "2Nt-ZrNP22A",
        "title": "WebSockets Crash Course - Handshake, Use-cases, Pros & Cons and more",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Walks through the upgrade handshake, framing and the operational pros and cons of WebSockets.",
        "length": "47:33"
      }
    ],
    "intuition": "<p>Four ways to learn you have mail. <strong>Short polling</strong> is walking to the mailbox every five minutes. <strong>Long polling</strong> is standing at the mailbox until the carrier arrives, then walking back and standing there again. <strong>SSE</strong> is a radio: you tune in once and the station keeps talking, but you cannot talk back on the same channel. <strong>WebSocket</strong> is a phone call: both sides talk whenever they want.</p><p><strong>Mental model:</strong> pick the simplest transport whose direction and latency match the data flow; every step up buys lower latency at the cost of more long-lived state on your servers.</p><ul><li><strong>Reaching for WebSockets for a one-way feed.</strong> Notifications, tickers and LLM token streams are server-to-client only; SSE is plain HTTP, works through most proxies, and reconnects automatically with Last-Event-ID.</li><li><strong>Forgetting idle timeouts.</strong> Proxies and load balancers close quiet connections (AWS ALB defaults to 60 seconds), so both SSE and WebSockets need heartbeats.</li><li><strong>Ignoring the HTTP/1.1 connection limit.</strong> Browsers allow about six connections per origin over HTTP/1.1, and each SSE stream consumes one; HTTP/2 multiplexing removes most of this problem.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Comparing Real-Time Protocols</h2>\n      <p>When designing a real-time feature, you have three primary architectural choices for pushing data to the client. Choosing the wrong one can lead to massive network overhead or battery drain.</p>\n      \n      <h3>Short & Long Polling</h3>\n      <p><strong>Short Polling:</strong> The client asks the server every X seconds if there is new data. This is simple but highly inefficient. Most requests return empty, wasting server CPU and mobile battery.</p>\n      <p><strong>Long Polling:</strong> The client makes a request, but the server holds the connection open until new data is available or a timeout occurs. Once the client gets data, it immediately opens a new long-polling request. It works over standard HTTP, bypassing corporate firewalls easily, but it still incurs the overhead of HTTP headers on every new request (keep-alive usually reuses the underlying TCP connection).</p>\n      \n      <h3>Server-Sent Events (SSE)</h3>\n      <p>SSE is a unidirectional protocol over HTTP. The client establishes a connection, and the server continuously streams data down to the client. The client cannot send data back over this same channel (it must make separate POST requests). The browser's EventSource reconnects automatically and sends <code>Last-Event-ID</code> so the server can resume; over HTTP/1.1 each stream uses one of the browser's roughly six connections per origin, a limit HTTP/2 multiplexing removes.</p>\n      <p><strong>Best for:</strong> Real-time feeds, stock tickers, or live sports scores where data flows only from Server to Client.</p>\n      \n      <h3>WebSockets</h3>\n      <p>WebSockets upgrade a standard HTTP connection into a fully bidirectional, persistent TCP connection. Both client and server can send data asynchronously with minimal overhead (no heavy HTTP headers).</p>\n      <p><strong>Best for:</strong> Multiplayer games, collaborative editing (Google Docs), and low-latency chat applications.</p>\n      \n      <table border=\"1\">\n        <tr>\n          <th>Protocol</th>\n          <th>Direction</th>\n          <th>Use Case</th>\n        </tr>\n        <tr>\n          <td>Long Polling</td>\n          <td>Emulated server-to-client push; client-to-server uses ordinary requests</td>\n          <td>Legacy support, strict firewalls</td>\n        </tr>\n        <tr>\n          <td>SSE</td>\n          <td>Server to Client only</td>\n          <td>Live feeds, notifications</td>\n        </tr>\n        <tr>\n          <td>WebSockets</td>\n          <td>Bi-directional</td>\n          <td>Chat, gaming, real-time collab</td>\n        </tr>\n      </table>\n      \n    \n<!-- enriched -->\n<h2>Worked example: one million clients, one update per minute</h2><p>Suppose 1,000,000 connected clients, each receiving on average one update every 60 seconds.</p><ul><li><strong>Short polling every 5 s:</strong> 200,000 requests per second. Only about 1 in 12 polls returns data, so roughly 92 percent of the work is wasted. At around 800 bytes of request plus response headers, that is about 160 MB/s (1.3 Gbit/s) of header traffic alone.</li><li><strong>Long polling with a 30 s timeout:</strong> each client re-issues a request after every update or timeout. With updates arriving randomly every 60 s on average, the expected wait per request is about 60 x (1 - e^-0.5), roughly 23.6 s, so about 42,000 requests per second. Much better, but each response still pays full HTTP headers and a reconnect.</li><li><strong>SSE or WebSocket:</strong> 1,000,000 idle connections held open and about 16,700 messages per second pushed, each with only a few bytes of framing (WebSocket frame headers are 2 to 14 bytes). The cost moves from CPU and bandwidth to memory and connection management.</li></ul><h2>Detailed comparison</h2><table><thead><tr><th>Property</th><th>Long polling</th><th>SSE</th><th>WebSocket</th></tr></thead><tbody><tr><td>Direction</td><td>Server to client push emulated; client sends via normal requests</td><td>Server to client only</td><td>Full duplex</td></tr><tr><td>Transport</td><td>Plain HTTP request per message batch</td><td>One long HTTP response (text/event-stream)</td><td>HTTP upgrade to the WebSocket protocol</td></tr><tr><td>Reconnect and resume</td><td>Manual</td><td>Built into EventSource with Last-Event-ID</td><td>Manual; you design session resume</td></tr><tr><td>Payload</td><td>Anything HTTP carries</td><td>UTF-8 text only</td><td>Text or binary frames</td></tr><tr><td>Proxy and CDN friendliness</td><td>Excellent</td><td>Good; buffering proxies must be configured not to buffer</td><td>Needs upgrade support and long idle timeouts</td></tr><tr><td>Typical use</td><td>Fallback, very constrained networks</td><td>Notifications, dashboards, LLM token streaming</td><td>Chat, multiplayer games, collaborative editing</td></tr></tbody></table><h2>How real systems choose</h2><ul><li>LLM APIs such as OpenAI's and Anthropic's stream tokens to clients using SSE, because the flow is one-way and HTTP semantics (auth headers, retries, proxies) come for free.</li><li>Slack and Discord use WebSockets because clients send typing indicators, presence and acknowledgements continuously.</li><li>Libraries such as Socket.IO historically started with long polling and upgraded to WebSocket when the network allowed it, which is why long polling survives as a fallback.</li></ul><h2>Failure modes</h2><ul><li>A corporate proxy that buffers responses turns SSE into \"nothing, then everything at once\"; send periodic comment lines and disable buffering (for nginx, the X-Accel-Buffering header).</li><li>Long polling can deliver duplicates when a response is lost after the server marked it sent; carry a cursor so the client asks for \"after position N\".</li></ul>\n</div>",
    "keyTakeaways": [
      "Long polling is resource-intensive but works when WebSockets are blocked.",
      "SSE is perfect for unidirectional data streams (like stock tickers).",
      "WebSockets offer full-duplex, low-latency communication for interactive apps."
    ],
    "furtherReading": [
      {
        "title": "MDN WebSockets API",
        "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API"
      },
      {
        "title": "Server-Sent Events: MDN Web Docs",
        "url": "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events"
      },
      {
        "title": "IETF RFC 9112: HTTP/1.1, Section 9.3 Persistence",
        "url": "https://www.rfc-editor.org/rfc/rfc9112#section-9.3"
      }
    ]
  },
  "social-network-database-modeling": {
    "title": "Social network database modeling",
    "video": {
      "youtubeId": "sougyTO_Wjw",
      "title": "Database Design for Facebook: A Social Network Database Example",
      "channel": "Database Star",
      "why": "Directly models users, posts, comments, likes and friendships as tables, which is the relational baseline this unit starts from.",
      "length": "11:15"
    },
    "videos": [
      {
        "youtubeId": "_BfMH4GQWnk",
        "title": "Cassandra at Instagram 2016 (Dikang Gu, Facebook) | Cassandra Summit 2016",
        "channel": "DataStax",
        "role": "case-study",
        "why": "Shows why and how Instagram moved feed and inbox style data to query-driven Cassandra tables at massive scale.",
        "length": "29:49"
      },
      {
        "youtubeId": "6GebEqt6Ynk",
        "title": "Choosing a Database for Systems Design: All you need to know in one video",
        "channel": "Jordan has no life",
        "role": "deep-dive",
        "why": "Compares relational, wide-column and graph stores by access pattern, the exact reasoning this unit asks for.",
        "length": "23:58"
      }
    ],
    "intuition": "<p>Think of a library. A normalized database is the card catalog: every fact lives in one place, and to build your reading list you walk around and assemble it. A denormalized timeline table is a personal shelf that the librarian pre-stocks for each member, so reading is instant but every new book must be copied onto many shelves.</p><p><strong>Mental model:</strong> model the data around the queries you must serve under a latency budget, not around the entities; the entities are the source of truth, the query tables are projections.</p><ul><li><strong>Saying \"SQL cannot scale for social\".</strong> Facebook's core social data still lives in sharded MySQL behind TAO; the real issue is fan-out and access patterns, not JOINs as such.</li><li><strong>Unbounded partitions.</strong> A Cassandra partition keyed only by user_id for a timeline grows forever; cap it, or add a time bucket to the partition key.</li><li><strong>Forgetting the source of truth.</strong> Denormalized timelines, counters and follower lists must be rebuildable from the canonical posts and edges.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Modeling Social Data at Scale</h2>\n      <p>Social networks deal with highly interconnected data: users, posts, comments, likes, and follows. Choosing the right database model is critical for read efficiency, as social feeds are extremely read-heavy.</p>\n      \n      <h3>Relational Models</h3>\n      <p>A normalized SQL schema with appropriate indexes can serve users, posts, comments, and reactions well. A home feed may become expensive when it must repeatedly merge large author sets under a strict latency target; measurements can then justify a materialized feed or query-specific projection. The problem is the access pattern and fanout, not the mere presence of a JOIN.</p>\n      \n      <h3>NoSQL & Wide-Column Stores</h3>\n      <p>Databases like Cassandra (used by Instagram, and by Discord until its 2022 migration to ScyllaDB) or ScyllaDB are preferred for massive social scale. They use a denormalized, query-driven modeling approach. Instead of joining tables, you design tables to answer specific queries.</p>\n      <p>For example, to load a user's timeline, you don't join Users and Posts. You have a specific table <code>user_timeline</code> partitioned by <code>user_id</code> and clustered by <code>timestamp</code> (descending). When a user posts, it is fanned out and written directly to the timelines of their followers. Reads become a bounded single-partition range query whose cost still depends on page size, filtering, storage latency, and hot-partition load.</p>\n      \n      <h3>Graph Databases</h3>\n      <p>For deep relationship queries (e.g., \"Find friends of friends who like this band\"), general-purpose multi-hop traversal engines like Neo4j or Amazon Neptune excel. However, such engines are usually not used for rendering high-throughput home feeds. This is about traversal engines, not graph data models: Facebook's TAO is a graph-shaped store of objects and associations that does serve the hot path. They are typically used asynchronously for recommendation engines and anti-fraud detection, rather than the hot path of feed generation.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: read versus write volume</h2><p>Assume 500 million daily active users who each open their feed 10 times a day: 5 billion feed reads per day, about 58,000 per second on average and perhaps 175,000 per second at peak (3x). If they create 100 million posts per day, that is about 1,160 posts per second. Reads outnumber writes by roughly 50 to 1, which is why precomputing read-shaped data pays off.</p><h2>Query-driven tables (Cassandra CQL style)</h2><p><code>CREATE TABLE user_timeline (user_id bigint, bucket int, post_id timeuuid, author_id bigint, PRIMARY KEY ((user_id, bucket), post_id)) WITH CLUSTERING ORDER BY (post_id DESC);</code></p><p><code>CREATE TABLE posts_by_author (author_id bigint, post_id timeuuid, body text, PRIMARY KEY ((author_id), post_id)) WITH CLUSTERING ORDER BY (post_id DESC);</code></p><p>Reading the first page of a feed is one partition read of the newest 50 rows. The bucket (for example a month) prevents a hyperactive account from creating a multi-gigabyte partition. Deleting a post means deleting from posts_by_author and either fanning out tombstones or filtering deleted IDs at read time, which is why many systems store only post IDs in timelines and hydrate bodies from a cache.</p><h2>Which store for which access pattern</h2><table><thead><tr><th>Access pattern</th><th>Good fit</th><th>Why</th><th>Watch out for</th></tr></thead><tbody><tr><td>Profile, settings, post by id</td><td>Sharded relational (MySQL, Postgres)</td><td>Transactions, constraints, mature tooling</td><td>Cross-shard queries</td></tr><tr><td>Home timeline page</td><td>Wide-column (Cassandra, ScyllaDB) or Redis lists</td><td>Single-partition range read</td><td>Write amplification from fan-out, tombstones</td></tr><tr><td>Follow edges, one hop</td><td>Sharded adjacency lists, TAO-style store</td><td>Simple point and range lookups at huge QPS</td><td>Keeping forward and reverse edges consistent</td></tr><tr><td>Friends of friends, fraud rings</td><td>Graph database or offline graph processing</td><td>Multi-hop traversal is native</td><td>Hot path latency and sharding a graph</td></tr><tr><td>Counters (likes, followers)</td><td>Separate counter store or aggregated stream</td><td>Avoid hot-row contention</td><td>Drift from source; needs reconciliation</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Facebook</strong> serves the social graph through TAO, a read-optimized cache and data model of objects and associations backed by sharded MySQL.</li><li><strong>Instagram</strong> began on sharded PostgreSQL and moved high-volume feed and inbox style data to Cassandra.</li><li><strong>Twitter</strong> kept precomputed home timelines of roughly 800 tweet IDs per user in Redis, hydrating tweet bodies separately.</li><li><strong>Discord</strong> stores messages partitioned by channel plus a time bucket, first on Cassandra and since 2022 on ScyllaDB.</li></ul>\n</div>",
    "keyTakeaways": [
      "At massive scale the bottleneck is feed fan-out and access patterns rather than JOINs as such; sharded relational stores (e.g. MySQL behind Facebook's TAO) still hold core social data.",
      "Wide-column NoSQL databases optimize reads by denormalizing data into query-specific tables.",
      "Graph databases are powerful for relationship analytics but usually kept off the hot read path."
    ],
    "furtherReading": [
      {
        "title": "Apache Cassandra Documentation: Data Modeling",
        "url": "https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html"
      },
      {
        "title": "Lakshman & Malik: Cassandra: A Decentralized Structured Storage System (LADIS 2009)",
        "url": "https://www.cs.cornell.edu/projects/ladis2009/papers/lakshman-ladis2009.pdf"
      },
      {
        "title": "TAO: Facebook's Distributed Data Store for the Social Graph",
        "url": "https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf"
      }
    ]
  },
  "social-graph-follows-and-flockdb": {
    "title": "Social graph: follows and FlockDB",
    "video": {
      "youtubeId": "Dg07kVN4U28",
      "title": "TAO: Facebook’s Distributed Data Store for the Social Graph",
      "channel": "Gaurav Sen",
      "why": "Clear, learner-friendly walkthrough of how a production social graph stores directed edges (associations) with inverse edges on sharded MySQL, the same design space as FlockDB.",
      "length": "24:59"
    },
    "videos": [
      {
        "youtubeId": "sNIvHttFjdI",
        "title": "USENIX ATC '13 - TAO: Facebook’s Distributed Data Store for the Social Graph",
        "channel": "USENIX",
        "role": "deep-dive",
        "why": "The original paper talk by the Facebook engineers, with real numbers on read/write ratios, caching tiers and inverse-edge consistency.",
        "length": "27:45"
      },
      {
        "youtubeId": "O3gv5eYfaWU",
        "title": "Facebook TAO - Graphs at Scale | Distributed Systems Deep Dives With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "deep-dive",
        "why": "An interview-oriented paper breakdown that focuses on sharding and consistency trade-offs for edges.",
        "length": "32:38"
      }
    ],
    "intuition": "<p>Your phone's contact list answers \"who do I know?\" instantly. Answering \"whose phones have <em>me</em> in their contacts?\" would mean checking every phone on earth, unless someone maintains a second list per person. A social graph store is exactly that: two address books per user, one forward and one reverse, kept in agreement.</p><p><strong>Mental model:</strong> a follow is one logical edge stored twice, once sharded by the follower and once sharded by the followee, so both directions are single-shard range reads.</p><ul><li><strong>Assuming a graph database is required.</strong> Follow graphs are mostly one-hop lookups; Twitter's FlockDB and Facebook's TAO are sharded adjacency lists, not traversal engines.</li><li><strong>Writing both directions non-idempotently.</strong> The two copies live on different shards, so the write must be retry-safe and ordered (for example, with a position or timestamp per edge) and repaired asynchronously.</li><li><strong>Forgetting the celebrity shard.</strong> One account with 100 million followers makes its reverse list enormous; sub-shard or page it rather than keeping it in one row range.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Managing the Follower Graph</h2>\n      <p>The \"social graph\" is the mapping of relationships between users. In systems like Twitter or Instagram, this is a directed graph (User A follows User B, but B might not follow A). Managing this graph efficiently is crucial because every feed generation relies on knowing who a user follows.</p>\n      \n      <h3>The Twitter Approach: FlockDB</h3>\n      <p>Twitter famously built FlockDB to handle their social graph. Rather than a complex traversal-focused graph database (like Neo4j), FlockDB is essentially a highly optimized, distributed adjacency list stored on MySQL shards managed by Twitter's Gizzard sharding framework.</p>\n      \n      <h3>Adjacency Lists in SQL</h3>\n      <p>The core concept is storing directed edges in simple tables. An edge table has three main columns: <code>source_id</code>, <code>destination_id</code>, and <code>state</code> (active, blocked, etc.).</p>\n      <p>To find who User 1 follows: <code>SELECT destination_id FROM edges WHERE source_id = 1</code>.</p>\n      <p>To find User 1's followers: <code>SELECT source_id FROM edges WHERE destination_id = 1</code>.</p>\n      \n      <h3>Sharding the Graph</h3>\n      <p>Because the graph is too large for one machine, it must be sharded. FlockDB maintained indexed adjacency lists in both directions. A forward representation grouped by <code>source_id</code> serves outgoing edges, while a reverse representation grouped by destination serves incoming edges; keeping both paths consistent requires ordered, retry-safe updates and repair. Because the forward copy is sharded by source and the backward copy by destination, both \"Who do I follow?\" and \"Who follows me?\" are single-shard lookups. A design that stores each edge only once, sharded by <code>source_id</code>, would make \"Who follows me?\" a scatter-gather query, which is exactly why FlockDB keeps the second, destination-sharded copy.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: how big is the graph?</h2><p>Assume 400 million users following an average of 200 accounts: 80 billion logical edges. Storing both directions gives 160 billion rows. With two 8-byte IDs plus an 8-byte position or timestamp and a state byte, a row is about 25 bytes raw, so roughly 4 TB of raw data; index and storage-engine overhead typically multiply that by 2 to 3, landing around 10 TB before replication. With three replicas that is about 30 TB, easily spread over a few hundred MySQL shards.</p><h2>Operations and their cost</h2><table><thead><tr><th>Operation</th><th>Served by</th><th>Cost</th><th>Notes</th></tr></thead><tbody><tr><td>Who does A follow? (page of 100)</td><td>Forward list, shard of A</td><td>One indexed range read</td><td>Used by pull-based feeds</td></tr><tr><td>Who follows B? (page of 100)</td><td>Reverse list, shard of B</td><td>One indexed range read</td><td>Used by push fan-out; huge for celebrities</td></tr><tr><td>Does A follow B?</td><td>Forward list, shard of A</td><td>Point lookup</td><td>Used for button state and privacy checks</td></tr><tr><td>Follower count of B</td><td>Denormalized counter</td><td>Point lookup</td><td>Counting 100M rows per request is not acceptable</td></tr><tr><td>Mutual follows of A and B</td><td>Intersect two forward lists</td><td>Two reads plus merge</td><td>Cap list sizes or precompute for large accounts</td></tr></tbody></table><h2>Write path for a follow</h2><div class=\"mermaid\">flowchart LR\n    API[\"Follow API\"] --> F[\"Write forward edge on shard of follower\"]\n    F --> Q[\"Durable queue\"]\n    Q --> R[\"Write reverse edge on shard of followee\"]\n    Q --> C[\"Increment follower and following counters\"]\n    Q --> FO[\"Optional backfill of recent posts into follower timeline\"]\n</div><p>Each edge row carries a state (active, removed, blocked) and a position. An unfollow is a state change with a newer position, so a delayed retry of the original follow cannot resurrect the edge: the store keeps whichever write has the higher position. A background repair job compares forward and reverse lists and fixes drift.</p><h2>How real systems do it</h2><ul><li><strong>FlockDB</strong> (Twitter) stored edges as (source, destination, position, state) in MySQL via the Gizzard sharding framework, keeping forward and backward copies so both directions were cheap, and supported set operations like intersection for \"who follows both\".</li><li><strong>TAO</strong> (Facebook) stores associations with an inverse association type; the two directions live on different shards and are written separately, with the inverse write repaired if it fails.</li><li><strong>LinkedIn</strong> built dedicated in-memory graph services (most recently LIquid) because degree-of-connection queries need two and three hop answers quickly.</li></ul>\n</div>",
    "keyTakeaways": [
      "Large-scale follow graphs are often implemented as simple, distributed adjacency lists.",
      "Sharding by source ID optimizes read queries for feed generation.",
      "Twitter's FlockDB demonstrated how to scale graph edges using standard relational databases."
    ],
    "furtherReading": [
      {
        "title": "FlockDB Architecture",
        "url": "https://github.com/twitter-archive/flockdb"
      },
      {
        "title": "Twitter Engineering: Introducing FlockDB",
        "url": "https://blog.x.com/engineering/en_us/a/2010/introducing-flockdb"
      },
      {
        "title": "Marko Rodriguez & Peter Neubauer: The Graph Traversal Pattern (arXiv)",
        "url": "https://arxiv.org/abs/1004.1001"
      }
    ]
  },
  "feed-generation-push-pull-hybrid": {
    "title": "Feed generation: push, pull, hybrid",
    "video": {
      "youtubeId": "Qj4-GruzyDU",
      "title": "Design FB News Feed System Design Interview w/ ex: Meta Senior Manager",
      "channel": "Hello Interview",
      "why": "A focused news-feed design that spends its depth on exactly fan-out on write versus read, the celebrity problem and the hybrid solution.",
      "length": "26:12"
    },
    "videos": [
      {
        "youtubeId": "WEgCjwyXvwc",
        "title": "How We Learned to Stop Worrying and Love Fan-In at Twitter",
        "channel": "Twitter University",
        "role": "case-study",
        "why": "Twitter engineers explain the real trade-offs of fan-in (pull) versus fan-out (push) for timelines in production.",
        "length": "41:13"
      },
      {
        "youtubeId": "qogwP78LzAk",
        "title": "Design the Facebook/Twitter News Feed | Systems Design Questions 3.0 With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A compact interview-style run through the same design with a slightly different set of trade-offs.",
        "length": "11:25"
      }
    ],
    "intuition": "<p>Push is home newspaper delivery: the printer drops a copy on every subscriber's doorstep the moment the paper is printed, so reading is instant but printing for a million subscribers takes time. Pull is going to the newsstand: nothing is pre-delivered, and you assemble your own bundle from each publisher when you arrive. The hybrid delivers most papers to your door and picks up the few giant national papers at the newsstand as you pass by.</p><p><strong>Mental model:</strong> fan-out cost is followers times posts; move work to write time for ordinary accounts and to read time for the few accounts whose follower count would make write-time fan-out explode.</p><ul><li><strong>Calling push reads \"O(1)\".</strong> A read is still a range read of a page plus hydration of post bodies and ranking; it is cheap and bounded, not free.</li><li><strong>Fanning out to everyone.</strong> Skipping inactive followers (for example, not logged in for 30 days) and rebuilding their feed on return can cut write volume dramatically.</li><li><strong>Forgetting deletes and privacy changes.</strong> Precomputed timelines hold stale IDs; filter at read time against deletion and block lists.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Designing a News Feed</h2>\n      <p>Generating a timeline of content from people a user follows is a classic system design challenge. The core decision is how content moves from a creator to a consumer's feed.</p>\n      \n      <h3>Push Model (Fan-out on Write)</h3>\n      <p>When a user posts, the system immediately \"pushes\" the post ID into the pre-computed feed caches of all their followers. When a follower opens the app, their feed is already built and stored in memory (e.g., a Redis List).</p>\n      <p><strong>Pros:</strong> Reads are fast and bounded: a range read of one precomputed page plus hydration and ranking, rather than a merge across every followed account.</p>\n      <p><strong>Cons:</strong> The \"Justin Bieber Problem.\" If a celebrity with 100 million followers makes a post, the system must write to 100 million Redis lists. This massive fan-out takes time, consumes enormous CPU/Network, and delays feed updates.</p>\n      \n      <h3>Pull Model (Fan-out on Read)</h3>\n      <p>When a user posts, it is simply saved to their personal outbox. No feed updates are made. When a follower opens the app, the system queries the outboxes of all people they follow, merges the posts, sorts them by timestamp, and returns the result.</p>\n      <p><strong>Pros:</strong> Writes are instant. No celebrity fan-out issue.</p>\n      <p><strong>Cons:</strong> Reads are slow and computationally expensive, especially for users who follow thousands of people.</p>\n      \n      <h3>The Hybrid Approach</h3>\n      <p>Modern systems use a hybrid model. For normal users, the system uses Push (fan-out on write) to keep feeds fast. For celebrities or highly active accounts, the system uses Pull. When you load your feed, the system grabs your pre-computed Push feed, then dynamically Pulls recent posts from the celebrities you follow, and merges them together at read-time.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: the numbers behind the hybrid</h2><p>Assume 300 million daily users, an average of 200 followers per author, and 50 million posts per day.</p><ul><li><strong>Pure push:</strong> 50M posts x 200 followers = 10 billion timeline inserts per day, about 116,000 per second on average and several times that at peak. Storing 800 post IDs of 8 bytes for 300M users is about 1.9 TB of timeline data (before replication), which fits in a large Redis or Cassandra cluster.</li><li><strong>A celebrity post:</strong> one account with 100 million followers needs 100 million inserts. Even at 1 million inserts per second across the cluster that is 100 seconds of lag and a burst that starves everyone else's fan-out.</li><li><strong>Pure pull:</strong> a user following 500 accounts triggers 500 outbox reads (or scatter-gather over many shards) plus a merge on every feed open; at 175,000 feed opens per second that is tens of millions of reads per second.</li><li><strong>Hybrid:</strong> push for authors under a threshold (say 100,000 followers), pull for the rest. A typical user follows perhaps 10 to 20 such large accounts, so a read is one precomputed list plus 10 to 20 small, heavily cached outbox reads, merged by time or score.</li></ul><h2>Trade-off table</h2><table><thead><tr><th>Dimension</th><th>Push (fan-out on write)</th><th>Pull (fan-out on read)</th><th>Hybrid</th></tr></thead><tbody><tr><td>Write cost per post</td><td>Proportional to follower count</td><td>One write</td><td>Proportional to followers for normal authors only</td></tr><tr><td>Read latency</td><td>Lowest</td><td>Highest; merge of many sources</td><td>Low; small merge</td></tr><tr><td>Storage</td><td>Timeline per user</td><td>Outboxes only</td><td>Both</td></tr><tr><td>Freshness</td><td>Lags behind large fan-outs</td><td>Always fresh</td><td>Fresh for celebrities, near-fresh for others</td></tr><tr><td>Wasted work</td><td>Fan-out to users who never open the app</td><td>None</td><td>Reduced by skipping inactive users</td></tr></tbody></table><div class=\"mermaid\">flowchart LR\n    P[\"New post\"] --> T{\"Author above follower threshold?\"}\n    T -- \"no\" --> FO[\"Fan-out workers insert post id into follower timelines\"]\n    T -- \"yes\" --> OB[\"Store in author outbox only\"]\n    R[\"Feed read\"] --> M[\"Merge precomputed timeline with celebrity outboxes\"]\n    FO --> M\n    OB --> M\n    M --> RK[\"Rank, filter deleted and blocked, hydrate\"]\n</div><h2>How real systems do it</h2><ul><li><strong>Twitter</strong> (as described by Raffi Krikorian in 2012 to 2013) fanned out tweet IDs into Redis home timelines capped at about 800 entries, and very large accounts could take minutes to fan out, which is what motivated merging celebrity tweets at read time.</li><li><strong>Facebook</strong> News Feed is largely pull-and-rank: candidates are gathered from friends and pages at read time and scored by ranking models, because ranking needs fresh features anyway.</li><li><strong>Instagram</strong> used push-based feeds stored in Cassandra, then layered ranking over the candidate set.</li></ul>\n</div>",
    "keyTakeaways": [
      "Push (fan-out on write) optimizes for fast reads but struggles with massive follower counts.",
      "Pull (fan-out on read) optimizes for fast writes but slows down feed loading.",
      "Hybrid models apply different strategies based on user follower topology."
    ],
    "furtherReading": [
      {
        "title": "Raffi Krikorian (Twitter): Timelines at Scale (InfoQ)",
        "url": "https://www.infoq.com/presentations/Twitter-Timeline-Scalability/"
      },
      {
        "title": "Silberstein, Terrace, Cooper, Ramakrishnan: Feeding Frenzy: Selectively Materializing Users' Event Feeds (SIGMOD 2010)",
        "url": "https://jeffterrace.com/docs/feeding-frenzy-sigmod10-web.pdf"
      },
      {
        "title": "Engineering at Meta: Serving Facebook Multifeed: Efficiency, performance gains through redesign",
        "url": "https://engineering.fb.com/2015/03/10/production-engineering/serving-facebook-multifeed-efficiency-performance-gains-through-redesign/"
      }
    ]
  },
  "newly-unread-indicator": {
    "title": "Design: a newly-unread indicator",
    "video": {
      "youtubeId": "cr6p0n0N-VA",
      "title": "Design Whatsapp: System Design Interview w/ a Ex-Meta Senior Manager",
      "channel": "Hello Interview",
      "why": "Kept: no dedicated video exists for unread badges, and this is the clearest treatment of per-recipient inboxes, message ordering, delivery acknowledgements and multi-device cursors that the badge design builds on.",
      "length": "58:12"
    },
    "videos": [
      {
        "youtubeId": "IbwgUJcGMnA",
        "title": "Design Facebook Messenger/WhatsApp | Systems Design Questions 3.0 With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A shorter alternative walkthrough that emphasizes sequence numbers and read state across devices.",
        "length": "14:36"
      }
    ],
    "intuition": "<p>Imagine a guest book at a party with a bookmark in it. Each time you glance at the book you slide the bookmark to the last entry you were shown. The badge answers one question: \"how many different people have written since my bookmark?\" Nobody tears pages out or resets a counter; you only ever move the bookmark forward.</p><p><strong>Mental model:</strong> the badge is a derived query, count of distinct senders whose latest message position is greater than the acknowledged boundary, and the boundary only moves forward to a position the server itself issued.</p><ul><li><strong>Clearing with SET badge 0.</strong> A message that commits between building the response and the clear is silently lost from the badge.</li><li><strong>Counting the wrong thing.</strong> Unread messages, unread conversations and distinct new senders are three different product metrics; confirm which one before designing storage.</li><li><strong>Letting a stale device move the boundary backwards.</strong> Use max(current, acknowledged) so a phone that was offline for a day cannot resurrect old items.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Implementation notes for a newly-unread badge</h2>\n      <p>This design defines the badge precisely as distinct eligible senders after the last acknowledged inbox snapshot. It is not a count of unread messages or conversations, and opening the overview does not advance thread read receipts.</p>\n      \n      <h3>The unsafe clear-all approach</h3>\n      <p><code>SET badge 0</code> loses an arrival that commits after the server prepared the inbox response but before the clear. Counting rows with <code>read = false</code> also computes a different product metric from distinct senders after an overview boundary.</p>\n      \n      <h3>Prepared sender maxima</h3>\n      <p>Keep the accepted message stream authoritative. A projection may store each sender's greatest recipient-local position, for example as a Redis sorted-set member scored by position. Count members strictly above the acknowledged-through boundary. If projection progress lags, merge the projected prefix with source messages in the unprocessed tail rather than returning a stale cache value as exact.</p>\n      \n      <h3>Handling Consistency and High Water Marks</h3>\n      <p>Counters can easily drift out of sync due to network failures or race conditions. A more robust approach uses a \"High Water Mark\" or cursor. The server issues an inbox snapshot containing the recipient and the greatest accepted position included in that response. An acknowledgement names that server-issued snapshot, and the stored boundary advances by <code>max(current, snapshot_position)</code> so a delayed device cannot move it backward.</p>\n      <p>An arrival beyond the acknowledged snapshot remains newly unread even if it races with the acknowledgement. Cache loss triggers reconstruction from retained source messages or a checkpoint; it must not turn unknown state into zero.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example with positions</h2><p>Recipient-local positions are assigned when messages are accepted. Current sender maxima in the projection:</p><table><thead><tr><th>Sender</th><th>Greatest position</th></tr></thead><tbody><tr><td>alice</td><td>1040</td></tr><tr><td>bob</td><td>1045</td></tr></tbody></table><ol><li>The client opens the overview. The server builds the response, which includes everything up to position 1045, and returns snapshot token 1045.</li><li>While the response is in flight, carol's message commits at 1047 and alice sends again at 1049.</li><li>The client acknowledges snapshot 1045. The boundary becomes max(previous, 1045) = 1045.</li><li>Badge = senders with maximum above 1045 = carol (1047) and alice (1049) = <strong>2</strong>. The naive SET 0 would have shown 0 and hidden both.</li><li>An old tablet later acknowledges snapshot 1040. The boundary stays at max(1045, 1040) = 1045.</li></ol><h2>Redis projection</h2><p><code>ZADD newly:{user} GT 1049 alice</code> keeps only the greatest position per sender (the GT flag needs Redis 6.2 or later). The badge is <code>ZCOUNT newly:{user} (1045 +inf</code>, where the parenthesis makes the bound exclusive. Periodically <code>ZREMRANGEBYSCORE newly:{user} -inf 1045</code> trims senders at or below the boundary so the set stays small.</p><h2>Design options</h2><table><thead><tr><th>Approach</th><th>Correct under races?</th><th>Cost</th><th>Notes</th></tr></thead><tbody><tr><td>Counter incremented on arrival, SET 0 on open</td><td>No</td><td>Lowest</td><td>Loses arrivals that race with the clear; drifts on retries</td></tr><tr><td>COUNT unread rows at read time</td><td>Yes, but measures messages not senders</td><td>High on large inboxes</td><td>Different product metric</td></tr><tr><td>Sender maxima plus server-issued boundary</td><td>Yes</td><td>One sorted set per user</td><td>Needs projection lag handling</td></tr><tr><td>Recompute from message log on every open</td><td>Yes</td><td>Highest</td><td>Useful as the rebuild path after cache loss</td></tr></tbody></table><h2>Failure modes</h2><ul><li><strong>Projection lag:</strong> if the projector has processed up to 1046 but the log is at 1049, merge the projection with a scan of positions 1047 to 1049 rather than returning a stale count as exact.</li><li><strong>Cache loss:</strong> rebuild from retained messages or a checkpoint; never initialize an unknown badge to 0.</li><li><strong>Blocked or muted senders:</strong> eligibility is evaluated at read time, so a later block removes the sender from the count without rewriting history.</li></ul>\n</div>",
    "keyTakeaways": [
      "Keep newly-unread semantics distinct from message counts, conversation unread state, and read receipts.",
      "Use recipient-local positions and server-issued snapshot acknowledgements so racing arrivals are not cleared.",
      "A prepared sender projection may accelerate reads, but retained source messages and projection progress make lag recoverable."
    ],
    "furtherReading": [
      {
        "title": "Discord: Why Discord is switching from Go to Rust (Read States service)",
        "url": "https://discord.com/blog/why-discord-is-switching-from-go-to-rust"
      },
      {
        "title": "Engineering at Meta: Building Mobile-First Infrastructure for Messenger",
        "url": "https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/"
      },
      {
        "title": "Firebase: FCM Architectural Overview",
        "url": "https://firebase.google.com/docs/cloud-messaging/fcm-architecture"
      }
    ]
  },
  "hashtag-extraction-and-tag-store": {
    "title": "Hashtag extraction and tag store",
    "video": {
      "youtubeId": "l38XL9914fs",
      "title": "Design FB Post Search: System Design Interview breakdown w/ ex Meta Interviewer",
      "channel": "Hello Interview",
      "why": "Builds exactly this unit's core: an inverted index from keyword or hashtag to post IDs, ingestion through a queue, hot-key handling and sort-by-recency versus by-likes indexes.",
      "length": "1:08:27"
    },
    "videos": [
      {
        "youtubeId": "kx-XDoPjoHw",
        "title": "System Design Interview - Top K Problem (Heavy Hitters)",
        "channel": "System Design Interview",
        "role": "deep-dive",
        "why": "The classic deep-dive on trending computation with count-min sketch and stream aggregation, the second half of this unit.",
        "length": "36:18"
      },
      {
        "youtubeId": "eUvwRAxmEgY",
        "title": "Twitter Search/ElasticSearch Design Deep Dive with Google SWE! | Systems Design Interview Question 8",
        "channel": "Jordan has no life",
        "role": "interview",
        "why": "A complementary walkthrough of how an inverted index is sharded and kept fresh for tweet search.",
        "length": "21:41"
      }
    ],
    "intuition": "<p>A hashtag store is the index at the back of a textbook. The book (posts) is written in order; the index lists, for each word, the pages where it appears. Trending is a different question: not \"which words appear most in the whole book\" but \"which words suddenly appear far more in this chapter than they usually do\".</p><p><strong>Mental model:</strong> extraction turns each post into (tag, post_id, time) postings; storage is an inverted index partitioned by tag and time; trending compares a short-window rate against a longer baseline.</p><ul><li><strong>Partitioning only by tag.</strong> A single event tag can receive thousands of posts per second; add a time bucket and a shard suffix to the partition key.</li><li><strong>Ranking by raw count.</strong> #love will always win; trending needs velocity relative to its own baseline plus spam and bot filtering.</li><li><strong>Naive normalization.</strong> Lowercasing ASCII is not enough; apply Unicode normalization and case folding, and use a well-tested extractor so emoji, CJK and punctuation behave consistently.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Extracting and Indexing Hashtags</h2>\n      <p>Hashtags power content discovery and trending topics. Processing them at scale involves real-time text parsing, indexing, and aggregation.</p>\n      \n      <h3>Extraction Pipeline</h3>\n      <p>When a post is created, it is pushed to an asynchronous processing queue (e.g., Kafka). Stream processors (like Apache Flink or Storm) consume the posts, run regex to extract hashtags, normalize them (Unicode normalization such as NFC, case folding rather than ASCII-only lowercasing, stripping punctuation), and emit them as events.</p>\n      \n      <h3>The Tag Store (Inverted Index)</h3>\n      <p>To find all posts for a hashtag, the system uses an Inverted Index—the same core structure used by search engines like Elasticsearch. Instead of mapping a Post to its Tags, it maps a Tag to a list of Post IDs.</p>\n      <p>In a NoSQL database like Cassandra, this looks like a table partitioned by <code>(hashtag, time bucket, shard)</code>, with rows clustered by <code>post_id</code> (or time). Partitioning by hashtag alone would create unbounded hot partitions for popular tags. Reading the newest page for <code>'#systemdesign'</code> means querying the current bucket's shards and merging, a fast bounded read rather than an instant one.</p>\n      \n      <h3>Trending Algorithms</h3>\n      <p>To calculate what is \"trending,\" you don't just count the total volume of a tag; you calculate its velocity. An algorithm like Exponential Moving Average (EMA) or sliding window counters (often using Redis or Count-Min Sketches for memory efficiency) gives higher weight to hashtags that have suddenly spiked in usage in the last few minutes compared to their historical baseline.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: volume and hot tags</h2><p>Assume 500 million posts per day, 20 percent carrying hashtags with an average of 2 tags each: 200 million postings per day, about 2,300 per second on average and perhaps 10 times that during a global event. At 16 bytes per posting (post ID plus timestamp) that is about 3.2 GB of raw index per day before replication and overhead.</p><p>During a final, one tag might see 50,000 posts per minute, about 830 writes per second into one partition, and millions of reads of its first page. Use a partition key like <code>(tag, day, shard)</code> with shard = hash(post_id) mod 16, so writes spread across 16 partitions; readers fetch the newest page from each shard and merge (or read a cached merged first page refreshed every few seconds).</p><h2>Trending with bounded memory</h2><p>A count-min sketch with width w = ceil(e / epsilon) and depth d = ceil(ln(1 / delta)) overestimates any count by at most epsilon x N with probability 1 - delta, where N is the number of events in the window. With epsilon = 0.00001 and delta = 0.01 that is w = 271,829 and d = 5, about 1.36 million 4-byte counters or 5.4 MB per window. If a 5 minute window holds 10 million tag events, the error bound is at most 100 counts. Keep a small heap of the top candidates, then score each by something like (count_now + a) / (baseline_rate + b), where the smoothing constants stop tiny tags going from 1 to 5 from looking like a 500 percent spike.</p><h2>Storage options</h2><table><thead><tr><th>Store</th><th>Serves</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>Wide-column table by (tag, bucket)</td><td>Newest posts for a tag</td><td>Cheap appends, simple range reads</td><td>No relevance ranking or multi-term queries</td></tr><tr><td>Search engine (Elasticsearch, OpenSearch, Lucene based)</td><td>Tag plus keyword plus filters</td><td>Rich queries and ranking</td><td>Refresh lag, heavier operations</td></tr><tr><td>Redis sorted set per hot tag</td><td>First page of hot tags</td><td>Very low latency</td><td>Memory bound; needs trimming</td></tr><tr><td>Stream processor state (Flink)</td><td>Windowed trending counts</td><td>Exactly-once windows, event time</td><td>Not a query store; publish results elsewhere</td></tr></tbody></table><h2>How real systems do it</h2><ul><li>Twitter open-sourced the twitter-text libraries so every client and server extracted hashtags identically, and its search tier (Earlybird) is an in-memory, time-partitioned inverted index built on Lucene ideas.</li><li>Twitter's trends explicitly favour topics that are spiking now over topics that are merely always popular.</li></ul>\n</div>",
    "keyTakeaways": [
      "Hashtag extraction is done asynchronously via stream processing.",
      "An Inverted Index is used to map hashtags to lists of content.",
      "Trending algorithms prioritize velocity and sudden spikes over sheer total volume."
    ],
    "furtherReading": [
      {
        "title": "Elasticsearch Inverted Index",
        "url": "https://www.elastic.co/guide/en/elasticsearch/reference/current/documents-indices.html"
      },
      {
        "title": "Twitter Engineering: Building a new trends experience",
        "url": "https://blog.x.com/engineering/en_us/a/2015/building-a-new-trends-experience"
      },
      {
        "title": "Cormode & Muthukrishnan: An Improved Data Stream Summary: The Count-Min Sketch and Its Applications (LATIN 2004)",
        "url": "https://link.springer.com/chapter/10.1007/978-3-540-24698-5_7"
      }
    ]
  },
  "reaction-modeling": {
    "title": "Reaction modeling",
    "video": {
      "youtubeId": "RLdh1vQsVIQ",
      "title": "Design the Facebook Like Button | Systems Design Questions 3.0 With Ex-Google SWE",
      "channel": "Jordan has no life",
      "why": "Dedicated to exactly this problem: per-user reaction state, idempotency, hot counters and asynchronous aggregation.",
      "length": "17:35"
    },
    "videos": [
      {
        "youtubeId": "LGOnP9Udffo",
        "title": "How Facebook & YouTube Handle BILLIONS of Likes & Views!",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "Short visual intro to sharded counters, buffering and eventual consistency for like and view counts.",
        "length": "8:16"
      },
      {
        "youtubeId": "yqc3PPmHvrA",
        "title": "Streaming a Million Likes/Second: Real-Time Interactions on Live Video",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "LinkedIn's talk on delivering reactions in real time at a million per second, showing the read and fan-out side of reactions.",
        "length": "49:36"
      }
    ],
    "intuition": "<p>Think of an election. The register of who voted and for whom is the source of truth; the big tally board in the town square is a derived summary that can be recomputed from the register. Nobody updates the tally board directly by shouting \"plus one\" at it, because shouts get lost or repeated.</p><p><strong>Mental model:</strong> store one row per (post, user) as the truth, and derive counts from changes to that row asynchronously and idempotently.</p><ul><li><strong>Incrementing counters from raw clicks.</strong> Double taps, retries and replays double-count; only count a transition of the (post, user) row, such as none to like or like to love.</li><li><strong>Keeping the per-user state only as a UI cache.</strong> It must be the durable record, or you cannot answer \"did I like this?\" or rebuild counts.</li><li><strong>Promising exact live counts.</strong> Products routinely show approximate or lagging counts on viral posts; say so explicitly.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Designing Like and Reaction Systems</h2>\n      <p>Likes and reactions (Love, Haha, Wow) generate the highest volume of write traffic on a social network. Modeling this data efficiently is vital for both fast ingestion and fast display.</p>\n      \n      <h3>Denormalization is Key</h3>\n      <p>When rendering a feed, you need to know two things: the total reaction count, and whether the viewing user has reacted. A normalized SQL approach (checking a Reactions table for every post) is too slow.</p>\n      <p>Instead, the <code>Posts</code> table itself stores denormalized counters: <code>like_count</code>, <code>love_count</code>, etc. When a reaction occurs, these counters are incremented. The user's specific reaction is stored as a durable (post, user) record, which is the source of truth from which counters are derived; a fast key-value cache of it lets the UI highlight the correct button.</p>\n      \n      <h3>Handling High Write Throughput</h3>\n      <p>For viral posts, incrementing a counter in a database causes severe lock contention (Hot Key Problem). If a million people like a post in a minute, updating that single row directly degrades into lock contention, timeouts and failed writes.</p>\n      <p>To solve this, systems use asynchronous buffering. Reactions are dropped into a Kafka queue. A background worker aggregates the counts (e.g., \"+500 likes in the last second\") and performs a single bulk update to the database. Alternatively, Redis can handle high-throughput atomic increments (<code>INCR</code>) and sync to the persistent database periodically. Either way, increments must be idempotent and deduplicated (count only state transitions of the (post, user) record), otherwise retries and replays double-count.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: a viral post</h2><p>One million likes arrive in 60 seconds: about 16,700 per second on a single post. A single relational row under contention serializes on its row lock and typically sustains only hundreds to low thousands of updates per second, so updating <code>posts.like_count</code> directly cannot keep up.</p><ol><li><strong>Source of truth:</strong> <code>reactions(post_id, user_id, type, updated_at)</code> with primary key (post_id, user_id). An upsert is naturally idempotent: pressing like twice leaves one row.</li><li><strong>Change events:</strong> the upsert emits a delta only when the state actually changes: none to like gives like +1; like to love gives like -1 and love +1; love to none gives love -1. Emit via an outbox table or change data capture so the event is not lost if the process crashes after commit.</li><li><strong>Aggregation:</strong> a stream job sums deltas per post over 1 second windows and applies one write per post per second, turning 16,700 writes per second into 1.</li><li><strong>Alternative:</strong> sharded counters, for example 64 sub-counter rows per hot post (about 260 writes per second each), summed on read or cached.</li></ol><h2>Design options</h2><table><thead><tr><th>Approach</th><th>Write throughput</th><th>Count freshness</th><th>Correctness risk</th></tr></thead><tbody><tr><td>Update counter column directly</td><td>Low on hot rows</td><td>Immediate</td><td>Lock contention, timeouts</td></tr><tr><td>Redis INCR, periodic flush</td><td>Very high</td><td>Seconds</td><td>Lost increments on failover unless reconciled</td></tr><tr><td>Sharded counters</td><td>High, scales with shard count</td><td>Immediate but read sums N rows</td><td>More complex reads</td></tr><tr><td>Stream aggregation of deltas</td><td>Very high</td><td>Window length (1 to 10 s)</td><td>Needs dedup and idempotent apply</td></tr></tbody></table><div class=\"mermaid\">flowchart LR\n    U[\"User taps reaction\"] --> DB[\"Upsert reactions row\"]\n    DB --> OB[\"Outbox or CDC delta\"]\n    OB --> K[\"Kafka topic keyed by post\"]\n    K --> AGG[\"Windowed aggregator\"]\n    AGG --> CNT[\"Counter store per post and type\"]\n    CNT --> FEED[\"Feed rendering reads counts\"]\n</div><h2>Reconciliation and real systems</h2><ul><li>Run a periodic job that recounts reactions rows for recently active posts and corrects counter drift.</li><li>YouTube famously froze public view counts near 300 while it validated views (until it retired the \"301+\" freeze in 2015), a real example of choosing correctness over live freshness.</li><li>LinkedIn's live video reactions travel through an in-memory publish/subscribe layer to viewers, while the durable counts are updated separately.</li></ul>\n</div>",
    "keyTakeaways": [
      "Reaction counts must be denormalized directly onto the post or content object.",
      "High-velocity reactions on viral posts cause database lock contention.",
      "Use stream aggregation (buffering in Kafka) or Redis to batch database updates."
    ],
    "furtherReading": [
      {
        "title": "Engineering at Meta: TAO: The power of the graph",
        "url": "https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/"
      },
      {
        "title": "Scaling Memcache at Facebook (NSDI 2013)",
        "url": "https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf"
      }
    ]
  },
  "photo-tagging-coordinate-model": {
    "title": "Design: photo tagging coordinates",
    "video": {
      "youtubeId": "VJpfO6KdyWE",
      "title": "System Design Mock Interview: Design Instagram",
      "channel": "Aced (formerly Exponent)",
      "why": "No dedicated photo-tagging video exists; this mock interview covers the surrounding design (photo storage, metadata tables, tagging users and feed fan-out) in the most directly relevant way.",
      "length": "31:12"
    },
    "videos": [
      {
        "youtubeId": "hnpzNAPiC0E",
        "title": "Scaling Instagram Infrastructure",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "Instagram's own talk on the storage, caching and asynchronous processing that social actions like tagging rely on.",
        "length": "51:12"
      }
    ],
    "intuition": "<p>Imagine leaving a sticky note on a printed photo that says \"Sam is 40 percent from the left and 30 percent from the top\". Whether the photo is printed as a wallet size or a poster, the note still points at Sam. Store tags as fractions of a specific image version, never as pixels on one screen.</p><p><strong>Mental model:</strong> a tag is (image_version, u, v, target, state), with u and v in [0, 1] measured on the canonical, orientation-corrected image; every rendering maps fractions to pixels through the same transform used to draw the image.</p><ul><li><strong>Ignoring EXIF orientation and crops.</strong> A phone photo stored sideways with a rotation flag, or shown as a square center-crop thumbnail, needs the same transform applied to the tag, or the tag lands on the wrong face.</li><li><strong>Tying tags to a mutable image.</strong> If the owner re-crops or replaces the photo, tags must be re-validated against the new version, not silently reused.</li><li><strong>Doing notifications and timeline fan-out synchronously.</strong> Tag creation should commit fast; approval, privacy checks and notifications run asynchronously and idempotently.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>System Design: Photo Tagging</h2>\n      <p>Photo tagging requires mapping a user entity to specific geometric coordinates within an image. This involves coordinate mathematics, database modeling, and permission handling.</p>\n      \n      <h3>Coordinate Modeling</h3>\n      <p>Image dimensions vary across devices, so storing absolute pixel coordinates (e.g., x:400, y:300) is fragile. Instead, tags are stored using relative coordinates (percentages). This design stores a normalized point <code>(u, v)</code> tied to an immutable image version. If the product needs boxes, declare a separate representation such as normalized corners <code>(u1, v1, u2, v2)</code> and validate positive in-bounds extents; do not imply box dimensions that the shown schema does not store. The client application multiplies these by the rendered image dimensions to draw the box accurately on any screen.</p>\n      \n      <h3>Database Schema</h3>\n      <p>A relational approach works well here since tags are closely tied to the photo entity. A point-tag table includes image and immutable version IDs, target and creator account IDs, normalized <code>u</code>/<code>v</code>, approval state, and operation/revision metadata. A box-tag extension must add its declared corner fields consistently.</p>\n      \n      <h3>Fan-out and Permissions</h3>\n      <p>Tagging someone is a social action. When a tag is created, it triggers a workflow: notification generation, privacy checks, and timeline fan-out. If User A tags User B, the photo might need to appear on User B's timeline, subject to User B's privacy settings. This complexity requires the tagging action to be processed asynchronously, keeping the initial tag creation API call fast.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: from tap to stored tag to rendering</h2><ol><li>The canonical image version is 4032 x 3024 pixels after applying EXIF orientation.</li><li>The user taps at pixel (1612, 907) on that image: u = 1612 / 4032 = 0.3998, v = 907 / 3024 = 0.2999. Store u = 0.3998, v = 0.2999 with image_version_id.</li><li>On a phone showing the image at 375 x 281 points: x = 0.3998 x 375 = 150, y = 0.2999 x 281 = 84.</li><li>In a square center-crop thumbnail, the crop is 3024 x 3024 starting at x offset 504. The tag's position in the crop is u' = (1612 - 504) / 3024 = 0.366, v' = 0.2999. If u' fell outside [0, 1], the tag would be hidden in that view.</li></ol><p>For boxes, store (u1, v1, u2, v2) and validate 0 &lt;= u1 &lt; u2 &lt;= 1 and 0 &lt;= v1 &lt; v2 &lt;= 1, so every box has positive, in-bounds extent.</p><h2>Representation trade-offs</h2><table><thead><tr><th>Representation</th><th>Survives resizing</th><th>Survives crop or rotation</th><th>Notes</th></tr></thead><tbody><tr><td>Absolute pixels on one rendition</td><td>No</td><td>No</td><td>Breaks on every other device</td></tr><tr><td>Normalized (u, v) on the original</td><td>Yes</td><td>Only with an explicit transform</td><td>Must know which orientation was normalized</td></tr><tr><td>Normalized on an immutable image version</td><td>Yes</td><td>Yes, via the version's recorded crop and rotation</td><td>Recommended; edits create a new version and re-validation</td></tr></tbody></table><h2>Workflow and privacy</h2><div class=\"mermaid\">flowchart LR\n    T[\"Create tag request\"] --> V[\"Validate version and bounds\"]\n    V --> S[\"Insert tag with state pending or approved\"]\n    S --> Q[\"Queue tag event\"]\n    Q --> P[\"Privacy and block checks\"]\n    P --> N[\"Notify tagged user\"]\n    P --> F[\"Add to tagged user timeline if approved\"]\n</div><ul><li>Tag review: the tagged user can approve before the photo appears on their profile, and can remove a tag at any time; removal must also retract fan-out.</li><li>Blocks: a blocked user cannot tag you, and the check runs at write time and again at render time.</li><li>Idempotency: a retried tag request carries a client operation ID, so the tag and its notification are created once.</li></ul>\n</div>",
    "keyTakeaways": [
      "Store image coordinates as relative percentages, not absolute pixels.",
      "Tags involve complex privacy and permission workflows.",
      "The social fan-out resulting from a tag should be handled asynchronously."
    ],
    "furtherReading": [
      {
        "title": "MDN: Coordinate systems (CSSOM View)",
        "url": "https://developer.mozilla.org/en-US/docs/Web/API/CSSOM_view_API/Coordinate_systems"
      },
      {
        "title": "W3C: Media Fragments URI 1.0 (spatial xywh fragments, pixel and percent)",
        "url": "https://www.w3.org/TR/media-frags/"
      },
      {
        "title": "de Berg, Cheong, van Kreveld & Overmars: Computational Geometry: Algorithms and Applications (3rd ed., Springer, 2008)",
        "url": "https://doi.org/10.1007/978-3-540-77974-2"
      }
    ]
  },
  "live-commentary-system-design": {
    "title": "Design: live commentary",
    "video": {
      "youtubeId": "LjLx0fCd1k8",
      "title": "System Design Interview: Design Live Comments w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "A full, deep walkthrough of exactly this problem: SSE versus WebSockets for viewers, partitioning by live video, pub/sub fan-out to many servers, and hot-stream handling.",
      "length": "56:15"
    },
    "videos": [
      {
        "youtubeId": "yqc3PPmHvrA",
        "title": "Streaming a Million Likes/Second: Real-Time Interactions on Live Video",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "LinkedIn's production architecture for fanning out live reactions and comments to huge audiences, with a clear subscription-table design.",
        "length": "49:36"
      },
      {
        "youtubeId": "X7AQ_f-ki3s",
        "title": "Its all WebSockets! - Devtooling Twitch",
        "channel": "Hussein Nasser",
        "role": "case-study",
        "why": "Inspects how Twitch chat actually flows over WebSockets in the browser, grounding the design in a real system.",
        "length": "21:29"
      }
    ],
    "intuition": "<p>A stadium does not have each fan phone every other fan. There is one public-address system: announcements go to a few loudspeaker towers, and each tower broadcasts to the seats near it. When the crowd is huge, the announcer also stops reading every single message and picks the highlights.</p><p><strong>Mental model:</strong> live commentary is hierarchical fan-out, one channel to N edge servers to M local viewers, with sampling and batching at the edge because no human can read 10,000 messages per second.</p><ul><li><strong>Fanning out per viewer from a central service.</strong> Each edge server should subscribe to a channel once and fan out locally, so central fan-out scales with servers, not viewers.</li><li><strong>Putting the database on the live path.</strong> Persist asynchronously for replay; serve live traffic from memory.</li><li><strong>Forgetting moderation and ordering.</strong> Deleted or banned messages must be retracted at the edge, and viewers joining late need the last few seconds of context, not the whole history.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Designing Live Commentary (Twitch Chat)</h2>\n      <p>Live commentary for events (sports, game streams) presents unique challenges: extreme write throughput concentrated on a single channel, and the need for sub-second read latency for millions of viewers simultaneously.</p>\n      \n      <h3>The Hot Key Dilemma</h3>\n      <p>Standard database partitions group data by chat room ID. But if a popular streamer has 500,000 concurrent viewers chatting, that single partition will be overwhelmed, leading to massive lag or failure.</p>\n      \n      <h3>In-Memory Pub/Sub and Sampling</h3>\n      <p>To handle this, live commentary completely bypasses persistent storage for the hot read path. Messages are routed through a highly distributed Pub/Sub system (for example Redis, where Redis 7 sharded pub/sub avoids classic Redis Cluster broadcasting every PUBLISH to all nodes, or a purpose-built layer such as Twitch's chat Edge and Pubsub services). The WebSocket servers subscribe to the channel and push messages directly to viewers.</p>\n      <p>When velocity is too high (e.g., 10,000 messages per second), human readability is impossible. The WebSocket servers intelligently drop or sample messages before sending them down the wire to prevent crashing the client's browser and to save bandwidth.</p>\n      \n      <h3>Asynchronous Persistence</h3>\n      <p>While the live chat is served from memory, the messages are simultaneously sent to a Kafka topic. Background consumer workers batch these messages and write them in bulk to a cold storage database (like Cassandra) for later VOD (Video on Demand) playback, completely decoupling the live experience from disk I/O.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: 500,000 viewers, 2,000 messages per second</h2><ul><li><strong>Naive fan-out:</strong> 2,000 messages x 500,000 viewers = 1 billion deliveries per second. Impossible.</li><li><strong>Sample at the edge:</strong> show each viewer at most 20 messages per second (already more than a human can read) and prefer messages from friends, moderators and verified accounts. Deliveries drop to 10 million per second.</li><li><strong>Batch:</strong> flush every 200 ms, so each viewer receives 5 frames per second; with 250 edge servers holding 2,000 viewers each, that is 10,000 frames per second per server, which is comfortable.</li><li><strong>Central fan-out:</strong> the channel's pub/sub topic publishes each message once to 250 subscribed edge servers, 500,000 internal messages per second for this stream instead of 1 billion.</li></ul><div class=\"mermaid\">flowchart LR\n    W[\"Commenters\"] --> I[\"Ingest and moderation\"]\n    I --> PS[\"Pub/sub topic per live stream\"]\n    I --> K[\"Kafka for persistence\"]\n    K --> DB[\"Cassandra for replay\"]\n    PS --> E1[\"Edge server 1\"]\n    PS --> E2[\"Edge server 2\"]\n    PS --> E3[\"Edge server N\"]\n    E1 --> V1[\"Local viewers via SSE or WebSocket\"]\n    E2 --> V2[\"Local viewers\"]\n    E3 --> V3[\"Local viewers\"]\n</div><h2>Controlling the firehose</h2><table><thead><tr><th>Technique</th><th>What it does</th><th>Trade-off</th></tr></thead><tbody><tr><td>Sampling</td><td>Randomly keep a fraction of messages per viewer</td><td>Viewers see different subsets; fine for chat, not for scores</td></tr><tr><td>Prioritization</td><td>Always keep friends, hosts, moderators, paid highlights</td><td>Needs per-viewer context at the edge</td></tr><tr><td>Batching</td><td>Send one frame every 100 to 500 ms</td><td>Adds up to one batch interval of latency</td></tr><tr><td>Slow mode and rate limits</td><td>Limit each commenter to one message every N seconds</td><td>Product friction, but reduces spam and load at the source</td></tr><tr><td>Coalescing reactions</td><td>Send counts per emoji per interval, not individual taps</td><td>Loses per-user detail, which viewers do not need</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>LinkedIn</strong> keeps an in-memory subscription table mapping each live video to the front-end servers with viewers, and a dispatcher publishes each event only to those servers, which then fan out to their connections.</li><li><strong>Twitch</strong> chat runs over WebSockets with edge servers holding viewer connections and a separate distribution layer between them.</li><li>If you use Redis for the pub/sub layer, note that classic Redis Cluster PUBLISH is broadcast to every node; Redis 7 sharded pub/sub (SPUBLISH) keeps a channel's traffic on its own shard.</li></ul>\n</div>",
    "keyTakeaways": [
      "Live fanout can use an in-memory path for low latency, while durable source positions support reconnect, moderation, and replay.",
      "Use Pub/Sub and WebSocket fan-out for sub-second latency.",
      "At unreadable rates, apply an explicit server/client coalescing or sampling policy and preserve moderation and durable-history requirements separately."
    ],
    "furtherReading": [
      {
        "title": "Twitch Engineering: An Introduction and Overview (chat architecture)",
        "url": "https://blog.twitch.tv/en/2015/12/18/twitch-engineering-an-introduction-and-overview-a23917b71a25"
      },
      {
        "title": "Discord: How Discord Stores Billions of Messages (2017)",
        "url": "https://discord.com/blog/how-discord-stores-billions-of-messages"
      }
    ]
  }
};
