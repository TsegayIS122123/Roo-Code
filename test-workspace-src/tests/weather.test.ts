// src/tests/weather.test.ts
import { fetchWeather } from "../api/weather/fetch"
import { WeatherResponse } from "../api/weather/types"

// Mock the global fetch function
const mockFetch = jest.fn()

global.fetch = mockFetch

describe("fetchWeather", () => {
	it("should fetch weather data for a given city", async () => {
		// Setup mock response
		const mockResponse = {
			ok: true,
			json: async () => ({
				main: { temp: 25, humidity: 60 },
				weather: [{ main: "Clear" }],
				wind: { speed: 5 },
			}),
		}
		mockFetch.mockResolvedValueOnce(mockResponse as any)

		// Call the function
		const result: WeatherResponse = await fetchWeather("London")

		// Assertions
		expect(result.temperature).toBe(25)
		expect(result.humidity).toBe(60)
		expect(result.condition).toBe("Clear")
		expect(result.windSpeed).toBe(5)
		expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("London"))
	})

	it("should throw an error for a failed response", async () => {
		const errorResponse = {
			ok: false,
			status: 404,
			text: async () => "City not found",
		}
		mockFetch.mockResolvedValueOnce(errorResponse as any)

		await expect(fetchWeather("Nowhere")).rejects.toThrow("Weather API error (404)")
	})
})
