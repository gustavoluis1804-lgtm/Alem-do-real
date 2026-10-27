import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context = {window:{}};
runInNewContext(readFileSync(new URL('../public/planet-geometry.js',import.meta.url),'utf8'),context);
const {buildPlanet,moonPosition,WATER_RADIUS}=context.window.AlemPlanetGeometry;
const detailed=buildPlanet(1), compact=buildPlanet(.35);

test('planet has terrain volume, modeled vegetation, glass ribbons and orbital satellites',()=>{
  const body=detailed.objects.find(o=>o.name==='terrain');
  const forest=detailed.objects.find(o=>o.name==='forest');
  assert.ok(forest.treeCount>=250);
  assert.equal(detailed.objects.filter(o=>o.name.startsWith('glass-ribbon-')).length,3);
  assert.equal(detailed.objects.filter(o=>o.satellite!==undefined).length,3);
  const radii=[];
  for(let i=0;i<body.positions.length;i+=3)radii.push(Math.hypot(...body.positions.subarray(i,i+3)));
  assert.ok(Math.max(...radii)-Math.min(...radii)>.10,'terrain must have actual relief');
  for(let axis=0;axis<3;axis++){
    const values=Array.from(body.positions).filter((_,i)=>i%3===axis);
    assert.ok(Math.min(...values)<-1&&Math.max(...values)>1,'geometry must span every spatial axis');
  }
});

test('all renderable meshes have valid finite attributes, indices and unit normals',()=>{
  for(const scene of [detailed,compact])for(const o of scene.objects){
    assert.equal(o.positions.length,o.normals.length);
    assert.equal(o.colors.length,o.positions.length);
    assert.ok(o.positions.length/3<65536,'mesh must fit WebGL 16-bit indices');
    for(const buffer of [o.positions,o.normals,o.colors])assert.ok(Array.from(buffer).every(Number.isFinite),o.name);
    for(const index of o.indices)assert.ok(index<o.positions.length/3,o.name);
    if(o.mode==='triangles')for(let i=0;i<o.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...o.normals.subarray(i,i+3))-1)<.001,o.name+' normals');
  }
});

test('software scene retains all modeled parts with a lower polygon budget',()=>{
  assert.equal(compact.objects.length,detailed.objects.length);
  assert.ok(compact.triangles<detailed.triangles*.55);
  assert.ok(compact.triangles>3000,'fallback must remain a volumetric mesh scene');
});

test('satellites travel around the planet at a constant orbital distance',()=>{
  for(let i=0;i<3;i++){
    const start=moonPosition(i,0),later=moonPosition(i,23);
    assert.ok(Math.abs(Math.hypot(...start)-Math.hypot(...later))<.000001);
    assert.ok(Math.hypot(...start.map((x,j)=>x-later[j]))>.2);
  }
});

test('oceans form a closed sea level with land emerging above the surface',()=>{
  const water=detailed.objects.find(o=>o.name==='ocean');
  assert.ok(water&&water.material===5,'water must be a rendered 3D mesh');
  for(let i=0;i<water.positions.length;i+=3)assert.ok(Math.abs(Math.hypot(...water.positions.subarray(i,i+3))-WATER_RADIUS)<.000001);
  const body=detailed.objects.find(o=>o.name==='terrain');
  let submerged=0,land=0;
  for(let i=0;i<body.positions.length;i+=3){if(Math.hypot(...body.positions.subarray(i,i+3))<WATER_RADIUS)submerged++;else land++;}
  assert.ok(submerged>body.positions.length/3*.25,'there must be visible oceans');
  assert.ok(land>body.positions.length/3*.25,'there must be visible continents');
  const forest=detailed.objects.find(o=>o.name==='forest');
  for(let i=0;i<forest.positions.length;i+=3)assert.ok(Math.hypot(...forest.positions.subarray(i,i+3))>WATER_RADIUS,'vegetation stays above sea level');
});
