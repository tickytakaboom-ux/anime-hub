import admin from "firebase-admin";
import fs from "fs";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const MODE = process.argv[2] || "update";
const BACKFILL_LIMIT = Number(process.env.BACKFILL_LIMIT || 500);
const UPDATE_LIMIT = Number(process.env.UPDATE_LIMIT || 200);
const PER_PAGE = 50;
const FORCE_UPDATE = process.env.FORCE_UPDATE === "true";

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
    return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8"));
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
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AniList request failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`AniList errors: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

function mapMediaToDoc(media) {
  const title =
    media.title?.english || media.title?.romaji || media.title?.native || "";

  return {
    anilistId: media.id,
    title,
    genre: media.genres || [],
    img: media.coverImage?.extraLarge || media.coverImage?.large || "",
    summary: sanitizeDescription(media.description),
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    episodes: media.episodes || null,
    nextAiringEpisode: media.nextAiringEpisode || null,
    source: "anilist",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
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

async function backfill(db) {
  const totalPages = Math.ceil(BACKFILL_LIMIT / PER_PAGE);
  let processed = 0;
  let created = 0;
  let skipped = 0;

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false, isKids: false) {
          id
          title { romaji english native }
          description(asHtml: false)
          genres
          isAdult
          isKids
          status
          season
          seasonYear
          episodes
          coverImage { large extraLarge }
          nextAiringEpisode { episode airingAt timeUntilAiring }
        }
      }
    }
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    const data = await anilistRequest(query, { page, perPage: PER_PAGE });
    const mediaList = data?.Page?.media || [];

    for (const media of mediaList) {
      if (processed >= BACKFILL_LIMIT) break;
      processed += 1;

      if (media.isAdult || media.isKids) {
        skipped += 1;
        continue;
      }

      const docRef = db.collection("animes").doc(String(media.id));
      const docSnap = await docRef.get();

      if (docSnap.exists && !FORCE_UPDATE) {
        skipped += 1;
        continue;
      }

      await docRef.set(mapMediaToDoc(media), { merge: true });
      created += 1;
    }
  }

  console.log(
    `Backfill terminé. Total traité: ${processed}, Ajoutés: ${created}, Ignorés: ${skipped}.`
  );
}

async function update(db) {
  const totalPages = Math.ceil(UPDATE_LIMIT / PER_PAGE);
  let processed = 0;
  let updated = 0;

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: UPDATED_AT_DESC, isAdult: false, isKids: false) {
          id
          title { romaji english native }
          description(asHtml: false)
          genres
          isAdult
          isKids
          status
          season
          seasonYear
          episodes
          coverImage { large extraLarge }
          nextAiringEpisode { episode airingAt timeUntilAiring }
        }
      }
    }
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    const data = await anilistRequest(query, { page, perPage: PER_PAGE });
    const mediaList = data?.Page?.media || [];

    for (const media of mediaList) {
      if (processed >= UPDATE_LIMIT) break;
      processed += 1;

      if (media.isAdult || media.isKids) {
        continue;
      }

      const docRef = db.collection("animes").doc(String(media.id));
      await docRef.set(mapMediaToDoc(media), { merge: true });
      updated += 1;
    }
  }

  console.log(`Update terminé. Total traité: ${processed}, Mises à jour: ${updated}.`);
}

async function main() {
  const db = await initFirebase();

  if (MODE === "backfill") {
    await backfill(db);
  } else if (MODE === "update") {
    await update(db);
  } else {
    throw new Error(`Mode inconnu: ${MODE}. Utilise backfill ou update.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
