'use client';
import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UIMessage } from 'ai';
import { MessageList, type PendingAction } from './MessageList';
import { MessageInput } from './MessageInput';
import { deleteMessagesFromAction } from '@/app/actions';
import { getTextContent } from '@/lib/getTextContent';
import { SystemPromptModal } from './SystemPromptModal';
import { useSidebar } from './SidebarProvider';
import { ROLE_USER, ROLE_ASSISTANT } from '@/constants';

// ─── Toast ────────────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 2500;
const CONFIRM_TIMEOUT_MS = 5000;

interface Toast {
   id: number;
   message: string;
   type: 'success' | 'error';
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
   return (
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
         {toasts.map((t) => (
            <div
               key={t.id}
               onClick={() => onDismiss(t.id)}
               className={`
                  pointer-events-auto px-4 py-2 rounded-lg shadow-lg text-sm font-medium
                  animate-fade-in cursor-pointer select-none
                  ${t.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}
               `}
            >
               {t.message}
            </div>
         ))}
      </div>
   );
}

// ─── ChatInterface ────────────────────────────────────────────────────────────

export function ChatInterface({
   chatId,
   initialMessages,
   onNewChat,
   titled,
   systemPrompt,
   onUpdateSystemPrompt,
}: {
   chatId: string;
   initialMessages: UIMessage[];
   onNewChat: () => Promise<void>;
   titled: boolean;
   systemPrompt: string;
   onUpdateSystemPrompt: (prompt: string) => Promise<void>;
}) {
   const { messages, sendMessage, setMessages, regenerate, status, error, stop } = useChat({
      id: chatId,
      messages: initialMessages,
   });

   const router = useRouter();

   // After the first AI response completes on an untitled chat, call the
   // dedicated title API and only refresh the router once it responds —
   // guaranteeing "title written → cache invalidated → router refreshed".
   const prevStatusRef = useRef(status);
   useEffect(() => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = status;
      if (!titled && (prev === 'streaming' || prev === 'submitted') && status === 'ready') {
         const firstUserMsg = messages.find((m) => m.role === ROLE_USER);
         const firstUserMessage = firstUserMsg ? getTextContent(firstUserMsg).trim() : '';
         fetch(`/api/chat/${chatId}/title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstUserMessage }),
         }).then(() => router.refresh());
      }
   }, [status, router, chatId, messages, titled]);

   const isLoading = status === 'submitted';

   const [showSystemPrompt, setShowSystemPrompt] = useState(false);


   const { toggle } = useSidebar();
   const [showShortcuts, setShowShortcuts] = useState(false);

   useEffect(() => {
      const handler = (e: KeyboardEvent) => {
         const active = document.activeElement;
         const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

         // Ctrl/Cmd+N: new chat (only when not typing)
         if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
            if (!isInput) {
               e.preventDefault();
               onNewChat();
            }
         }

         // Ctrl/Cmd+Shift+S: toggle sidebar
         if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            toggle();
         }

         // ?: toggle shortcuts help panel (only when not typing)
         if (e.key === '?' && !isInput) {
            setShowShortcuts((prev) => !prev);
         }

         // Escape: close shortcuts panel
         if (e.key === 'Escape') {
            setShowShortcuts(false);
         }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
   }, [onNewChat, toggle]);

   const stopRef = useRef(stop);
   useEffect(() => { stopRef.current = stop; });
   useEffect(() => {
      return () => { stopRef.current(); };
   }, [chatId]);

   // ─── Toast ────────────────────────────────────────────────────────────────

   const toastCounterRef = useRef(0);
   const [toasts, setToasts] = useState<Toast[]>([]);

   const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
      const id = ++toastCounterRef.current;
      setToasts((prev) => {
         // Limit to MAX_TOASTS — drop the oldest if needed
         const trimmed = prev.length >= MAX_TOASTS ? prev.slice(prev.length - MAX_TOASTS + 1) : prev;
         return [...trimmed, { id, message, type }];
      });
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS);
   }, []);

   const dismissToast = useCallback((id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
   }, []);

   // ─── Pending action (confirm popover) ────────────────────────────────────
   // First click on refresh/delete sets pendingAction — shows the confirm popover.
   // Clicking "Confirm" fires handleConfirm(); clicking "Cancel" or 5 s timeout cancels.

   const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
   // Store the actual work to do on confirm as a stable ref (avoids stale closures).
   const pendingCallbackRef = useRef<(() => void) | null>(null);
   const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const requestConfirm = useCallback((action: PendingAction, callback: () => void) => {
      // Clear any existing pending action first
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingCallbackRef.current = callback;
      setPendingAction(action);
      // Auto-cancel after 5 s
      pendingTimerRef.current = setTimeout(() => {
         setPendingAction(null);
         pendingCallbackRef.current = null;
      }, CONFIRM_TIMEOUT_MS);
   }, []);

   const handleConfirm = useCallback(() => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      const cb = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      setPendingAction(null);
      cb?.();
   }, []);

   const handleCancel = useCallback(() => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingCallbackRef.current = null;
      setPendingAction(null);
   }, []);

   // Clear timer on unmount
   useEffect(() => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
   }, []);

   // ─── Message action handlers ───────────────────────────────────────────────

   // REFRESH: only for AI messages — optimistically trim the UI, then let the
   // server atomically replace the old message with the new reply.
   const handleRefresh = useCallback((msg: UIMessage) => {
      handleCancel(); // dismiss any other pending action
      requestConfirm(
         { messageId: msg.id, type: 'refresh' },
         () => {
            const idx = messages.findIndex((m) => m.id === msg.id);
            if (idx === -1) return;

            // Optimistically update UI: show only messages before the target.
            setMessages(messages.slice(0, idx));

            // Pass deleteFromId to the server so it can atomically delete the old
            // message(s) and insert the new reply in a single transaction.
            regenerate({ body: { deleteFromId: msg.id } });
         },
      );
   }, [messages, chatId, setMessages, regenerate, requestConfirm, handleCancel]);

   // COPY: immediate, no confirm needed.
   const handleCopy = useCallback(async (msg: UIMessage) => {
      handleCancel();
      try {
         await navigator.clipboard.writeText(getTextContent(msg));
         showToast('Copied to clipboard');
      } catch {
         showToast('Copy failed. Please copy manually.', 'error');
      }
   }, [showToast, handleCancel]);

   // DELETE: show confirm popover; on confirm — truncate history + delete from DB.
   const handleDelete = useCallback((msg: UIMessage) => {
      handleCancel();
      requestConfirm(
         { messageId: msg.id, type: 'delete' },
         () => {
            const idx = messages.findIndex((m) => m.id === msg.id);
            if (idx === -1) return;

            const remaining = messages.slice(0, idx);
            const snapshot = messages;

            setMessages(remaining);

            deleteMessagesFromAction(chatId, msg.id).catch((err) => {
               console.error('[chat] deleteMessagesFromAction failed:', err);
               setMessages(snapshot);
               showToast('Delete failed. Please try again.', 'error');
            });
         },
      );
   }, [messages, chatId, setMessages, showToast, requestConfirm, handleCancel]);

   // EDIT: immediately truncate to before this message, delete from DB, re-send with new text.
   const handleEdit = useCallback((msg: UIMessage, newText: string) => {
      const idx = messages.findIndex((m) => m.id === msg.id);
      if (idx === -1) return;
      const messagesBeforeThis = messages.slice(0, idx);
      const snapshot = messages;
      setMessages(messagesBeforeThis);
      deleteMessagesFromAction(chatId, msg.id).catch((err) => {
         console.error('[chat] deleteMessagesFromAction failed:', err);
         setMessages(snapshot);
         showToast('Edit failed. Please try again.', 'error');
      });
      sendMessage({ text: newText });
   }, [messages, chatId, setMessages, sendMessage, showToast]);

   // Version navigation is display-only: MessageList renders allVersions[cursor] without mutating messages.
   // No handleRestoreVersion needed — pass undefined so MessageList handles navigation purely in local state.

   // ─── Send handler (also used by EmptyState suggestion chips) ──────────────

   const handleSend = useCallback((text: string) => {
      sendMessage({ text });
   }, [sendMessage]);

   // ─── Render ───────────────────────────────────────────────────────────────

   return (
      <div className="flex flex-col h-full relative">
         <MessageList
            messages={messages}
            isLoading={isLoading}
            error={error}
            onRefresh={handleRefresh}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onEdit={handleEdit}
            pendingAction={pendingAction}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onSend={handleSend}

         />
         <MessageInput
            onSend={handleSend}
            onNewChat={onNewChat}
            onStop={stop}
            status={status}
            onArrowUp={() => { }}
         />
         <ToastContainer toasts={toasts} onDismiss={dismissToast} />
         {showSystemPrompt && (
            <SystemPromptModal
               chatId={chatId}
               initialPrompt={systemPrompt}
               onClose={() => setShowSystemPrompt(false)}
               onSave={onUpdateSystemPrompt}
            />
         )}
         {showShortcuts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
               <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-80 p-6" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Keyboard Shortcuts</h2>
                  <div className="space-y-2 text-sm">
                     {([
                        ['Ctrl+K', 'Search conversations'],
                        ['Ctrl+N', 'New chat'],
                        ['Ctrl+Shift+S', 'Toggle sidebar'],
                        ['↑ (empty input)', 'Edit last message'],
                        ['?', 'Toggle shortcuts help'],
                        ['Esc', 'Close dialog / cancel'],
                     ] as [string, string][]).map(([key, desc]) => (
                        <div key={key} className="flex justify-between">
                           <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono text-xs">{key}</kbd>
                           <span className="text-gray-600 dark:text-gray-400">{desc}</span>
                        </div>
                     ))}
                  </div>
                  <button type="button" onClick={() => setShowShortcuts(false)} className="mt-4 w-full py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Close</button>
               </div>
            </div>
         )}
      </div>
   );
}
