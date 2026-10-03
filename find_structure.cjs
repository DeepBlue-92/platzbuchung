const fs = require("fs");
const path = require("path");

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    if (item === "node_modules" || item === ".git" || item === "dist" || item === ".vite") continue;
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

// Let us search for what could be deleted ("bitte entfernen")
// Could it be:
// 1. A search height issue or placeholder?
// 2. An unwanted badge or button or text in the UI?
// 3. Something in Reservation / Kalender?
// 4. Something in AdminSettings?
// 5. Something in Dashboard?
// Let us inspect the views.
console.log("Analyzing...");
