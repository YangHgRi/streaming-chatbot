'use client';
import { useTheme } from '@wrksz/themes/client';
import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

// useSyncExternalStore with a no-op subscribe and differing server/client snapshots
// is the recommended way to detect client-side mount without useEffect + setState.
const subscribe = () => () => { };
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
   const { resolvedTheme, setTheme } = useTheme();
   // Avoid hydration mismatch: false on server, true on client after hydration
   const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

   return (
      <button
         type="button"
         onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
         title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
         className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
      >
         {mounted
            ? (resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />)
            : <span className="w-[18px] h-[18px] block" />
         }
      </button>
   );
}
