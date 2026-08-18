"use strict";
/* =========================================================
 * 星座观星仪 · StarGaze  —  app.js
 * 定位 → 3D地球 → 朝向识别 → 星座描绘 → 资料抓取 → 拍照
 * ========================================================= */

/* ============ 全局状态 ============ */
const State = {
  lat: null, lon: null,
  altitude: -90, azimuth: 0,
  hasOrientation: false,
  isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  currentConstellation: null,
  videoStream: null,
  folderHandle: null,
};
const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function showToast(msg, dur = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

/* ============ 亮星数据集 ============
   [名称, RA(小时), Dec(度), 视星等, 星座代号, B-V色指数] */
const STARS = [
  ["Sirius",6.7525,-16.7161,-1.46,"CMa",0.0],["Canopus",6.3992,-52.6956,-0.74,"Car",0.15],
  ["Arcturus",14.2610,19.1825,-0.05,"Boo",1.23],["Rigil Kentaurus",14.6600,-60.8354,-0.01,"Cen",0.7],
  ["Vega",18.6156,38.7837,0.03,"Lyr",0.0],["Rigel",5.2423,-8.2016,0.13,"Ori",-0.03],
  ["Procyon",7.6550,5.2249,0.34,"CMi",0.42],["Achernar",1.6286,-57.2367,0.46,"Eri",-0.16],
  ["Betelgeuse",5.9195,7.4070,0.45,"Ori",1.85],["Hadar",14.0637,-60.3730,0.61,"Cen",-0.23],
  ["Altair",19.8463,8.8683,0.76,"Aql",0.22],["Acrux",12.4433,-63.0991,0.77,"Cru",-0.24],
  ["Aldebaran",4.5987,16.5093,0.85,"Tau",1.54],["Antares",16.4901,-26.4320,1.06,"Sco",1.83],
  ["Spica",13.4199,-11.1614,0.98,"Vir",-0.23],["Pollux",7.7553,28.0262,1.14,"Gem",1.0],
  ["Fomalhaut",22.9608,-29.6222,1.16,"PsA",0.09],["Deneb",20.6905,45.2803,1.25,"Cyg",0.09],
  ["Mimosa",12.7953,-59.6886,1.25,"Cru",-0.23],["Regulus",10.1395,11.9672,1.35,"Leo",-0.11],
  ["Adhara",6.9770,-28.9722,1.50,"CMa",-0.21],["Shaula",17.5601,-37.1038,1.62,"Sco",-0.22],
  ["Castor",7.5766,31.8883,1.57,"Gem",0.03],["Gacrux",12.5194,-57.1131,1.59,"Cru",1.59],
  ["Bellatrix",5.4188,6.3497,1.64,"Ori",-0.22],["Elnath",5.4382,28.6075,1.65,"Tau",-0.13],
  ["Miaplacidus",9.2200,-69.7172,1.67,"Car",0.07],["Alnilam",5.6036,-1.2019,1.69,"Ori",-0.18],
  ["Alnitak",5.6793,-1.9426,1.74,"Ori",-0.2],["Polaris",2.5302,89.2641,1.98,"UMi",0.64],
  ["Mirfak",3.4054,49.8612,1.79,"Per",0.48],["Kochab",14.8451,74.1555,2.07,"UMi",1.47],
  ["Alphard",9.4598,-8.6586,1.99,"Hya",1.44],["Hamal",2.1196,23.4624,2.0,"Ari",1.15],
  ["Diphda",0.7265,-17.9866,2.04,"Cet",1.02],["Mirach",1.1623,35.6206,2.05,"And",1.58],
  ["Alpheratz",0.1398,29.0904,2.06,"And",-0.11],["Kaus Australis",18.4029,-34.3846,1.85,"Sgr",-0.03],
  ["Sargas",17.6219,-42.9978,1.86,"Sco",0.4],["Avior",8.3752,-59.5095,1.86,"Car",1.28],
  ["Alkaid",13.7923,49.3133,1.86,"UMa",-0.1],["Menkalinan",5.9921,44.9474,1.90,"Aur",0.03],
  ["Atria",16.8111,-69.0277,1.91,"TrA",1.45],["Alhena",6.6285,16.3993,1.93,"Gem",0.0],
  ["Peacock",20.4275,-56.7351,1.94,"Pav",1.06],["Alsephina",8.7456,-54.7087,1.96,"Vel",-0.16],
  ["Mirzam",6.3783,-17.9559,1.98,"CMa",-0.24],["Phecda",11.8972,53.6948,2.44,"UMa",0.0],
  ["Megrez",12.2571,57.0326,3.31,"UMa",0.08],["Dubhe",11.0621,61.7510,1.79,"UMa",1.07],
  ["Merak",11.0307,56.3824,2.37,"UMa",0.03],["Alioth",12.9005,55.9598,1.77,"UMa",-0.02],
  ["Mizar",13.3987,54.9254,2.27,"UMa",0.13],["Schedar",0.6751,56.5374,2.24,"Cas",1.17],
  ["Caph",0.1530,59.1498,2.27,"Cas",0.34],["Gamma Cas",0.9451,60.7167,2.47,"Cas",-0.15],
  ["Ruchbah",1.4303,60.2353,2.68,"Cas",0.16],["Segin",1.9067,63.6701,3.38,"Cas",-0.15],
  ["Mintaka",5.5334,-0.2991,2.23,"Ori",-0.17],["Saiph",5.7959,-9.6696,2.07,"Ori",-0.17],
  ["Denebola",11.8177,14.5720,2.13,"Leo",0.09],["Algieba",10.3329,19.8415,2.08,"Leo",1.13],
  ["Zosma",11.2351,20.5237,2.56,"Leo",0.13],["Porrima",12.6943,-1.4493,2.74,"Vir",0.36],
  ["Vindemiatrix",13.0362,10.9591,2.83,"Vir",0.94],["Zavijava",11.8437,1.7649,3.61,"Vir",0.59],
  ["Izar",14.7494,27.0742,2.35,"Boo",0.97],["Muphrid",13.7884,18.3983,2.68,"Boo",0.81],
  ["Sheliak",18.8345,33.3627,3.52,"Lyr",0.0],["Sulafat",18.9823,32.6896,3.25,"Lyr",-0.05],
  ["Sadr",20.3705,40.2567,2.20,"Cyg",0.67],["Albireo",19.5121,27.9597,3.18,"Cyg",1.13],
  ["Gienah",20.7702,33.9703,2.46,"Cyg",1.03],["Delta Cyg",19.7496,45.1308,2.87,"Cyg",0.08],
  ["Tarazed",19.7710,10.6133,2.72,"Aql",1.05],["Alshain",19.9222,6.4066,3.71,"Aql",0.32],
  ["Dschubba",16.0056,-22.6217,2.29,"Sco",-0.12],["Pi Sco",15.9809,-26.1140,2.89,"Sco",-0.18],
  ["Nunki",18.9211,-26.2967,2.05,"Sgr",-0.13],["Ascella",19.0447,-29.8799,2.60,"Sgr",0.04],
  ["Kaus Media",18.2069,-29.8283,2.70,"Sgr",1.0],["Kaus Borealis",18.4661,-25.4214,2.81,"Sgr",1.06],
  ["Markab",23.0793,15.2053,2.49,"Peg",-0.04],["Scheat",23.0629,28.0828,2.42,"Peg",1.65],
  ["Algenib",0.2206,15.1836,2.83,"Peg",-0.19],["Almach",2.0649,42.3297,2.10,"And",1.37],
  ["Algol",3.1361,40.9556,2.12,"Per",-0.05],["Capella",5.2782,45.9980,0.08,"Aur",0.8],
  ["Thuban",14.0731,64.3758,3.65,"Dra",-0.11],["Eltanin",17.9434,51.4889,2.23,"Dra",1.52],
  ["Rastaban",17.3094,52.3014,2.79,"Dra",1.02],["Alderamin",21.3085,62.5908,2.45,"Cep",0.25],
  ["Alphecca",15.5781,26.7147,2.22,"CrB",0.0],["Ras Algethi",16.4175,14.3903,3.06,"Her",1.45],
  ["Tarf",8.2660,9.1849,3.5,"Cnc",1.2],["Asellus Australis",8.7449,18.4325,3.9,"Cnc",0.94],
  ["Pherkad",15.3455,71.8339,3.00,"UMi",0.02],["Yildun",17.5369,86.5864,4.36,"UMi",0.04],
  ["Wezen",7.1399,-26.3933,1.83,"CMa",0.68],["Aludra",7.4013,-29.3030,2.45,"CMa",-0.08],
  ["Gomeisa",7.2754,8.2893,2.89,"CMi",-0.05],["Wasat",7.3354,21.9823,3.50,"Gem",0.45],
  ["Chertan",11.2373,15.4297,3.32,"Leo",0.13],["Alcyone",3.7914,24.1051,2.87,"Tau",-0.09],
];

/* ============ 星座连线 ============ */
const CONST_LINES = {
  "UMa":[["Dubhe","Merak"],["Merak","Phecda"],["Phecda","Megrez"],["Megrez","Dubhe"],["Megrez","Alioth"],["Alioth","Mizar"],["Mizar","Alkaid"]],
  "UMi":[["Polaris","Yildun"],["Kochab","Pherkad"]],
  "Cas":[["Caph","Schedar"],["Schedar","Gamma Cas"],["Gamma Cas","Ruchbah"],["Ruchbah","Segin"]],
  "Ori":[["Betelgeuse","Bellatrix"],["Betelgeuse","Alnitak"],["Bellatrix","Mintaka"],["Mintaka","Alnilam"],["Alnilam","Alnitak"],["Alnitak","Saiph"],["Rigel","Mintaka"],["Saiph","Rigel"]],
  "Tau":[["Aldebaran","Elnath"],["Aldebaran","Alcyone"]],
  "CMa":[["Sirius","Mirzam"],["Sirius","Adhara"],["Adhara","Wezen"],["Wezen","Aludra"]],
  "CMi":[["Procyon","Gomeisa"]],
  "Gem":[["Castor","Pollux"],["Pollux","Alhena"],["Castor","Wasat"],["Wasat","Alhena"]],
  "Leo":[["Regulus","Algieba"],["Algieba","Zosma"],["Zosma","Denebola"],["Denebola","Chertan"],["Chertan","Regulus"]],
  "Vir":[["Spica","Porrima"],["Porrima","Zavijava"],["Zavijava","Vindemiatrix"]],
  "Boo":[["Arcturus","Izar"],["Arcturus","Muphrid"]],
  "Lyr":[["Vega","Sheliak"],["Sheliak","Sulafat"],["Sulafat","Vega"]],
  "Cyg":[["Deneb","Sadr"],["Sadr","Albireo"],["Sadr","Gienah"],["Sadr","Delta Cyg"]],
  "Aql":[["Altair","Tarazed"],["Altair","Alshain"]],
  "Sco":[["Antares","Dschubba"],["Antares","Pi Sco"],["Antares","Shaula"],["Shaula","Sargas"]],
  "Sgr":[["Kaus Australis","Kaus Media"],["Kaus Media","Kaus Borealis"],["Kaus Borealis","Nunki"],["Nunki","Ascella"]],
  "Peg":[["Markab","Scheat"],["Scheat","Alpheratz"],["Alpheratz","Algenib"],["Algenib","Markab"]],
  "And":[["Alpheratz","Mirach"],["Mirach","Almach"]],
  "Per":[["Mirfak","Algol"]],
  "Aur":[["Capella","Menkalinan"]],
  "Cru":[["Acrux","Gacrux"],["Acrux","Mimosa"]],
  "Cen":[["Rigil Kentaurus","Hadar"]],
  "Dra":[["Thuban","Eltanin"],["Eltanin","Rastaban"]],
};

/* ============ 星座元数据 ============ */
const CONST_INFO = {
  "UMa":{cn:"大熊座",latin:"Ursa Major",wiki:"大熊座",season:"春季",hemi:"北"},
  "UMi":{cn:"小熊座",latin:"Ursa Minor",wiki:"小熊座",season:"全年",hemi:"北"},
  "Cas":{cn:"仙后座",latin:"Cassiopeia",wiki:"仙后座",season:"秋季",hemi:"北"},
  "Ori":{cn:"猎户座",latin:"Orion",wiki:"猎户座",season:"冬季",hemi:"赤道"},
  "Tau":{cn:"金牛座",latin:"Taurus",wiki:"金牛座",season:"冬季",hemi:"北"},
  "CMa":{cn:"大犬座",latin:"Canis Major",wiki:"大犬座",season:"冬季",hemi:"南"},
  "CMi":{cn:"小犬座",latin:"Canis Minor",wiki:"小犬座",season:"冬季",hemi:"北"},
  "Gem":{cn:"双子座",latin:"Gemini",wiki:"双子座",season:"冬季",hemi:"北"},
  "Leo":{cn:"狮子座",latin:"Leo",wiki:"狮子座",season:"春季",hemi:"北"},
  "Cnc":{cn:"巨蟹座",latin:"Cancer",wiki:"巨蟹座",season:"春季",hemi:"北"},
  "Vir":{cn:"室女座",latin:"Virgo",wiki:"室女座",season:"春季",hemi:"北"},
  "Boo":{cn:"牧夫座",latin:"Boötes",wiki:"牧夫座",season:"夏季",hemi:"北"},
  "Lyr":{cn:"天琴座",latin:"Lyra",wiki:"天琴座",season:"夏季",hemi:"北"},
  "Cyg":{cn:"天鹅座",latin:"Cygnus",wiki:"天鹅座",season:"夏季",hemi:"北"},
  "Aql":{cn:"天鹰座",latin:"Aquila",wiki:"天鹰座",season:"夏季",hemi:"北"},
  "Sco":{cn:"天蝎座",latin:"Scorpius",wiki:"天蝎座",season:"夏季",hemi:"南"},
  "Sgr":{cn:"人马座",latin:"Sagittarius",wiki:"人马座",season:"夏季",hemi:"南"},
  "Peg":{cn:"飞马座",latin:"Pegasus",wiki:"飞马座",season:"秋季",hemi:"北"},
  "And":{cn:"仙女座",latin:"Andromeda",wiki:"仙女座",season:"秋季",hemi:"北"},
  "Per":{cn:"英仙座",latin:"Perseus",wiki:"英仙座",season:"冬季",hemi:"北"},
  "Aur":{cn:"御夫座",latin:"Auriga",wiki:"御夫座",season:"冬季",hemi:"北"},
  "Cru":{cn:"南十字座",latin:"Crux",wiki:"南十字座",season:"南半球",hemi:"南"},
  "Cen":{cn:"半人马座",latin:"Centaurus",wiki:"半人马座",season:"南半球",hemi:"南"},
  "Car":{cn:"船底座",latin:"Carina",wiki:"船底座",season:"南半球",hemi:"南"},
  "CrB":{cn:"北冕座",latin:"Corona Borealis",wiki:"北冕座",season:"夏季",hemi:"北"},
  "Her":{cn:"武仙座",latin:"Hercules",wiki:"武仙座",season:"夏季",hemi:"北"},
  "Dra":{cn:"天龙座",latin:"Draco",wiki:"天龙座",season:"全年",hemi:"北"},
  "Cep":{cn:"仙王座",latin:"Cepheus",wiki:"仙王座",season:"秋季",hemi:"北"},
  "PsA":{cn:"南鱼座",latin:"Piscis Austrinus",wiki:"南鱼座",season:"秋季",hemi:"南"},
  "Eri":{cn:"波江座",latin:"Eridanus",wiki:"波江座",season:"冬季",hemi:"南"},
  "Hya":{cn:"长蛇座",latin:"Hydra",wiki:"长蛇座",season:"春季",hemi:"南"},
  "Ari":{cn:"白羊座",latin:"Aries",wiki:"白羊座",season:"冬季",hemi:"北"},
  "Cet":{cn:"鲸鱼座",latin:"Cetus",wiki:"鲸鱼座",season:"秋季",hemi:"北"},
  "TrA":{cn:"南三角座",latin:"Triangulum Australe",wiki:"南三角座",season:"南半球",hemi:"南"},
  "Pav":{cn:"孔雀座",latin:"Pavo",wiki:"孔雀座",season:"南半球",hemi:"南"},
  "Vel":{cn:"船帆座",latin:"Vela",wiki:"船帆座",season:"南半球",hemi:"南"},
};

function starColor(bv) {
  if (bv === undefined || bv === null) bv = 0;
  if (bv < -0.2) return [155, 188, 255];
  if (bv < 0.0)  return [180, 200, 255];
  if (bv < 0.2)  return [210, 220, 255];
  if (bv < 0.4)  return [240, 240, 250];
  if (bv < 0.8)  return [255, 250, 230];
  if (bv < 1.2)  return [255, 220, 170];
  return [255, 180, 130];
}
function starRadius(mag) { return clamp(4.5 - 0.7 * mag, 0.6, 4.5); }
function compassDir(az) { return ['北','东北','东','东南','南','西南','西','西北'][Math.round(az / 45) % 8]; }

/* ============ 1. 精准定位 ============ */
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 39.9042, lon: 116.4074, fallback: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => { showToast('定位失败,使用默认位置'); resolve({ lat: 39.9042, lon: 116.4074, fallback: true }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=zh`);
    const data = await res.json();
    const a = data.address || {};
    return a.city || a.town || a.county || a.state || a.country || '当前位置';
  } catch (e) { return '当前位置'; }
}

/* ============ 2. 3D 地球 (Three.js) ============ */
function initEarth(lat, lon) {
  const canvas = $('earth-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 3.6);
  scene.add(new THREE.AmbientLight(0x404060, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 3, 5); scene.add(sun);

  const earthTex = createEarthTexture();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), new THREE.MeshPhongMaterial({ map: earthTex, shininess: 8, specular: 0x222244 }));
  scene.add(earth);

  // 大气光晕
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; void main(){ float i=pow(0.7-dot(vN,vec3(0,0,1)),2.0); gl_FragColor=vec4(0.3,0.6,1.0,1.0)*i; }`,
    blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 64), atmoMat));

  // 星空背景
  const starGeo = new THREE.BufferGeometry();
  const N = 1500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 50, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i*3] = r*Math.sin(ph)*Math.cos(th); pos[i*3+1] = r*Math.cos(ph); pos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8 }));
  scene.add(starField);

  // 用户位置标记
  const latR = lat * DEG, lonR = lon * DEG;
  const mp = new THREE.Vector3(Math.cos(latR)*Math.cos(lonR), Math.sin(latR), Math.cos(latR)*Math.sin(lonR)).multiplyScalar(1.02);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
  marker.position.copy(mp); earth.add(marker);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0xff4455, transparent: true, opacity: 0.6 }));
  beam.position.copy(mp.clone().multiplyScalar(1.08));
  beam.lookAt(0, 0, 0); beam.rotateX(Math.PI / 2); earth.add(beam);

  earth.rotation.y = -lonR + Math.PI / 2;
  earth.rotation.x = latR * 0.5;

  // 拖动旋转
  let drag = false, lx = 0, ly = 0, vx = 0, vy = 0;
  const tp = (e) => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
  const down = (e) => { drag = true; const p = tp(e); lx = p.x; ly = p.y; };
  const move = (e) => { if (!drag) return; const p = tp(e); vy = (p.x-lx)*0.005; vx = (p.y-ly)*0.005; earth.rotation.y += vy; earth.rotation.x = clamp(earth.rotation.x + vx, -1.2, 1.2); lx = p.x; ly = p.y; };
  const up = () => { drag = false; };
  canvas.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: true }); canvas.addEventListener('touchmove', move, { passive: true }); canvas.addEventListener('touchend', up);

  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    if (!drag) { earth.rotation.y += 0.0015 + vy*0.95; vy *= 0.92; earth.rotation.x += vx*0.9; vx *= 0.9; earth.rotation.x = clamp(earth.rotation.x, -1.2, 1.2); }
    starField.rotation.y += 0.0002;
    renderer.render(scene, camera);
  }
  animate();
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
  window.addEventListener('resize', onResize);
  State.earthScene = { raf, onResize };
}

// 程序化地球纹理(避免外部CORS)
function createEarthTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const og = ctx.createLinearGradient(0, 0, 0, 512);
  og.addColorStop(0, '#0a3a6b'); og.addColorStop(0.5, '#0d5a9a'); og.addColorStop(1, '#0a3a6b');
  ctx.fillStyle = og; ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(${100+Math.random()*60},${150+Math.random()*60},${200+Math.random()*40},${Math.random()*0.15})`; ctx.fillRect(Math.random()*1024, Math.random()*512, 2, 2); }
  ctx.fillStyle = '#2a7a3a';
  const conts = [
    [[180,140],[230,110],[290,100],[340,120],[380,150],[400,200],[390,260],[360,300],[320,320],[270,310],[220,280],[190,230],[180,180]],
    [[400,200],[440,180],[470,200],[490,250],[510,300],[500,340],[470,360],[440,330],[420,290],[400,250]],
    [[340,300],[380,310],[400,360],[390,420],[360,450],[330,440],[310,400],[315,350]],
    [[200,300],[250,310],[270,360],[260,420],[220,450],[180,430],[170,380],[180,340]],
    [[260,420],[290,430],[300,470],[280,495],[250,490],[240,460]],
    [[500,360],[540,350],[570,370],[560,400],[520,410],[500,390]],
    [[80,150],[140,140],[160,170],[140,190],[90,180]]
  ];
  conts.forEach(pts => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, 1024, 35); ctx.fillRect(0, 478, 1024, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 60; i++) { const x = Math.random()*1024, y = 60+Math.random()*380, w = 40+Math.random()*120, h = 10+Math.random()*20; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI*2); ctx.fill(); }
  const tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
}

/* ============ 3. 设备朝向 ============ */
function setupOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') bindOrient(); else showDesktopHint(); }).catch(() => showDesktopHint());
  } else { bindOrient(); }
}
function bindOrient() {
  window.addEventListener('deviceorientationabsolute', onOrient, true);
  window.addEventListener('deviceorientation', onOrient, true);
  setTimeout(() => { if (!State.hasOrientation) showDesktopHint(); }, 1500);
}
function onOrient(e) {
  if (e.alpha === null && e.beta === null && e.gamma === null) return;
  State.hasOrientation = true;
  $('desktop-hint').classList.remove('show');
  let compass;
  if (typeof e.webkitCompassHeading === 'number') compass = e.webkitCompassHeading;
  else if (e.alpha !== null) compass = (360 - e.alpha) % 360;
  else return;
  const beta = e.beta || 0;
  let altitude = beta - 90;
  if (beta < 0) altitude = -90 - Math.abs(beta);
  State.altitude = clamp(altitude, -90, 90);
  State.azimuth = (compass + 360) % 360;
  $('orient-indicator').textContent = `方位 ${State.azimuth.toFixed(0)}° ${compassDir(State.azimuth)} · 仰角 ${State.altitude.toFixed(0)}°`;
}
// 桌面端鼠标拖动模拟
let dDrag = false, dLx = 0, dLy = 0;
function setupDesktopFallback() {
  const cv = $('sky-canvas');
  cv.addEventListener('mousedown', (e) => { dDrag = true; dLx = e.clientX; dLy = e.clientY; });
  window.addEventListener('mousemove', (e) => {
    if (!dDrag) return;
    State.azimuth = (State.azimuth + (e.clientX - dLx) * 0.3 + 360) % 360;
    State.altitude = clamp(State.altitude + (e.clientY - dLy) * 0.3, -90, 90);
    dLx = e.clientX; dLy = e.clientY;
    State.hasOrientation = true;
    $('desktop-hint').classList.remove('show');
    $('orient-indicator').textContent = `方位 ${State.azimuth.toFixed(0)}° ${compassDir(State.azimuth)} · 仰角 ${State.altitude.toFixed(0)}°`;
  });
  window.addEventListener('mouseup', () => { dDrag = false; });
}
function showDesktopHint() {
  if (!State.isMobile) {
    $('desktop-hint').classList.add('show');
    setupDesktopFallback();
    State.azimuth = 180; State.altitude = 45;
  }
}

/* ============ 4. 天空渲染 (Canvas) ============ */
let skyCtx, skyCanvas, skyRAF;
let starAltAzCache = [];
function initSkyCanvas() {
  skyCanvas = $('sky-canvas');
  skyCtx = skyCanvas.getContext('2d');
  resizeSky();
  window.addEventListener('resize', resizeSky);
  renderSky();
}
function resizeSky() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  skyCanvas.width = window.innerWidth * dpr;
  skyCanvas.height = window.innerHeight * dpr;
  skyCanvas.style.width = window.innerWidth + 'px';
  skyCanvas.style.height = window.innerHeight + 'px';
  skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 计算所有恒星当前的地平坐标(alt/az)
function computeStarPositions() {
  if (State.lat === null) return;
  const time = new Date();
  const observer = new Astronomy.Observer(State.lat, State.lon, 0);
  starAltAzCache = STARS.map(s => {
    try {
      const hor = Astronomy.Horizon(time, observer, s[1], s[2], 'normal');
      return { name: s[0], mag: s[3], const: s[4], bv: s[5], alt: hor.altitude, az: hor.azimuth };
    } catch (e) {
      return { name: s[0], mag: s[3], const: s[4], bv: s[5], alt: -90, az: 0 };
    }
  });
}

// 切面投影:(alt,az)→画布坐标,以手机指向为中心
function projectStar(alt, az, cAlt, cAz, halfFoV) {
  const aR = alt*DEG, azR = az*DEG, caR = cAlt*DEG, czR = cAz*DEG;
  const sx = Math.cos(aR)*Math.sin(azR), sy = Math.cos(aR)*Math.cos(azR), sz = Math.sin(aR);
  const cx = Math.cos(caR)*Math.sin(czR), cy = Math.cos(caR)*Math.cos(czR), cz = Math.sin(caR);
  const cosA = sx*cx + sy*cy + sz*cz;
  if (cosA <= 0.05) return null;
  const ux = -Math.sin(caR)*Math.sin(czR), uy = -Math.sin(caR)*Math.cos(czR), uz = Math.cos(caR);
  const rx = cy*uz - cz*uy, ry = cz*ux - cx*uz, rz = cx*uy - cy*ux;
  const x = (sx*rx + sy*ry + sz*rz) / cosA;
  const y = (sx*ux + sy*uy + sz*uz) / cosA;
  const tH = Math.tan(halfFoV * DEG);
  return { px: (x/tH + 1)*0.5*window.innerWidth, py: (-y/tH + 1)*0.5*window.innerHeight };
}

function renderSky() {
  skyRAF = requestAnimationFrame(renderSky);
  if (!skyCtx) return;
  const W = window.innerWidth, H = window.innerHeight;
  skyCtx.clearRect(0, 0, W, H);

  // 仰角低于地平线 → 显示警告
  if (State.altitude < 5) {
    $('horizon-warning').classList.add('show');
    $('constellation-info').classList.remove('show');
    return;
  }
  $('horizon-warning').classList.remove('show');

  // 每30秒刷新恒星位置
  if (!renderSky.lastT || Date.now() - renderSky.lastT > 30000) {
    computeStarPositions();
    renderSky.lastT = Date.now();
  }
  if (starAltAzCache.length === 0) return;

  const cAlt = State.altitude, cAz = State.azimuth, halfFoV = 45;
  const visible = [];
  const counts = {};
  for (const st of starAltAzCache) {
    if (st.alt < -1) continue;
    const p = projectStar(st.alt, st.az, cAlt, cAz, halfFoV);
    if (p) {
      visible.push({ ...st, px: p.px, py: p.py });
      if (st.mag < 4.5) counts[st.const] = (counts[st.const] || 0) + 1;
    }
  }

  // 识别当前面对的星座(亮星最多)
  let topC = null, topN = 0;
  for (const c in counts) if (counts[c] > topN) { topN = counts[c]; topC = c; }
  if (topN >= 2 && topC !== State.currentConstellation) {
    State.currentConstellation = topC; updateConstellationInfo();
  } else if (topN < 2 && State.currentConstellation !== null) {
    State.currentConstellation = null; updateConstellationInfo();
  }

  // 星座连线(当前星座高亮)
  drawConstellationLines(topC, cAlt, cAz, halfFoV);

  // 恒星
  for (const st of visible) {
    const [r,g,b] = starColor(st.bv);
    const rad = starRadius(st.mag);
    const grad = skyCtx.createRadialGradient(st.px, st.py, 0, st.px, st.py, rad * 3);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.6)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    skyCtx.fillStyle = grad;
    skyCtx.beginPath(); skyCtx.arc(st.px, st.py, rad * 3, 0, Math.PI*2); skyCtx.fill();
    skyCtx.fillStyle = 'rgba(255,255,255,1)';
    skyCtx.beginPath(); skyCtx.arc(st.px, st.py, rad * 0.6, 0, Math.PI*2); skyCtx.fill();
    if (st.mag < 1.5) {
      skyCtx.fillStyle = 'rgba(200,220,255,0.85)';
      skyCtx.font = '11px sans-serif';
      skyCtx.fillText(st.name, st.px + rad + 3, st.py - rad - 2);
    }
  }
}

function drawConstellationLines(hiC, cAlt, cAz, halfFoV) {
  for (const abbr in CONST_LINES) {
    const isHi = (abbr === hiC);
    skyCtx.strokeStyle = isHi ? 'rgba(120,200,255,0.85)' : 'rgba(120,160,220,0.15)';
    skyCtx.lineWidth = isHi ? 1.8 : 0.8;
    skyCtx.beginPath();
    let drew = false;
    for (const [n1, n2] of CONST_LINES[abbr]) {
      const s1 = starAltAzCache.find(s => s.name === n1);
      const s2 = starAltAzCache.find(s => s.name === n2);
      if (!s1 || !s2 || s1.alt < -1 || s2.alt < -1) continue;
      const p1 = projectStar(s1.alt, s1.az, cAlt, cAz, halfFoV);
      const p2 = projectStar(s2.alt, s2.az, cAlt, cAz, halfFoV);
      if (!p1 || !p2) continue;
      skyCtx.moveTo(p1.px, p1.py); skyCtx.lineTo(p2.px, p2.py); drew = true;
    }
    if (drew) skyCtx.stroke();
  }
}

function updateConstellationInfo() {
  const info = $('constellation-info');
  if (!State.currentConstellation || !CONST_INFO[State.currentConstellation]) {
    info.classList.remove('show'); return;
  }
  const c = CONST_INFO[State.currentConstellation];
  $('const-cn').textContent = c.cn;
  $('const-latin').textContent = c.latin;
  $('const-sub').textContent = `${c.season} · ${c.hemi === '南' ? '南半球' : c.hemi === '北' ? '北半球' : '赤道附近'}可见`;
  info.classList.add('show');
}

/* ============ 5. 摄像头 ============ */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    State.videoStream = stream;
    const v = $('camera-video'); v.srcObject = stream; await v.play();
  } catch (e) {
    $('camera-video').style.background = 'radial-gradient(ellipse at center,#0a0a2a 0%,#000 90%)';
  }
}
function stopCamera() {
  if (State.videoStream) { State.videoStream.getTracks().forEach(t => t.stop()); State.videoStream = null; }
}

/* ============ 6. 拍照保存 ============ */
async function ensureFolder() {
  if (State.folderHandle) return State.folderHandle;
  if (!window.showDirectoryPicker) return null;
  try { const h = await window.showDirectoryPicker({ mode: 'readwrite' }); State.folderHandle = h; return h; }
  catch (e) { return null; }
}
async function takePhoto() {
  const video = $('camera-video');
  const W = video.videoWidth || window.innerWidth;
  const H = video.videoHeight || window.innerHeight;
  const cap = document.createElement('canvas');
  cap.width = W; cap.height = H;
  const cctx = cap.getContext('2d');
  if (video.videoWidth > 0) cctx.drawImage(video, 0, 0, W, H);
  else {
    const g = cctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W);
    g.addColorStop(0, '#0a0a2a'); g.addColorStop(1, '#000');
    cctx.fillStyle = g; cctx.fillRect(0, 0, W, H);
  }
  cctx.drawImage(skyCanvas, 0, 0, W, H);
  // 水印
  cctx.fillStyle = 'rgba(0,0,0,0.5)'; cctx.fillRect(10, H - 60, 280, 50);
  cctx.fillStyle = '#cdf'; cctx.font = '16px sans-serif';
  const cn = State.currentConstellation && CONST_INFO[State.currentConstellation] ? CONST_INFO[State.currentConstellation].cn : '未知星座';
  cctx.fillText(`星座: ${cn}`, 20, H - 38);
  cctx.font = '12px sans-serif'; cctx.fillStyle = '#7af';
  cctx.fillText(new Date().toLocaleString('zh-CN'), 20, H - 20);
  // 闪光
  const flash = $('flash'); flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 400);
  const blob = await new Promise(res => cap.toBlob(res, 'image/jpeg', 0.92));
  const folder = await ensureFolder();
  const fname = `stargaze_${State.currentConstellation || 'sky'}_${Date.now()}.jpg`;
  if (folder) {
    try {
      const fh = await folder.getFileHandle(fname, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      showToast(`已保存到文件夹: ${fname}`);
    } catch (e) { downloadBlob(blob, fname); showToast('保存到文件夹失败,已下载'); }
  } else { downloadBlob(blob, fname); showToast(`已下载: ${fname}`); }
}
function downloadBlob(blob, fname) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============ 7. 了解面板 - 抓取权威天文资料 ============ */
async function openLearnPanel() {
  const abbr = State.currentConstellation;
  const panel = $('learn-panel');
  const scroll = $('learn-scroll');
  if (!abbr || !CONST_INFO[abbr]) {
    $('learn-title').textContent = '请先朝向星座';
    $('learn-sub').textContent = '仰望夜空,识别星座后查看资料';
    scroll.innerHTML = '<div class="learn-loading" style="padding:80px 20px">未识别到星座,请将手机朝向天空并对准一组亮星<br/><br/>💡 也可在桌面端拖动屏幕模拟观星</div>';
    panel.classList.add('show');
    return;
  }
  const info = CONST_INFO[abbr];
  $('learn-title').textContent = `${info.cn} · ${info.latin}`;
  $('learn-sub').textContent = `${info.season}星座 · ${info.hemi === '南' ? '南半球' : info.hemi === '北' ? '北半球' : '赤道'}可见`;
  scroll.innerHTML = '<div class="learn-loading"><div class="spin"></div>正在从天文资料库抓取…</div>';
  panel.classList.add('show');

  const [wiki, nasa] = await Promise.allSettled([
    fetchWikipedia(info.wiki),
    fetchNASAImage(info)
  ]);
  const wikiData = wiki.status === 'fulfilled' ? wiki.value : null;
  const nasaData = nasa.status === 'fulfilled' ? nasa.value : null;
  renderTiles(info, abbr, wikiData, nasaData);
}

// 中文维基百科 REST API (CORS 友好)
async function fetchWikipedia(zhName) {
  const base = 'https://zh.wikipedia.org/api/rest_v1/page';
  const en = encodeURIComponent(zhName);
  const [sRes, mRes] = await Promise.allSettled([
    fetch(`${base}/summary/${en}`).then(r => r.json()),
    fetch(`${base}/media-list/${en}`).then(r => r.json())
  ]);
  const summary = sRes.status === 'fulfilled' ? sRes.value : null;
  const media = mRes.status === 'fulfilled' ? mRes.value : null;
  const images = [];
  if (media && media.items) {
    for (const it of media.items) {
      if (it.type === 'image' && it.thumbnail && it.thumbnail.source) {
        images.push({ src: it.thumbnail.source, caption: it.caption });
      }
      if (images.length >= 5) break;
    }
  }
  return {
    title: summary ? summary.title : zhName,
    description: summary ? summary.description : '',
    extract: summary ? summary.extract : '',
    thumbnail: summary && summary.originalimage ? summary.originalimage.source : (summary && summary.thumbnail ? summary.thumbnail.source : null),
    images
  };
}

// NASA 图片库 API (无需密钥)
async function fetchNASAImage(info) {
  try {
    const q = encodeURIComponent(`${info.latin} constellation`);
    const r = await fetch(`https://images-api.nasa.gov/search?q=${q}&media_type=image&page_size=3`);
    const d = await r.json();
    const items = (d.collection && d.collection.items) || [];
    return items.slice(0, 3).map(it => ({
      src: it.links && it.links[0] ? it.links[0].href : null,
      title: it.data && it.data[0] ? it.data[0].title : 'NASA',
      desc: it.data && it.data[0] ? it.data[0].description : '',
      source: 'NASA Image and Video Library'
    })).filter(x => x.src);
  } catch (e) { return []; }
}

function renderTiles(info, abbr, wiki, nasa) {
  const scroll = $('learn-scroll');
  let html = '';
  const constStars = STARS.filter(s => s[4] === abbr);
  const brightest = constStars.length ? constStars.reduce((a,b)=>a[3]<b[3]?a:b) : null;
  html += `<div class="tile"><div class="tile-body">
    <h3>📖 星座概览</h3>
    <p><b>${info.cn}</b>(拉丁语:<i>${info.latin}</i>),${info.season}星座,主要见于${info.hemi === '南' ? '南半球' : info.hemi === '北' ? '北半球' : '赤道附近'}夜空。${wiki && wiki.description ? wiki.description : ''}</p>
    <div class="meta">包含亮星 ${constStars.length} 颗${brightest ? ` · 最亮星:${brightest[0]}(视星等 ${brightest[3].toFixed(2)})` : ''}</div>
  </div></div>`;
  if (wiki && wiki.extract) {
    html += `<div class="tile">
      ${wiki.thumbnail ? `<div class="tile-img-wrap"><img src="${wiki.thumbnail}" alt="${info.cn}" onerror="this.parentNode.style.display='none'"><div class="img-source">维基百科</div></div>` : ''}
      <div class="tile-body"><h3>📚 详细介绍</h3><p>${wiki.extract}</p><div class="meta">来源:中文维基百科</div></div>
    </div>`;
  }
  if (wiki && wiki.images && wiki.images.length) {
    for (const img of wiki.images) {
      html += `<div class="tile">
        <div class="tile-img-wrap"><img src="${img.src}" alt="${img.caption || info.cn}" onerror="this.parentNode.parentNode.style.display='none'"><div class="img-source">维基百科</div></div>
        ${img.caption ? `<div class="tile-body"><p style="font-size:12px;color:#7af">${img.caption}</p></div>` : ''}
      </div>`;
    }
  }
  if (nasa && nasa.length) {
    for (const n of nasa) {
      html += `<div class="tile">
        <div class="tile-img-wrap"><img src="${n.src}" alt="${n.title}" onerror="this.parentNode.parentNode.style.display='none'"><div class="img-source">NASA</div></div>
        <div class="tile-body"><h3>🛰 ${n.title}</h3><p>${(n.desc || '').slice(0, 200)}${n.desc && n.desc.length > 200 ? '…' : ''}</p><div class="meta">来源:${n.source}</div></div>
      </div>`;
    }
  }
  html += `<div class="tile"><div class="tile-body">
    <h3>🔗 权威资料扩展阅读</h3>
    <p style="font-size:12px;line-height:2.2">
      <a href="https://zh.wikipedia.org/wiki/${encodeURIComponent(info.wiki)}" target="_blank">中文维基百科</a> ·
      <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(info.latin)}" target="_blank">English Wikipedia</a> ·
      <a href="https://www.iau.org/public/themes/constellations/" target="_blank">IAU 国际天文联合会</a> ·
      <a href="https://www.nasa.gov/" target="_blank">NASA</a> ·
      <a href="https://www.eso.org/public/images/" target="_blank">ESO 欧南台</a> ·
      <a href="https://simbad.u-strasbg.fr/" target="_blank">SIMBAD 天文数据库</a> ·
      <a href="https://ned.ipac.caltech.edu/" target="_blank">NED NASA地外数据库</a>
    </p>
  </div></div>`;
  if (!wiki && !nasa) {
    html = `<div class="tile"><div class="tile-body"><h3>暂无在线资料</h3><p>无法连接到天文资料库,请检查网络后重试。星座:${info.cn}(${info.latin})</p></div></div>` + html;
  }
  scroll.innerHTML = html;
}
function closeLearnPanel() { $('learn-panel').classList.remove('show'); }

/* ============ 8. 流程控制 ============ */
async function start() {
  setTimeout(() => $('loading').classList.add('hide'), 800);
  const loc = await getLocation();
  State.lat = loc.lat; State.lon = loc.lon;
  const placeName = await reverseGeocode(loc.lat, loc.lon);
  $('loc-name').textContent = loc.fallback ? '默认位置(北京)' : placeName;
  $('loc-coords').textContent = `${loc.lat.toFixed(4)}° ${loc.lat>=0?'N':'S'}  ${loc.lon.toFixed(4)}° ${loc.lon>=0?'E':'W'}${loc.accuracy ? `  ±${loc.accuracy.toFixed(0)}m` : ''}`;
  $('earth-view').classList.add('show');
  initEarth(loc.lat, loc.lon);
}
function enterSky() {
  $('earth-view').classList.remove('show');
  $('sky-view').classList.add('show');
  startCamera();
  setupOrientation();
  initSkyCanvas();
  setTimeout(() => { if (!State.hasOrientation) showDesktopHint(); }, 2000);
}
function backToEarth() {
  $('sky-view').classList.remove('show');
  $('earth-view').classList.add('show');
  stopCamera();
  if (skyRAF) cancelAnimationFrame(skyRAF);
}

// 事件绑定
$('start-btn').addEventListener('click', enterSky);
$('back-btn').addEventListener('click', backToEarth);
$('learn-btn').addEventListener('click', openLearnPanel);
$('learn-close').addEventListener('click', closeLearnPanel);
$('photo-btn').addEventListener('click', takePhoto);
$('learn-panel').addEventListener('click', (e) => { if (e.target === $('learn-panel')) closeLearnPanel(); });

// 启动
start();
