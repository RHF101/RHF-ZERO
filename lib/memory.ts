// lib/memory.ts
import { CoreMessage } from 'ai';

export interface ConversationMemory {
  id: string;
  title: string;
  messages: CoreMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    totalTokens?: number;
    projectContext?: string;
    technologies?: string[];
    lastTaskType?: string;
  };
}

// Simple in-memory store (untuk development)
// Nanti bisa di-upgrade ke Upstash Redis / Vercel KV / Vector DB
class AIMemory {
  private conversations: Map<string, ConversationMemory> = new Map();
  private currentConversationId: string | null = null;

  // Buat conversation baru
  createConversation(title: string = "New Chat"): string {
    const id = `conv_\( {Date.now()}_ \){Math.random().toString(36).substr(2, 9)}`;
    
    this.conversations.set(id, {
      id,
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        totalTokens: 0,
        technologies: [],
      }
    });

    this.currentConversationId = id;
    return id;
  }

  // Tambah pesan ke memory
  async addMessage(message: CoreMessage, conversationId?: string) {
    const convId = conversationId || this.currentConversationId;
    if (!convId) {
      this.createConversation();
    }

    const conversation = this.conversations.get(convId!);
    if (!conversation) return;

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Update metadata sederhana
    if (message.content && typeof message.content === 'string') {
      if (!conversation.metadata) conversation.metadata = {};
      conversation.metadata.totalTokens = 
        (conversation.metadata.totalTokens || 0) + Math.floor(message.content.length / 4);
    }

    // Batasi panjang memory (sliding window + penting)
    if (conversation.messages.length > 100) {
      // Simpan 20 pesan system + terbaru
      const systemMessages = conversation.messages.filter(m => m.role === 'system');
      const recentMessages = conversation.messages.slice(-80);
      conversation.messages = [...systemMessages, ...recentMessages];
    }
  }

  // Ambil semua pesan conversation
  getMessages(conversationId?: string): CoreMessage[] {
    const convId = conversationId || this.currentConversationId;
    if (!convId) return [];
    return this.conversations.get(convId)?.messages || [];
  }

  // Dapatkan conversation saat ini
  getCurrentConversation() {
    if (!this.currentConversationId) return null;
    return this.conversations.get(this.currentConversationId);
  }

  // Update title conversation
  updateTitle(title: string, conversationId?: string) {
    const convId = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(convId!);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date();
    }
  }

  // Tambah project context (sangat berguna untuk coding besar)
  addProjectContext(context: string, technologies: string[] = []) {
    const conversation = this.getCurrentConversation();
    if (conversation && conversation.metadata) {
      conversation.metadata.projectContext = context;
      conversation.metadata.technologies = technologies;
    }
  }

  // Clear memory conversation tertentu
  clearConversation(conversationId?: string) {
    const convId = conversationId || this.currentConversationId;
    if (convId) {
      this.conversations.delete(convId);
      if (convId === this.currentConversationId) {
        this.currentConversationId = null;
      }
    }
  }

  // Export conversation (untuk save/load)
  exportConversation(conversationId?: string) {
    const convId = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(convId!);
    if (!conversation) return null;

    return {
      ...conversation,
      exportedAt: new Date()
    };
  }

  // Get semua conversation (untuk history sidebar nanti)
  getAllConversations() {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

// Export instance tunggal
export const aiMemory = new AIMemory();

// Helper untuk membuat system prompt dengan memory
export function createSystemPromptWithMemory(basePrompt: string): string {
  const currentConv = aiMemory.getCurrentConversation();
  
  let memoryContext = '';
  
  if (currentConv?.metadata?.projectContext) {
    memoryContext += `\n\nProject Context: ${currentConv.metadata.projectContext}`;
  }
  
  if (currentConv?.metadata?.technologies && currentConv.metadata.technologies.length > 0) {
    memoryContext += `\nTechnologies: ${currentConv.metadata.technologies.join(', ')}`;
  }

  return basePrompt + memoryContext;
}
