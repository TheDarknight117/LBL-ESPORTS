import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; // ESTO ES VITAL

const firebaseConfig = {
  apiKey: "AIzaSyANhZvlfMs7lSQAGB0bmp2i4VpfU6AQcR4",
  authDomain: "lbl-liga-2026.firebaseapp.com",
  projectId: "lbl-liga-2026",
  storageBucket: "lbl-liga-2026.firebasestorage.app",
  messagingSenderId: "860904795060",
  appId: "1:860904795060:web:41c3ac9ba01fc6a5cbe0e1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // ESTO TAMBIÉN ES VITAL