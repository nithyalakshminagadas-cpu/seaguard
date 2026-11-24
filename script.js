
const DEFAULT_LOCATION = {
    name: "Rameswaram, Tamil Nadu",
    latitude: 9.2876,
    longitude: 79.3129
};

let selectedLocation = { ...DEFAULT_LOCATION };

function toggleMenu() {
    document.getElementById("nav")?.classList.toggle("show");
}

function updateText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function format(value, digits = 1) {
    return Number.isFinite(value) ? Number(value).toFixed(digits) : "--";
}

async function getJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Weather service unavailable.");
    }

    return response.json();
}

async function getWeather() {
    const { latitude, longitude } = selectedLocation;

    const weatherURL = new URL(
        "https://api.open-meteo.com/v1/forecast"
    );

    weatherURL.search = new URLSearchParams({
        latitude,
        longitude,
        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "wind_speed_10m",
            "wind_gusts_10m",
            "cloud_cover"
        ].join(","),
        hourly: [
            "temperature_2m",
            "precipitation_probability",
            "weather_code"
        ].join(","),
        forecast_days: "2",
        timezone: "auto",
        wind_speed_unit: "kmh"
    });

    const marineURL = new URL(
        "https://marine-api.open-meteo.com/v1/marine"
    );

    marineURL.search = new URLSearchParams({
        latitude,
        longitude,
        hourly: "wave_height,wave_period,wave_direction",
        forecast_days: "2",
        timezone: "auto"
    });

    try {
        const [weather, marine] = await Promise.all([
            getJSON(weatherURL),
            getJSON(marineURL).catch(() => null)
        ]);

        displayWeather(weather, marine);

        updateText("errorMessage", "");
    } catch (error) {
        console.error(error);
        updateText(
            "errorMessage",
            "Unable to load weather. Check your internet connection."
        );
    }
}

function displayWeather(data, marine) {
    const current = data.current;

    updateText("locationName", selectedLocation.name);
    updateText("temperature", format(current.temperature_2m) + " °C");
    updateText("feelsLike", format(current.apparent_temperature) + " °C");
    updateText("wind", format(current.wind_speed_10m) + " km/h");
    updateText("gusts", format(current.wind_gusts_10m) + " km/h");
    updateText("humidity", format(current.relative_humidity_2m, 0) + " %");
    updateText("rainfall", format(current.precipitation) + " mm");
    updateText("cloudCover", format(current.cloud_cover, 0) + " %");

    updateText(
        "updatedAt",
        "Model time: " + new Date(current.time).toLocaleString()
    );

    // Display marine forecast values when available.
    if (marine?.hourly?.time?.length) {
        const index = marine.hourly.time.findIndex(
            time => new Date(time) >= new Date(current.time)
        );
        const i = index < 0 ? 0 : index;

        updateText(
            "waveHeight",
            format(marine.hourly.wave_height?.[i]) + " m"
        );

        updateText(
            "wavePeriod",
            format(marine.hourly.wave_period?.[i]) + " s"
        );

        updateText(
            "waveDirection",
            format(marine.hourly.wave_direction?.[i], 0) + " °"
        );
    } else {
        updateText("waveHeight", "Unavailable");
        updateText("wavePeriod", "Unavailable");
        updateText("waveDirection", "--");
    }

    displayHourly(data.hourly, current.time);
}

function displayHourly(hourly, currentTime) {
    const container = document.getElementById("hourlyForecast");

    if (!container || !hourly?.time) return;

    let start = hourly.time.findIndex(
        time => new Date(time) >= new Date(currentTime)
    );

    if (start < 0) start = 0;

    const cards = [];

    for (let i = start; i < Math.min(start + 12, hourly.time.length); i++) {
        const time = new Date(hourly.time[i]).toLocaleTimeString(
            [],
            { hour: "numeric" }
        );

        cards.push(`
            <div class="forecast-card">
                <p>${time}</p>
                <h3>${format(hourly.temperature_2m[i], 0)}°C</h3>
                <small>
                    Rain chance:
                    ${format(hourly.precipitation_probability?.[i], 0)}%
                </small>
            </div>
        `);
    }

    container.innerHTML = cards.join("");
}

async function searchLocation(place) {
    const url = new URL(
        "https://geocoding-api.open-meteo.com/v1/search"
    );

    url.search = new URLSearchParams({
        name: place,
        count: "1",
        language: "en",
        format: "json"
    });

    const data = await getJSON(url);

    if (!data.results?.length) {
        throw new Error("Location not found. Try another name.");
    }

    const result = data.results[0];

    selectedLocation = {
        name: [
            result.name,
            result.admin1,
            result.country
        ].filter(Boolean).join(", "),
        latitude: result.latitude,
        longitude: result.longitude
    };

    await getWeather();
}

document.addEventListener("DOMContentLoaded", () => {
    const searchForm = document.getElementById("searchForm");

    if (searchForm) {
        searchForm.addEventListener("submit", async event => {
            event.preventDefault();

            const place = document
                .getElementById("placeInput")
                .value.trim();

            if (!place) return;

            const errorElement = document.getElementById("errorMessage");

            try {
                await searchLocation(place);
                if (errorElement) errorElement.hidden = true;
            } catch (error) {
                if (errorElement) {
                    errorElement.hidden = false;
                    errorElement.textContent = error.message;
                }
            }
        });
    }

    const contactForm = document.getElementById("contactForm");

    if (contactForm) {
        contactForm.addEventListener("submit", event => {
            event.preventDefault();

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const message = document.getElementById("message").value.trim();

            const subject = encodeURIComponent("SeaGuard Feedback");

            const body = encodeURIComponent(
                `Name: ${name}\nEmail: ${email}\n\n${message}`
            );

            updateText(
                "contactStatus",
                "Opening your email application. Review and send the email there."
            );

            window.location.href =
                `mailto:?subject=${subject}&body=${body}`;
        });
    }

    // Load weather on pages that contain weather data elements.
    if (
        document.getElementById("temperature") ||
        document.getElementById("wind")
    ) {
        getWeather();
    }
});
