import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { getWeather, getAlert } from "./utils.js";

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/get-farmer-advice", async (req, res) => {
  const { crop, region, lang = "en" } = req.query;
  if (!crop || !region) {
    return res.status(400).json({ error: "Missing crop or region parameter" });
  }

  try {
    // 1. Weather data
    const weather = await getWeather(region);

    // 2. Emergency alerts
    const emergency = getAlert(weather);

    // 3. AI-generated advice (also translation if needed)
    const prompt = `
      You are a farming assistant.
      Weather: ${weather.description}, Temperature: ${weather.temp}°C, Wind Speed: ${weather.wind} km/h
      Crop: ${crop}
      Emergency alert: ${emergency}
      Give a short, practical farming tip for this situation.
      Language: ${lang === "hi" ? "Hindi" : "English"}
    `;

    const aiResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const advice = aiResp.choices[0].message.content;

    res.json({
      crop,
      region,
      forecast: `${weather.description}, ${weather.temp}°C`,
      daily_tip: advice,
      emergency_alert: emergency
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("MCP server running on port 3000"));
