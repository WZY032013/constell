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
  folderHandle: null,
  locSource: '',        // 定位来源:GPS / 网络 / 缓存
  watchId: null,
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

/* ============ 1. 精准定位(多级回退:GPS → 缓存 → IP → 默认) ============ */
const LOC_KEY = 'stargaze_last_loc';
function saveLocCache(loc) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify({ lat: loc.lat, lon: loc.lon, t: Date.now() })); } catch (e) {}
}
function loadLocCache() {
  try {
    const d = JSON.parse(localStorage.getItem(LOC_KEY));
    if (d && typeof d.lat === 'number' && typeof d.lon === 'number') return d;
  } catch (e) {}
  return null;
}
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // 无定位API → 缓存或IP
      const c = loadLocCache();
      if (c) { resolve({ lat: c.lat, lon: c.lon, accuracy: null, source: 'cache' }); return; }
      ipLocate(resolve); return;
    }
    let done = false;
    const finish = (loc) => { if (!done) { done = true; resolve(loc); } };
    // 先快速返回缓存位置(若有),再后台用 GPS 精化
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, source: 'GPS' };
        saveLocCache(loc); finish(loc);
        // 持续监听,逐步提高精度
        startWatch(loc);
      },
      async () => {
        // GPS失败 → 缓存 → IP → 默认
        const c = loadLocCache();
        if (c) { finish({ lat: c.lat, lon: c.lon, accuracy: null, source: 'cache' }); return; }
        ipLocate(finish);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
    // 2秒内没拿到GPS就先给缓存/IP,避免界面卡住
    setTimeout(() => {
      if (!done) {
        const c = loadLocCache();
        if (c) finish({ lat: c.lat, lon: c.lon, accuracy: null, source: 'cache' });
        else ipLocate(finish);
      }
    }, 2000);
  });
}
function ipLocate(resolve) {
  fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(d => {
      if (d.latitude && d.longitude) {
        resolve({ lat: d.latitude, lon: d.longitude, accuracy: null, source: 'IP', ipCity: d.city, ipRegion: d.region });
      } else resolve({ lat: 39.9042, lon: 116.4074, fallback: true, source: 'default' });
    })
    .catch(() => resolve({ lat: 39.9042, lon: 116.4074, fallback: true, source: 'default' }));
}
// 持续监听GPS,精度更高时更新位置
function startWatch(initial) {
  if (State.watchId !== null || !navigator.geolocation) return;
  State.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const acc = pos.coords.accuracy || Infinity;
      if (acc < 200) {
        State.lat = pos.coords.latitude; State.lon = pos.coords.longitude;
        saveLocCache({ lat: State.lat, lon: State.lon });
        updateLocUI({ lat: State.lat, lon: State.lon, accuracy: acc, source: 'GPS' });
        rotateEarthTo(State.lat, State.lon);
        if (acc < 50 && State.watchId !== null) { navigator.geolocation.clearWatch(State.watchId); State.watchId = null; }
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=zh`, { signal: AbortSignal.timeout(5000) });
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
  const ambient = new THREE.AmbientLight(0x404060, 0.35); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 1.5, 4); scene.add(sun);

  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 128),
    new THREE.MeshPhongMaterial({
      map: createEarthTexture(),
      shininess: 18,
      specular: new THREE.Color(0x334466)
    })
  );
  scene.add(earthMesh);
  const earth = earthMesh;

  // 细带光大气(菲涅尔锐化,仅边缘细线发光)
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0x5aafff) } },
    vertexShader: `varying vec3 vN; varying vec3 vPos; void main(){ vN=normalize(normalMatrix*normal); vPos=(modelViewMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 glowColor; varying vec3 vN; varying vec3 vPos; void main(){ vec3 viewDir=normalize(-vPos); float rim=1.0-max(dot(viewDir,vN),0.0); float i=pow(rim,8.0)*0.9+pow(rim,20.0)*0.3; gl_FragColor=vec4(glowColor,i); }`,
    blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 128, 128), atmoMat));

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
  earth.rotation.x = latR;

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
  State.earthScene = { raf, onResize, earth };
  // 异步加载真实高清地球纹理(不阻塞首屏)
  loadRealEarthTexture(earthMesh, renderer);
}

// 加载真实高清地球纹理(多源容错 + 完整材质替换)
let realTextureLoadStarted = false;
function loadRealEarthTexture(earthMesh, renderer) {
  if (realTextureLoadStarted) return;
  realTextureLoadStarted = true;

  const sources = [
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    'https://threejs.org/examples/textures/planets/earth_atmos_2004.jpg',
    'https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/night_earth_8k.jpg'
  ];

  let idx = 0;
  const tryNext = () => {
    if (idx >= sources.length) {
      console.warn('[Earth] 所有纹理源均加载失败,保留程序化纹理');
      return;
    }
    const url = sources[idx++];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('[Earth] 图片下载完成:', img.width + 'x' + img.height);
      try {
        const tex = new THREE.Texture(img);
        if (THREE.SRGBColorSpace) { tex.colorSpace = THREE.SRGBColorSpace; }
        if (renderer && renderer.capabilities) {
          const max = renderer.capabilities.getMaxAnisotropy();
          if (max > 1) tex.anisotropy = max;
        }
        tex.needsUpdate = true;
        // 完整替换材质,避免 map 属性更新不生效
        const oldMat = earthMesh.material;
        const newMat = new THREE.MeshPhongMaterial({
          map: tex,
          shininess: 18,
          specular: new THREE.Color(0x334466)
        });
        earthMesh.material = newMat;
        // 释放旧材质
        if (oldMat.map) oldMat.map.dispose();
        oldMat.dispose();
        console.log('[Earth] 真实纹理应用成功:', url);
      } catch (e) {
        console.error('[Earth] 纹理应用异常:', e.message);
        tryNext();
      }
    };
    img.onerror = () => {
      console.warn('[Earth] 图片加载失败,尝试下一源:', url);
      tryNext();
    };
    img.src = url;
  };

  setTimeout(tryNext, 300);
}

// 保留程序化纹理作为兜底(加载失败时使用)
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

/* ============ 3. 设备朝向(完整旋转矩阵,精确推算指向) ============ */
let orientPreferAbsolute = false, orientGotAbsolute = false;
function setupOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') bindOrient(); else showDesktopHint(); }).catch(() => showDesktopHint());
  } else { bindOrient(); }
}
function bindOrient() {
  window.addEventListener('deviceorientationabsolute', (e) => { orientGotAbsolute = true; onOrient(e, true); }, true);
  window.addEventListener('deviceorientation', (e) => { if (!orientGotAbsolute) onOrient(e, false); }, true);
  setTimeout(() => { if (!State.hasOrientation) showDesktopHint(); }, 2500);
}
/* 由设备姿态(alpha/beta/gamma)推算摄像头指向的 方位角/仰角
 * 采用 W3C 旋转矩阵 R = Rz(α)·Rx(β)·Ry(γ),取后置摄像头方向(-z轴)
 * 半球/纬度不影响该换算(地平坐标由指向向量直接得出) */
function pointingFromOrientation(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  // 设备 z 轴在世界坐标(东,北,天)中的方向
  const zx = cA * sG + sA * sB * cG;
  const zy = sA * sG - cA * sB * cG;
  const zz = cB * cG;
  // 后置摄像头指向 = -z
  const px = -zx, py = -zy, pz = -zz;
  const alt = Math.asin(clamp(pz, -1, 1)) / DEG;
  let az = Math.atan2(px, py) / DEG;   // 以北为0,顺时针(东=90)
  az = (az + 360) % 360;
  return { alt, az };
}
function onOrient(e, isAbsolute) {
  if (e.alpha === null && e.beta === null && e.gamma === null) return;
  let alphaNorth;
  if (typeof e.webkitCompassHeading === 'number') {
    // iOS:webkitCompassHeading 为罗盘航向,换算为以北为基准的 alpha
    alphaNorth = (360 - e.webkitCompassHeading) % 360;
  } else if (isAbsolute) {
    alphaNorth = e.alpha;
  } else if (e.alpha !== null) {
    // 相对 alpha(无罗盘),近似使用
    alphaNorth = e.alpha;
  } else return;
  State.hasOrientation = true;
  $('desktop-hint').classList.remove('show');
  const p = pointingFromOrientation(alphaNorth, e.beta || 0, e.gamma || 0);
  State.altitude = clamp(p.alt, -90, 90);
  State.azimuth = p.az;
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
let starByName = {};          // 名称 → 当前 alt/az 缓存,供连线查找
let starSprites = {};         // 预渲染星点 sprite: key=半径, value=canvas
let lastFrameT = 0;           // 上一帧时间戳,用于节流

// 预渲染星点 sprite(按半径整数缓存,避免每帧创建渐变)
function getStarSprite(radius, r, g, b) {
  const key = Math.round(radius * 10) + '_' + r + '_' + g + '_' + b;
  if (starSprites[key]) return starSprites[key];
  const size = Math.ceil(radius * 6) + 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d');
  const mid = size / 2;
  const grad = cx.createRadialGradient(mid, mid, 0, mid, mid, radius * 3);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.6)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  cx.fillStyle = grad;
  cx.beginPath(); cx.arc(mid, mid, radius * 3, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,1)';
  cx.beginPath(); cx.arc(mid, mid, radius * 0.6, 0, Math.PI * 2); cx.fill();
  starSprites[key] = c;
  return c;
}

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
// 优先用 astronomy-engine;无网络/库缺失时用内置 GMST 公式离线计算
function computeStarPositions() {
  if (State.lat === null) return;
  const time = new Date();
  const hasAstro = typeof Astronomy !== 'undefined' && Astronomy.Horizon;
  starByName = {};
  if (hasAstro) {
    const observer = new Astronomy.Observer(State.lat, State.lon, 0);
    starAltAzCache = STARS.map(s => {
      let alt = -90, az = 0;
      try {
        const hor = Astronomy.Horizon(time, observer, s[1], s[2], 'normal');
        alt = hor.altitude; az = hor.azimuth;
      } catch (e) {}
      const obj = { name: s[0], mag: s[3], const: s[4], bv: s[5], alt, az };
      starByName[s[0]] = obj;
      return obj;
    });
  } else {
    // 离线:GMST → 时角 → 地平坐标(精度足够观星)
    const lst = localSiderealTime(time, State.lon);
    starAltAzCache = STARS.map(s => {
      const raH = s[1], dec = s[2];
      const ha = (lst - raH) * 15;           // 时角(度)
      const p = equatorialToHorizontal(ha, dec, State.lat);
      const obj = { name: s[0], mag: s[3], const: s[4], bv: s[5], alt: p.alt, az: p.az };
      starByName[s[0]] = obj;
      return obj;
    });
  }
}
// 本地恒星时(小时)
function localSiderealTime(date, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  let gmst = 280.46061837 + 360.98564736629 * d;
  gmst = ((gmst % 360) + 360) % 360;
  return ((gmst + lon) / 15) % 24;
}
// 时角/赤纬/纬度 → 地平坐标(高度/方位)
function equatorialToHorizontal(haDeg, decDeg, latDeg) {
  const ha = haDeg * DEG, dec = decDeg * DEG, lat = latDeg * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const y = -Math.sin(ha) * Math.cos(dec);
  const x = Math.cos(dec) * Math.sin(lat) * Math.cos(ha) - Math.sin(dec) * Math.cos(lat);
  let az = Math.atan2(y, x) / DEG;
  az = (az + 360) % 360;
  return { alt: alt / DEG, az };
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

// 预计算中心方向向量与切面基,避免每颗星重复算
// c=指向向量, u=天顶方向(仰角增大方向), r=c×u=屏幕右方向
function makeBasis(cAlt, cAz) {
  const caR = cAlt*DEG, czR = cAz*DEG;
  return {
    cx: Math.cos(caR)*Math.sin(czR), cy: Math.cos(caR)*Math.cos(czR), cz: Math.sin(caR),
    ux: -Math.sin(caR)*Math.sin(czR), uy: -Math.sin(caR)*Math.cos(czR), uz: Math.cos(caR),
    rx: Math.cos(czR), ry: -Math.sin(czR), rz: 0,
    tH: Math.tan(45 * DEG)
  };
}

function renderSky(ts) {
  skyRAF = requestAnimationFrame(renderSky);
  // 节流到约 30fps,降低 CPU/GPU 压力
  if (ts - lastFrameT < 33) return;
  lastFrameT = ts;
  if (!skyCtx) return;
  const W = window.innerWidth, H = window.innerHeight;
  skyCtx.clearRect(0, 0, W, H);

  // 仰角低于地平线 → 显示警告(但保留移动提示)
  if (State.altitude < 5) {
    $('horizon-warning').classList.add('show');
    if (!State.currentConstellation) updateConstellationInfo();
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
  const basis = makeBasis(cAlt, cAz);
  const tH = basis.tH, halfW = W * 0.5, halfH = H * 0.5;

  // 一次投影所有可见星,同时统计星座亮星数
  const visible = [];
  const counts = {};
  const sumPos = {};   // 星座可见亮星的方向向量累加(用于质心角距)
  for (const st of starAltAzCache) {
    if (st.alt < -1) continue;
    const aR = st.alt*DEG, azR = st.az*DEG;
    const sx = Math.cos(aR)*Math.sin(azR), sy = Math.cos(aR)*Math.cos(azR), sz = Math.sin(aR);
    const cosA = sx*basis.cx + sy*basis.cy + sz*basis.cz;
    if (cosA <= 0.05) continue;
    const x = (sx*basis.rx + sy*basis.ry + sz*basis.rz) / cosA;
    const y = (sx*basis.ux + sy*basis.uy + sz*basis.uz) / cosA;
    const px = (x/tH + 1)*halfW, py = (-y/tH + 1)*halfH;
    visible.push({ name: st.name, mag: st.mag, const: st.const, bv: st.bv, px, py });
    if (st.mag < 4.5) {
      counts[st.const] = (counts[st.const] || 0) + 1;
      if (!sumPos[st.const]) sumPos[st.const] = { x: 0, y: 0, z: 0 };
      sumPos[st.const].x += sx; sumPos[st.const].y += sy; sumPos[st.const].z += sz;
    }
  }

  // 识别当前面对的星座:亮星数≥2,且星座质心与视线夹角最小
  let topC = null, bestScore = -1;
  for (const c in counts) {
    if (counts[c] < 2) continue;
    const sp = sumPos[c];
    const len = Math.sqrt(sp.x*sp.x + sp.y*sp.y + sp.z*sp.z);
    const cosAng = (sp.x*basis.cx + sp.y*basis.cy + sp.z*basis.cz) / len;
    // 得分:亮星数 + 对准程度(cos越接近1越正对)
    const score = counts[c] + cosAng * 2;
    if (score > bestScore) { bestScore = score; topC = c; }
  }
  if (topC !== State.currentConstellation) {
    State.currentConstellation = topC; updateConstellationInfo();
  }

  // 星座连线(当前星座高亮)
  drawConstellationLines(topC, basis, tH, halfW, halfH);

  // 恒星 — 用预渲染 sprite,drawImage 远比 createRadialGradient 快
  for (const st of visible) {
    const [r, g, b] = starColor(st.bv);
    const rad = starRadius(st.mag);
    const sprite = getStarSprite(rad, r, g, b);
    skyCtx.drawImage(sprite, st.px - sprite.width / 2, st.py - sprite.height / 2);
    if (st.mag < 1.5) {
      skyCtx.fillStyle = 'rgba(200,220,255,0.85)';
      skyCtx.font = '11px sans-serif';
      skyCtx.fillText(st.name, st.px + rad + 3, st.py - rad - 2);
    }
  }
}

// 连线:仅绘制当前星座
function drawConstellationLines(hiC, basis, tH, halfW, halfH) {
  if (!hiC || !CONST_LINES[hiC]) return;
  skyCtx.strokeStyle = 'rgba(120,200,255,0.85)';
  skyCtx.lineWidth = 1.8;
  skyCtx.beginPath();
  let drew = false;
  for (const [n1, n2] of CONST_LINES[hiC]) {
    const s1 = starByName[n1], s2 = starByName[n2];
    if (!s1 || !s2 || s1.alt < -1 || s2.alt < -1) continue;
    let p1 = null, p2 = null;
    for (const s of [s1, s2]) {
      const aR = s.alt*DEG, azR = s.az*DEG;
      const sx = Math.cos(aR)*Math.sin(azR), sy = Math.cos(aR)*Math.cos(azR), sz = Math.sin(aR);
      const cosA = sx*basis.cx + sy*basis.cy + sz*basis.cz;
      if (cosA <= 0.05) break;
      const x = (sx*basis.rx + sy*basis.ry + sz*basis.rz) / cosA;
      const y = (sx*basis.ux + sy*basis.uy + sz*basis.uz) / cosA;
      const pt = { px: (x/tH + 1)*halfW, py: (-y/tH + 1)*halfH };
      if (s === s1) p1 = pt; else p2 = pt;
    }
    if (!p1 || !p2) continue;
    skyCtx.moveTo(p1.px, p1.py); skyCtx.lineTo(p2.px, p2.py); drew = true;
  }
  if (drew) skyCtx.stroke();
}

function updateConstellationInfo() {
  const info = $('constellation-info');
  if (!State.currentConstellation || !CONST_INFO[State.currentConstellation]) {
    $('const-cn').textContent = '请移动手机';
    $('const-latin').textContent = '对准夜空中的星座';
    $('const-sub').textContent = '仰望天空,对准一组亮星';
    info.classList.add('show'); return;
  }
  const c = CONST_INFO[State.currentConstellation];
  $('const-cn').textContent = c.cn;
  $('const-latin').textContent = c.latin;
  $('const-sub').textContent = `${c.season} · ${c.hemi === '南' ? '南半球' : c.hemi === '北' ? '北半球' : '赤道附近'}可见`;
  info.classList.add('show');
}

/* ============ 5. 定位UI辅助 ============ */
function updateLocUI(loc) {
  const accText = loc.accuracy ? `  ±${loc.accuracy.toFixed(0)}m` : '';
  $('loc-coords').textContent = `${loc.lat.toFixed(4)}° ${loc.lat>=0?'N':'S'}  ${loc.lon.toFixed(4)}° ${loc.lon>=0?'E':'W'}${accText}`;
  if (loc.ipCity) {
    $('loc-name').textContent = `${loc.ipCity}${loc.ipRegion ? ', ' + loc.ipRegion : ''}`;
  } else if (loc.source === 'GPS') {
    reverseGeocode(loc.lat, loc.lon).then(name => { $('loc-name').textContent = name; });
  } else if (loc.source === 'cache') {
    $('loc-name').textContent = '上次定位位置';
    reverseGeocode(loc.lat, loc.lon).then(name => { if (name !== '当前位置') $('loc-name').textContent = name; });
  } else if (loc.fallback) {
    $('loc-name').textContent = '默认位置(北京)';
  }
}
function rotateEarthTo(lat, lon) {
  if (State.earthScene && State.earthScene.earth) {
    const latR = lat * DEG, lonR = lon * DEG;
    State.earthScene.earth.rotation.y = -lonR + Math.PI / 2;
    State.earthScene.earth.rotation.x = latR;
  }
}

/* ============ 6. 了解面板 - 抓取权威天文资料 ============ */
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
  // 立即隐藏加载页
  $('loading').classList.add('hide');

  // 先用缓存/默认位置初始化地球,让界面立刻可交互
  const cached = loadLocCache();
  const initLat = cached ? cached.lat : 39.9042;
  const initLon = cached ? cached.lon : 116.4074;
  State.lat = initLat; State.lon = initLon;
  $('loc-name').textContent = '定位中…';
  $('loc-coords').textContent = '';
  $('earth-view').classList.add('show');
  initEarth(initLat, initLon);

  // 多级回退定位(不阻塞地球渲染)
  getLocation().then((loc) => {
    State.lat = loc.lat; State.lon = loc.lon;
    State.locSource = loc.source || '';
    updateLocUI(loc);
    rotateEarthTo(loc.lat, loc.lon);
  });
}

// 地球 → 夜空 过渡动画
function enterSky() {
  const overlay = $('transition-overlay');
  overlay.classList.add('active');
  // 过渡动画播放后再切换到天空页
  setTimeout(() => {
    $('earth-view').classList.remove('show');
    $('sky-view').classList.add('show');
    setupOrientation();
    initSkyCanvas();
    setTimeout(() => { if (!State.hasOrientation) showDesktopHint(); }, 2000);
    // 淡出过渡层
    setTimeout(() => overlay.classList.remove('active'), 350);
  }, 700);
}
function backToEarth() {
  const overlay = $('transition-overlay');
  overlay.classList.add('active');
  setTimeout(() => {
    $('sky-view').classList.remove('show');
    $('earth-view').classList.add('show');
    if (skyRAF) cancelAnimationFrame(skyRAF);
    setTimeout(() => overlay.classList.remove('active'), 350);
  }, 700);
}

// 事件绑定
$('start-btn').addEventListener('click', enterSky);
$('back-btn').addEventListener('click', backToEarth);
$('learn-btn').addEventListener('click', openLearnPanel);
$('learn-close').addEventListener('click', closeLearnPanel);
$('learn-panel').addEventListener('click', (e) => { if (e.target === $('learn-panel')) closeLearnPanel(); });

// 启动
start();
