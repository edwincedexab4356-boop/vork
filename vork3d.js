// VORK · historia 3D con scroll (Three.js r170)
// Modelo: "Car Concept" de Eric Chadwick / Darmstadt Graphics Group (CC BY 4.0), comprimido para la web.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const seccion = $('historia'), lienzo = $('lienzo3d');
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const movil = matchMedia('(max-width: 760px)').matches;

function sin3D(msg){ seccion.classList.add('sin3d'); if (msg) console.warn(msg); }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
} catch (e) { sin3D('WebGL no disponible'); throw e; }
// Calidad automática: empieza moderada y se ajusta según lo rápido que dibuje el equipo.
const CALIDAD_MAX = Math.min(devicePixelRatio, movil ? 1.5 : 1.6);
let calidad = Math.min(CALIDAD_MAX, movil ? 1 : 1.25);
const q = new URLSearchParams(location.search).get('calidad');
if (q === 'baja') calidad = .6;
renderer.setPixelRatio(calidad);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const escena = new THREE.Scene();
escena.background = new THREE.Color('#07080a');
escena.fog = new THREE.Fog('#07080a', 10, 24);
const pmrem = new THREE.PMREMGenerator(renderer);
escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
escena.environmentIntensity = 0.85;

const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 80);

/* ---------- piso de estudio ---------- */
function texturaRadial(stops){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), gr = g.createRadialGradient(256,256,0,256,256,256);
  stops.forEach(([o,col]) => gr.addColorStop(o,col)); g.fillStyle = gr; g.fillRect(0,0,512,512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const piso = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: texturaRadial([[0,'#1a1c21'],[.25,'#101115'],[.6,'#08090b'],[1,'#07080a']]), fog:false }));
piso.rotation.x = -Math.PI/2; escena.add(piso);
const sombra = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.6), new THREE.MeshBasicMaterial({ map: texturaRadial([[0,'rgba(0,0,0,.85)'],[.55,'rgba(0,0,0,.45)'],[1,'rgba(0,0,0,0)']]), transparent:true, depthWrite:false }));
sombra.rotation.x = -Math.PI/2; sombra.position.set(0, .004, .24); escena.add(sombra);
const grid = new THREE.GridHelper(18, 36, '#1d2026', '#121418'); grid.position.y = .002; grid.material.transparent = true; grid.material.opacity = .35; escena.add(grid);
const brilloPiso = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), new THREE.MeshBasicMaterial({ map: texturaRadial([[0,'rgba(255,45,70,.55)'],[1,'rgba(255,45,70,0)']]), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 }));
brilloPiso.rotation.x = -Math.PI/2; brilloPiso.position.set(0,.006,.2); escena.add(brilloPiso);

/* ---------- luces ---------- */
const clave = new THREE.DirectionalLight('#ffffff', 1.6); clave.position.set(3, 9, 4); escena.add(clave);
const borde = new THREE.DirectionalLight('#ff2d46', .45); borde.position.set(-6, 3, -6); escena.add(borde);
// destellos ligeros (en vez de postproceso): luces traseras, delanteras y emisores de los sensores
const texBrillo = texturaRadial([[0,'rgba(255,255,255,1)'],[.2,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']]);
function destello(color, x, y, z, esc){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:texBrillo, color, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 })); sp.position.set(x,y,z); sp.scale.setScalar(esc); escena.add(sp); return sp; }
const destellosT = [-.55, 0, .55].map(x => destello('#ff1a3a', x, .97, -1.66, .9));
const destellosD = [-.7, .7].map(x => destello('#ffb020', x, .66, 2.25, .8));

/* ---------- haz ultrasónico ---------- */
const LARGO = 2.4;
function haz(lado){ // lado: +1 conductor (x+), -1 pasajero (x-)
  const grupo = new THREE.Group();
  grupo.position.set(1.17*lado, .955, .4);
  grupo.rotation.y = -.13*lado;
  const geo = new THREE.CylinderGeometry(.34, .012, LARGO, 48, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
    uniforms:{ uT:{value:0}, uCol:{value:new THREE.Color('#ffffff')}, uA:{value:0} },
    vertexShader:`varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform float uT; uniform vec3 uCol; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float v=1.-vUv.y; // 0 en el retrovisor, 1 al final
        float ondas = .35 + .65*pow(.5+.5*sin(v*34. - uT*9.), 6.);
        float borde = pow(1.-abs(dot(vN,vV)), 1.6);
        float a = smoothstep(0.,.05,v) * pow(1.-v, 1.6) * ondas * (.12 + .7*borde) * uA * .55;
        gl_FragColor = vec4(uCol, a); }`
  });
  const cono = new THREE.Mesh(geo, mat);
  cono.rotation.x = Math.PI/2; cono.position.z = -LARGO/2; // estrecho en el retrovisor, abre hacia atrás
  grupo.add(cono);
  const emisor = new THREE.Mesh(new THREE.SphereGeometry(.028, 16, 16), new THREE.MeshBasicMaterial({ color:'#ff2d46' }));
  grupo.add(emisor);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:texBrillo, color:'#ff2d46', transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  halo.scale.setScalar(.32); grupo.add(halo);
  escena.add(grupo);
  return { grupo, mat, emisor, halo, lado };
}
const haces = [haz(1), haz(-1)];

/* ---------- persona holograma ---------- */
const matHolo = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uT:{value:0}, uA:{value:0}, uCol:{value:new THREE.Color('#7fe3ff')} },
  vertexShader:`varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ vec4 w=modelMatrix*vec4(position,1.); vY=w.y; vec4 mv=viewMatrix*w; vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform float uT; uniform float uA; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ float f=pow(1.-abs(dot(vN,vV)),2.2); float s=.6+.4*step(.5,fract(vY*40.-uT*2.)); gl_FragColor=vec4(uCol,(f*1.4+.08)*s*uA); }`
});
const persona = new THREE.Group();
const parte = (geo, x, y, z) => { const m = new THREE.Mesh(geo, matHolo); m.position.set(x,y,z); persona.add(m); return m; };
parte(new THREE.SphereGeometry(.12, 24, 18), 0, 1.62, 0);
parte(new THREE.CapsuleGeometry(.17, .5, 8, 20), 0, 1.15, 0);
const brazoI = parte(new THREE.CapsuleGeometry(.05, .55, 6, 12), .24, 1.12, 0);
const brazoD = parte(new THREE.CapsuleGeometry(.05, .55, 6, 12), -.24, 1.12, 0);
const piernaI = parte(new THREE.CapsuleGeometry(.07, .7, 6, 12), .1, .45, 0);
const piernaD = parte(new THREE.CapsuleGeometry(.07, .7, 6, 12), -.1, .45, 0);
[brazoI, brazoD].forEach(b => { b.geometry.translate(0,-.27,0); b.position.y += .27; });
[piernaI, piernaD].forEach(b => { b.geometry.translate(0,-.38,0); b.position.y += .38; });
escena.add(persona);

/* ---------- 2.0: puertas (MC-38) y cabina (PIR) ---------- */
const matPuerta = new THREE.LineBasicMaterial({ color:'#22c55e', transparent:true, opacity:0 });
const puertas = new THREE.Group();
[1,-1].forEach(l => { [[.95,-.05],[-.05,-.95]].forEach(([z1,z2]) => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.13*l,.95,z1), new THREE.Vector3(1.17*l,.35,z1), new THREE.Vector3(1.17*l,.35,z2), new THREE.Vector3(1.13*l,.95,z2), new THREE.Vector3(1.13*l,.95,z1)]);
  puertas.add(new THREE.Line(g, matPuerta));
}); });
escena.add(puertas);
const pir = new THREE.Mesh(new THREE.SphereGeometry(.55, 32, 24), new THREE.MeshBasicMaterial({ map: texturaRadial([[0,'rgba(139,92,246,.9)'],[1,'rgba(139,92,246,0)']]), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 }));
pir.position.set(0, .8, .1); escena.add(pir);

/* ---------- carga del auto ---------- */
let auto = null, matsLuces = [];
const cargador = new GLTFLoader(); cargador.setMeshoptDecoder(MeshoptDecoder);
cargador.load('modelo/auto.glb', async gltf => {
  auto = gltf.scene;
  // pintura "Torched Graphite" (variante del propio modelo)
  try {
    const ext = gltf.parser.json.extensions?.KHR_materials_variants;
    const idx = ext ? ext.variants.findIndex(v => /graphite/i.test(v.name)) : -1;
    if (idx >= 0) {
      const tareas = [];
      auto.traverse(o => {
        const m = o.userData?.gltfExtensions?.KHR_materials_variants; if (!o.isMesh || !m) return;
        const map = m.mappings.find(mp => mp.variants.includes(idx));
        if (map) tareas.push(gltf.parser.getDependency('material', map.material).then(mat => { o.material = mat; gltf.parser.assignFinalMaterial(o); }));
      });
      await Promise.all(tareas);
    }
  } catch (e) { console.warn('variante', e); }
  auto.traverse(o => {
    if (!o.isMesh) return;
    if (/License/i.test(o.name)) o.visible = false;          // la placa lleva un logo de terceros
    if (o.material.transmission > 0 || /Windshield$/.test(o.name)) {
      o.material = new THREE.MeshStandardMaterial({ color:'#0b0d10', metalness:.9, roughness:.06, transparent:true, opacity:.62, envMapIntensity:1.6 });
    } else if (o.material.isMeshPhysicalMaterial && !/BodyRearPanelsColor1/.test(o.name)) {
      const m = o.material; o.material = new THREE.MeshStandardMaterial({ color:m.color, map:m.map, normalMap:m.normalMap, roughness:m.roughness, metalness:m.metalness, roughnessMap:m.roughnessMap, metalnessMap:m.metalnessMap, aoMap:m.aoMap, transparent:m.transparent, opacity:m.opacity });
    }
    if (/BodyRearPanelsColor1/.test(o.name)) {                // pintura grafito metálica con barniz
      o.material = new THREE.MeshPhysicalMaterial({ color:'#2a2d33', metalness:.75, roughness:.32, clearcoat:1, clearcoatRoughness:.06, envMapIntensity:1.2 });
    }
    if (/Taillights|TurnsignalsRear|Headlights/i.test(o.name)) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(/Head/.test(o.name) ? '#ffb020' : '#ff1a3a');
      o.material.emissiveIntensity = 0; matsLuces.push(o.material);
    }
  });
  escena.add(auto);
  $('carga3d').classList.add('lista');
  seccion.classList.add('cargado');
}, ev => { if (ev.total) $('cargaBarra').style.width = (ev.loaded/ev.total*100).toFixed(0)+'%'; },
() => sin3D('No se pudo cargar el modelo'));

/* ---------- tomas de cámara ---------- */
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const TOMAS = [
  { p:0.00, pos:V(7.6,2.1,6.9),   mira:V(0,.55,.2) },
  { p:0.18, pos:V(4.3,2.2,3.4),   mira:V(.5,.55,-.7) },
  { p:0.34, pos:V(7.4,2.1,-.6),   mira:V(.5,.7,-.7) },
  { p:0.52, pos:V(7.0,1.9,-1.4),  mira:V(.5,.7,-.7) },
  { p:0.60, pos:V(4.4,1.55,-6.6), mira:V(0,.6,-.5) },
  { p:0.73, pos:V(3.6,1.45,-6.9), mira:V(0,.6,-.5) },
  { p:0.84, pos:V(.01,9.2,.7),    mira:V(0,.35,.15) },
  { p:0.94, pos:V(.01,8.6,.9),    mira:V(0,.35,.15) },
  { p:1.00, pos:V(-7.2,2.4,7.4),  mira:V(0,.55,.2) }
];
const suave = t => t*t*(3-2*t);
function toma(p){
  let i = 0; while (i < TOMAS.length-2 && p > TOMAS[i+1].p) i++;
  const a = TOMAS[i], b = TOMAS[i+1], k = suave(Math.min(1, Math.max(0, (p-a.p)/(b.p-a.p))));
  return { pos: a.pos.clone().lerp(b.pos, k), mira: a.mira.clone().lerp(b.mira, k) };
}
const rango = (p, a, b) => Math.min(1, Math.max(0, (p-a)/(b-a)));
const ventana = (p, a, b, f=.03) => Math.min(rango(p, a-f, a+f), 1-rango(p, b-f, b+f));

/* ---------- etiquetas HTML ancladas ---------- */
const ETQ = [
  { el:$('e-us1'), pos:V(1.2,1.0,.4),  ver:p => ventana(p,.14,.74) },
  { el:$('e-us2'), pos:V(-1.2,1.0,.4), ver:p => ventana(p,.82,.95) },
  { el:$('e-mc38'), pos:V(1.17,.65,-.6), ver:p => ventana(p,.82,.95) },
  { el:$('e-pir'), pos:V(0,1.0,.1),    ver:p => ventana(p,.82,.95) },
  { el:$('e-bat'), pos:V(0,.7,1.8),    ver:p => ventana(p,.84,.95) },
  { el:$('e-luces'), pos:V(0,1.0,-1.9), ver:p => ventana(p,.6,.74) }
];
const tarjetas = [...document.querySelectorAll('.paso3d')];

/* ---------- bucle ---------- */
let pObj = 0, pVis = 0, visible = true, ancho = 0, alto = 0;
function medir(){
  const r = lienzo.getBoundingClientRect(); ancho = r.width; alto = r.height;
  renderer.setSize(ancho, alto, false);
  camara.aspect = ancho/alto;
  camara.fov = camara.aspect < 1 ? 50 : camara.aspect < 1.3 ? 40 : 32;
  camara.updateProjectionMatrix();
}
addEventListener('resize', medir); medir();
const pFija = new URLSearchParams(location.search).get('p');
function leerScroll(){
  if (pFija !== null) { pObj = pVis = +pFija; return; }
  const r = seccion.getBoundingClientRect(), total = seccion.offsetHeight - innerHeight;
  pObj = Math.min(1, Math.max(0, -r.top / total));
}
addEventListener('scroll', leerScroll, { passive:true }); leerScroll();
new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { rootMargin:'100px' }).observe(seccion);

const reloj = new THREE.Clock(), tmp = new THREE.Vector3();
const INICIO = V(3.4,0,-5.2), FIN = V(1.5,0,-.3);
function cuadro(){
  requestAnimationFrame(cuadro);
  if (!visible) return;
  if (pendiente !== null) { calidad = pendiente; pendiente = null; renderer.setPixelRatio(calidad); }
  const t = reloj.getElapsedTime();
  pVis += (pObj - pVis) * (reducir ? 1 : .08);
  const p = pVis;

  // cámara (en la portada gira despacio)
  const c = toma(p);
  if (camara.aspect < 1) c.pos.sub(c.mira).multiplyScalar(1.3).add(c.mira);   // en vertical, la cámara se aleja un poco
  const giro = (1 - rango(p, 0, .12)) * (reducir ? 0 : Math.sin(t*.15) * .9);
  c.pos.applyAxisAngle(V(0,1,0), giro);
  camara.position.copy(c.pos); camara.lookAt(c.mira);
  // en pantallas anchas, el auto se corre a la derecha para dejar sitio al texto (portada y final)
  const corrido = camara.aspect > 1.2 ? ((1 - rango(p, 0, .12)) + rango(p, .95, 1)) * .2 : 0;
  if (Math.abs(corrido - (camara.view?.offsetX || 0) / Math.max(1, ancho)) > .0005) {
    if (corrido > 0) camara.setViewOffset(ancho, alto, -corrido*ancho, 0, ancho, alto); else if (camara.aspect >= 1) camara.clearViewOffset();
  }
  // en vertical (celular), en portada y final el auto baja para no quedar detrás del texto
  if (camara.aspect < 1) {
    const baja = (1 - rango(p, 0, .12)) * .12 + rango(p, .95, 1) * .1;
    if (baja > .001) camara.setViewOffset(ancho, alto, 0, -baja*alto, ancho, alto); else camara.clearViewOffset();
  }
  seccion.classList.toggle('enPortada', p < .12);

  // historia
  const armado = p > .1;
  const v2 = rango(p, .74, .8);
  const cami = rango(p, .36, .5);
  const fuera = rango(p, .74, .8);
  persona.position.copy(INICIO).lerp(FIN, suave(cami));
  persona.rotation.y = Math.atan2(FIN.x-INICIO.x, FIN.z-INICIO.z);
  const pasos = cami > 0 && cami < 1 ? Math.sin(t*7) : 0;
  piernaI.rotation.x = pasos*.5; piernaD.rotation.x = -pasos*.5; brazoI.rotation.x = -pasos*.4; brazoD.rotation.x = pasos*.4;
  matHolo.uniforms.uA.value = rango(p, .33, .37) * (1 - fuera); matHolo.uniforms.uT.value = t;

  // ¿la persona está dentro del haz del conductor?
  const dz = .4 - persona.position.z, dx = persona.position.x - 1.17;
  const enHaz = matHolo.uniforms.uA.value > .3 && dz > .1 && dz < LARGO && dx > -.15 && dx < .25 + dz*.28;
  const cm = enHaz ? Math.round(dz*100) : null;
  const alarma = p > .58 && p < .76;
  const parpadeo = alarma && Math.floor(t*4) % 2 === 0;

  haces.forEach((h, i) => {
    const on = i === 0 ? rango(p, .1, .16) : v2;
    h.mat.uniforms.uA.value = on * (alarma ? 1.6 : 1);
    h.mat.uniforms.uT.value = t;
    h.mat.uniforms.uCol.value.set(i === 0 && (enHaz || alarma) ? '#ff2d46' : '#dff4ff');
    h.emisor.visible = on > .02; h.halo.visible = on > .02; h.halo.material.color.copy(h.emisor.material.color);
    h.emisor.material.color.set(armado ? (enHaz && i===0 ? '#ff2d46' : '#22c55e') : '#555');
    h.halo.material.color.copy(h.emisor.material.color);
  });
  matPuerta.opacity = v2 * (.55 + .45*Math.sin(t*3));
  pir.material.opacity = v2 * (.35 + .25*Math.sin(t*2.2));
  pir.scale.setScalar(1 + .06*Math.sin(t*2.2));

  matsLuces.forEach(m => { m.emissiveIntensity = parpadeo ? 6 : 0; });
  destellosT.forEach(d => d.material.opacity = parpadeo ? .95 : 0);
  destellosD.forEach(d => d.material.opacity = parpadeo ? .7 : 0);
  brilloPiso.material.opacity = alarma ? (parpadeo ? .9 : .35) : 0;
  borde.intensity = .45 + (alarma ? 1.4 : 0);
  seccion.classList.toggle('alarma', alarma);

  // HUD
  const cuenta = Math.max(0, Math.ceil(10 - rango(p, .5, .58)*10));
  let estado = p < .1 ? 'DESARMADO' : alarma ? 'ALARMA' : (enHaz && p < .58) ? 'ENTRADA' : 'ARMADO';
  $('hudEstado').textContent = estado;
  $('hudEstado').className = 'h-' + estado.toLowerCase();
  $('hudDist').textContent = cm === null ? 'sin eco' : cm + ' cm';
  $('hudEco').textContent = cm === null ? '— µs' : (cm*58) + ' µs';
  $('hudCuenta').textContent = estado === 'ENTRADA' ? 'suena en ' + cuenta + ' s' : alarma ? 'sirena · relé · aviso' : v2 > .5 ? 'VORK 2.0' : 'vigilando';
  $('notif3d').classList.toggle('ver', p > .6 && p < .75);

  // tarjetas y etiquetas
  tarjetas.forEach(d => { const a = +d.dataset.a, b = +d.dataset.b; const o = ventana(p, a, b, .025); d.style.opacity = o; d.style.transform = `translateY(${(1-o)*24}px)`; d.style.pointerEvents = o > .5 ? 'auto' : 'none'; });
  ETQ.forEach(e => {
    const o = Math.min(1, e.ver(p)); if (!e.el) return;
    tmp.copy(e.pos).project(camara);
    const x = (tmp.x*.5+.5)*ancho, y = (-tmp.y*.5+.5)*alto;
    e.el.style.opacity = tmp.z < 1 ? o : 0;
    e.el.style.transform = `translate(${x}px,${y}px)`;
  });
  $('barra3d').style.transform = `scaleX(${p})`;

  renderer.render(escena, camara);
  ajustarCalidad();
}
// mide cuánto tarda cada cuadro y sube o baja la resolución para mantenerlo fluido.
// El cambio se aplica al empezar el cuadro siguiente (cambiar el tamaño borra el lienzo).
let ema = 16, ultimo = performance.now(), muestras = 0, pendiente = null;
function ajustarCalidad(){
  const ahora = performance.now(), dt = ahora - ultimo; ultimo = ahora;
  if (dt > 120 || q === 'baja') return;          // pestaña en segundo plano o pausada: no cuenta
  ema += (dt - ema) * .08; muestras++;
  if (muestras < 45) return;                      // decide solo con suficientes cuadros nuevos
  if (ema > 22 && calidad > .55) { pendiente = Math.max(.55, calidad - .15); muestras = 0; }
  else if (ema < 14 && calidad < CALIDAD_MAX) { pendiente = Math.min(CALIDAD_MAX, calidad + .1); muestras = 0; }
}
if (new URLSearchParams(location.search).has("debug")) window.__v3d = { renderer, escena, camara, fijarCalidad: c => { calidad = c; renderer.setPixelRatio(c); } };
cuadro();
