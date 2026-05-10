// lib/multi-agent.ts
import { streamText, CoreMessage, generateText } from 'ai';
import { getBestModel } from './ai-providers';
import { aiMemory } from './memory';

export type AgentType = 'planner' | 'coder' | 'reviewer' | 'tester' | 'fixer';

interface AgentResponse {
  agent: AgentType;
  content: string;
  confidence: number;
  suggestions?: string[];
}

class MultiAgentOrchestrator {
  private async runAgent(
    agentType: AgentType,
    prompt: string,
    context: string = ''
  ): Promise<AgentResponse> {
    const model = getBestModel(
      agentType === 'coder' ? 'coding' : 
      agentType === 'reviewer' || agentType === 'tester' ? 'review' : 'complex'
    );

    const systemPrompts: Record<AgentType, string> = {
      planner: `Kamu adalah Planner Agent. Analisa permintaan user dengan teliti, pecah menjadi langkah-langkah, identifikasi teknologi yang dibutuhkan, dan buat rencana eksekusi yang jelas.`,

      coder: `Kamu adalah Coder Agent. Tulis kode berkualitas sangat tinggi, rapi, bersih, well-commented, production-ready. Gunakan best practices dan struktur yang baik.`,

      reviewer: `Kamu adalah Reviewer Agent. Review kode secara kritis. Cek error, bug, security issue, performance, readability, dan best practices. Berikan perbaikan yang jelas.`,

      tester: `Kamu adalah Tester Agent. Buat test cases, edge cases, dan saran testing untuk kode tersebut.`,

      fixer: `Kamu adalah Fixer Agent. Perbaiki kode berdasarkan feedback dari Reviewer atau Tester.`
    };

    const result = await generateText({
      model,
      system: systemPrompts[agentType],
      prompt: `${context}\n\nPermintaan: ${prompt}`,
      temperature: agentType === 'coder' ? 0.25 : 0.4,
      maxTokens: agentType === 'coder' ? 28000 : 12000,
    });

    return {
      agent: agentType,
      content: result.text,
      confidence: 0.85,
    };
  }

  // === ORCHESTRATION UTAMA ===
  async processRequest(userPrompt: string, files: any[] = []): Promise<AgentResponse> {
    let context = '';

    // Tambahkan context dari memory
    const currentConv = aiMemory.getCurrentConversation();
    if (currentConv?.metadata?.projectContext) {
      context += `Project Context: ${currentConv.metadata.projectContext}\n`;
    }

    if (files.length > 0) {
      context += `Files yang diupload:\n`;
      files.forEach(f => context += `- ${f.name}\n`);
    }

    // Langkah 1: Planner
    console.log('🤖 Planner Agent aktif...');
    const plan = await this.runAgent('planner', userPrompt, context);

    // Langkah 2: Coder
    console.log('💻 Coder Agent aktif...');
    const codeResult = await this.runAgent('coder', 
      `${plan.content}\n\nUser Prompt: ${userPrompt}`, 
      context
    );

    // Langkah 3: Reviewer + Self-Correction Loop
    console.log('🔍 Reviewer Agent aktif...');
    let finalCode = codeResult.content;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const review = await this.runAgent('reviewer', finalCode, userPrompt);

      if (review.content.toLowerCase().includes('no issues') || 
          review.content.toLowerCase().includes('sudah bagus')) {
        break;
      }

      // Fixer Agent
      console.log(`🔧 Fixer Agent memperbaiki (attempt ${attempts + 1})...`);
      const fixed = await this.runAgent('fixer', 
        `Kode sebelumnya:\n\( {finalCode}\n\nFeedback Reviewer:\n \){review.content}`,
        userPrompt
      );

      finalCode = fixed.content;
      attempts++;
    }

    // Langkah 4: Tester (opsional)
    console.log('🧪 Tester Agent aktif...');
    const testResult = await this.runAgent('tester', finalCode, userPrompt);

    const finalResponse = `
**Plan:** ${plan.content}

**Kode Akhir:**
\`\`\`tsx
${finalCode}
\`\`\`

**Review Summary:**
${review ? review.content : 'Review passed'}

**Test Cases & Saran:**
${testResult.content}
`;

    return {
      agent: 'coder',
      content: finalResponse,
      confidence: 0.92,
      suggestions: [testResult.content]
    };
  }
}

export const multiAgent = new MultiAgentOrchestrator();
