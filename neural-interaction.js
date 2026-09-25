/* Neural geometry adapted from Guardiao-Projeto/dist/brain.js. Visual only. */
(() => {
  const control = document.querySelector(".brain-interaction");
  if (!control) return;
  const canvas = control.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
    let z =
      (random() > 0.5 ? 1 : -1) *
      Math.sqrt(Math.max(0.05, 1 - x * x * 0.7 - (y + 0.07) ** 2 * 1.05)) *
      (0.2 + random() * 0.12 + fold * 0.027);
    if (y > 0.5) z *= 0.5;
    return { x, y, z, fold, brightness: 0.35 + random() * 0.65 };
  });
  const anchorTargets = [
    [-0.78, -0.25],
    [-0.52, -0.52],
    [-0.18, -0.58],
    [0.18, -0.52],
    [0.52, -0.33],
    [0.72, -0.05],
    [0.48, 0.22],
    [0.18, 0.1],
    [-0.12, 0.25],
    [-0.47, 0.13],
    [-0.75, 0.04],
    [-0.28, -0.12],
    [0.24, -0.12],
  ];
  const anchors = anchorTargets.map(([x, y]) => {
    let best = 0,
      bestDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        distance = (p.x - x) ** 2 + (p.y - y) ** 2 + p.z ** 2 * 0.18;
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    return best;
  });
  const primaryLinks = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [12, 4],
    [11, 7],
    [2, 11],
    [3, 12],
    [7, 12],
    [8, 11],
  ].map(([a, b]) => [anchors[a], anchors[b]]);
  const links = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      near = [];
    for (let j = i + 1; j < points.length; j++) {
      const q = points[j],
        d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
      if (d < 0.021) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const { j } of near.slice(0, 2)) links.push([i, j]);
  }
  let width = 0,
    height = 0,
    yaw = 0.12,
    pitch = -0.08,
    targetYaw = yaw,
    targetPitch = pitch,
    frame = 0,
    drag = null,
    moved = false;
  const clamp = (n) => Math.max(-0.65, Math.min(0.65, n));
  function draw() {
    const light = document.documentElement.dataset.theme === "light";
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width * 0.43, height * 0.46),
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    const projected = points.map((p) => {
      const x = p.x * c + p.z * s,
        z = -p.x * s + p.z * c,
        y = p.y * Math.cos(pitch) - z * Math.sin(pitch),
        depth = 1 / (1 + (p.y * Math.sin(pitch) + z * Math.cos(pitch)) * 0.2);
      return {
        x: width * 0.5 + x * scale * depth,
        y: height * 0.46 + y * scale * depth,
        depth,
      };
    });
    ctx.strokeStyle = light ? "#4864b866" : "#83b6f944";
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    for (const [a, b] of links) {
      ctx.moveTo(projected[a].x, projected[a].y);
      ctx.lineTo(projected[b].x, projected[b].y);
    }
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < primaryLinks.length; i++) {
      const [a, b] = primaryLinks[i],
        start = projected[a],
        end = projected[b],
        pulse = 0.55 + Math.sin(i * 0.9 + yaw * 1.7) * 0.18,
        depth = Math.min(1, Math.max(0.35, (start.depth + end.depth) * 0.5));
      const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, light ? "#315bd922" : "#6db7ff35");
      gradient.addColorStop(0.5, light ? "#9b6a2ccc" : "#ffd181dd");
      gradient.addColorStop(1, light ? "#1b83b944" : "#7ceaff66");
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = pulse * depth;
      ctx.lineWidth = 1.45 * depth;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.globalAlpha = 0.12 * depth;
      ctx.lineWidth = 5.6 * depth;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < points.length; i++) {
      const p = projected[i],
        n = points[i];
      ctx.fillStyle =
        i % 47 === 0
          ? light
            ? "#a95b19"
            : "#ffc383"
          : n.fold > 0.15
            ? light
              ? "#176caa"
              : "#83e6ff"
            : light
              ? "#485abe"
              : "#87acfb";
      ctx.globalAlpha = Math.min(1, n.brightness * p.depth);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.6 + n.brightness * 0.85) * p.depth, 0, Math.PI * 2);
      ctx.fill();
      if (i % 47 === 0) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * p.depth, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const index of anchors) {
      const p = projected[index];
      ctx.globalAlpha = Math.min(0.92, 0.42 * p.depth);
      ctx.fillStyle = light ? "#c8882e" : "#ffd182";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.8 * p.depth, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(0.52, 0.2 * p.depth);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * p.depth, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function tick() {
    frame = 0;
    yaw += (targetYaw - yaw) * 0.16;
    pitch += (targetPitch - pitch) * 0.16;
    if (Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) < 0.002) {
      yaw = targetYaw;
      pitch = targetPitch;
    } else frame = requestAnimationFrame(tick);
    draw();
  }
  function render() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (reduced.matches || drag) {
      yaw = targetYaw;
      pitch = targetPitch;
      draw();
    } else frame = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    const box = control.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }).observe(control);
  control.addEventListener("click", () => {
    if (moved) {
      moved = false;
      return;
    }
    targetYaw += Math.PI / 3;
    render();
  });
  control.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    moved = false;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      yaw: targetYaw,
      pitch: targetPitch,
    };
    control.setPointerCapture(e.pointerId);
    control.classList.add("is-dragging");
  });
  control.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (!moved) return;
    targetYaw = drag.yaw + dx * 0.012;
    targetPitch = clamp(drag.pitch + dy * 0.006);
    render();
  });
  function end() {
    drag = null;
    control.classList.remove("is-dragging");
  }
  control.addEventListener("pointerup", end);
  control.addEventListener("pointercancel", () => {
    moved = true;
    end();
  });
  control.addEventListener("lostpointercapture", end);
  control.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") moved = false;
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
        e.key,
      )
    )
      return;
    e.preventDefault();
    moved = false;
    if (e.key === "Home") {
      targetYaw = 0.12;
      targetPitch = -0.08;
    } else if (e.key === "ArrowLeft") targetYaw -= 0.3;
    else if (e.key === "ArrowRight") targetYaw += 0.3;
    else
      targetPitch = clamp(targetPitch + (e.key === "ArrowUp" ? -0.15 : 0.15));
    render();
  });
  document.querySelector(".brain-reset").addEventListener("click", () => {
    targetYaw = 0.12;
    targetPitch = -0.08;
    moved = false;
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!document.hidden) render();
  });
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  control.classList.add("is-interactive");
})();
