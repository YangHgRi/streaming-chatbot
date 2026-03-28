'use client';
import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { deleteMessagesFromAction } from '@/app/actions';
import { getTextContent } from '@/lib/getTextContent';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
   id: number;
   message: string;
   type: 'success' | 'error';
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
   return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
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
}: {
   chatId: string;
   initialMessages: UIMessage[];
   onNewChat: () => Promise<void>;
}) {
   const { messages, sendMessage, setMessages, status, error, stop } = useChat({
      id: chatId,
      messages: initialMessages,
   });

   const isLoading = status === 'submitted' || status === 'streaming';

   const stopRef = useRef(stop);
   useEffect(() => { stopRef.current = stop; });

   useEffect(() => {
      return () => { stopRef.current(); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [chatId]);

   // ─── Toast (Q2 fix: counter lives in a ref, not module-level mutable state) ──

   const toastCounterRef = useRef(0);
   const [toasts, setToasts] = useState<Toast[]>([]);

   const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
      const id = ++toastCounterRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
   }, []);

   const dismissToast = useCallback((id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
   }, []);

   // ─── Two-step delete confirm state (Q1 fix) ────────────────────────────────
   // confirmingDeleteId: the message id currently "armed" for deletion.
   // First click on delete sets this; second click (while armed) fires the delete.
   // Auto-disarms after 3 s if the user doesn't confirm.

   const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
   const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const armDelete = useCallback((msgId: string) => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingDeleteId(msgId);
      confirmTimerRef.current = setTimeout(() => setConfirmingDeleteId(null), 3000);
   }, []);

   const disarmDelete = useCallback(() => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingDeleteId(null);
   }, []);

   // Clear the timer on unmount to avoid state updates on an unmounted component.
   useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

   // ─── Message action handlers ───────────────────────────────────────────────

   // REFRESH: truncate history before this message, re-send the last user prompt.
   const handleRefresh = useCallback(async (msg: UIMessage) => {
      disarmDelete();
      const idx = messages.findIndex((m) => m.id === msg.id);
      if (idx === -1) return;

      const messagesBeforeThis = messages.slice(0, idx);

      // R2 fix: when refreshing the very first message (idx === 0), keep that
      // message in view rather than flashing a blank screen. The user message
      // acts as both the context anchor *and* the prompt.
      const optimisticMessages =
         idx === 0 && msg.role === 'user' ? [msg] : messagesBeforeThis;

      // Determine the prompt to re-send.
      // • If this is a user message: re-send it directly.
      // • If this is an assistant message: re-send the last user message before it.
      const promptMsg =
         msg.role === 'user'
            ? msg
            : [...messagesBeforeThis].reverse().find((m) => m.role === 'user');
      if (!promptMsg) return; // nothing to re-send (edge case: no preceding user turn)

      const promptText = getTextContent(promptMsg);
      if (!promptText) return;

      // R1 fix: capture snapshot for rollback before mutating state.
      const snapshot = messages;
      setMessages(optimisticMessages);

      deleteMessagesFromAction(chatId, msg.id).catch((err) => {
         console.error('[chat] deleteMessagesFromAction failed:', err);
         setMessages(snapshot); // rollback
         showToast('操作失败，请重试', 'error');
      });

      sendMessage({ text: promptText });
   }, [messages, chatId, setMessages, sendMessage, showToast, disarmDelete]);

   // COPY: write text to clipboard and show a toast.
   const handleCopy = useCallback(async (msg: UIMessage) => {
      disarmDelete();
      try {
         await navigator.clipboard.writeText(getTextContent(msg));
         showToast('已复制到剪贴板');
      } catch {
         showToast('复制失败，请手动复制', 'error');
      }
   }, [showToast, disarmDelete]);

   // DELETE: two-step — first call arms, second call within 3 s confirms.
   // R1 fix: snapshot + rollback on DB failure.
   const handleDelete = useCallback(async (msg: UIMessage) => {
      // First click: arm the confirm state and wait for a second click.
      if (confirmingDeleteId !== msg.id) {
         armDelete(msg.id);
         return;
      }

      // Second click: confirmed — proceed with deletion.
      disarmDelete();

      const idx = messages.findIndex((m) => m.id === msg.id);
      if (idx === -1) return;

      const remaining = messages.slice(0, idx);
      const snapshot = messages; // R1 fix: capture for rollback

      setMessages(remaining);

      deleteMessagesFromAction(chatId, msg.id).catch((err) => {
         console.error('[chat] deleteMessagesFromAction failed:', err);
         setMessages(snapshot); // rollback
         showToast('删除失败，请重试', 'error');
      });
   }, [confirmingDeleteId, messages, chatId, setMessages, armDelete, disarmDelete, showToast]);

   // ─── Render ───────────────────────────────────────────────────────────────

   return (
      <div className="flex flex-col h-full">
         <MessageList
            messages={messages}
            isLoading={isLoading}
            error={error}
            onRefresh={handleRefresh}
            onCopy={handleCopy}
            onDelete={handleDelete}
            confirmingDeleteId={confirmingDeleteId}
         />
         <MessageInput
            onSend={(text) => sendMessage({ text })}
            onNewChat={onNewChat}
            status={status}
         />
         <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
   );
}
