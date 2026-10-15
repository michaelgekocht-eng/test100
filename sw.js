// 通信できるときは最新版を取得し、オフライン時や電波が弱いときは保存済みの版を使います
// (ocr/ フォルダの読み取りエンジンは大きいので、一度保存したら保存済みを優先して使います)
const VERSION = "nippo-v12";
const FILES = ["./","./index.html","./jsQR.js","./manifest.json",
  "./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png"];
const OCR_FILES = ["./ocr/tesseract.min.js","./ocr/worker.min.js","./ocr/tesseract-core-simd-lstm.wasm.js",
  "./ocr/tesseract-core-lstm.wasm.js","./ocr/lang/eng.traineddata.gz"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VERSION).then(async c=>{
    await c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})));
    // 読み取りエンジンは裏で保存する(失敗しても本体の動作には影響しない)
    Promise.allSettled(OCR_FILES.map(f=>c.add(f)));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const u = new URL(e.request.url);
  if(e.request.method!=="GET" || u.origin!==location.origin) return; // 住所検索などは通常通信
  e.respondWith((async()=>{
    const cache = await caches.open(VERSION);
    const cached = await cache.match(e.request, {ignoreSearch:true});
    if(cached && u.pathname.includes("/ocr/")) return cached;           // 読み取りエンジン: 保存済み優先
    try{
      const net = fetch(e.request, {cache:"no-cache"});
      const res = cached ? await Promise.race([net, new Promise((_,ng)=>setTimeout(()=>ng(new Error("timeout")), 3000))]) : await net;
      if(res && res.ok) cache.put(e.request, res.clone());
      return res;
    }catch(err){
      return cached || (await cache.match("./index.html")) || Response.error();
    }
  })());
});
