  
const apiKey = "4fcd0d4855e24280a52121246261504";

window.onload = () => {
  getWeather("Visnjevac");
};

async function getWeather(city) {
  
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city}&days=4`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    displayWeather(data);
  } catch (error) {
    console.error("Error:", error);
  }
}

function displayWeather(data) {

  const weatherDiv = document.getElementById("weather");


  weatherDiv.innerHTML = `
    <h2 class="visnjevac">${data.location.name}</h2>
    <p><strong>${data.location.localtime}</strong></p>
    <p><strong>${data.current.temp_c}°C</strong></p>
    <p>${data.current.condition.text}</p>
    <hr>
    <div class="forecast"></div>
  `;

    const forecastDiv = weatherDiv.querySelector(".forecast");


    data.forecast.forecastday.slice(1, 4).forEach(day => {
        const dayEl = document.createElement("div");
        dayEl.classList.add("day");

    dayEl.innerHTML = `
        <h3>${day.date}</h3>
        <p>${day.day.maxtemp_c}°C / ${day.day.mintemp_c}°C</p>
        <p>${day.day.condition.text}</p>
    `;

  forecastDiv.appendChild(dayEl);
  });
}