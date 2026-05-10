// app/page.tsx
'use client';

import ChatInterface from '@/components/ChatInterface';
import FileUploader from '@/components/FileUploader';
import AgentStatus from '@/components/AgentStatus';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} border-r border-zinc-800 bg-zinc-950 transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Super Web</h1>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto">
          <FileUploader 
            onFilesChange={setUploadedFiles} 
          />
          
          <AgentStatus />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-zinc-800 flex items-center px-6 bg-zinc-950">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="lg:hidden mr-4"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">GwAI Multi-Agent Online</span>
          </div>
        </div>

        <ChatInterface onFileUpload={(file) => console.log('File uploaded:', file)} />
      </div>
    </div>
  );
}
