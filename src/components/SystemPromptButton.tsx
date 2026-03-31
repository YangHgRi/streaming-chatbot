'use client';
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { SystemPromptModal } from './SystemPromptModal';

export function SystemPromptButton({
   chatId,
   initialPrompt,
   onSave,
}: {
   chatId: string;
   initialPrompt: string;
   onSave: (prompt: string) => Promise<void>;
}) {
   const [open, setOpen] = useState(false);

   return (
      <>
         <button
            type="button"
            onClick={() => setOpen(true)}
            title="System prompt"
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs font-medium"
         >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">Prompt</span>
         </button>
         {open && (
            <SystemPromptModal
               chatId={chatId}
               initialPrompt={initialPrompt}
               onClose={() => setOpen(false)}
               onSave={onSave}
            />
         )}
      </>
   );
}
