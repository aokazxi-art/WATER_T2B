import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyASAWkCGV7Vjg38mBP1w7N0WHlErRf87nw",
  authDomain: "gen-lang-client-0103823618.firebaseapp.com",
  projectId: "gen-lang-client-0103823618",
  storageBucket: "gen-lang-client-0103823618.firebasestorage.app",
  messagingSenderId: "459966832920",
  appId: "1:459966832920:web:7598c6ba6507a6f969be6d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);