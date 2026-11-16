"use client";

/** إعادة تحميل كاملة: نحدّث الـ Service Worker ونمسح كاش الصفحات (بياناتك ما تنمسح) */
export async function hardReload() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    for (const k of await caches.keys()) if (k.startsWith("pages-")) await caches.delete(k);
  } catch {}
  location.reload();
}
