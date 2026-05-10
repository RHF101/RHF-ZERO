// components/AgentStatus.tsx
'use client';

import { Brain, Code2, Eye, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Agent {
  name: string;
  status: 'active' | 'idle' | 'thinking';
  icon: React.ReactNode;
  description: string;
  model: string;
}

export default function AgentStatus() {
  const [agents, setAgents] = useState<Agent[]>([
    {
      name: "Planner",
      status: "idle",
      icon: <Brain className="w-4 h-4" />,
      description: "Menganalisa & merencanakan tugas",
      model: "Grok / Llama"
    },
    {
      name: "Coder",
      status: "idle",
      icon: <Code2 className="w-4 h-4" />,
      description: "Menulis kode berkualitas tinggi",
      model: "Cerebras / Fireworks"
    },
    {
      name: "Vision",
      status: "idle",
      icon: <Eye className="w-4 h-4" />,
      description: "Menganalisa gambar & file",
      model: "Gemini Vision"
    },
    {
      name: "Reviewer",
      status: "idle",
      icon: <CheckCircle className="w-4 h-4" />,
      description: "Memeriksa & memperbaiki kode",
      model: "DeepInfra / Groq"
    }
  ]);

  // Simulasi status agent (bisa dihubungkan ke real logic nanti)
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => ({
        ...agent,
        status: Math.random() > 0.7 ? 'thinking' : 'idle'
      })));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-emerald-500" />
        <h3 className="font-semibold text-white">Multi-Agent System</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-emerald-500 font-medium">ONLINE</span>
        </div>
      </div>

      <div className="space-y-3">
        {agents.map((agent, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 transition-all"
          >
            <div className="text-zinc-400">
              {agent.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-white">{agent.name}</p>
                <span className="text-[10px] text-zinc-500 font-mono">{agent.model}</span>
              </div>
              <p className="text-xs text-zinc-500 line-clamp-1">{agent.description}</p>
            </div>

            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1
              ${agent.status === 'thinking' 
                ? 'bg-amber-500/10 text-amber-500' 
                : 'bg-emerald-500/10 text-emerald-500'
              }`}>
              {agent.status === 'thinking' ? (
                <>
                  <AlertCircle className="w-3 h-3 animate-pulse" />
                  THINKING
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  READY
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-[10px] text-zinc-500 text-center">
        Semua agent saling berkoordinasi • Self-correction aktif
      </div>
    </div>
  );
}
