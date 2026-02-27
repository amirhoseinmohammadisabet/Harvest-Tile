import { db } from './firebase-init.js';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;
let state = null;
let saveKey = '';
let crops = {};
let messageTimeout;

// --- Initialize Dukun ---
async function init() {
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = JSON.parse(storedUser);
    saveKey = `tileFarmSave_${currentUser.email}`;
    
    // Load local save state to know their money and inventory
    const savedState = localStorage.getItem(saveKey);
    if (savedState) {
        state = JSON.parse(savedState);
        document.getElementById('player-money').innerText = state.money;
    }

    // Load crops data for names and icons
    try {
        const response = await fetch('data/crops.json');
        crops = await response.json();
        populateDropdown();
    } catch (error) {
        console.error("Failed to load crops:", error);
    }

    // Start listening to the live database!
    listenToMarket();

    // Attach event listener to the Post button
    document.getElementById('post-listing-btn').addEventListener('click', postListing);
}

// --- UI Helpers ---
function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    msgBox.innerText = msg;
    msgBox.style.opacity = 1;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => msgBox.style.opacity = 0, 3000);
}

function saveLocalState() {
    localStorage.setItem(saveKey, JSON.stringify(state));
    document.getElementById('player-money').innerText = state.money;
}

function populateDropdown() {
    const select = document.getElementById('sell-crop-select');
    Object.keys(crops).forEach(cropId => {
        // Only show crops the player has in their inventory to sell
        if (state.inventory[cropId] > 0) {
            const option = document.createElement('option');
            option.value = cropId;
            option.text = `${crops[cropId].icon} ${crops[cropId].name} (You have: ${state.inventory[cropId]})`;
            select.appendChild(option);
        }
    });
}

// --- Market Core Functions ---

// 1. Post a new listing
async function postListing() {
    const cropId = document.getElementById('sell-crop-select').value;
    const amount = parseInt(document.getElementById('sell-amount').value);
    const pricePerItem = parseInt(document.getElementById('sell-price').value);

    if (!cropId || isNaN(amount) || isNaN(pricePerItem) || amount <= 0 || pricePerItem <= 0) {
        showMessage("Please enter valid amounts.");
        return;
    }

    // Security Check: Do they have enough crop? (Remember to leave 1 seed)
    if (state.inventory[cropId] - amount < 1) {
        showMessage(`You don't have enough ${crops[cropId].name}! You must keep at least 1 seed.`);
        return;
    }

    try {
        // 1. Deduct from local inventory and save
        state.inventory[cropId] -= amount;
        saveLocalState();
        populateDropdown(); // Refresh dropdown numbers

        // 2. Add to Firebase Database
        await addDoc(collection(db, "market_listings"), {
            sellerEmail: currentUser.email,
            sellerName: currentUser.name,
            cropId: cropId,
            amount: amount,
            pricePerItem: pricePerItem,
            timestamp: serverTimestamp()
        });

        showMessage("Listing posted successfully!");
    } catch (e) {
        console.error("Error posting listing: ", e);
        showMessage("Database error. Try again.");
    }
}

// 2. Listen to the database live (Real-time sync)
function listenToMarket() {
    const marketRef = collection(db, "market_listings");
    
    // onSnapshot listens for changes continuously without refreshing
    onSnapshot(marketRef, (snapshot) => {
        const container = document.getElementById('market-container');
        container.innerHTML = ''; // Clear current listings
        
        if (snapshot.empty) {
            container.innerHTML = '<p>The market is completely empty! Be the first to sell something.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const listing = docSnap.data();
            const docId = docSnap.id;
            const crop = crops[listing.cropId];
            
            // Don't render if crop data is missing
            if(!crop) return;

            const isMyListing = listing.sellerEmail === currentUser.email;
            
            const card = document.createElement('div');
            card.className = 'market-card';
            card.innerHTML = `
                <h3>${crop.icon} ${crop.name}</h3>
                <p><strong>Seller:</strong> ${listing.sellerName} ${isMyListing ? '(You)' : ''}</p>
                <p><strong>Amount Available:</strong> <span class="badge">${listing.amount}</span></p>
                <p><strong>Price:</strong> $${listing.pricePerItem} each</p>
                <hr style="border: 1px solid #2c3e50; margin: 10px 0;">
            `;

            // If it's your own listing, show a cancel button. If it's someone else's, show Buy.
            if (isMyListing) {
                const cancelBtn = document.createElement('button');
                cancelBtn.innerText = "❌ Cancel Listing";
                cancelBtn.style.backgroundColor = "#e74c3c";
                cancelBtn.onclick = () => cancelListing(docId, listing.cropId, listing.amount);
                card.appendChild(cancelBtn);
            } else {
                const buyBtn = document.createElement('button');
                buyBtn.innerText = "🛒 Buy Crops";
                buyBtn.style.backgroundColor = "#3498db";
                buyBtn.onclick = () => buyListing(docId, listing);
                card.appendChild(buyBtn);
            }

            container.appendChild(card);
        });
    });
}

// 3. Buy a listing (Partial or Full)
window.buyListing = async function(docId, listing) {
    const amountToBuy = parseInt(prompt(`How many ${crops[listing.cropId].name} do you want to buy? (Max: ${listing.amount})`, listing.amount));
    
    if (isNaN(amountToBuy) || amountToBuy <= 0) return;
    if (amountToBuy > listing.amount) {
        showMessage("You can't buy more than what is available!");
        return;
    }

    const totalCost = amountToBuy * listing.pricePerItem;

    if (state.money < totalCost) {
        showMessage(`Not enough money! You need $${totalCost}.`);
        return;
    }

    try {
        // 1. Deduct money and add crop locally
        state.money -= totalCost;
        
        // Ensure the crop slot exists in inventory just in case
        if (state.inventory[listing.cropId] === undefined) state.inventory[listing.cropId] = 0;
        state.inventory[listing.cropId] += amountToBuy;
        
        // Track the money spent for stats!
        if(state.stats) state.stats.totalSpent += totalCost;
        
        saveLocalState();
        populateDropdown();

        const docRef = doc(db, "market_listings", docId);

        // 2. Update or Delete in Firebase
        if (amountToBuy === listing.amount) {
            // Bought everything, remove listing
            await deleteDoc(docRef);
        } else {
            // Bought partial, reduce the amount in database
            await updateDoc(docRef, {
                amount: listing.amount - amountToBuy
            });
        }
        
        // Note: For a fully functioning economy, we'd also need a way to give the seller their money!
        // We will add an "inbox" system for that next.

        showMessage(`Successfully bought ${amountToBuy} ${crops[listing.cropId].name} for $${totalCost}!`);
    } catch (e) {
        console.error("Error buying: ", e);
        showMessage("Transaction failed.");
    }
}

// 4. Cancel a listing and get items back
window.cancelListing = async function(docId, cropId, amount) {
    if(confirm("Are you sure you want to cancel this listing and take the crops back?")) {
        try {
            state.inventory[cropId] += amount;
            saveLocalState();
            populateDropdown();
            
            await deleteDoc(doc(db, "market_listings", docId));
            showMessage("Listing cancelled. Crops returned to inventory.");
        } catch (e) {
            console.error("Error cancelling: ", e);
            showMessage("Failed to cancel listing.");
        }
    }
}

init();