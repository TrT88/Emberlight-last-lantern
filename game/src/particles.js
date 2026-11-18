// Particles, floating score text and screen shake. All visual feedback for
// hits, deaths and pickups lives here, so world.js stays about the rules.
export function createParticles() {
  const parts = [];
  const texts = [];
  let shake = 0;

  return {
    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        parts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.35 + Math.random() * 0.4,
          maxLife: 0.75,
          size: 2 + Math.random() * 4,
          color,
        });
      }
    },
    trail(x, y, color) {
      parts.push({
        x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, size: 5, color,
      });
    },
    floatText(x, y, text, color) {
      texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
    },
    addShake(amount) {
      shake = Math.min(14, shake + amount);
    },
    get shakeOffset() {
      return {
        x: (Math.random() * 2 - 1) * shake,
        y: (Math.random() * 2 - 1) * shake,
      };
    },
    step(dt) {
      shake = Math.max(0, shake - dt * 30);
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.y -= 42 * dt;
        t.life -= dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px system-ui, sans-serif';
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      parts.length = 0;
      texts.length = 0;
      shake = 0;
    },
  };
}
