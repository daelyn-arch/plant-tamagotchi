// Seeded PRNG — Mulberry32
// Deterministic: same seed always produces the same sequence

export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    // [0, 1)
    random() {
      return next();
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    // float in [min, max)
    float(min, max) {
      return next() * (max - min) + min;
    },
    // pick from array
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // weighted pick: items = [{value, weight}, ...]
    weighted(items) {
      const total = items.reduce((s, i) => s + i.weight, 0);
      let r = next() * total;
      for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },
    // boolean with probability p
    chance(p) {
      return next() < p;
    },
    // shuffle array (returns new array)
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}
