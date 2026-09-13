import { mkdirSync, copyFileSync, cpSync } from "node:fs";
for (const folder of ["apps/web/public", "public-site"]) {
  mkdirSync(folder, { recursive: true });
  for (const file of [
    "index.html",
    "styles.css",
    "app.js",
    "config.js",
    "404.html",
    "_headers",
  ])
    copyFileSync(file, `${folder}/${file}`);
  cpSync("assets", `${folder}/assets`, { recursive: true });
}
