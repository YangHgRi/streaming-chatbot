'use client';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarProvider';

export function MobileSidebarToggle() {
   const { toggle, isOpen } = useSidebar();

   return (
      <button
         type="button"
         onClick={toggle}
         aria-label="Toggle sidebar"
         aria-expanded={isOpen}
         className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors md:hidden shrink-0"
      >
         <Menu size={20} />
      </button>
   );
}
