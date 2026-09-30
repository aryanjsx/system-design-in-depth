window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-reliability-ops"] = {
  "observability-for-distributed-systems": {
    "title": "Observability for distributed systems",
    "video": {
      "youtubeId": "2nTJSsBngao",
      "title": "Observability, Distributed Tracing & the Complex World • Dave McAllister • GOTO 2019",
      "channel": "GOTO Conferences",
      "why": "A vendor-neutral conference talk that explains why metrics, logs and traces answer different questions and how trace context ties them together across services.",
      "length": "37:26"
    },
    "videos": [
      {
        "youtubeId": "-U9E1PhrM3o",
        "title": "SRE Golden Signals Explained",
        "channel": "IBM Technology",
        "role": "intro",
        "why": "Short whiteboard explanation of latency, traffic, errors and saturation, the metric set the lesson recommends alerting on.",
        "length": "5:43"
      },
      {
        "youtubeId": "gviWKCXwyvY",
        "title": "Context Propagation makes OpenTelemetry awesome",
        "channel": "Lightstep is now ServiceNow Cloud Observability ",
        "role": "deep-dive",
        "why": "Focuses on the one mechanism that makes distributed tracing work: carrying trace and span IDs across process boundaries.",
        "length": "9:40"
      }
    ],
    "intuition": "<p>Think of a parcel moving through a courier network. <strong>Metrics</strong> are the depot dashboard (\"4,000 parcels per hour, 2% late\"). <strong>Logs</strong> are the clerk's notebook entries (\"parcel 88 scanned at 09:14, label torn\"). A <strong>trace</strong> is the tracking number printed on the parcel itself, so you can follow one parcel through every depot and see where it waited.</p><p><strong>Mental model:</strong> metrics tell you <em>that</em> something is wrong and how big the problem is, traces tell you <em>where</em> in the call graph it is, and logs tell you <em>why</em> for one specific event.</p><ul><li><strong>Trap: high-cardinality labels on metrics.</strong> Putting <code>user_id</code> or a full URL on a Prometheus metric can turn a few thousand time series into millions and take down the metrics backend. Put those fields in logs or trace attributes.</li><li><strong>Trap: averages instead of percentiles.</strong> Mean latency hides the slow tail that users feel. Record histograms and alert on p99 or on an SLO.</li><li><strong>Trap: breaking the trace.</strong> A single service or queue consumer that does not forward the <code>traceparent</code> header splits one request into disconnected fragments.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Three Pillars: Metrics, Logs, and Distributed Tracing</h2>\n      <p>In distributed microservices, inspecting a single server's logs is insufficient to debug intermittent errors or latency spikes. Observability answers <em>why</em> a system is misbehaving by synthesizing three complementary telemetry signals:</p>\n      <ul>\n        <li><strong>Metrics (Aggregated Numbers):</strong> Time-series counters, gauges, and histograms (via Prometheus). Extremely cheap to store, ideal for alerting and dashboards.</li>\n        <li><strong>Logs (Detailed Events):</strong> Structured JSON records of distinct occurrences (via Elasticsearch / Loki). Essential for forensic analysis of specific errors.</li>\n        <li><strong>Distributed Tracing (Request Context):</strong> Propagates a unique <code>trace_id</code> and parent <code>span_id</code> across network boundaries (via OpenTelemetry / Jaeger), reconstructing the end-to-end execution timeline across dozens of microservices.</li>\n      </ul>\n\n      <h2>The Four Golden Signals</h2>\n      <p>Google's SRE framework defines the four critical health metrics for any production service: <strong>Latency</strong> (time to service a request), <strong>Traffic</strong> (QPS / demand), <strong>Errors</strong> (rate of failed requests), and <strong>Saturation</strong> (how constrained the most constrained resource is, e.g., memory or thread pool capacity).</p>\n    \n<!-- enriched -->\n<h2>Worked example: sizing telemetry for one service fleet</h2><p>Suppose a checkout API handles <strong>10,000 requests per second</strong> and each request touches 8 services, producing about 20 spans of roughly 500 bytes each.</p><ul><li><strong>Traces at 100% sampling:</strong> 10,000 x 20 x 500 B = 100 MB/s, or about 8.6 TB per day. Few teams keep this.</li><li><strong>Head sampling at 1%:</strong> about 86 GB per day, but the one slow request in ten thousand is likely to be dropped.</li><li><strong>Tail sampling:</strong> a collector buffers each trace for a few seconds, then keeps every trace with an error or with latency above p99, plus a 1% baseline. The volume stays small and the traces you keep are the ones you would want to look at.</li><li><strong>Metrics:</strong> a latency histogram with 12 buckets, labelled by <code>endpoint</code> (40), <code>status_class</code> (5) and <code>region</code> (3), is 40 x 5 x 3 x 12 = 7,200 series. Adding <code>customer_id</code> with 200,000 values would multiply that to about 1.4 billion series. This is why identifiers go in logs and traces rather than in metric labels.</li></ul><h2>Choosing the right signal</h2><table><thead><tr><th>Signal</th><th>Best question it answers</th><th>Cost driver</th><th>Typical tools</th></tr></thead><tbody><tr><td>Metrics</td><td>Is the service healthy right now, and is it getting worse?</td><td>Number of unique label combinations (cardinality)</td><td>Prometheus, Mimir, Datadog, CloudWatch</td></tr><tr><td>Logs</td><td>What exactly happened to this request or user?</td><td>Bytes ingested and indexed</td><td>Loki, Elasticsearch/OpenSearch, Splunk</td></tr><tr><td>Traces</td><td>Which hop added the latency or produced the error?</td><td>Spans kept after sampling</td><td>OpenTelemetry, Jaeger, Tempo, Honeycomb</td></tr><tr><td>Profiles</td><td>Which function is burning CPU or memory?</td><td>Sampling frequency</td><td>pprof, Pyroscope, Parca</td></tr></tbody></table><h2>How the signals connect during an incident</h2><div class=\"mermaid\">flowchart LR\n  A[\"Alert: checkout p99 above SLO\"] --> B[\"Dashboard: errors rising only in eu-west\"]\n  B --> C[\"Exemplar trace from the slow histogram bucket\"]\n  C --> D[\"Span shows 2 s wait on inventory-db\"]\n  D --> E[\"Logs filtered by trace_id show lock timeout\"]</div><p>The links in that chain are <strong>exemplars</strong> (a trace ID attached to a histogram sample) and a <strong>trace_id field in every log line</strong>. Without them an engineer has to line up timestamps across tools by hand.</p><h2>Failure modes to design for</h2><ul><li><strong>The monitoring system goes down with the thing it monitors.</strong> Keep alerting on independent infrastructure, and add a \"dead man's switch\" alert that fires if the metrics pipeline stops reporting.</li><li><strong>Clock skew.</strong> Spans from hosts with drifting clocks can appear to start before their parent. Trace UIs fix this up using parent-child relationships, but rely on NTP or PTP anyway.</li><li><strong>Log storms.</strong> A failing dependency can multiply log volume tenfold within minutes. Rate-limit or sample repetitive error logs at the agent.</li></ul><p>In practice, Google's Dapper paper (2010) established low-rate sampled tracing with propagated context. OpenTelemetry now standardises the APIs and the W3C <code>traceparent</code> header so that traces cross language and vendor boundaries.</p>\n</div>",
    "keyTakeaways": [
      "Combine Metrics (alerting), Logs (context), and Distributed Tracing (cross-service latency diagnosis).",
      "Standardize telemetry collection across languages using OpenTelemetry (OTel).",
      "Monitor the Four Golden Signals: Latency, Traffic, Errors, and Saturation."
    ],
    "furtherReading": [
      {
        "title": "Google SRE Book: Monitoring Distributed Systems",
        "url": "https://sre.google/sre-book/monitoring-distributed-systems/"
      },
      {
        "title": "OpenTelemetry: Observability Primer",
        "url": "https://opentelemetry.io/docs/concepts/observability-primer/"
      }
    ]
  },
  "slos-and-error-budgets": {
    "title": "SLOs and error budgets",
    "video": {
      "youtubeId": "tEylFyxbDLE",
      "title": "SLIs, SLOs, SLAs, oh my! (class SRE implements DevOps)",
      "channel": "Google Cloud Tech",
      "why": "Liz Fong-Jones and Seth Vargo, both from Google, explain SLI vs SLO vs SLA and error budgets in eight minutes. This is the original source that the current video only paraphrases.",
      "length": "8:05"
    },
    "videos": [
      {
        "youtubeId": "_2th8LDnvQk",
        "title": "SREcon18 Asia/Australia - A Theory and Practice of Alerting with Service Level Objectives",
        "channel": "USENIX",
        "role": "deep-dive",
        "why": "Covers the practical step the lesson skips: turning an SLO into burn-rate alerts that page on real problems without paging on noise.",
        "length": "40:45"
      }
    ],
    "intuition": "<p>An error budget is like a monthly mobile data allowance. The <strong>SLO</strong> is the plan (\"99.9% of requests succeed this month\"). The <strong>error budget</strong> is the 0.1% you are allowed to use up. The <strong>SLI</strong> is the meter that counts what you have used. If you burn half the allowance in the first three days, you change your behaviour: fewer risky launches and more reliability work. The <strong>SLA</strong> is the contract with the provider that says what refund you get if they fall short of it.</p><p><strong>Mental model:</strong> reliability is a budget you spend on shipping changes. It is not a score to maximise.</p><ul><li><strong>Trap: SLO equals SLA.</strong> The internal SLO should be stricter than the external SLA, for example 99.95% internally against 99.9% in the contract, so you notice problems before they cost money.</li><li><strong>Trap: measuring at the server only.</strong> An SLI measured at the load balancer or the client catches failures that server metrics never see, such as DNS, TLS and routing problems.</li><li><strong>Trap: alerting on a raw error rate.</strong> \"Page if errors exceed 1% for 5 minutes\" is either too noisy or too slow. Alert on how fast the budget is burning instead.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>SLI, SLO, and SLA Demystified</h2>\n      <ul>\n        <li><strong>SLI (Service Level Indicator):</strong> A carefully defined metric that measures service behavior (e.g., <em>\"percentage of HTTP requests returning in &lt; 200ms with a 2xx status\"</em>).</li>\n        <li><strong>SLO (Service Level Objective):</strong> An internal target reliability threshold agreed upon between product and engineering teams (e.g., <em>\"99.9% of requests meet the SLI over a 30-day rolling window\"</em>).</li>\n        <li><strong>SLA (Service Level Agreement):</strong> A commercial contract with customers specifying legal and financial penalties (refunds, credits) if reliability drops below a contractual threshold (e.g., 99.5%).</li>\n      </ul>\n\n      <h2>The Error Budget Concept</h2>\n      <p>A 100% target is usually impractical and can suppress useful change. If an availability SLO is 99.9%, its error budget is the remaining 0.1% of eligible events in the stated window. Teams use a written error-budget policy to decide which risky changes to slow or stop when burn is excessive; an automatic freeze of every release is one possible policy, not part of the definition, and urgent security or reliability fixes may still need to ship.</p>\n    \n<!-- enriched -->\n<h2>Worked example: what \"three nines\" actually allows</h2><table><thead><tr><th>SLO (30-day window)</th><th>Error budget</th><th>Allowed full downtime</th><th>At 50M requests/month</th></tr></thead><tbody><tr><td>99%</td><td>1%</td><td>7 h 12 min</td><td>500,000 failed requests</td></tr><tr><td>99.9%</td><td>0.1%</td><td>43 min 12 s</td><td>50,000 failed requests</td></tr><tr><td>99.95%</td><td>0.05%</td><td>21 min 36 s</td><td>25,000 failed requests</td></tr><tr><td>99.99%</td><td>0.01%</td><td>4 min 19 s</td><td>5,000 failed requests</td></tr></tbody></table><p>Each extra nine cuts the budget by a factor of ten, and the engineering cost usually rises steeply with it. A 99.99% target leaves roughly four minutes a month, which is less than the time it takes a person to get paged, log in and roll back. At that level, detection and mitigation have to be automated.</p><h2>Burn-rate alerting</h2><p><strong>Burn rate</strong> is how fast you are consuming the budget relative to an even spend. A burn rate of 1 uses exactly the whole budget over the 30-day window. The Google SRE Workbook recommends multi-window alerts such as:</p><table><thead><tr><th>Burn rate</th><th>Long window</th><th>Short window</th><th>Budget consumed</th><th>Action</th></tr></thead><tbody><tr><td>14.4</td><td>1 hour</td><td>5 minutes</td><td>2%</td><td>Page</td></tr><tr><td>6</td><td>6 hours</td><td>30 minutes</td><td>5%</td><td>Page</td></tr><tr><td>1</td><td>3 days</td><td>6 hours</td><td>10%</td><td>Ticket</td></tr></tbody></table><p>Where 14.4 comes from: 2% of a 720-hour window is 14.4 hours of budget, and spending it in 1 hour is a 14.4x burn. For a 99.9% SLO, the page fires when the error ratio over the last hour is above 14.4 x 0.1% = 1.44%, <em>and</em> the last 5 minutes are also above that level. The short window makes the alert clear quickly once the problem is fixed.</p><h2>Writing a good SLI</h2><ul><li><strong>Ratio form:</strong> good events divided by valid events. For example, requests to <code>/checkout</code> that returned a non-5xx status within 300 ms, divided by all requests to <code>/checkout</code> excluding health checks.</li><li><strong>Choose what users feel:</strong> availability and latency for APIs, freshness for data pipelines, durability for storage.</li><li><strong>Low-traffic services:</strong> at 100 requests per hour, a single failure is 1% of the hour. Use longer windows, synthetic probes, or combine several services into one SLO.</li></ul><h2>The error-budget policy</h2><p>The written policy is what gives the budget any force. A typical policy says that while the budget is exhausted, only reliability fixes and security patches ship, and a postmortem is required for any single incident that used more than 20% of the budget. Product and engineering leadership agree to the policy in advance, so nobody argues about it in the middle of an incident.</p>\n</div>",
    "keyTakeaways": [
      "SLIs measure, SLOs set targets, and SLAs impose commercial consequences.",
      "100% uptime is never the goal; error budgets balance feature velocity against stability.",
      "When the error budget burns too fast, enforce deployment freezes to protect user trust."
    ],
    "furtherReading": [
      {
        "title": "Google SRE Book: Service Level Objectives",
        "url": "https://sre.google/sre-book/service-level-objectives/"
      },
      {
        "title": "Google SRE Workbook: Implementing SLOs",
        "url": "https://sre.google/workbook/implementing-slos/"
      },
      {
        "title": "Alex Hidalgo: Implementing Service Level Objectives (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/implementing-service-level/9781492076803/"
      }
    ]
  },
  "incident-response": {
    "title": "Incident response",
    "video": {
      "youtubeId": "Zn8-R6Pt9hY",
      "title": "Mastering Outages with Incident Command for DevOps: Learning from the Fire Department",
      "channel": "IT Revolution",
      "why": "Brent Chapman, who helped bring the fire-service Incident Command System to Google SRE, explains the IC, Ops and Comms roles and why they work.",
      "length": "28:20"
    },
    "videos": [
      {
        "youtubeId": "jVazxj1G_Eo",
        "title": "SREcon16 Europe - Incident Response @ FB, Facebook's SEV Process",
        "channel": "USENIX",
        "role": "case-study",
        "why": "A real company's severity levels, escalation and review process, from the people who run it.",
        "length": "38:51"
      },
      {
        "youtubeId": "Fv0nwb1Qn6A",
        "title": "Blameless Postmortem Culture In Software Engineering",
        "channel": "Clément Mihailescu",
        "role": "intro",
        "why": "A short, clear explanation of why blameless reviews produce better fixes than blaming individuals.",
        "length": "9:23"
      }
    ],
    "intuition": "<p>Consider a house fire. The first firefighter on scene does not grab a hose. They become <strong>incident commander</strong>, work out what is happening, assign one crew to the water supply and another to search, and hand a radio to someone whose only job is to talk to the neighbours and the press. The fire gets put out faster because nobody is duplicating work or arguing over who decides.</p><p><strong>Mental model:</strong> during an outage the first job is to <em>stop the bleeding</em> by rolling back, failing over or shedding load. Finding the root cause comes later, in the postmortem. The purpose of incident structure is to make that first step fast.</p><ul><li><strong>Trap: the most senior engineer acts as IC and also debugs.</strong> Someone who is reading logs cannot coordinate at the same time. The IC delegates the hands-on work.</li><li><strong>Trap: debugging before mitigating.</strong> If a deploy happened 10 minutes before the errors started, roll it back first and investigate afterwards.</li><li><strong>Trap: \"root cause: human error\".</strong> A blameless review asks why the system let a single command or a missing flag cause an outage, and what guardrail would stop it happening again.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Structured Incident Roles</h2>\n      <p>When high-severity outages occur, unstructured chaos compounds the damage. High-performing organizations use incident command systems with distinct roles:</p>\n      <ul>\n        <li><strong>Incident Commander (IC):</strong> Owns the incident, delegates investigation tasks, and has final authority over mitigation actions (e.g., rollback or failover).</li>\n        <li><strong>Operations Lead:</strong> Subject matter expert executing diagnostics, reading graphs, and applying targeted fixes.</li>\n        <li><strong>Communications Lead:</strong> Provides periodic status updates to customers and internal stakeholders, freeing the technical team from interruptions.</li>\n      </ul>\n\n      <h2>Blameless Post-Mortems</h2>\n      <p>Human error is a symptom of a flawed process or brittle system, not the root cause. Blameless post-mortems assume that engineers acted with good intentions based on the information they had. Reviews focus on systemic protections: improving guardrails, automated tests, and canary rollouts.</p>\n    \n<!-- enriched -->\n<h2>Severity levels drive the response</h2><table><thead><tr><th>Severity</th><th>Example</th><th>Response</th><th>Comms cadence</th></tr></thead><tbody><tr><td>SEV1</td><td>Checkout down for all users, data loss or a security breach</td><td>Page IC, ops and comms immediately, open a bridge call, notify executives</td><td>Status page every 30 minutes</td></tr><tr><td>SEV2</td><td>One region or a major feature degraded, SLO burning fast</td><td>Page on-call, appoint an IC, open an incident channel</td><td>Internal updates every hour</td></tr><tr><td>SEV3</td><td>Minor feature broken, a workaround exists</td><td>Handle during business hours</td><td>Ticket updates</td></tr></tbody></table><p>Declare an incident early and downgrade it later if needed. An incident that turns out to be nothing costs a few minutes. A SEV1 that runs as an unstructured chat thread for an hour can cost far more.</p><h2>Worked timeline</h2><div class=\"mermaid\">sequenceDiagram\n  participant Alert as Burn-rate alert\n  participant OnCall as On-call engineer\n  participant IC as Incident commander\n  participant Ops as Ops lead\n  participant Comms as Comms lead\n  Alert->>OnCall: 14.02 page, checkout 5xx at 8 percent\n  OnCall->>IC: 14.05 declare SEV1 and hand off command\n  IC->>Ops: Check recent changes\n  IC->>Comms: Post status page, investigating\n  Ops->>IC: 14.11 deploy at 13.58 matches, propose rollback\n  IC->>Ops: Approved, roll back\n  Ops->>IC: 14.19 errors back to baseline\n  IC->>Comms: 14.30 post resolved, monitoring</div><p>In this example, time to detect is 4 minutes (from the 13:58 deploy to the 14:02 page), time to mitigate is 17 minutes, and the root cause (a config key renamed in one service but not in the other) is found the next day. The postmortem produces action items: validate the config schema in CI, make the canary stage block the rollout on 5xx errors, and add an alert on config-parse failures.</p><h2>What goes in a postmortem</h2><ul><li><strong>Impact:</strong> duration, users affected, error budget consumed, revenue or SLA exposure.</li><li><strong>Timeline:</strong> timestamps from the first signal to resolution, including what responders believed at each point.</li><li><strong>Contributing factors:</strong> usually several, such as a missing test, an unsafe default and an alert that was too slow. Avoid the idea of a single root cause.</li><li><strong>Action items:</strong> each with an owner and a due date, and prioritised. Postmortems whose action items never get done are a common failure.</li></ul><h2>How real organisations do it</h2><p>Google's SRE book describes the IC, Ops, Comms and Planning roles adapted from the US fire-service Incident Command System. PagerDuty publishes its open-source incident response guide with the same roles. Slack, Atlassian and Facebook have all presented their severity and review processes publicly. A common lesson from those talks is that incident tooling (a bot that creates the channel, pages roles and records the timeline) makes it much more likely that people actually follow the process.</p>\n</div>",
    "keyTakeaways": [
      "Establish strict incident roles: Incident Commander, Operations Lead, and Communications Lead.",
      "Prioritize fast mitigation (rollback, traffic drain) over debugging root cause in the middle of an active outage.",
      "Conduct blameless post-mortems to discover systemic vulnerabilities and prevent repeat incidents."
    ],
    "furtherReading": [
      {
        "title": "PagerDuty Incident Response Documentation: During an Incident",
        "url": "https://response.pagerduty.com/during/during_an_incident/"
      },
      {
        "title": "Google SRE Book: Managing Incidents",
        "url": "https://sre.google/sre-book/managing-incidents/"
      },
      {
        "title": "Schnepp, Vidal, Hawley: Incident Management for Operations (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/incident-management-for/9781491917619/"
      }
    ]
  },
  "deployment-and-migration-safety": {
    "title": "Deployment and migration safety",
    "video": {
      "youtubeId": "AWVTKBUnoIg",
      "title": "Top 5 Most-Used Deployment Strategies",
      "channel": "ByteByteGo",
      "why": "Animated comparison of big-bang, rolling, blue-green, canary and feature-toggle deployments, covering the same patterns as the lesson with clear trade-offs.",
      "length": "10:00"
    },
    "videos": [
      {
        "youtubeId": "HKkhD6nokC8",
        "title": "Progressive Delivery Explained - Big Bang (Recreate), Blue-Green, Rolling Updates, Canaries",
        "channel": "DevOps & AI Toolkit",
        "role": "deep-dive",
        "why": "Goes further into progressive delivery, showing how canary analysis and automated rollback actually run on Kubernetes.",
        "length": "20:44"
      }
    ],
    "intuition": "<p>A restaurant changing its recipe does not swap every dish on the menu on a Friday night. It serves the new version to one table, watches their faces, then to a section, then to the whole room. If the first table sends it back, only one table had a bad meal. That is a <strong>canary release</strong>. <strong>Blue-green</strong> is having a second fully staffed kitchen ready and moving all the orders over at once, with the option to move them straight back.</p><p><strong>Mental model:</strong> every deployment is an experiment. Keep the <em>blast radius</em> small and make <em>rollback</em> fast and routine.</p><ul><li><strong>Trap: a canary that nobody measures.</strong> Sending 1% of traffic to the new version without automatically comparing it against the baseline only delays the outage.</li><li><strong>Trap: rollbacks that cannot actually roll back.</strong> If the new version ran a schema migration or wrote data in a new format, the old binary may crash on it. The code and the data must stay backward compatible for at least one release.</li><li><strong>Trap: treating a config change as safe.</strong> Many large outages were caused by global config or feature-flag pushes that skipped the staged rollout used for code.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Zero-Downtime Deployment Strategies</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Strategy{\"Deployment Pattern\"}\n    Strategy --> Rolling[\"Rolling Update: Incrementally replace old pods with new\"]\n    Strategy --> BlueGreen[\"Blue-Green: Stand up twin cluster, switch router atomically\"]\n    Strategy --> Canary[\"Canary Release: Route 1% of live traffic to new version\"]\n    Canary --> MetricsCheck{\"Error rate or latency spike?\"}\n    MetricsCheck -->|Yes| AutoRollback[\"Automatic Fast Rollback\"]\n    MetricsCheck -->|No| Promote[\"Promote to 10% -> 50% -> 100%\"]\n      </div>\n\n      <h2>Canary Deployments with Automated Rollbacks</h2>\n      <p>Never deploy new software to 100% of servers at once. In a canary deployment, the new release is deployed to a tiny subset of machines (e.g., 2%). The traffic router sends 2% of live production traffic to the canary. Automated monitors compare error rates and latency percentiles (p99) against the baseline control cluster. If metrics degrade, traffic is automatically shifted away from the canary. Detecting a regression needs enough samples and a bake period (often minutes), although the drain itself is fast once triggered.</p>\n    \n<!-- enriched -->\n<h2>Trade-offs between strategies</h2><table><thead><tr><th>Strategy</th><th>Extra capacity</th><th>Blast radius</th><th>Rollback speed</th><th>Watch out for</th></tr></thead><tbody><tr><td>Rolling update</td><td>Small (surge of 1 to 25%)</td><td>Grows as the rollout proceeds</td><td>Minutes (roll forward the old version)</td><td>Old and new versions serve traffic together for the whole rollout</td></tr><tr><td>Blue-green</td><td>100% (two full fleets)</td><td>All traffic at the moment of switching</td><td>Seconds (flip the router back)</td><td>Cost, warming caches and connection pools on the idle fleet, shared databases</td></tr><tr><td>Canary</td><td>Small</td><td>Canary percentage only</td><td>Seconds (drain the canary)</td><td>Needs enough traffic to be statistically meaningful</td></tr><tr><td>Feature flag / dark launch</td><td>None</td><td>Chosen per user or cohort</td><td>Instant (turn the flag off)</td><td>Flag debt, untested combinations of flags</td></tr></tbody></table><h2>Worked example: is the canary actually worse?</h2><p>The fleet serves 20,000 requests per second with a baseline 5xx rate of 0.1%. A 1% canary receives 200 requests per second.</p><ul><li>Over 10 minutes the canary serves 120,000 requests. At baseline it would produce about 120 errors.</li><li>If the new build fails 0.5% of requests, the canary produces about 600 errors, a fivefold increase that is easy to detect.</li><li>If the new build fails only 0.12%, you would expect about 144 errors against 120. That is within normal noise, so you need a larger canary, a longer bake time or a more sensitive signal such as latency percentiles.</li></ul><p>Automated canary analysis tools such as Netflix and Google's Kayenta, Argo Rollouts and Flagger compare canary metrics with a <em>control</em> group started at the same time from the old build. Comparing against the rest of the fleet is less reliable, because instances that have been running for days carry warm caches and long-lived connections.</p><h2>A staged rollout pipeline</h2><div class=\"mermaid\">flowchart LR\n  A[\"Build and test\"] --> B[\"Staging\"]\n  B --> C[\"One box in one zone\"]\n  C --> D[\"Canary 1 percent\"]\n  D --> E[\"One region\"]\n  E --> F[\"Remaining regions in waves\"]\n  D -->|\"metrics regress\"| R[\"Automatic rollback\"]\n  E -->|\"metrics regress\"| R</div><p>AWS describes this approach as one-box, then single availability zone, then region-by-region waves with bake times between them, so a bad change never reaches every region at once. The same pipeline should apply to <strong>configuration and feature-flag changes</strong>, not only binaries.</p><h2>Keeping old and new versions compatible</h2><ul><li>During any rolling or canary deploy, version N and version N+1 run side by side. APIs, message formats and database schemas must be readable by both.</li><li>Add fields before you use them, and stop using fields before you remove them (see the expand-and-contract lesson).</li><li>Avoid deploying on Friday evening, when fewer people are around to watch the rollout.</li></ul>\n</div>",
    "keyTakeaways": [
      "Use Canary deployments with automated metric verification to minimize outage blast radius.",
      "Decouple code deployment from feature release using Feature Flags.",
      "Blue-Green deployments provide instantaneous rollback capability at the cost of duplicate infrastructure."
    ],
    "furtherReading": [
      {
        "title": "Martin Fowler: BlueGreenDeployment",
        "url": "https://martinfowler.com/bliki/BlueGreenDeployment.html"
      },
      {
        "title": "Google SRE Book: Release Engineering",
        "url": "https://sre.google/sre-book/release-engineering/"
      },
      {
        "title": "Jez Humble & David Farley: Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/continuous-delivery-reliable/9780321670250/"
      }
    ]
  },
  "database-migration-safety": {
    "title": "Database migration safety",
    "video": {
      "youtubeId": "ONSCQWLD9d0",
      "title": "Every engineer should know this.. (Expand-Contract Pattern)",
      "channel": "Software Developer Diaries",
      "why": "A focused, diagram-led walkthrough of the expand-and-contract steps taught in this unit.",
      "length": "6:36"
    },
    "videos": [
      {
        "youtubeId": "Eh05k_O0Jjo",
        "title": "LISA19 - Expand Contract Pattern for Continuous Delivery of Databases",
        "channel": "USENIX",
        "role": "deep-dive",
        "why": "Conference talk on running expand-and-contract continuously in a delivery pipeline, including backfills and rollback points.",
        "length": "30:15"
      },
      {
        "youtubeId": "StEySY2GBLw",
        "title": "Introducing gh-ost GitHub's triggerless, painless schema migrations for MySQL",
        "channel": "FOSDEM",
        "role": "case-study",
        "why": "Shows how GitHub changes schemas on very large MySQL tables online without long locks, using binlog-driven shadow tables.",
        "length": "23:06"
      }
    ],
    "intuition": "<p>Picture renaming a street while people are still driving on it. You cannot take the old signs down in one night. First you put up the new signs next to the old ones (<strong>expand</strong>). Then you update the maps and satnavs (<strong>migrate readers and writers</strong>). Once nobody is using the old name, you take the old signs down (<strong>contract</strong>).</p><p><strong>Mental model:</strong> during a rolling deploy the old and new application versions run at the same time, so every schema state has to work for <em>both</em> versions. Each step should be small, backward compatible and reversible on its own.</p><ul><li><strong>Trap: one migration that renames a column.</strong> Old pods still running the previous release immediately start failing with \"column does not exist\".</li><li><strong>Trap: DDL that takes a long lock.</strong> Even a quick <code>ALTER TABLE</code> can queue behind a long-running transaction, and then every query queues behind the ALTER. Set <code>lock_timeout</code> and retry.</li><li><strong>Trap: dropping the old column in the same release that stops reading it.</strong> Rollback is then impossible. Leave at least one release between the two steps.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Expand and Contract Pattern</h2>\n      <p>Applying breaking schema changes (renaming a column, splitting tables) directly on a live database is unsafe in a single deployment, because during a rolling deploy old and new application versions run side by side against the same schema. The industry standard is the <strong>Expand and Contract (Parallel Run)</strong> pattern executed in 4 distinct phases:</p>\n\n      <ol>\n        <li><strong>Phase 1 (Expand):</strong> Add the new column or table alongside the old one. The database now contains both.</li>\n        <li><strong>Phase 2 (Dual Write):</strong> Deploy an application release that reads from the old column, but writes mutations to both the old and new columns simultaneously. A background backfill job migrates historical rows.</li>\n        <li><strong>Phase 3 (Switch Read):</strong> Once backfill and validation pass, deploy an update that switches reads to the new column while still dual-writing, so rolling back remains possible.</li>\n        <li><strong>Phase 4 (Contract):</strong> Stop writing the old column, then drop it after a soak period.</li>\n      </ol>\n    \n<!-- enriched -->\n<h2>Worked example: renaming users.first_name to given_name</h2><table><thead><tr><th>Step</th><th>Change</th><th>Reads</th><th>Writes</th><th>Safe to roll back?</th></tr></thead><tbody><tr><td>1. Expand</td><td><code>ALTER TABLE users ADD COLUMN given_name text</code> (nullable, no default)</td><td>old</td><td>old</td><td>Yes</td></tr><tr><td>2. Dual write</td><td>Application release writes both columns</td><td>old</td><td>old + new</td><td>Yes</td></tr><tr><td>3. Backfill</td><td>Batched job copies old to new where new is null</td><td>old</td><td>old + new</td><td>Yes</td></tr><tr><td>4. Verify</td><td>Count mismatches, for example <code>WHERE given_name IS DISTINCT FROM first_name</code></td><td>old</td><td>old + new</td><td>Yes</td></tr><tr><td>5. Switch reads</td><td>Release reads the new column, still dual writes</td><td>new</td><td>old + new</td><td>Yes</td></tr><tr><td>6. Stop old writes</td><td>Release writes only the new column</td><td>new</td><td>new</td><td>Only back to step 5</td></tr><tr><td>7. Contract</td><td>Drop <code>first_name</code> after a soak period</td><td>new</td><td>new</td><td>No (restore from backup)</td></tr></tbody></table><h2>Backfill arithmetic</h2><p>A table with 400 million rows, updated in batches of 5,000 rows every 100 ms, processes about 50,000 rows per second and finishes in roughly 2.2 hours. Keep each batch in its own short transaction so replication lag and lock hold times stay low. Throttle when replica lag exceeds a threshold, which is what gh-ost and pt-online-schema-change do. Make the job idempotent (<code>WHERE given_name IS NULL AND id BETWEEN x AND y</code>) so it can be restarted safely.</p><h2>Engine-specific facts that matter</h2><ul><li><strong>PostgreSQL 11 and later:</strong> <code>ADD COLUMN ... DEFAULT</code> with a non-volatile default is a metadata-only change. Before version 11 it rewrote the whole table. Use <code>CREATE INDEX CONCURRENTLY</code> to build indexes without blocking writes.</li><li><strong>Adding NOT NULL safely in PostgreSQL:</strong> add <code>CHECK (col IS NOT NULL) NOT VALID</code>, then <code>VALIDATE CONSTRAINT</code>, which does not block writes. PostgreSQL 12 and later can then set <code>NOT NULL</code> without a full scan.</li><li><strong>MySQL 8.0:</strong> many <code>ADD COLUMN</code> operations support <code>ALGORITHM=INSTANT</code>. For operations that do not, gh-ost and pt-online-schema-change copy into a shadow table and swap it in.</li><li><strong>Always:</strong> set <code>lock_timeout</code> (PostgreSQL) or <code>lock_wait_timeout</code> (MySQL) to a few seconds so a blocked DDL fails fast instead of stalling all traffic behind it.</li></ul><h2>Failure modes</h2><ul><li><strong>Dual-write divergence:</strong> if the two writes are not in the same transaction, a crash between them leaves the columns inconsistent. Put both writes in one transaction, or rely on the backfill and verification steps to repair differences.</li><li><strong>ORM caches the schema:</strong> some ORMs select every column by name. Dropping a column breaks old pods even though they never used it. Remove the column from the model first, then drop it.</li><li><strong>Replica lag during a large backfill</strong> can make read replicas serve stale data, or trigger automatic failover. Throttle on lag.</li></ul>\n</div>",
    "keyTakeaways": [
      "Never execute breaking schema modifications in a single step on live production databases.",
      "Follow the Expand and Contract pattern across separate application deployment cycles.",
      "Verify dual-write correctness with automated shadow verification before cutting over reads."
    ],
    "furtherReading": [
      {
        "title": "Stripe: Online Migrations at Scale",
        "url": "https://stripe.com/blog/online-migrations"
      },
      {
        "title": "Google SRE Book: Data Integrity: What You Read Is What You Wrote",
        "url": "https://sre.google/sre-book/data-integrity/"
      },
      {
        "title": "Laine Campbell & Charity Majors: Database Reliability Engineering (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/database-reliability-engineering/9781491925935/"
      }
    ]
  },
  "parallel-monolith-read-drain": {
    "title": "Parallel monolith read drain",
    "video": {
      "youtubeId": "9I9GdSQ1bbM",
      "title": "Monolith Decomposition Patterns • Sam Newman • GOTO 2019",
      "channel": "GOTO Conferences",
      "why": "Sam Newman walks through the strangler fig, parallel run (including GitHub Scientist-style comparison) and branch-by-abstraction patterns this unit is built on.",
      "length": "43:57"
    },
    "videos": [
      {
        "youtubeId": "SaRyGp2s418",
        "title": "P99 CONF 2023 | Zero Downtime Critical Traffic Migration @Netflix Scale by Abhishek Pandey",
        "channel": "ScyllaDB",
        "role": "case-study",
        "why": "Netflix explains how it replays production traffic against a new service, compares responses and then migrates traffic with no downtime.",
        "length": "45:35"
      },
      {
        "youtubeId": "DpuQ3-7e-rY",
        "title": "Master Microservices Strangler Pattern by Top AWS Experts",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "Quick visual intro to the strangler fig pattern.",
        "length": "5:43"
      }
    ],
    "intuition": "<p>A new pilot training on a real flight sits in the right seat while the captain flies. The trainee makes every decision in their head and says it out loud, but the captain's hands stay on the controls. When the trainee's calls match the captain's for hundreds of flights, they get to fly. <strong>Shadow traffic</strong> works the same way: the new service computes an answer for every real request, but only the monolith's answer goes to the user.</p><p><strong>Mental model:</strong> <em>serve from the old system, compare with the new system, switch over only when the mismatch rate is close to zero</em>, then shift reads gradually and drain the monolith endpoint.</p><ul><li><strong>Trap: shadowing writes.</strong> Duplicating a <code>POST /charge</code> to the new service charges the customer twice. Shadow only reads or idempotent calls, or point the shadow at an isolated datastore.</li><li><strong>Trap: comparing raw JSON.</strong> Timestamps, request IDs and field order produce false mismatches. Normalise responses, or ignore fields that are known to differ.</li><li><strong>Trap: letting the shadow slow users down.</strong> The comparison must be fire-and-forget, with its own timeouts and a capacity limit.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Decommissioning Monolith Endpoints Safely</h2>\n      <p>When extracting microservices from an existing monolithic application (the Strangler Fig pattern), abruptly switching all customer traffic risks catastrophic bugs. The <strong>Parallel Read Drain (Dark Launch)</strong> pattern validates the new microservice invisibly in production:</p>\n\n      <h2>Dark Launching / Shadow Traffic</h2>\n      <p>The API Gateway receives a user request and forwards it to the legacy monolith. Simultaneously, the gateway clones the request asynchronously (fire-and-forget) to the new microservice. Shadow only reads or idempotent calls (or point the shadow at an isolated datastore); duplicating a non-idempotent write such as a payment would execute it twice. A shadow comparison worker compares the two HTTP responses. Discrepancies are logged and fixed before any live user ever touches the new service.</p>\n    \n<!-- enriched -->\n<h2>The migration as stages</h2><div class=\"mermaid\">flowchart LR\n  S0[\"Monolith serves 100 percent\"] --> S1[\"Shadow 1 percent to new service\"]\n  S1 --> S2[\"Shadow 100 percent, mismatches under 0.01 percent\"]\n  S2 --> S3[\"New service serves 1 percent, compare in reverse\"]\n  S3 --> S4[\"New service serves 100 percent\"]\n  S4 --> S5[\"Monolith endpoint drained and deleted\"]</div><p>Each arrow is a gate with a numeric exit criterion, such as a mismatch rate, p99 latency and error rate, held for a soak period. Every stage can be reversed with a routing change alone.</p><h2>Worked example: reading the mismatch report</h2><p>The <code>GET /orders/{id}</code> endpoint receives 3,000 requests per second. After shadowing 100% of traffic for 24 hours, about 259 million pairs have been compared and 41,000 of them differ, a 0.016% mismatch rate. Grouping the mismatches by field shows:</p><ul><li><strong>28,000</strong> differ in <code>updated_at</code> precision (milliseconds against microseconds). This is harmless, so normalise the field and ignore it.</li><li><strong>12,500</strong> differ in currency rounding on orders with discounts. This is a real bug that must be fixed before cutover.</li><li><strong>500</strong> are read-after-write races, where the new service reads from a replica that is a few milliseconds behind. To handle these, compare again after a delay, or only compare records that have not changed recently.</li></ul><p>Twitter's Diffy reduces noise by running <em>two</em> copies of the old version as well as the candidate. Differences between the two old copies are treated as noise, and only differences that appear between old and new are reported. GitHub's Scientist library applies the same idea inside application code: it runs the old and new code paths, returns the old result, and records any mismatch.</p><h2>Comparison of approaches</h2><table><thead><tr><th>Approach</th><th>Where comparison happens</th><th>Good for</th><th>Limitation</th></tr></thead><tbody><tr><td>Gateway shadowing (Envoy request mirroring, Istio mirror)</td><td>Offline, in a comparison worker</td><td>Read-only HTTP endpoints</td><td>Mirrored responses are discarded, so you must capture both responses yourself</td></tr><tr><td>In-code experiment (GitHub Scientist)</td><td>Inside the monolith process</td><td>Refactoring one code path</td><td>Adds latency unless the new path runs asynchronously</td></tr><tr><td>Traffic capture and replay (Netflix)</td><td>Offline replay of recorded traffic</td><td>High-risk migrations, load testing</td><td>Recorded data goes stale, and you need to scrub personal data from it</td></tr><tr><td>Dual write plus reconciliation</td><td>Batch comparison of the two datastores</td><td>Write paths</td><td>Needs idempotency and a single source of truth during the migration</td></tr></tbody></table><h2>Draining the monolith</h2><p>After the new service serves 100% of traffic, keep the monolith code path deployed but unused for one or two release cycles. Watch its request counter until it stays at zero, including traffic from forgotten internal callers, cron jobs and old mobile app versions. Then delete the code. The endpoint is finished only when the code is gone, so plan the deletion step as part of the migration.</p>\n</div>",
    "keyTakeaways": [
      "Use shadow traffic (dark launching) to stress-test extracted microservices with real production loads.",
      "Compare response payloads between legacy and new services automatically to catch subtle edge-case bugs.",
      "Gradually drain reads using percentage-based gateway traffic splits."
    ],
    "furtherReading": [
      {
        "title": "Martin Fowler: Strangler Fig Application",
        "url": "https://martinfowler.com/bliki/StranglerFigApplication.html"
      },
      {
        "title": "Martin Fowler: Branch by Abstraction",
        "url": "https://martinfowler.com/bliki/BranchByAbstraction.html"
      },
      {
        "title": "Microservices Patterns (O'Reilly)",
        "url": "https://www.oreilly.com/library/view/microservices-patterns/9781617294549/"
      }
    ]
  },
  "database-backups-and-restore": {
    "title": "Backups and restore",
    "video": {
      "youtubeId": "Jvdtx-Smffo",
      "title": "PostgreSQL Backup & Point-In-Time Recovery",
      "channel": "Scaling Postgres",
      "why": "Hands-on explanation of base backups plus WAL archiving and replaying to a target time, which is exactly the PITR mechanism in the lesson.",
      "length": "19:31"
    },
    "videos": [
      {
        "youtubeId": "tLdRBsuvVKc",
        "title": "Dev Deletes Entire Production Database, Chaos Ensues",
        "channel": "Kevin Fang",
        "role": "case-study",
        "why": "Engaging retelling of the 2017 GitLab outage, where several backup methods turned out not to work. It is a strong argument for testing restores.",
        "length": "10:20"
      }
    ],
    "intuition": "<p>A backup is like a spare house key. It is only useful if it opens the door, and you only find out whether it does when you try it. <strong>Point-in-time recovery</strong> is a key plus a video of everything that happened in the house since the key was cut: you restore last night's snapshot, then replay the recording up to one second before someone dropped the table.</p><p><strong>Mental model:</strong> <em>backup = base snapshot + continuous change log</em>. RPO is decided by how often the log is shipped. RTO is decided by how fast you can copy the snapshot back and replay the log.</p><ul><li><strong>Trap: \"we have replicas, so we have backups\".</strong> A replica copies the <code>DROP TABLE</code> within milliseconds. Replicas protect against hardware failure, not against mistakes or corruption.</li><li><strong>Trap: backups that are never restored.</strong> Until you have restored one and run queries against the result, you do not know it works. Automate a restore test at least weekly.</li><li><strong>Trap: backups in the same account and region.</strong> Ransomware, a compromised admin credential or a regional outage can take out the database and its backups together. Keep an immutable, off-account copy.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Full Snapshots vs. Point-in-Time Recovery (PITR)</h2>\n      <p>Nightly database dumps (via <code>pg_dump</code> or <code>mysqldump</code>) leave an unacceptable 24-hour data loss window. Modern production databases combine periodic snapshots with continuous Write-Ahead Log (WAL) archiving to achieve <strong>Point-in-Time Recovery (PITR)</strong>.</p>\n\n      <h2>How PITR Works</h2>\n      <p>The database streams its binary write log segments (WAL in Postgres, binlog in MySQL) continuously to encrypted object storage (S3). To restore to a state right before a catastrophic human error (e.g., an accidental <code>DROP TABLE</code> at 14:02:15):</p>\n      <ol>\n        <li>Restore the latest baseline snapshot taken before the event (e.g., midnight snapshot).</li>\n        <li>Replay the archived WAL logs sequentially up to just before the bad transaction: by timestamp (14:02:14), or more precisely by transaction ID or LSN (<code>recovery_target_xid</code> / <code>recovery_target_lsn</code> with <code>recovery_target_inclusive = false</code>).</li>\n      </ol>\n    \n<!-- enriched -->\n<h2>Backup methods compared</h2><table><thead><tr><th>Method</th><th>Typical RPO</th><th>Restore speed</th><th>Protects against</th><th>Weakness</th></tr></thead><tbody><tr><td>Logical dump (<code>pg_dump</code>, <code>mysqldump</code>)</td><td>Hours to 24 h</td><td>Slow: rebuilds indexes, often hours per TB</td><td>Mistakes, version upgrades, restoring a single table</td><td>Large RPO, heavy load while it runs</td></tr><tr><td>Physical or volume snapshot (EBS snapshot, <code>pg_basebackup</code>)</td><td>Snapshot interval</td><td>Fast: copies blocks</td><td>Disk loss, mistakes (up to the last snapshot)</td><td>Must be crash-consistent, and is tied to the engine version</td></tr><tr><td>Snapshot + WAL/binlog archive (PITR)</td><td>Seconds to about a minute</td><td>Snapshot restore + log replay time</td><td>Mistakes at any point in the retention window</td><td>Replay time grows with the distance from the last snapshot</td></tr><tr><td>Streaming replica</td><td>Near zero</td><td>Seconds (promote the replica)</td><td>Node or zone failure</td><td>Copies deletes and corruption immediately, so it is not a backup</td></tr><tr><td>Delayed replica (for example 1 h behind)</td><td>Up to the delay</td><td>Minutes</td><td>Mistakes noticed within the delay</td><td>Extra cost, and only covers a short window</td></tr></tbody></table><h2>Worked example: RTO for a 2 TB PostgreSQL database</h2><ul><li>The base backup is taken nightly at 00:00. Someone runs an accidental <code>DELETE</code> without a WHERE clause at 14:02:15.</li><li>Restoring 2 TB from object storage at about 500 MB/s takes around <strong>70 minutes</strong>.</li><li>WAL generated since midnight is 14 hours at 15 GB/h, or 210 GB. Replaying it at about 100 MB/s takes around <strong>35 minutes</strong>.</li><li>Add time for detection, the decision to restore, validation and switching the application over. The realistic RTO is <strong>2 to 3 hours</strong>, and RPO is about the <code>archive_timeout</code> (for example 60 s) for changes outside the damaged table.</li><li>To reduce RTO, take snapshots more often (every 4 hours means at most 4 hours of replay), use incremental backups (pgBackRest, WAL-G, or PostgreSQL 17 incremental backup), or restore to a <em>side instance</em> and copy back only the damaged table.</li></ul><p>In PostgreSQL, the target is set with <code>recovery_target_time</code>, or more precisely with <code>recovery_target_xid</code> or <code>recovery_target_lsn</code>, which you can find by inspecting the WAL with <code>pg_waldump</code>. Set <code>recovery_target_inclusive = false</code> so that the bad transaction itself is not replayed.</p><h2>Operational rules</h2><ul><li><strong>3-2-1:</strong> three copies, on two kinds of media or services, one off-site. Modern practice adds immutability, for example S3 Object Lock in compliance mode, so that even an administrator cannot delete backups during the retention period.</li><li><strong>Encrypt backups</strong> and keep the keys somewhere that survives the loss of the primary account.</li><li><strong>Monitor backups</strong>: alert when the last successful backup is too old or much smaller than the previous one. In the 2017 GitLab incident, backups had been failing silently and the failure notifications were never received.</li><li><strong>Managed services:</strong> Amazon RDS and Aurora provide automated PITR with up to 35 days of retention. The latest restorable time is usually within about 5 minutes of the present. You still need to test restores and keep a cross-region or cross-account copy.</li></ul>\n</div>",
    "keyTakeaways": [
      "Nightly dumps are insufficient; implement Point-in-Time Recovery (PITR) via continuous WAL archiving.",
      "An untested backup is not a backup; run automated weekly restore verification drills.",
      "Store backups in a separate, isolated cloud account with immutable Object Lock (WORM) enabled."
    ],
    "furtherReading": [
      {
        "title": "PostgreSQL Continuous Archiving and Point-in-Time Recovery",
        "url": "https://www.postgresql.org/docs/current/continuous-archiving.html"
      },
      {
        "title": "AWS Prescriptive Guidance: Backup and recovery approaches on AWS (PDF)",
        "url": "https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/backup-recovery/backup-recovery.pdf"
      },
      {
        "title": "MySQL Backup and Recovery",
        "url": "https://dev.mysql.com/doc/refman/8.0/en/backup-and-recovery.html"
      }
    ]
  },
  "disaster-recovery": {
    "title": "Disaster recovery",
    "video": {
      "youtubeId": "OmASCUJEVy8",
      "title": "🔥 The Ultimate Guide to Disaster Recovery: RTO, RPO, & Failover!",
      "channel": "ByteMonk",
      "why": "Clear animated explanation of RTO and RPO and of the backup, pilot light, warm standby and active-active range covered in this unit.",
      "length": "10:53"
    },
    "videos": [
      {
        "youtubeId": "RMrfzR4zyM4",
        "title": "AWS re:Invent 2017: How to Design a Multi-Region Active-Active Architecture (ARC319)",
        "channel": "Amazon Web Services",
        "role": "deep-dive",
        "why": "In-depth session on data replication, routing and failover for multi-region active-active designs, the costliest end of the range.",
        "length": "1:19:40"
      },
      {
        "youtubeId": "hAyA86QGRnI",
        "title": "How Netflix Leverages Multiple Regions to Increase Availability (ARC305) | AWS re:Invent 2013",
        "channel": "Amazon Web Services",
        "role": "case-study",
        "why": "Netflix explains how it runs active-active across AWS regions and tests regional evacuation.",
        "length": "29:15"
      }
    ],
    "intuition": "<p>Disaster recovery is like insurance for a shop. Backup-and-restore is having the stock list in a safe deposit box, so after a fire you can rebuild, but it takes weeks. <strong>Pilot light</strong> is a second empty shop with the lights and the till already wired. <strong>Warm standby</strong> is a second small shop that is open with a skeleton crew. <strong>Active-active</strong> is two full shops serving customers every day. Each option gets you trading again faster after a fire, and each costs more.</p><p><strong>Mental model:</strong> <strong>RPO</strong> is how much data you can afford to lose, and <strong>RTO</strong> is how long you can afford to be down. The business picks those numbers, and the architecture and budget follow from them.</p><ul><li><strong>Trap: a DR plan that has never been run.</strong> A runbook that has never been exercised usually fails the first time it is used for real. Run regular failover game days.</li><li><strong>Trap: hidden single-region dependencies.</strong> The standby region may still depend on a global control plane, an identity provider or a DNS setup that lives in the region that failed.</li><li><strong>Trap: assuming the capacity will be there.</strong> When a whole region fails, every customer tries to scale up in the neighbouring region at once. Reserve capacity, or pre-scale.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>RTO and RPO Targets</h2>\n      <ul>\n        <li><strong>RPO (Recovery Point Objective):</strong> The maximum acceptable age of data that must be recovered after an outage (measures acceptable data loss).</li>\n        <li><strong>RTO (Recovery Time Objective):</strong> The maximum acceptable duration of downtime before systems are restored to operational status.</li>\n      </ul>\n\n      <h2>Disaster Recovery Topologies</h2>\n      <p>Architectures range in cost and capability: Backup & Restore (often hours to days), Pilot Light (minimal core running in a secondary region), Warm Standby (a scaled-down replica stack), and Active-Active Multi-Region (traffic served in multiple regions). Active-active can target low RTO, but replication lag, conflicts, quorum loss, routing convergence, and shared dependencies can still produce nonzero RPO and RTO; the topology alone proves neither target.</p>\n    \n<!-- enriched -->\n<h2>DR strategies side by side</h2><table><thead><tr><th>Strategy</th><th>Typical RPO</th><th>Typical RTO</th><th>Standby cost</th><th>What runs in the DR region</th></tr></thead><tbody><tr><td>Backup and restore</td><td>Hours (backup interval)</td><td>Hours to days</td><td>Storage only</td><td>Nothing; backups are copied cross-region</td></tr><tr><td>Pilot light</td><td>Seconds to minutes (async replication)</td><td>Tens of minutes</td><td>Low</td><td>Replicated database; application servers off or scaled to zero</td></tr><tr><td>Warm standby</td><td>Seconds</td><td>Minutes</td><td>Medium</td><td>Full stack at reduced size, scaled up on failover</td></tr><tr><td>Active-active multi-region</td><td>Near zero to seconds (depends on replication mode)</td><td>Near zero to minutes</td><td>High (two or more times)</td><td>Full stack serving live traffic</td></tr></tbody></table><p>These ranges follow the AWS disaster recovery whitepaper. They describe what each topology <em>can</em> achieve. Whether you actually achieve them depends on testing.</p><h2>Worked example: what does failover really cost in time?</h2><p>This is a warm-standby design with asynchronous database replication. Replication lag is normally 1 to 2 seconds, but reaches about 10 seconds at peak.</p><ul><li><strong>Detect:</strong> health checks fail for 3 consecutive 30-second intervals, so about 90 s.</li><li><strong>Decide:</strong> automatic failover risks flapping and split-brain, so many teams require a person to approve it. Paging and approval take about 5 to 10 minutes.</li><li><strong>Promote the database:</strong> about 1 to 2 minutes. Any writes still inside the replication lag, up to 10 s of data, are lost unless they can be recovered later from the old primary.</li><li><strong>Scale the application tier from 20% to 100%:</strong> about 5 minutes with pre-warmed images.</li><li><strong>Move traffic:</strong> DNS with a 60 s TTL takes minutes to converge, since some clients ignore TTLs. Anycast or a global load balancer takes seconds.</li><li><strong>Total:</strong> RTO of about 15 to 20 minutes and RPO of about 10 s. If the business needs an RPO of zero for payments, those writes need synchronous replication across regions or a consensus-replicated database such as Spanner or CockroachDB. That adds tens of milliseconds of write latency for the cross-region round trip.</li></ul><h2>Failure modes</h2><ul><li><strong>Split brain:</strong> both regions believe they are primary and accept conflicting writes. Use fencing, such as a lease or quorum, so the old primary cannot accept writes after failover.</li><li><strong>Failback is forgotten:</strong> returning to the original region needs its own replication in reverse and its own runbook.</li><li><strong>Shared fate through dependencies:</strong> third-party APIs, secrets managers, CI/CD and the status page itself must not live only in the region that failed.</li><li><strong>Data corruption replicates:</strong> DR replication copies bad writes too. You still need point-in-time backups.</li></ul><h2>How real systems do it</h2><p>Netflix runs active-active across several AWS regions and regularly evacuates a region on purpose (Chaos Kong) to prove it can. Google's DiRT exercises test disaster scenarios company-wide. Many banks run warm standby with regulator-mandated annual failover tests. Most SaaS companies use pilot light or warm standby for their databases, combined with cross-region backup copies.</p>\n</div>",
    "keyTakeaways": [
      "RPO defines allowable data loss; RTO defines allowable downtime duration.",
      "Active-Active provides the lowest RTO but requires distributed data replication strategies.",
      "Conduct regular Chaos Engineering exercises (like Chaos Monkey) to validate failover automation."
    ],
    "furtherReading": [
      {
        "title": "AWS Disaster Recovery Architecture Whitepaper",
        "url": "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html"
      },
      {
        "title": "NIST SP 800-34: Contingency Planning Guide for Federal Information Systems",
        "url": "https://csrc.nist.gov/publications/detail/sp/800-34/rev-1/final"
      },
      {
        "title": "ISO 22301:2019: Security and resilience - Business continuity management systems - Requirements",
        "url": "https://www.iso.org/standard/75106.html"
      }
    ]
  },
  "data-retention-and-deletion": {
    "title": "Data retention, deletion, and privacy",
    "video": {
      "youtubeId": "9r1WbIIPp94",
      "title": "PEPR 2021: Session 4.1 - Deletion Framework: How Facebook Upholds its Commitments To Data Deletion",
      "channel": "FutureofPrivacy",
      "why": "Meta engineers describe DELF, their production system for deleting data reliably across many data stores. It is a direct match for the distributed deletion problem in the lesson.",
      "length": "20:12"
    },
    "videos": [
      {
        "youtubeId": "u0tscCe7sY8",
        "title": "CertMike Explains Cryptoshredding",
        "channel": "Mike Chapple",
        "role": "intro",
        "why": "Short, accurate explainer of crypto-shredding, the technique the lesson uses for backups that cannot be edited.",
        "length": "5:37"
      }
    ],
    "intuition": "<p>Deleting a user from a distributed system is like trying to get a rumour forgotten. Deleting it from the one person who first heard it is easy. Finding every friend, group chat and notebook it spread to is the hard part. The practical approach is to <strong>know in advance where it will spread</strong> (a data inventory), to have each place <strong>subscribe to a \"forget this\" announcement</strong>, and, for records that cannot be changed, to <strong>write them in a code whose key you can burn</strong>.</p><p><strong>Mental model:</strong> deletion is a workflow with an audit trail, not a single SQL statement. It fans out to every copy, retries until each one confirms, and can prove afterwards that it finished.</p><ul><li><strong>Trap: forgetting derived copies.</strong> Search indexes, caches, analytics tables, ML feature stores, logs and exports to vendors all hold copies of personal data.</li><li><strong>Trap: treating a soft delete as erasure.</strong> A <code>deleted_at</code> flag hides a row from users, but the personal data is still there. It is a first step before the actual erasure.</li><li><strong>Trap: crypto-shredding with a leaked key.</strong> Destroying the key only works if no plaintext copies and no other key copies exist, including old KMS key versions and cached data keys.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: The Distributed Deletion Challenge</h2>\n      <p>Deleting data in a single SQL table with <code>DELETE FROM users WHERE id = ?</code> is trivial; deleting user data across a distributed system with dozens of microservices, read replicas, search clusters, message queues, and append-only backups is one of the hardest operational challenges in software engineering. Regulatory mandates like GDPR (Right to Erasure) and CCPA require verified permanent erasure within legal windows (GDPR: without undue delay and within one month, extendable by two further months; CCPA: 45 days, extendable once by 45 more).</p>\n\n      <h2>Distributed Deletion Orchestration Pipeline</h2>\n      <div class=\"mermaid\">\nsequenceDiagram\n    autonumber\n    actor User as Data Subject\n    participant API as Privacy API Gateway\n    participant Orch as Deletion Orchestrator\n    participant DB as User Database (Primary)\n    participant Kafka as Event Bus ('user.erased')\n    participant Search as Elasticsearch Cluster\n    participant S3 as Cold Storage / Data Lake\n\n    User->>API: POST /v1/privacy/erasure-request\n    API->>Orch: Schedule Async Erasure Workflow\n    Orch->>DB: Soft-Delete + Anonymize PII (Immediate Lock)\n    Orch->>Kafka: Publish 'user.erased' Event\n    Kafka->>Search: Purge Documents by user_id\n    Kafka->>S3: Cryptographic Shredding (Destroy KMS Key)\n    Orch->>User: 202 Accepted (Audit Receipt Generated)\n      </div>\n\n      <h2>Core Production Deletion Mechanics</h2>\n      <h3>1. Tombstones and the Data Resurrection Hazard</h3>\n      <p>In distributed LSM-tree and wide-column databases (Cassandra, Bigtable, RocksDB), deletes are not in-place physical overwrites. Instead, the storage engine writes a special marker record called a <strong>Tombstone</strong>. If a node is down during deletion and repairs after the tombstone's Garbage Collection Grace Period (<code>gc_grace_seconds</code>) expires, the resurrected old data is propagated back to healthy nodes as valid state. Production systems strictly coordinate repair intervals to occur well within tombstone expiration limits.</p>\n\n      <h3>2. Cryptographic Shredding for Immutable Backups</h3>\n      <p>Modifying historical immutable WAL archives or Glacier cold backups to erase a single user is physically impossible without re-writing entire multi-terabyte snapshot files. Production architectures solve this via <strong>Cryptographic Shredding</strong>: each user's sensitive PII is encrypted with a distinct per-user Data Encryption Key (DEK) managed in KMS. When an erasure request arrives, the orchestrator securely destroys the user's specific DEK. The encrypted ciphertext in cold backups becomes unrecoverable without rewriting historical media, provided no plaintext copies, cached DEKs or key backups remain.</p>\n\n      <h3>3. Automated TTL Lifecycle Reapers</h3>\n      <p>Data that is not retained cannot be breached. Production systems configure strict Time-To-Live (TTL) policies at the database layer (PostgreSQL partitioned table dropping, DynamoDB TTL attributes, Redis key expirations) to automatically purge ephemeral audit logs, session records, and abandoned shopping carts without manual batch scripts.</p>\n    \n<!-- enriched -->\n<h2>Retention schedule: decide the lifetime of data when you create it</h2><table><thead><tr><th>Data class</th><th>Example retention</th><th>Mechanism</th><th>Notes</th></tr></thead><tbody><tr><td>Session tokens</td><td>Hours to 30 days</td><td>Redis TTL, DynamoDB TTL</td><td>DynamoDB TTL deletes are asynchronous and typically happen within a few days of expiry, so filter expired items on read</td></tr><tr><td>Application logs containing personal data</td><td>14 to 30 days</td><td>Index lifecycle policies, bucket lifecycle rules</td><td>Mask or hash identifiers at ingestion where possible</td></tr><tr><td>Analytics events</td><td>13 months, then aggregate</td><td>Dropping date partitions</td><td><code>DROP PARTITION</code> is instant; a row-by-row <code>DELETE</code> on billions of rows is not</td></tr><tr><td>Financial records</td><td>Often 7 or more years (jurisdiction-specific)</td><td>WORM storage</td><td>Legal holds and retention obligations can override an erasure request for specific fields</td></tr><tr><td>Backups</td><td>30 to 35 days</td><td>Expiry plus crypto-shredding</td><td>Tell users that data in backups expires within the stated window</td></tr></tbody></table><h2>Worked example: an erasure request across 7 systems</h2><p>A user's erasure request is published as a <code>user.erased</code> event. Each system that holds user data registers a deletion handler and must report completion:</p><ul><li>Primary database: hard delete, or anonymise rows that must be kept for referential integrity (orders become \"deleted user\").</li><li>Search index: delete by <code>user_id</code>. Segment merges physically remove the documents later.</li><li>Cache: invalidate keys, or wait out a short TTL.</li><li>Data warehouse: rewrite the affected partitions, or use table-format deletes (Iceberg or Delta) followed by compaction and snapshot expiry. Old snapshots still contain the data until they expire.</li><li>Object storage: delete the objects, including <em>all versions</em> if bucket versioning is on.</li><li>Third-party processors: call their deletion APIs and record the confirmation.</li><li>Backups: destroy the user's data key, or let backups age out within the documented window.</li></ul><p>The orchestrator tracks each handler's status and retries failures with backoff. It raises an alert if any handler has not completed by, for example, day 20, which leaves margin before a one-month deadline. Meta's DELF framework goes further: it requires every new data type to declare how it is deleted, and checks for data that was missed.</p><h2>Failure modes</h2><ul><li><strong>Resurrection:</strong> a stale replica, a cache refill from an old snapshot, or a Cassandra node that rejoins after <code>gc_grace_seconds</code> can bring deleted data back. Run repairs within the grace period.</li><li><strong>Orphaned identifiers:</strong> deleting the user row but leaving their ID in event logs can let someone re-identify them by joining with another dataset.</li><li><strong>Deleting audit evidence:</strong> keep a minimal, non-personal record that the deletion happened (a request ID, a timestamp and which systems confirmed), not the data itself.</li></ul>\n</div>",
    "keyTakeaways": [
      "In distributed wide-column and LSM storage, deletes write Tombstones; premature tombstone cleanup causes catastrophic data resurrection.",
      "Use Cryptographic Shredding (destroying per-user KMS encryption keys) to achieve instant GDPR erasure across immutable cold backups.",
      "Partition time-series audit tables by month or day so aging data can be dropped instantly via DROP TABLE instead of heavy DELETE scans."
    ],
    "furtherReading": [
      {
        "title": "Apache Cassandra Documentation: Tombstones",
        "url": "https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html"
      },
      {
        "title": "NIST SP 800-88: Guidelines for Media Sanitization (Cryptographic Erase)",
        "url": "https://csrc.nist.gov/publications/detail/sp/800-88/rev-1/final"
      }
    ]
  },
  "security-and-abuse-prevention": {
    "title": "Security and abuse prevention",
    "video": {
      "youtubeId": "6WZ6S-qmtqY",
      "title": "Top 12 Tips For API Security",
      "channel": "ByteByteGo",
      "why": "Compact ByteByteGo overview of the layered controls in this unit: HTTPS, OAuth2/JWT, rate limiting, input validation, WAF and API gateway.",
      "length": "9:47"
    },
    "videos": [
      {
        "youtubeId": "uWmZZyaHFEY",
        "title": "What is mTLS? Secure Your Microservices from MITM Attacks",
        "channel": "ByteMonk",
        "role": "intro",
        "why": "Clear visual explanation of mutual TLS, the service-to-service identity layer in the lesson diagram.",
        "length": "5:49"
      },
      {
        "youtubeId": "bZiJaI390kc",
        "title": "Becoming You: A Glimpse Into Credential Abuse",
        "channel": "Black Hat",
        "role": "case-study",
        "why": "Black Hat talk on how credential-stuffing attacks actually work, which shows why simple per-IP limits are not enough.",
        "length": "28:52"
      }
    ],
    "intuition": "<p>Defence in depth works like a medieval castle: a moat, then an outer wall, then a gate with guards who check papers, then locked doors inside, then a guarded treasury. Getting over the moat does not get an attacker into the treasury. <strong>Zero trust</strong> adds one more rule: the guards check your papers at <em>every</em> door, even if you are already inside the walls.</p><p><strong>Mental model:</strong> assume every layer will eventually fail, and make sure no single failure exposes the data. Match each control to a specific threat: volumetric floods at the edge, application exploits at the WAF, account abuse in the auth service, and lateral movement inside the network with mTLS and least privilege.</p><ul><li><strong>Trap: rate-limiting login attempts only by IP.</strong> Credential stuffing spreads millions of attempts across tens of thousands of residential proxy IPs. Also limit by account and by password-failure patterns, and check passwords against known breach lists.</li><li><strong>Trap: treating a JWT as a session you can revoke.</strong> A stateless JWT stays valid until it expires. Keep access-token lifetimes short (minutes) and revoke refresh tokens on the server.</li><li><strong>Trap: secrets in code or environment dumps.</strong> Use a secrets manager with short-lived, automatically rotated credentials.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Defense-in-Depth Architecture</h2>\n      <p>Modern system design operates under the <strong>Zero Trust</strong> security paradigm: assume the perimeter is already breached, network transport is inherently hostile, and every request must be authenticated, authorized, and continuously validated. Relying on a single firewall or border proxy creates a catastrophic single point of failure.</p>\n\n      <h2>Layered Defense Perimeter</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Internet[\"Public Internet Traffic\"] --> Cloudflare[\"1. Edge CDN & DDoS Mitigation (Anycast BGP Scrubbing)\"]\n    Cloudflare --> WAF[\"2. Web Application Firewall (SQLi, XSS, OWASP Top 10)\"]\n    WAF --> BotMit[\"3. Bot & Abuse Detection (JA3 Fingerprinting, Turnstile)\"]\n    BotMit --> Gateway[\"4. API Gateway (OAuth2 / JWT Token Validation, Rate Limiting)\"]\n    Gateway --> Mesh[\"5. Internal Service Mesh (Mutual TLS 1.3 with SPIFFE / SPIRE)\"]\n    Mesh --> ServiceA[\"Microservice A (Least Privilege IAM)\"]\n    ServiceA --> DB[(\"Encrypted Datastore (Envelope Encryption with AWS KMS / HashiCorp Vault)\")]\n      </div>\n\n      <h2>Production Abuse Mitigation Vectors</h2>\n      <h3>1. Credential Stuffing & Automated Bot Mitigation</h3>\n      <p>Malicious actors weaponize billions of leaked password dumps to execute automated distributed brute-force attempts against login and authentication endpoints. Defenses include TLS Client Hello (JA3/JA4) fingerprinting to identify headless HTTP client scripts, IP reputation lookups, and progressive behavioral challenges (invisible CAPTCHA) triggered when request anomalies exceed threshold limits.</p>\n\n      <h3>2. Mutual TLS (mTLS) & Workload Identity</h3>\n      <p>Inside the cloud datacenter, plain unencrypted HTTP between microservices is unacceptable. Service meshes (Istio, Linkerd) enforce <strong>Mutual TLS (mTLS)</strong> with short-lived x509 certificates issued by the mesh CA or SPIRE and rotated automatically (Istio defaults to 24-hour workload certificates; SPIRE's default SVID TTL is 1 hour; both are configurable). Every service verifies the exact cryptographic identity of the calling service before granting RPC access.</p>\n\n      <h3>3. Envelope Encryption at Rest</h3>\n      <p>Data written to persistent storage is secured using <strong>Envelope Encryption</strong>: a unique local Data Encryption Key (DEK) encrypts the file or database row, and the DEK itself is encrypted by a root Key Encryption Key (KEK) locked inside a Hardware Security Module (HSM / AWS KMS). The plaintext DEK exists only in volatile memory during active encryption/decryption.</p>\n    \n<!-- enriched -->\n<h2>Threat-to-control map</h2><table><thead><tr><th>Threat</th><th>Layer</th><th>Control</th><th>Real-world example</th></tr></thead><tbody><tr><td>Volumetric DDoS (UDP/SYN floods, amplification)</td><td>Network edge</td><td>Anycast absorption, scrubbing, SYN cookies</td><td>Cloudflare, AWS Shield, Google Cloud Armor</td></tr><tr><td>HTTP floods at layer 7</td><td>CDN/WAF</td><td>Per-path rate limits, challenge pages, caching</td><td>Cloudflare and Google publicly reported HTTP/2 Rapid Reset attacks peaking at hundreds of millions of requests per second in 2023</td></tr><tr><td>SQL injection, XSS, SSRF</td><td>WAF + application</td><td>Parameterised queries, output encoding, egress allow-lists</td><td>OWASP Top 10; the 2019 Capital One breach involved SSRF against cloud instance metadata</td></tr><tr><td>Credential stuffing, account takeover</td><td>Auth service</td><td>Per-account throttling, breached-password checks, MFA, risk scoring</td><td>Have I Been Pwned k-anonymity range API</td></tr><tr><td>Lateral movement after a breach</td><td>Service mesh</td><td>mTLS workload identity, per-service authorisation policy</td><td>SPIFFE/SPIRE, Istio, Google BeyondProd</td></tr><tr><td>Stolen disks or snapshots</td><td>Storage</td><td>Envelope encryption with KMS/HSM, key access logging</td><td>AWS KMS, Google Cloud KMS, HashiCorp Vault</td></tr></tbody></table><h2>Worked example: credential stuffing against a login endpoint</h2><p>An attacker has 5 million leaked email and password pairs and a pool of 40,000 residential proxy IPs. They send 1 million attempts per hour.</p><ul><li>That is only 25 attempts per IP per hour, below a per-IP limit of 100 per hour, so IP limits alone do nothing.</li><li>A typical reuse success rate of about 0.1% to 2% means 1,000 to 20,000 accounts taken over per hour if nothing else stops the attack.</li><li><strong>Controls that do work:</strong> count failures <em>per target account</em> (for example 5 per 15 minutes, then add friction). Watch the global login failure ratio, which jumps from about 5% to 95% during an attack, and trigger challenges for the whole endpoint when it does. Check submitted passwords against breach corpora. Fingerprint clients by TLS characteristics (JA3/JA4) and HTTP header order, and require MFA for risky logins.</li><li>Return the same error and roughly the same response time for \"unknown user\" and \"wrong password\", so the endpoint does not reveal which accounts exist.</li></ul><h2>Envelope encryption, step by step</h2><div class=\"mermaid\">sequenceDiagram\n  participant App as Service\n  participant KMS as KMS or HSM\n  participant Store as Object store\n  App->>KMS: GenerateDataKey for key alias orders\n  KMS-->>App: Plaintext DEK and encrypted DEK\n  App->>App: Encrypt payload with DEK using AES-GCM, then discard plaintext DEK\n  App->>Store: Write ciphertext plus encrypted DEK\n  Note over App,KMS: To read, send the encrypted DEK to KMS Decrypt, which checks access and logs the call</div><p>The root key never leaves the HSM, and every decrypt call is authorised and logged. Rotating the root key does not require re-encrypting the data, because only the data keys are wrapped with it.</p>\n</div>",
    "keyTakeaways": [
      "Zero Trust architecture requires authenticating and encrypting every hop; never trust internal datacenter network traffic.",
      "Protect authentication endpoints using behavioral fingerprinting (JA3 TLS signatures) and composite rate limiting.",
      "Enforce Envelope Encryption with KMS-backed Hardware Security Modules to protect customer data at rest."
    ],
    "furtherReading": [
      {
        "title": "Google Cloud: BeyondCorp Zero Trust Security Framework",
        "url": "https://cloud.google.com/beyondcorp"
      },
      {
        "title": "OWASP Top Ten Web Application Security Risks",
        "url": "https://owasp.org/www-project-top-ten/"
      }
    ]
  },
  "rate-limiter-placement-and-keys": {
    "title": "Rate limiter placement and keys",
    "video": {
      "youtubeId": "Oxy-6MAiYPw",
      "title": "Inside Stripe's Rate Limiter Architecture",
      "channel": "Arpit Bhayani",
      "why": "Arpit breaks down Stripe's production setup: a request-rate limiter, a concurrency limiter and load shedders, what key each one uses and where it runs.",
      "length": "16:25"
    },
    "videos": [
      {
        "youtubeId": "MIJFyUPG4Z4",
        "title": "Design a Distributed Rate Limiter w/ a Ex-Meta Staff Engineer: System Design Breakdown",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Interview walkthrough that spends real time on where to place the limiter, how to choose keys, and fail-open versus fail-closed behaviour.",
        "length": "55:58"
      }
    ],
    "intuition": "<p>Think of a nightclub. The bouncer on the street stops a crowd from blocking the pavement (<strong>edge limits by IP</strong>). The door staff check each guest's wristband tier: VIPs get in more often (<strong>gateway limits by API key or plan</strong>). The bartender cuts you off after a set number of drinks (<strong>service-level limits per user and action</strong>). Each checkpoint knows different facts, so each one uses a different key.</p><p><strong>Mental model:</strong> <em>the key is whatever you are protecting a fair share for</em>. That might be a tenant, a user, a user-and-action pair, an IP, or the downstream dependency itself. Place each limit at the first layer that has the information needed to compute that key.</p><ul><li><strong>Trap: using IP as the only key.</strong> Carrier-grade NAT puts thousands of mobile users behind one IPv4 address, while an attacker can rotate through thousands of IPs. With IPv6, limit by prefix (for example a /64), not by single address.</li><li><strong>Trap: trusting client-supplied identifiers.</strong> A device fingerprint or an <code>X-Forwarded-For</code> header set by the client can be forged. Only trust the header value added by your own proxy.</li><li><strong>Trap: returning 429 without guidance.</strong> Send <code>Retry-After</code> and remaining-quota headers so well-behaved clients back off instead of retrying immediately.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Placement: Edge vs. Gateway vs. Service-Level</h2>\n      <ul>\n        <li><strong>CDN / Edge:</strong> Stops volumetric DDoS attacks before they reach internal cloud infrastructure. Filters by client IP.</li>\n        <li><strong>API Gateway:</strong> Protects the overall fleet. Enforces organization-wide rate limits based on API keys, authenticated user IDs, and client tiers.</li>\n        <li><strong>Service-Level:</strong> Enforces domain-specific limits (e.g., maximum 5 password reset attempts per email per hour) directly within the service.</li>\n      </ul>\n\n      <h2>Choosing the Rate Limit Key</h2>\n      <p>Rate limiting solely by IP address fails because thousands of mobile users on cellular networks or corporate offices share the same public NAT IP. Effective rate limiting uses composite keys: <code>UserId + Action</code> for authenticated users, and <code>IP + DeviceFingerprint</code> for anonymous endpoints. Client-supplied fingerprints and <code>X-Forwarded-For</code> headers can be forged, so take the IP from your own edge, and key IPv6 clients by prefix (for example /64).</p>\n    \n<!-- enriched -->\n<h2>Placement options</h2><table><thead><tr><th>Layer</th><th>Keys available</th><th>Protects</th><th>Latency cost</th><th>Examples</th></tr></thead><tbody><tr><td>CDN/edge</td><td>IP, ASN, country, path, TLS fingerprint</td><td>Whole origin against floods</td><td>None added to the origin</td><td>Cloudflare rate limiting rules, AWS WAF rate-based rules</td></tr><tr><td>API gateway</td><td>API key, tenant, plan tier, authenticated user</td><td>Fleet fairness and commercial quotas</td><td>Sub-millisecond locally, about 1 ms with a shared Redis</td><td>Envoy global rate limit service, Kong, Apigee</td></tr><tr><td>Service</td><td>User + action, resource ID, business fields</td><td>Domain invariants (password resets, SMS sends)</td><td>Similar to gateway</td><td>In-process limiter backed by Redis</td></tr><tr><td>Client of a dependency</td><td>Downstream name</td><td>A fragile dependency such as a payment processor or partner API</td><td>Local</td><td>Concurrency limits, adaptive limiters (Netflix concurrency-limits)</td></tr></tbody></table><h2>Worked example: keys for a public API</h2><ul><li><strong>Anonymous <code>GET /search</code>:</strong> key <code>ip_prefix + path</code>, 60 per minute. The IPv4 /32 and IPv6 /64 prefixes are computed from the address seen by your edge, not from a header.</li><li><strong>Authenticated API:</strong> key <code>api_key</code>, with the limit set by plan: Free 10 requests per second, Pro 100, Enterprise 1,000. Add a separate per-tenant <em>concurrency</em> limit (for example 20 requests in flight) so a few slow expensive queries cannot tie up every worker.</li><li><strong><code>POST /password-reset</code>:</strong> two limits must both pass: <code>email</code> at 5 per hour, and <code>ip_prefix</code> at 20 per hour. Together they stop both targeted harassment of one account and broad spraying across many.</li><li><strong><code>POST /sms/send</code>:</strong> key <code>tenant + destination_country</code> with a daily cost cap. SMS pumping fraud targets expensive destinations.</li></ul><h2>What Stripe runs in production</h2><p>Stripe has described four layers: a <strong>request-rate limiter</strong> (per user, token bucket), a <strong>concurrent-requests limiter</strong> (caps in-flight requests per user), a <strong>fleet usage load shedder</strong> (reserves capacity for critical traffic such as charges), and a <strong>worker utilisation load shedder</strong> (drops low-priority traffic when workers are saturated). The last two do not protect fairness between users. They protect the system as a whole, and they key on the traffic class rather than on a user.</p><h2>Failure behaviour</h2><div class=\"mermaid\">flowchart TD\n  R[\"Request arrives\"] --> Q{\"Limiter store reachable?\"}\n  Q -->|\"Yes\"| C{\"Within limit?\"}\n  C -->|\"Yes\"| A[\"Allow\"]\n  C -->|\"No\"| D[\"429 with Retry-After\"]\n  Q -->|\"No, timeout 5 ms\"| F{\"Endpoint policy\"}\n  F -->|\"Fail open\"| L[\"Allow, fall back to a local approximate limit\"]\n  F -->|\"Fail closed\"| D</div><p>Most APIs <strong>fail open</strong>, because the limiter should not become a single point of failure, and they keep a coarse in-memory limit on each instance as a backstop. Security-sensitive endpoints such as login, OTP and payments often <strong>fail closed</strong>.</p>\n</div>",
    "keyTakeaways": [
      "Place rate limiters at multiple tiers: Edge (DDoS), API Gateway (API keys), and Service (business operations).",
      "Avoid IP-only rate limiting due to shared corporate NAT gateways; use composite keys.",
      "Choose fail-open, fail-closed, or a local emergency limit per operation: low-risk reads may degrade open, while login, password reset, spending, and expensive endpoints still need protection when Redis fails."
    ],
    "furtherReading": [
      {
        "title": "Envoy Proxy: Global Rate Limiting Architecture",
        "url": "https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting"
      },
      {
        "title": "Microsoft Azure: Rate Limiting Patterns and Best Practices",
        "url": "https://docs.microsoft.com/en-us/azure/architecture/patterns/rate-limiting-pattern"
      },
      {
        "title": "IETF Draft: Rate Limiting for HTTP APIs",
        "url": "https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/"
      }
    ]
  },
  "sliding-window-rate-limiter": {
    "title": "Sliding window rate limiter",
    "video": {
      "youtubeId": "mQCJJqUfn9Y",
      "title": "Five Rate Limiting Algorithms ~ Key Concepts in System Design",
      "channel": "Hello Byte",
      "why": "A careful algorithm-by-algorithm walkthrough, including sliding window log and sliding window counter, with the boundary-burst problem made visual.",
      "length": "17:22"
    },
    "videos": [
      {
        "youtubeId": "YXkOdWBwqaA",
        "title": "Rate Limiter System Design: Token Bucket, Leaky Bucket, Scaling",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Short ByteByteGo refresher on token and leaky buckets and on scaling a limiter with Redis.",
        "length": "7:46"
      },
      {
        "youtubeId": "FU4WlwfS3G0",
        "title": "System Design Interview - Rate Limiting (local and distributed)",
        "channel": "System Design Interview",
        "role": "deep-dive",
        "why": "A well-regarded deep dive on implementing limiters in code and distributing them across hosts.",
        "length": "34:36"
      }
    ],
    "intuition": "<p>Imagine a gym that allows 100 visits per hour and counts check-ins on a clock-hour sheet. Someone can check in 100 people at 10:59 and another 100 at 11:00, so 200 people arrive in two minutes and both hourly sheets look fine. A <strong>sliding window</strong> instead asks: \"how many check-ins in the <em>last 60 minutes</em>, counting back from now?\" The <strong>sliding window counter</strong> estimates that number using only this hour's sheet and last hour's sheet, weighting last hour's count by how much of it still falls inside the window.</p><p><strong>Mental model:</strong> <em>estimate = previous_count x (fraction of the previous window still inside the sliding window) + current_count</em>. It needs two counters per key and gives a close approximation.</p><ul><li><strong>Trap: calling it exact.</strong> The counter assumes the previous window's requests were spread evenly across it. Use a sliding window <em>log</em> (a sorted set of timestamps) if you need exact counts, and accept that memory grows with the limit.</li><li><strong>Trap: GET then INCR from the application.</strong> Two servers can both read 99 and both allow a request. Do the read, the decision and the increment atomically in a Lua script or with a single INCR.</li><li><strong>Trap: using keys that share no hash slot in Redis Cluster.</strong> A Lua script that touches two keys needs both keys in the same slot. Use hash tags such as <code>rl:{user42}:1700</code>.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Under the Hood: Eliminating the Boundary Burst Flaw</h2>\n      <p>Rate limiting algorithms prevent system overload by bounding request frequency over time. Naive <strong>Fixed Window Counters</strong> suffer from the 2x burst vulnerability: if a limit allows 100 requests/minute, an attacker can dispatch 100 requests at 00:59 and another 100 requests at 01:00, forcing 200 requests within a 2-second window without triggering any rate limit violation.</p>\n\n      <h2>Rate Limiting Algorithms Compared</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Algo{\"Algorithm Choice\"}\n    Algo -->|\"Exact precision, High memory footprint\"| SWL[\"Sliding Window Log: Redis Sorted Set with Unix Timestamps\"]\n    Algo -->|\"O(1) memory, Smooth boundary interpolation\"| SWC[\"Sliding Window Counter: Weighted Past + Current Window\"]\n    Algo -->|\"Smooth traffic shaping, Queue buffer\"| LB[\"Leaky Bucket: Constant Outflow Rate\"]\n    Algo -->|\"Bursty traffic allowance\"| TB[\"Token Bucket: Refill Rate + Max Bucket Burst\"]\n      </div>\n\n      <h2>Sliding Window Counter Mathematics & Implementation</h2>\n      <p>The <strong>Sliding Window Counter</strong> combines the memory efficiency of fixed windows with the smoothness of a continuous sliding window. It tracks request counts across only two keys (the current window and the previous window) and calculates an interpolated estimate:</p>\n\n      <pre><code>Estimated Count = (Previous Window Count * (1 - Current Offset Ratio)) + Current Window Count\nWhere Current Offset Ratio = (Current Timestamp - Window Start) / Window Duration</code></pre>\n\n      <h3>Concrete Numeric Example:</h3>\n      <p>Suppose the limit is 100 requests per 60-second window. The previous window recorded 80 requests. We are currently 15 seconds into the new window (25% through), and have registered 30 requests so far:</p>\n      <pre><code>Estimated Count = (80 * (1 - 0.25)) + 30 = (80 * 0.75) + 30 = 60 + 30 = 90 requests (Allowed, 90 &lt; 100)</code></pre>\n\n      <h2>Atomic Redis Execution with Lua</h2>\n      <p>Because multiple concurrent application servers query the rate limiter simultaneously, checking and incrementing counters across network hops introduces race conditions. Production architectures wrap the lookup and increment logic inside an atomic <strong>Redis Lua Script</strong>, guaranteeing single-threaded atomic execution with zero distributed lock contention.</p>\n    \n<!-- enriched -->\n<h2>Algorithm comparison</h2><table><thead><tr><th>Algorithm</th><th>State per key</th><th>Accuracy</th><th>Burst behaviour</th><th>Used by</th></tr></thead><tbody><tr><td>Fixed window counter</td><td>1 integer</td><td>Allows up to 2x the limit at window boundaries</td><td>Bursts at window edges</td><td>Simple quotas, daily caps</td></tr><tr><td>Sliding window log</td><td>One entry per request (up to the limit)</td><td>Exact</td><td>None beyond the limit</td><td>Low limits where exactness matters (login attempts)</td></tr><tr><td>Sliding window counter</td><td>2 integers</td><td>Approximate; Cloudflare reported about 0.003% of requests wrongly allowed or limited in its production analysis</td><td>Smooth</td><td>Cloudflare rate limiting</td></tr><tr><td>Token bucket</td><td>Token count + last refill time</td><td>Exact for its model</td><td>Allows bursts up to the bucket size, then the average rate</td><td>Stripe, AWS API Gateway, Envoy local rate limit</td></tr><tr><td>GCRA (generic cell rate)</td><td>1 timestamp</td><td>Exact for its model</td><td>Like a token bucket</td><td>redis-cell; the algorithm comes from ATM (Asynchronous Transfer Mode) networking</td></tr></tbody></table><h2>Worked example: why the counter needs the weighting</h2><p>The limit is 100 per 60 s. In the window from 12:00:00 to 12:01:00 there were 90 requests, and all of them arrived after 12:00:50. It is now 12:01:10, so we are 10 s (one sixth) into the current window, which has 20 requests so far.</p><ul><li><strong>Fixed window:</strong> the counter sees 20 and allows the request, even though 110 requests actually arrived in the last 20 s.</li><li><strong>Sliding window counter:</strong> 90 x (1 - 1/6) + 20 = 75 + 20 = 95, so the request is allowed, and only 5 more will be allowed right now.</li><li><strong>Sliding window log (exact):</strong> the real count for 12:00:10 to 12:01:10 is 90 + 20 = 110, so the request is rejected.</li></ul><p>This is the worst case for the approximation: the previous window's traffic was all bunched at its end. With the more typical evenly spread traffic, the estimate is very close to the true count. That is why Cloudflare found the error acceptable at its scale.</p><h2>Atomic implementation sketch (Redis)</h2><p>Keys are <code>rl:{client}:W</code>, where W is <code>floor(now / window)</code>. The Lua script does the following:</p><ul><li><code>INCR</code> the current window key, and set <code>EXPIRE</code> to twice the window length on the first increment.</li><li><code>GET</code> the previous window key (treat missing as 0).</li><li>Compute <code>prev x (1 - elapsed/window) + curr</code>. If it exceeds the limit, <code>DECR</code> the current key and return \"rejected\" together with a retry-after value.</li></ul><p>Everything runs in one round trip, and Redis executes scripts one at a time, so no race is possible. Take <code>now</code> from the Redis <code>TIME</code> command instead of each application server's clock, so clock skew between servers does not shift the windows.</p><h2>Scaling notes</h2><ul><li>At 1 million active keys, two counters each (2 million small keys with expiries) take very roughly 150 to 250 MB in Redis including overhead. A sliding log with a limit of 1,000 could take hundreds of times more.</li><li>For global limits across regions, either accept per-region limits (the global limit divided by the number of regions) or sync counters asynchronously and accept some overshoot.</li></ul>\n</div>",
    "keyTakeaways": [
      "Fixed window limiters allow 2x traffic bursts across window boundaries; sliding window counter smooths this boundary.",
      "Sliding window counter uses only 2 integer keys per client, achieving O(1) memory vs O(N) memory in sliding window logs.",
      "Execute rate limit checks atomically using Redis Lua scripts to eliminate race conditions between concurrent requests."
    ],
    "furtherReading": [
      {
        "title": "Cloudflare Engineering: How We Built Rate Limiting at Global Scale",
        "url": "https://blog.cloudflare.com/counting-things-a-lot-of-different-things/"
      },
      {
        "title": "Figma: An Alternative Approach to Rate Limiting",
        "url": "https://www.figma.com/blog/an-alternative-approach-to-rate-limiting/"
      }
    ]
  },
  "multi-tenant-design": {
    "title": "Multi-tenant design",
    "video": {
      "youtubeId": "KYf-3pXANto",
      "title": "Building Multi-Tenant SaaS Architectures • Tod Golding & Bill Tarr • GOTO 2024",
      "channel": "GOTO Conferences",
      "why": "Tod Golding, AWS SaaS Factory lead and author of the O'Reilly book on the subject, explains silo, bridge and pool models, tenant context and noisy-neighbour controls.",
      "length": "40:06"
    },
    "videos": [
      {
        "youtubeId": "vZT1Qx2xUCo",
        "title": "Everything you need to know about Postgres Row Level Security | POSETTE 2024",
        "channel": "Microsoft Developer",
        "role": "deep-dive",
        "why": "Concrete look at Postgres RLS, the mechanism the pool model depends on to prevent leaks between tenants.",
        "length": "18:19"
      },
      {
        "youtubeId": "wrVKnQvDJy0",
        "title": "Think Multi-Tenancy Is Easy? Think Again...",
        "channel": "Software Developer Diaries",
        "role": "intro",
        "why": "Accessible overview of tenancy models and the common mistakes teams make with them.",
        "length": "14:59"
      }
    ],
    "intuition": "<p>Tenancy models are like housing. The <strong>silo</strong> model is a detached house for each family: private and customisable, but expensive, and each one needs its own maintenance. The <strong>bridge</strong> model is a block of flats: shared foundations with separate locked units. The <strong>pool</strong> model is a hostel: everyone shares the same rooms and relies on a locked locker (the <code>tenant_id</code> check) for privacy. Most SaaS companies end up offering hostel prices to small customers and houses to large enterprise customers.</p><p><strong>Mental model:</strong> <em>tenant context must flow through every request and every query</em>, and isolation should be enforced by infrastructure (RLS, IAM policies, separate databases), not only by developers remembering to add <code>WHERE tenant_id = ?</code>.</p><ul><li><strong>Trap: relying on application WHERE clauses alone.</strong> One missing filter in one query is a data breach between customers. Add RLS or a per-tenant scoped credential as a second line of defence.</li><li><strong>Trap: caches and search indexes without tenant in the key.</strong> A cache key like <code>report:2024-05</code> will happily serve tenant A's report to tenant B.</li><li><strong>Trap: one huge tenant in a pooled shard.</strong> Tenant sizes often follow a power law. Plan to move whales to their own shard or silo.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Multi-Tenancy Isolation Models</h2>\n      <p>Multi-tenant SaaS architectures balance tenant data isolation against infrastructure cost:</p>\n      <ul>\n        <li><strong>Silo Model (Database-per-Tenant):</strong> Each tenant gets a dedicated database instance. Provides maximum isolation and security compliance; highest operational and infrastructure cost.</li>\n        <li><strong>Bridge Model (Schema-per-Tenant):</strong> Tenants share a database cluster but use separate PostgreSQL schemas.</li>\n        <li><strong>Pool Model (Shared Database & Tables):</strong> All tenants share the same tables, with every row containing a <code>tenant_id</code> column. Most cost-effective; requires strict Row-Level Security (RLS) to prevent cross-tenant data leaks.</li>\n      </ul>\n\n      <h2>The Noisy Neighbor Problem</h2>\n      <p>A single large tenant executing heavy batch queries can starve CPU and IOPS, degrading performance for all other tenants. Multi-tenant systems enforce per-tenant rate limits, resource quotas, and tenant-aware database connection pools.</p>\n    \n<!-- enriched -->\n<h2>Isolation models compared</h2><table><thead><tr><th>Model</th><th>Isolation</th><th>Cost per tenant</th><th>Operations at 10,000 tenants</th><th>Typical fit</th></tr></thead><tbody><tr><td>Silo (database or account per tenant)</td><td>Strongest; separate blast radius and encryption keys</td><td>High</td><td>10,000 databases to migrate, monitor and back up</td><td>Enterprise, regulated or data-residency customers</td></tr><tr><td>Bridge (schema per tenant)</td><td>Medium; shared engine and resources</td><td>Medium</td><td>Schema migrations times 10,000; catalogue bloat in PostgreSQL</td><td>Mid-size B2B with a moderate number of tenants</td></tr><tr><td>Pool (shared tables with tenant_id)</td><td>Logical only; needs RLS and careful keys</td><td>Lowest</td><td>One schema; shard by tenant_id</td><td>Self-serve or long-tail customers</td></tr><tr><td>Cell-based (pool within cells, many cells)</td><td>Blast radius limited to one cell</td><td>Low to medium</td><td>Tens of cells, each a full stack</td><td>Large SaaS such as Slack or Salesforce, and AWS services</td></tr></tbody></table><h2>Worked example: tiered tenancy for a B2B analytics product</h2><ul><li>9,800 free and Pro tenants average 2 GB each, about 20 TB in total. They are pooled across 8 Postgres shards (for example with Citus distributing on <code>tenant_id</code>), roughly 2.5 TB per shard.</li><li>200 enterprise tenants average 300 GB each. Anyone above 1 TB, or with a residency requirement, gets a silo database in the region they need.</li><li>Per-tenant limits in the pool: 50 queries per second, a 10 s statement timeout, and at most 5 concurrent heavy queries, enforced at the API gateway and by a tenant-aware connection pool.</li><li>Moving a growing tenant from pool to silo uses the same expand, copy, dual-write, cut-over process as any database migration, keyed on <code>tenant_id</code>. Build this tooling early; you will need it.</li></ul><h2>Enforcing isolation in the pool</h2><p>In PostgreSQL, enable RLS with a policy such as <code>USING (tenant_id = current_setting('app.tenant_id')::uuid)</code>, and set <code>app.tenant_id</code> at the start of every transaction from the authenticated token. Keep in mind:</p><ul><li>Table owners and superusers bypass RLS unless you use <code>FORCE ROW LEVEL SECURITY</code>. Run the application as a role without those privileges.</li><li>With transaction-mode connection pooling (PgBouncer), use <code>SET LOCAL</code> inside the transaction, so a session setting cannot leak to the next tenant who gets that connection.</li><li>Put <code>tenant_id</code> first in composite indexes and primary keys, so queries for one tenant stay on a narrow index range and the table can be sharded by tenant later.</li></ul><h2>Noisy neighbour controls</h2><div class=\"mermaid\">flowchart LR\n  T[\"Tenant request\"] --> G[\"Gateway: per-tenant rate and concurrency limit\"]\n  G --> Q[\"Per-tenant fair queue for background jobs\"]\n  Q --> DB[\"Pooled shard with statement timeout\"]\n  DB --> M[\"Per-tenant usage metrics\"]\n  M -->|\"sustained heavy use\"| MV[\"Move tenant to its own shard or silo\"]</div><p>Tag every metric and log line with <code>tenant_id</code>, keeping it in logs and exemplars where cardinality is too high for metric labels. Without per-tenant usage data you cannot find the noisy neighbour, charge fairly, or decide who to move.</p>\n</div>",
    "keyTakeaways": [
      "Choose the right isolation model: Silo (dedicated DBs), Bridge (dedicated schemas), or Pool (shared tables with tenant_id).",
      "Use PostgreSQL Row-Level Security (RLS) to enforce tenant isolation at the database engine level.",
      "Prevent noisy neighbors with per-tenant connection pooling and CPU/memory resource quotas."
    ],
    "furtherReading": [
      {
        "title": "AWS SaaS Architecture Fundamentals",
        "url": "https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/architecture-patterns.html"
      },
      {
        "title": "Google Cloud: GKE Cluster multi-tenancy",
        "url": "https://cloud.google.com/kubernetes-engine/docs/concepts/multitenancy-overview"
      },
      {
        "title": "Microsoft Azure Architecture Center: Architect multitenant solutions on Azure",
        "url": "https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview"
      }
    ]
  }
};
