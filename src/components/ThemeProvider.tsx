'use client';
/**
 * Minimal theme provider for React 19 / Next.js App Router.
 *
 * Strategy: inject a <script> as a raw DOM string via dangerouslySetInnerHTML
 * only on the SERVER (SSR pass). On the client we skip it entirely — React 19
 * refuses to execute <script> tags rendered by components, but the browser
 * already ran the server-injected copy before hydration, so the class is
 * already on <html> and no re-injection is needed.
 */

import { createContext, useContext, useEffect, useState } from 'react';

// ─── Context ─────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark';

const ThemeCtx = createContext<{
   theme: Theme;
   setTheme: (t: Theme) => void;
}>({ theme: 'light', setTheme: () => { } });

export function useTheme() {
   return useContext(ThemeCtx);
}

// ─── Inline script (SSR-only) ─────────────────────────────────────────────────
// Runs before React hydrates: reads localStorage / system pref and adds 'dark'
// to <html>. Written as a self-contained IIFE so it never leaks variables.

const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s===null&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark')}catch(e){}})()`;

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
   const [theme, setThemeState] = useState<Theme>('light');

   // Read actual DOM state after mount (avoids SSR mismatch)
   useEffect(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeState(isDark ? 'dark' : 'light');
   }, []);

   function setTheme(next: Theme) {
      setThemeState(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem('theme', next); } catch { }
   }

   return (
      <ThemeCtx.Provider value={{ theme, setTheme }}>
         {/* Inject theme-init script only during SSR. On the client this node
             is already present in the DOM from the server HTML and React won't
             touch it (suppressHydrationWarning on <html>). We guard with
             typeof window check so this branch only runs server-side. */}
         {typeof window === 'undefined' && (
            // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
            <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
         )}
         {children}
      </ThemeCtx.Provider>
   );
}
