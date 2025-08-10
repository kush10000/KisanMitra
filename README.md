# KisanMitra - AI-Powered Farming Assistant MCP Server

KisanMitra is an MCP (Model Context Protocol) server that provides Indian farmers with AI-powered, weather-based farming advice, forecasts, and emergency alerts. Built for the PuchAI hackathon.

## Features

- 🌾 **Crop-specific advice** for major Indian crops (wheat, rice, maize, cotton, etc.)
- 🌤️ **Real-time weather integration** using OpenWeatherMap API
- 🚨 **Emergency alerts** for extreme weather conditions
- 🌍 **Multi-language support** (English and Hindi)
- 🔐 **Bearer token authentication** for secure access
- 🤖 **AI-powered recommendations** using OpenAI GPT-4

## Prerequisites

- Node.js (v18 or higher)
- OpenAI API key
- OpenWeatherMap API key

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd kisanmitra
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENWEATHER_API_KEY=your_openweather_api_key_here
   MCP_BEARER_TOKEN=your_secure_bearer_token_here
   PORT=3000
   ```

4. **Generate Bearer Token**
   ```bash
   # Generate a secure random token
   openssl rand -hex 32
   # Or use Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## MCP Connection

To connect to this MCP server:

```bash
/mcp connect https://kisanmitra-lfc2.onrender.com/mcp YOUR_BEARER_TOKEN
```

Replace `YOUR_BEARER_TOKEN` with the token you set in your `.env` file.

## API Endpoints

### 1. Get Farmer Advice (Protected)
**Endpoint:** `GET /get-farmer-advice`
**Authentication:** Bearer token required

**Parameters:**
- `crop` (required): Name of the crop (e.g., wheat, rice, maize)
- `region` (required): Region/city name (e.g., Punjab, Delhi, Mumbai)
- `lang` (optional): Language preference ('en' for English, 'hi' for Hindi)

**Headers:**
```
Authorization: Bearer your_bearer_token_here
```

**Example Request:**
```bash
curl -H "Authorization: Bearer your_token" \
     "https://kisanmitra-lfc2.onrender.com/get-farmer-advice?crop=wheat&region=Punjab&lang=en"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "crop": "wheat",
    "region": "Punjab", 
    "forecast": "clear sky, 18°C, Wind: 5 km/h",
    "daily_tip": "Good weather conditions for wheat. Ensure proper irrigation as temperatures are moderate. Monitor for aphid infestation during this season.",
    "emergency_alert": "No urgent issues.",
    "timestamp": "2024-08-10T10:30:00.000Z",
    "language": "en"
  }
}
```

### 2. Health Check (Public)
**Endpoint:** `GET /health`
**Authentication:** None required

### 3. MCP Configuration (Public)
**Endpoint:** `GET /mcp`
**Authentication:** None required

## Supported Crops

- Wheat (गेहूं)
- Rice (चावल)
- Maize (मक्का)
- Cotton (कपास)
- Sugarcane (गन्ना)
- Tomato (टमाटर)
- Potato (आलू)
- Onion (प्याज)
- And many more...

## Supported Regions

KisanMitra supports all major Indian cities and agricultural regions:
- Punjab, Haryana (wheat belt)
- Tamil Nadu, Andhra Pradesh (rice regions)
- Maharashtra, Gujarat (cotton regions)
- Uttar Pradesh (mixed agriculture)
- And all other Indian states/cities

## Emergency Alerts

The system automatically generates alerts for:
- **Heatwave conditions** (>40°C): Irrigation and shade recommendations
- **Heavy rainfall**: Drainage and crop protection advice  
- **Strong winds** (>40 km/h): Plant security measures
- **Temperature extremes**: Crop-specific protection strategies

## Authentication

This MCP server uses Bearer token authentication:

1. Set `MCP_BEARER_TOKEN` in your environment variables
2. Include the token in requests: `Authorization: Bearer your_token`
3. All `/get-farmer-advice` requests require authentication
4. Public endpoints (`/health`, `/mcp`) don't require authentication

## Error Handling

The API provides detailed error responses:

- `400`: Missing required parameters
- `401`: Invalid or missing bearer token  
- `404`: Location/region not found
- `500`: Server errors (API key issues, etc.)

## Deployment

For production deployment (e.g., Render, Railway, Heroku):

1. Set all environment variables in your hosting platform
2. Ensure the bearer token is securely generated and stored
3. Update the URLs in `mcp.json` to match your deployed domain

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or with nodemon for auto-restart
npx nodemon server.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues or questions:
- Create an issue on GitHub
- Contact the development team

---

**Built for PuchAI Hackathon 2024** 🚀

*Empowering Indian farmers with AI-driven agricultural insights*