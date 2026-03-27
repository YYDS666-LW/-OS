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
    ${novel.authorStylePrompt ? `\n    MANDATORY AUTHOR STYLE (文风模仿):\n    ${novel.authorStylePrompt}\n    You MUST strictly follow this style guide for all generated content.` : ''}
    
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
    ${novel.authorStylePrompt ? `\n    MANDATORY AUTHOR STYLE (文风模仿):\n    ${novel.authorStylePrompt}\n    You MUST strictly audit the chapter against this style guide.` : ''}
    
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
    ${novel.authorStylePrompt ? `\n    MANDATORY AUTHOR STYLE (文风模仿):\n    ${novel.authorStylePrompt}\n    You MUST strictly follow this style guide for the revision.` : ''}
    
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

export async function analyzeAuthorStyle(authorName: string, userProfile?: UserProfile, instruction?: string): Promise<{ analysis: string, tokenUsageJson?: string }> {
  const language = userProfile?.language || 'zh';
  const prompt = `
## Profile
你是一位精通大数据文本挖掘和心智建模的顶级专家。你的绝活是从杂乱无章的、跨主题的多篇文章（语料库）中，精准提取出一个作者的“底层操作系统（Author OS）”。你能够过滤掉因特定话题带来的“变量”，精准锚定该作者在逻辑推演、叙事习惯、语言美学上的“绝对不变量”，并提炼出高度可迁移的风格资产。

## Task
请使用 Google Search 搜索并深度交叉比对作者“${authorName}”的多篇文章和作品，剥离所有特定主题的具体信息，从 5 个宏观与微观交织的维度，提取出跨文本的共同特征。最终输出一份结构化的 JSON《作者心智与风格克隆大纲》，并生成一个可用于批量化内容生成的 System Prompt。
${instruction ? `\nUSER FOCUS: ${instruction}\n` : ''}

## Rules & Constraints (绝对铁律)
1. **交叉验证原则 (Cross-Validation)**：只有在至少 70% 的样本文本中重复出现的结构、句式、逻辑推演方式，才能被认定为“核心风格”。偶尔出现一次的孤证必须舍弃，视为噪音。
2. **负面空间界定 (Negative Space)**：必须敏锐地捕捉到作者“绝对不使用”的词汇、句式、情绪和结构。定义“什么不是他”，往往比“什么是他”更准。
3. **话题不可知论 (Topic-Agnostic)**：提取的特征必须能够完美平移到任何全新的话题上。绝对禁止在最终特征中包含原文的具体案例、行业术语或人名。
4. **格式纯净**：严格只输出合法的 JSON 格式，不附加任何问候、解释或过渡性废话。

## Analysis Dimensions (5大跨文本提取维度)
1. **绝对不变量：内核世界观 (Core Paradigm)**
   - 作者看待万事万物的底层滤镜是什么？（如：万物皆可量化/一切都是博弈/极度实用主义/人文关怀至上）。
   - 跨文章高度统一的“高频概念模型”（如：总喜欢用“复利”、“降维”、“本质”等词汇来构建解释域）。
2. **跨域骨架：通用推演结构 (Universal Scaffolding)**
   - 无论写什么话题，作者雷打不动的行文骨架是什么？（如：提出反常现象 -> 证伪大众认知 -> 给出独家理论 -> 提供落地方案）。
   - 段落之间的典型过渡/缝合技巧。
3. **心智钩子：高频情绪操控点 (High-Frequency Mental Hooks)**
   - 作者最擅长在哪个环节制造“认知张力”或“情绪共鸣”？（如：开篇300字内必定制造一个认知焦虑；结尾必定拔高到人生哲学的通透感）。
   - 互动感营造的固有套路（如高频设问、虚拟对话）。
4. **美学特征与呼吸感 (Aesthetics & Rhythm)**
   - 剥去血肉后，整体文章的节奏感。（如：长短句的交替规律，是否偏好单句成段的视觉冲击力）。
   - 标志性的修辞偏好（比喻/排比/拟人）及其在所有文章中的共同特征。
5. **绝对禁区：防伪标签 (The "Never" List)**
   - 什么是这个作者绝对不会写的？（如：绝不用轻佻的网络烂梗；绝不写没有明确结论的开放式结尾；绝不用鸡汤式的情感宣泄）。

## Output Format (JSON Schema)
请严格遵循以下 JSON 结构输出，\`consistency_score\`（一致性得分）范围为 1-10，代表该特征在语料库中的稳定程度：

\`\`\`json
{
  "author_os_profile": {
    "1_core_paradigm": {
      "worldview_filter": "世界观滤镜描述...",
      "high_frequency_mental_models": ["模型1", "模型2"],
      "consistency_score": 0
    },
    "2_universal_scaffolding": {
      "invariant_structure": ["步骤1", "步骤2", "步骤3"],
      "transition_mechanics": "过渡技巧描述...",
      "consistency_score": 0
    },
    "3_mental_hooks": {
      "tension_building_tactics": "制造张力的手法...",
      "interactive_patterns": "互动模式...",
      "consistency_score": 0
    },
    "4_aesthetics_and_rhythm": {
      "pacing_rules": "行文节奏与长短句规律...",
      "rhetorical_signatures": "标志性修辞...",
      "consistency_score": 0
    },
    "5_the_never_list": {
      "forbidden_tones": ["禁区1", "禁区2"],
      "forbidden_structures": ["禁区1", "禁区2"],
      "consistency_score": 10
    }
  },
  "master_clone_prompt": "【请在此生成一段高度浓缩、可直接作为System Prompt使用的系统指令。必须明确告知AI：采用何种世界观滤镜、套用何种跨域骨架、使用何种节奏，并极其严厉地强调'绝对禁区'（不能出现的情况），以确保生成的文章不仅形似，而且神似，且不会出现违和的表达。】"
}
\`\`\`
  `;

  const response = await defaultAi.models.generateContent({
    model: "gemini-3.1-pro-preview",
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
