// components/CodePreview.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface CodePreviewProps {
  code: string;
  language?: string;
  filename?: string;
  title?: string;
  onRefresh?: () => void;
}

export default function CodePreview({ 
  code, 
  language = 'typescript', 
  filename = 'code.tsx',
  title = 'Code Preview',
  onRefresh 
}: CodePreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-2 text-sm font-medium text-zinc-300">{title}</span>
          {filename && (
            <span className="text-xs text-zinc-500 font-mono">• {filename}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw size={18} />
            </button>
          )}
          
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={downloadCode}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="max-h-[70vh] overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '24px',
            background: '#09090b',
            fontSize: '0.92rem',
            lineHeight: '1.65',
          }}
          showLineNumbers={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>

      {/* Footer Info */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-5 py-3 text-[10px] text-zinc-500 flex items-center justify-between font-mono">
        <span>{language.toUpperCase()} • {code.split('\n').length} lines</span>
        <span className="text-emerald-500">Ready to use • Production Ready</span>
      </div>
    </div>
  );
        }
