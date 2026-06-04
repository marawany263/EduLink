// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// كود الـ Config الخاص بمشروعك EduLink
export const firebaseConfig = {
  apiKey: "AIzaSyBLLCqn-2Bn1FSKAK6ur4CkOwJD4esqKzw",
  authDomain: "edulink-1e986.firebaseapp.com",
  projectId: "edulink-1e986",
  storageBucket: "edulink-1e986.firebasestorage.app",
  messagingSenderId: "838623965512",
  appId: "1:838623965512:web:f9fd84b192c928e904837d",
  measurementId: "G-S204EYFE21"
};

// تهيئة الفايربيز للمشروع
const app = initializeApp(firebaseConfig);

// تصدير الأدوات عشان الـ JS التاني يشوفها
export const auth = getAuth(app);
export const db = getFirestore(app);