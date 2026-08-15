import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp();
const db = getFirestore();
async function run() {
  const p = await db.collection('league_profiles').get();
  console.log("League profiles: ", p.docs.map(d => d.data()));
  const u = await db.collection('users').get();
  console.log("Users: ", u.docs.map(d => ({id: d.id, name: d.data().name, username: d.data().username, tenantId: d.data().tenantId})));
}
run();
