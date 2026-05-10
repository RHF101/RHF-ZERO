// app/page.tsx
'use client';

import { useState } from 'react';
import Chat from '@/components/Chat';
import FileUpload from '@/components/FileUpload';
import AgentPanel from '@/components/AgentPanel';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState<any[]>([]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 border-r border-zinc-800 flex flex-col`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">AI Super Web</h1>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* File Upload */}
        <div className="p-4">
          <FileUpload onFilesChange={setFiles} />
        </div>

        {/* Agent Status */}
        <div className="px-4">
          <AgentPanel />
        </div>

        {/* History / Files List */}
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          <p className="text-zinc-500 mb-3">RECENT FILES</p>
          {files.length > 0 ? (
            files.map((file, i) => (
              <div key={i} className="py-2 px-3 bg-zinc-900 rounded-lg mb-2 text-zinc-300 text-xs truncate">
                📄 {file.name}
              </div>
            ))
          ) : (
            <p className="text-zinc-500 text-xs italic">Belum ada file diupload</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-950 z-10">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-zinc-400 hover:text-white"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-zinc-400">Multi-Agent System Online</span>
          </div>

          <div className="text-xs text-zinc-500">Powered by All Your API Keys</div>
        </div>

        {/* Chat Component */}
        <div className="flex-1 overflow-hidden">
          <Chat />
        </div>
      </div>
    </div>
  );
}
