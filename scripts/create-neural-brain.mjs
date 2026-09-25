// Adapted from the team's Guardiao-Projeto/dist/brain.js visual scaffold.
// Nodes are illustrative artwork; they do not represent records or evidence.
import { writeFileSync } from "node:fs";
const outline = [
  [-1.02, 0.03],
  [-1, -0.17],
  [-0.92, -0.38],
  [-0.78, -0.55],
  [-0.57, -0.7],
  [-0.31, -0.79],
  [-0.06, -0.83],
  [0.21, -0.8],
  [0.48, -0.73],
  [0.72, -0.59],
  [0.91, -0.39],
  [1, -0.16],
  [0.99, 0.05],
  [0.91, 0.22],
  [0.77, 0.31],
  [0.79, 0.45],
  [0.71, 0.58],
  [0.52, 0.61],
  [0.43, 0.56],
  [0.39, 0.78],
  [0.3, 0.91],
  [0.19, 0.84],
  [0.18, 0.66],
  [0.08, 0.48],
  [-0.08, 0.4],
  [-0.27, 0.51],
  [-0.48, 0.55],
  [-0.67, 0.47],
  [-0.76, 0.32],
  [-0.92, 0.26],
];
function inside(x, y) {
  let yes = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i],
      b = outline[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
let seed = 913;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const points = Array.from({ length: 1800 }, () => {
  let x, y;
  do {
    x = random() * 2.1 - 1.05;
    y = random() * 1.8 - 0.85;
  } while (!inside(x, y));
  const fold =
    Math.sin(x * 19 + Math.sin(y * 12) * 2.1) * Math.cos(y * 16 + x * 3);
  return { x: 320 + x * 250, y: 260 + y * 250, fold, r: 0.5 + random() * 0.9 };
});
const paths = [];
for (let i = 0; i < points.length; i++) {
  const p = points[i];
  const near = points
    .slice(i + 1)
    .map((q) => ({ q, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
    .filter((v) => v.d < 210)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  for (const { q } of near)
    paths.push(
      `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`,
    );
}
const circles = points
  .map(
    (p, i) =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${i % 37 === 0 ? "#ffb873" : p.fold > 0.15 ? "#70dbff" : "#8499f5"}"/>`,
  )
  .join("");
writeFileSync(
  "assets/neural-brain.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="530" viewBox="0 0 640 530"><defs><radialGradient id="halo"><stop stop-color="#7263d4" stop-opacity=".22"/><stop offset="1" stop-color="#4867e8" stop-opacity="0"/></radialGradient></defs><ellipse cx="320" cy="250" rx="320" ry="250" fill="url(#halo)"/><path d="${paths.join("")}" stroke="#83b6f9" stroke-opacity=".29" stroke-width=".6" fill="none"/>${circles}</svg>`,
);
