// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDB_kvivApMNSEDg5s639x9dbB79KKpB-M",
  authDomain: "harvest-tile.firebaseapp.com",
  projectId: "harvest-tile",
  storageBucket: "harvest-tile.firebasestorage.app",
  messagingSenderId: "812029487877",
  appId: "1:812029487877:web:71428a7b37afcdd62fa56c",
  measurementId: "G-3DXL9NTLLM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

console.log("Firebase Database Connected Successfully!");