require("dotenv").config();
const fs = require("fs");
const path = require("path");

const API_URL = "http://localhost:1337/api";
const EXPORT_DIR = "./export";
const COLLECTION_DIR = path.join(EXPORT_DIR, "collections");
const MEDIA_DIR = path.join(EXPORT_DIR, "media");
const UPLOADS_DIR = path.join(MEDIA_DIR, "uploads");
const TOKEN = process.env.FULL_ACCESS_TOKEN;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

ensureDir(COLLECTION_DIR);
ensureDir(MEDIA_DIR);
ensureDir(UPLOADS_DIR);

async function exportCollection(name) {
  console.log(`Exporting ${name}...`);

  const res = await fetch(`${API_URL}/${name}?populate=*`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const json = await res.json();

  fs.writeFileSync(
    `${COLLECTION_DIR}/${name}.json`,
    JSON.stringify(json.data, null, 2)
  );

  console.log(`Saved: export/collections/${name}.json`);
}

async function exportCollection_(name) {
  console.log(`\n=== Exporting collection: ${name} ===`);

  const res = await fetch(`${API_URL}/${name}?populate=*`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const json = await res.json();

  const filePath = path.join(COLLECTION_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(json.data, null, 2));

  console.log(`Saved: collections/${name}.json`);
}

async function exportMediaMetadata() {
  console.log(`\n=== Exporting media metadata (upload_file) ===`, `${API_URL}/upload/files`, `Bearer ${TOKEN}`);

  const res = await fetch(`${API_URL}/upload/files`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    console.error("Failed to fetch upload files:", await res.text());
    return;
  }

  const json = await res.json();
  const filePath = path.join(MEDIA_DIR, "files.json");
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

  console.log(`Saved: media/files.json`);
}

async function exportMediaFiles() {
  console.log(`\n=== Copying media files from ./public/uploads ===`);

  const localUploads = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(localUploads)) {
    console.warn("No local ./public/uploads found, skipping file copy");
    return;
  }

  const files = fs.readdirSync(localUploads);
  for (const file of files) {
    const src = path.join(localUploads, file);
    const dest = path.join(UPLOADS_DIR, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  }

  console.log("Media files copied to export/media/uploads");
}

async function run() {
  await exportCollection("artikels");
  await exportCollection("gallery-items");
  await exportCollection("navigation-items");

  await exportMediaMetadata();
  await exportMediaFiles();

  console.log("\n=== Export completed ===");
}

run();
