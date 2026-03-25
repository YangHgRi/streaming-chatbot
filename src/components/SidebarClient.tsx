'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Chat } from '@/lib/db/schema';

interface SidebarClientProps {
  chats: Chat[];
  createChatAction: () => Promise<void>;
  renameChatAction: (chatId: string, formData: FormData) => Promise<void>;
  deleteChatAction: (chatId: string) => Promise<void>;
}

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
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white font-medium transition-colors"
          >
            <Plus size={16} />
            New Chat
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
              className={`group flex items-center gap-1 rounded-lg ${
                isActive ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              {isEditing ? (
                /* Rename inline edit form */
                <form
                  action={renameChatAction.bind(null, chat.id)}
                  className="flex-1 min-w-0 px-2 py-1"
                  onSubmit={() => setEditingId(null)}
                >
                  <input
                    type="text"
                    name="title"
                    defaultValue={chat.title}
                    placeholder="Rename conversation…"
                    autoFocus
                    className="w-full min-w-0 text-sm text-white bg-transparent border border-gray-500 rounded px-1 py-1 focus:outline-none focus:border-blue-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={(e) => {
                      e.currentTarget.form?.requestSubmit();
                    }}
                  />
                </form>
              ) : (
                /* Default: title as link */
                <Link
                  href={`/chat/${chat.id}`}
                  className={`flex-1 min-w-0 px-3 py-2 text-sm truncate block ${
                    isActive ? 'text-white' : 'text-gray-100'
                  }`}
                >
                  {chat.title}
                </Link>
              )}

              {/* Action buttons — hover-reveal (or always visible while editing/confirming) */}
              {!isEditing && (
                <div
                  className={`${
                    isConfirming ? 'flex' : 'hidden group-hover:flex'
                  } items-center gap-1 pr-2 flex-shrink-0`}
                >
                  {isConfirming ? (
                    /* Delete confirm / cancel */
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
                    /* Rename + delete icon triggers */
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
