import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarProvider";
import "./globals.css";

const geistSans = Geist({
   variable: "--font-geist-sans",
   subsets: ["latin"],
});

const geistMono = Geist_Mono({
   variable: "--font-geist-mono",
   subsets: ["latin"],
});

export const metadata: Metadata = {
   title: "Streaming Chat",
   description: "AI streaming chatbot",
};

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>) {
   return (
      <html
         lang="en"
         suppressHydrationWarning
         className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
         <head>
            <Script
               id="theme-init"
               strategy="beforeInteractive"
               dangerouslySetInnerHTML={{
                  __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`
               }}
            />
         </head>
         <body className="h-full flex overflow-hidden">
            {/* Skip-to-content link for keyboard users */}
            <a
               href="#main-content"
               className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg"
            >
               Skip to main content
            </a>
            <SidebarProvider>
               <Sidebar />
               <main id="main-content" className="flex-1 overflow-hidden">
                  {children}
               </main>
            </SidebarProvider>
         </body>
      </html>
   );
}
