'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

// bundle-dynamic-imports: Prism is ~300-500 KB — load it only when a code block
// is actually rendered, not on every page.
const SyntaxHighlighter = dynamic<SyntaxHighlighterProps>(
   () => import('react-syntax-highlighter').then((m) => m.Prism as never),
   {
      ssr: false,
      loading: ({ error }) =>
         error ? null : (
            <pre className="m-0 p-4 text-[0.85em] bg-gray-900 overflow-x-auto" />
         ),
   },
);

const COPY_RESET_DELAY_MS = 2500;

// js-hoist-regexp: compile RegExp once at module level, not on every render.
const LANGUAGE_RE = /language-(\w+)/;

interface CodeBlockProps {
   inline?: boolean;
   className?: string;
   children?: React.ReactNode;
}

export function CodeBlock({ inline, className, children }: CodeBlockProps) {
   const [copied, setCopied] = useState(false);
   const [failed, setFailed] = useState(false);
   const match = LANGUAGE_RE.exec(className ?? '');
   const language = match ? match[1] : '';
   const code = String(children ?? '').replace(/\n$/, '');

   if (inline || !language) {
      return (
         <code className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-[0.85em] font-mono">
            {children}
         </code>
      );
   }

   function handleCopy() {
      navigator.clipboard.writeText(code).then(() => {
         setCopied(true);
         setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
      }).catch(() => {
         setFailed(true);
         setTimeout(() => setFailed(false), COPY_RESET_DELAY_MS);
      });
   }

   return (
      <div className="relative group/code my-2 rounded-lg overflow-hidden">
         <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5">
            <span className="text-xs text-gray-400 font-mono">{language}</span>
            <button
               type="button"
               onClick={handleCopy}
               className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-700"
            >
               {failed ? 'Failed' : copied ? 'Copied!' : 'Copy'}
            </button>
         </div>
         <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
               margin: 0,
               borderRadius: 0,
               fontSize: '0.85em',
               padding: '1rem',
            }}
            PreTag="div"
         >
            {code}
         </SyntaxHighlighter>
      </div>
   );
}
