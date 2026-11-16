import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { Providers } from "@/components/Providers";

// الخطوط تنحمل وقت البناء وتنخدم من التطبيق نفسه (تشتغل بدون إنترنت)
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "لياقتي",
  description: "سجل الأكل والوزن والخطوات والتمارين",
  applicationName: "لياقتي",
  appleWebApp: { capable: true, title: "لياقتي", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

// يطبّق اللغة والاتجاه والوضع الداكن قبل ما تظهر الصفحة
const bootScript = `try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.classList.toggle('dark',d);var l=localStorage.getItem('locale')||'ar';h.lang=l;h.dir=l==='ar'?'rtl':'ltr';var a=localStorage.getItem('accent')||'gold';h.dataset.accent=a;var q=function(s){return document.querySelector(s)};q('link[rel=manifest]').href='/manifest.webmanifest?accent='+a;q('link[rel=apple-touch-icon]').href='/icons/'+a+'/apple-touch-icon.png';q('link[rel=icon]').href='/icons/'+a+'/icon-192.png'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${plex.variable} ${inter.variable}`}>
      <head>
        {/* الأيقونات وملف التطبيق حسب ثيم الألوان (السكربت تحتها يغيّرها قبل ما يقرأها الجوال) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <main className="mx-auto w-full max-w-xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:max-w-4xl md:px-8">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
