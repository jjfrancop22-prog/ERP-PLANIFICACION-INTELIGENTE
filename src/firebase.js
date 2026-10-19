import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
export const firebaseConfig = {
 apiKey:'AIzaSyCsBrtGbFfD10XBe6Sg8paesIxm2Vnr7Wk',
 authDomain:'erp-planificacion-nextgen-v29.firebaseapp.com',
 databaseURL:'https://erp-planificacion-nextgen-v29-default-rtdb.firebaseio.com',
 projectId:'erp-planificacion-nextgen-v29',
 storageBucket:'erp-planificacion-nextgen-v29.firebasestorage.app',
 messagingSenderId:'699179426375',
 appId:'1:699179426375:web:df0388074f2078af7b0762',
 measurementId:'G-M263GX6N12'
};
export const firebaseApp=initializeApp(firebaseConfig);
export const auth=getAuth(firebaseApp);
export const db=initializeFirestore(firebaseApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
