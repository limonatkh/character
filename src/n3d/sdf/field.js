/* =====================================================================
 * SIGNED DISTANCE FIELD — the shape language of the Normal 3D mode.
 *
 * A shape is an ordered list of LAYERS; each layer is a set of smooth
 * primitives combined with the running distance:
 *   union     d = smin(d, prim, k)      (organic blending, k = blend size)
 *   subtract  d = smax(d, -prim, k)     (sockets, nostrils, grooves)
 *   intersect d = smax(d, prim, k)
 * Primitives carry a `bone` (for skin weights) and a `tag` (for regions:
 * lips, nails, scalp…). Everything is in metres, rest pose, −Z = front.
 *
 * Speed: a uniform acceleration grid lists, per cell, the primitives whose
 * (blend-expanded) bounds touch it, so each evaluation only looks at a
 * handful of primitives. Pure JS, no Three.js: runs in Node and workers.
 * ===================================================================== */

export const SPHERE = 0, ELLIPSOID = 1, ROUNDCONE = 2, ROUNDBOX = 3, TORUS = 4, CAPSULE_FLAT = 5, CUSTOM = 6;
export const UNION = 0, SUBTRACT = 1, INTERSECT = 2;

const BIG = 1e9;

/** Smooth minimum (cubic, C2): blends two distances over a band of size k. */
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k * (1 / 6);
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

/**
 * One primitive. Every primitive has the same fields (fast, monomorphic).
 * c* = centre / start point, e* = end point, r1/r2 = radii,
 * rx/ry/rz = radii or half extents, m = 3×3 rotation (columns = local axes in world).
 */
export class Prim {
  constructor(type) {
    this.type = type;
    this.k = 0; this.bone = 0; this.tag = 0; this.id = -1;
    this.cx = 0; this.cy = 0; this.cz = 0;
    this.ex = 0; this.ey = 0; this.ez = 0;
    this.r1 = 0; this.r2 = 0;
    this.rx = 0; this.ry = 0; this.rz = 0; this.round = 0;
    this.sx = 1; this.sz = 1;
    this.m00 = 1; this.m01 = 0; this.m02 = 0;
    this.m10 = 0; this.m11 = 1; this.m12 = 0;
    this.m20 = 0; this.m21 = 0; this.m22 = 1;
    // derived (round cone)
    this.bax = 0; this.bay = 0; this.baz = 0; this.l2 = 0; this.rr = 0; this.a2 = 0; this.il2 = 0;
    // bounding sphere (cheap lower bound of the distance)
    this.bsx = 0; this.bsy = 0; this.bsz = 0; this.bsr = 0;
    // bounds
    this.minX = 0; this.minY = 0; this.minZ = 0; this.maxX = 0; this.maxY = 0; this.maxZ = 0;
  }
}

/* ---------------------------------------------------------------- rotations */
/** Rotation matrix from a local "up" axis (local +Y maps to `up`) and a hint for local +Z. */
export function frameFromY(up, zHint = [0, 0, -1]) {
  const [ux, uy, uz] = norm(up);
  let [zx, zy, zz] = zHint;
  // make z perpendicular to up
  const d = zx * ux + zy * uy + zz * uz;
  zx -= d * ux; zy -= d * uy; zz -= d * uz;
  let l = Math.hypot(zx, zy, zz);
  if (l < 1e-6) { [zx, zy, zz] = Math.abs(ux) < 0.9 ? [1, 0, 0] : [0, 0, 1]; const d2 = zx * ux + zy * uy + zz * uz; zx -= d2 * ux; zy -= d2 * uy; zz -= d2 * uz; l = Math.hypot(zx, zy, zz); }
  zx /= l; zy /= l; zz /= l;
  // x = y × z
  const xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  return [xx, ux, zx, xy, uy, zy, xz, uz, zz];   // row-major m[r][c]: columns are x, y, z axes
}
/** Rotation matrix from Euler angles (radians, order XYZ applied as Rz·Ry·Rx). */
export function frameFromEuler(rx = 0, ry = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
}
export function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function setM(p, m) {
  if (!m) return;
  [p.m00, p.m01, p.m02, p.m10, p.m11, p.m12, p.m20, p.m21, p.m22] = m;
}

/* ---------------------------------------------------------------- constructors */
export function sphere(c, r, o = {}) {
  const p = new Prim(SPHERE);
  [p.cx, p.cy, p.cz] = c; p.r1 = r;
  return finish(p, o);
}
/** Ellipsoid with radii [rx, ry, rz] in its local frame (m). */
export function ellipsoid(c, radii, o = {}) {
  const p = new Prim(ELLIPSOID);
  [p.cx, p.cy, p.cz] = c; [p.rx, p.ry, p.rz] = radii;
  setM(p, o.m);
  return finish(p, o);
}
/**
 * Tapered capsule from a (radius r1) to b (radius r2). With o.flat = [sx, sz]
 * the cross-section becomes elliptical (sx across, sz front-back in the frame
 * given by o.zHint), e.g. a forearm or a thigh.
 */
export function roundCone(a, b, r1, r2, o = {}) {
  const flat = o.flat && (o.flat[0] !== 1 || o.flat[1] !== 1);
  const p = new Prim(flat ? CAPSULE_FLAT : ROUNDCONE);
  [p.cx, p.cy, p.cz] = a; [p.ex, p.ey, p.ez] = b; p.r1 = r1; p.r2 = r2;
  if (flat) {
    [p.sx, p.sz] = o.flat;
    const axis = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    setM(p, frameFromY(axis, o.zHint || [0, 0, -1]));
    const L = Math.hypot(...axis);
    // round cone along local y from 0 to L
    p.bax = 0; p.bay = L; p.baz = 0;
  } else {
    p.bax = b[0] - a[0]; p.bay = b[1] - a[1]; p.baz = b[2] - a[2];
  }
  p.l2 = p.bax * p.bax + p.bay * p.bay + p.baz * p.baz || 1e-12;
  p.rr = r1 - r2;
  p.a2 = p.l2 - p.rr * p.rr;
  p.il2 = 1 / p.l2;
  return finish(p, o);
}
/** Rounded box: half extents [hx, hy, hz], corner radius `round`. */
export function roundBox(c, half, round, o = {}) {
  const p = new Prim(ROUNDBOX);
  [p.cx, p.cy, p.cz] = c; [p.rx, p.ry, p.rz] = half; p.round = round;
  setM(p, o.m);
  return finish(p, o);
}
/** Torus around local Y: major radius R, tube radius r. */
export function torus(c, R, r, o = {}) {
  const p = new Prim(TORUS);
  [p.cx, p.cy, p.cz] = c; p.r1 = R; p.r2 = r;
  setM(p, o.m);
  return finish(p, o);
}

/**
 * Custom primitive: any distance function (must be ~1-Lipschitz) with an
 * explicit bounding box [minX, minY, minZ, maxX, maxY, maxZ].
 */
export function custom(fn, box, o = {}) {
  const p = new Prim(CUSTOM);
  p.fn = fn;
  p.k = o.k ?? 0; p.bone = o.bone ?? 0; p.tag = o.tag ?? 0;
  setBox(p, ...box);
  return p;
}

function finish(p, o) {
  p.k = o.k ?? 0;
  p.bone = o.bone ?? 0;
  p.tag = o.tag ?? 0;
  computeBounds(p);
  return p;
}

function computeBounds(p) {
  let r;
  switch (p.type) {
    case SPHERE: r = p.r1; setBox(p, p.cx - r, p.cy - r, p.cz - r, p.cx + r, p.cy + r, p.cz + r); break;
    case ELLIPSOID: r = Math.max(p.rx, p.ry, p.rz); setBox(p, p.cx - r, p.cy - r, p.cz - r, p.cx + r, p.cy + r, p.cz + r); break;
    case ROUNDCONE: case CAPSULE_FLAT: {
      const s = p.type === CAPSULE_FLAT ? Math.max(p.sx, p.sz, 1) : 1;
      const ra = p.r1 * s, rb = p.r2 * s;
      setBox(p, Math.min(p.cx - ra, p.ex - rb), Math.min(p.cy - ra, p.ey - rb), Math.min(p.cz - ra, p.ez - rb),
        Math.max(p.cx + ra, p.ex + rb), Math.max(p.cy + ra, p.ey + rb), Math.max(p.cz + ra, p.ez + rb));
      break;
    }
    case ROUNDBOX: r = Math.hypot(p.rx, p.ry, p.rz); setBox(p, p.cx - r, p.cy - r, p.cz - r, p.cx + r, p.cy + r, p.cz + r); break;
    case TORUS: r = p.r1 + p.r2; setBox(p, p.cx - r, p.cy - r, p.cz - r, p.cx + r, p.cy + r, p.cz + r); break;
  }
}
function setBox(p, a, b, c, d, e, f) {
  p.minX = a; p.minY = b; p.minZ = c; p.maxX = d; p.maxY = e; p.maxZ = f;
  p.bsx = (a + d) / 2; p.bsy = (b + e) / 2; p.bsz = (c + f) / 2;
  p.bsr = Math.hypot(d - a, e - b, f - c) / 2;
}

/* ---------------------------------------------------------------- distance of one primitive */
export function primDist(p, x, y, z) {
  switch (p.type) {
    case SPHERE: return Math.hypot(x - p.cx, y - p.cy, z - p.cz) - p.r1;
    case ELLIPSOID: {
      const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
      const qx = (dx * p.m00 + dy * p.m10 + dz * p.m20) / p.rx;
      const qy = (dx * p.m01 + dy * p.m11 + dz * p.m21) / p.ry;
      const qz = (dx * p.m02 + dy * p.m12 + dz * p.m22) / p.rz;
      const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      const k1 = Math.sqrt(qx * qx / (p.rx * p.rx) + qy * qy / (p.ry * p.ry) + qz * qz / (p.rz * p.rz));
      if (k1 < 1e-9) return -Math.min(p.rx, p.ry, p.rz);
      return k0 * (k0 - 1) / k1;
    }
    case ROUNDCONE: return roundConeDist(p, x - p.cx, y - p.cy, z - p.cz, p.bax, p.bay, p.baz);
    case CAPSULE_FLAT: {
      const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
      const qx = (dx * p.m00 + dy * p.m10 + dz * p.m20) / p.sx;
      const qy = dx * p.m01 + dy * p.m11 + dz * p.m21;
      const qz = (dx * p.m02 + dy * p.m12 + dz * p.m22) / p.sz;
      return roundConeDist(p, qx, qy, qz, 0, p.bay, 0) * Math.min(p.sx, p.sz);
    }
    case ROUNDBOX: {
      const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
      const qx = Math.abs(dx * p.m00 + dy * p.m10 + dz * p.m20) - p.rx + p.round;
      const qy = Math.abs(dx * p.m01 + dy * p.m11 + dz * p.m21) - p.ry + p.round;
      const qz = Math.abs(dx * p.m02 + dy * p.m12 + dz * p.m22) - p.rz + p.round;
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - p.round;
    }
    case TORUS: {
      const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
      const qx = dx * p.m00 + dy * p.m10 + dz * p.m20;
      const qy = dx * p.m01 + dy * p.m11 + dz * p.m21;
      const qz = dx * p.m02 + dy * p.m12 + dz * p.m22;
      const a = Math.sqrt(qx * qx + qz * qz) - p.r1;
      return Math.sqrt(a * a + qy * qy) - p.r2;
    }
    case CUSTOM: return p.fn(x, y, z);
  }
  return BIG;
}

/** Inigo Quilez's exact round cone, p relative to a, segment vector ba. */
function roundConeDist(p, pax, pay, paz, bax, bay, baz) {
  const l2 = p.l2, rr = p.rr, a2 = p.a2, il2 = p.il2;
  const yv = pax * bax + pay * bay + paz * baz;
  const z = yv - l2;
  const ex = pax * l2 - bax * yv, ey = pay * l2 - bay * yv, ez = paz * l2 - baz * yv;
  const x2 = ex * ex + ey * ey + ez * ez;
  const y2 = yv * yv * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.r2;
  if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.r1;
  return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - p.r1;
}

/* ---------------------------------------------------------------- the field */
export class Field {
  /**
   * @param layers [{ op: UNION|SUBTRACT|INTERSECT, prims: [Prim] }] evaluated in order
   * @param opts   { cell: grid cell size (m), margin: extra bound (m) }
   */
  constructor(layers, opts = {}) {
    this.layers = layers.filter(l => l.prims.length);
    this.cell = opts.cell || 0.035;
    this.margin = opts.margin ?? 0.03;
    this.post = opts.post || null;          // optional (x, y, z, d) => d  (displacement, Lipschitz ≤ ~1.2)
    this.prims = [];
    for (const l of this.layers) for (const p of l.prims) { p.id = this.prims.length; this.prims.push(p); }
    this.buildGrid();
  }

  buildGrid() {
    const m = this.margin;
    let x0 = BIG, y0 = BIG, z0 = BIG, x1 = -BIG, y1 = -BIG, z1 = -BIG;
    for (const p of this.prims) {
      const e = p.k + m;
      x0 = Math.min(x0, p.minX - e); y0 = Math.min(y0, p.minY - e); z0 = Math.min(z0, p.minZ - e);
      x1 = Math.max(x1, p.maxX + e); y1 = Math.max(y1, p.maxY + e); z1 = Math.max(z1, p.maxZ + e);
    }
    if (!this.prims.length) { x0 = y0 = z0 = -0.1; x1 = y1 = z1 = 0.1; }
    const c = this.cell;
    this.gx0 = x0; this.gy0 = y0; this.gz0 = z0;
    this.nx = Math.max(1, Math.ceil((x1 - x0) / c)); this.ny = Math.max(1, Math.ceil((y1 - y0) / c)); this.nz = Math.max(1, Math.ceil((z1 - z0) / c));
    this.bounds = { min: [x0, y0, z0], max: [x0 + this.nx * c, y0 + this.ny * c, z0 + this.nz * c] };
    const n = this.nx * this.ny * this.nz;
    for (const L of this.layers) {
      L.lists = new Array(n);
      L.bound = new Float32Array(n).fill(BIG);
      for (let i = 0; i < n; i++) L.lists[i] = [];
      for (const p of L.prims) {
        const e = p.k + m;
        const ix0 = this.ci(p.minX - e, this.gx0, this.nx), ix1 = this.ci(p.maxX + e, this.gx0, this.nx);
        const iy0 = this.ci(p.minY - e, this.gy0, this.ny), iy1 = this.ci(p.maxY + e, this.gy0, this.ny);
        const iz0 = this.ci(p.minZ - e, this.gz0, this.nz), iz1 = this.ci(p.maxZ + e, this.gz0, this.nz);
        for (let iz = iz0; iz <= iz1; iz++) for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) L.lists[(iz * this.ny + iy) * this.nx + ix].push(p);
      }
      if (L.op === UNION) {
        // Lower bound of the distance to the primitives NOT listed in a cell, computed
        // lazily on first use (most cells are never evaluated). Uses the tighter of the
        // bounding-box and bounding-sphere distances, so the field stays a true distance
        // bound far from the surface (garment offsets and projections rely on it).
        L.bound.fill(NaN);
        const np = L.prims.length;
        L.bb = new Float64Array(np * 10);
        L.prims.forEach((p, i) => { L.bb.set([p.minX, p.minY, p.minZ, p.maxX, p.maxY, p.maxZ, p.bsx, p.bsy, p.bsz, p.bsr], i * 10); });
        L.stamp = new Int32Array(np).fill(-1);
        L.local = new Map(L.prims.map((p, i) => [p, i]));
      }
    }
  }

  computeBound(L, idx) {
    const c = this.cell, nx = this.nx, ny = this.ny;
    const ix = idx % nx, iy = ((idx / nx) | 0) % ny, iz = (idx / (nx * ny)) | 0;
    for (const p of L.lists[idx]) L.stamp[L.local.get(p)] = idx;
    const x0 = this.gx0 + ix * c, y0 = this.gy0 + iy * c, z0 = this.gz0 + iz * c, x1 = x0 + c, y1 = y0 + c, z1 = z0 + c;
    const bb = L.bb, np = L.prims.length;
    let best = BIG;
    for (let i = 0; i < np; i++) {
      if (L.stamp[i] === idx) continue;
      const o = i * 10;
      const dx = Math.max(bb[o] - x1, x0 - bb[o + 3], 0);
      const dy = Math.max(bb[o + 1] - y1, y0 - bb[o + 4], 0);
      const dz = Math.max(bb[o + 2] - z1, z0 - bb[o + 5], 0);
      let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // sphere: distance from the cell box to the sphere centre, minus its radius
      const sx = Math.max(x0 - bb[o + 6], bb[o + 6] - x1, 0), sy = Math.max(y0 - bb[o + 7], bb[o + 7] - y1, 0), sz = Math.max(z0 - bb[o + 8], bb[o + 8] - z1, 0);
      const ds = Math.sqrt(sx * sx + sy * sy + sz * sz) - bb[o + 9];
      if (ds > d) d = ds;
      if (d < best) best = d;
    }
    return best;
  }

  ci(v, o, n) { const i = Math.floor((v - o) / this.cell); return i < 0 ? 0 : i >= n ? n - 1 : i; }

  /** Signed distance at (x, y, z). Negative inside. */
  eval(x, y, z) {
    const c = this.cell;
    const fx = (x - this.gx0) / c, fy = (y - this.gy0) / c, fz = (z - this.gz0) / c;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= this.nx || fy >= this.ny || fz >= this.nz) {
      const b = this.bounds;
      const dx = Math.max(b.min[0] - x, x - b.max[0], 0), dy = Math.max(b.min[1] - y, y - b.max[1], 0), dz = Math.max(b.min[2] - z, z - b.max[2], 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz) + this.margin;
    }
    const idx = ((fz | 0) * this.ny + (fy | 0)) * this.nx + (fx | 0);
    let d = BIG;
    for (let li = 0; li < this.layers.length; li++) {
      const L = this.layers[li], list = L.lists[idx];
      if (L.op === UNION) {
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          // skip primitives that cannot change the result (bounding-sphere lower bound)
          const bx = x - p.bsx, by = y - p.bsy, bz = z - p.bsz;
          const lb = Math.sqrt(bx * bx + by * by + bz * bz) - p.bsr;
          if (lb >= d + p.k) continue;
          d = smin(d, primDist(p, x, y, z), p.k);
        }
        let b = L.bound[idx];
        if (b !== b) b = L.bound[idx] = this.computeBound(L, idx);
        if (b < d) d = b;
      } else if (L.op === SUBTRACT) {
        for (let i = 0; i < list.length; i++) { const p = list[i]; d = smax(d, -primDist(p, x, y, z), p.k); }
      } else {
        if (!list.length) { d = Math.max(d, this.margin); continue; }
        let e = BIG;
        for (let i = 0; i < list.length; i++) { const p = list[i]; e = Math.min(e, primDist(p, x, y, z)); }
        d = smax(d, e, list[0].k);
      }
    }
    return this.post ? this.post(x, y, z, d) : d;
  }

  /** Primitives near (x, y, z) in every union layer (for weights / region tags). */
  nearPrims(x, y, z) {
    const c = this.cell;
    const ix = this.ci(x, this.gx0, this.nx), iy = this.ci(y, this.gy0, this.ny), iz = this.ci(z, this.gz0, this.nz);
    const idx = (iz * this.ny + iy) * this.nx + ix;
    const out = [];
    for (const L of this.layers) if (L.op === UNION) for (const p of L.lists[idx]) out.push(p);
    return out;
  }
}

/** Gradient by the tetrahedron technique (4 evaluations). Writes into out[3] (unnormalised). */
export function gradient(f, x, y, z, h, out) {
  const a = f.eval(x + h, y - h, z - h), b = f.eval(x - h, y - h, z + h), c = f.eval(x - h, y + h, z - h), d = f.eval(x + h, y + h, z + h);
  out[0] = a - b - c + d; out[1] = -a - b + c + d; out[2] = -a + b - c + d;
  const s = 1 / (4 * h);
  out[0] *= s; out[1] *= s; out[2] *= s;
  return out;
}

/** Combine several fields: min (union) of their distances, without blending. */
export class UnionField {
  constructor(fields) { this.fields = fields.filter(Boolean); }
  eval(x, y, z) { let d = BIG; for (const f of this.fields) { const v = f.eval(x, y, z); if (v < d) d = v; } return d; }
}

/** Generic field from a function. */
export class FnField {
  constructor(fn, bounds) { this.fn = fn; this.bounds = bounds; }
  eval(x, y, z) { return this.fn(x, y, z); }
}
