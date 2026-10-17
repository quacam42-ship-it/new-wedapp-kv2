// Ép cài đặt ngay lập tức không cần chờ đợi hay kiểm tra file
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); 
});

self.addEventListener('fetch', (event) => {
    // Ưu tiên lấy dữ liệu mới nhất từ mạng (Network-first)
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});