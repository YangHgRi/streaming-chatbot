import Link from 'next/link';

export default function NotFound() {
   return (
      <div className="flex flex-col items-center justify-center h-full min-h-screen bg-gray-50 gap-6 px-4 text-center">
         <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <svg
               xmlns="http://www.w3.org/2000/svg"
               width="28"
               height="28"
               viewBox="0 0 24 24"
               fill="none"
               stroke="white"
               strokeWidth="2"
               strokeLinecap="round"
               strokeLinejoin="round"
               aria-hidden="true"
            >
               <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
         </div>
         <div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">页面未找到</h1>
            <p className="text-sm text-gray-500 max-w-sm">
               The page you are looking for does not exist or has been moved.
            </p>
         </div>
         <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
         >
            Return home
         </Link>
      </div>
   );
}
