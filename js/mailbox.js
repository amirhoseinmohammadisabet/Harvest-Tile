import { db } from './firebase-init.js';
import { collection, onSnapshot, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;
let mailList = [];

function initMailbox() {
    const storedUser = localStorage.getItem('farmCurrentUser');
    if (!storedUser) return;
    currentUser = JSON.parse(storedUser);

    // Listen to the mailbox collection for mail addressed to YOU
    const mailRef = collection(db, "mailbox");
    const q = query(mailRef, where("recipientEmail", "==", currentUser.email));

    onSnapshot(q, (snapshot) => {
        mailList = [];
        snapshot.forEach(docSnap => {
            mailList.push({ id: docSnap.id, ...docSnap.data() });
        });
        updateMailboxUI();
    });
}

function updateMailboxUI() {
    const btn = document.getElementById('mailboxBtn');
    if (!btn) return;

    btn.innerText = `📮 Mailbox (${mailList.length})`;
    
    // Animate the button if there is unread mail!
    if (mailList.length > 0) {
        btn.style.backgroundColor = "#e74c3c"; // Red alert
        btn.style.animation = "pulse 1s infinite";
    } else {
        btn.style.backgroundColor = "#3498db"; // Normal blue
        btn.style.animation = "none";
    }

    const container = document.getElementById('mail-container');
    if (!container) return;

    container.innerHTML = '';
    if (mailList.length === 0) {
        container.innerHTML = '<p>No new mail!</p>';
        return;
    }

    // Draw the envelopes
    mailList.forEach(mail => {
        const div = document.createElement('div');
        div.style.backgroundColor = "#2c3e50";
        div.style.padding = "10px";
        div.style.marginBottom = "10px";
        div.style.borderRadius = "4px";
        div.style.borderLeft = "4px solid #f1c40f";
        
        div.innerHTML = `
            <p style="margin: 0 0 5px 0;"><strong>${mail.senderName}</strong> bought ${mail.amountBought} of your crops!</p>
            <p style="margin: 0 0 10px 0; color: #2ecc71;"><strong>+$${mail.moneyEarned}</strong></p>
            <button style="background-color: #2ecc71; color: #2c3e50; padding: 5px 10px; cursor: pointer; border: none; font-weight: bold; border-radius: 4px;" 
                    onclick="claimMail('${mail.id}', ${mail.moneyEarned})">Claim Money</button>
        `;
        container.appendChild(div);
    });
}

// Global functions for the HTML buttons to use
window.openMailbox = function() {
    document.getElementById('mailbox-modal').style.display = 'block';
};

window.closeMailbox = function() {
    document.getElementById('mailbox-modal').style.display = 'none';
};

window.claimMail = async function(mailId, amount) {
    try {
        // Send the money to the main game.js file
        if (window.receiveMailMoney) {
            window.receiveMailMoney(amount);
        }
        // Burn the letter!
        await deleteDoc(doc(db, "mailbox", mailId));
    } catch (e) {
        console.error("Error claiming mail:", e);
        alert("Failed to claim money. Try again.");
    }
};

// Start listening as soon as the file loads
initMailbox();