// ==========================================
// weather.js - Calendar & Seasons Engine
// ==========================================

function getSeasonKey(day) {
    if (day <= 91) return 'spring';
    if (day <= 182) return 'summer';
    if (day <= 273) return 'fall';
    return 'winter';
}

function updateWeatherUI() {
    if (!weatherData.seasons || !weatherData.types) return;

    const seasonKey = getSeasonKey(state.day);
    const season = weatherData.seasons[seasonKey];
    const weather = weatherData.types[state.currentWeather];

    const uiDay = document.getElementById('ui-day');
    if (uiDay) {
        uiDay.innerText = state.day;
        document.getElementById('ui-year').innerText = state.year;
        document.getElementById('ui-season-icon').innerText = season.icon;
        document.getElementById('ui-season').innerText = season.name;
        document.getElementById('ui-weather-icon').innerText = weather.icon;
        document.getElementById('ui-weather').innerText = weather.name;

        let effectText = "Normal crop conditions.";
        if (weather.growSpeed > 1) effectText = "Crops grow faster!";
        if (weather.growSpeed < 1) effectText = "Crops grow slower.";
        if (weather.yieldBonus > 0) effectText += ` (+${weather.yieldBonus} Yield)`;
        document.getElementById('ui-weather-effect').innerText = effectText;
    }

    document.body.style.backgroundColor = season.color;
    drawWeatherParticles();
}

function drawWeatherParticles() {
    const overlay = document.getElementById('weather-overlay');
    if (!overlay) return;
    overlay.innerHTML = ''; 

    if (state.currentWeather === 'rainy' || state.currentWeather === 'snowy') {
        const particleCount = state.currentWeather === 'rainy' ? 40 : 25;
        const className = state.currentWeather === 'rainy' ? 'rain-drop' : 'snow-drop';
        
        for (let i = 0; i < particleCount; i++) {
            const drop = document.createElement('div');
            drop.className = `weather-drop ${className}`;
            drop.style.left = `${Math.random() * 100}vw`;
            drop.style.animationDuration = `${Math.random() * 1 + 0.5}s`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            overlay.appendChild(drop);
        }
    }
}

function advanceDay() {
    state.day++;
    if (state.day > 365) {
        state.day = 1;
        state.year++;
    }
    state.lastDayTick = Date.now();

    const season = weatherData.seasons[getSeasonKey(state.day)];
    const chances = season.chances;
    
    let rand = Math.random() * 100;
    if (rand < chances.sunny) state.currentWeather = 'sunny';
    else if (rand < chances.sunny + chances.cloudy) state.currentWeather = 'cloudy';
    else if (rand < chances.sunny + chances.cloudy + chances.rainy) state.currentWeather = 'rainy';
    else state.currentWeather = 'snowy';

    updateWeatherUI();
    saveGame();
    showMessage(`A new day has dawned! It is ${weatherData.types[state.currentWeather].name}.`);
}