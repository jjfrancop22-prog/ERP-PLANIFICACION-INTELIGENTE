import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
 apiKey:'AIzaSyCc-sD8-z0RX1TWgBni26e5Ko7TXTlsQkM',
 authDomain:'sgc-psi.firebaseapp.com', projectId:'sgc-psi',
 storageBucket:'sgc-psi.firebasestorage.app', messagingSenderId:'135342549231',
 appId:'1:135342549231:web:2c2c887f491ffca12f531a'
};
export const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentSingleTabManager()})});
export const storage=getStorage(app);
