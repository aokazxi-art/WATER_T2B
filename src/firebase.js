import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCI4NaqTuySWIsZHmNiMmgUet6ZWUkATis",
  authDomain: "t2bwater.firebaseapp.com",
  projectId: "t2bwater",
  storageBucket: "t2bwater.firebasestorage.app",
  messagingSenderId: "857659938393",
  appId: "1:857659938393:web:d7c0b30e40a01f06a1c348",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);