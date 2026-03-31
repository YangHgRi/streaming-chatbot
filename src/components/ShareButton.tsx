'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';

export function ShareButton({ chatId, onShare }: { chatId: string; onShare: (chatId: string) => Promise<string> }) {
   const [shareUrl, setShareUrl] = useState<string | null>(null);
   const [showPopup, setShowPopup] = useState(false);
   const [loading, setLoading] = useState(false);
   const [copied, setCopied] = useState(false);
   const popupRef = useRef<HTMLDivElement>(null);

   // Reset when navigating to a different chat
   useEffect(() => {
      setShareUrl(null);
      setShowPopup(false);
      setCopied(false);
   }, [chatId]);

   // Close popup on outside click
   useEffect(() => {
      if (!showPopup) return;
      function onPointerDown(e: PointerEvent) {
         if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
            setShowPopup(false);
         }
      }
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
   }, [showPopup]);

   async function handleShare() {
      if (showPopup) { setShowPopup(false); return; }
      if (shareUrl) { setShowPopup(true); return; }
      setLoading(true);
      try {
         const shareId = await onShare(chatId);
         const url = `${window.location.origin}/share/${shareId}`;
         setShareUrl(url);
         setShowPopup(true);
      } finally {
         setLoading(false);
      }
   }

   async function handleCopy() {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl).catch(() => { });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
   }

   return (
      <div className="relative">
         <button
            type="button"
            onClick={handleShare}
            disabled={loading}
            title="Share conversation"
            className="cursor-pointer p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs font-medium"
         >
            <Share2 size={15} />
            <span className="hidden sm:inline">{loading ? 'Sharing…' : 'Share'}</span>
         </button>

         {showPopup && shareUrl && (
            <div
               ref={popupRef}
               className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 p-3"
            >
               {/* Header row */}
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Share link ready</p>
                  <button
                     type="button"
                     onClick={() => setShowPopup(false)}
                     className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                     title="Close"
                  >
                     <X size={13} />
                  </button>
               </div>

               {/* URL row */}
               <div className="flex items-center gap-1.5">
                  <input
                     readOnly
                     value={shareUrl}
                     onClick={e => (e.target as HTMLInputElement).select()}
                     className="flex-1 min-w-0 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                     type="button"
                     onClick={handleCopy}
                     title={copied ? 'Copied!' : 'Copy link'}
                     className={`shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs rounded border transition-colors font-medium ${
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 border-blue-500 text-white'
                        }`}
                  >
                     {copied ? <Check size={12} /> : <Copy size={12} />}
                     {copied ? 'Copied' : 'Copy'}
                  </button>
               </div>
            </div>
         )}
      </div>
   );
}
