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

// App Check: proves requests come from this site, not a script. Create a reCAPTCHA key for your hosting
// domains, register it under App Check in the Firebase console, then paste the SITE key here (it is public,
// like the API key). While siteKey is empty App Check is off. provider: 'enterprise' (reCAPTCHA Enterprise)
// or 'v3' (classic reCAPTCHA v3) - it must match the provider you registered in the console.
export const appCheck = { provider: 'enterprise', siteKey: '6LcvbCkuAAAAAGtGz0QngHuR2H5qa7iV5bKfm6cc' };
