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
  const mcpConfig = {
    "name": "KisanMitra",
    "description": "Provides daily weather-based farming tips, forecasts, and emergency alerts for Indian farmers with Bearer token authentication.",
    "version": "1.0.0",
    "authentication": {
      "type": "bearer",
      "description": "Requires Bearer token authentication. Set MCP_BEARER_TOKEN environment variable."
    },
    "functions": [
      {
        "name": "get-farmer-advice",
        "description": "Get daily farming advice based on crop and region, with optional language preference. Requires Bearer token authentication.",
        "method": "GET",
        "authentication_required": true,
        "parameters": {
          "type": "object",
          "properties": {
            "crop": {
              "type": "string",
              "description": "The name of the crop (e.g., wheat, rice, maize, cotton, sugarcane, tomato)",
              "required": true,
              "examples": ["wheat", "rice", "maize", "cotton", "sugarcane"]
            },
            "region": {
              "type": "string", 
              "description": "Region name or city where the crop is grown (e.g., Delhi, Punjab, Lucknow, Mumbai, Chennai)",
              "required": true,
              "examples": ["Delhi", "Punjab", "Lucknow", "Mumbai", "Chennai"]
            },
            "lang": {
              "type": "string",
              "description": "Language code for the advice. 'en' for English, 'hi' for Hindi. Default: 'en'",
              "default": "en",
              "enum": ["en", "hi"],
              "required": false
            }
          },
          "required": ["crop", "region"]
        },
        "headers": {
          "Authorization": "Bearer {token}",
          "Content-Type": "application/json"
        },
        "returns": {
          "type": "object",
          "properties": {
            "success": { "type": "boolean" },
            "data": {
              "type": "object",
              "properties": {
                "crop": { "type": "string" },
                "region": { "type": "string" },
                "forecast": { "type": "string", "description": "Current weather conditions" },
                "daily_tip": { "type": "string", "description": "AI-generated farming advice" },
                "emergency_alert": { "type": "string", "description": "Weather-based alerts and warnings" },
                "timestamp": { "type": "string", "description": "ISO timestamp of response" },
                "language": { "type": "string", "description": "Response language" }
              }
            }
          }
        },
        "url": `${req.protocol}://${req.get('host')}/get-farmer-advice`
      }
    ],
    "endpoints": {
      "health": {
        "url": `${req.protocol}://${req.get('host')}/health`,
        "method": "GET",
        "description": "Health check endpoint",
        "authentication_required": false
      },
      "mcp_config": {
        "url": `${req.protocol}://${req.get('host')}/mcp`,
        "method": "GET",
        "description": "MCP configuration endpoint", 
        "authentication_required": false
      }
    }
  };
  
  res.json(mcpConfig);
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