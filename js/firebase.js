import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWe1PYZhgENG-PLp61d6lj2sMgySoS2xo",
  authDomain: "tradexvault.firebaseapp.com",
  projectId: "tradexvault",
  storageBucket: "tradexvault.firebasestorage.app",
  messagingSenderId: "307750572244",
  appId: "1:307750572244:web:dff032c8afd5e84b9e6b41"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);