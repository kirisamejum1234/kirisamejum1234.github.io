/* すいはき算 Service Worker
   アプリ本体を端末に保存し、2回目以降は通信なし（機内モード等）でも
   起動・出題・判定まで動くようにする。
   CACHE の版数はアプリの版数（suihaki_zan.py の APP_VERSION）と必ず
   そろえること。版数が変わると新しいキャッシュに切り替わり、古い
   キャッシュは activate のときに削除される */
const CACHE = "suihaki-zan-20261123-8";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 1つでも取れないものがあっても、取れた分は保存して前に進む
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("suihaki-zan-") && k !== CACHE)
            .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // 画面の読み込みは、まず通信で最新を取りに行き（更新を取りこぼさない）、
    // 通信できないときだけ保存分を返す
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then((m) => {
          if (m) return m;
          return caches.match("./index.html", { ignoreSearch: true });
        })
      )
    );
    return;
  }
  // それ以外（アイコン・マニフェスト等）は保存分を優先し、
  // なければ通信で取って保存する
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((m) => m || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
