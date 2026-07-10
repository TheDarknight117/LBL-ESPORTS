import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; // ESTO ES VITAL

const firebaseConfig = {
  apiKey: "AIzaSyBCd-xJD1OUH7GeAHkIek7dC2tj3KWWHPE",
  authDomain: "lbl-esports.firebaseapp.com",
  projectId: "lbl-esports",
  storageBucket: "lbl-esports.firebasestorage.app",
  messagingSenderId: "124596723477",
  appId: "1:124596723477:web:d913f1060f303ef3a2531c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // ESTO TAMBIÉN ES VITAL