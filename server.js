import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { getWeather, getAlert } from "./utils.js";
import cors from "cors";

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Essential middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

app.use(express.json());
app.use(express.text());

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Bearer token authentication middleware
const authenticateBearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No valid Authorization header found');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Bearer token must be provided in Authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  const expectedToken = process.env.MCP_BEARER_TOKEN;
  
  if (!expectedToken) {
    console.error('❌ MCP_BEARER_TOKEN environment variable not set');
    return res.status(500).json({ 
      error: 'Server misconfiguration',
      message: 'Authentication not properly configured'
    });
  }
  
  if (token !== expectedToken) {
    console.log(`❌ Invalid token: ${token.substring(0, 8)}...`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      message: 'Bearer token is incorrect'
    });
  }
  
  console.log('✅ Authentication successful');
  next();
};

// Root endpoint - helps with basic connectivity testing
app.get("/", (req, res) => {
  res.json({
    name: "KisanMitra MCP Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      mcp_config: "/mcp",
      farmer_advice: "/get-farmer-advice"
    },
    timestamp: new Date().toISOString()
  });
});

// Health check - critical for MCP validation
app.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    server: "KisanMitra",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      weather_configured: !!process.env.OPENWEATHER_API_KEY,
      auth_configured: !!process.env.MCP_BEARER_TOKEN
    }
  };
  
  console.log('✅ Health check requested');
  res.status(200).json(health);
});

// MCP Configuration - MUST return valid JSON
app.get("/mcp", (req, res) => {
  console.log('📋 MCP configuration requested');
  
  // Get the base URL dynamically
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  const mcpConfig = {
    "schema_version": "1.0",
    "name": "KisanMitra",
    "version": "1.0.0",
    "description": "AI-powered farming assistant providing weather-based agricultural advice for Indian farmers",
    "author": "KisanMitra Team",
    "license": "MIT",
    "authentication": {
      "type": "bearer",
      "description": "Bearer token authentication required for protected endpoints"
    },
    "capabilities": {
      "weather_integration": true,
      "ai_advice": true,
      "multilingual": true,
      "emergency_alerts": true
    },
    "tools": [
      {
        "name": "get_farmer_advice",
        "description": "Get personalized farming advice based on current weather conditions",
        "input_schema": {
          "type": "object",
          "properties": {
            "crop": {
              "type": "string",
              "description": "The crop being grown (e.g., wheat, rice, cotton, maize)",
              "examples": ["wheat", "rice", "cotton", "maize", "tomato", "sugarcane"]
            },
            "region": {
              "type": "string", 
              "description": "Indian city or region name (e.g., Delhi, Mumbai, Punjab)",
              "examples": ["Delhi", "Mumbai", "Chennai", "Punjab", "Maharashtra"]
            },
            "language": {
              "type": "string",
              "description": "Response language preference",
              "enum": ["en", "hi"],
              "default": "en"
            }
          },
          "required": ["crop", "region"]
        }
      }
    ],
    "endpoints": {
      "base": baseUrl,
      "health": `${baseUrl}/health`,
      "farmer_advice": `${baseUrl}/get-farmer-advice`
    },
    "supported_regions": [
      "All Indian states and major cities",
      "Examples: Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad",
      "Punjab, Haryana, Uttar Pradesh, Maharashtra, Tamil Nadu"
    ],
    "supported_crops": [
      "wheat", "rice", "maize", "cotton", "sugarcane", 
      "tomato", "potato", "onion", "soybean", "mustard"
    ]
  };
  
  // Set proper headers for MCP compatibility
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-MCP-Server': 'KisanMitra'
  });
  
  res.status(200).json(mcpConfig);
});

// Protected farming advice endpoint
app.get("/get-farmer-advice", authenticateBearer, async (req, res) => {
  const { crop, region, lang = "en" } = req.query;
  
  console.log(`🌾 Advice request: crop=${crop}, region=${region}, lang=${lang}`);
  
  // Validate required parameters
  if (!crop || !region) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters",
      message: "Both 'crop' and 'region' parameters are required",
      usage: "?crop=wheat&region=Punjab&lang=en"
    });
  }

  try {
    // Step 1: Get weather data
    console.log(`🌤️ Fetching weather for ${region}`);
    const weather = await getWeather(region);
    
    // Step 2: Generate emergency alerts
    const emergency = getAlert(weather);
    
    // Step 3: Create AI prompt
    const prompt = `You are an expert agricultural advisor for Indian farmers.

CURRENT CONDITIONS:
- Location: ${region}, India
- Crop: ${crop}
- Weather: ${weather.description}
- Temperature: ${weather.temp}°C
- Wind: ${weather.wind} km/h
- Emergency Status: ${emergency}

TASK: Provide specific, actionable farming advice for this situation.

GUIDELINES:
- Consider the current weather impact on ${crop}
- Include immediate actions the farmer should take
- Mention any preventive measures needed
- Keep advice practical and location-specific
- Language: ${lang === "hi" ? "Hindi (use Devanagari script)" : "English"}
- Length: Maximum 100 words

Focus on what the farmer should do TODAY based on these conditions.`;

    console.log('🤖 Generating AI advice');
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    const advice = aiResponse.choices[0].message.content;
    
    const response = {
      success: true,
      data: {
        crop: crop,
        region: region,
        weather_forecast: `${weather.description}, ${weather.temp}°C, Wind: ${weather.wind} km/h`,
        farming_advice: advice,
        emergency_alert: emergency,
        language: lang,
        timestamp: new Date().toISOString(),
        confidence: "high"
      },
      metadata: {
        weather_source: "OpenWeatherMap",
        ai_model: "GPT-4o-mini",
        request_id: Math.random().toString(36).substring(7)
      }
    };

    console.log('✅ Advice generated successfully');
    res.json(response);

  } catch (error) {
    console.error('❌ Error generating advice:', error);
    
    // Handle specific error types
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: "Location not found",
        message: `Weather data unavailable for ${region}. Try a major city name.`,
        suggestions: ["Delhi", "Mumbai", "Chennai", "Bangalore", "Kolkata"]
      });
    }
    
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({
        success: false,
        error: "Service temporarily unavailable",
        message: "AI service quota exceeded. Please try again later."
      });
    }
    
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Unable to generate farming advice at this time",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint for debugging authentication
app.get("/test-auth", authenticateBearer, (req, res) => {
  res.json({
    success: true,
    message: "Authentication working correctly",
    timestamp: new Date().toISOString(),
    server: "KisanMitra MCP"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: "An unexpected error occurred"
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    message: `${req.method} ${req.path} is not a valid endpoint`,
    available_endpoints: ["/", "/health", "/mcp", "/get-farmer-advice", "/test-auth"]
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n🌾 ============================================');
  console.log('🌾          KisanMitra MCP Server           🌾');
  console.log('🌾 ============================================');
  console.log(`📡 Server Status: RUNNING`);
  console.log(`🔗 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('📊 Configuration Status:');
  console.log(`   🔑 Bearer Token: ${process.env.MCP_BEARER_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   🌤️  Weather API: ${process.env.OPENWEATHER_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log('');
  console.log('🔗 Endpoints:');
  console.log(`   Root: http://localhost:${PORT}/`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   MCP Config: http://localhost:${PORT}/mcp`);
  console.log(`   Test Auth: http://localhost:${PORT}/test-auth`);
  console.log('');
  console.log('🎯 Ready for MCP connections!');
  console.log('🌾 ============================================\n');
});