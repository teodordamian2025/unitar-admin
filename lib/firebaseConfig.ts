// lib/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBcvmm7kHWmQdDX-mMcSnYd05FCIEXMTxc",
  authDomain: "unitarproiect.firebaseapp.com",
  projectId: "unitarproiect",
  storageBucket: "unitarproiect.appspot.com",
  messagingSenderId: "1015955629687",
  appId: "1:1015955629687:web:947103af6bc62be5b48872"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
