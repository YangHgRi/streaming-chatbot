export default function ChatLoading() {
   return (
      <div className="flex flex-col h-full bg-gray-50 animate-pulse">
         {/* Header skeleton */}
         <div className="border-b border-gray-200 bg-white px-4 py-4 flex-shrink-0 flex items-center gap-3">
            {/* Mobile toggle placeholder */}
            <div className="w-8 h-8 rounded-lg bg-gray-200 md:hidden" />
            <div className="h-5 w-48 rounded bg-gray-200" />
         </div>

         {/* Message list skeleton */}
         <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
            {/* Assistant message */}
            <div className="flex flex-col items-start gap-1 max-w-[85%]">
               <div className="h-4 w-64 rounded bg-gray-200" />
               <div className="h-4 w-48 rounded bg-gray-200" />
               <div className="h-4 w-56 rounded bg-gray-200" />
            </div>

            {/* User message */}
            <div className="flex flex-col items-end gap-1 max-w-[75%] self-end">
               <div className="h-4 w-40 rounded bg-gray-300" />
            </div>

            {/* Assistant message */}
            <div className="flex flex-col items-start gap-1 max-w-[85%]">
               <div className="h-4 w-72 rounded bg-gray-200" />
               <div className="h-4 w-60 rounded bg-gray-200" />
            </div>

            {/* User message */}
            <div className="flex flex-col items-end gap-1 max-w-[75%] self-end">
               <div className="h-4 w-52 rounded bg-gray-300" />
               <div className="h-4 w-36 rounded bg-gray-300" />
            </div>
         </div>

         {/* Input skeleton */}
         <div className="border-t border-gray-200 bg-white p-4">
            <div className="h-10 w-full rounded-lg bg-gray-200" />
         </div>
      </div>
   );
}
