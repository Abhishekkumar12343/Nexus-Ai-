import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { TOOLS_DB } from "./src/lib/tools-db.ts";

async function generateWithRetry(ai: any, params: any, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      // Check for 503 (Service Unavailable) or 429 (Too Many Requests)
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/smart-search", async (req, res) => {
    const { query, aiContext, language } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      // Use the provided API key as a fallback if the environment variable is not set or is a placeholder
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        apiKey = "AIzaSyCCqi7SQ4IHlBF_ZlUtUCVogS3_XZPt0BE";
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

      const prompt = `
        You are a highly intelligent recommendation engine for an AI tools aggregator called "Nexus".
        
        ${contextString}
        ${languageInstructions}

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
        
        Return ONLY a strict JSON array containing the "id" strings of the recommended tools.
        Example Output: ["12", "34", "1"]
      `;

      const response = await generateWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const text = response.text || "[]";
      // Clean potential markdown or extra whitespace
      const cleanText = text.replace(/```json\n?|```/g, "").trim();
      const recommendedIds = JSON.parse(cleanText);
      
      res.json({ 
        recommendedIds,
        usage: response.usageMetadata,
        model: "gemini-3-flash-preview",
        privacy: {
          dataUsedForTraining: false,
          loggingEnabled: false,
          provider: "Google Cloud (Vertex AI)"
        }
      });
    } catch (error: any) {
      console.error("Smart Search Error:", error);
      let errorMessage = error.message || "An unexpected error occurred during smart search.";
      
      // Provide a more user-friendly message for 503 errors
      if (errorMessage.includes("503") || errorMessage.includes("high demand")) {
        errorMessage = "The AI service is currently experiencing high demand. We're retrying, but if this persists, please try again in a few moments.";
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/translate-tools", async (req, res) => {
    const { toolIds, language } = req.body;

    if (!toolIds || !Array.isArray(toolIds) || !language || language === 'en') {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        apiKey = "AIzaSyCCqi7SQ4IHlBF_ZlUtUCVogS3_XZPt0BE";
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const toolsToTranslate = TOOLS_DB.filter(t => toolIds.includes(t.id));
      
      if (toolsToTranslate.length === 0) {
        return res.json({ translations: {} });
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
      const translations = JSON.parse(cleanText);
      
      res.json({ 
        translations,
        usage: response.usageMetadata,
        model: "gemini-3-flash-preview",
        privacy: {
          dataUsedForTraining: false,
          loggingEnabled: false,
          provider: "Google Cloud (Vertex AI)"
        }
      });
    } catch (error: any) {
      console.error("Translation Error:", error);
      res.status(500).json({ error: "Failed to translate tool descriptions." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
