'use client';
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function SystemPromptModal({
   chatId,
   initialPrompt,
   onClose,
   onSave,
}: {
   chatId: string;
   initialPrompt: string;
   onClose: () => void;
   onSave: (prompt: string) => Promise<void>;
}) {
   const [value, setValue] = useState(initialPrompt);
   const [saving, setSaving] = useState(false);
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   useEffect(() => {
      textareaRef.current?.focus();
   }, []);

   useEffect(() => {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
   }, [onClose]);

   async function handleSave() {
      setSaving(true);
      try { await onSave(value); onClose(); }
      catch { /* ignore — caller shows toast */ }
      finally { setSaving(false); }
   }

   void chatId;

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
         <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
               <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">System Prompt</h2>
               <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300"
               >
                  <X size={18} />
               </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
               Customize the AI&apos;s behavior for this conversation. Leave empty to use the default prompt.
            </p>
            <textarea
               ref={textareaRef}
               value={value}
               onChange={(e) => setValue(e.target.value)}
               placeholder="You are a helpful assistant."
               rows={6}
               className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
               >
                  Cancel
               </button>
               <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
               >
                  {saving ? 'Saving…' : 'Save'}
               </button>
            </div>
         </div>
      </div>
   );
}
