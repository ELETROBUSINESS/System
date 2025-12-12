const firebaseConfig = {
    apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
    authDomain: "super-app25.firebaseapp.com",
    projectId: "super-app25",
    storageBucket: "super-app25.firebasestorage.app",
    messagingSenderId: "810900166273",
    appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}
const db = firebase.firestore();
console.log("Firebase Global Inicializado");