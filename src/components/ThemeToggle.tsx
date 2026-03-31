'use client';
import { useTheme } from './ThemeProvider';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
   const { theme, setTheme } = useTheme();

   return (
      <button
         type="button"
         onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
         title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
         className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
      >
         {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
   );
}
