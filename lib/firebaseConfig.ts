// lib/firebaseConfig.ts
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBcvmm7kHWmQdDX-mMcSnYd05FCIEXMTxc',
  authDomain: 'unitar-admin.firebaseapp.com',
  projectId: 'unitar-admin',
  storageBucket: 'unitar-admin.appspot.com',
  messagingSenderId: '1015955629687',
  appId: '1:1015955629687:web:947103af6bc62be5b48872'
};

const app = initializeApp(firebaseConfig);

export default app;
