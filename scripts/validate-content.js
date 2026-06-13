const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const expressionsPath = path.join(rootDir, "content", "expressions.json");
const manifestPath = path.join(rootDir, "content", "audio_manifest.csv");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

const content = JSON.parse(fs.readFileSync(expressionsPath, "utf8").replace(/^\uFEFF/, ""));
if (!Array.isArray(content.expressions) || content.expressions.length === 0) {
  fail("content/expressions.json must contain a non-empty expressions array");
}

const ids = new Set();
for (const expression of content.expressions) {
  for (const field of ["id", "ko", "foreign", "language", "audio"]) {
    if (!expression[field]) {
      fail(`Expression is missing ${field}`);
    }
  }

  if (ids.has(expression.id)) {
    fail(`Duplicate expression id: ${expression.id}`);
  }
  ids.add(expression.id);

  const audioPath = path.join(rootDir, expression.audio);
  if (!fs.existsSync(audioPath)) {
    fail(`Missing audio file for ${expression.id}: ${expression.audio}`);
  }
}

const manifestLines = fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
const header = parseCsvLine(manifestLines[0]);
const expectedHeader = ["id", "type", "language", "ko", "foreign", "source_file", "public_file"];
if (header.join(",") !== expectedHeader.join(",")) {
  fail(`Manifest header must be: ${expectedHeader.join(",")}`);
}

const manifestIds = new Set();
for (const line of manifestLines.slice(1)) {
  const row = parseCsvLine(line);
  if (row.length !== expectedHeader.length) {
    fail(`Manifest row has ${row.length} columns instead of ${expectedHeader.length}: ${line}`);
  }
  manifestIds.add(row[0]);
}

for (const id of ids) {
  if (!manifestIds.has(id)) {
    fail(`Missing manifest row for ${id}`);
  }
}

console.log(`Validated ${content.expressions.length} expressions.`);

