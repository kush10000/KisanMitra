import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { getWeather, getAlert } from "./utils.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bearer token authentication middleware
const authenticateBearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Bearer token required' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const expectedToken = process.env.MCP_BEARER_TOKEN;
  
  if (!expectedToken) {
    return res.status(500).json({ 
      error: 'Server configuration error', 
      message: 'MCP_BEARER_TOKEN not configured' 
    });
  }
  
  if (token !== expectedToken) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid bearer token' 
    });
  }
  
  next();
};

// Public route - MCP configuration (no auth required)
app.get("/mcp", (req, res) => {
  res.sendFile(path.join(__dirname, "mcp.json"));
});

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Protected route - requires Bearer token authentication
app.get("/get-farmer-advice", authenticateBearer, async (req, res) => {
  const { crop, region, lang = "en" } = req.query;
  
  if (!crop || !region) {
    return res.status(400).json({ 
      error: "Missing parameters", 
      message: "Both crop and region parameters are required" 
    });
  }

  try {
    // 1. Weather data
    const weather = await getWeather(region);

    // 2. Emergency alerts
    const emergency = getAlert(weather);

    // 3. AI-generated advice (also translation if needed)
    const prompt = `
      You are a farming assistant for Indian farmers.
      Weather: ${weather.description}, Temperature: ${weather.temp}°C, Wind Speed: ${weather.wind} km/h
      Crop: ${crop}
      Region: ${region}
      Emergency alert: ${emergency}
      
      Provide a concise, practical farming tip for this situation. Consider:
      - Current weather conditions
      - Crop-specific needs
      - Regional farming practices
      - Seasonal considerations
      
      Language: ${lang === "hi" ? "Hindi (Devanagari script)" : "English"}
      Keep the response under 150 words and actionable.
    `;

    const aiResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200
    });

    const advice = aiResp.choices[0].message.content;

    res.json({
      success: true,
      data: {
        crop,
        region,
        forecast: `${weather.description}, ${weather.temp}°C, Wind: ${weather.wind} km/h`,
        daily_tip: advice,
        emergency_alert: emergency,
        timestamp: new Date().toISOString(),
        language: lang
      }
    });

  } catch (err) {
    console.error("Error in /get-farmer-advice:", err);
    
    // Handle specific error types
    if (err.response?.status === 404) {
      return res.status(404).json({ 
        error: "Location not found", 
        message: `Unable to find weather data for region: ${region}` 
      });
    }
    
    if (err.response?.status === 401) {
      return res.status(500).json({ 
        error: "Weather API authentication failed", 
        message: "Please check OPENWEATHER_API_KEY configuration" 
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      message: err.message || "Something went wrong while processing your request" 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error", 
    message: "An unexpected error occurred" 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not found", 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KisanMitra MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP config: http://localhost:${PORT}/mcp`);
  console.log(`Bearer token authentication enabled: ${process.env.MCP_BEARER_TOKEN ? 'Yes' : 'No'}`);
});