import { GoogleGenAI, Modality } from "@google/genai";
import { Novel, Chapter, UserProfile, AIConfig, TokenUsage } from "../types";

const defaultAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to track token usage (simplified estimation)
const updateTokenUsage = (userProfile: UserProfile | undefined, tokens: number) => {
  if (!userProfile) return;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  let usage: TokenUsage = { daily: 0, weekly: 0, monthly: 0, lastUpdated: today };
  if (userProfile.tokenUsage) {
    try {
      usage = JSON.parse(userProfile.tokenUsage);
    } catch (e) {}
  }

  if (usage.lastUpdated !== today) {
    usage.daily = 0;
    // Reset weekly/monthly if needed based on date logic, but for simplicity:
    usage.lastUpdated = today;
  }

  usage.daily += tokens;
  usage.weekly += tokens;
  usage.monthly += tokens;

  return JSON.stringify(usage);
};

async function callAI(prompt: string, userProfile?: UserProfile, modelType: 'text' | 'image' = 'text'): Promise<{ text?: string, image?: string, tokens: number }> {
  const language = userProfile?.language || 'zh';
  const finalPrompt = modelType === 'text' 
    ? `${prompt}\n\nIMPORTANT: Respond in ${language === 'zh' ? 'Chinese (中文)' : 'English'}.` 
    : prompt;

  let aiConfigs: AIConfig[] = [];
  if (userProfile?.aiConfigs) {
    try {
      aiConfigs = JSON.parse(userProfile.aiConfigs);
    } catch (e) {}
  }

  const activeConfig = aiConfigs.find(c => c.isDefault);

  if (!activeConfig || modelType === 'image') {
    // Fallback to default Gemini
    const model = modelType === 'image' ? "gemini-2.5-flash-image" : "gemini-3.1-pro-preview";
    const response = await defaultAi.models.generateContent({
      model,
      contents: finalPrompt,
    });
    
    let image: string | undefined;
    if (modelType === 'image') {
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          image = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    return { 
      text: response.text, 
      image,
      tokens: finalPrompt.length / 4 // Rough estimation
    };
  }

  // Call custom API
  try {
    const response = await fetch(activeConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeConfig.apiKey}`
      },
      body: JSON.stringify({
        model: activeConfig.modelId,
        messages: [{ role: 'user', content: finalPrompt }],
        // Adjust based on protocol
      })
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || data.content?.[0]?.text;
    return { text, tokens: finalPrompt.length / 4 };
  } catch (e) {
    console.error("Custom AI call failed", e);
    throw e;
  }
}

export async function generateChapterContent(
  novel: Novel, 
  previousChapters: Chapter[], 
  chapterNumber: number,
  userProfile?: UserProfile,
  instruction?: string
): Promise<{ content: string, tokenUsageJson?: string }> {
  const context = previousChapters
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(c => `Chapter ${c.chapterNumber}: ${c.title}\n${c.content}`)
    .join('\n\n');

  const prompt = `
    You are an autonomous novel writing agent. Your task is to write Chapter ${chapterNumber} of a novel.
    
    Novel Title: ${novel.title}
    Novel Outline: ${novel.outline || 'No outline provided.'}
    Style Guide: ${novel.styleGuide || 'Write in a professional and engaging style.'}
    
    Global Writing Rules:
    ${userProfile?.globalRules || 'Follow standard creative writing best practices.'}
    
    World Background:
    ${novel.background || 'Not specified.'}
    
    Characters:
    ${novel.characters || 'Not specified.'}
    
    Plotlines/Arcs:
    ${novel.plotlines || 'Not specified.'}
    
    Items/Artifacts:
    ${novel.items || 'Not specified.'}
    
    Previous Chapters Context:
    ${context || 'This is the first chapter.'}
    
    ${instruction ? `USER INSTRUCTION: ${instruction}` : 'Write a complete, engaging chapter that follows the plot, style guide, and world-building details. Focus on character development and narrative flow.'}
  `;

  const result = await callAI(prompt, userProfile);
  return { 
    content: result.text || "", 
    tokenUsageJson: updateTokenUsage(userProfile, result.tokens) 
  };
}

export async function auditChapter(novel: Novel, chapter: Chapter, userProfile?: UserProfile, instruction?: string): Promise<{ feedback: string, tokenUsageJson?: string }> {
  const prompt = `
    You are an expert novel editor. Audit the following chapter for consistency, plot holes, pacing, and adherence to the style guide and world-building.
    
    Novel Title: ${novel.title}
    Novel Outline: ${novel.outline || 'No outline provided.'}
    Style Guide: ${novel.styleGuide || 'No specific style guide.'}
    
    Global Writing Rules:
    ${userProfile?.globalRules || 'Standard editing rules.'}
    
    World Background:
    ${novel.background || 'Not specified.'}
    
    Characters:
    ${novel.characters || 'Not specified.'}
    
    Chapter ${chapter.chapterNumber} Content:
    ${chapter.content}
    
    ${instruction ? `USER FOCUS/INSTRUCTION: ${instruction}` : 'Provide detailed, constructive feedback for the author to improve this chapter.'}
  `;

  const result = await callAI(prompt, userProfile);
  return { 
    feedback: result.text || "", 
    tokenUsageJson: updateTokenUsage(userProfile, result.tokens) 
  };
}

export async function reviseChapter(novel: Novel, chapter: Chapter, feedback: string, userProfile?: UserProfile, instruction?: string): Promise<{ content: string, tokenUsageJson?: string }> {
  const prompt = `
    You are an autonomous novel writing agent. Revise Chapter ${chapter.chapterNumber} based on the following audit feedback.
    
    Novel Title: ${novel.title}
    Novel Outline: ${novel.outline || 'No outline provided.'}
    Style Guide: ${novel.styleGuide || 'No specific style guide.'}
    
    Global Writing Rules:
    ${userProfile?.globalRules || 'Standard writing rules.'}
    
    Original Chapter Content:
    ${chapter.content}
    
    Audit Feedback:
    ${feedback}
    
    ${instruction ? `USER INSTRUCTION: ${instruction}` : 'Rewrite the chapter to address the feedback while maintaining the original intent and narrative voice.'}
  `;

  const result = await callAI(prompt, userProfile);
  return { 
    content: result.text || "", 
    tokenUsageJson: updateTokenUsage(userProfile, result.tokens) 
  };
}

export async function analyzePlatform(platformName: string, userProfile?: UserProfile, instruction?: string): Promise<{ analysis: string, tokenUsageJson?: string }> {
  const language = userProfile?.language || 'zh';
  const prompt = `
    Analyze the novel publishing platform: "${platformName}".
    ${instruction ? `USER FOCUS: ${instruction}` : ''}
    1. Describe the platform's characteristics, target audience, and popular genres.
    2. Identify and analyze 10 trending/bestselling books on this platform from the past year.
    3. Provide specific writing suggestions (style, tropes, pacing) for a new novel aiming to succeed on this platform.
    Use Google Search to find the most recent data.
    
    IMPORTANT: The entire analysis report must be written in ${language === 'zh' ? 'Chinese (中文)' : 'English'}.
  `;

  const response = await defaultAi.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { 
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    }
  });

  return { 
    analysis: response.text || "", 
    tokenUsageJson: updateTokenUsage(userProfile, prompt.length / 4) 
  };
}

export async function generateChapterTitle(content: string, instruction?: string, userProfile?: UserProfile): Promise<{ title: string, tokenUsageJson?: string }> {
  const prompt = `
    Based on the following chapter content, generate a creative and engaging chapter title.
    ${instruction ? `Style/Instruction: ${instruction}` : ''}
    
    Content:
    ${content.slice(0, 2000)}
    
    Return only the title text.
  `;

  const result = await callAI(prompt, userProfile);
  return { 
    title: result.text?.trim() || "", 
    tokenUsageJson: updateTokenUsage(userProfile, result.tokens) 
  };
}

export async function optimizeContent(type: string, currentContent: string, instruction: string, userProfile?: UserProfile): Promise<{ optimized: string, tokenUsageJson?: string }> {
  const prompt = `
    Optimize the following ${type} for a novel.
    Current Content: ${currentContent}
    Instruction: ${instruction}
    
    Expand, enrich, and improve the content based on the instruction while maintaining consistency.
  `;

  const result = await callAI(prompt, userProfile);
  return { 
    optimized: result.text || "", 
    tokenUsageJson: updateTokenUsage(userProfile, result.tokens) 
  };
}

export async function generateCoverImage(novelTitle: string, description: string, instruction?: string): Promise<string> {
  const prompt = `A professional book cover for a novel titled "${novelTitle}". 
    Description: ${description}. 
    ${instruction ? `Additional Instructions: ${instruction}` : ''}
    Digital art style, high quality, cinematic lighting.`;
  const result = await callAI(prompt, undefined, 'image');
  return result.image || "";
}
