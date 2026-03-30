'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Chat } from '@/lib/db/schema';
import { useSidebar } from './SidebarProvider';

interface SidebarClientProps {
   chats: Chat[];
   createChatAction: () => Promise<void>;
   renameChatAction: (chatId: string, formData: FormData) => Promise<void>;
   deleteChatAction: (chatId: string) => Promise<void>;
}

// ─── RenameInput ───────────────────────────────────────────────────────────────
// isCancellingRenameRef lives inside this per-chat component so concurrent blur
// events from different chat rows never share the same flag.
function RenameInput({
   chatId,
   defaultTitle,
   renameChatAction,
   onDone,
}: {
   chatId: string;
   defaultTitle: string;
   renameChatAction: (chatId: string, formData: FormData) => Promise<void>;
   onDone: () => void;
}) {
   const isCancellingRef = useRef(false);

   return (
      <form
         action={renameChatAction.bind(null, chatId)}
         className="flex-1 min-w-0 px-2 py-1"
         onSubmit={() => {
            // Suppress the onBlur that fires immediately after submit (input losing
            // focus during unmount), which would otherwise call requestSubmit() twice.
            isCancellingRef.current = true;
            onDone();
         }}
      >
         <input
            type="text"
            name="title"
            defaultValue={defaultTitle}
            placeholder="Rename conversation…"
            autoFocus
            className="w-full min-w-0 text-sm text-white bg-transparent border border-gray-500 rounded px-1 py-1 focus:outline-none focus:border-blue-400"
            onKeyDown={(e) => {
               if (e.key === 'Escape') {
                  // Set flag BEFORE triggering blur so the onBlur handler can bail out.
                  // React event order: keyDown → blur → re-render.
                  isCancellingRef.current = true;
                  onDone();
               }
            }}
            onBlur={(e) => {
               if (isCancellingRef.current) {
                  isCancellingRef.current = false;
                  return;
               }
               e.currentTarget.form?.requestSubmit();
            }}
         />
      </form>
   );
}

// ─── SidebarClient ─────────────────────────────────────────────────────────────
export function SidebarClient({
   chats,
   createChatAction,
   renameChatAction,
   deleteChatAction,
}: SidebarClientProps) {
   const pathname = usePathname();
   const { isOpen, close } = useSidebar();
   const [editingId, setEditingId] = useState<string | null>(null);
   const [confirmingId, setConfirmingId] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();
   // Separate transition for chat creation so 'isCreating' only tracks createChatAction.
   const [isCreating, startCreateTransition] = useTransition();

   // Matches the Tailwind `md` breakpoint used in layout CSS (md:hidden / md:relative).
   const MOBILE_BREAKPOINT_PX = 768;

   // Auto-close sidebar on mobile after navigation.
   useEffect(() => {
      if (window.innerWidth < MOBILE_BREAKPOINT_PX) close();
   }, [pathname, close]);

   // Lock body scroll when mobile sidebar is open.
   useEffect(() => {
      if (isOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = '';
      }
      return () => {
         document.body.style.overflow = '';
      };
   }, [isOpen]);

   return (
      <>
         {/* Mobile backdrop */}
         {isOpen && (
            <div
               className="fixed inset-0 bg-black/50 z-30 md:hidden"
               onClick={close}
               aria-hidden="true"
            />
         )}

         <aside
            className={[
               // Mobile: fixed overlay, slides in/out
               'fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0',
               'bg-gray-900 text-white flex flex-col',
               'transition-transform duration-200 ease-in-out',
               isOpen ? 'translate-x-0' : '-translate-x-full',
               // Desktop: in-flow, always visible
               'md:relative md:inset-auto md:z-auto md:translate-x-0',
            ].join(' ')}
         >
            {/* Header: New Chat button */}
            <div className="p-4 border-b border-gray-700">
               <form action={() => startCreateTransition(createChatAction)}>
                  <button
                     type="submit"
                     disabled={isCreating}
                     className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
                  >
                     <Plus size={16} />
                     {isCreating ? 'Creating…' : 'New Chat'}
                  </button>
               </form>
            </div>

            {/* Scrollable chat list */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
               {/* Empty state */}
               {chats.length === 0 && (
                  <div className="px-3 py-8 text-center">
                     <p className="text-sm text-gray-400">No conversations yet</p>
                     <p className="text-xs text-gray-500 mt-1">Click New Chat to get started</p>
                  </div>
               )}
               {chats.map((chat) => {
                  const isActive = pathname === `/chat/${chat.id}`;
                  const isEditing = editingId === chat.id;
                  const isConfirming = confirmingId === chat.id;

                  return (
                     <div
                        key={chat.id}
                        className={[
                           'group flex items-center gap-1 rounded-lg',
                           // Left blue border as active indicator
                           isActive
                              ? 'bg-gray-700 border-l-2 border-blue-500'
                              : 'hover:bg-gray-800 border-l-2 border-transparent',
                        ].join(' ')}
                     >
                        {isEditing ? (
                           <RenameInput
                              chatId={chat.id}
                              defaultTitle={chat.title}
                              renameChatAction={renameChatAction}
                              onDone={() => setEditingId(null)}
                           />
                        ) : (
                           <Link
                              href={`/chat/${chat.id}`}
                              title={chat.title}
                              className={`flex-1 min-w-0 px-3 py-2 text-sm truncate block ${isActive ? 'text-white' : 'text-gray-100'
                                 }`}
                           >
                              {chat.title}
                           </Link>
                        )}

                        {/* Action buttons — hover-reveal or always visible for active/confirming */}
                        {!isEditing && (
                           <div
                              className={[
                                 'items-center gap-1 pr-2 flex-shrink-0',
                                 // Active item always shows buttons on touch devices
                                 isConfirming || isActive ? 'flex' : 'hidden group-hover:flex',
                              ].join(' ')}
                           >
                              {isConfirming ? (
                                 <>
                                    <button
                                       type="button"
                                       disabled={isPending}
                                       onClick={() =>
                                          startTransition(() => deleteChatAction(chat.id))
                                       }
                                       className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                       Delete
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => setConfirmingId(null)}
                                       className="text-xs text-gray-400 hover:text-gray-300"
                                    >
                                       Cancel
                                    </button>
                                 </>
                              ) : (
                                 <>
                                    <button
                                       type="button"
                                       aria-label="Rename conversation"
                                       onClick={() => setEditingId(chat.id)}
                                       className="p-1 rounded text-gray-400 hover:text-gray-200"
                                    >
                                       <Pencil size={14} />
                                    </button>
                                    <button
                                       type="button"
                                       aria-label="Delete conversation"
                                       onClick={() => setConfirmingId(chat.id)}
                                       className="p-1 rounded text-gray-400 hover:text-red-400"
                                    >
                                       <Trash2 size={14} />
                                    </button>
                                 </>
                              )}
                           </div>
                        )}
                     </div>
                  );
               })}
            </nav>
         </aside>
      </>
   );
}
