import { db } from './firebase-init.js';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;
let allItems = {}; // Holds crops, artisan goods, and animal products!
let messageTimeout;

async function init() {
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) return;
    currentUser = JSON.parse(storedUser);

    // Load ALL data so the market knows every single item's name and icon
    try {
        const resCrops = await fetch('data/crops.json');
        const resArtisan = await fetch('data/artisan.json');
        
        const cropsData = await resCrops.json();
        const artisanData = await resArtisan.json();
        
        // Combine them into one master dictionary
        allItems = { ...cropsData, ...artisanData };
    } catch (error) {
        console.error("Failed to load item data for market:", error);
    }

    listenToMarket();
    document.getElementById('post-listing-btn').addEventListener('click', postListing);
}

function showMessage(msg) {
    const msgBox = document.getElementById('message-box');
    if(!msgBox) return;
    msgBox.innerText = msg;
    msgBox.style.opacity = 1;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => msgBox.style.opacity = 0, 3000);
}

// 1. Post a new listing
async function postListing() {
    const itemId = document.getElementById('sell-crop-select').value;
    const amount = parseInt(document.getElementById('sell-amount').value);
    const pricePerItem = parseInt(document.getElementById('sell-price').value);

    if (!itemId || isNaN(amount) || isNaN(pricePerItem) || amount <= 0 || pricePerItem <= 0) {
        showMessage("Please enter valid amounts.");
        return;
    }

    // Security Check via the Main Game Bridge
    if (!window.marketBridge.hasItem(itemId, amount)) {
        showMessage("You don't have enough of that item!");
        return;
    }

    try {
        // Safely deduct from the live game memory
        window.marketBridge.deductItem(itemId, amount);

        await addDoc(collection(db, "market_listings"), {
            sellerEmail: currentUser.email,
            sellerName: currentUser.name,
            cropId: itemId, // Keeping 'cropId' for database compatibility
            amount: amount,
            pricePerItem: pricePerItem,
            timestamp: serverTimestamp()
        });

        showMessage("Listing posted successfully!");
        document.getElementById('sell-amount').value = 1; 
    } catch (e) {
        console.error("Error posting listing: ", e);
        showMessage("Database error. Try again.");
        // Rollback: Give items back if Firebase fails
        window.marketBridge.addItem(itemId, amount); 
    }
}

// 2. Listen to the database live
function listenToMarket() {
    const marketRef = collection(db, "market_listings");
    
    onSnapshot(marketRef, (snapshot) => {
        const container = document.getElementById('market-container');
        if(!container) return;
        container.innerHTML = ''; 
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="color:#bdc3c7;">The market is completely empty! Be the first to sell something.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const listing = docSnap.data();
            const docId = docSnap.id;
            const item = allItems[listing.cropId];
            
            // Skip broken/old listings that don't match your JSON files
            if(!item) return; 

            const isMyListing = listing.sellerEmail === currentUser.email;
            
            const card = document.createElement('div');
            card.className = 'market-card';
            card.innerHTML = `
                <h3>${item.icon} ${item.name}</h3>
                <p><strong>Seller:</strong> ${listing.sellerName} ${isMyListing ? '(You)' : ''}</p>
                <p><strong>Amount Available:</strong> <span class="badge">${listing.amount}</span></p>
                <p><strong>Price:</strong> $${listing.pricePerItem} each</p>
                <hr style="border: 1px solid #2c3e50; margin: 10px 0;">
            `;

            if (isMyListing) {
                const cancelBtn = document.createElement('button');
                cancelBtn.innerText = "❌ Cancel Listing";
                cancelBtn.style.backgroundColor = "#e74c3c";
                cancelBtn.onclick = () => cancelListing(docId, listing.cropId, listing.amount);
                card.appendChild(cancelBtn);
            } else {
                const buyBtn = document.createElement('button');
                buyBtn.innerText = "🛒 Buy Goods";
                buyBtn.style.backgroundColor = "#3498db";
                buyBtn.onclick = () => buyListing(docId, listing, item);
                card.appendChild(buyBtn);
            }

            container.appendChild(card);
        });
    });
}

// 3. Buy a listing
window.buyListing = async function(docId, listing, itemObj) {
    const amountToBuy = parseInt(prompt(`How many ${itemObj.name} do you want to buy? (Max: ${listing.amount})`, listing.amount));
    
    if (isNaN(amountToBuy) || amountToBuy <= 0) return;
    if (amountToBuy > listing.amount) {
        showMessage("You can't buy more than what is available!");
        return;
    }

    const totalCost = amountToBuy * listing.pricePerItem;

    if (!window.marketBridge.hasMoney(totalCost)) {
        showMessage(`Not enough money! You need $${totalCost}.`);
        return;
    }

    try {
        // Live memory logic via Bridge
        window.marketBridge.spendMoney(totalCost);
        window.marketBridge.addItem(listing.cropId, amountToBuy);

        const docRef = doc(db, "market_listings", docId);
        if (amountToBuy === listing.amount) {
            await deleteDoc(docRef);
        } else {
            await updateDoc(docRef, { amount: listing.amount - amountToBuy });
        }
        
        if (listing.sellerEmail !== currentUser.email) {
            await addDoc(collection(db, "mailbox"), {
                recipientEmail: listing.sellerEmail,
                senderName: currentUser.name,
                cropId: listing.cropId,
                amountBought: amountToBuy,
                moneyEarned: totalCost,
                timestamp: serverTimestamp()
            });
        }

        showMessage(`Successfully bought ${amountToBuy} ${itemObj.name} for $${totalCost}!`);
    } catch (e) {
        console.error("Error buying: ", e);
        showMessage("Transaction failed.");
        // Rollback
        window.marketBridge.addMoney(totalCost); 
        window.marketBridge.deductItem(listing.cropId, amountToBuy);
    }
}

// 4. Cancel a listing
window.cancelListing = async function(docId, itemId, amount) {
    if(confirm("Are you sure you want to cancel this listing and take the goods back?")) {
        try {
            window.marketBridge.addItem(itemId, amount);
            await deleteDoc(doc(db, "market_listings", docId));
            showMessage("Listing cancelled. Goods returned to inventory.");
        } catch (e) {
            console.error("Error cancelling: ", e);
            showMessage("Failed to cancel listing.");
            window.marketBridge.deductItem(itemId, amount);
        }
    }
}

init();