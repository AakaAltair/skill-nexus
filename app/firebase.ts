// firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // ✅ Added for authentication

const firebaseConfig = {
  apiKey: "AIzaSyASVgFGzkr43pOfcX7QzHaaHvqPxa85K5s",
  authDomain: "web-apps-d4bee.firebaseapp.com",
  projectId: "web-apps-d4bee",
  storageBucket: "web-apps-d4bee.firebasestorage.app",
  messagingSenderId: "933274496202",
  appId: "1:933274496202:web:4b1073c5c054bb7e4f5833",
  measurementId: "G-T13X4HJJW3",
};

// Prevent re-initializing the app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app); // ✅ Export auth if you want to use it directly
export default app;
