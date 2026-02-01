require("dotenv").config();
const fs = require("fs");

const TOKEN = process.env.FULL_ACCESS_TOKEN;
const CLOUD_URL = `${process.env.REMOTE_API}/api`;
const IMPORT_DIR = "./export";

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
    const id = item.id;

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


function removeIds(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeIds);
  }
  if (obj !== null && typeof obj === "object") {
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

const idMap = {};

async function importCollectionWithoutRelations(name) {
  console.log(`\n=== Importing ${name} (pass 1: no relations) ===`);

  const filePath = `${IMPORT_DIR}/${name}.json`;
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8")).sort((a, b) => {
    if (a.isChild !== b.isChild) {
      return a.isChild ? -1 : 1;
    }
    return a.order - b.order;
  });

  for (const item of items) {
    const cleaned = cleanItem(item);

    //delete cleaned.navigation_item;
    //delete cleaned.navigation_items;

    const res = await fetch(`${CLOUD_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify({data: cleaned})
    });

    if (!res.ok) {
      console.error(`Failed to import ${name}:`, await res.text());
      continue;
    }

    const json = await res.json();
    const newId = json.data.id;

    //idMap[item.id] = newId;

    console.log(`Created ${name}: old=${item.id} → new=${newId}`);
  }

  return items;
}

async function restoreNavigationRelations(items) {
  console.log(`\n=== Restoring navigation-items relations (pass 2) ===`);

  for (const item of items) {
    const newId = idMap[item.id];
    if (!newId) continue;

    const data = {};

    // parent
    if (item.navigation_item) {
      const parentId = idMap[item.navigation_item];
      if (parentId) data.navigation_item = parentId;
    }

    // children
    if (Array.isArray(item.navigation_items) && item.navigation_items.length > 0) {
      const childrenIds = item.navigation_items
        .map(child => idMap[child.id])
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
  await clearCollection("artikels");
  await clearCollection("navigation-items");

  await importCollectionWithoutRelations("artikels");

  const navItems = await importCollectionWithoutRelations("navigation-items");
  //await restoreNavigationRelations(navItems);

  console.log("\n=== Import completed ===\n", navItems);
}

run();
