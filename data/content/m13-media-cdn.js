window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-media-files"] = {
  "direct-to-object-storage-upload": {
    "title": "Direct-to-object-storage upload",
    "video": {
      "youtubeId": "RvaMHMxHjp4",
      "title": "Object Storage in System Design Interviews w/ Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Kept: the most on-topic system-design explanation of presigned URLs, direct client uploads, multipart and event-driven post-processing.",
      "length": "12:37"
    },
    "videos": [
      {
        "youtubeId": "0lO2zEHFoh4",
        "title": "What Are Object Stores Used For? [S3] | Systems Design Interview 0 to 1 With Ex-Google SWE",
        "channel": "Jordan has no life",
        "role": "intro",
        "why": "Short conceptual primer on why blobs belong in object storage and metadata in a database.",
        "length": "8:06"
      },
      {
        "youtubeId": "V2arOZ72d6M",
        "title": "Amazon S3 Presigned URLs Uploads and Downloads Tutorial",
        "channel": "Milan Jovanović",
        "role": "deep-dive",
        "why": "A hands-on implementation of presigned upload and download URLs; the demo uses .NET but the flow is language-agnostic.",
        "length": "14:46"
      }
    ],
    "intuition": "<p>A valet ticket lets someone else park your car without holding your house keys. A presigned URL is the same idea: your server writes a short-lived, signed permission slip that says \"this client may PUT exactly this object key, with this content type, for the next 15 minutes\", and the client hands its bytes straight to the storage service.</p><p><strong>Mental model:</strong> the application server stays on the control plane (who may upload what, where, and what happens next), while the object store carries the data plane (the bytes).</p><ul><li><strong>Letting the client choose the key.</strong> The server should pick the key (for example a random UUID under a pending prefix) so clients cannot overwrite others' objects.</li><li><strong>Trusting the upload.</strong> Validate size, type by magic bytes, and malware after upload, before the object becomes public or referenced.</li><li><strong>Forgetting orphans.</strong> Many clients request a URL and never finish; lifecycle rules should delete pending objects older than a day.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Why Avoid Routing Uploads Through Application Servers?</h2>\n      <p>In naive architectures, users upload photos or video files directly to an application server, which buffers the file in memory or temporary disk before uploading it to object storage (like Amazon S3 or Google Cloud Storage). This anti-pattern exhausts server network bandwidth, ties up worker threads during slow mobile uploads, and concentrates network, connection and memory pressure on the API tier.</p>\n\n      <h2>The Pre-Signed URL Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client Mobile / Web\"] -->|1. Request Upload Ticket| AppAPI[\"Application Server API\"]\n    AppAPI -->|\"2. Sign URL locally with SigV4\"| Signer[\"Local signing with IAM credentials: no call to S3\"]\n    AppAPI -->|3. Return Signed PUT URL + Object Key| Client\n    Client -->|4. Direct Binary PUT Upload| S3Bucket[(\"Amazon S3 / GCS Bucket\")]\n    S3Bucket -->|5. S3 Event Notification| SQS[\"SQS / EventBridge Queue\"]\n    SQS --> Worker[\"Async Processing Worker: Thumbnails / Virus Scan\"]\n    Worker --> DB[(\"Metadata Database\")]\n      </div>\n\n      <h2>How Pre-Signed URLs Work</h2>\n      <p>The application server uses AWS IAM credentials to generate a cryptographically signed HMAC-SHA256 signature containing:</p>\n      <ul>\n        <li>The exact S3 object key (e.g., <code>uploads/users/42/avatar.jpg</code>).</li>\n        <li>Allowed HTTP method (strictly <code>PUT</code>).</li>\n        <li>Expiration timestamp (e.g., 15 minutes).</li>\n        <li>Optional signed headers such as an exact <code>Content-Type</code>. A pre-signed S3 PUT does not provide a size range (signing Content-Length pins one exact length, nothing more); use a pre-signed POST with a <code>content-length-range</code> condition where appropriate, and verify the stored object's size before publishing it.</li>\n      </ul>\n      <p>The client uses this URL to stream the binary payload directly to S3. The application server never touches the file bytes, scaling effortlessly to hundreds of thousands of concurrent uploads.</p>\n    \n<!-- enriched -->\n<h2>Worked example: why proxying bytes hurts</h2><p>With 50,000 concurrent mobile uploads averaging 5 Mbit/s, proxying through your API means about 250 Gbit/s of ingress and egress on application servers. A 20 MB photo on a 2 Mbit/s uplink takes about 80 seconds, holding a worker, a socket and buffer memory the whole time. With direct upload, the API handles one small signing request (a few milliseconds of CPU) and one completion callback per file.</p><h2>Upload flow in detail</h2><ol><li>Client calls <code>POST /uploads</code> with intended type and size. The server checks quota and auth, creates a metadata row with state pending, and picks key <code>pending/u42/9f1c...jpg</code>.</li><li>The server signs a presigned POST policy with conditions: exact key, content-length-range from 1 byte to 25 MB, Content-Type starting with image/, expiry 15 minutes. Signing is a local HMAC computation with the server's credentials; no call to S3 is needed.</li><li>The client uploads directly to the bucket.</li><li>An object-created event goes to a queue; a worker checks the real size and magic bytes, scans it, strips EXIF location data, generates thumbnails, and copies it to its final key.</li><li>The worker marks the metadata row ready; only now can the object be referenced by posts or profiles.</li></ol><h2>Trade-offs</h2><table><thead><tr><th>Method</th><th>Size enforcement</th><th>Resumable</th><th>Server load</th><th>Best for</th></tr></thead><tbody><tr><td>Proxy through app server</td><td>Full control</td><td>Only if you build it</td><td>High: all bytes</td><td>Tiny files, strict inline validation</td></tr><tr><td>Presigned PUT</td><td>Exact length only if Content-Length is a signed header; otherwise verify after</td><td>No</td><td>Minimal</td><td>Simple uploads up to a few hundred MB</td></tr><tr><td>Presigned POST with policy</td><td>content-length-range condition enforced by S3</td><td>No</td><td>Minimal</td><td>Browser form uploads with size limits</td></tr><tr><td>Multipart with presigned parts</td><td>Per part, verify total after</td><td>Yes, per part</td><td>Minimal; one signing call per part</td><td>Large files and flaky networks</td></tr></tbody></table><h2>Equivalents in other clouds</h2><ul><li>Google Cloud Storage offers signed URLs and a resumable upload protocol.</li><li>Azure Blob Storage uses shared access signature (SAS) tokens scoped to a blob, permissions and expiry.</li><li>If the URL is created with temporary credentials (for example an IAM role session), it stops working when those credentials expire, even if its own expiry is later.</li></ul>\n</div>",
    "keyTakeaways": [
      "Never stream large file uploads through application servers; upload directly to S3 via pre-signed URLs.",
      "Pre-signed URLs bind the permitted operation, object key, expiry, and any explicitly signed headers; enforce an upload size range with an appropriate POST policy or post-upload validation.",
      "Use S3 Event Notifications (via SQS/SNS) to trigger asynchronous downstream thumbnailing and validation."
    ],
    "furtherReading": [
      {
        "title": "AWS S3: Uploading objects using pre-signed URLs",
        "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html"
      },
      {
        "title": "Google Cloud: Signed URLs for Object Storage",
        "url": "https://cloud.google.com/storage/docs/access-control/signed-urls"
      }
    ]
  },
  "image-cdn-and-resizing": {
    "title": "Image CDN and resizing",
    "video": {
      "youtubeId": "IDy5wKpyH7Q",
      "title": "Build your own Cloudinary -  Image Optimisation on the fly",
      "channel": "Piyush Garg",
      "why": "Builds exactly this unit's architecture, URL-parameter driven on-the-fly resize and format conversion from an original in object storage behind a cache.",
      "length": "46:07"
    },
    "videos": [
      {
        "youtubeId": "FczWm6kx0Kg",
        "title": "How Dropbox efficiently serves and renders a large number of thumbnails",
        "channel": "Arpit Bhayani",
        "role": "case-study",
        "why": "A real engineering case study on serving huge numbers of thumbnails efficiently, including batching and caching decisions.",
        "length": "19:03"
      },
      {
        "youtubeId": "RI9np1LWzqw",
        "title": "What Is A CDN? How Does It Work?",
        "channel": "ByteByteGo",
        "role": "intro",
        "why": "Quick refresher on edge caching, cache keys and origin fetches, the layer the resizer sits behind.",
        "length": "4:24"
      }
    ],
    "intuition": "<p>A tailor keeps one bolt of master cloth. When a customer asks for a shirt in size 40, the tailor cuts it once, then keeps that shirt in the shop window so the next size-40 customer gets it instantly. Nobody pre-cuts every size in every colour, because most combinations are never requested.</p><p><strong>Mental model:</strong> store only the original, derive variants on the first request, and let the CDN cache each variant under a normalized cache key.</p><ul><li><strong>Accepting arbitrary sizes.</strong> If w can be any integer, an attacker requests w=1 to w=5000 and forces thousands of expensive resizes that bypass the cache; snap to an allowlist of widths or sign transform URLs.</li><li><strong>Negotiating format without varying the cache.</strong> If the edge returns AVIF to browsers that send the right Accept header, the cache key (or Vary) must include the chosen format, or Safari users get a format they cannot decode.</li><li><strong>No origin shield.</strong> Without a shield tier, a miss in each of hundreds of edge locations triggers its own resize of the same variant.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>On-the-Fly Image Processing vs. Batch Pre-Generation</h2>\n      <p>Modern applications display images across hundreds of device resolutions, responsive breakpoints, and formats (WebP, AVIF, JPEG). Pre-generating and storing every dimension permutation multiplies storage costs (sizes x formats x densities). Modern media platforms generate resized variants <strong>on-demand at the CDN edge</strong>.</p>\n\n      <h2>Dynamic Image Processing Pipeline</h2>\n      <div class=\"mermaid\">\nflowchart LR\n    User[\"Browser Request: /img/banner.jpg?w=600&fmt=webp\"] --> Edge[\"Cloudflare / CloudFront CDN Edge\"]\n    Edge -->|Edge Cache Hit| User\n    Edge -->|Cache Miss| Serverless[\"Edge Worker / Image Resizing Lambda\"]\n    Serverless --> OrigCache[\"Original S3 Bucket\"]\n    Serverless --> Transform[\"Resize, Crop & Encode WebP\"]\n    Transform --> Edge\n    Edge --> User\n      </div>\n\n      <h2>Edge Transformation Mechanics</h2>\n      <ul>\n        <li>Clients request images with query parameters: <code>/images/profile.jpg?width=400&quality=80&format=webp</code>.</li>\n        <li>The CDN edge checks if that exact transformed combination is cached. If yes, it returns it instantly from edge cache.</li>\n        <li>On cache miss, a lightweight serverless worker (e.g., Cloudflare Workers, AWS Lambda@Edge) fetches the original master image from S3, applies resizing using libvips/Sharp, stores the result in CDN cache, and serves the client.</li>\n        <li>Only accept an allowlist of widths and qualities (or signed transform URLs); otherwise arbitrary parameters let anyone force uncached, expensive resizes.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: pre-generate versus on demand</h2><p>Ten million originals averaging 2 MB is 20 TB. Suppose the product uses 6 widths x 3 formats (JPEG, WebP, AVIF) x 2 pixel densities = 36 variants averaging 60 KB.</p><ul><li><strong>Pre-generate all:</strong> 10M x 36 x 60 KB = about 21.6 TB of extra storage, plus 360 million resize jobs up front, most for images that will never be viewed at that size.</li><li><strong>On demand:</strong> if 80 percent of views hit 10 percent of images in 4 popular variants, the working set is about 10M x 0.1 x 4 x 60 KB = 240 GB, which fits comfortably in CDN caches. A resize with libvips of a 12 megapixel JPEG typically takes tens of milliseconds, paid once per variant per shield.</li></ul><h2>Cache key normalization</h2><p>Turn <code>/img/abc.jpg?width=611&amp;q=83&amp;fmt=auto</code> into a canonical form: width snapped up to the nearest of 160, 320, 640, 960, 1280, 1920; quality to one of three presets; format resolved from Accept to avif, webp or jpeg; parameters sorted. The canonical string is the cache key, so equivalent requests share one cached object.</p><h2>Trade-offs</h2><table><thead><tr><th>Approach</th><th>Storage</th><th>First-view latency</th><th>Operational risk</th></tr></thead><tbody><tr><td>Pre-generate every variant</td><td>Highest</td><td>Lowest</td><td>Backfills needed when you add a size or format</td></tr><tr><td>On demand at the edge</td><td>Lowest</td><td>Resize cost on first miss</td><td>Cache-busting abuse if parameters are open</td></tr><tr><td>Hybrid: pre-generate the 2 or 3 hottest sizes, rest on demand</td><td>Moderate</td><td>Low for common views</td><td>Two code paths to keep consistent</td></tr></tbody></table><div class=\"mermaid\">flowchart LR\n    B[\"Browser\"] --> E[\"CDN edge\"]\n    E -- \"miss\" --> S[\"Origin shield\"]\n    S -- \"miss\" --> R[\"Resize service\"]\n    R --> O[\"Original in object storage\"]\n    R --> S\n    S --> E\n    E --> B\n</div><h2>How real systems do it</h2><ul><li>Cloudflare Image Resizing, imgix and Cloudinary expose URL-parameter transforms at the edge.</li><li>Thumbor is a widely used open-source resize server, and AWS publishes a Serverless Image Handler reference architecture using CloudFront, Lambda and Sharp.</li><li>Use Cache-Control with a long max-age on variants and version originals by key, so a replaced image gets a new URL instead of needing a purge.</li></ul>\n</div>",
    "keyTakeaways": [
      "Avoid pre-generating hundreds of image sizes; resize dynamically on-the-fly at the CDN edge.",
      "Serve modern compressed formats (WebP and AVIF) to slash bandwidth consumption by 30-50%.",
      "Cache transformed assets at the CDN edge keyed by width, height, quality, and format."
    ],
    "furtherReading": [
      {
        "title": "Cloudflare Image Resizing at the Edge",
        "url": "https://developers.cloudflare.com/images/image-resizing/"
      },
      {
        "title": "Akamai: Image & Video Manager",
        "url": "https://www.akamai.com/products/image-and-video-manager"
      }
    ]
  },
  "gravatar-style-avatar-service": {
    "title": "An avatar service",
    "video": {
      "youtubeId": "mVmIJ4hvTss",
      "title": "How Apps Store Images | System Design | AWS S3, CDN",
      "channel": "Irtiza Hafiz",
      "why": "No dedicated avatar-service video exists; this clearly covers the exact serving path for profile images (object storage, metadata, CDN) that an avatar service is built on.",
      "length": "20:05"
    },
    "videos": [
      {
        "youtubeId": "z4XdfFscxSk",
        "title": "Browser Caching Best Practices,  When to use no-cache vs max-age without breaking your site",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Explains the Cache-Control choices (max-age, no-cache, immutable, versioned URLs) that dominate an avatar service's performance.",
        "length": "18:11"
      }
    ],
    "intuition": "<p>A coat check: you hand over a numbered ticket and get your coat back. If there is no coat for that number, the attendant hands you a generated placeholder that is always the same for the same number. An avatar service maps a stable key to an image, and when no upload exists it deterministically generates one.</p><p><strong>Mental model:</strong> avatars are tiny, read-mostly, and requested on almost every page, so the design is almost entirely about cache keys, cache lifetimes and invalidation, plus making sure the lookup key does not leak identity.</p><ul><li><strong>Thinking a hash of an email is anonymous.</strong> Anyone with a list of emails can hash them and match; unsalted MD5 or SHA-256 of an email is pseudonymous, not private.</li><li><strong>Long cache lifetimes on a mutable URL.</strong> With max-age of a week on /avatar/42, users see an old photo for a week after changing it; put a version in the URL instead.</li><li><strong>Serving the full upload.</strong> Resize to a small set of sizes; a 4 MB original shown at 32 pixels wastes bandwidth on every comment.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Deterministic Avatar Lookup Architecture</h2>\n      <p>A global avatar service (like Gravatar or GitHub identicons) maps account identifiers to profile images. It may need to serve very high request volume at low latency, but its lookup key must not quietly become a directory of users.</p>\n\n      <h2>Hashing & Caching Strategy</h2>\n      <ul>\n        <li><strong>Deterministic Key Derivation:</strong> A public protocol such as Gravatar may normalize an email address and hash it for a stable lookup key. This hides the literal address but does not anonymize it: common addresses can be guessed and hashed, and the stable digest remains pseudonymous data. For a private service that does not need public interoperability, prefer an opaque user ID or a keyed derivation whose secret is not exposed to clients.</li>\n        <li><strong>Cache Headers:</strong> Avatars change infrequently. Response headers specify aggressive HTTP caching: <code>Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400</code>.</li>\n        <li><strong>Fallback Identicon Generation:</strong> If an email has no uploaded photo, the service procedurally generates an identicon (SVG or geometric pixel matrix) based on the bits of the hash with zero database round-trips.</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: traffic and caching</h2><p>One billion avatar requests per day is about 11,600 per second on average and perhaps 35,000 per second at peak. With a 99 percent CDN hit ratio, origin sees about 350 requests per second at peak. Serving sizes 32, 64, 128 and 256 pixels in WebP at 2 to 15 KB each, total egress is a few TB per day, almost all from the CDN.</p><h2>URL and caching strategies</h2><table><thead><tr><th>Strategy</th><th>Example</th><th>Staleness after change</th><th>Notes</th></tr></thead><tbody><tr><td>Mutable URL, short max-age</td><td>/avatar/42?s=64 with max-age=300</td><td>Up to 5 minutes</td><td>More origin traffic and revalidation</td></tr><tr><td>Mutable URL, long max-age</td><td>max-age=86400, s-maxage=604800</td><td>Up to a week at the CDN unless purged</td><td>Needs purge on every change</td></tr><tr><td>Versioned URL</td><td>/avatar/42/v7/64.webp with max-age=31536000, immutable</td><td>None: the page references the new version</td><td>Recommended; needs version in user metadata</td></tr><tr><td>Public hash key (Gravatar style)</td><td>/avatar/HASH?s=64</td><td>Depends on max-age</td><td>Needed for cross-site interoperability; leaks a stable pseudonymous ID</td></tr></tbody></table><h2>Lookup key privacy</h2><ul><li>Gravatar historically used the MD5 of the trimmed, lowercased email; it now also accepts SHA-256. Both are fast hashes, so a list of a million candidate emails can be tested in well under a second on commodity hardware.</li><li>For a private service, key avatars by an opaque user ID or by HMAC(secret, user_id), and never expose the email-derived value to clients.</li></ul><h2>Fallback generation</h2><ul><li>Identicons: take bits of a hash of the key and fill a symmetric 5 by 5 grid in a colour derived from other bits, similar to GitHub's default avatars. Generation is pure CPU, needs no database read, and the result can be cached like any other variant.</li><li>Initials avatars: render the user's initials on a coloured circle; cache by (initials, colour, size), not per user.</li></ul><div class=\"mermaid\">flowchart LR\n    P[\"Page renders avatar URL with version\"] --> C[\"CDN\"]\n    C -- \"miss\" --> A[\"Avatar service\"]\n    A --> M[\"Metadata: has upload, version\"]\n    M -- \"yes\" --> S[\"Resized variant in object storage\"]\n    M -- \"no\" --> G[\"Generate identicon\"]\n    S --> C\n    G --> C\n</div>\n</div>",
    "keyTakeaways": [
      "A public email hash avoids exposing the literal address but remains guessable pseudonymous data; prefer opaque IDs or keyed derivation for a private service.",
      "Use aggressive Cache-Control with stale-while-revalidate for CDN efficiency.",
      "Generate procedural identicons mathematically from hash bits when no user avatar exists."
    ],
    "furtherReading": [
      {
        "title": "Gravatar API Specification",
        "url": "https://en.gravatar.com/site/implement/"
      },
      {
        "title": "GitHub Blog: Identicons!",
        "url": "https://github.blog/news-insights/company-news/identicons/"
      }
    ]
  },
  "video-upload-signed-url-multipart": {
    "title": "Video upload: signed URLs and multipart",
    "video": {
      "youtubeId": "IUrQ5_g3XKs",
      "title": "System Design Interview: Design YouTube w/ a Ex-Meta Staff Engineer",
      "channel": "Hello Interview",
      "why": "Kept: its upload deep-dive is the clearest system-design treatment of presigned multipart uploads, resumability and post-upload processing for large video files.",
      "length": "42:39"
    },
    "videos": [
      {
        "youtubeId": "yAoKmP76oL4",
        "title": "The Last Amazon S3 Video You'll Need To Watch (Presigned URLs, Multipart Upload)",
        "channel": "Milan Jovanović",
        "role": "deep-dive",
        "why": "Implements presigned URLs and the full multipart lifecycle (initiate, upload parts, complete) end to end; .NET code but the API calls map to any SDK.",
        "length": "30:24"
      }
    ],
    "intuition": "<p>Moving house with one giant crate means one dropped crate ruins everything. Moving with 400 numbered boxes in several trucks means a dropped box is re-packed and re-sent, and the house is reassembled by box number at the end. Multipart upload is the numbered-box move for large files.</p><p><strong>Mental model:</strong> initiate an upload to get an UploadId, send numbered parts independently and in parallel (each returns an ETag), then complete with the ordered list of part numbers and ETags; nothing is visible until completion.</p><ul><li><strong>Ignoring part limits.</strong> S3 allows at most 10,000 parts and parts must be at least 5 MiB (except the last), so part size must grow with file size.</li><li><strong>Leaving incomplete uploads around.</strong> Uploaded parts of abandoned uploads are stored and billed until aborted; add a lifecycle rule to abort incomplete uploads after a few days.</li><li><strong>Keeping resume state only in memory.</strong> Persist the UploadId and completed parts on the device, or recover them with ListParts after an app restart.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Problem with Monolithic Video Uploads</h2>\n      <p>Uploading a 4GB video over a mobile or residential connection can take 30 minutes. If a standard single-part HTTP upload fails at 98%, the entire upload must restart from byte 0. S3 Multipart Upload solves this by breaking files into independent chunks.</p>\n\n      <h2>S3 Multipart Upload Lifecycle</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Client App\"] -->|1. Initiate Multipart| API[\"App Server API\"]\n    API -->|2. CreateMultipartUpload| S3[(\"Amazon S3\")]\n    S3 -->|3. Return UploadId| API\n    API -->|4. Return UploadId + Part Size 10MB| Client\n    Client -->|5. Parallel Upload Part 1, 2, 3...| S3\n    S3 -->|6. Return ETag per Part| Client\n    Client -->|7. CompleteMultipartUpload with ETags| API\n    API -->|8. Finalize| S3\n      </div>\n\n      <h2>Resilience & Parallelism</h2>\n      <ul>\n        <li><strong>Parallel Uploads:</strong> Clients upload multiple 10MB parts simultaneously across parallel TCP streams, saturating available bandwidth.</li>\n        <li><strong>Resumable Retries:</strong> If part 42 fails, only part 42 is retried. Successfully uploaded parts remain in object storage (and are billed until the upload is completed or aborted; parts must be at least 5 MiB except the last, with at most 10,000 parts).</li>\n      </ul>\n    \n<!-- enriched -->\n<h2>Worked example: a 4 GB upload over a flaky connection</h2><ul><li>File size 4 GiB = 4,096 MiB. With 10 MiB parts that is 410 parts, well under the 10,000 limit. A rule of thumb: part size = max(8 MiB, ceil(file size / 10,000)).</li><li>At 20 Mbit/s total uplink, the upload takes about 28 minutes. With 4 parallel streams, each part takes about 16 seconds.</li><li>If each part has a 1 percent chance of failing, we expect about 4 part retries, costing about a minute, instead of restarting a 28 minute upload.</li><li>If the app is killed at part 300, the client stores (UploadId, part size, completed part numbers and ETags) locally; on restart it calls ListParts to confirm what the server has and uploads only the remaining 110 parts.</li></ul><h2>Signed multipart flow</h2><ol><li>Client asks the API to start an upload. The API calls CreateMultipartUpload with a server-chosen key and returns the UploadId.</li><li>The client requests presigned UploadPart URLs in batches (each URL is bound to the UploadId and a part number and expires, for example, after an hour).</li><li>The client PUTs parts in parallel and records each ETag; optionally it sends a checksum per part (S3 supports CRC32, CRC32C, SHA-1 and SHA-256 checksums) so corruption is caught per part.</li><li>The client sends the ordered part list to the API, which calls CompleteMultipartUpload; S3 assembles the object atomically.</li><li>An object-created event triggers validation and transcoding.</li></ol><h2>Options compared</h2><table><thead><tr><th>Protocol</th><th>Resume</th><th>Parallelism</th><th>Notes</th></tr></thead><tbody><tr><td>Single presigned PUT</td><td>No; restart from byte 0</td><td>No</td><td>Simple; S3 caps single PUTs at 5 GB</td></tr><tr><td>S3 multipart with presigned parts</td><td>Per part</td><td>Yes</td><td>Part limits: 5 MiB to 5 GiB, max 10,000 parts</td></tr><tr><td>GCS resumable upload</td><td>From last committed byte offset</td><td>Sequential per session (use composite objects for parallel)</td><td>One session URI per upload</td></tr><tr><td>tus open protocol</td><td>From offset, server-agnostic</td><td>Via concatenation extension</td><td>Good when you run your own upload servers</td></tr></tbody></table><h2>Failure modes</h2><ul><li>Presigned part URLs expiring mid-upload: request fresh URLs for remaining parts rather than restarting.</li><li>Completing with a wrong or missing ETag fails the completion; keep the part list authoritative on the client and verify with ListParts.</li><li>Duplicate completion calls are harmless if the API treats the upload record as idempotent by UploadId.</li></ul>\n</div>",
    "keyTakeaways": [
      "Use Multipart Upload for all files exceeding 100MB to enable parallel streaming and chunk-level retries.",
      "Track part numbers and ETags on the client; assemble parts upon completion.",
      "Set an S3 Lifecycle rule to automatically abort incomplete multipart uploads after 7 days to eliminate orphaned storage costs."
    ],
    "furtherReading": [
      {
        "title": "AWS S3 Multipart Upload Documentation",
        "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html"
      },
      {
        "title": "Google Cloud Storage: Resumable Uploads",
        "url": "https://cloud.google.com/storage/docs/resumable-uploads"
      }
    ]
  },
  "video-transcoding-pipeline": {
    "title": "Video transcoding pipeline",
    "video": {
      "youtubeId": "x9Hrn0oNmJM",
      "title": "How NETFLIX onboards new content: Video Processing at scale 🎥",
      "channel": "Gaurav Sen",
      "why": "A clear, focused explanation of the split, parallel-encode, and assemble pipeline with multiple resolutions and codecs, exactly this unit's architecture.",
      "length": "10:44"
    },
    "videos": [
      {
        "youtubeId": "Ftv82k1hlP8",
        "title": "Netflix - Microservices for Multimedia: Video Encoding. Nov 2021",
        "channel": "Media Processing Infrastructure",
        "role": "case-study",
        "why": "Netflix engineers describe their actual encoding service decomposition, which grounds the simplified pipeline in production reality.",
        "length": "12:41"
      },
      {
        "youtubeId": "wcdaIQjtWQI",
        "title": "How I Built Video Transcoding Service From Scratch | System Design",
        "channel": "Piyush Garg",
        "role": "deep-dive",
        "why": "Builds a working queue-driven FFmpeg transcoding service, making the moving parts tangible.",
        "length": "16:17"
      }
    ],
    "intuition": "<p>Translating a long book into six languages: one translator working alone takes months. Split the book at chapter boundaries, give each chapter to a different translator for each language, and bind each language's chapters back together in order. Video transcoding splits at keyframes instead of chapters, and each rendition is one \"language\".</p><p><strong>Mental model:</strong> a transcoding pipeline is a DAG of idempotent tasks keyed by (video, rendition, segment): validate, split at keyframes, encode in parallel, package into HLS or DASH, publish only when every required piece exists.</p><ul><li><strong>Misaligned keyframes across renditions.</strong> ABR players switch at segment boundaries, so every rendition must use the same fixed GOP and segment boundaries.</li><li><strong>Non-idempotent tasks.</strong> Workers crash and tasks are retried; outputs must be written to deterministic keys so a retry overwrites instead of duplicating.</li><li><strong>Trusting the input.</strong> Uploads can be corrupt, huge, variable frame rate or malicious; probe and validate first, and cap resource use per job.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Transcoding at Scale (Netflix & YouTube Pattern)</h2>\n      <p>Most consumer camera uploads are already compressed, while professional workflows may supply higher-bitrate mezzanine masters. The video transcoding pipeline validates and decodes those varied inputs, then produces multiple resolutions (1080p, 720p, 480p, 360p), bitrates, and codecs (H.264, H.265/HEVC, AV1, VP9) for playback across TVs, laptops, and mobile devices.</p>\n\n      <h2>Distributed Pipeline Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Raw[\"Raw Master in S3\"] --> Splitter[\"Video Splitter Worker\"]\n    Splitter --> Chunks[\"Split into keyframe-aligned segments of a few 2-second GOPs\"]\n    Chunks --> Queue[\"Kafka / SQS Transcode Tasks\"]\n    Queue --> W1[\"Worker: 1080p Chunk 1\"]\n    Queue --> W2[\"Worker: 720p Chunk 1\"]\n    Queue --> W3[\"Worker: 480p Chunk 1\"]\n    W1 & W2 & W3 --> Merger[\"Video Stitcher & Manifest Generator\"]\n    Merger --> HLS[\"HLS / DASH Manifest + TS/M4S Chunks\"]\n    HLS --> CDN[(\"CDN Delivery\")]\n      </div>\n\n      <h2>Split-and-Stitch Parallelism</h2>\n      <p>Rather than encoding a 2-hour movie linearly on a single machine (taking hours), modern pipelines split the video at Keyframe (I-frame) boundaries into 5-to-10-second segments. Hundreds of ephemeral worker instances transcode segments concurrently in parallel. Every rendition must use the same keyframe and segment boundaries so players can switch cleanly. The completed segments are stitched together with an index manifest file (<code>.m3u8</code> for HLS or <code>.mpd</code> for DASH).</p>\n    \n<!-- enriched -->\n<h2>Worked example: one hour of 1080p</h2><p>Assumptions: a 60 minute 1080p30 upload, a 5-rung H.264 ladder, and each worker encoding one rendition at about 0.5x real time (2 seconds of work per second of video).</p><ul><li><strong>Serial:</strong> 5 renditions x 60 minutes x 2 = 10 hours of encoding.</li><li><strong>Chunked:</strong> split into 6 second segments at keyframes: 600 segments x 5 renditions = 3,000 tasks, each about 12 seconds of work. With 300 workers the wall-clock time is about 2 minutes plus queueing, probing and packaging.</li><li><strong>Cost is unchanged</strong> (still about 10 CPU-hours); parallelism buys latency, not efficiency. Per-title or per-shot encoding reduces cost and bitrate for simple content.</li></ul><h2>Example bitrate ladder</h2><table><thead><tr><th>Rendition</th><th>Resolution</th><th>Video bitrate (H.264)</th></tr></thead><tbody><tr><td>1080p</td><td>1920 x 1080</td><td>about 5 Mbit/s</td></tr><tr><td>720p</td><td>1280 x 720</td><td>about 3 Mbit/s</td></tr><tr><td>480p</td><td>854 x 480</td><td>about 1.2 Mbit/s</td></tr><tr><td>360p</td><td>640 x 360</td><td>about 0.7 Mbit/s</td></tr><tr><td>240p</td><td>426 x 240</td><td>about 0.4 Mbit/s</td></tr></tbody></table><h2>Codec trade-offs</h2><table><thead><tr><th>Codec</th><th>Compression versus H.264</th><th>Encode cost</th><th>Playback support</th></tr></thead><tbody><tr><td>H.264 / AVC</td><td>Baseline</td><td>Low</td><td>Universal</td></tr><tr><td>H.265 / HEVC</td><td>Roughly 25 to 50 percent smaller</td><td>Higher</td><td>Apple devices and many TVs; licensing complexity</td></tr><tr><td>VP9</td><td>Similar to HEVC</td><td>Higher</td><td>Chrome, Android, many TVs</td></tr><tr><td>AV1</td><td>Roughly 30 percent smaller than VP9</td><td>Much higher</td><td>Growing hardware decode support</td></tr></tbody></table><p>Platforms commonly encode H.264 for everyone and add AV1 or HEVC only for popular titles, where bandwidth savings repay the encode cost.</p><h2>Pipeline and failure handling</h2><div class=\"mermaid\">flowchart LR\n    U[\"Upload complete event\"] --> PR[\"Probe and validate\"]\n    PR --> SP[\"Split at keyframes\"]\n    SP --> Q[\"Task queue keyed by video, rendition, segment\"]\n    Q --> W[\"Encode workers\"]\n    W --> CK[\"Completion tracker\"]\n    CK --> PK[\"Package HLS and DASH manifests\"]\n    PK --> PUB[\"Mark video playable\"]\n</div><ul><li>Poison inputs: after N failed attempts, move the task to a dead-letter queue and mark the video failed with a reason, instead of retrying forever.</li><li>Audio is encoded once per language and bitrate, separately from video, and muxed or referenced in manifests.</li><li>YouTube has reported receiving over 500 hours of video per minute, which is why these pipelines are built as elastic, queue-driven worker fleets.</li></ul>\n</div>",
    "keyTakeaways": [
      "Split videos into short keyframe-aligned segments (each made of one or more closed GOPs) to transcode massively in parallel across worker pools.",
      "Encode into multiple bitrates and resolutions to support Adaptive Bitrate Streaming (ABR).",
      "Store output segments in object storage fronted by an Anycast CDN."
    ],
    "furtherReading": [
      {
        "title": "Netflix Tech Blog: Per-Title Encode Optimization",
        "url": "https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2"
      },
      {
        "title": "YouTube: An Inside Look at VP9 Encoding",
        "url": "https://developers.google.com/web/fundamentals/media/video"
      }
    ]
  },
  "adaptive-bitrate-and-cdn-decider": {
    "title": "Adaptive bitrate and the CDN decider",
    "video": {
      "youtubeId": "6JTV4PwisoQ",
      "title": "HLS Adaptive Bitrate Streaming - System Design",
      "channel": "Piyush Garg",
      "why": "A thorough system-design walkthrough of HLS master and media playlists, renditions and how the player switches bitrates.",
      "length": "36:09"
    },
    "videos": [
      {
        "youtubeId": "OlrIurM8b50",
        "title": "Poor Video Streaming Performance Explained (and Fixed)",
        "channel": "Association for Computing Machinery (ACM)",
        "role": "deep-dive",
        "why": "Research talk on buffer-based rate adaptation (the Netflix BBA work), explaining why throughput-only ABR causes needless rebuffering.",
        "length": "55:36"
      },
      {
        "youtubeId": "pb4PsAkBdH8",
        "title": "Netflix Open Connect: Starting from a Greenfield",
        "channel": "NANOG",
        "role": "case-study",
        "why": "Netflix explains how it built and steers traffic across its own CDN, the 'CDN decider' half of this unit.",
        "length": "34:58"
      }
    ],
    "intuition": "<p>Adaptive bitrate is cruise control that watches the traffic: when the road clears you speed up (higher quality), when traffic thickens you slow down before you crash into a stall. The CDN decider is the navigation app choosing which highway (CDN or server) to take in the first place, based on live reports of which roads are fast right now.</p><p><strong>Mental model:</strong> the player picks the next segment's rendition from its throughput estimate and buffer level; a steering service picks which CDN hosts serve the session and can re-route mid-stream.</p><ul><li><strong>Switching only on \"download took longer than playback\".</strong> By then the buffer is already draining; good players switch based on predicted throughput with a safety margin and on buffer level.</li><li><strong>Oscillating quality.</strong> Jumping between 1080p and 480p every segment is worse for viewers than a steady 720p; add hysteresis.</li><li><strong>Static CDN choice.</strong> Picking a CDN once at startup ignores mid-session congestion; return an ordered list and let the player fail over.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Adaptive Bitrate (ABR) Protocols: HLS & DASH</h2>\n      <p>Adaptive Bitrate streaming dynamically adjusts video quality in real time based on the viewer's current network bandwidth and device capabilities. If a viewer walks into an elevator, the stream drops from 1080p to 480p, usually before the buffer runs dry, so playback continues at lower quality instead of stalling.</p>\n\n      <h2>Manifest and Segment Hierarchy</h2>\n      <p>The video player first downloads a <strong>Master Playlist</strong> containing a list of available quality stream variants and their respective bandwidths:</p>\n      <pre><code>#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080\n1080p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720\n720p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p/index.m3u8</code></pre>\n      <p>The player continuously measures download speeds for each 6-second segment. It keeps a smoothed throughput estimate, watches buffer level, and picks a lower rendition (with a safety margin) before downloads fall behind playback; waiting until a download takes longer than the segment duration means the buffer is already draining.</p>\n    \n<!-- enriched -->\n<h2>Worked example: a throughput-based decision</h2><p>Ladder: 4.5, 2.2 and 0.8 Mbit/s; segments are 6 seconds.</p><ul><li>The player's smoothed throughput estimate is 3.0 Mbit/s. With a 0.8 safety factor it may choose up to 2.4 Mbit/s, so it picks 720p (2.2 Mbit/s).</li><li>A 720p segment is 2.2 x 6 = 13.2 Mbit. At 3.0 Mbit/s it downloads in 4.4 seconds, so the buffer grows by 1.6 seconds per segment.</li><li>The network drops to 1.0 Mbit/s. The same segment now takes 13.2 seconds while only 6 seconds of video are added: the buffer shrinks 7.2 seconds per segment. With a 20 second buffer, the player has about 2 segments before stalling, so it must drop to 0.8 Mbit/s promptly (a 480p segment at 1.0 Mbit/s takes 4.8 seconds, and the buffer grows again).</li></ul><h2>Buffer-based adaptation</h2><p>The buffer-based approach (Huang et al., SIGCOMM 2014, with Netflix) chooses rate mainly from buffer occupancy: below a reservoir of, say, 10 seconds always pick the lowest rung; above 30 seconds pick the highest; in between map linearly. It uses throughput mainly at startup, and it reduced rebuffering in Netflix's experiments while keeping similar average quality.</p><table><thead><tr><th>Algorithm family</th><th>Signal</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>Throughput-based</td><td>Recent segment download speeds</td><td>Fast startup, simple</td><td>Noisy estimates cause oscillation and stalls</td></tr><tr><td>Buffer-based (BBA, BOLA)</td><td>Buffer level</td><td>Fewer rebuffers, stable</td><td>Slow to ramp up at startup</td></tr><tr><td>Hybrid or model predictive</td><td>Both, plus a short-horizon prediction</td><td>Best quality versus stall trade-off</td><td>More complex to tune</td></tr></tbody></table><h2>The CDN decider</h2><div class=\"mermaid\">sequenceDiagram\n    participant P as \"Player\"\n    participant S as \"Steering service\"\n    participant A as \"CDN A\"\n    participant B as \"CDN B\"\n    P->>S: \"start session, region, ISP, device\"\n    S-->>P: \"ordered CDNs A then B, playback URLs\"\n    P->>A: \"GET segments\"\n    A-->>P: \"errors or slow throughput\"\n    P->>B: \"fail over, GET next segment\"\n    P->>S: \"QoE beacons, rebuffers, throughput\"\n</div><ul><li>Inputs: per ISP and region quality data (throughput, rebuffer ratio, error rate), CDN health, capacity and cost commitments.</li><li>Standards: HLS content steering (EXT-X-CONTENT-STEERING) and DASH-IF content steering let a server update the preferred CDN order during playback.</li><li>Netflix's steering service chooses Open Connect appliances, often inside the viewer's ISP, and returns ranked URLs so the client can fall back if one server fails.</li></ul>\n</div>",
    "keyTakeaways": [
      "HLS and DASH slice video streams into small, standalone HTTP chunks (typically 2–6 seconds).",
      "The client video player, not the server, dynamically chooses which quality segment to fetch based on buffer health.",
      "HTTP-based chunk streaming enables standard CDN web caches to cache video chunks without specialized streaming servers."
    ],
    "furtherReading": [
      {
        "title": "Apple HLS Authoring Specification",
        "url": "https://developer.apple.com/streaming/"
      },
      {
        "title": "DASH-IF: DASH Adaptive Streaming Specification",
        "url": "https://dashif.org/docs/DASH-IF-IOP-v4.3.pdf"
      }
    ]
  },
  "signed-urls-drm-and-video-security": {
    "title": "Signed URLs, DRM, and video security",
    "video": {
      "youtubeId": "zLK_ipDz6Mk",
      "title": "DRM explained - How Netflix prevents you from downloading videos?",
      "channel": "Mehul Mohan",
      "why": "The clearest end-to-end explanation of how DRM actually works for streaming: encrypted segments, license servers, CDMs and hardware security levels.",
      "length": "18:17"
    },
    "videos": [
      {
        "youtubeId": "OgoW_z8WQU8",
        "title": "Thasso Griebel - Digital Rights Management: The Good, The Bad, and The Ugly",
        "channel": "Demuxed",
        "role": "deep-dive",
        "why": "A video-industry talk on CENC, multi-DRM packaging and the operational realities of Widevine, FairPlay and PlayReady.",
        "length": "36:32"
      },
      {
        "youtubeId": "Bbp6peXp0WU",
        "title": "How Signed URLs & Cookies Protect Your Cloud Data",
        "channel": "Hayk Simonyan",
        "role": "intro",
        "why": "Short explanation of signed URLs versus signed cookies, the first security layer in this unit.",
        "length": "3:51"
      }
    ],
    "intuition": "<p>A concert has layers. A wristband (signed URL or cookie) gets you through the gate for tonight only. The valuable thing is inside a locked case (encrypted segments), and the key is handed only to a sealed, trusted guard (the device's content decryption module) who unlocks the case in a back room and never gives you the key itself.</p><p><strong>Mental model:</strong> signed URLs control <em>who can fetch bytes</em>; encryption plus DRM licenses control <em>who can decrypt them</em>, under what rules (expiry, resolution, output protection) and on which devices.</p><ul><li><strong>Calling AES-128 HLS \"DRM\".</strong> If any authorized client can fetch the key over HTTPS, a determined user can too; DRM keeps keys inside a CDM, ideally in hardware.</li><li><strong>Signing every segment URL individually.</strong> A two hour movie has over a thousand segments; use signed cookies or a signed path prefix for segments.</li><li><strong>Believing DRM stops piracy.</strong> It raises extraction cost; camera capture and compromised devices still exist, so watermarking and takedown matter too.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Securing Premium Video Content</h2>\n      <p>Streaming services like Netflix, Disney+, and HBO must prevent unauthorized stream hotlinking, credential sharing, and content piracy. Video security employs three layered tiers: Signed URLs/Cookies at the CDN edge, Token Authentication, and Hardware Digital Rights Management (DRM).</p>\n\n      <h2>Security Layers</h2>\n      <ul>\n        <li><strong>Signed CDN URLs & Cookies:</strong> Generates time-limited signed URLs or cookies validated by the CDN edge (CloudFront uses RSA or ECDSA key-pair signatures; other CDNs, such as Akamai token auth, use HMAC tokens). Prevents unauthorized users from embedding video chunks on external websites.</li>\n        <li><strong>AES-128 Chunk Encryption:</strong> Video segments are encrypted with AES-128. Players fetch a decryption key from an authorized key server over HTTPS. This is clear-key encryption: every authorized client receives the key, so it is not DRM.</li>\n        <li><strong>Hardware-backed DRM (Widevine, FairPlay, PlayReady):</strong> Supported device security levels can keep keys and parts of the decode path in protected hardware and can require output protection. Capability varies by device, and DRM raises extraction cost rather than preventing screen recording or external capture.</li>\n      </ul>\n      <p>The license service is a runtime dependency: if it is unavailable, an authorized viewer may have encrypted segments but no usable key. Define license expiry, offline playback, key rotation, revocation, retry behavior, and what quality may degrade on devices without the required hardware security level.</p>\n    \n<!-- enriched -->\n<h2>Worked example: layering protection for a movie</h2><ol><li><strong>Entitlement:</strong> the user presses play; the playback API checks subscription, region and concurrent-stream limits (for example 2 streams), then issues a short-lived playback token.</li><li><strong>Manifest and segments:</strong> the API returns a manifest URL plus a signed cookie scoped to /title/123/* that expires in 4 hours. The CDN validates the signature on every request without calling your servers.</li><li><strong>Encryption:</strong> segments were packaged once with Common Encryption (CENC); using the cbcs scheme with CMAF lets one set of files serve FairPlay, Widevine and PlayReady.</li><li><strong>License:</strong> the player's CDM reads the key ID from the stream, generates a license request, and the app forwards it with the playback token to the license server, which returns keys wrapped for that CDM with rules: expiry in 48 hours for a rental, HD only on hardware-backed security levels, HDCP required for external displays.</li><li><strong>Playback:</strong> decryption happens inside the CDM. On Android, Widevine L1 does it in a trusted execution environment; L3 is software-only, and services commonly cap L3 devices to standard definition.</li></ol><h2>Layers compared</h2><table><thead><tr><th>Layer</th><th>Stops</th><th>Does not stop</th><th>Cost</th></tr></thead><tbody><tr><td>Signed URLs or cookies</td><td>Hotlinking, casual sharing of links after expiry</td><td>Anyone with a valid cookie downloading segments</td><td>Low; validated at the edge</td></tr><tr><td>HLS AES-128 clear-key</td><td>Passive interception, CDN-level copying</td><td>An authorized client extracting the key</td><td>Low</td></tr><tr><td>DRM with software CDM</td><td>Most casual ripping</td><td>Skilled attackers; screen capture</td><td>Licensing, license servers, packaging</td></tr><tr><td>DRM with hardware security and HDCP</td><td>Most digital extraction of HD and 4K</td><td>Camera capture of the screen</td><td>Device fragmentation, support load</td></tr><tr><td>Forensic watermarking</td><td>Nothing directly; identifies the leaking account</td><td>Leaks themselves</td><td>Per-session variant delivery</td></tr></tbody></table><h2>Failure modes</h2><ul><li><strong>License server outage:</strong> new playbacks fail even though the CDN is healthy. Run it multi-region, cache entitlement decisions, and allow persistent licenses for downloaded content.</li><li><strong>Live key rotation:</strong> rotate keys periodically for live streams and signal new key IDs ahead of use, so players can request licenses before the switch.</li><li><strong>Clock skew:</strong> devices with wrong clocks reject valid expiry windows; allow a small grace period.</li></ul>\n</div>",
    "keyTakeaways": [
      "Use CDN signed cookies to authorize entire multi-file HLS streaming sessions efficiently.",
      "Hardware-backed DRM protects keys and decode paths on supported devices but cannot eliminate screen recording or the analog hole.",
      "Tie signed playback tokens to user IP ranges and short expiration windows."
    ],
    "furtherReading": [
      {
        "title": "Google Widevine DRM Architecture",
        "url": "https://developers.google.com/widevine"
      },
      {
        "title": "Apple Developer: FairPlay Streaming",
        "url": "https://developer.apple.com/streaming/fps/"
      }
    ]
  },
  "live-streaming-webrtc-and-latency": {
    "title": "Live streaming, WebRTC, and latency",
    "video": {
      "youtubeId": "7AMRfNKwuYo",
      "title": "How Does Live Streaming Platform Work? (YouTube live, Twitch, TikTok Live)",
      "channel": "ByteByteGo",
      "why": "Kept: a concise, accurate map of the live pipeline (ingest, transcode, package, CDN) and where each second of latency comes from.",
      "length": "5:25"
    },
    "videos": [
      {
        "youtubeId": "FExZvpVvYxA",
        "title": "WebRTC Crash Course",
        "channel": "Hussein Nasser",
        "role": "deep-dive",
        "why": "Explains ICE, STUN, TURN, SDP and peer connections in depth, the ultra-low-latency end of the spectrum.",
        "length": "1:10:06"
      },
      {
        "youtubeId": "qXJ3S3T3xJY",
        "title": "Live streaming at world-record scale with Ashutosh Agrawal (ex-Jio / Disney+ Hotstar)",
        "channel": "The Pragmatic Engineer",
        "role": "case-study",
        "why": "An architect behind record-breaking concurrent live cricket streams explains the capacity and latency trade-offs at tens of millions of viewers.",
        "length": "1:02:13"
      }
    ],
    "intuition": "<p>A phone call and a TV broadcast of the same conversation. The phone call is instant but only works for a few people at once. The broadcast reaches millions, but it runs several seconds to half a minute behind because it is recorded into chunks, copied to relay towers and buffered at every TV. Live streaming is choosing where on that line your product sits.</p><p><strong>Mental model:</strong> latency is the sum of capture, encode, packaging (segment length), distribution and player buffer; HTTP streaming buys massive cacheable scale with seconds of delay, WebRTC buys sub-second delay with per-viewer server state.</p><ul><li><strong>Using WebRTC for a million passive viewers.</strong> Each viewer is a stateful media session; for large audiences, low-latency HLS or DASH through CDNs is usually cheaper and more robust.</li><li><strong>Blaming only the segment length.</strong> Player buffers often hold three segments, so 6 second segments mean 18 seconds or more before encoding and distribution are even counted.</li><li><strong>Building a mesh for group calls.</strong> Each participant uploads to every other participant; beyond about four people an SFU is needed.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Latency Spectrum in Video Delivery</h2>\n      <p>Different streaming use cases require drastically different latencies:</p>\n      <ul>\n        <li><strong>Standard Live (HLS/DASH):</strong> 15–30 seconds latency. High CDN cacheability, ideal for sports broadcasts.</li>\n        <li><strong>Low-Latency HLS (LL-HLS) / CMAF:</strong> 2–4 seconds latency. Good for interactive sports and Twitch-style gaming.</li>\n        <li><strong>Ultra-Low Latency (WebRTC):</strong> &lt; 500 milliseconds. Required for video conferences (Zoom, Google Meet) and interactive bidding.</li>\n      </ul>\n\n      <h2>WebRTC vs. HTTP Streaming</h2>\n      <p>WebRTC commonly carries SRTP media over UDP selected through ICE, but it can fall back through TURN over TCP or TLS when networks block UDP. Receivers use jitter buffers, and implementations may request selected retransmissions with NACK while congestion control trades quality against delay; no transport guarantees conversation latency. A peer-to-peer mesh is practical only for small calls. An SFU is an alternative topology that receives each participant's stream and forwards selected layers, while very large passive audiences often use HTTP-based low-latency streaming.</p>\n    \n<!-- enriched -->\n<h2>Worked example: three latency budgets</h2><ul><li><strong>Classic HLS:</strong> encoder and packaging about 2 s, one full 6 s segment must finish before it is published, the CDN adds about 1 s, and the player buffers 3 segments (18 s). Total roughly 20 to 30 s.</li><li><strong>Low-Latency HLS:</strong> segments are split into partial segments of about 200 to 500 ms; the player uses blocking playlist reloads and preload hints to request parts as soon as they exist, and keeps a buffer of a few parts. Total roughly 2 to 5 s.</li><li><strong>WebRTC:</strong> capture about 30 ms, encode about 20 ms, network 50 to 150 ms, jitter buffer 50 to 100 ms, decode and render about 20 ms. Total roughly 200 to 350 ms, with no segment waiting at all.</li></ul><h2>Group call topology</h2><p>In a 10-person mesh, each participant sends 9 copies of a 1.5 Mbit/s stream: 13.5 Mbit/s of upload, which most home connections cannot sustain. With an SFU, each participant uploads once (or 3 simulcast layers, for example 1.5, 0.5 and 0.15 Mbit/s) and the SFU forwards the right layer to each receiver based on their bandwidth and window size. An MCU mixes streams into one, saving client bandwidth at a high server CPU cost.</p><h2>Protocol comparison</h2><table><thead><tr><th>Protocol</th><th>Typical latency</th><th>Audience scale</th><th>CDN cacheable</th><th>Typical use</th></tr></thead><tbody><tr><td>HLS or DASH</td><td>10 to 30 s</td><td>Tens of millions</td><td>Yes</td><td>Sports and events broadcast</td></tr><tr><td>LL-HLS or low-latency DASH (CMAF chunks)</td><td>2 to 5 s</td><td>Millions</td><td>Yes, with CDN support for blocking requests</td><td>Interactive streams, Twitch-style</td></tr><tr><td>WebRTC via SFU</td><td>under 0.5 s</td><td>Thousands per SFU cluster, more with cascading</td><td>No</td><td>Calls, auctions, betting, co-streaming</td></tr><tr><td>RTMP, SRT or WHIP ingest</td><td>Contributes 0.1 to 2 s</td><td>One publisher</td><td>Not applicable</td><td>Getting video from the streamer to the platform</td></tr></tbody></table><h2>How real systems do it</h2><ul><li>Disney+ Hotstar served tens of millions of concurrent cricket viewers over HTTP streaming through multiple CDNs, pre-scaling capacity ahead of matches.</li><li>Amazon IVS offers low-latency HLS for large audiences and separate WebRTC-based real-time stages for interactive guests, reflecting the same split.</li><li>WHIP and WHEP are IETF work that standardize WebRTC ingest and playback signalling over HTTP, making WebRTC easier to plug into streaming pipelines.</li></ul>\n</div>",
    "keyTakeaways": [
      "Understand the trade-off: HTTP chunk streaming offers high CDN cacheability but higher latency (2–15s); WebRTC offers sub-500ms latency but requires complex SFU server infrastructure.",
      "Prefer UDP media for real-time interaction while supporting ICE/TURN fallbacks and bounded retransmission, jitter, and congestion-control behavior.",
      "For large interactive broadcasts, use WebRTC for the active broadcaster and Low-Latency HLS (LL-HLS) for millions of passive viewers."
    ],
    "furtherReading": [
      {
        "title": "W3C: WebRTC: Real-Time Communication in Browsers",
        "url": "https://www.w3.org/TR/webrtc/"
      },
      {
        "title": "IETF: Real-Time Media over QUIC",
        "url": "https://datatracker.ietf.org/doc/draft-ietf-moq-transport/"
      }
    ]
  },
  "remote-file-sync-design": {
    "title": "Remote file sync design",
    "video": {
      "youtubeId": "_UZ1ngy-kOI",
      "title": "Design Dropbox or Google Drive w/ a Ex-Meta Staff Engineer System Design Interview",
      "channel": "Hello Interview",
      "why": "The strongest dedicated walkthrough of this exact design: chunking, fingerprints, metadata versus block storage, presigned uploads, sync notifications and conflicts.",
      "length": "58:08"
    },
    "videos": [
      {
        "youtubeId": "4Y5EYvQcMqI",
        "title": "Design Dropbox/Google Drive: System Design Interview (Stripe & Amazon Offers)",
        "channel": "TechPrep",
        "role": "interview",
        "why": "A shorter interview-style pass through the same design, useful as a quick review.",
        "length": "13:29"
      },
      {
        "youtubeId": "THxjtJQwBNU",
        "title": "Magic Pocket: Dropbox’s Exabyte-Scale Blob Storage System",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "Dropbox engineers explain the content-addressed block store behind file sync at exabyte scale.",
        "length": "49:08"
      }
    ],
    "intuition": "<p>Imagine every book in a library stored as numbered pages plus a table of contents listing which pages make up the book. To sync an edited book you send only the changed pages and a new table of contents. Another reader's copy notices the new table of contents, fetches only the pages it lacks, and reassembles the book.</p><p><strong>Mental model:</strong> file sync is a per-namespace journal of metadata commits (path, version, ordered block hashes) plus a content-addressed block store; clients upload missing blocks, commit metadata against a base version, and follow the journal with a cursor.</p><ul><li><strong>Uploading whole files on every change.</strong> Block hashing makes a small edit cost one or two blocks, not hundreds of megabytes.</li><li><strong>Last writer wins silently.</strong> Two offline edits to the same file must not overwrite each other; commit with a base version and create a conflicted copy on mismatch.</li><li><strong>Polling the server for changes.</strong> Clients should long-poll or hold a push channel, then fetch changes since their cursor.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Dropbox / Google Drive System Design</h2>\n      <p>A cloud file synchronization service must synchronize files across multiple devices with minimal bandwidth usage, handle network drops gracefully, and resolve concurrent file modifications without data loss.</p>\n\n      <h2>Client-Server Sync Architecture</h2>\n      <div class=\"mermaid\">\nflowchart TD\n    Client[\"Local Client Daemon\"] --> Watcher[\"File Watcher: inotify / FSEvents\"]\n    Watcher --> ChunkEngine[\"Chunking Engine: 4MB Chunks\"]\n    ChunkEngine --> LocalDB[(\"SQLite Local Metadata Cache\")]\n    ChunkEngine --> SyncService[\"Cloud Sync Gateway API\"]\n    SyncService --> MetaDB[(\"Metadata Store\")]\n    SyncService --> BlockStore[(\"Content-Addressed Chunk Store: S3\")]\n    SyncService --> Notifier[\"Notification Service: Long Polling / WebSockets\"]\n    Notifier --> OtherClients[\"Other Synchronized Devices\"]\n      </div>\n\n      <h2>Delta Sync & Content Addressing</h2>\n      <p>When a 500MB video or presentation changes by a few paragraphs, uploading the entire 500MB file is unacceptably slow. The client splits files into 4MB chunks and hashes each chunk with SHA-256. When a file is modified, the client re-chunks it, compares hashes with its local SQLite database, and only uploads the specific 4MB chunks that were added or changed. This works well for in-place edits and appends; an insertion near the start shifts every later fixed-size block boundary (the boundary-shift problem in the next unit).</p>\n    \n<!-- enriched -->\n<h2>Worked example: editing a 500 MB file</h2><ol><li>The file is 500 MB, so with 4 MiB blocks it has about 120 blocks, each identified by its SHA-256.</li><li>The user edits a slide in place; after re-chunking, 2 blocks have new hashes.</li><li>The client asks the server which of the 120 hashes it lacks; the server answers with the 2 new ones. The client uploads 8 MB (under 2 percent of the file).</li><li>The client commits: path /deck.pptx, base version 17, new blocklist. The server checks that the current version is still 17, writes version 18 to the namespace journal, and notifies watchers.</li><li>A laptop long-polling on the namespace wakes up, lists changes since its cursor, sees version 18, downloads the 2 blocks it lacks, and rebuilds the file locally.</li></ol><h2>Conflict handling</h2><table><thead><tr><th>Strategy</th><th>Behaviour</th><th>Pros</th><th>Cons</th></tr></thead><tbody><tr><td>Last writer wins</td><td>Newest commit replaces the file</td><td>Simple</td><td>Silent data loss</td></tr><tr><td>Conflicted copy</td><td>Second writer's version saved as a separate file</td><td>No data loss, easy to understand</td><td>User must merge manually</td></tr><tr><td>Lock or check-out</td><td>Only one editor at a time</td><td>No conflicts</td><td>Breaks offline editing</td></tr><tr><td>Operational merge (OT or CRDT)</td><td>Edits merged automatically</td><td>Best experience for documents</td><td>Only for structured formats, not arbitrary binaries</td></tr></tbody></table><h2>Sync protocol</h2><div class=\"mermaid\">sequenceDiagram\n    participant C as \"Client A\"\n    participant M as \"Metadata service\"\n    participant B as \"Block store\"\n    participant D as \"Client B\"\n    C->>M: \"which of these hashes are missing\"\n    M-->>C: \"hashes 57 and 58\"\n    C->>B: \"upload blocks 57 and 58\"\n    C->>M: \"commit path, base v17, blocklist\"\n    M-->>C: \"ok, v18\"\n    M-->>D: \"long poll returns, changes available\"\n    D->>M: \"list changes since cursor\"\n    D->>B: \"download missing blocks\"\n</div><h2>How real systems do it</h2><ul><li>Dropbox splits files into 4 MB blocks hashed with SHA-256, stores blocks in its Magic Pocket system, and exposes a cursor-based list-changes API with a long-poll endpoint for notifications. On conflicting edits it creates a conflicted copy rather than overwriting.</li><li>Dropbox rewrote its desktop sync engine (Nucleus) in Rust around 2020, with a strong emphasis on testing the sync state machine for correctness.</li></ul>\n</div>",
    "keyTakeaways": [
      "Split files into chunks (e.g., 4MB) to enable delta synchronization: upload only modified blocks.",
      "Content hashes enable deduplication, but cross-user deduplication needs authorization, ownership-reference accounting, deletion semantics, and protection against existence-oracle attacks.",
      "Use a local embedded SQLite database on client devices to track block manifests and sync state offline."
    ],
    "furtherReading": [
      {
        "title": "Rsync Algorithm & Delta Encoding",
        "url": "https://rsync.samba.org/tech_report/"
      },
      {
        "title": "Dropbox Tech: Streaming File Synchronization",
        "url": "https://dropbox.tech/infrastructure/streaming-file-synchronization"
      }
    ]
  },
  "fixed-block-chunking-and-content-addressing": {
    "title": "Fixed-block chunking and content addressing",
    "video": {
      "youtubeId": "_UZ1ngy-kOI",
      "title": "Design Dropbox or Google Drive w/ a Ex-Meta Staff Engineer System Design Interview",
      "channel": "Hello Interview",
      "why": "No strong dedicated chunking video exists; this design walkthrough gives the clearest system-design treatment of splitting files into chunks, fingerprinting them and deduplicating by hash.",
      "length": "58:08"
    },
    "videos": [
      {
        "youtubeId": "lG90LZotrpo",
        "title": "Git Internals by John Britton of GitHub - CS50 Tech Talk",
        "channel": "CS50",
        "role": "deep-dive",
        "why": "The best explanation of content-addressable storage in practice: Git objects are named by the hash of their contents, so identical content is stored once.",
        "length": "57:39"
      }
    ],
    "intuition": "<p>Cutting a long ribbon into pieces every 10 cm is simple, but if someone inserts one extra centimetre near the start, every later cut lands in a different place and no piece matches the old ones. Cutting at every red dot printed on the ribbon instead means an insertion only changes the piece around it; all other pieces still start and end at the same dots.</p><p><strong>Mental model:</strong> fixed-size chunking is fast but fragile under insertions; content-defined chunking picks boundaries from the data itself with a rolling hash, so boundaries resynchronize after an edit. Either way, each chunk is stored under the hash of its bytes.</p><ul><li><strong>Assuming fixed blocks deduplicate edited files well.</strong> They do for in-place edits and appends, not for insertions near the start.</li><li><strong>Using a weak hash as the address.</strong> The address must be collision-resistant (SHA-256); weak rolling hashes are only for finding boundaries.</li><li><strong>Global dedup without thinking about privacy.</strong> Cross-user dedup can reveal whether someone else already has a file; many systems dedup only within a user or encrypt per user.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Fixed-Block Chunking vs. Variable-Block (Rabin Fingerprinting)</h2>\n      <p>File deduplication systems break files into smaller blocks. In <strong>Fixed-Block Chunking</strong>, the file is sliced every N bytes (e.g., exactly 4MB). While fast and simple, if an edit inserts a single byte at the beginning of the file, every subsequent block boundary shifts, destroying deduplication across the entire file (the boundary shift problem).</p>\n\n      <h2>Content-Addressable Storage (CAS)</h2>\n      <p>In CAS, the storage address of a block is literally the cryptographic hash of its contents: <code>Address = SHA256(BlockBytes)</code>. If two users upload identical files (or identical chunks of different files), the system computes the exact same hash and stores the chunk only once on disk, achieving massive deduplication savings.</p>\n    \n<!-- enriched -->\n<h2>Worked example: inserting one byte</h2><ul><li>A 100 MB file with 4 MB fixed blocks has 25 blocks. Insert one byte at offset 0: every block now starts one byte later, all 25 hashes change, and the client re-uploads 100 MB.</li><li>With content-defined chunking, the client slides a 48-byte window over the data computing a rolling hash, and declares a boundary wherever the low 20 bits of the hash are zero. That happens on average every 2^20 bytes, so chunks average about 1 MiB (with a minimum of 256 KiB and maximum of 4 MiB to bound the extremes). After the insertion, only the first chunk changes; the next boundary is found at the same content as before, and the remaining roughly 99 chunks keep their hashes. The client uploads about 1 MB.</li></ul><h2>Content addressing</h2><p>The chunk's address is SHA-256 of its bytes, for example <code>blocks/ab/cd/abcd...</code>. Writing is idempotent (the same bytes always produce the same address), so retries are safe and two users uploading the same chunk store it once. Reads can verify integrity by re-hashing.</p><h2>Fixed versus content-defined</h2><table><thead><tr><th>Aspect</th><th>Fixed-size blocks</th><th>Content-defined chunks</th></tr></thead><tbody><tr><td>CPU cost</td><td>Hash only</td><td>Rolling hash over every byte plus hash</td></tr><tr><td>Insertions and deletions</td><td>Shift all later boundaries</td><td>Change only nearby chunks</td></tr><tr><td>In-place edits and appends</td><td>Excellent</td><td>Excellent</td></tr><tr><td>Chunk size</td><td>Exactly N</td><td>Variable around a target average</td></tr><tr><td>Random access by offset</td><td>Simple arithmetic</td><td>Needs an offset index</td></tr><tr><td>Used by</td><td>Dropbox (4 MB blocks), many block stores</td><td>LBFS, restic, Borg, many backup systems</td></tr></tbody></table><h2>Related techniques</h2><ul><li><strong>rsync</strong> uses a weak rolling checksum to find matching fixed-size blocks at any offset, plus a strong hash to confirm matches, so it also handles insertions without content-defined boundaries.</li><li><strong>FastCDC</strong> and Gear-based hashing make content-defined chunking several times faster than classic Rabin fingerprinting.</li><li><strong>Security:</strong> in 2011 researchers showed that Dropbox's client-side dedup let anyone who knew a file's hashes obtain the file, which is why hash-only uploads must still prove possession of the bytes.</li></ul>\n</div>",
    "keyTakeaways": [
      "Content-Addressable Storage (CAS) uses cryptographic hashes as storage pointers to achieve automatic data deduplication.",
      "Fixed-block chunking is vulnerable to boundary shift problems from byte insertions.",
      "Variable-block chunking (Rabin fingerprints / FastCDC) detects natural content boundaries to resist shift issues."
    ],
    "furtherReading": [
      {
        "title": "Content Addressable Storage Overview",
        "url": "https://en.wikipedia.org/wiki/Content-addressable_storage"
      },
      {
        "title": "Xia et al.: FastCDC: A Fast and Efficient Content-Defined Chunking Approach for Data Deduplication (USENIX ATC 2016)",
        "url": "https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia"
      }
    ]
  },
  "blocklist-versioned-file-metadata": {
    "title": "Blocklist versioned file metadata",
    "video": {
      "youtubeId": "lG90LZotrpo",
      "title": "Git Internals by John Britton of GitHub - CS50 Tech Talk",
      "channel": "CS50",
      "why": "Git's commits pointing at trees of content-addressed blobs are the clearest real-world model of versioned blocklists: new versions are new metadata pointing at mostly unchanged immutable content.",
      "length": "57:39"
    },
    "videos": [
      {
        "youtubeId": "_UZ1ngy-kOI",
        "title": "Design Dropbox or Google Drive w/ a Ex-Meta Staff Engineer System Design Interview",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows the file metadata table with ordered chunk lists and version handling inside a full file-sync design.",
        "length": "58:08"
      },
      {
        "youtubeId": "THxjtJQwBNU",
        "title": "Magic Pocket: Dropbox’s Exabyte-Scale Blob Storage System",
        "channel": "InfoQ",
        "role": "case-study",
        "why": "Explains the immutable, hash-addressed block storage that blocklists point into, including how deletes and garbage collection are handled.",
        "length": "49:08"
      }
    ],
    "intuition": "<p>A music playlist does not contain the songs; it is an ordered list of song IDs. Making \"Road Trip v2\" by swapping one song creates a new list, while every other song file stays exactly where it was. Rolling back is just making a new playlist that copies the old list. A blocklist is a playlist of block hashes for one version of one file.</p><p><strong>Mental model:</strong> file versions are small immutable metadata records (ordered block hashes plus size and name) pointing into a shared, immutable, content-addressed block store; history is cheap, and deletion becomes garbage collection.</p><ul><li><strong>Deleting blocks when a file is deleted.</strong> Other versions, files or users may reference the same block; only unreferenced blocks past a grace period can be collected.</li><li><strong>Racing garbage collection against uploads.</strong> A block uploaded but not yet committed looks unreferenced; keep a grace window before deletion.</li><li><strong>Huge flat blocklists.</strong> A 1 TB file has about 262,000 blocks of 4 MiB; store the list in pages or as a tree so small edits do not rewrite 8 MB of metadata.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Representing Versioned Files as Blocklists</h2>\n      <p>To support file versioning, rollbacks, and instant directory renames, file metadata is decoupled completely from block storage. A file version is represented as an ordered array of block hashes (a <strong>blocklist</strong>):</p>\n      <pre><code>{\n  \"file_id\": \"file_892a\",\n  \"version\": 4,\n  \"filename\": \"quarterly_presentation.pdf\",\n  \"size_bytes\": 12582912,\n  \"blocks\": [\n    \"a6a1ba3260d4e89526367c09f91a0340479cd37f825ae50e408e193938961171\",\n    \"d6c4595e5d20b8e7c292595a9626003ed570083784e8269dacd4244f7741429b\",\n    \"74fb01a5b7440512c0a3ba69af293251bccdf9636a373f2d7e949e1ca512c611\"\n  ]\n}</code></pre>\n\n      <h2>Instant Rollbacks & Version History</h2>\n      <p>Because this design gives blocks immutable content-addressed names, rolling back a file to version 1 does not copy or move its payload. The metadata service records a new commit pointing to the earlier blocklist; that still performs metadata I/O and must retain every referenced block until no live version needs it.</p>\n    \n<!-- enriched -->\n<h2>Worked example: three versions and a rollback</h2><table><thead><tr><th>Version</th><th>Blocklist</th><th>New blocks stored</th></tr></thead><tbody><tr><td>v1</td><td>A, B, C</td><td>A, B, C</td></tr><tr><td>v2 (edit in the middle)</td><td>A, B2, C</td><td>B2</td></tr><tr><td>v3 (append)</td><td>A, B2, C, D</td><td>D</td></tr><tr><td>v4 (rollback to v1)</td><td>A, B, C</td><td>none</td></tr></tbody></table><p>Storing four versions naively costs 13 blocks; with blocklists it costs 5 unique blocks (A, B, B2, C, D). Rollback writes one metadata record. Block B had to survive while v2 and v3 were current, because v1 still referenced it; that is the retention cost the content mentions.</p><h2>Metadata size</h2><p>Each SHA-256 hash is 32 bytes. A 12 MiB file with 4 MiB blocks has a 96-byte blocklist. A 1 TB file has about 262,144 blocks, an 8 MB blocklist. Systems therefore chunk the blocklist itself (hash of a page of hashes), forming a Merkle tree so a small edit rewrites only one page and the root.</p><h2>Garbage collection options</h2><table><thead><tr><th>Approach</th><th>How it works</th><th>Risk</th></tr></thead><tbody><tr><td>Reference counting</td><td>Increment on commit, decrement when a version expires</td><td>Count drift from failed or duplicate updates; needs periodic audit</td></tr><tr><td>Mark and sweep</td><td>Periodically mark all blocks reachable from retained versions, delete the rest</td><td>Expensive scan; must exclude recently uploaded blocks</td></tr><tr><td>Generational with grace period</td><td>Only sweep blocks older than, say, 7 days and unreferenced</td><td>Storage held longer, but uncommitted uploads are safe</td></tr></tbody></table><h2>How real systems do it</h2><ul><li><strong>Git</strong> commits point to trees, trees point to blobs, and everything is named by hash; git gc prunes unreachable objects only after a grace period.</li><li><strong>Dropbox</strong> represents file versions as blocklists of 4 MB SHA-256 blocks and keeps version history for a plan-dependent window (for example 30 or 180 days), after which unreferenced blocks can be reclaimed.</li><li><strong>restic</strong> snapshots reference trees of content-defined chunks, and its prune command removes data no snapshot references.</li><li><strong>ZFS and btrfs</strong> apply the same copy-on-write idea at the filesystem level, making snapshots nearly free.</li></ul>\n</div>",
    "keyTakeaways": [
      "Represent files as ordered manifests of block hashes (blocklists).",
      "Because blocks are immutable, version history and rollbacks only update lightweight metadata records.",
      "Use relational or document databases to query and traverse file metadata hierarchies rapidly."
    ],
    "furtherReading": [
      {
        "title": "Git Internals: The Object Model",
        "url": "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects"
      },
      {
        "title": "Google Dapper: A Large-Scale Distributed Tracing Infrastructure",
        "url": "https://research.google/pubs/pub36356/"
      }
    ]
  }
};
