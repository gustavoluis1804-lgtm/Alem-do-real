(() => {
'use strict';
/* All geometry is built locally: terrain, treetops, solid glass ribbons and moons. */
const TAU = Math.PI * 2;
const WATER_HEIGHT = .078;
const WATER_RADIUS = 1.015 + WATER_HEIGHT;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map(x => x / length);
}
function hash(x, y, z) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let a = x - ix, b = y - iy, c = z - iz;
  a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); c = c * c * (3 - 2 * c);
  return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), a), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), a), b), mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), a), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), a), b), c);
}
function fbm(x, y, z, octaves = 4) {
  let value = 0, amplitude = .5, total = 0;
  for (let i = 0; i < octaves; i++) { value += noise(x, y, z) * amplitude; total += amplitude; x = x * 2.03 + 17.1; y = y * 2.03 - 9.2; z = z * 2.03 + 4.7; amplitude *= .5; }
  return value / total;
}
function terrainHeight(n) {
  const continent = fbm(n[0] * 2.6 + 8.2, n[1] * 2.6 + 4.8, n[2] * 2.6 - 2.3);
  const ridge = 1 - Math.abs(noise(n[0] * 10 + 3, n[1] * 10, n[2] * 10) * 2 - 1);
  return .012 + Math.pow(Math.max(0, continent - .30) * 1.7, 1.75) * .34 + ridge * .035;
}
function rotationMatrix(x, y, z) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([cy * cz, cx * sz + sx * sy * cz, sx * sz - cx * sy * cz, -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz, sy, -sx * cy, cx * cy]);
}
function rotate(v, m) {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
}
function normalsFor(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const offset of [a, b, c]) { normals[offset] += nx; normals[offset + 1] += ny; normals[offset + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (length > .0000001) { normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length; }
    else { const n = normalize(positions.slice(i, i + 3)); normals.set(n, i); }
  }
  return normals;
}
function mesh(name, positions, indices, colors, material, extra = {}) {
  return { name, positions: new Float32Array(positions), normals: normalsFor(positions, indices), colors: new Float32Array(colors), indices: new Uint16Array(indices), material, mode: 'triangles', ...extra };
}
function colorAt(n, height) {
  const moss = smooth(.24, .52, fbm(n[0] * 6.5, n[1] * 6.5 + 11, n[2] * 6.5)) * (1 - smooth(.14, .25, height));
  const grain = noise(n[0] * 55, n[1] * 55, n[2] * 55);
  const stone = [.38 + grain * .13, .39 + grain * .10, .31 + grain * .09];
  const coast = 1 - smooth(WATER_HEIGHT + .002, WATER_HEIGHT + .020, height);
  return stone.map((c, i) => mix(mix(c, [.18, .29, .045][i] * (.7 + grain * .6), moss), [.48, .52, .29][i], coast * .72));
}
function ocean(detail) {
  const latitudes = Math.round(56 * Math.max(.56, detail)), longitudes = latitudes * 2;
  const positions = [], indices = [], colors = [];
  for (let y = 0; y <= latitudes; y++) for (let x = 0; x <= longitudes; x++) {
    const a = y / latitudes * Math.PI, b = x / longitudes * TAU;
    const n = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
    const shallow = 1 - smooth(.002, .052, WATER_HEIGHT - terrainHeight(n));
    positions.push(...n.map(c => c * WATER_RADIUS));
    colors.push(...[.018, .17, .26].map((c, i) => mix(c, [.045, .47, .48][i], shallow)));
  }
  for (let y = 0; y < latitudes; y++) for (let x = 0; x < longitudes; x++) {
    const a = y * (longitudes + 1) + x, b = a + longitudes + 1;
    if (y > 0) indices.push(a, a + 1, b);
    if (y < latitudes - 1) indices.push(a + 1, b + 1, b);
  }
  const result = mesh('ocean', positions, indices, colors, 5, { seaLevel: WATER_RADIUS });
  for (let i = 0; i < positions.length; i += 3) result.normals.set(normalize(positions.slice(i, i + 3)), i);
  return result;
}
function terrain(detail) {
  const latitudes = Math.round(64 * detail), longitudes = latitudes * 2;
  const positions = [], indices = [], colors = [];
  for (let y = 0; y <= latitudes; y++) for (let x = 0; x <= longitudes; x++) {
    const a = y / latitudes * Math.PI, b = x / longitudes * TAU;
    const n = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
    const h = terrainHeight(n), radius = 1.015 + h;
    positions.push(...n.map(c => c * radius)); colors.push(...colorAt(n, h));
  }
  for (let y = 0; y < latitudes; y++) for (let x = 0; x < longitudes; x++) {
    const a = y * (longitudes + 1) + x, b = a + longitudes + 1;
    if (y > 0) indices.push(a, a + 1, b);
    if (y < latitudes - 1) indices.push(a + 1, b + 1, b);
  }
  const result = mesh('terrain', positions, indices, colors, 0);
  // Join the UV seam normals while keeping the indexed terrain closed.
  for (let y = 0; y <= latitudes; y++) {
    const a = y * (longitudes + 1) * 3, b = (y * (longitudes + 1) + longitudes) * 3;
    const n = normalize([result.normals[a] + result.normals[b], result.normals[a + 1] + result.normals[b + 1], result.normals[a + 2] + result.normals[b + 2]]);
    result.normals.set(n, a); result.normals.set(n, b);
  }
  return result;
}
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_POINTS = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(normalize);
const ICO_FACES = [0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1];
function addCrown(positions, indices, colors, origin, direction, width, height, tint) {
  const helper = Math.abs(direction[1]) > .95 ? [1, 0, 0] : [0, 1, 0];
  const tangent = normalize([direction[1] * helper[2] - direction[2] * helper[1], direction[2] * helper[0] - direction[0] * helper[2], direction[0] * helper[1] - direction[1] * helper[0]]);
  const cross = [tangent[1] * direction[2] - tangent[2] * direction[1], tangent[2] * direction[0] - tangent[0] * direction[2], tangent[0] * direction[1] - tangent[1] * direction[0]];
  const offset = positions.length / 3;
  for (let i = 0; i < ICO_POINTS.length; i++) {
    const p = ICO_POINTS[i];
    for (let j = 0; j < 3; j++) positions.push(origin[j] + tangent[j] * p[0] * width + direction[j] * p[1] * height + cross[j] * p[2] * width);
    colors.push(...tint.map(c => c * (.85 + (i % 4) * .09)));
  }
  indices.push(...ICO_FACES.map(i => i + offset));
}
function forest(detail) {
  const positions = [], indices = [], colors = [];
  const count = Math.round(200 + 1100 * detail), candidates = count * 5;
  let planted = 0;
  for (let i = 0; i < candidates && planted < count; i++) {
    const sample = (i * 541) % candidates;
    const y = 1 - 2 * (sample + .5) / candidates, a = sample * 2.399963229728653;
    const direction = [Math.sqrt(1 - y * y) * Math.cos(a), y, Math.sqrt(1 - y * y) * Math.sin(a)];
    const h = terrainHeight(direction), density = fbm(direction[0] * 6.5, direction[1] * 6.5 + 11, direction[2] * 6.5);
    if (density < .45 || h > .19 || h < WATER_HEIGHT + .025) continue;
    const random = hash(i, 6, 29), radius = 1.015 + h;
    const height = .014 + random * .021, width = .017 + hash(i, 2, 11) * .023;
    const origin = direction.map(n => n * (radius + height * .40));
    const tint = [.08 + random * .07, .16 + random * .14, .018 + random * .035];
    addCrown(positions, indices, colors, origin, direction, width, height, tint);
    if(random>.82) addCrown(positions, indices, colors, direction.map(n => n * (radius + height * 1.05)), direction, width * .6, height * .6, tint.map(c => c * 1.12));
    planted++;
  }
  return mesh('forest', positions, indices, colors, 0, { treeCount: planted });
}
function ribbonPoint(a, v, phase, orientation, vein = false) {
  const latitude = .19 * Math.sin(a * 2 + phase) + .13 * Math.sin(a * 3 + phase * .4);
  const width = .16 + .08 * Math.sin(a * 3 + phase);
  const b = latitude + Math.cos(v) * width;
  const radius = 1.245 + Math.sin(v) * .070 + .024 * Math.sin(a * 3 + phase) + (vein ? .004 : 0);
  return rotate([Math.cos(b) * Math.cos(a) * radius, Math.sin(b) * radius, Math.cos(b) * Math.sin(a) * radius], orientation);
}
function ribbon(index, detail) {
  const orientations = [[.4, .15, -.28], [1.48, .55, .62], [-.86, 1.13, -.27]];
  const matrix = rotationMatrix(...orientations[index]), phase = index * 1.7 + .4;
  const sections = Math.round(144 * detail), sides = detail < .6 ? 8 : 16;
  const positions = [], indices = [], colors = [];
  for (let i = 0; i <= sections; i++) for (let j = 0; j <= sides; j++) {
    positions.push(...ribbonPoint(i / sections * TAU, j / sides * TAU, phase, matrix));
    colors.push(.78, .83, .65);
  }
  for (let i = 0; i < sections; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return mesh('glass-ribbon-' + index, positions, indices, colors, 1);
}
function vein(index, detail) {
  const matrix = rotationMatrix(...[[.4, .15, -.28], [1.48, .55, .62], [-.86, 1.13, -.27]][index]);
  const positions = [], indices = [], colors = [], segments = Math.round(144 * detail);
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * TAU;
    const center = ribbonPoint(a, .21, index * 1.7 + .4, matrix, true);
    const next = ribbonPoint(a + .001, .21, index * 1.7 + .4, matrix, true);
    const tangent = normalize(next.map((c, j) => c - center[j]));
    const normal = normalize(center), cross = normalize([tangent[1] * normal[2] - tangent[2] * normal[1], tangent[2] * normal[0] - tangent[0] * normal[2], tangent[0] * normal[1] - tangent[1] * normal[0]]);
    for (let j = 0; j <= 5; j++) {
      const angle = j / 5 * TAU;
      positions.push(...center.map((c, k) => c + (normal[k] * Math.cos(angle) + cross[k] * Math.sin(angle)) * .0055));
      colors.push(.73, .91, .09);
    }
    if (i < segments) for (let j = 0; j < 5; j++) { const a = i * 6 + j, b = a + 6; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  return mesh('luminous-vein-' + index, positions, indices, colors, 4);
}
function orbit(index, detail) {
  const positions = [], indices = [], colors = [], segments = Math.round(180 * detail);
  const orientation = rotationMatrix(...[[.83, .13, .1], [-.58, .44, -.43], [1.17, -.75, .6]][index]);
  const radius = 1.45 + index * .035;
  for (let i = 0; i < segments; i++) { positions.push(...rotate([Math.cos(i / segments * TAU) * radius, 0, Math.sin(i / segments * TAU) * radius], orientation)); colors.push(...(index ? [.62, .67, .52] : [.62, .76, .12])); indices.push(i, (i + 1) % segments); }
  return { name: 'orbit-' + index, positions: new Float32Array(positions), normals: new Float32Array(positions.length), indices: new Uint16Array(indices), colors: new Float32Array(colors), material: 3, mode: 'lines' };
}
function moon(index, detail) {
  const segments = detail < .6 ? 10 : 22, rings = detail < .6 ? 7 : 14;
  const radius = [.064, .045, .078][index], positions = [], indices = [], colors = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segments; j++) { const a = i / rings * Math.PI, b = j / segments * TAU; positions.push(Math.sin(a) * Math.cos(b) * radius, Math.cos(a) * radius, Math.sin(a) * Math.sin(b) * radius); colors.push(.79, .83, .67); }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segments; j++) { const a = i * (segments + 1) + j, b = a + segments + 1; if (i) indices.push(a, a + 1, b); if (i < rings - 1) indices.push(a + 1, b + 1, b); }
  return mesh('moon-' + index, positions, indices, colors, 2, { satellite: index });
}
function moonPosition(index, time) {
  const matrix = rotationMatrix(...[[.83, .13, .1], [-.58, .44, -.43], [1.17, -.75, .6]][index]);
  const angle = [.62, 3.46, 5.1][index] + time * [.07, -.055, .045][index];
  const radius = 1.45 + index * .035;
  return rotate([Math.cos(angle) * radius, 0, Math.sin(angle) * radius], matrix);
}
function buildPlanet(detail = 1) {
  detail = clamp(detail, .35, 1);
  const objects = [terrain(Math.max(.56, detail)), ocean(detail), forest(detail)];
  for (let i = 0; i < 3; i++) objects.push(ribbon(i, detail), vein(i, detail), orbit(i, detail), moon(i, detail));
  return { objects, triangles: objects.reduce((count, o) => count + (o.mode === 'triangles' ? o.indices.length / 3 : 0), 0), vertices: objects.reduce((count, o) => count + o.positions.length / 3, 0) };
}

window.AlemPlanetGeometry = Object.freeze({buildPlanet, terrainHeight, rotationMatrix, rotate, normalize, moonPosition, clamp, WATER_HEIGHT, WATER_RADIUS});
})();
