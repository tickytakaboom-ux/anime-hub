import admin from "firebase-admin";
import fs from "fs";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const MODE = process.argv[2] || "update";
const BACKFILL_LIMIT = Number(process.env.BACKFILL_LIMIT || 500);
const UPDATE_LIMIT = Number(process.env.UPDATE_LIMIT || 200);
const PER_PAGE = 50;
const FORCE_UPDATE = process.env.FORCE_UPDATE === "true";
const SAMPLE_FILE = process.env.SAMPLE_FILE || "data/sample-animes.json";
const KIDS_GENRES = new Set(["Kids"]);
const RELATION_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "SIDE_STORY",
  "SUMMARY",
  "ALTERNATIVE",
  "ALTERNATIVE_SETTING",
  "SPIN_OFF",
  "PARENT",
  "CHILD",
  "COMPILATION",
  "OTHER"
]);

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64"
    ).toString("utf8");
    return JSON.parse(decoded);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    return JSON.parse(
      fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8")
    );
  }
  throw new Error(
    "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_SERVICE_ACCOUNT_FILE."
  );
}

function sanitizeDescription(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

async function anilistRequest(query, variables) {
  const maxRetries = 6;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 429 && attempt < maxRetries) {
      const delayMs = 1200 * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AniList request failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    if (result.errors) {
      const isRateLimit = result.errors.some(
        (error) => error?.status === 429
      );
      if (isRateLimit && attempt < maxRetries) {
        const delayMs = 1200 * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt += 1;
        continue;
      }
      throw new Error(`AniList errors: ${JSON.stringify(result.errors)}`);
    }
    return result.data;
  }
  throw new Error("AniList request failed after retries.");
}

function isKidsMedia(media) {
  if (!media?.genres?.length) return false;
  return media.genres.some((genre) => KIDS_GENRES.has(genre));
}

function titleFor(media) {
  return (
    media.title?.english || media.title?.romaji || media.title?.native || ""
  );
}

function formatDate(startDate) {
  if (!startDate) return null;
  const { year, month, day } = startDate;
  if (!year) return null;
  const paddedMonth = month ? String(month).padStart(2, "0") : "01";
  const paddedDay = day ? String(day).padStart(2, "0") : "01";
  return `${year}-${paddedMonth}-${paddedDay}`;
}

function formatToTimelineType(format) {
  switch (format) {
    case "MOVIE":
      return "movie";
    case "OVA":
      return "ova";
    case "ONA":
      return "ona";
    case "SPECIAL":
      return "special";
    case "TV_SHORT":
    case "TV":
      return "season";
    default:
      return "season";
  }
}

function mediaToTimelineItem(media) {
  return {
    type: formatToTimelineType(media.format),
    title: titleFor(media),
    episodes: media.episodes || null,
    canon: true,
    status: media.status ? media.status.toLowerCase() : "released",
    releaseDate: formatDate(media.startDate),
    seasonYear: media.seasonYear || null,
    anilistId: media.id
  };
}

function mapMediaToDoc(media, timeline) {
  return {
    anilistId: media.id,
    title: titleFor(media),
    genre: media.genres || [],
    img: media.coverImage?.extraLarge || media.coverImage?.large || "",
    summary: sanitizeDescription(media.description),
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    episodes: media.episodes || null,
    nextAiringEpisode: media.nextAiringEpisode || null,
    anilistScore: media.averageScore ?? null,
    timeline,
    source: "anilist",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function selectPrimaryMedia(items) {
  const formatPriority = {
    TV: 1,
    TV_SHORT: 2,
    MOVIE: 3,
    OVA: 4,
    ONA: 5,
    SPECIAL: 6
  };

  return [...items].sort((a, b) => {

    const dateA = Date.parse(formatDate(a.startDate) || "9999-12-31");
    const dateB = Date.parse(formatDate(b.startDate) || "9999-12-31");
    if (dateA !== dateB) return dateA - dateB;
    
    const formatA = formatPriority[a.format] ?? 99;
    const formatB = formatPriority[b.format] ?? 99;
    if (formatA !== formatB) return formatA - formatB;

    const descA = (a.description || "").length;
    const descB = (b.description || "").length;
    if (descA !== descB) return descB - descA;

    return (b.averageScore || 0) - (a.averageScore || 0);
  })[0];
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    return this.parent.get(x);
  }
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}

function addMediaToMap(mediaById, media) {
  if (!mediaById.has(media.id)) {
    mediaById.set(media.id, media);
  }
}

function buildGroups(mediaList) {
  const mediaById = new Map();
  const uf = new UnionFind();

  mediaList.forEach((media) => {
    addMediaToMap(mediaById, media);
    uf.find(media.id);

    const edges = media.relations?.edges || [];
    const nodes = media.relations?.nodes || [];

    edges.forEach((edge, index) => {
      const related = nodes[index];
      if (!related || related.type !== "ANIME") return;
      if (!RELATION_TYPES.has(edge.relationType)) return;
      if (related.isAdult || isKidsMedia(related)) return;

      addMediaToMap(mediaById, related);
      uf.union(media.id, related.id);
    });
  });

  const groups = new Map();
  for (const media of mediaById.values()) {
    if (media.isAdult || isKidsMedia(media)) continue;
    const root = uf.find(media.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(media);
  }

  return { mediaById, groups };
}

async function initFirebase() {
  const serviceAccount = getServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

function mediaQuery(extraFilter = "") {
  return `
    id
    type
    title { romaji english native }
    description(asHtml: false)
    genres
    isAdult
    status
    season
    seasonYear
    episodes
    averageScore
    format
    coverImage { large extraLarge }
    startDate { year month day }
    nextAiringEpisode { episode airingAt timeUntilAiring }
    relations {
      edges { relationType }
      nodes {
        id
        type
        title { romaji english native }
        description(asHtml: false)
        genres
        isAdult
        status
        season
        seasonYear
        episodes
        averageScore
        format
        coverImage { large extraLarge }
        startDate { year month day }
      }
    }
    ${extraFilter}
  `;
}

async function fetchMediaPages(sort, limit, filterClause = "") {
  const totalPages = Math.ceil(limit / PER_PAGE);
  const mediaList = [];

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: ${sort}, isAdult: false ${filterClause}) {
          ${mediaQuery()}
        }
      }
    }
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    const data = await anilistRequest(query, { page, perPage: PER_PAGE });
    const media = data?.Page?.media || [];
    mediaList.push(...media);
    if (mediaList.length >= limit) break;
  }

  return mediaList.slice(0, limit);
}

   async function fetchMediaByIds(ids) {
  const results = [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += PER_PAGE) {
    chunks.push(ids.slice(i, i + PER_PAGE));
  }

      const query = `
    query ($page: Int, $perPage: Int, $ids: [Int]) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, id_in: $ids, isAdult: false) {
          ${mediaQuery()}
        }
      }
    }
  `;

      for (const chunk of chunks) {
    const data = await anilistRequest(query, {
      page: 1,
      perPage: chunk.length,
      ids: chunk
    });
    results.push(...(data?.Page?.media || []));
  }

      return results;
}

async function writeGroups(db, groups, mode) {
  let written = 0;
  let skipped = 0;

  for (const group of groups.values()) {
    if (!group.length) continue;

    const primary = selectPrimaryMedia(group);
    const timeline = group
      .map(mediaToTimelineItem)
      .sort((a, b) => {
        const dateA = a.releaseDate ? Date.parse(a.releaseDate) : 0;
        const dateB = b.releaseDate ? Date.parse(b.releaseDate) : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.title || "").localeCompare(b.title || "");
      });

    const docRef = db.collection("animes").doc(String(primary.id));
    const docSnap = await docRef.get();

    if (docSnap.exists && mode === "backfill" && !FORCE_UPDATE) {
      skipped += 1;
      continue;
    }
    const payload = mapMediaToDoc(primary, timeline);
    await docRef.set(payload, { merge: true });
    written += 1;
  }
  return { written, skipped };
}

async function backfill(db) {
  const mediaList = await fetchMediaPages("POPULARITY_DESC", BACKFILL_LIMIT);
  const { groups } = buildGroups(mediaList);
  const { written, skipped } = await writeGroups(db, groups, "backfill");
  
  console.log(
    `Backfill terminé. Total groupes: ${groups.size}, Ajoutés: ${written}, Ignorés: ${skipped}.`
  );
}

async function update(db) {
  const mediaList = await fetchMediaPages("UPDATED_AT_DESC", UPDATE_LIMIT);
  const { groups } = buildGroups(mediaList);
  const { written } = await writeGroups(db, groups, "update");

  console.log(`Update terminé. Total groupes: ${groups.size}, Mises à jour: ${written}.`);
}

async function searchAniListId(title) {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 1) {
        media(type: ANIME, search: $search, isAdult: false) {
          id
        }
      }
    }
  `;

  const data = await anilistRequest(query, { search: title });
  return data?.Page?.media?.[0]?.id ?? null;
}

async function importSample(db) {
  if (!fs.existsSync(SAMPLE_FILE)) {
    throw new Error(`Sample file not found: ${SAMPLE_FILE}`);
  }
  
  const raw = JSON.parse(fs.readFileSync(SAMPLE_FILE, "utf8"));
  const ids = new Set();

  for (const entry of raw) {
    const title = entry.title?.trim();
    if (!title) continue;
    const id = await searchAniListId(title);
    if (id) ids.add(id);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const idList = [...ids];
  if (!idList.length) {
    console.log("Aucun anime trouvé via AniList pour SAMPLE_ANIMES.");
    return;
  }

  const mediaList = await fetchMediaByIds(idList);
  const { groups } = buildGroups(mediaList);
  const { written, skipped } = await writeGroups(db, groups, "import");

  console.log(
    `Import SAMPLE_ANIMES terminé. Groupes: ${groups.size}, Ajoutés: ${written}, Ignorés: ${skipped}.`
  );
}

async function main() {
  const db = await initFirebase();

  if (MODE === "backfill") {
    await backfill(db);
  } else if (MODE === "update") {
    await update(db);
  } else if (MODE === "import-sample") {
    await importSample(db);
  } else {
    throw new Error(`Mode inconnu: ${MODE}. Utilise backfill, update ou import-sample.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
