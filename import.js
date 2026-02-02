require("dotenv").config();
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const TOKEN = process.env.FULL_ACCESS_TOKEN_R;
const CLOUD_URL = `${process.env.REMOTE_API}/api`;
const IMPORT_DIR = "./export";
const COLLECTION_DIR = path.join(IMPORT_DIR, "collections");
const MEDIA_DIR = path.join(IMPORT_DIR, "media");
const UPLOADS_DIR = path.join(MEDIA_DIR, "uploads");

const fileIdMap = {};   // oldFileId → newFileId
const idMap = {};       // oldEntityId → newEntityId

// ===== helpers =====

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function removeIds(obj) {
  if (Array.isArray(obj)) return obj.map(removeIds);
  if (obj && typeof obj === "object") {
    const cleaned = {};
    for (const key in obj) {
      if (key === "id" || key === "documentId") continue;
      cleaned[key] = removeIds(obj[key]);
    }
    return cleaned;
  }
  return obj;
}

function cleanItem(item) {
  const forbidden = [
    "id",
    "documentId",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "createdBy",
    "updatedBy"
  ];

  const cleaned = {...item};
  forbidden.forEach(f => delete cleaned[f]);

  return removeIds(cleaned);
}

async function uploadFile(filePath) {
  const form = new FormData();

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  console.log('fileName', filePath, fileName);

  const blob = new Blob([new Uint8Array(fileBuffer)]);

  form.append("files", blob, fileName);

  console.log('blob', blob);

  const res = await fetch(`${CLOUD_URL}/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`
    },
    body: form
  });

  if (!res.ok) {
    console.error("Upload failed:", filePath, await res.text());
    return null;
  }

  const json = await res.json();
  const file = json[0];
  console.log(`Uploaded: ${file.name} (id=${file.documentId})`);
  return file;
}

async function uploadFile_(filePath) {
  const form = new FormData();
  form.append("files", fs.createReadStream(filePath));

  const res = await fetch(`${CLOUD_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`
    },
    body: form
  });

  if (!res.ok) {
    console.error("Upload failed:", filePath, await res.text());
    return null;
  }

  const json = await res.json();
  const file = json[0];
  console.log(`Uploaded: ${file.name} (id=${file.documentId})`);
  return file;
}

async function importMedia() {
  console.log(`\n=== Importing media files ===`);

  const meta = readJSON(path.join(MEDIA_DIR, "files.json"));
  if (!meta) {
    console.warn("No media metadata found, skipping media import");
    return;
  }

  const filesByHash = {};
  meta.forEach(f => {
    filesByHash[f.hash] = f;
  });

  console.log('filesByHash', filesByHash, meta);

  for (const file of Object.keys(filesByHash)) {
    const fileName = filesByHash[file].hash + filesByHash[file].ext;
    const fullPath = path.join(UPLOADS_DIR, fileName);

    const oldId = filesByHash[file].documentId;

    console.log('original', fileName, fullPath, oldId);

    if (meta.findIndex(f => f.documentId === oldId) > -1) {
      console.log('Uploading:', fullPath);

      const uploaded = await uploadFile(fullPath);

      console.log('Uploaded:', uploaded, oldId);

      if (uploaded && oldId) {
        fileIdMap[oldId] = uploaded.documentId;
      }
    } else {
      console.log('Skipping:', fullPath);
    }
  }

  console.log("Media import completed.");
}

async function clearCollection(name) {
  console.log(`\n=== Clearing collection: ${name} ===`);

  const res = await fetch(`${CLOUD_URL}/${name}?pagination[pageSize]=1000`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch ${name}:`, await res.text());
    return;
  }

  const json = await res.json();
  const items = json.data;

  if (!items.length) {
    console.log(`Collection ${name} is already empty`);
    return;
  }

  for (const item of items) {
    const id = item.documentId;

    const del = await fetch(`${CLOUD_URL}/${name}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    });

    if (!del.ok) {
      console.error(`Failed to delete ${name} id=${id}:`, await del.text());
    } else {
      console.log(`Deleted ${name} id=${id}`);
    }
  }

  console.log(`Finished clearing ${name}`);
}

function replaceMediaIdsInData(data) {
  if (!data || typeof data !== "object") return data;

  const cloned = Array.isArray(data) ? [...data] : {...data};

  const walk = obj => {
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === "object") {
      const res = {};
      for (const key in obj) {
        const val = obj[key];

        // single media
        if (val && typeof val === "object" && val.documentId && fileIdMap[val.documentId]) {
          res[key] = {id: fileIdMap[val.documentId]};
          continue;
        }

        // multiple media
        if (Array.isArray(val) && val.length && val[0]?.documentId) {
          res[key] = val
            .map(v => fileIdMap[v.documentId] && {id: fileIdMap[v.documentId]})
            .filter(Boolean);
          continue;
        }

        res[key] = walk(val);
      }
      return res;
    }
    return obj;
  };

  return walk(cloned);
}

async function importCollection(name, options = {}) {
  console.log(`\n=== Importing collection: ${name} ===`);

  const filePath = path.join(COLLECTION_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  const items = readJSON(filePath);

  for (const item of items) {
    const oldId = item.documentId;
    let cleaned = cleanItem(item);

    cleaned = replaceMediaIdsInData(cleaned);

    delete cleaned.navigation_item;
    delete cleaned.navigation_items;

    const res = await fetch(`${CLOUD_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify({data: cleaned})
    });

    if (!res.ok) {
      console.error(`Failed to import ${name}:`, item, cleaned, await res.text());
      continue;
    }

    const json = await res.json();
    const newId = json.data.documentId;

    idMap[oldId] = newId;

    console.log(`Created ${name}: old=${oldId} → new=${newId}`);
  }

  return items;
}

async function restoreNavigationRelations(items) {
  console.log(`\n=== Restoring navigation-items relations (pass 2) ===`);

  for (const item of items) {
    const newId = idMap[item.documentId];
    if (!newId) continue;

    const data = {};

    if (item.navigation_item) {
      const parentId = idMap[item.navigation_item];
      if (parentId) data.navigation_item = parentId;
    }

    if (Array.isArray(item.navigation_items) && item.navigation_items.length > 0) {
      const childrenIds = item.navigation_items
        .map(child => idMap[child.documentId])
        .filter(Boolean);

      if (childrenIds.length > 0) {
        data.navigation_items = childrenIds;
      }
    }

    if (Object.keys(data).length === 0) continue;

    const res = await fetch(`${CLOUD_URL}/navigation-items/${newId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify({data})
    });

    if (!res.ok) {
      console.error(`Failed to update relations for ${newId}:`, await res.text());
    } else {
      console.log(`Updated relations for ${newId}`);
    }
  }
}

async function run() {
  //await importMedia();

  await clearCollection("artikels");
  await clearCollection("navigation-items");

  await importCollection("artikels");
  const navItems = await importCollection("navigation-items");

  await restoreNavigationRelations(navItems);

  console.log("\n=== Import completed ===");
}

run();
