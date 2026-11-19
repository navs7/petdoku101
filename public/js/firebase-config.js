// Paste your Firebase web-app config here (Firebase console -> Project settings -> Your apps).
// While the values below are placeholders, the app runs in LOCAL DEMO mode (data stays in this browser).
export const firebaseConfig = {
  apiKey: 'AIzaSyAxhPZabLk5Q3M23pXesropkuqV2DxW7RA',
  authDomain: 'petdoku-101.firebaseapp.com',
  projectId: 'petdoku-101',
  storageBucket: 'petdoku-101.firebasestorage.app',
  messagingSenderId: '1056439560171',
  appId: '1:1056439560171:web:58d80554d254fd96689bae',
};
export const isConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
