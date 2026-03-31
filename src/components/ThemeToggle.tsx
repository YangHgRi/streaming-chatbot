'use client';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
   const { resolvedTheme, setTheme } = useTheme();
   // Avoid hydration mismatch: don't render the icon until mounted on client
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);

   return (
      <button
         type="button"
         onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
         title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
         className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
         suppressHydrationWarning
      >
         {/* Render a fixed-size placeholder until mounted to prevent layout shift */}
         {mounted
            ? (resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />)
            : <span className="w-[18px] h-[18px] block" />
         }
      </button>
   );
}
