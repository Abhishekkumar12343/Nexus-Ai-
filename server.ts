import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { TOOLS_DB } from "./src/lib/tools-db";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/smart-search", async (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        throw new Error("GEMINI_API_KEY is not configured. Please set it in the Secrets panel.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        You are a recommendation engine for an AI tools aggregator called "Nexus".
        User Query: "${query}"
        
        Available Tools Database:
        ${JSON.stringify(TOOLS_DB.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, tags: t.tags })))}
        
        Task:
        Analyze the user's intent and recommend the best 1 to 3 tools from the database that solve their problem.
        Return ONLY a strict JSON array containing the "id" strings of the recommended tools.
        Example Output: ["1", "3"]
      `;

      const response = await ai.models.generateContent({
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

      const recommendedIds = JSON.parse(response.text || "[]");
      res.json({ recommendedIds });
    } catch (error) {
      console.error("Smart Search Error:", error);
      res.status(500).json({ error: "Failed to perform smart search" });
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
