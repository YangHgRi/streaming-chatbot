'use client';
import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { MessageList, type PendingAction } from './MessageList';
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

   // ─── Toast ────────────────────────────────────────────────────────────────

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

   // ─── Pending action (confirm popover) ────────────────────────────────────
   // First click on refresh/delete sets pendingAction — shows the confirm popover.
   // Clicking "确认" fires handleConfirm(); clicking "取消" or 5 s timeout cancels.

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
      }, 5000);
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

   // REFRESH: show confirm popover; on confirm — truncate history + re-send prompt.
   const handleRefresh = useCallback((msg: UIMessage) => {
      handleCancel(); // dismiss any other pending action
      requestConfirm(
         { messageId: msg.id, type: 'refresh' },
         () => {
            const idx = messages.findIndex((m) => m.id === msg.id);
            if (idx === -1) return;

            const messagesBeforeThis = messages.slice(0, idx);
            // R2: keep the first user message visible rather than flashing blank
            const optimisticMessages =
               idx === 0 && msg.role === 'user' ? [msg] : messagesBeforeThis;

            const promptMsg =
               msg.role === 'user'
                  ? msg
                  : [...messagesBeforeThis].reverse().find((m) => m.role === 'user');
            if (!promptMsg) return;

            const promptText = getTextContent(promptMsg);
            if (!promptText) return;

            const snapshot = messages;
            setMessages(optimisticMessages);

            deleteMessagesFromAction(chatId, msg.id).catch((err) => {
               console.error('[chat] deleteMessagesFromAction failed:', err);
               setMessages(snapshot);
               showToast('操作失败，请重试', 'error');
            });

            sendMessage({ text: promptText });
         },
      );
   }, [messages, chatId, setMessages, sendMessage, showToast, requestConfirm, handleCancel]);

   // COPY: immediate, no confirm needed.
   const handleCopy = useCallback(async (msg: UIMessage) => {
      handleCancel();
      try {
         await navigator.clipboard.writeText(getTextContent(msg));
         showToast('已复制到剪贴板');
      } catch {
         showToast('复制失败，请手动复制', 'error');
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
               showToast('删除失败，请重试', 'error');
            });
         },
      );
   }, [messages, chatId, setMessages, showToast, requestConfirm, handleCancel]);

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
            pendingAction={pendingAction}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
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
