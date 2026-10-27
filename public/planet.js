/* A real, procedural 3D scene. The software renderer projects the same meshes. */
(() => {
  'use strict';
  const { buildPlanet, rotationMatrix, rotate, normalize, moonPosition, clamp } = window.AlemPlanetGeometry;
  let canvas = document.getElementById('perception-planet');
  const scene = document.getElementById('hero-scene');
  const hero = document.getElementById('inicio');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const LIGHT = normalize([-.65, .9, 1.4]);
  const CAMERA = 4.8, FOCAL = 2.55;
  let renderer, frame = 0, last = 0, time = 0, count = 0, visible = true;
  let targetX = -.23, targetY = .32, currentX = targetX, currentY = targetY;
  let drag = null, velocity = 0, manual = false;
  const automatic = () => !reduced.matches && !document.body.classList.contains('motion-paused');
  const themeIsLight = () => document.documentElement.getAttribute('data-theme') === 'light';

  function createWebGLRenderer(target) {
    const gl = target.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
    if (!gl) return null;
    const vertexSource = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
      uniform mat3 uRotation; uniform vec3 uOffset; uniform float uAspect;
      varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec3 vColor;
      void main(){vec3 p=uRotation*(aPosition+uOffset);vWorld=p;vLocal=aPosition+uOffset;
        vNormal=uRotation*aNormal;vColor=aColor;vec3 view=p-vec3(0.,0.,4.8);
        gl_Position=vec4(view.x*2.55/uAspect,view.y*2.55,-1.002*view.z-.2002,-view.z);}`;
    const fragmentSource = `precision highp float;
      uniform mat3 uRotation; uniform float uMaterial; uniform float uLightTheme; uniform float uTime;
      varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec3 vColor;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x),mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
        mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.)),f.x),f.y),f.z);}
      float fbm(vec3 p){float f=0.;f+=noise(p)*.57;p=p*2.03+4.7;f+=noise(p)*.28;p=p*2.03+8.9;f+=noise(p)*.15;return f;}
      vec3 environment(vec3 r){
        vec3 base=mix(vec3(.16,.22,.12),vec3(.82,.87,.71),smoothstep(-.4,.65,r.y));
        float windowA=pow(max(dot(r,normalize(vec3(-.6,.8,1.))),0.),28.);
        float windowB=pow(max(dot(r,normalize(vec3(.9,.25,-.45))),0.),50.);
        float windowC=pow(max(dot(r,normalize(vec3(.12,.16,1.))),0.),30.);
        float strip=exp(-pow((r.x+r.y*.45-.18)*10.,2.))*smoothstep(-.1,.65,r.y);
        return base+vec3(1.5,1.55,1.35)*windowA+vec3(.8,.95,.5)*windowB+vec3(1.6)*windowC+vec3(1.05)*strip;}
      void main(){
        if(uMaterial>2.5&&uMaterial<3.5){vec3 line=mix(vColor*.85,vColor*.65,uLightTheme);gl_FragColor=vec4(line*.58,.58);return;}
        vec3 n=normalize(vNormal),eye=normalize(vec3(0.,0.,4.8)-vWorld),light=normalize(vec3(-.65,.9,1.4));
        if(!gl_FrontFacing)n=-n;
        float facing=abs(dot(n,eye));float fresnel=pow(1.-facing,3.);vec3 c;float alpha=1.;
        if(uMaterial>4.5){
          vec3 wave=vec3(sin(vLocal.z*56.+uTime*.7),cos(vLocal.x*48.-uTime*.55),sin(vLocal.y*61.+uTime*.45));
          n=normalize(n+uRotation*wave*.035);
          float diffuse=max(dot(n,light),0.);float spec=pow(max(dot(n,normalize(light+eye)),0.),130.);
          vec3 reflection=environment(reflect(-eye,n));
          c=mix(vColor*(.46+diffuse*.66),reflection,.14+fresnel*.57);
          c+=vec3(.95,1.15,1.05)*spec*.9;
        }else if(uMaterial<.5){
          vec3 grain=vec3(noise(vLocal*82.),noise(vLocal*82.+12.5),noise(vLocal*82.-7.3))-.5;
          n=normalize(n+uRotation*grain*.17);
          float diffuse=max(dot(n,light),0.);float detail=fbm(vLocal*36.);
          float cavity=smoothstep(.18,.75,detail);vec3 base=vColor*(.75+detail*.45);
          c=base*(.28+diffuse*.95)*(.77+cavity*.23);
          c+=vec3(.76,.83,.51)*pow(max(dot(n,normalize(light+eye)),0.),36.)*.055;
          c+=vec3(.24,.30,.12)*fresnel*.18;
        }else if(uMaterial<1.5){
          vec3 reflection=environment(reflect(-eye,n));vec3 ray=refract(-eye,n,.74);
          float b=dot(vWorld,ray),disc=b*b-dot(vWorld,vWorld)+1.15*1.15;
          vec3 hit=vWorld+ray*max(0.,-b-sqrt(max(0.,disc)));
          vec3 local=vec3(dot(uRotation[0],hit),dot(uRotation[1],hit),dot(uRotation[2],hit));
          float moss=fbm(local*8.);vec3 refraction=mix(vec3(.39,.42,.29),vec3(.12,.25,.025),smoothstep(.34,.67,moss));
          c=mix(refraction*.75,reflection,.52+fresnel*.43);
          float spec=pow(max(dot(n,normalize(light+eye)),0.),72.);
          c+=vec3(1.2,1.25,1.05)*spec;
          alpha=clamp(.20+fresnel*.75+spec*.45,.20,.96);
        }else if(uMaterial<2.5){
          c=environment(reflect(-eye,n))*(.72+fresnel*.3);c+=vec3(.9)*pow(max(dot(n,normalize(light+eye)),0.),100.);
        }else{c=vColor*(.72+max(dot(n,light),0.)*.38)+vec3(.12,.16,.005);}
        c=max(c,vec3(0.));c=c/(c+vec3(.60));c=pow(c,vec3(.7));
        gl_FragColor=vec4(c*alpha,alpha);
      }`;
    function compile(type, source) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Planet shader unavailable');
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Planet program unavailable');
    gl.useProgram(program);
    const attrs = ['aPosition', 'aNormal', 'aColor'].map(name => gl.getAttribLocation(program, name));
    const uniforms = Object.fromEntries(['uRotation', 'uOffset', 'uAspect', 'uMaterial', 'uLightTheme', 'uTime'].map(name => [name, gl.getUniformLocation(program, name)]));
    const model = buildPlanet(matchMedia('(max-width: 760px)').matches ? .72 : 1);
    const objects = model.objects.map(object => {
      const vertices = new Float32Array(object.positions.length * 3);
      for (let i = 0; i < object.positions.length / 3; i++) { const at = i * 9, source = i * 3; vertices.set(object.positions.subarray(source, source + 3), at); vertices.set(object.normals.subarray(source, source + 3), at + 3); vertices.set(object.colors.subarray(source, source + 3), at + 6); }
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const index = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, object.indices, gl.STATIC_DRAW);
      return { ...object, buffer, index };
    });
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
    function draw(object, time) {
      gl.bindBuffer(gl.ARRAY_BUFFER, object.buffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.index);
      attrs.forEach((location, i) => { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 36, i * 12); });
      gl.uniform3fv(uniforms.uOffset, object.satellite === undefined ? [0, 0, 0] : moonPosition(object.satellite, time));
      gl.uniform1f(uniforms.uMaterial, object.material);
      gl.drawElements(object.mode === 'lines' ? gl.LINES : gl.TRIANGLES, object.indices.length, gl.UNSIGNED_SHORT, 0);
    }
    return {
      name: 'webgl', model, interval: 32,
      render(matrix, time, lightTheme) {
        gl.viewport(0, 0, target.width, target.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix3fv(uniforms.uRotation, false, matrix); gl.uniform1f(uniforms.uAspect, target.width / target.height); gl.uniform1f(uniforms.uLightTheme, lightTheme ? 1 : 0); gl.uniform1f(uniforms.uTime, time);
        gl.disable(gl.BLEND); gl.depthMask(true);
        objects.filter(o => o.material !== 1 && o.material !== 3).forEach(o => draw(o, time));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        objects.filter(o => o.material === 3).forEach(o => draw(o, time));
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
        objects.filter(o => o.material === 1).forEach(o => draw(o, time));
        gl.cullFace(gl.BACK); objects.filter(o => o.material === 1).forEach(o => draw(o, time));
        gl.disable(gl.CULL_FACE); gl.depthMask(true);
      },
      dispose() { objects.forEach(o => { gl.deleteBuffer(o.buffer); gl.deleteBuffer(o.index); }); gl.deleteProgram(program); }
    };
  }

  function createSoftwareRenderer(target) {
    const ctx = target.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas unavailable');
    const model = buildPlanet(.35);
    const objects = model.objects.map(o => {
      const points = new Float32Array(o.positions.length), normals = new Float32Array(o.normals.length), projected = new Float32Array(o.positions.length / 3 * 2);
      const faces = [];
      const stride = o.mode === 'lines' ? 2 : 3;
      for (let i = 0; i < o.indices.length; i += stride) faces.push({ a: o.indices[i], b: o.indices[i + 1], c: stride === 3 ? o.indices[i + 2] : -1, depth: 0, shade: '', alpha: 1, object: null });
      const object = { ...o, points, projected, transformedNormals: normals, faces };
      faces.forEach(face => { face.object = object; }); return object;
    });
    const visibleFaces = [];
    const rgb = (r, g, b) => `rgb(${clamp(Math.round(r * 255), 0, 255)},${clamp(Math.round(g * 255), 0, 255)},${clamp(Math.round(b * 255), 0, 255)})`;
    function shade(face, nx, ny, nz, cr, cg, cb, viewDot, lightTheme, time = 0) {
      const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const fresnel = Math.pow(1 - Math.abs(viewDot), 3), material = face.object.material;
      if (material === 5) {
        const shimmer = Math.sin(face.a * .19 + time * .7) * .018;
        const spec = Math.pow(Math.max(0, nx * -.28 + ny * .42 + nz * .86), 90);
        const illumination = .60 + diffuse * .75;
        face.shade = rgb(cr * illumination + fresnel * .18 + spec * .65 + shimmer, cg * illumination + fresnel * .24 + spec * .7 + shimmer, cb * illumination + fresnel * .26 + spec * .65 + shimmer); face.alpha = 1;
      } else if (material === 1) {
        const spec = Math.pow(Math.max(0, nx * -.28 + ny * .42 + nz * .86), 36);
        const brightness = .50 + Math.max(0, ny) * .33 + spec * .85;
        face.shade = rgb(brightness * .96, brightness, brightness * .84);
        face.alpha = clamp(.16 + fresnel * .65 + spec * .45, .16, .92);
      } else if (material === 2) {
        const shine = Math.pow(Math.max(0, nx * -.28 + ny * .42 + nz * .86), 35);
        const brightness = .25 + Math.max(0, ny) * .57 + shine * .7;
        face.shade = rgb(brightness * .95 + fresnel * .3, brightness + fresnel * .3, brightness * .76 + fresnel * .3); face.alpha = 1;
      } else if (material === 3) { face.shade = lightTheme ? 'rgb(114,133,77)' : 'rgb(181,196,135)'; face.alpha = .5; }
      else if (material === 4) { face.shade = rgb(.64 + diffuse * .16, .81 + diffuse * .13, .10); face.alpha = 1; }
      else {
        const illumination = .36 + diffuse * .83;
        face.shade = rgb(Math.pow(cr * illumination, .83), Math.pow(cg * illumination, .83), Math.pow(cb * illumination, .83)); face.alpha = 1;
      }
    }
    return {
      name: 'software-3d', model, interval: 85,
      render(matrix, time, lightTheme) {
        visibleFaces.length = 0;
        const halfHeight = target.height / 2, focal = halfHeight * FOCAL;
        for (const object of objects) {
          const { positions, normals, points, projected, transformedNormals, colors } = object;
          const offset = object.satellite === undefined ? [0, 0, 0] : moonPosition(object.satellite, time);
          for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
            const x = positions[i] + offset[0], y = positions[i + 1] + offset[1], z = positions[i + 2] + offset[2];
            const px = matrix[0] * x + matrix[3] * y + matrix[6] * z, py = matrix[1] * x + matrix[4] * y + matrix[7] * z, pz = matrix[2] * x + matrix[5] * y + matrix[8] * z;
            points[i] = px; points[i + 1] = py; points[i + 2] = pz;
            projected[j] = target.width / 2 + px * focal / (CAMERA - pz); projected[j + 1] = halfHeight - py * focal / (CAMERA - pz);
            transformedNormals[i] = matrix[0] * normals[i] + matrix[3] * normals[i + 1] + matrix[6] * normals[i + 2];
            transformedNormals[i + 1] = matrix[1] * normals[i] + matrix[4] * normals[i + 1] + matrix[7] * normals[i + 2];
            transformedNormals[i + 2] = matrix[2] * normals[i] + matrix[5] * normals[i + 1] + matrix[8] * normals[i + 2];
          }
          for (const face of object.faces) {
            const a = face.a * 3, b = face.b * 3, c = face.c * 3;
            if (face.c < 0) {
              face.depth = (points[a + 2] + points[b + 2]) / 2;
              shade(face, 0, 1, 0, 0, 0, 0, 1, lightTheme); visibleFaces.push(face); continue;
            }
            let nx = transformedNormals[a] + transformedNormals[b] + transformedNormals[c], ny = transformedNormals[a + 1] + transformedNormals[b + 1] + transformedNormals[c + 1], nz = transformedNormals[a + 2] + transformedNormals[b + 2] + transformedNormals[c + 2];
            const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
            const px = (points[a] + points[b] + points[c]) / 3, py = (points[a + 1] + points[b + 1] + points[c + 1]) / 3, pz = (points[a + 2] + points[b + 2] + points[c + 2]) / 3;
            const eyeLength = Math.hypot(px, py, CAMERA - pz), facing = (-nx * px - ny * py + nz * (CAMERA - pz)) / eyeLength;
            if (facing < 0 && object.material !== 1) continue;
            if (facing < 0) { nx = -nx; ny = -ny; nz = -nz; }
            face.depth = pz;
            shade(face, nx, ny, nz, (colors[a] + colors[b] + colors[c]) / 3, (colors[a + 1] + colors[b + 1] + colors[c + 1]) / 3, (colors[a + 2] + colors[b + 2] + colors[c + 2]) / 3, facing, lightTheme, time);
            visibleFaces.push(face);
          }
        }
        visibleFaces.sort((a, b) => a.depth - b.depth);
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.lineJoin = 'round';
        for (const face of visibleFaces) {
          const p = face.object.projected, a = face.a * 2, b = face.b * 2;
          ctx.globalAlpha = face.alpha; ctx.beginPath(); ctx.moveTo(p[a], p[a + 1]); ctx.lineTo(p[b], p[b + 1]);
          if (face.c < 0) { ctx.strokeStyle = face.shade; ctx.lineWidth = .65; ctx.stroke(); }
          else {
            const c = face.c * 2; ctx.lineTo(p[c], p[c + 1]); ctx.closePath(); ctx.fillStyle = face.shade; ctx.fill();
            if (face.alpha === 1) { ctx.strokeStyle = face.shade; ctx.lineWidth = .45; ctx.stroke(); }
          }
        }
        ctx.globalAlpha = 1;
      },
      dispose() {}
    };
  }

  function bindControls() {
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, rotationX: targetX, rotationY: targetY, lastX: event.clientX, lastTime: performance.now(), moved: false };
      velocity = 0;
      if (event.pointerType !== 'touch') canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (event.pointerType === 'touch' && !drag.moved && Math.abs(dy) > Math.abs(dx) + 7) { drag = null; return; }
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.moved = true; manual = true;
      targetY = drag.rotationY + dx * .008;
      if (event.pointerType !== 'touch') targetX = clamp(drag.rotationX + dy * .005, -1.1, 1.1);
      const now = performance.now(); velocity = (event.clientX - drag.lastX) / Math.max(8, now - drag.lastTime) * .004;
      drag.lastX = event.clientX; drag.lastTime = now; requestRender();
    }, { passive: true });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, event => {
      drag = null; if (name === 'pointercancel') velocity = 0;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }));
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) return;
      event.preventDefault(); manual = true; velocity = 0;
      if (event.key === 'ArrowLeft') targetY -= .18;
      if (event.key === 'ArrowRight') targetY += .18;
      if (event.key === 'ArrowUp') targetX = clamp(targetX - .13, -1.1, 1.1);
      if (event.key === 'ArrowDown') targetX = clamp(targetX + .13, -1.1, 1.1);
      if (event.key === 'Escape') { manual = false; targetX = -.23; targetY = .32; }
      requestRender();
    });
  }
  hero.addEventListener('pointermove', event => {
    if (drag || manual || !fine.matches || !automatic()) return;
    const rect = hero.getBoundingClientRect();
    targetX = -.23 + ((event.clientY - rect.top) / rect.height - .5) * .18;
    targetY = .32 + (event.clientX / rect.width - .5) * .28;
    requestRender();
  }, { passive: true });

  function replaceCanvas() {
    const replacement = canvas.cloneNode(false); canvas.replaceWith(replacement); canvas = replacement;
  }
  function initialize(forceSoftware = false) {
    try { renderer = forceSoftware ? null : createWebGLRenderer(canvas); }
    catch { replaceCanvas(); renderer = null; }
    if (!renderer) {
      try { renderer = createSoftwareRenderer(canvas); }
      catch {
        replaceCanvas(); renderer = createSoftwareRenderer(canvas);
      }
    }
    canvas.dataset.renderer = renderer.name;
    canvas.dataset.vertices = String(renderer.model.vertices);
    canvas.dataset.triangles = String(renderer.model.triangles);
    canvas.dataset.state = 'ready';
    bindControls(); resize(); requestRender();
    if (renderer.name === 'webgl') canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); cancelAnimationFrame(frame); frame = 0; renderer.dispose(); replaceCanvas(); initialize(true);
    }, { once: true });
  }
  function render(now) {
    frame = 0;
    if (!visible || document.hidden || !renderer) return;
    if (automatic() && now - last < renderer.interval) { frame = requestAnimationFrame(render); return; }
    const delta = Math.min(100, now - last || 16); last = now;
    if (automatic()) time += delta / 1000;
    if (!drag && automatic()) { targetY += velocity; velocity *= .94; }
    const smoothing = automatic() ? .18 : 1;
    currentX += (targetX - currentX) * smoothing; currentY += (targetY - currentY) * smoothing;
    const spin = automatic() && !manual ? time * .065 : 0;
    const matrix = rotationMatrix(currentX, currentY + spin, -.20);
    renderer.render(matrix, time, themeIsLight());
    canvas.dataset.frame = String(++count);
    if (automatic()) frame = requestAnimationFrame(render);
  }
  function requestRender() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); }
  function resize() {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const density = renderer.name === 'webgl' ? Math.min(devicePixelRatio || 1, 1.45, 1500 / Math.max(rect.width, rect.height)) : Math.min(1, 850 / Math.max(rect.width, rect.height));
    canvas.width = Math.max(1, Math.round(rect.width * density)); canvas.height = Math.max(1, Math.round(rect.height * density)); requestRender();
  }
  function sync() { cancelAnimationFrame(frame); frame = 0; last = 0; requestRender(); }
  reduced.addEventListener('change', sync);
  window.addEventListener('workshopmotionchange', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', resize, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { rootMargin: '80px' }).observe(hero);
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  try { initialize(); }
  catch {
    canvas.dataset.state = 'unavailable';
    document.getElementById('planet-unavailable').hidden = false;
  }
})();
