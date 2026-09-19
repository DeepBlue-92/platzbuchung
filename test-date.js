const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json'); // I might not have this locally, I should just grep the local files or output a script that runs via the Firebase REST API? Wait, I don't have direct DB access from terminal easily without skills.
