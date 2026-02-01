const fs = require("fs");

const API_URL = "http://localhost:1337/api";
const EXPORT_DIR = "./export";

async function exportCollection(name) {
  console.log(`Exporting ${name}...`);

  const res = await fetch(`${API_URL}/${name}?populate=*`);
  const json = await res.json();

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR);
  }

  fs.writeFileSync(
    `${EXPORT_DIR}/${name}.json`,
    JSON.stringify(json.data, null, 2)
  );

  console.log(`Saved: export/${name}.json`);
}

async function run() {
  await exportCollection("artikels");
  await exportCollection("navigation-items");

  console.log("Export completed.");
}

run();
