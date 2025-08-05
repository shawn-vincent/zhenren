Below is a **detailed, implementation-ready proposal** for building an on-device retrieval stack for your acupuncture corpus in a React Native app using **SQLite + sqlite-vec** (exact KNN) with FTS5 prefiltering. It covers architecture, install/build steps for Expo & bare RN, schema and queries, embedding on device, performance budgets, packaging, and a migration path—so a teammate can pick it up and ship.

---

## 0) Executive summary

* **Goal:** Local-first, privacy-preserving RAG for acupuncture knowledge (points, meridians, indications, references), with **fast semantic search** offline on iOS/Android.
* **Core stack (device):**

  * **SQLite (JSI driver)** for metadata, TOCs, and full-text index (FTS5).
  * **`sqlite-vec`** to store embeddings and run **exact KNN** (cosine/L2) queries. ([GitHub][1], [alexgarcia.xyz][2])
  * **ONNX Runtime React Native** (or TFLite Task Library) for **on-device embeddings**. ([npm][3], [Google AI for Developers][4])
  * **expo-file-system / react-native-fs** for files (PDFs, images). ([Expo Documentation][5], [GitHub][6])
* **Query strategy:** **Two-stage** retrieval

  1. **FTS5 MATCH** (+ meridian/region filters) → 500–3,000 candidates, then
  2. **KNN re-rank** in `sqlite-vec` → top-K chunks. ([sqlite.org][7])
* **Why this now:** Your near-term corpus (1k–25k chunks) is squarely in the zone where *exact* KNN is snappy on phones, especially with FTS prefiltering. If/when you exceed \~100k–200k active vectors or need strict sub-50ms P95 without filters, migrate the vector layer to an ANN index (ObjectBox or similar).

---

## 1) Architecture (on device)

**Layers**

1. **Files** (PDF, PNG/SVG outlines, TXT): store under app container; keep URI + hash in DB. ([Expo Documentation][5])
2. **SQLite (primary DB):**

   * **Relational tables**: docs, points, meridians, chunk metadata.
   * **FTS5 virtual table** for lexical search (titles/body). ([sqlite.org][7])
   * **`sqlite-vec` virtual table** for vectors (`vec0`), KNN via `nearest_neighbors`. ([GitHub][1], [alexgarcia.xyz][2])
3. **Embedding runtime**:

   * Default: **ONNX Runtime React Native** (JS) with a compact sentence embedding model (e.g., MiniLM/BGE-small as ONNX). ([npm][3])
   * Alternatives: **TFLite Task Library – TextEmbedder** (native) or **Apple NLP `NLEmbedding`** (iOS) if you accept its language/model limits. ([Google AI for Developers][4], [Apple Developer][8])

**Why SQLite + sqlite-vec?**

* `sqlite-vec` is a no-dependency C extension that “runs anywhere SQLite runs,” with `vec0` tables and KNN APIs (cosine/L2/hamming). It’s **pre-v1** today and currently **exhaustive (brute-force) search**—which is fine at your scale. ([GitHub][1], [GitHub][9])
* SQLite FTS5 is a **first-class** virtual table module for efficient full-text queries, ideal for Stage-1 prefiltering. ([sqlite.org][7])

---

## 2) React Native choices & install

### 2.1 SQLite driver (JSI)

Pick one of:

* **OP-SQLite** (high-performance JSI, active): great perf + ecosystem. ([GitHub][10], [Oscar Franco][11])
* **react-native-nitro-sqlite** (successor to quick-sqlite, Nitro-modules): maintained, fast, embeds modern SQLite. ([GitHub][12], [GitHub][13])

> We recommend **OP-SQLite** or **Nitro-SQLite** for production. Both expose low-level SQL and work with Expo’s **development builds** / **prebuild**.

### 2.2 Expo vs. bare RN

* **Expo (recommended)**: Run `npx expo prebuild` to generate native projects and link modules. You can then use JSI SQLite and ONNX/TFLite. ([Expo Documentation][14])
* **Bare RN**: Install the native packages directly and run through Pod/Gradle integration as usual.

### 2.3 Filesystem

* **Expo:** `expo-file-system` (typed API; uploads/downloads too). ([Expo Documentation][5])
* **Bare RN:** `react-native-fs` (or vetted forks with active maintenance). ([GitHub][6], [npm][15])

### 2.4 Embedding runtime

* **ONNX Runtime RN:** `npm i onnxruntime-react-native` (Cocoapods/Gradle included). Official docs cover enabling Extensions if needed. ([npm][3], [ONNX Runtime][16])
* **TFLite Task Library (TextEmbedder):** Use platform SDKs (Java/Kotlin for Android; Swift for iOS) if you prefer native speed. ([Google AI for Developers][4], [Google AI for Developers][17])

---

## 3) Shipping `sqlite-vec` on mobile (iOS/Android)

**Don’t rely on runtime `.load` of a dylib** on iOS—static link the extension:

* SQLite supports runtime-loadable extensions, but mobile distribution often forbids shipping/downloading new native code dynamically. On iOS, App Store rules emphasize that apps **may not download/install/execute code that changes app behavior** (Guideline **2.5.2**), so the robust approach is to **compile extensions into the app** and register them at startup. ([sqlite.org][18], [Apple Developer][19], [MacStories][20])

**Plan**

1. Add `sqlite-vec` as a source dep and **compile into** your SQLite module target.
2. Call `sqlite3_auto_extension()` (or equivalent hook in your driver) to auto-register `vec0` at DB open.
3. On Android, include the C file in the JNI build; on iOS, add to the Xcode target.

> `sqlite-vec` project docs & feature pages: `vec0` virtual table, KNN guide, functions (`vec_distance_cosine`, etc.). ([GitHub][1], [alexgarcia.xyz][2])

---

## 4) Data model

**Logical entities**

* `docs` (books, articles, point catalogs, TOCs)
* `points` (361 canonical points; attributes, aliases, meridian, region)
* `chunks` (tokenized sections for retrieval)
* `chunks_fts` (FTS5 content=chunks)
* `chunk_vecs` (sqlite-vec table keyed to `chunks.id`)

**DDL**

```sql
-- Core content
CREATE TABLE docs (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  source_uri TEXT,        -- file://...  or bundle asset
  mime TEXT,
  sha256 TEXT
);

CREATE TABLE points (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,       -- e.g. "LI4"
  name TEXT,
  meridian TEXT,          -- e.g. "Large Intestine"
  region TEXT             -- e.g. "hand dorsum"
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES docs(id),
  point_id INTEGER REFERENCES points(id),
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  tags TEXT                -- csv/json tags (alt: normalize to side table)
);

-- FTS5 over chunk text for Stage-1 lexical prefilter
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text, content='chunks', content_rowid='id'
);

-- Keep FTS in sync (or use triggers; initial load can use 'INSERT INTO chunks_fts(rowid, text) SELECT id, text FROM chunks')
-- Vector store: 384-d float embeddings, cosine distance
CREATE VIRTUAL TABLE chunk_vecs USING vec0(
  id INTEGER PRIMARY KEY,           -- same id as chunks.id
  embedding float[384] distance_cosine
);
```

> FTS5 provides efficient full-text search (MATCH syntax, proximity operators, prefix). ([sqlite.org][7], [sqlite.org][7])
> `sqlite-vec` exposes `vec0` tables and KNN helpers; cosine/L2/hamming supported. ([GitHub][1], [Hacker News][21])

---

## 5) Ingestion pipeline (device or build step)

1. **Extract text** from sources (server/build step is fine; keep device work light).
2. **Chunk** (e.g., 350–600 tokens, 10–15% overlap).
3. **Embed** (on server during packaging, or on device at first run): 384-d vectors (MiniLM/BGE small are good trade-offs).

   * **ONNX Runtime RN** offers a JS API; ship the model in app assets. ([npm][3])
   * **TFLite TextEmbedder** is a native alternative (Java/Swift). ([Google AI for Developers][4])
4. **Insert** rows into `docs`, `points`, `chunks`.
5. **Populate FTS:** `INSERT INTO chunks_fts(rowid, text) SELECT id, text FROM chunks;` (or use triggers).
6. **Populate vectors:**
   `INSERT INTO chunk_vecs(id, embedding) VALUES (?, ?)` (bind typed Float32Array/bytes as per driver).

---

## 6) Query patterns

### 6.1 Two-stage semantic search (recommended)

**Stage A: FTS prefilter (lexical + metadata)**

```sql
-- Example: user searches "headache", prefers Large Intestine meridian
WITH c AS (
  SELECT id
  FROM chunks_fts
  WHERE chunks_fts MATCH ?               -- e.g. 'headache OR cephalalgia'
  LIMIT 3000
)
SELECT ch.id
FROM chunks ch
JOIN c ON ch.id = c.id
WHERE (ch.tags LIKE '%large_intestine%' OR ch.text LIKE '%LI4%');
```

**Stage B: KNN re-rank on candidates**

```sql
-- :qvec is the 384-d query embedding
SELECT v.id, nn.distance
FROM chunk_vecs v
JOIN nearest_neighbors('chunk_vecs', :qvec, 20) AS nn
  ON v.rowid = nn.rowid
WHERE v.id IN (SELECT id FROM c)
ORDER BY nn.distance ASC
LIMIT 20;
```

> `nearest_neighbors()` and KNN usage are documented in the sqlite-vec feature pages; you can also compute distances explicitly with `vec_distance_cosine()`. ([alexgarcia.xyz][2])

### 6.2 Pure semantic (no prefilter)

```sql
SELECT v.id, nn.distance
FROM chunk_vecs v
JOIN nearest_neighbors('chunk_vecs', :qvec, 20) AS nn
  ON v.rowid = nn.rowid
ORDER BY nn.distance ASC
LIMIT 20;
```

Use sparingly on big corpora (battery/thermals). The prefilter is a huge win.

---

## 7) React Native wiring (TypeScript)

**Open DB & ensure extensions loaded**

```ts
// Example with OP-SQLite (pseudo, adjust to actual API)
import { open } from 'op-sqlite';

const db = await open({ name: 'acupuncture.db', location: 'default' });
// If the driver exposes an init hook, call it to register vec0.
// Otherwise we compile sqlite-vec into the binary with auto-extension registration.
```

**FTS + KNN query (simplified)**

```ts
type Vec = Float32Array; // 384-d

async function search(q: string, qvec: Vec, k = 20) {
  // Stage A: FTS
  const cids = await db.all<{ id: number }>(
    `SELECT id FROM chunks_fts WHERE chunks_fts MATCH ? LIMIT 2000`,
    [q],
  );
  const idList = cids.map(r => r.id);
  if (idList.length === 0) return [];

  // Stage B: KNN re-rank on candidates
  // Some drivers support binding blobs/typed arrays; otherwise serialize.
  const rows = await db.all<{ id: number; distance: number }>(
    `
    WITH c(id) AS (SELECT value FROM json_each(?))
    SELECT v.id, nn.distance
    FROM chunk_vecs v
    JOIN c ON c.id = v.id
    JOIN nearest_neighbors('chunk_vecs', ?, ?) AS nn
      ON v.rowid = nn.rowid
    ORDER BY nn.distance ASC
    LIMIT ?;
    `,
    [JSON.stringify(idList), qvec, Math.max(k * 3, 50), k],
  );
  return rows;
}
```

---

## 8) Performance, sizing & budgets

* **Vector size**: 384-d float32 ≈ **1.5 KB/vector**.
  10k vectors ≈ 15 MB; 25k ≈ 38 MB (plus DB overhead).
* **Latencies (rule of thumb on modern phones):**

  * FTS prefilter → **sub-10–30 ms** for 2000–3000 candidates.
  * KNN re-rank on 2000–3000 vectors → **tens of ms**.
* **Keep it snappy**:

  * Always prefer **FTS5 prefilter** + metadata shards (e.g., by meridian/body region). ([sqlite.org][7])
  * **Batch** embeddings; use **transactions** and **WAL** mode for bulk inserts. (SQLite best-practice.)
  * Consider **quantization** (FP16/INT8) on the model to reduce CPU/memory.
* **When to consider ANN later:** Regularly >**100k–200k** active vectors, no prefilter, strict **<50–80 ms P95**, or very high query rate per session.

---

## 9) Content packaging & updates

* **Ship v1 DB** in the app bundle (readonly), and an **overlay DB** in documents dir for updates.
* Provide **delta packs** (SQL migrations or table-level imports) over HTTPS; merge on start or in background.
* Keep a **content version** table so you can roll forward/back easily.
* Files (PDFs/images) download to `FileSystem.documentDirectory` and store URI in `docs.source_uri`. ([Expo Documentation][5])

---

## 10) Tooling & developer experience

* **Expo dev build / prebuild** so your team can iterate with native code while keeping Expo CLIs. ([Expo Documentation][14])
* **DB inspection**: Provide a “developer screen” to run SQL and dump explain plans.
* **Unit tests**:

  * Embedding determinism across devices (checksum a few canonical strings).
  * FTS tokenization & language edge cases.
  * KNN results sanity (cosine neighborhood checks).
* **Benchmarks**: ship a micro-bench (N vectors vs latency) to watch regressions per release device class.

---

## 11) Security & privacy

* All data is **local** by default; nothing leaves device unless user opts in to cloud backup/sync.
* Use platform-secure storage for any keys/tokens (Keychain/Keystore).
* If you support user-imported docs, provide **on-device embedding** to keep private notes local.

---

## 12) Modern best practices & gotchas

* **Prefer JSI drivers** (OP-SQLite / Nitro) for low overhead and modern SQLite builds. ([GitHub][10], [GitHub][12])
* **Static-link `sqlite-vec` on iOS** (avoid runtime `.load` of external dylibs given App Store 2.5.2 constraints). ([Apple Developer][19])
* **FTS5 MATCH syntax** supports phrases, NEAR(), and prefix (`*`)—design your query builder accordingly. ([sqlite.org][7])
* **`sqlite-vec` status**: pre-v1; *exhaustive KNN today* (ANN planned but no ETA). Keep your vector store behind an interface so you can swap later. ([GitHub][9])
* **Embedding runtimes**:

  * **ONNX Runtime RN** is fully supported and documented for JS. ([npm][3])
  * **TFLite Task Library** offers first-class **TextEmbedder** in Java/Swift. ([Google AI for Developers][4])
  * **Apple `NLEmbedding`** can provide sentence embeddings on iOS for certain languages; quality/coverage differ from SOTA models—treat as optional. ([Apple Developer][8], [Apple Developer][22])

---

## 13) Migration path to ANN (later)

If you grow into research-scale corpora or heavy interactive search:

* Swap `VectorIndex.search()` impl to an **on-device ANN** (e.g., ObjectBox Vector / HNSW).
* Keep SQLite for **FTS5** and metadata joins; use ANN for final scoring.
* Maintain a feature flag to A/B across device classes and index sizes.

---

## 14) Concrete “Definition of Done” (v1)

* [ ] RN app builds with **OP-SQLite (or Nitro)**, `sqlite-vec` statically linked and registered. ([GitHub][10], [GitHub][12])
* [ ] **DB schema** created (docs, points, chunks, FTS5, vec0).
* [ ] **Ingestion tool** (node script) that chunks & embeds sources, generates `acupuncture.db`.
* [ ] **Two-stage search** implemented with telemetry (P50/P95).
* [ ] **Developer bench** screen (enter text → show hits & timings).
* [ ] Initial corpus: **361 points** + key references (≈ 1k–3k chunks).
* [ ] App size check (model + DB under target).
* [ ] Content update mechanism (overlay DB & version table).
* [ ] Documentation for adding new sources.

---

## 15) Appendix: Install/build snippets

### A. OP-SQLite (example)

```bash
# Expo project
npx create-expo-app@latest acupuncture-ai
cd acupuncture-ai
npx expo install react-native-reanimated react-native-gesture-handler
npm i op-sqlite
npx expo prebuild
# iOS: pod install runs inside prebuild; Android: Gradle sync on build
```

Configure iOS minimum version as required by your driver; repeat similarly for **react-native-nitro-sqlite** if you prefer Nitro. ([GitHub][12])

### B. ONNX Runtime RN

```bash
npm i onnxruntime-react-native
# iOS pods / Android gradle handled by autolinking; if you use Extensions:
# add `"onnxruntimeExtensionsEnabled": "true"` in package.json as per docs
```

([npm][3], [ONNX Runtime][16])

### C. sqlite-vec integration (static)

* Add `sqlite-vec` C file to the native module (OP-SQLite/Nitro) build target.
* Register as an **auto-extension** so `vec0` is available on open.
* Confirm by running `CREATE VIRTUAL TABLE t USING vec0(embedding float[384] distance_cosine);` in a dev screen.
  (Reference: `sqlite-vec` repo, KNN guide & reference.) ([GitHub][1], [alexgarcia.xyz][2], [GitHub][23])

---

## 16) Example content ingestion (node)

```ts
// ingest.ts (runs on your laptop/CI)
import { open } from 'sqlite'; // or better: use the same RN driver via node binding
import { computeEmbeddings } from './embed'; // wraps ONNX/TFLite in Node or calls a service

// 1) parse sources -> chunks[]
// 2) insert docs/points/chunks
// 3) populate FTS5 and vec0

await db.exec('BEGIN');
for (const ch of chunks) {
  await db.run(
    `INSERT INTO chunks (doc_id, point_id, ordinal, text, tags) VALUES (?,?,?,?,?)`,
    ch.docId, ch.pointId, ch.ordinal, ch.text, ch.tags
  );
}
await db.run(`INSERT INTO chunks_fts(rowid,text) SELECT id,text FROM chunks`);
for (const ch of chunks) {
  const emb = await computeEmbeddings(ch.text); // Float32Array(384)
  await db.run(`INSERT INTO chunk_vecs(id, embedding) VALUES (?,?)`, ch.id, emb);
}
await db.exec('COMMIT');
```

---

## 17) Risks & mitigations

* **iOS dynamic loading**: Avoid `.load` of external dylibs; **static link** `sqlite-vec`. (App Store 2.5.2.) ([Apple Developer][19])
* **Model size**: Pick small/quantized embedding models; keep app bundle lean.
* **Performance regressions**: Ship micro-benchmarks; record P50/P95 per device class.
* **`sqlite-vec` evolution**: It’s pre-v1; keep the vector layer behind an interface so you can replace or upgrade as APIs stabilize. ([alexgarcia.xyz][24])

---

## 18) References & further reading

* **sqlite-vec** (project/feature docs; KNN page; pre-v1 status). ([GitHub][1], [alexgarcia.xyz][2], [alexgarcia.xyz][24])
* **SQLite FTS5** (official). ([sqlite.org][7])
* **ONNX Runtime React Native** (package/docs). ([npm][3], [ONNX Runtime][16])
* **TFLite Task Library – TextEmbedder** (official). ([Google AI for Developers][4])
* **OP-SQLite** and **react-native-nitro-sqlite** (JSI drivers). ([GitHub][10], [GitHub][12])
* **App Store Guideline 2.5.2** (no dynamic code download/execute). ([Apple Developer][19], [MacStories][20])

---

### Final recommendation

Proceed with **SQLite + FTS5 + sqlite-vec** and **ONNX Runtime RN** for embeddings. This gives you the best blend of **simplicity, privacy, and speed** for your current corpus (361 points + references, textbooks). Keep the vector adapter abstracted so you can add an **ANN backend** later without touching the rest of the app.

[1]: https://github.com/asg017/sqlite-vec?utm_source=chatgpt.com "asg017/sqlite-vec: A vector search ..."
[2]: https://alexgarcia.xyz/sqlite-vec/features/knn.html?utm_source=chatgpt.com "KNN queries | sqlite-vec - Alex Garcia"
[3]: https://www.npmjs.com/package/onnxruntime-react-native?utm_source=chatgpt.com "onnxruntime-react-native"
[4]: https://ai.google.dev/edge/litert/libraries/task_library/text_embedder?utm_source=chatgpt.com "Integrate text embedders. | Google AI Edge - Gemini API"
[5]: https://docs.expo.dev/versions/latest/sdk/filesystem/?utm_source=chatgpt.com "FileSystem"
[6]: https://github.com/itinance/react-native-fs?utm_source=chatgpt.com "itinance/react-native-fs - GitHub"
[7]: https://www.sqlite.org/fts5.html?utm_source=chatgpt.com "SQLite FTS5 Extension"
[8]: https://developer.apple.com/documentation/naturallanguage/nlembedding?utm_source=chatgpt.com "NLEmbedding | Apple Developer Documentation"
[9]: https://github.com/asg017/sqlite-vec/issues/25?utm_source=chatgpt.com "ANN (Approximate Nearest Neighbors) Index · Issue #25 · ..."
[10]: https://github.com/OP-Engineering/op-sqlite?utm_source=chatgpt.com "OP-Engineering/op-sqlite: Fastest SQLite library for react- ..."
[11]: https://ospfranco.com/post/2023/11/09/sqlite-for-react-native%2C-but-5x-faster-and-5x-less-memory/?utm_source=chatgpt.com "SQLite for React Native, but 5x faster and 5x less memory"
[12]: https://github.com/margelo/react-native-nitro-sqlite?utm_source=chatgpt.com "margelo/react-native-nitro-sqlite"
[13]: https://github.com/margelo/react-native-nitro-sqlite/releases?utm_source=chatgpt.com "Releases · margelo/react-native-nitro-sqlite"
[14]: https://docs.expo.dev/guides/adopting-prebuild/?utm_source=chatgpt.com "Adopt Prebuild"
[15]: https://www.npmjs.com/package/%40dr.pogodin/react-native-fs?utm_source=chatgpt.com "@dr.pogodin/react-native-fs - npm"
[16]: https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html?utm_source=chatgpt.com "React Native"
[17]: https://ai.google.dev/edge/litert/libraries/task_library/overview?utm_source=chatgpt.com "TensorFlow Lite Task Library | Google AI Edge - Gemini API"
[18]: https://www.sqlite.org/loadext.html?utm_source=chatgpt.com "Run-Time Loadable Extensions"
[19]: https://developer.apple.com/app-store/review/guidelines/?utm_source=chatgpt.com "App Review Guidelines"
[20]: https://www.macstories.net/linked/apples-app-store-guidelines-now-allow-executable-code-in-educational-apps-and-developer-tools/?utm_source=chatgpt.com "Apple's App Store Guidelines Now Allow Executable Code ..."
[21]: https://news.ycombinator.com/item?id=40243168&utm_source=chatgpt.com "I'm writing a new vector search SQLite Extension"
[22]: https://developer.apple.com/documentation/naturallanguage/finding-similarities-between-pieces-of-text?utm_source=chatgpt.com "Finding similarities between pieces of text"
[23]: https://github.com/asg017/sqlite-vec/blob/main/reference.yaml?utm_source=chatgpt.com "reference.yaml - asg017/sqlite-vec"
[24]: https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html?utm_source=chatgpt.com "Introducing sqlite-vec v0.1.0: a vector search SQLite extension ..."
