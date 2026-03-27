'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition, useRef } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Chat } from '@/lib/db/schema';

interface SidebarClientProps {
   chats: Chat[];
   createChatAction: () => Promise<void>;
   renameChatAction: (chatId: string, formData: FormData) => Promise<void>;
   deleteChatAction: (chatId: string) => Promise<void>;
}

// ─── RenameInput ───────────────────────────────────────────────────────────────
// N3 fix: isCancellingRenameRef lives inside this per-chat component so that
// concurrent blur events from different chat rows never share the same flag.
// Each mounted RenameInput owns exactly one ref — no cross-row interference.
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
            // T2: set the flag to true so the onBlur that fires immediately
            // after submit (input losing focus during unmount) is suppressed.
            // Without this, blur sees flag===false and calls requestSubmit()
            // a second time, sending the rename Server Action twice.
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
                  // Set flag BEFORE triggering blur so the onBlur handler below
                  // can bail out without calling requestSubmit(). React event order:
                  // keyDown → blur → re-render; state update from onDone() fires last.
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
   const [editingId, setEditingId] = useState<string | null>(null);
   const [confirmingId, setConfirmingId] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   return (
      <aside className="w-64 flex-shrink-0 bg-gray-900 text-white flex flex-col h-full">
         {/* Header: New Chat button */}
         <div className="p-4 border-b border-gray-700">
            <form action={createChatAction}>
               <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
               >
                  <Plus size={16} />
                  {isPending ? 'Creating…' : 'New Chat'}
               </button>
            </form>
         </div>

         {/* Scrollable chat list */}
         <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {chats.map((chat) => {
               const isActive = pathname === `/chat/${chat.id}`;
               const isEditing = editingId === chat.id;
               const isConfirming = confirmingId === chat.id;

               return (
                  <div
                     key={chat.id}
                     className={`group flex items-center gap-1 rounded-lg ${isActive ? 'bg-gray-700' : 'hover:bg-gray-800'
                        }`}
                  >
                     {isEditing ? (
                        // N3: RenameInput owns its own isCancellingRef — no shared state
                        <RenameInput
                           chatId={chat.id}
                           defaultTitle={chat.title}
                           renameChatAction={renameChatAction}
                           onDone={() => setEditingId(null)}
                        />
                     ) : (
                        <Link
                           href={`/chat/${chat.id}`}
                           className={`flex-1 min-w-0 px-3 py-2 text-sm truncate block ${isActive ? 'text-white' : 'text-gray-100'
                              }`}
                        >
                           {chat.title}
                        </Link>
                     )}

                     {/* Action buttons — hover-reveal (or always visible while confirming) */}
                     {!isEditing && (
                        <div
                           className={`${isConfirming ? 'flex' : 'hidden group-hover:flex'
                              } items-center gap-1 pr-2 flex-shrink-0`}
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
   );
}
