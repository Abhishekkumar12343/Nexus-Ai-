import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { TOOLS_DB } from "../lib/tools-db";

// Use the provided API key from the environment
// AI Studio Build injects this into the environment
const getApiKey = () => {
  // process.env.API_KEY is the user-selected key from the dialog
  // process.env.GEMINI_API_KEY is the default environment key
  return process.env.API_KEY || process.env.GEMINI_API_KEY;
};

async function generateWithRetry(ai: any, params: any, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.message?.includes("503") || 
        error.message?.includes("429") || 
        error.status === 503 || 
        error.status === 429;

      if (isRetryable && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.log(`Retrying Gemini API call (attempt ${i + 1}/${maxRetries}) after ${delay.toFixed(0)}ms due to: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function smartSearch(query: string, aiContext?: any, language?: string, deepResearch?: boolean) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please ensure GEMINI_API_KEY is set in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let contextString = "";
  if (aiContext) {
    contextString = `
    User Context (Persistent Memory):
    - Goals: ${aiContext.goals || "Not specified"}
    - Style: ${aiContext.style || "Not specified"}
    - Work: ${aiContext.work || "Not specified"}
    
    Use this context to better understand the user's intent and provide more personalized recommendations.
    `;
  }

  const languageInstructions = language && language !== 'en' ? `
  The user's preferred language is ${language}. 
  - If the query is in ${language}, analyze it correctly.
  - If the user asks a question or needs an explanation, respond in ${language}.
  - However, the tool names and IDs should remain as they are in the database.
  ` : "";

  const deepResearchInstructions = deepResearch ? `
  DEEP RESEARCH MODE ENABLED:
  - You have access to Google Search. Use it to deeply understand the user's problem and find the most relevant tools from the database.
  - Use your advanced reasoning (Thinking Level: HIGH) to analyze complex requests.
  ` : "";

  const prompt = `
    You are a highly intelligent recommendation engine for an AI tools aggregator called "Nexus".
    
    ${contextString}
    ${languageInstructions}
    ${deepResearchInstructions}

    User Query: "${query}"
    
    Available Tools Database:
    ${JSON.stringify(TOOLS_DB.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, tags: t.tags })))}
    
    Task:
    1. Analyze the user's intent. What are they trying to achieve?
    2. Identify 1 to 5 tools from the database that can help them achieve their goal.
       - Be flexible: if they want to "create a card", suggest design tools (Canva, Microsoft Designer) or image generators (Midjourney, DALL-E).
       - If they want to "write a story", suggest writing assistants (ChatGPT, Claude, Jasper).
       - If they want to "make a video", suggest video tools (Luma, Sora, Runway).
    3. Even if there isn't a perfect match, suggest the most relevant tools that could be used for the task.
    
    Return a strict JSON object with:
    - "recommendedIds": A JSON array containing the "id" strings of the recommended tools (1 to 5 tools).
    - "explanation": A concise explanation (1-3 sentences) of how these tools help or an answer to the user's question if they asked one.
    
    Example Output: { "recommendedIds": ["12", "34", "1"], "explanation": "These tools are perfect for story writing and character development." }
  `;

  const model = deepResearch ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";

  const response = await generateWithRetry(ai, {
    model: model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING }
        },
        required: ["recommendedIds", "explanation"]
      },
      thinkingConfig: deepResearch ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
      tools: deepResearch ? [{ googleSearch: {} }] : undefined,
      toolConfig: deepResearch ? { includeServerSideToolInvocations: true } : undefined
    }
  });

  const text = response.text || "{}";
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  const result = JSON.parse(cleanText);
  return {
    recommendedIds: result.recommendedIds || [],
    explanation: result.explanation || "",
    usage: response.usageMetadata
  };
}

export async function translateTools(toolIds: string[], language: string) {
  if (!toolIds || toolIds.length === 0 || !language || language === 'en') {
    return { translations: {} };
  }

  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please ensure GEMINI_API_KEY is set in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const toolsToTranslate = TOOLS_DB.filter(t => toolIds.includes(t.id));
  
  if (toolsToTranslate.length === 0) {
    return { translations: {} };
  }

  const prompt = `
    You are a professional translator. 
    Translate the following AI tool descriptions into ${language}.
    
    Rules:
    1. Keep the tool names in English.
    2. Translate the descriptions accurately and naturally in ${language}.
    3. Return ONLY a strict JSON object where keys are tool IDs and values are the translated descriptions.
    
    Tools to translate:
    ${JSON.stringify(toolsToTranslate.map(t => ({ id: t.id, name: t.name, description: t.description })))}
    
    Example Output: {"1": "यह एक बेहतरीन टूल है...", "2": "यह वीडियो बनाने में मदद करता है..."}
  `;

  const response = await generateWithRetry(ai, {
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: toolsToTranslate.reduce((acc: any, t) => {
          acc[t.id] = { type: Type.STRING };
          return acc;
        }, {})
      }
    }
  });

  const text = response.text || "{}";
  const cleanText = text.replace(/```json\n?|```/g, "").trim();
  return {
    translations: JSON.parse(cleanText),
    usage: response.usageMetadata
  };
}

export async function generateImage(prompt: string, aspectRatio: string = "1:1", highQuality: boolean = false) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = highQuality ? "gemini-3-pro-image-preview" : "gemini-3.1-flash-image-preview";

  const response = await ai.models.generateContent({
    model: model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

export function connectLive(callbacks: any) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  return ai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    callbacks,
    config: {
      responseModalities: ["AUDIO" as any],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: "You are a helpful AI assistant for Nexus, an AI tools aggregator. You can help users find tools, explain how they work, and have a natural conversation.",
    },
  });
}

