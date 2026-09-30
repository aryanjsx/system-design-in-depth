window.MODULE_CONTENT = window.MODULE_CONTENT || {};
window.MODULE_CONTENT["learning-geo-matching"] = {
  "nearby-geospatial-search-system-design": {
    "title": "Nearby geospatial search",
    "video": {
      "youtubeId": "M4lR_Va97cQ",
      "title": "FAANG System Design Interview: Design A Location Based Service (Yelp, Google Places)",
      "channel": "ByteByteGo",
      "why": "The canonical proximity-service walkthrough: naive scan, geohash, quadtree and S2 compared, then the full read-heavy architecture with caching and replicas.",
      "length": "24:41"
    },
    "videos": [
      {
        "youtubeId": "dQXdSxn7d1g",
        "title": "Proximity Search & Geospatial Indexes Explained",
        "channel": "Hello Interview",
        "role": "deep-dive",
        "why": "A tight explainer of why B-trees fail on two dimensions and how geohash, quadtrees and R-trees generate candidates.",
        "length": "17:07"
      },
      {
        "youtubeId": "yz1jtze4qr8",
        "title": "System Design Mock Interview: Design Yelp w/ Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows how the proximity query fits into a full interview answer with filters, ranking and trade-offs.",
        "length": "38:10"
      }
    ],
    "intuition": "<p>If you want pizza, you do not measure the distance to every pizzeria in the country. You look at your neighbourhood and the ones touching it, collect the handful of places there, and only then check exactly how far each one is. Spatial indexes are the neighbourhood map; exact distance is the final check.</p><p><strong>Mental model:</strong> nearby search is two phases: a cheap spatial index returns a bounded candidate set that covers the search circle, then an exact filter (distance, open now, freshness, permissions) and ranking produce the answer.</p><ul><li><strong>Treating the index as the answer.</strong> Cells and bounding boxes over-cover the circle; skipping the exact distance check returns results outside the radius.</li><li><strong>One cell size for every density.</strong> A 5 km cell is perfect in rural Montana and returns 100,000 candidates in Manhattan; choose precision by radius and density, or use adaptive structures like quadtrees.</li><li><strong>Ignoring freshness for moving objects.</strong> A driver who last reported 5 minutes ago is geometrically close but not actually available.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Understanding Nearby Geospatial Search</h2>\n      <p>Geospatial search is a core component of many modern applications, from ride-sharing services like Uber to review platforms like Yelp. At its core, the problem is about finding points of interest (POIs) that are physically close to a user's current location within a given radius.</p>\n      \n      <h3>The Naive Approach</h3>\n      <p>A naive approach might involve storing the latitude and longitude of every POI in a relational database and calculating the distance between the user and every POI on the fly. You could use the Haversine formula for this:</p>\n      <pre><code>SELECT * FROM places WHERE haversine(lat, lon, user_lat, user_lon) &lt; radius;</code></pre>\n      <p>However, this requires a full table scan, computing a complex trigonometric function for millions of rows. It is highly inefficient and will not scale.</p>\n      \n      <h3>Spatial Indexing</h3>\n      <p>To optimize this, we need spatial indexing. The fundamental idea of spatial indexing is to map two-dimensional coordinates (latitude and longitude) into one-dimensional strings or numbers, which can then be efficiently indexed by standard databases (using B-Trees, for example). Common strategies include:</p>\n      <ul>\n        <li><strong>Geohash:</strong> Divides the world into a grid of rectangles, assigning a string to each.</li>\n        <li><strong>Quadtree:</strong> Recursively subdivides space into four quadrants based on POI density.</li>\n        <li><strong>Google S2 / Uber H3:</strong> Uses spherical projections to map the Earth into cells.</li>\n      </ul>\n      \n      <h3>Database Support</h3>\n      <p>Many modern databases support spatial queries out of the box using extensions:</p>\n      <ul>\n        <li><strong>PostGIS:</strong> An extension for PostgreSQL that adds support for geographic objects.</li>\n        <li><strong>Redis GEO:</strong> Built-in commands like GEOSEARCH for ultra-fast, in-memory proximity queries based on Geohash.</li>\n        <li><strong>Elasticsearch:</strong> Provides geo-point and geo-shape data types for powerful search capabilities.</li>\n      </ul>\n\n      <h3>Trade-offs in Geospatial Design</h3>\n      <p><strong>Concrete query:</strong> for couriers within 3 km, first use a spatial index to fetch a bounded candidate set whose cells or bounding boxes cover the circle, then exact-filter by geodesic distance, availability, tenant/permission, and a location freshness cutoff before sorting by ETA. A courier last updated five minutes ago is not made eligible by being geometrically close. Cap candidates and state whether an incomplete shard returns a partial result or an error.</p>\n      <p>Static POIs tolerate slower writes and aggressive caching. Moving couriers need frequent index updates and stale-member removal, but an in-memory index adds rebuild and failover work. Geographic partitioning reduces the working set while creating boundary queries, hot-city imbalance, and handoff work when an object crosses regions.</p>\n      \n      <div class=\"mermaid\">\n      flowchart TD\n          User[\"User App\"] --> API[\"API Gateway\"]\n          API --> SearchService[\"Search Service\"]\n          SearchService --> Cache[\"Redis GEO Cache\"]\n          SearchService --> DB[(\"PostGIS Database\")]\n      </div>\n    \n<!-- enriched -->\n<h2>Worked example: sizing a covering</h2><p>A user in San Francisco (latitude about 37.8) searches a 2 km radius. Geohash cells are fixed in degrees, so their width in kilometres shrinks with the cosine of latitude.</p><ul><li><strong>Precision 5</strong> (0.0439 degrees of longitude by 0.0439 of latitude): about 3.9 km wide by 4.9 km tall here. The 4 km wide circle fits inside the center cell plus its 8 neighbours: 9 cells covering about 171 square km, while the circle is only 12.6 square km, so roughly 7 percent of candidates are real hits.</li><li><strong>Precision 6</strong> (about 0.98 km by 0.61 km here): the circle needs about 6 x 8 = 48 cells covering about 29 square km, so about 44 percent are hits, at the price of 48 key lookups.</li><li>At a density of 500 places per square km, precision 5 returns about 85,000 candidates and precision 6 about 14,000, of which about 6,300 are inside 2 km. Rank by relevance and distance and return the top 20. For very dense areas, cap candidates or shrink the radius.</li></ul><h2>Technology choices</h2><table><thead><tr><th>Option</th><th>Best for</th><th>Strength</th><th>Weakness</th></tr></thead><tbody><tr><td>PostGIS with a GiST index</td><td>Static POIs with rich filters and joins</td><td>Exact geography types, SQL, polygons</td><td>Write-heavy moving objects; single-node scaling limits</td></tr><tr><td>Elasticsearch or OpenSearch geo_point</td><td>Search combined with text and facets</td><td>Distance filters plus relevance scoring</td><td>Refresh lag; operational weight</td></tr><tr><td>Redis GEO</td><td>Hot, frequently updated positions</td><td>In-memory, simple commands</td><td>One key per shard; no per-member expiry</td></tr><tr><td>In-memory quadtree or grid service</td><td>Custom, very high QPS</td><td>Adapts to density, full control</td><td>You own rebuilds, replication and failover</td></tr><tr><td>H3 or S2 cell IDs in any key-value store</td><td>Global scale, sharding by cell</td><td>Uniform cell hierarchy, easy partitioning</td><td>Still needs exact filtering and coverings</td></tr></tbody></table><h2>Scaling the read path</h2><ul><li>POI data changes rarely, so a proximity service is read-heavy: keep the index in memory on stateless replicas and rebuild or update from a change stream.</li><li>Cache results per (cell, filter) for popular areas; business details are cached separately by ID.</li><li>Partition by region only if the dataset outgrows one machine; 200 million POIs at about 50 bytes of index entry each is about 10 GB, which still fits in memory on one large node.</li></ul><h2>How real systems do it</h2><ul><li>Yelp has written about using Elasticsearch for location-aware search.</li><li>Uber open-sourced H3 and indexes marketplace data by hexagonal cell.</li><li>Tinder described geosharding its recommendation index by S2 cells so each query touches only a few shards.</li></ul>\n</div>",
    "keyTakeaways": [
      "Naive distance calculations do not scale.",
      "Spatial indexing converts 2D coordinates into 1D keys.",
      "PostGIS and Redis are excellent choices for geospatial workloads."
    ],
    "furtherReading": [
      {
        "title": "Tinder Engineering: Geosharded Recommendations Part 1: Sharding Approach",
        "url": "https://medium.com/tinder/geosharded-recommendations-part-1-sharding-approach-d5d54e0ec77a"
      },
      {
        "title": "Rigaux, Scholl & Voisard: Spatial Databases: With Application to GIS (Morgan Kaufmann, 2002), Ch. 1",
        "url": "https://doi.org/10.1016/B978-155860588-6/50003-8"
      },
      {
        "title": "PostGIS in Action (Obe, Hsu)",
        "url": "https://www.manning.com/books/postgis-in-action-third-edition"
      }
    ]
  },
  "geohash-prefix-spatial-index": {
    "title": "Geohash prefix spatial index",
    "video": {
      "youtubeId": "UaMzra18TD8",
      "title": "Geohash: Deep Intuitive Understanding in under 7 Minutes",
      "channel": "Jim O'Flaherty",
      "why": "An underrated gem: the clearest visual explanation of bit interleaving, base32 and why shared prefixes mean shared cells, in under seven minutes.",
      "length": "6:56"
    },
    "videos": [
      {
        "youtubeId": "vGKs-c1nQYU",
        "title": "Geohash: the algorithm inside and out - Part 1",
        "channel": "Josiah Parry",
        "role": "deep-dive",
        "why": "Implements the encoding step by step, which makes the precision and neighbour edge cases concrete.",
        "length": "15:37"
      },
      {
        "youtubeId": "dQXdSxn7d1g",
        "title": "Proximity Search & Geospatial Indexes Explained",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows how geohash prefixes are used in an interview answer and where they break down compared with quadtrees.",
        "length": "17:07"
      }
    ],
    "intuition": "<p>A geohash is like a postal code that gets more specific with every character: \"9\" is a huge chunk of the western United States, \"9q\" is California and Nevada, \"9q8yy\" is a few blocks of San Francisco. Two places that share a long prefix are in the same small box. But two houses on opposite sides of a box's border can have completely different codes, even if they are ten metres apart.</p><p><strong>Mental model:</strong> geohash turns 2D space into a 1D string along a Z-order curve, so a prefix scan in any ordered index returns one rectangular cell; nearby search means scanning a covering set of cells and then filtering exactly.</p><ul><li><strong>\"Same prefix means close; different prefix means far\".</strong> Both directions are wrong near cell borders, and the worst cases are the equator and prime meridian where even the first character changes.</li><li><strong>Assuming nine cells always suffice.</strong> Center plus eight neighbours only works if the radius is smaller than the cell size.</li><li><strong>Forgetting cells shrink east-west away from the equator.</strong> Sizes in tables are at the equator; at 60 degrees latitude a cell is half as wide.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Deep Dive into Geohashes</h2>\n      <p>Geohash is a public domain geocode system that encodes a geographic location into a short string of letters and digits. It works by recursively subdividing the Earth's surface into a grid.</p>\n      \n      <h3>How Geohash Works</h3>\n      <p>The algorithm interleaves bits derived from the latitude and longitude. The first step is to divide the Earth into two halves. If the point is in the right half, it gets a 1; if left, a 0. This process is repeated recursively, alternating between longitude and latitude, until the desired precision is reached. Finally, the binary string is converted to a base32 string.</p>\n      \n      <h3>Prefix Matching for Proximity</h3>\n      <p>A geohash prefix identifies one rectangular cell. Two points with a sufficiently long shared prefix occupy that cell, but they may still be far apart within it; nearby points on opposite sides of a cell boundary may share little prefix. Prefix lookup is candidate generation, not proof that a point lies within the requested radius.</p>\n      <pre><code>SELECT * FROM places WHERE geohash LIKE '9q8y%';</code></pre>\n      \n      <h3>The Edge Case Problem</h3>\n      <p>A robust query chooses a cell precision from the requested radius and latitude, computes a covering that fully contains the search shape, fetches candidates from every covered cell, deduplicates them, and applies an exact distance check. The center cell plus eight neighbors is sufficient only for particular radius/cell-size combinations; larger radii require more cells, and dateline or polar cases need explicit longitude-wrapping and geometry handling.</p>\n      \n      <h3>Choosing the Right Precision</h3>\n      <p>The length of the Geohash string determines its precision (sizes below are at the equator; the east-west width shrinks with the cosine of latitude):</p>\n      <ul>\n        <li>4 characters: ~39 km x 19.5 km</li>\n        <li>5 characters: ~4.9 km x 4.9 km</li>\n        <li>6 characters: ~1.2 km x 0.6 km</li>\n      </ul>\n      <p>In a system design interview, selecting a precision of 5 or 6 characters is typically appropriate for a localized proximity search (like finding nearby restaurants).</p>\n      \n      <div class=\"mermaid\">\n      flowchart LR\n          LatLon(\"Latitude / Longitude\") --> Interleave(\"Interleave Bits\")\n          Interleave --> Base32(\"Base32 Encoding\")\n          Base32 --> GeohashString(\"Geohash String\")\n      </div>\n    \n<!-- enriched -->\n<h2>Worked example: encoding San Francisco</h2><p>Encode latitude 37.7749, longitude -122.4194. Bits alternate, starting with longitude; each bit halves the current range.</p><ol><li>Longitude in [-180, 180]: -122.4 is below the midpoint 0, bit 0, range becomes [-180, 0].</li><li>Latitude in [-90, 90]: 37.8 is at or above 0, bit 1, range [0, 90].</li><li>Longitude in [-180, 0]: below -90, bit 0, range [-180, -90].</li><li>Latitude in [0, 90]: below 45, bit 0, range [0, 45].</li><li>Longitude in [-180, -90]: at or above -135, bit 1, range [-135, -90].</li></ol><p>The first five bits 01001 equal 9, and base32 character 9 is \"9\". Continuing gives <code>9q8yyk8</code> at 7 characters, a cell about 150 m on a side. Each character adds 5 bits, alternating which axis gets the extra bit, so cells alternate between square-ish and 2:1 rectangles.</p><h2>Precision table (at the equator)</h2><table><thead><tr><th>Length</th><th>Cell width x height</th><th>Typical use</th></tr></thead><tbody><tr><td>4</td><td>39.1 km x 19.5 km</td><td>Metro region sharding</td></tr><tr><td>5</td><td>4.89 km x 4.89 km</td><td>City-scale search, radius a few km</td></tr><tr><td>6</td><td>1.22 km x 0.61 km</td><td>Neighbourhood search, radius under 1 km</td></tr><tr><td>7</td><td>153 m x 153 m</td><td>Walking distance, driver matching</td></tr><tr><td>8</td><td>38.2 m x 19.1 m</td><td>Building level</td></tr><tr><td>9</td><td>4.77 m x 4.77 m</td><td>Precise points; beyond GPS accuracy for many phones</td></tr></tbody></table><h2>Choosing a covering</h2><ul><li>Pick the longest precision whose cell size is at least the search radius in both dimensions at the query latitude; then center plus 8 neighbours is guaranteed to cover the circle.</li><li>For larger radii at a fixed precision, compute all cells intersecting the circle's bounding box; the count grows with the square of radius over cell size.</li><li>Near the antimeridian (longitude 180) neighbours wrap to the opposite sign; near the poles cells become very narrow, so use a spherical library rather than hand-rolled math.</li></ul><h2>How real systems use it</h2><ul><li>Redis GEO stores a 52-bit geohash integer as a sorted-set score and scans neighbouring ranges.</li><li>Elasticsearch supports geohash grid aggregations for map heat-maps, and many teams store a geohash column with a B-tree index in PostgreSQL or DynamoDB sort keys for simple prefix queries.</li></ul>\n</div>",
    "keyTakeaways": [
      "Geohash encodes 2D coordinates into a 1D string.",
      "Prefix matching enables fast proximity searches using B-Tree indexes.",
      "Choose a covering large enough for the requested shape, then exact-filter candidates; nine cells are not universally sufficient."
    ],
    "furtherReading": [
      {
        "title": "Understanding Geohash",
        "url": "https://en.wikipedia.org/wiki/Geohash"
      },
      {
        "title": "Antonin Guttman: R-trees: A Dynamic Index Structure for Spatial Searching (SIGMOD 1984)",
        "url": "https://dl.acm.org/doi/10.1145/971697.602266"
      }
    ]
  },
  "geospatial-grid-systems-h3-s2-geohash": {
    "title": "Grid systems: H3, S2, geohash",
    "video": {
      "youtubeId": "ay2uwtRO3QE",
      "title": "H3: Tiling the Earth with Hexagons",
      "channel": "Uber Engineering",
      "why": "The H3 authors explain why hexagons, how the icosahedron projection and hierarchy work, and how Uber uses them, contrasting with square grids like S2 and geohash.",
      "length": "25:39"
    },
    "videos": [
      {
        "youtubeId": "OcUKFIjhKu0",
        "title": "Designing a location database: QuadTrees and Hilbert Curves",
        "channel": "Gaurav Sen",
        "role": "deep-dive",
        "why": "Explains quadtrees and Hilbert curves, the ideas behind S2's cell ordering, in an accessible way.",
        "length": "22:22"
      },
      {
        "youtubeId": "UILoSqvIM2w",
        "title": "[Uber Open Summit 2018] Hierarchical Hexagons in Depth",
        "channel": "Uber Engineering",
        "role": "deep-dive",
        "why": "Goes deeper into H3's hierarchy, pentagons and the non-exact parent-child containment that trips people up.",
        "length": "16:02"
      }
    ],
    "intuition": "<p>Tiling a floor: rectangles (geohash) are easy to cut and number, but your diagonal neighbour is farther away than the one beside you. Hexagons (H3) are like a honeycomb: all six neighbours share an edge and sit at the same distance, which makes \"spread to nearby cells\" smooth. S2 wraps the globe in a cube and subdivides each face into squares, numbering them along a space-filling curve so nearby cells usually have nearby numbers.</p><p><strong>Mental model:</strong> all three map a point to a hierarchical cell ID; they differ in shape, distortion, exact nesting and how well IDs preserve locality for range scans.</p><ul><li><strong>Assuming H3 children nest exactly.</strong> Seven child hexagons only approximately cover their parent, so rolling up counts by parent is approximate at the edges; S2 and geohash nest exactly.</li><li><strong>Forgetting the pentagons.</strong> H3 has 12 pentagons at every resolution; neighbour code must handle cells with five neighbours.</li><li><strong>Thinking a grid removes the exact check.</strong> Cells are candidate generators; radius and polygon decisions still need exact geometry.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Comparing Geospatial Grid Systems</h2>\n      <p>When building large-scale spatial applications, choosing the right grid system is critical. Geohash, Google's S2, and Uber's H3 are the three most prominent grid systems, each with distinct characteristics and trade-offs.</p>\n      \n      <h3>Geohash (Rectangles)</h3>\n      <p>Geohash divides the world into rectangles. Its main advantage is simplicity and native support in many databases. However, because the Earth is spherical, the actual physical area of Geohash rectangles varies significantly depending on the latitude. A Geohash near the equator covers much more area than one near the poles, making radius calculations inconsistent.</p>\n      \n      <h3>Google S2 (Quadrilaterals)</h3>\n      <p>Google developed the S2 geometry library to solve the distortion problem. It maps the sphere to a cube and then recursively subdivides each face as a quadtree of quadrilateral cells, numbering those cells along a Hilbert curve so nearby cells usually get nearby IDs. S2 provides excellent precision and mathematical guarantees about cell sizes. It is widely used in systems like MongoDB and Foursquare.</p>\n      \n      <h3>Uber H3 (Hexagons)</h3>\n      <p>H3 indexes the sphere with mostly hexagonal cells plus required pentagons, across a hierarchy of resolutions. Neighbor traversal is convenient for aggregation and approximate coverings, but projection distortion means real-world cell areas and center distances are not identical everywhere. Radius and boundary decisions still require exact geometry or distance checks after candidate generation.</p>\n      \n      <h3>Summary of Trade-offs</h3>\n      <table border=\"1\">\n        <tr>\n          <th>System</th>\n          <th>Shape</th>\n          <th>Best Use Case</th>\n        </tr>\n        <tr>\n          <td>Geohash</td>\n          <td>Rectangle</td>\n          <td>Simple string-based indexing, fast prototyping</td>\n        </tr>\n        <tr>\n          <td>S2</td>\n          <td>Quadrilateral</td>\n          <td>General-purpose mapping, minimal distortion</td>\n        </tr>\n        <tr>\n          <td>H3</td>\n          <td>Hexagon</td>\n          <td>Ride-sharing, continuous neighbor traversal</td>\n        </tr>\n      </table>\n      \n    \n<!-- enriched -->\n<h2>Worked example: picking a resolution</h2><p>Surge pricing wants zones of roughly neighbourhood size.</p><ul><li><strong>H3</strong> resolution 7 hexagons average about 5.2 square km, resolution 8 about 0.74 square km, resolution 9 about 0.11 square km. Each step divides area by about 7 (aperture 7). Resolution 8 gives about 1,600 cells over a 1,200 square km city.</li><li><strong>S2</strong> has 31 levels (0 to 30). Level 13 cells average about 1.3 square km and each level divides area by exactly 4; a level 30 cell is under a square centimetre. Cell IDs are 64-bit integers ordered along a Hilbert curve, so a region covering is a small set of integer ranges.</li><li><strong>Geohash</strong> precision 6 gives 1.2 km by 0.6 km cells at the equator, but only about 0.6 km wide at 60 degrees latitude, so zone areas vary with latitude.</li></ul><h2>Comparison</h2><table><thead><tr><th>Property</th><th>Geohash</th><th>S2</th><th>H3</th></tr></thead><tbody><tr><td>Cell shape</td><td>Lat/lon rectangle</td><td>Spherical quadrilateral</td><td>Hexagon (plus 12 pentagons)</td></tr><tr><td>Hierarchy</td><td>Exact nesting, 32 children</td><td>Exact nesting, 4 children</td><td>Approximate nesting, 7 children</td></tr><tr><td>ID ordering</td><td>Z-order curve (base32 string or integer)</td><td>Hilbert curve (64-bit integer)</td><td>Hierarchical 64-bit index, not a locality-preserving range</td></tr><tr><td>Area distortion</td><td>Large, grows toward poles</td><td>Small (roughly 2x across the globe)</td><td>Small (roughly 2x across the globe)</td></tr><tr><td>Neighbours</td><td>8, at two distances</td><td>8 (edge plus vertex)</td><td>6, all at one distance</td></tr><tr><td>Best at</td><td>Simple prefix queries in any database</td><td>Region coverings and range scans</td><td>Aggregation, smoothing, movement between cells</td></tr><tr><td>Known users</td><td>Redis GEO, Elasticsearch grids</td><td>Google, MongoDB 2dsphere, Tinder geosharding</td><td>Uber marketplace and surge, many analytics tools</td></tr></tbody></table><h2>Common patterns</h2><ul><li><strong>Coverings:</strong> S2's RegionCoverer turns a circle or polygon into a bounded number of cells at mixed levels (for example max 8 cells), trading over-coverage for fewer lookups.</li><li><strong>k-rings:</strong> H3's gridDisk(cell, k) returns all cells within k steps, which approximates a radius and is ideal for \"demand near this driver\".</li><li><strong>Sharding:</strong> assign coarse cells (S2 level 5 or H3 resolution 2 or 3) to shards; hot cities may need to be split further.</li></ul>\n</div>",
    "keyTakeaways": [
      "Grid systems solve the 2D to 1D mapping problem.",
      "S2 maps the earth to a cube and uses a Hilbert curve.",
      "H3 provides hierarchical mostly-hexagonal cells for aggregation and neighborhood traversal; it includes pentagons and does not replace exact distance or routing."
    ],
    "furtherReading": [
      {
        "title": "H3 Documentation: Introduction",
        "url": "https://h3geo.org/docs/"
      },
      {
        "title": "S2 Geometry: S2 Cells (Developer Guide)",
        "url": "https://s2geometry.io/devguide/s2cell_hierarchy"
      },
      {
        "title": "A Tour of H3: Uber's Hexagonal Hierarchical Spatial Index (Uber Engineering)",
        "url": "https://www.uber.com/blog/h3/"
      }
    ]
  },
  "redis-geo-spatial-hot-path": {
    "title": "Redis GEO hot path",
    "video": {
      "youtubeId": "rAi1h7dltCk",
      "title": "How Redis powers Geospatial Queries using GeoHash Algorithm | Redis Internals",
      "channel": "Arpit Bhayani",
      "why": "Explains exactly how Redis GEO encodes 52-bit geohashes into sorted-set scores and turns radius queries into score-range scans, straight from the internals.",
      "length": "21:39"
    },
    "videos": [
      {
        "youtubeId": "qftiVQraxmI",
        "title": "Redis Geospatial Explained",
        "channel": "Redis",
        "role": "intro",
        "why": "Short official overview of the GEO commands and use cases before the internals deep-dive.",
        "length": "4:12"
      },
      {
        "youtubeId": "lsKU38RKQSo",
        "title": "Design Uber w/ a Ex-Meta Staff Engineer: System Design Interview breakdown",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Uses Redis GEO for driver locations in a full ride-hailing design, including update rates and TTL handling.",
        "length": "1:03:05"
      }
    ],
    "intuition": "<p>Imagine all drivers in a city standing in one long queue sorted by a single number that encodes their location, so people who are near each other on the map are usually near each other in the queue. Finding drivers near a point means jumping to a few spots in that queue and reading short stretches.</p><p><strong>Mental model:</strong> Redis GEO is a sorted set whose score is a 52-bit interleaved geohash; GEOSEARCH computes the few score ranges that cover the search area, reads them, and filters by exact distance.</p><ul><li><strong>Expecting per-member expiry.</strong> TTL applies to the whole key; stale drivers must be removed explicitly using a separate last-seen index.</li><li><strong>Putting the whole world in one key.</strong> A key lives on one shard, so one global GEO key is one hot node; shard by city or cell.</li><li><strong>Treating distances as exact.</strong> Redis models the Earth as a sphere, so distances can be off by up to about 0.5 percent, fine for \"nearby\" but not for billing.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Leveraging Redis for Fast Geospatial Queries</h2>\n      <p>When you need to track dynamic points of interest—such as moving vehicles in a ride-sharing app or real-time delivery tracking—traditional disk-based databases like PostGIS may struggle with the high write throughput. This is where Redis GEO commands shine.</p>\n      \n      <h3>How Redis GEO Works</h3>\n      <p>Under the hood, Redis GEO utilizes Sorted Sets (ZSET). When you add a geospatial point using <code>GEOADD</code>, Redis calculates a 52-bit Geohash for the latitude and longitude, and uses this Geohash as the score for the sorted set. This allows Redis to store and retrieve locations rapidly in memory.</p>\n      \n      <h3>Key Commands</h3>\n      <ul>\n        <li><code>GEOADD key longitude latitude member</code>: Adds a location to the index.</li>\n        <li><code>GEODIST key member1 member2 [unit]</code>: Calculates the distance between two members.</li>\n        <li><code>GEOSEARCH key [FROMLONLAT|FROMMEMBER] [BYRADIUS|BYBOX]</code>: The modern way to query for members within a specific radius or bounding box.</li>\n      </ul>\n      \n      <h3>Handling High Write Throughput</h3>\n      <p>In a system like Uber, millions of drivers send location updates every few seconds. To handle this:</p>\n      <ol>\n        <li><strong>Sharding:</strong> You cannot store all global locations in a single Redis node. Shard the Redis cluster geographically (e.g., one shard per city or country).</li>\n        <li><strong>Expiry:</strong> Redis key TTL applies to the whole GEO sorted set, not one member. Store per-driver freshness separately and remove stale members with a sweeper or atomic maintenance script; every query must reject candidates older than its freshness limit.</li>\n        <li><strong>Batching:</strong> Use Redis pipelines to batch <code>GEOADD</code> commands from the ingestion service to the Redis nodes.</li>\n      </ol>\n      \n      <p>Example of adding a driver and searching for nearby drivers:</p>\n      <pre><code>GEOADD drivers -122.4194 37.7749 \"driver123\"\nGEOSEARCH drivers FROMLONLAT -122.4194 37.7749 BYRADIUS 5 km WITHDIST</code></pre>\n      \n    \n<!-- enriched -->\n<h2>Worked example: one million active drivers</h2><ul><li>Each driver reports every 4 seconds: 250,000 GEOADD per second globally.</li><li>Shard by city: a big city with 50,000 active drivers produces 12,500 writes per second to its key, well within a single Redis primary when pipelined.</li><li>Memory: a sorted-set entry with a short member name costs roughly 60 to 100 bytes including the skiplist and hash overhead, so 1 million drivers is on the order of 100 MB. Memory is not the bottleneck; write rate and hot keys are.</li><li>Queries: a rider search is GEOSEARCH with a 3 km radius. Its cost is O(N + log M), where N is the number of members in the grid-aligned area scanned around the circle and M is the set size, so dense downtown queries cost more than suburban ones.</li></ul><h2>Freshness without per-member TTL</h2><p>Keep two keys per city: <code>drivers:geo:sf</code> (GEO) and <code>drivers:seen:sf</code> (sorted set scored by last update time). On each update: <code>GEOADD drivers:geo:sf -122.4194 37.7749 d123</code> and <code>ZADD drivers:seen:sf 1727700000 d123</code>. A sweeper every few seconds runs a Lua script that reads <code>ZRANGEBYSCORE drivers:seen:sf -inf now_minus_30</code> and removes those members from both keys atomically. Queries still check last-seen for each result, because a sweep can lag.</p><h2>Options for the hot location store</h2><table><thead><tr><th>Option</th><th>Write rate</th><th>Query</th><th>Weakness</th></tr></thead><tbody><tr><td>Redis GEO per city</td><td>Very high</td><td>GEOSEARCH radius or box</td><td>Manual staleness; hot cities need sub-sharding</td></tr><tr><td>Redis hashes keyed by H3 or S2 cell</td><td>Very high</td><td>Read the k-ring of cells, filter</td><td>More client logic; easy to shard by cell</td></tr><tr><td>PostGIS with GiST</td><td>Moderate; each update rewrites an index entry</td><td>Rich SQL and polygons</td><td>Index churn and vacuum under constant updates</td></tr><tr><td>Custom in-memory service</td><td>Highest</td><td>Anything</td><td>You build replication and failover</td></tr></tbody></table><h2>Operational notes</h2><ul><li>Redis GEO accepts latitudes only between about -85.05 and 85.05 degrees (the Web Mercator limit).</li><li>Replicas can serve reads to spread query load; accept that they lag slightly.</li><li>After a failover, positions refill within one reporting interval, so treat Redis as rebuildable soft state and keep the durable trip record elsewhere.</li></ul>\n</div>",
    "keyTakeaways": [
      "Redis GEO uses Geohashes stored in Sorted Sets.",
      "It is optimized for low-latency, high-throughput in-memory queries.",
      "Regional partitioning can limit working sets, but boundary queries, hot cities, failover, and cross-region movement need explicit routing and rebalancing."
    ],
    "furtherReading": [
      {
        "title": "Redis GEOSEARCH documentation",
        "url": "https://redis.io/commands/geosearch/"
      },
      {
        "title": "Redis Docs: Redis geospatial",
        "url": "https://redis.io/docs/latest/develop/data-types/geospatial/"
      }
    ]
  },
  "geofencing-point-in-polygon": {
    "title": "Geofencing: point in polygon",
    "video": {
      "youtubeId": "dQXdSxn7d1g",
      "title": "Proximity Search & Geospatial Indexes Explained",
      "channel": "Hello Interview",
      "why": "No strong dedicated geofencing video exists; this is the clearest explanation of the bounding-box and R-tree candidate filtering that makes geofencing scale, before the exact point-in-polygon test.",
      "length": "17:07"
    },
    "videos": [
      {
        "youtubeId": "XRq2_9YBziY",
        "title": "How Did PostGIS Get Fast(er)?",
        "channel": "Crunchy Data",
        "role": "deep-dive",
        "why": "A PostGIS maintainer explains the indexing and caching work that makes spatial predicates like point-in-polygon fast in practice.",
        "length": "29:01"
      },
      {
        "youtubeId": "RSXM9bgqxJM",
        "title": "Checking if a point is inside a polygon is RIDICULOUSLY simple (Ray casting algorithm) - Inside code",
        "channel": "Inside code",
        "role": "intro",
        "why": "Short visual explanation of the exact test that runs after candidate filtering.",
        "length": "6:07"
      }
    ],
    "intuition": "<p>Airport security has two stages: a quick glance at your boarding pass at the building entrance, then a precise check at the gate. Geofencing works the same way: a cheap bounding-box or cell lookup throws away almost every polygon, and only the few survivors get the precise point-in-polygon test.</p><p><strong>Mental model:</strong> geofencing is a stream join between moving points and a slowly changing set of polygons; index the polygons, test candidates exactly, and turn membership changes into enter and exit events with debouncing.</p><ul><li><strong>Emitting an event on every fix.</strong> GPS jitter near a boundary flips inside and outside every second; require hysteresis (a buffer distance) or several consecutive fixes.</li><li><strong>Forgetting state.</strong> \"Enter\" means \"inside now and not inside before\", so you must persist the last membership per device and polygon version.</li><li><strong>Ignoring polygon edits.</strong> When a zone changes, devices already inside or near it must be re-evaluated, or you will miss or duplicate events.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Geofencing and the Point-in-Polygon Problem</h2>\n      <p>Geofencing involves creating virtual boundaries (polygons) around real-world geographical areas. When a user or device enters, exits, or lingers within these boundaries, the system triggers an event. Applications range from targeted advertising and location-based reminders to fleet management and airport surge pricing zones.</p>\n      \n      <h3>The Core Algorithm</h3>\n      <p>At the mathematical heart of geofencing is the \"Point-in-Polygon\" (PIP) problem. Given a coordinate (a point) and a set of vertices (a polygon), how do we determine if the point is inside the polygon?</p>\n      \n      <h3>Optimizing Geofencing at Scale</h3>\n      <p>Evaluating the PIP algorithm for every user against every polygon is computationally impossible at scale. System design requires multi-stage filtering:</p>\n      \n      <ol>\n        <li><strong>Bounding Box Filtering:</strong> Every polygon has a minimum bounding box (MBR). PostGIS commonly uses a GiST spatial index with bounding-box operators to find candidate polygons before the exact predicate. This reduces the candidate polygons from millions to a handful.</li>\n        <li><strong>Exact PIP Calculation:</strong> Only for the polygons that pass the bounding box filter, the system runs an exact point-in-polygon test (for example ray casting, O(V) per polygon; libraries such as GEOS/PostGIS use prepared geometries with edge indexes for repeated tests) to confirm if the point is truly inside the precise polygon boundaries.</li>\n      </ol>\n      \n      <h3>System Architecture</h3>\n      <p>A stream processor can index versioned polygons and consume location updates, but point membership alone does not define an enter/exit event. Persist the last evaluated polygon version and membership per device. For example, GPS jitter around an airport boundary can alternate inside/outside every second; require hysteresis, consecutive observations, or a dwell interval before emitting a transition. Give transitions stable IDs so replay after a crash does not send duplicate notifications, and define how a polygon edit re-evaluates devices already nearby.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: delivery zones</h2><p>Assume 50,000 polygons (delivery zones and airport pickup areas) averaging 200 vertices, and 200,000 location updates per second.</p><ul><li><strong>Naive:</strong> 200,000 x 50,000 = 10 billion polygon tests per second. Impossible.</li><li><strong>R-tree on bounding boxes:</strong> each point overlaps on average about 1.5 polygon bounding boxes. That is 300,000 exact tests per second, each O(V) with 200 edges, about 60 million edge checks per second: a handful of CPU cores.</li><li><strong>H3 pre-classification:</strong> fill each polygon with H3 resolution 9 cells (about 0.1 square km). Cells fully inside the polygon are marked interior, cells crossing the border are marked boundary. A point in an interior cell is inside with no geometry work; only points in boundary cells (often under 10 percent) need the exact test.</li></ul><h2>Indexing strategies</h2><table><thead><tr><th>Strategy</th><th>Lookup</th><th>Update cost when a polygon changes</th><th>Notes</th></tr></thead><tbody><tr><td>Brute force within a city</td><td>Test every polygon in the city</td><td>None</td><td>Uber's early geofence service did this after first finding the city; fine for small counts</td></tr><tr><td>R-tree over bounding boxes (PostGIS GiST)</td><td>O(log n) plus exact tests</td><td>Reinsert one box</td><td>General purpose default</td></tr><tr><td>Cell map (H3 or S2) with interior and boundary cells</td><td>One hash lookup, exact test only on boundary cells</td><td>Recompute the polygon's cells</td><td>Fastest at very high point rates</td></tr><tr><td>Prepared geometry cache</td><td>Exact test in about O(log V) using an edge index</td><td>Rebuild per polygon version</td><td>Helps when polygons have thousands of vertices</td></tr></tbody></table><h2>Event pipeline</h2><div class=\"mermaid\">flowchart LR\n    L[\"Location updates\"] --> P[\"Partition by device id\"]\n    P --> C[\"Candidate polygons from index\"]\n    C --> X[\"Exact point in polygon test\"]\n    X --> S[\"Compare with stored membership per device\"]\n    S --> H[\"Hysteresis and dwell rules\"]\n    H --> E[\"Enter or exit event with stable id\"]\n</div><ul><li><strong>Hysteresis example:</strong> enter when the point is at least 20 m inside the boundary, exit only when at least 30 m outside, or require 3 consecutive fixes.</li><li><strong>Idempotency:</strong> event ID = hash(device, polygon, polygon_version, transition_sequence), so replay after a crash produces the same ID and consumers deduplicate.</li><li><strong>Partitioning by device</strong> keeps each device's membership state on one worker and preserves ordering of its fixes.</li></ul>\n</div>",
    "keyTakeaways": [
      "Geofencing triggers events based on location boundaries.",
      "Use a supported spatial index for bounding-box candidate filtering, then run the exact boundary-aware geometry predicate.",
      "Stream processing engines are ideal for evaluating continuous location updates against geofences."
    ],
    "furtherReading": [
      {
        "title": "PostGIS R-Tree Spatial Indexes",
        "url": "https://postgis.net/workshops/postgis-intro/indexing.html"
      },
      {
        "title": "de Berg, Cheong, van Kreveld & Overmars: Computational Geometry: Algorithms and Applications (3rd ed., Springer, 2008)",
        "url": "https://doi.org/10.1007/978-3-540-77974-2"
      }
    ]
  },
  "ray-casting-point-in-polygon": {
    "title": "Ray casting point in polygon",
    "video": {
      "youtubeId": "RSXM9bgqxJM",
      "title": "Checking if a point is inside a polygon is RIDICULOUSLY simple (Ray casting algorithm) - Inside code",
      "channel": "Inside code",
      "why": "Kept: a clear, dedicated visual explanation of the crossing-number test, including the edge-intersection condition that production code uses.",
      "length": "6:07"
    },
    "videos": [
      {
        "youtubeId": "TA8XQgiao4M",
        "title": "Gamedev Maths: Point in Polygon (General and Python Tutorial)",
        "channel": "Erudite",
        "role": "deep-dive",
        "why": "A second derivation that walks through the edge-crossing condition in code, reinforcing the half-open vertex rule.",
        "length": "6:22"
      }
    ],
    "intuition": "<p>You are standing somewhere in a field surrounded by a wiggly fence. Walk in a straight line toward the road and count how many times you climb over the fence. Odd means you started inside; even means you started outside. The shape of the fence does not matter, only the count.</p><p><strong>Mental model:</strong> for each polygon edge, ask \"does this edge straddle the point's horizontal line, and is the crossing to the right of the point?\" and flip an inside flag each time the answer is yes.</p><ul><li><strong>Double-counting vertices.</strong> A ray through a vertex touches two edges; use a half-open rule (count an edge only if exactly one endpoint is strictly above the ray) so each vertex counts once.</li><li><strong>Leaving boundary behaviour undefined.</strong> Decide whether \"on the edge\" is inside (covers) or not (contains) and test for it explicitly before the odd/even count.</li><li><strong>Using planar math on lat/lon for big or antimeridian-crossing polygons.</strong> A zone around Fiji crosses longitude 180; split it or use a spherical library.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>The Ray Casting Algorithm</h2>\n      <p>The ray casting algorithm is the most common mathematical solution to the Point-in-Polygon problem. It determines whether a point sits inside a complex, irregular polygon.</p>\n      \n      <h3>How It Works</h3>\n      <p>The logic is elegantly simple based on topology: draw a horizontal ray (a straight line) starting from the point in question and extending to infinity in one direction (usually to the right). Then, count how many times this ray intersects the edges of the polygon.</p>\n      <ul>\n        <li>If the number of intersections is <strong>ODD</strong>, the point is <strong>INSIDE</strong> the polygon.</li>\n        <li>If the number of intersections is <strong>EVEN</strong>, the point is <strong>OUTSIDE</strong> the polygon.</li>\n      </ul>\n      \n      <h3>Handling Edge Cases</h3>\n      <p>While conceptually simple, the implementation must handle tricky edge cases carefully:</p>\n      <ul>\n        <li><strong>Boundary policy:</strong> First decide whether a point on an edge or vertex counts as inside, corresponding to semantics such as <code>covers</code> versus strict <code>contains</code>. Detect that case explicitly before odd/even counting. A half-open endpoint rule then prevents a vertex from contributing twice.</li>\n        <li><strong>Horizontal edges:</strong> If the ray perfectly overlaps a horizontal edge of the polygon, it could cause issues. The vertex rules mentioned above usually resolve this naturally by ignoring horizontal edges entirely.</li>\n      </ul>\n      \n      <h3>Computational Complexity</h3>\n      <p>The basic test is O(N) in polygon edges. Production geometry also needs valid ring orientation, holes and multipolygons, a documented boundary rule, robust predicates near edges, and a coordinate model. Applying planar longitude/latitude arithmetic across the antimeridian or over large regions can be wrong; use an appropriate projected or spherical library. Spatial indexing narrows candidates but never replaces the exact predicate.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example</h2><p>Polygon: square with vertices (0,0), (4,0), (4,4), (0,4).</p><ul><li><strong>Point (2,2):</strong> cast a ray to +x. Edge (4,0) to (4,4) straddles y = 2 (one endpoint below, one above) and crosses at x = 4, which is right of 2: 1 crossing. The left edge crosses at x = 0, left of the point, so it does not count. Odd, so inside.</li><li><strong>Point (5,2):</strong> both vertical edges cross at x = 0 and x = 4, left of 5: 0 crossings, outside.</li><li><strong>Point (2,4):</strong> lies on the top edge. A boundary pre-check reports \"on boundary\", then the product rule decides.</li><li><strong>Ray through a vertex:</strong> triangle (0,0), (4,2), (0,4) and point (1,2). The ray y = 2 passes through vertex (4,2). Edge (0,0) to (4,2): is 0 &gt; 2 different from 2 &gt; 2? Both false, so it does not count. Edge (4,2) to (0,4): is 2 &gt; 2 different from 4 &gt; 2? Yes, it counts once. Result 1 crossing: inside, which is correct. Without the half-open rule both edges would count and the answer would be wrong.</li></ul><h2>The standard loop</h2><p><code>inside = false; for each edge (a, b): if ((a.y &gt; p.y) != (b.y &gt; p.y)) and (p.x &lt; a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y)) then inside = !inside</code></p><p>The first condition skips horizontal edges automatically (both endpoints on the same side) and implements the half-open vertex rule.</p><h2>Crossing number versus winding number</h2><table><thead><tr><th>Aspect</th><th>Crossing number (even-odd)</th><th>Winding number (non-zero)</th></tr></thead><tbody><tr><td>Idea</td><td>Parity of crossings</td><td>Net number of times the boundary wraps the point</td></tr><tr><td>Simple polygons</td><td>Same answer</td><td>Same answer</td></tr><tr><td>Self-intersecting shapes</td><td>Overlaps count as holes</td><td>Overlaps count as filled</td></tr><tr><td>Cost</td><td>O(V)</td><td>O(V), similar constant with the signed-crossing form</td></tr><tr><td>Used by</td><td>SVG and canvas even-odd fill rule</td><td>SVG and canvas nonzero fill rule (the default)</td></tr></tbody></table><h2>Production concerns</h2><ul><li><strong>Holes and multipolygons:</strong> inside the outer ring and not inside any hole; for multipolygons, inside any part.</li><li><strong>Repeated queries:</strong> index edges by y-interval (as GEOS prepared geometries do) so each test is roughly O(log V) instead of O(V).</li><li><strong>Floating point:</strong> points within about 1e-9 of an edge can flip; use robust orientation predicates or snap to a tolerance, and document the boundary policy.</li></ul>\n</div>",
    "keyTakeaways": [
      "Ray casting uses an odd/even intersection count to determine inclusion.",
      "It runs in O(N) time relative to the number of polygon edges.",
      "Edge cases like passing through vertices require careful algorithmic handling."
    ],
    "furtherReading": [
      {
        "title": "Point in Polygon Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Point_in_polygon"
      },
      {
        "title": "A Simple and Correct Eulerian Algorithm for Point-in-Polygon (Sunday)",
        "url": "https://wrfranklin.org/Research/Short_Notes/pnpoly.html"
      }
    ]
  },
  "seen-filtering-bloom-vs-exact-sets": {
    "title": "Seen filtering: Bloom vs exact sets",
    "video": {
      "youtubeId": "IgyU0iFIoqM",
      "title": "Data Structures for Big Data in Interviews - Bloom Filters, Count-Min Sketch, HyperLogLog",
      "channel": "Hello Interview",
      "why": "Explains Bloom filters specifically in the system-design context of when a false positive is acceptable, which is the exact decision this unit teaches.",
      "length": "25:51"
    },
    "videos": [
      {
        "youtubeId": "18Fg5Akhkqw",
        "title": "System Design Interview: Design Tinder w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Applies seen-filtering (never show a profile twice) with a Bloom filter versus exact storage inside a full design.",
        "length": "1:13:22"
      },
      {
        "youtubeId": "kfFacplFY4Y",
        "title": "What Are Bloom Filters?",
        "channel": "Spanning Tree",
        "role": "intro",
        "why": "A beautifully animated six-minute intuition for how bit arrays and multiple hashes produce false positives but never false negatives.",
        "length": "6:03"
      }
    ],
    "intuition": "<p>A bouncer with a perfect guest list checks every name against a full register: exact, but the register grows with every guest. A Bloom filter is a bouncer who only remembers a few smudges per guest (\"tall, red scarf, glasses\"). If any smudge is missing, you have definitely never been here. If all match, you <em>probably</em> have, and occasionally a stranger who happens to match gets turned away.</p><p><strong>Mental model:</strong> a Bloom filter trades a small, tunable false-positive rate for about 10 bits per item at 1 percent error, and it can only say \"definitely not seen\" or \"maybe seen\".</p><ul><li><strong>Using a Bloom filter where a false positive is harmful.</strong> Skipping a recommendation is fine; skipping a payment or a security check is not.</li><li><strong>Letting it overfill.</strong> The error rate climbs quickly past the planned capacity; rotate filters by time window and size them for the window.</li><li><strong>Expecting deletion.</strong> Standard Bloom filters cannot remove items; use time-windowed filters or counting and cuckoo filters if \"unsee\" is required.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Filtering 'Seen' Items in Recommendations</h2>\n      <p>In feed and recommendation systems (like Tinder, TikTok, or Twitter), a critical requirement is ensuring users don't repeatedly see the same items. We need an efficient way to filter out items a user has already \"seen.\"</p>\n      \n      <h3>Exact Sets (HashSets / Redis Sets)</h3>\n      <p>The straightforward approach is to maintain an exact set of seen item IDs for every user. In Redis, you would use a Set (<code>SADD user:123:seen item:456</code>). Before showing an item, you check <code>SISMEMBER</code>.</p>\n      <p><strong>Pros:</strong> 100% accurate. No false positives or false negatives.</p>\n      <p><strong>Cons:</strong> Memory grows linearly. The raw payload for 100,000 eight-byte IDs is about 800 KB, but a Redis Set also pays object, hash-table, allocator, replication, and persistence overhead. Measure the actual representation before comparing it with a Bloom filter.</p>\n      \n      <h3>Bloom Filters</h3>\n      <p>A Bloom Filter is a probabilistic data structure that is incredibly space-efficient. It tells you if an item is definitely not in the set, or possibly in the set.</p>\n      <ul>\n        <li><strong>False Positives:</strong> It might say a user has seen an item when they haven't. In a recommendation system, this just means a valid item gets skipped. This is usually an acceptable product trade-off.</li>\n        <li><strong>False Negatives:</strong> It will never say a user hasn't seen an item if they actually have.</li>\n      </ul>\n      \n      <p>For 100,000 expected items and a 1% target false-positive rate, the optimal bit array is about 958,506 bits, or roughly 120 KB, before implementation metadata. That is much smaller than a typical exact Redis Set, whose entries cost far more than the raw eight-byte ID, but it is not only a few kilobytes. Exceeding planned capacity raises the false-positive rate, so monitor insert count and rotate or rebuild by time window.</p>\n      \n      <h3>Hybrid Approaches</h3>\n      <p>Many systems use a hybrid approach based on time windows. They use an exact set (Redis) for the most recent session or the last 7 days (where accuracy matters most to avoid immediate repetition), and rely on a Bloom filter (or just drop filtering entirely) for historical interactions older than a month, assuming users forget or won't mind seeing very old content again.</p>\n      \n    \n<!-- enriched -->\n<h2>Sizing formulas and a rotation example</h2><p>For n items and target false-positive rate p, the optimal bit count is m = -n ln(p) / (ln 2)^2 and the number of hash functions is k = (m / n) ln 2. For n = 100,000 and p = 0.01, m is about 958,506 bits (about 117 KiB) and k is about 7. Halving p to 0.005 adds only about 1.44 bits per item.</p><p>Time-windowed rotation: keep an exact Redis set for the last 7 days of impressions (say 3,000 IDs per active user) and one Bloom filter per month for the previous six months, each sized for 15,000 items at 1 percent (about 18 KB each). A check probes the exact set, then each monthly filter; the combined false-positive rate is at most about 6 x 1 percent = 6 percent in the worst case, which you can lower by sizing older filters for 0.5 percent. Filters older than six months are simply dropped.</p><table><thead><tr><th>Approach</th><th>Memory per 100k items</th><th>False positives</th><th>Deletion</th><th>Best for</th></tr></thead><tbody><tr><td>Redis set of 8-byte IDs</td><td>Several MB in practice (object and hash overhead)</td><td>None</td><td>Yes</td><td>Recent, high-value history</td></tr><tr><td>Sorted set by timestamp</td><td>Larger than a plain set</td><td>None</td><td>Yes, by time range</td><td>Recent history with expiry</td></tr><tr><td>Bloom filter at 1 percent</td><td>About 120 KB</td><td>About 1 percent</td><td>No</td><td>Long history where skipping is harmless</td></tr><tr><td>Cuckoo filter</td><td>Similar to Bloom at low error rates</td><td>Tunable</td><td>Yes</td><td>History that must support un-see</td></tr></tbody></table><p>Real systems: RedisBloom provides BF.ADD and BF.EXISTS with scalable sub-filters; Medium has described using Bloom filters to avoid recommending already-read posts; dating apps apply the same idea to never re-show swiped profiles.</p>\n</div>",
    "keyTakeaways": [
      "Exact sets use too much memory for high-volume historical tracking.",
      "Bloom filters save massive amounts of RAM in exchange for a small false positive rate.",
      "False positives mean skipping valid content, which is often an acceptable trade-off in feeds."
    ],
    "furtherReading": [
      {
        "title": "Bloom Filters Explained",
        "url": "https://llimllib.github.io/bloomfilter-tutorial/"
      },
      {
        "title": "Space/Time Trade-offs in Hash Coding with Allowable Error (Bloom, 1970)",
        "url": "https://dl.acm.org/doi/10.1145/362686.362692"
      }
    ]
  },
  "matching-and-recommendation-algorithms": {
    "title": "Matching and recommendation algorithms",
    "video": {
      "youtubeId": "GncgOIiMII8",
      "title": "Recommendation System Infra Basics 1",
      "channel": "Hello Interview",
      "why": "Directly explains the retrieval then ranking funnel, embeddings and serving infrastructure this unit is built on, concisely.",
      "length": "9:44"
    },
    "videos": [
      {
        "youtubeId": "WK_Nr4tUtl8",
        "title": "RecSys 2016: Paper Session 6 - Deep Neural Networks for YouTube Recommendations",
        "channel": "ACM RecSys",
        "role": "deep-dive",
        "why": "The original YouTube paper talk that popularized the two-stage candidate generation and ranking architecture.",
        "length": "19:01"
      },
      {
        "youtubeId": "18Fg5Akhkqw",
        "title": "System Design Interview: Design Tinder w/ a Ex-Meta Staff Engineer",
        "channel": "Hello Interview",
        "role": "interview",
        "why": "Shows geospatially constrained matching: location-based candidate generation, filters and ranking for a dating app.",
        "length": "1:13:22"
      }
    ],
    "intuition": "<p>Hiring at a big company: a recruiter skims 10,000 resumes in minutes using a few keywords (cheap, high recall), picks 100, and then interviewers spend real time on each (expensive, high precision). Recommendation systems are the same funnel: fast retrieval from millions to hundreds, then a heavy model ranks the hundreds.</p><p><strong>Mental model:</strong> retrieval optimizes recall under a tight time budget, ranking optimizes precision on a small set, and business rules (diversity, safety, exploration) shape the final list.</p><ul><li><strong>Training on features not available at serving time.</strong> Using post-recommendation signals leaks the label and produces offline wins that vanish in production.</li><li><strong>Silent defaults on feature outages.</strong> Missing features treated as zero can reorder everything; fall back to a safe, popular-and-eligible list.</li><li><strong>No exploration.</strong> A ranker that only shows what it already scores highly never learns about new items or users, creating a rich-get-richer loop.</li></ul>",
    "content": "<div class=\"lesson-content\">\n      <h2>Scaling Matching and Recommendations</h2>\n      <p>Recommendation systems drive engagement on platforms like YouTube, Netflix, and Tinder. At a high level, these systems operate in a funnel architecture: from millions of possible candidates down to a ranked list of a dozen items presented to the user.</p>\n      \n      <h3>The Two-Stage Funnel</h3>\n      <ol>\n        <li><strong>Candidate Generation (Retrieval):</strong> The goal is to quickly reduce the corpus from billions to hundreds. Speed is critical. This stage uses lightweight algorithms:\n          <ul>\n            <li>Collaborative Filtering (Matrix Factorization)</li>\n            <li>Two-Tower Deep Learning Models (User embeddings and Item embeddings)</li>\n            <li>Approximate Nearest Neighbor (ANN) search using FAISS to find similar embeddings in vector databases.</li>\n          </ul>\n        </li>\n        <li><strong>Ranking (Scoring):</strong> The goal is precision. The system takes the hundreds of candidates and scores them using a heavy, complex machine learning model (e.g., Deep Neural Networks, XGBoost). This model incorporates dense features (time of day, context, detailed user history) to predict the probability of engagement (click, watch, swipe right).</li>\n      </ol>\n      \n      <h3>Geospatial Matching (The Tinder Model)</h3>\n      <p>For apps like Tinder or Uber, recommendations are heavily constrained by geography. The candidate generation phase is primarily a geospatial query (using Geohash or S2) combined with filters (age, gender, vehicle type). Only users within the active Geohash cells are pulled into the ranking phase. Machine learning models then rank the nearby candidates based on predicted mutual interest. (Early Tinder used an Elo-style desirability score; Tinder said in 2019 that it no longer relies on Elo.)</p>\n      \n      <h3>Infrastructure</h3>\n      <p>Candidate generation and ranking must use features available at serving time. Training on a future conversion, post-match outcome, or a feature computed after the recommendation creates leakage and an offline score that production cannot reproduce. Version model, embedding, feature schema, and ANN index together; during rollout, log which versions produced each result.</p>\n      <p><strong>Failure and tradeoff:</strong> if the feature store is unavailable, choose a bounded fallback such as popular eligible items rather than silently treating missing features as zero. Fresh streaming features improve responsiveness but add ordering and training/serving-skew risk; slower batch features are easier to reproduce. Evaluate retrieval recall and ranking quality offline, then validate engagement, diversity, safety, and long-term feedback effects online. Reserve some exploration so the existing ranker does not permanently hide new items.</p>\n      \n    \n<!-- enriched -->\n<h2>Worked example: a 150 ms budget</h2><p>Corpus: 100 million items. Target: return 20 items in 150 ms at the 99th percentile.</p><ol><li><strong>Candidate generation (about 20 ms):</strong> compute the user embedding from a two-tower model, run approximate nearest neighbour search (for example HNSW) for the top 500, plus 300 from \"followed creators\" and 200 from \"trending in your region\". HNSW indexes routinely reach about 95 percent recall at a few milliseconds per query.</li><li><strong>Filtering (about 5 ms):</strong> remove seen items (Bloom filter plus recent exact set), blocked creators and ineligible content: about 800 remain.</li><li><strong>Ranking (about 60 ms):</strong> a deep model scores 800 candidates in one batched call with hundreds of features each, predicting click, watch time and hide probability, combined into a single score.</li><li><strong>Re-ranking (about 5 ms):</strong> enforce diversity (at most 2 items per creator in the top 10), insert 1 to 2 exploration slots, return 20.</li></ol><p>The remaining budget covers network hops and feature store reads. If the feature store times out, serve the cached popular-and-eligible list for the user's region rather than scoring with missing inputs.</p><h2>Retrieval techniques</h2><table><thead><tr><th>Technique</th><th>Strength</th><th>Weakness</th><th>Typical use</th></tr></thead><tbody><tr><td>Item-to-item co-occurrence</td><td>Simple, explainable, strong baseline</td><td>Cold start for new items</td><td>\"People who watched X also watched\"</td></tr><tr><td>Matrix factorization</td><td>Captures latent taste</td><td>Retraining lag; weak with side features</td><td>Classic collaborative filtering</td></tr><tr><td>Two-tower embeddings plus ANN</td><td>Uses rich features, scales to billions</td><td>Needs careful negative sampling</td><td>Modern retrieval at YouTube, Pinterest and others</td></tr><tr><td>Geo plus filters (cells, age, preferences)</td><td>Hard constraints satisfied up front</td><td>Sparse areas return few candidates</td><td>Dating apps, ride and delivery matching</td></tr><tr><td>Graph-based (friends of friends, random walks)</td><td>Strong social signal</td><td>Expensive to compute online</td><td>People you may know</td></tr></tbody></table><h2>Two-sided matching notes</h2><ul><li>Dating and marketplace matching must balance attention: very popular profiles should not receive all impressions, so systems cap exposure and boost mutual-interest likelihood rather than one-sided attractiveness.</li><li>Tinder stated in 2019 that it no longer relies on its old Elo-style desirability score, moving to models that weigh mutual activity and preferences.</li></ul>\n</div>",
    "keyTakeaways": [
      "Recommendations use a funnel: Candidate Generation (fast/light) followed by Ranking (slow/heavy).",
      "Vector embeddings and Approximate Nearest Neighbor (ANN) are standard for modern retrieval.",
      "Geospatial apps filter heavily by location before applying complex ranking models."
    ],
    "furtherReading": [
      {
        "title": "Google Developers Course on Recommendation Systems",
        "url": "https://developers.google.com/machine-learning/recommendation"
      },
      {
        "title": "Matrix Factorization Techniques for Recommender Systems (Koren, Bell, Volinsky, 2009)",
        "url": "https://ieeexplore.ieee.org/document/5197422"
      },
      {
        "title": "Covington, Adams, Sargin: Deep Neural Networks for YouTube Recommendations (RecSys 2016)",
        "url": "https://dl.acm.org/doi/10.1145/2959100.2959190"
      }
    ]
  }
};
