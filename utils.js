import axios from "axios";

export async function getWeather(region) {
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${region}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
  const weatherResp = await axios.get(weatherUrl);
  const weatherData = await weatherResp.data;

  return {
    description: weatherData.weather?.[0]?.description || "Unknown",
    temp: weatherData.main?.temp || null,
    wind: weatherData.wind?.speed || null
  };
}

export function getAlert(weather) {
  let emergency = "No urgent issues.";
  if (weather.temp > 40) {
    emergency = "Heatwave alert! Irrigate in morning/evening and provide shade if possible.";
  }
  if (weather.description.includes("rain") && weather.temp < 25) {
    emergency = "Heavy rain expected — ensure proper drainage.";
  }
  if (weather.wind > 40) {
    emergency = "Strong winds ahead — secure plants and structures.";
  }
  return emergency;
}
