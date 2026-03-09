// --- Authentication & User Setup ---
let currentUser = null;
let saveKey = 'tileFarmSave_guest'; 

// DYNAMIC STATE
let state = {
    money: 0,
    inventory: { wheat: 2 },
    unlockedCrops: { wheat: true }, 
    lots: [null, null, null, null],
    lotPrice: 15,
    scytheUnlocked: false,
    planterUnlocked: false,
    muted: false,
    stats: { totalHarvested: 0, totalEarned: 0, totalSpent: 0 },
    shedUnlocked: false,
    machines: [],
    machinePrices: { keg: 5000, juicer: 15000 },
    // Weather System State
    day: 1,
    year: 1,
    currentWeather: 'sunny',
    lastDayTick: Date.now()
};

let crops = {}; 
let artisanData = {};
let machinesData = {};
let weatherData = {};
let messageTimeout;

const sounds = {
    plant: new Audio('assets/audio/plant.mp3'),
    harvest: new Audio('assets/audio/harvest.mp3'),
    money: new Audio('assets/audio/money.mp3')
};

function playSound(name) {
    if (state.muted) return; 
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log("Audio play failed:", e));
    }
}

function checkAuth() {
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return false;
    }
    currentUser = JSON.parse(storedUser);
    saveKey = `tileFarmSave_${currentUser.email}`; 
    
    document.getElementById('user-name').innerText = currentUser.name;
    document.getElementById('user-email').innerText = currentUser.email;
    document.getElementById('user-pic').src = currentUser.picture;
    return true;
}

function signOut() {
    localStorage.removeItem('farmCurrentUser');
    window.location.href = 'index.html';
}

// --- Time Formatter ---
function formatTime(totalSeconds) {
    if (totalSeconds <= 0) return "0s";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// --- WEATHER & CALENDAR SYSTEM ---
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
        // document.getElementById('ui-season').style.color = season.color;
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

// --- Save & Load System ---
function saveGame() {
    localStorage.setItem(saveKey, JSON.stringify(state));
}

function loadGame() {
    const savedState = localStorage.getItem(saveKey);
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        if (parsedState.lots) {
            parsedState.lots.forEach(lot => {
                if (lot !== null && lot.timeLeft !== undefined) {
                    lot.finishTime = Date.now() + (lot.timeLeft * 1000);
                    delete lot.timeLeft;
                }
            });
        }
        
        state = { ...state, ...parsedState }; 
        if (parsedState.inventory) state.inventory = { ...state.inventory, ...parsedState.inventory };
        if (parsedState.unlockedCrops) state.unlockedCrops = { ...state.unlockedCrops, ...parsedState.unlockedCrops };
        if (parsedState.stats) state.stats = { ...state.stats, ...parsedState.stats };
        
        if (parsedState.shedUnlocked !== undefined) state.shedUnlocked = parsedState.shedUnlocked;
        
        // Save File Upgrader
        if (parsedState.machines) {
            state.machines = parsedState.machines.map(m => {
                if (m.recipe === undefined) {
                    m.recipe = null;
                    if (m.isProcessing || m.isReady) {
                        m.recipe = (m.type === 'keg') ? 'beer' : 'strawberry_juice';
                    }
                }
                return m;
            });
        }

        if (parsedState.machinePrices) state.machinePrices = parsedState.machinePrices;
        if (!state.machinePrices) state.machinePrices = { keg: 5000, juicer: 15000 };

        if (parsedState.day !== undefined) state.day = parsedState.day;
        if (parsedState.year !== undefined) state.year = parsedState.year;
        if (parsedState.currentWeather !== undefined) state.currentWeather = parsedState.currentWeather;
        if (parsedState.lastDayTick !== undefined) state.lastDayTick = parsedState.lastDayTick;

        Object.keys(crops).forEach(cropId => {
            if (state.inventory[cropId] === undefined) state.inventory[cropId] = 0;
            if (state.unlockedCrops[cropId] === undefined) state.unlockedCrops[cropId] = (cropId === 'wheat');
            
            const growing = state.lots.filter(lot => lot && lot.type === cropId).length;
            if (state.unlockedCrops[cropId] && state.inventory[cropId] <= 0 && growing === 0) {
                state.inventory[cropId] = 1;
            }
        });
    }
}

// --- Initialization ---
async function init() {
    if (!checkAuth()) return; 

    try {
        const resCrops = await fetch('data/crops.json'); 
        const resArtisan = await fetch('data/artisan.json');
        const resMachines = await fetch('data/machines.json');
        const resWeather = await fetch('data/weather.json');
        
        crops = await resCrops.json();
        artisanData = await resArtisan.json();
        machinesData = await resMachines.json();
        weatherData = await resWeather.json();
        
        Object.keys(artisanData).forEach(id => {
            if (state.inventory[id] === undefined) state.inventory[id] = 0;
        });

        generateUI(); 
        loadGame();
        updateMuteButton();
        updateUI();
        updateShedUI();
        renderFarm();
        renderShedFloor();
        updateWeatherUI();
        startGameLoop();
    } catch (error) {
        console.error("Failed to load data:", error);
        showMessage("Error loading game data!");
    }
}

function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return; 
    msgBox.innerText = msg;
    msgBox.style.opacity = 1;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => msgBox.style.opacity = 0, 3000);
}

function switchTab(tab) {
    const farmView = document.getElementById('farm-view');
    const shedView = document.getElementById('shed-view');
    const invView = document.getElementById('inventory-view');
    
    const tabFarmBtn = document.getElementById('tab-farm');
    const tabShedBtn = document.getElementById('tab-shed');
    const tabInvBtn = document.getElementById('tab-inventory');

    farmView.style.display = 'none';
    shedView.style.display = 'none';
    if (invView) invView.style.display = 'none';
    
    tabFarmBtn.style.backgroundColor = '#7f8c8d'; 
    tabShedBtn.style.backgroundColor = '#7f8c8d'; 
    if (tabInvBtn) tabInvBtn.style.backgroundColor = '#7f8c8d';

    if (tab === 'farm') {
        farmView.style.display = 'block';
        tabFarmBtn.style.backgroundColor = '#f39c12'; 
        updateUI();
        renderFarm();
    } else if (tab === 'shed') {
        shedView.style.display = 'block';
        tabShedBtn.style.backgroundColor = '#8e44ad'; 
        updateShedUI();
        renderShedFloor();
    } else if (tab === 'inventory') {
        if (invView) invView.style.display = 'block';
        if (tabInvBtn) tabInvBtn.style.backgroundColor = '#2980b9'; 
        renderInventory();
    }
}

function generateUI() {
    const statsContainer = document.getElementById('stats-container');
    const sellContainer = document.getElementById('sell-buttons-container');
    const seedSelector = document.getElementById('seed-selector-container');
    const unlockContainer = document.getElementById('unlock-buttons-container');

    const shedStatsContainer = document.getElementById('shed-stats-container');
    const shedSellContainer = document.getElementById('shed-sell-buttons-container');
    const shedStoreContainer = document.getElementById('shed-store-container');
    const artisanSelector = document.getElementById('artisan-selector-container');

    sellContainer.className = 'sell-grid';
    shedSellContainer.className = 'sell-grid';
    seedSelector.className = 'flex-wrap-container';
    unlockContainer.className = 'flex-wrap-container';

    statsContainer.innerHTML = `<div>💵 Money: $<span id="money" style="color: #2ecc71; font-weight: bold;">0</span></div>`;
    shedStatsContainer.innerHTML = `<div>💵 Money: $<span id="shed-money" style="color: #2ecc71; font-weight: bold;">0</span></div>`;
    sellContainer.innerHTML = '';
    shedSellContainer.innerHTML = '';
    seedSelector.innerHTML = '';
    unlockContainer.innerHTML = '';
    shedStoreContainer.innerHTML = '';
    if (artisanSelector) artisanSelector.innerHTML = '';

    Object.keys(crops).forEach((cropId) => {
        const crop = crops[cropId];
        
        statsContainer.innerHTML += `<div>${crop.icon} ${crop.name}: <span id="${cropId}Count">0</span></div>`;
        sellContainer.innerHTML += `
            <div class="sell-item" id="${cropId}SellDiv">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${crop.icon} ${crop.name}</div>
                <button id="sell${cropId}Btn" onclick="sell('${cropId}', 1)">Sell 1 ($${crop.sellPrice})</button>
                <button id="sellAll${cropId}Btn" onclick="sellAll('${cropId}')" style="background-color: #e67e22;">Sell All</button>
            </div>
        `;
        
        seedSelector.innerHTML += `
            <label id="${cropId}RadioLabel" style="display:none; cursor: pointer;">
                <input type="radio" name="seed" value="${cropId}"> ${crop.icon} ${crop.name}
            </label>
        `;
        if (crop.unlockPrice > 0) {
            unlockContainer.innerHTML += `
                <button id="buy${cropId}Btn" onclick="unlockCrop('${cropId}')" style="background-color: ${crop.growingColor}; color: #2c3e50;">
                    🔓 Unlock ${crop.name} ($${crop.unlockPrice})
                </button>
            `;
        }
        shedStatsContainer.innerHTML += `<div>${crop.icon} ${crop.name}: <span id="shed-${cropId}Count">0</span></div>`;
    });

    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        shedStatsContainer.innerHTML += `<div>${item.icon} ${item.name}: <span id="shed-${id}Count">0</span></div>`;
        
        shedSellContainer.innerHTML += `
            <div class="sell-item" id="${id}SellDiv">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">${item.icon} ${item.name}</div>
                <button id="sell${id}Btn" onclick="sellArtisan('${id}')">Sell 1 ($${item.sellPrice})</button>
                <button id="sellAll${id}Btn" onclick="sellAllArtisan('${id}')" style="background-color: #e67e22;">Sell All</button>
            </div>
        `;

        if (artisanSelector) {
            artisanSelector.innerHTML += `
                <label style="cursor: pointer; padding: 5px 10px; border-radius: 4px; display: inline-block;">
                    <input type="radio" name="artisan-recipe" value="${id}" onchange="updateRecipeInfo()">
                    ${item.icon} ${item.name}
                </label>
            `;
        }
    });

    const wheatRadio = document.querySelector('input[value="wheat"]');
    if (wheatRadio) wheatRadio.checked = true;
    
    const beerRadio = document.querySelector('input[value="beer"]');
    if (beerRadio) beerRadio.checked = true;

    updateRecipeInfo();
}

// --- Inputs & UI Helpers ---
window.updateRecipeInfo = function() {
    const recipeId = getSelectedArtisan();
    if (!recipeId) return;
    
    const recipe = artisanData[recipeId];
    const infoSpan = document.getElementById('selected-recipe-info');
    
    if (infoSpan) {
        infoSpan.innerText = `(Needs ${recipe.inputAmount} ${crops[recipe.input].name})`;
    }
}

function updateUI() {
    const moneyDisplay = document.getElementById('money');
    if(moneyDisplay) moneyDisplay.innerText = state.money;
    
    const buyLotBtn = document.querySelector('button[onclick="buyLot()"]');
    if (buyLotBtn) buyLotBtn.innerText = `Buy Empty Lot ($${state.lotPrice})`;

    Object.keys(crops).forEach(cropId => {
        const countSpan = document.getElementById(`${cropId}Count`);
        if (countSpan) countSpan.innerText = state.inventory[cropId] || 0;

        const radioLabel = document.getElementById(`${cropId}RadioLabel`);
        const unlockBtn = document.getElementById(`buy${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (radioLabel) radioLabel.style.display = 'inline';
            if (unlockBtn) unlockBtn.style.display = 'none';
        } else {
            if (radioLabel) radioLabel.style.display = 'none';
            if (unlockBtn) unlockBtn.style.display = 'inline-block';
        }

        const isLow = (state.inventory[cropId] <= 1);
        const sellBtn = document.getElementById(`sell${cropId}Btn`);
        const sellAllBtn = document.getElementById(`sellAll${cropId}Btn`);
        
        if (state.unlockedCrops[cropId]) {
            if (sellBtn) sellBtn.disabled = isLow;
            if (sellAllBtn) sellAllBtn.disabled = isLow;
        } else {
            if (sellBtn) sellBtn.disabled = true;
            if (sellAllBtn) sellAllBtn.disabled = true;
        }
    });

    if (state.scytheUnlocked) {
        document.getElementById('buyScytheBtn').style.display = 'none';
        document.getElementById('harvestAllBtn').style.display = 'inline-block';
    } else {
        document.getElementById('buyScytheBtn').style.display = 'inline-block';
        document.getElementById('harvestAllBtn').style.display = 'none';
    }

    if (state.planterUnlocked) {
        document.getElementById('buyPlanterBtn').style.display = 'none';
        document.getElementById('plantAllBtn').style.display = 'inline-block';
    } else {
        document.getElementById('buyPlanterBtn').style.display = 'inline-block';
        document.getElementById('plantAllBtn').style.display = 'none';
    }

    const invView = document.getElementById('inventory-view');
    if (invView && invView.style.display === 'block') {
        renderInventory();
    }
}

function updateShedUI() {
    if (!state.shedUnlocked) return;
    document.getElementById('shed-locked').style.display = 'none';
    document.getElementById('shed-unlocked').style.display = 'block';

    const shedMoney = document.getElementById('shed-money');
    if (shedMoney) shedMoney.innerText = state.money;

    Object.keys(crops).forEach(cropId => {
        const countSpan = document.getElementById(`shed-${cropId}Count`);
        if (countSpan) countSpan.innerText = state.inventory[cropId] || 0;
    });

    Object.keys(artisanData).forEach(id => {
        const countSpan = document.getElementById(`shed-${id}Count`);
        if (countSpan) countSpan.innerText = state.inventory[id] || 0;

        const isLow = (state.inventory[id] <= 0); 
        const sellBtn = document.getElementById(`sell${id}Btn`);
        const sellAllBtn = document.getElementById(`sellAll${id}Btn`);
        
        if (sellBtn) sellBtn.disabled = isLow;
        if (sellAllBtn) sellAllBtn.disabled = isLow;
    });

    const storeDiv = document.getElementById('shed-store-container');
    if (storeDiv) {
        storeDiv.innerHTML = '';
        Object.keys(machinesData).forEach(id => {
            const m = machinesData[id];
            const currentPrice = state.machinePrices[id];
            storeDiv.innerHTML += `
                <button onclick="buyMachine('${id}')" style="background-color: #9b59b6; color: white;">
                    Buy ${m.icon} ${m.name} ($${currentPrice})
                </button>
            `;
        });
    }
}

// --- Renderers ---
function renderFarm() {
    if(document.getElementById('farm-view').style.display === 'none') return;
    const farmDiv = document.getElementById('farm');
    
    if (farmDiv.children.length !== state.lots.length) {
        farmDiv.innerHTML = ''; 
        state.lots.forEach((lot, index) => {
            const tile = document.createElement('div');
            tile.id = `lot-${index}`;
            tile.onclick = () => handleLotClick(index);
            farmDiv.appendChild(tile);
        });
    }

    const now = Date.now();

    state.lots.forEach((lot, index) => {
        const tile = document.getElementById(`lot-${index}`);
        if (!tile) return;
        
        if (lot === null) {
            tile.className = 'lot empty';
            tile.innerHTML = 'Empty<br><span style="font-size:0.8em">(Click to Plant)</span>';
            tile.style.background = ''; 
            tile.style.borderColor = '';
        } else {
            const totalGrowTime = crops[lot.type].growTime * 1000;
            const timeRemaining = lot.finishTime - now;
            const timeElapsed = totalGrowTime - timeRemaining;
            
            let percentage = (timeElapsed / totalGrowTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            const timeString = formatTime(secondsLeft);
            
            if (secondsLeft > 0) {
                tile.className = 'lot';
                const readyCol = crops[lot.type].readyColor;
                
                tile.style.background = `linear-gradient(to top, ${readyCol} ${percentage}%, #34495e ${percentage}%)`;
                tile.style.borderColor = readyCol;
                
                tile.innerHTML = `
                    <div style="font-size: 1.2rem; margin-bottom: 5px;">${crops[lot.type].icon}</div>
                    <div style="font-size: 0.9rem; font-weight: bold;">${crops[lot.type].name}</div>
                    <div style="font-size: 0.8em; margin-top: 5px; color: white;">⏳ ${timeString}</div>
                `;
            } else {
                tile.className = 'lot';
                tile.style.background = '#27ae60'; 
                tile.style.borderColor = '#2ecc71';
                tile.innerHTML = `
                    <div style="font-size: 1.5rem; margin-bottom: 5px;">${crops[lot.type].icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${crops[lot.type].name}</div>
                    <div style="font-size: 0.9rem; font-weight: bold; margin-top: 2px;">✔️ Ready!</div>
                `;
            }
        }
    });
}

function renderShedFloor() {
    if(document.getElementById('shed-view').style.display === 'none') return;
    const floor = document.getElementById('shed-floor');
    if(!floor) return;

    if (state.machines.length === 0) {
        floor.innerHTML = '<p style="color: #bdc3c7;">Your shed is empty! Buy a machine from the store above.</p>';
        return;
    }

    if (floor.children.length !== state.machines.length || floor.children[0].tagName === 'P') {
        floor.innerHTML = '';
        state.machines.forEach((_, index) => {
            const card = document.createElement('div');
            card.id = `machine-${index}`;
            floor.appendChild(card);
        });
    }

    const now = Date.now();

    state.machines.forEach((machine, index) => {
        const card = document.getElementById(`machine-${index}`);
        if (!card) return;

        const mData = machinesData[machine.type];

        if (!machine.isProcessing && !machine.isReady) {
            card.className = 'lot machine-empty'; 
            card.style.background = '#34495e';
            card.style.borderColor = '#7f8c8d';
            card.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 5px;">${mData.icon}</div>
                <div style="font-weight: bold; font-size: 1rem;">${mData.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: #bdc3c7;">Click to Load</div>
            `;
            card.onclick = () => loadMachine(index);

        } else if (machine.isProcessing && !machine.isReady) {
            const recipe = artisanData[machine.recipe];
            const cropSource = crops[recipe.input];

            const totalProcessTime = recipe.processTime * 1000;
            const timeRemaining = machine.finishTime - now;
            const timeElapsed = totalProcessTime - timeRemaining;

            let percentage = (timeElapsed / totalProcessTime) * 100;
            if (percentage > 100) percentage = 100;
            if (percentage < 0) percentage = 0;

            const secondsLeft = Math.ceil(timeRemaining / 1000);
            const timeString = formatTime(secondsLeft);

            card.className = 'lot working-machine'; 
            card.style.background = `linear-gradient(to top, ${cropSource.readyColor} ${percentage}%, #34495e ${percentage}%)`;
            card.style.borderColor = cropSource.readyColor;

            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${recipe.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">${recipe.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px; color: white;">⏳ ${timeString}</div>
            `;
            card.onclick = null; 

        } else if (machine.isReady) {
            const recipe = artisanData[machine.recipe];
            card.className = 'lot ready-machine'; 
            card.style.background = '#27ae60';
            card.style.borderColor = '#2ecc71';
            card.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${recipe.icon}</div>
                <div style="font-weight: bold; font-size: 0.9rem;">${recipe.name}</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">✔️ Ready!</div>
            `;
            card.onclick = () => collectMachine(index);
        }
    });
}

function renderInventory() {
    const rawContainer = document.getElementById('inventory-raw');
    const artisanContainer = document.getElementById('inventory-artisan');
    if (!rawContainer || !artisanContainer) return;

    rawContainer.innerHTML = '';
    artisanContainer.innerHTML = '';

    Object.keys(crops).forEach(id => {
        const item = crops[id];
        const count = state.inventory[id] || 0;
        
        if (state.unlockedCrops[id] || count > 0) {
            rawContainer.innerHTML += `
                <div style="background: #34495e; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid ${item.growingColor}; min-width: 110px;">
                    <div style="font-size: 2.5rem; margin-bottom: 5px;">${item.icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${item.name}</div>
                    <div style="font-size: 1.3rem; color: #f1c40f; margin-top: 5px; font-weight: bold;">${count}</div>
                </div>
            `;
        }
    });

    let hasArtisan = false;
    Object.keys(artisanData).forEach(id => {
        const item = artisanData[id];
        const count = state.inventory[id] || 0;
        
        if (state.shedUnlocked || count > 0) {
            hasArtisan = true;
            artisanContainer.innerHTML += `
                <div style="background: #34495e; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #9b59b6; min-width: 110px;">
                    <div style="font-size: 2.5rem; margin-bottom: 5px;">${item.icon}</div>
                    <div style="font-weight: bold; font-size: 1rem;">${item.name}</div>
                    <div style="font-size: 1.3rem; color: #f1c40f; margin-top: 5px; font-weight: bold;">${count}</div>
                </div>
            `;
        }
    });

    if (!hasArtisan) {
        artisanContainer.innerHTML = '<p style="color: #bdc3c7; font-style: italic;">Unlock the Shed to discover Artisan Goods!</p>';
    }
}

// --- Inputs ---
function getSelectedSeed() {
    const checked = document.querySelector('input[name="seed"]:checked');
    return checked ? checked.value : 'wheat'; 
}

function getSelectedArtisan() {
    const checked = document.querySelector('input[name="artisan-recipe"]:checked');
    return checked ? checked.value : 'beer';
}

// --- Farm Actions ---
function handleLotClick(index) {
    const lot = state.lots[index];
    const now = Date.now();
    if (lot === null) plantCrop(index);
    else if (lot !== null && lot.finishTime <= now) harvestCrop(index);
}

function plantCrop(lotIndex) {
    const seed = getSelectedSeed();
    if (state.inventory[seed] >= 1) {
        state.inventory[seed] -= 1;

        const weatherObj = weatherData.types[state.currentWeather];
        const modifiedGrowTime = crops[seed].growTime / weatherObj.growSpeed;

        state.lots[lotIndex] = { type: seed, finishTime: Date.now() + (modifiedGrowTime * 1000), isReady: false };
        playSound('plant');
        updateUI();
        updateShedUI();
        renderFarm();
    } else {
        showMessage(`You don't have enough ${crops[seed].name} seeds!`);
    }
}

function harvestCrop(lotIndex) {
    const cropType = state.lots[lotIndex].type;
    const weatherObj = weatherData.types[state.currentWeather];
    const totalYield = crops[cropType].yield + weatherObj.yieldBonus;

    state.inventory[cropType] += totalYield;
    state.stats.totalHarvested += totalYield;
    state.lots[lotIndex] = null;
    playSound('harvest');
    updateUI();
    updateShedUI();
    renderFarm();
}

function harvestAll() {
    if (!state.scytheUnlocked) return;
    const now = Date.now();
    let harvestedAnything = false;
    const weatherObj = weatherData.types[state.currentWeather];

    state.lots.forEach((lot, index) => {
        if (lot !== null && lot.finishTime <= now) {
            const totalYield = crops[lot.type].yield + weatherObj.yieldBonus;
            state.inventory[lot.type] += totalYield;
            state.stats.totalHarvested += totalYield;
            state.lots[index] = null; 
            harvestedAnything = true;
        }
    });
    if (harvestedAnything) {
        playSound('harvest');
        showMessage("Harvested all ready crops!");
        updateUI();
        updateShedUI();
        renderFarm();
    }
}

function plantAll() {
    if (!state.planterUnlocked) return;
    const seed = getSelectedSeed();
    let plantedAnything = false;
    const weatherObj = weatherData.types[state.currentWeather];
    const modifiedGrowTime = crops[seed].growTime / weatherObj.growSpeed;

    for (let i = 0; i < state.lots.length; i++) {
        if (state.lots[i] === null && state.inventory[seed] >= 1) {
            state.inventory[seed] -= 1;
            state.lots[i] = { type: seed, finishTime: Date.now() + (modifiedGrowTime * 1000), isReady: false };
            plantedAnything = true;
        }
    }
    if (plantedAnything) {
        playSound('plant');
        showMessage(`Planted as much ${crops[seed].name} as possible!`);
        updateUI();
        updateShedUI();
        renderFarm();
    }
}

function sell(cropType, amount = 1) {
    if (state.inventory[cropType] - amount >= 1) { 
        state.inventory[cropType] -= amount;
        const earned = (crops[cropType].sellPrice * amount);
        state.money += earned;
        state.stats.totalEarned += earned;
        playSound('money');
        updateUI();
        updateShedUI();
    } else {
        showMessage(`You must keep at least 1 ${crops[cropType].name} seed!`);
    }
}

function sellAll(cropType) {
    if (state.inventory[cropType] > 1) {
        const amountToSell = state.inventory[cropType] - 1;
        state.inventory[cropType] -= amountToSell;
        const earned = (crops[cropType].sellPrice * amountToSell);
        state.money += earned;
        state.stats.totalEarned += earned;
        playSound('money');
        updateUI();
        updateShedUI();
    }
}

function buyLot() {
    if (state.money >= state.lotPrice) {
        state.money -= state.lotPrice;
        state.stats.totalSpent += state.lotPrice;
        state.lots.push(null);
        state.lotPrice = Math.floor(state.lotPrice * 1.2);
        playSound('money');
        updateUI();
        updateShedUI();
        renderFarm();
    } else {
        showMessage("Not enough money!");
    }
}

function unlockCrop(cropId) {
    const crop = crops[cropId];
    if (state.money >= crop.unlockPrice && !state.unlockedCrops[cropId]) {
        state.money -= crop.unlockPrice;
        state.stats.totalSpent += crop.unlockPrice;
        state.unlockedCrops[cropId] = true;
        state.inventory[cropId] += 1; 
        playSound('money');
        showMessage(`${crop.name} unlocked! Received 1 starter seed.`);
        updateUI();
        updateShedUI();
    } else if (state.unlockedCrops[cropId]) {
        showMessage(`You already unlocked ${crop.name}!`);
    } else {
        showMessage(`Not enough money! You need $${crop.unlockPrice}.`);
    }
}

function buyScythe() {
    if (state.money >= 500 && !state.scytheUnlocked) {
        state.money -= 500;
        state.stats.totalSpent += 500;
        state.scytheUnlocked = true;
        showMessage("Scythe unlocked!");
        updateUI();
    }
}

function buyPlanter() {
    if (state.money >= 1000 && !state.planterUnlocked) {
        state.money -= 1000;
        state.stats.totalSpent += 1000;
        state.planterUnlocked = true;
        showMessage("Planting Machine unlocked!");
        updateUI();
    }
}

// --- Shed Actions ---
window.unlockShed = function() {
    if (state.money >= 50000) {
        state.money -= 50000;
        state.stats.totalSpent += 50000;
        state.shedUnlocked = true;
        saveGame();
        updateUI();
        updateShedUI();
    } else {
        showMessage("Not enough money! You need $50,000.");
    }
}

window.buyMachine = function(machineId) {
    const mData = machinesData[machineId];
    const currentPrice = state.machinePrices[machineId];

    if (state.money >= currentPrice) {
        state.money -= currentPrice;
        state.stats.totalSpent += currentPrice;
        
        state.machines.push({
            type: machineId,
            isProcessing: false,
            isReady: false,
            finishTime: 0,
            recipe: null
        });

        state.machinePrices[machineId] = Math.floor(currentPrice * 1.2);
        
        state.machines.sort((a, b) => {
            if (a.type === 'keg' && b.type !== 'keg') return -1;
            if (a.type !== 'keg' && b.type === 'keg') return 1;
            return a.type.localeCompare(b.type);
        });
        
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage(`Not enough money! You need $${currentPrice}.`);
    }
}

window.loadMachine = function(index) {
    const machine = state.machines[index];
    const recipeId = getSelectedArtisan();
    const recipe = artisanData[recipeId];

    if (machine.type !== recipe.machine) {
        showMessage(`You can't make ${recipe.name} in a ${machinesData[machine.type].name}!`);
        return;
    }

    if (state.inventory[recipe.input] >= recipe.inputAmount) {
        state.inventory[recipe.input] -= recipe.inputAmount;
        machine.recipe = recipeId;
        machine.isProcessing = true;
        machine.finishTime = Date.now() + (recipe.processTime * 1000);
        
        saveGame();
        updateUI(); 
        updateShedUI(); 
        renderShedFloor();
    } else {
        showMessage(`You need ${recipe.inputAmount} ${crops[recipe.input].name} to start this!`);
    }
}

window.collectMachine = function(index) {
    const machine = state.machines[index];
    const recipe = artisanData[machine.recipe];

    state.inventory[recipe.id] += 1;
    
    machine.isProcessing = false;
    machine.isReady = false;
    machine.finishTime = 0;
    machine.recipe = null;

    playSound('harvest');
    saveGame();
    updateUI();
    updateShedUI();
    renderShedFloor();
}

window.loadAllMachines = function() {
    const recipeId = getSelectedArtisan();
    const recipe = artisanData[recipeId];
    let loadedAnything = false;

    state.machines.forEach((machine) => {
        if (!machine.isProcessing && !machine.isReady && machine.type === recipe.machine) {
            if (state.inventory[recipe.input] >= recipe.inputAmount) {
                state.inventory[recipe.input] -= recipe.inputAmount;
                machine.recipe = recipeId;
                machine.isProcessing = true;
                machine.finishTime = Date.now() + (recipe.processTime * 1000);
                loadedAnything = true;
            }
        }
    });

    if (loadedAnything) {
        playSound('plant');
        showMessage(`Started making ${recipe.name}!`);
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage(`No empty ${machinesData[recipe.machine].name}s or not enough ${crops[recipe.input].name}!`);
    }
}

window.collectAllMachines = function() {
    let collectedAnything = false;
    state.machines.forEach((machine) => {
        if (machine.isReady) {
            const recipe = artisanData[machine.recipe];
            state.inventory[recipe.id] += 1;
            machine.isProcessing = false;
            machine.isReady = false;
            machine.finishTime = 0;
            machine.recipe = null;
            collectedAnything = true;
        }
    });

    if (collectedAnything) {
        playSound('harvest');
        showMessage("Collected all ready artisan goods!");
        saveGame();
        updateUI();
        updateShedUI();
        renderShedFloor();
    } else {
        showMessage("No machines are ready yet!");
    }
}

window.sellArtisan = function(itemId) {
    if (state.inventory[itemId] >= 1) {
        state.inventory[itemId] -= 1;
        const earned = artisanData[itemId].sellPrice;
        state.money += earned;
        if(state.stats) state.stats.totalEarned += earned;
        
        playSound('money');
        saveGame();
        updateUI(); 
        updateShedUI(); 
    } else {
        showMessage("You don't have any to sell!");
    }
}

window.sellAllArtisan = function(itemId) {
    if (state.inventory[itemId] >= 1) {
        const amountToSell = state.inventory[itemId]; 
        state.inventory[itemId] -= amountToSell;
        
        const earned = artisanData[itemId].sellPrice * amountToSell;
        state.money += earned;
        if(state.stats) state.stats.totalEarned += earned;
        
        playSound('money');
        saveGame();
        updateUI(); 
        updateShedUI(); 
    } else {
        showMessage("You don't have any to sell!");
    }
}

// --- Mailbox Receiver ---
window.receiveMailMoney = function(amount) {
    state.money += amount;
    if (state.stats) state.stats.totalEarned += amount;
    playSound('money');
    updateUI();
    updateShedUI();
    saveGame();
    showMessage(`Claimed $${amount} from the market!`);
};

function toggleMute() {
    state.muted = !state.muted; 
    updateMuteButton();
    saveGame(); 
}

function updateMuteButton() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;
    if (state.muted) {
        btn.innerText = "🔇 Unmute";
        btn.style.backgroundColor = "#95a5a6"; 
    } else {
        btn.innerText = "🔊 Mute";
        btn.style.backgroundColor = "#3498db"; 
    }
}

// --- Master Game Loop ---
function startGameLoop() {
    setInterval(() => {
        const now = Date.now();
        
        // Handle Calendar / Weather engine
        if (now - state.lastDayTick >= 60000) {
            advanceDay();
        }

        let needsFarmRender = false;
        let needsShedRender = false;
        
        // Tick Farm
        state.lots.forEach(lot => {
            if (lot !== null) {
                const secondsLeft = Math.ceil((lot.finishTime - now) / 1000);
                if (secondsLeft > 0) needsFarmRender = true;
                else if (!lot.isReady) {
                    lot.isReady = true; 
                    needsFarmRender = true; 
                }
            }
        });

        // Tick Shed
        if (state.shedUnlocked && state.machines.length > 0) {
            state.machines.forEach(machine => {
                if (machine.isProcessing && !machine.isReady) {
                    if (now >= machine.finishTime) {
                        machine.isReady = true;
                        needsShedRender = true;
                    } else {
                        needsShedRender = true; 
                    }
                }
            });
        }
        
        saveGame();
        if (needsFarmRender) renderFarm();
        if (needsShedRender) renderShedFloor();
        
    }, 1000);
}

init();