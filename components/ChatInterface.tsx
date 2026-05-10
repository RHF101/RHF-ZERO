// components/ChatInterface.tsx
'use client';

import { useChat } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, ThumbsUp, ThumbsDown, Send, Paperclip, Image } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatInterfaceProps {
  onFileUpload?: (file: File) => void;
}

export default function ChatInterface({ onFileUpload }: ChatInterfaceProps) {
  const [inputMode, setInputMode] = useState<'normal' | 'coding'>('normal');
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
    onFinish: () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Bisa tambah toast notification nanti
    alert('Code berhasil dicopy!');
  };

  const downloadCode = (code: string, filename: string = 'code.ts') => {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean = false) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto chat-container p-6 space-y-8 pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pt-20">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <span className="text-4xl">🧠</span>
            </div>
            <h2 className="text-3xl font-bold mb-3">Halo, GwAI di sini</h2>
            <p className="text-zinc-400 max-w-md">
              AI super canggih siap bantu kamu coding, analisa gambar, atau ngobrol santai.
              <br />Apa yang mau kita kerjain hari ini?
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl px-6 py-4 ${
                  message.role === 'user'
                    ? 'message-user text-white'
                    : 'message-assistant'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const code = String(children).replace(/\n$/, '');

                          return !inline && match ? (
                            <div className="relative group">
                              <div className="flex justify-between items-center bg-zinc-800 px-4 py-2 rounded-t-xl text-xs">
                                <span>{match[1]}</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => copyToClipboard(code)}
                                    className="hover:text-blue-400 transition-colors"
                                  >
                                    <Copy size={16} />
                                  </button>
                                  <button
                                    onClick={() => downloadCode(code, `code.${match[1]}`)}
                                    className="hover:text-blue-400 transition-colors"
                                  >
                                    <Download size={16} />
                                  </button>
                                </div>
                              </div>
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-b-xl !mt-0"
                              >
                                {code}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className="bg-zinc-800 px-1.5 py-0.5 rounded">{children}</code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}

                {/* Feedback Buttons */}
                {message.role === 'assistant' && (
                  <div className="flex gap-3 mt-4 text-zinc-500">
                    <button className="hover:text-white transition-colors">
                      <ThumbsUp size={18} />
                    </button>
                    <button className="hover:text-white transition-colors">
                      <ThumbsDown size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="chat-input rounded-3xl p-2">
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-2xl transition-colors"
                >
                  <Paperclip size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-2xl transition-colors"
                >
                  <Image size={22} />
                </button>
              </div>

              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ketik pesan... (bisa coding, tanya jawab, atau upload file)"
                className="flex-1 bg-transparent border-0 focus:outline-none text-lg placeholder-zinc-500 py-4"
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed p-4 rounded-2xl transition-all"
              >
                <Send size={22} className={isLoading ? "animate-pulse" : ""} />
              </button>
            </form>
          </div>

          <p className="text-center text-[10px] text-zinc-600 mt-3">
            GwAI • Multi-Model • Vision • Self-Correction
          </p>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelect(e)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, true)}
      />
    </div>
  );
    }
