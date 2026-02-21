// src/api/weather/fetch.ts
import { WeatherResponse } from "./types"

// Weather API fetch function
export async function fetchWeather(city: string): Promise<WeatherResponse> {
	// Retrieve API key from environment variables
	const apiKey = process.env.WEATHER_API_KEY
	if (!apiKey) {
		throw new Error("WEATHER_API_KEY environment variable is not set")
	}

	// Construct request URL for OpenWeatherMap API
	const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
		city,
	)}&units=metric&appid=${apiKey}`

	try {
		const response = await fetch(url)

		// Handle non-successful responses
		if (!response.ok) {
			const errorBody = await response.text()
			throw new Error(`Weather API error (${response.status}): ${errorBody || response.statusText}`)
		}

		// Parse and return the weather data
		const data = await response.json()
		return {
			temperature: data.main.temp,
			condition: data.weather[0].main,
			humidity: data.main.humidity,
			windSpeed: data.wind.speed,
		}
	} catch (error) {
		// Re-throw with more context
		throw new Error(
			`Failed to fetch weather for "${city}": ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
