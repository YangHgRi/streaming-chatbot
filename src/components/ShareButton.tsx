'use client';
import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';

export function ShareButton({ chatId, onShare }: { chatId: string; onShare: (chatId: string) => Promise<string> }) {
   const [shareUrl, setShareUrl] = useState<string | null>(null);
   const [copying, setCopying] = useState(false);
   const [showPopup, setShowPopup] = useState(false);

   // Reset state when navigating to a different chat
   useEffect(() => {
      setShareUrl(null);
      setShowPopup(false);
      setCopying(false);
   }, [chatId]);

   async function handleShare() {
      if (shareUrl) {
         // Already have URL for this chat, just copy it
         await navigator.clipboard.writeText(shareUrl).catch(() => { });
         setCopying(true);
         setTimeout(() => setCopying(false), 1500);
         return;
      }
      const shareId = await onShare(chatId);
      const url = `${window.location.origin}/share/${shareId}`;
      setShareUrl(url);
      setShowPopup(true);
      await navigator.clipboard.writeText(url).catch(() => { });
   }

   return (
      <div className="relative">
         <button
            type="button"
            onClick={handleShare}
            title="Share conversation"
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs font-medium"
         >
            <Share2 size={15} />
            <span className="hidden sm:inline">{copying ? 'Copied!' : 'Share'}</span>
         </button>
         {showPopup && shareUrl && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 p-3">
               <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Share link created!</p>
               <input readOnly value={shareUrl} className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 mb-2" onClick={e => (e.target as HTMLInputElement).select()} />
               <button type="button" onClick={() => setShowPopup(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700">Close</button>
            </div>
         )}
      </div>
   );
}
