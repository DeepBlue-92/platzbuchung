import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp();
const db = getFirestore(app);
async function run() {
  const q = await db.collection('users').where('email', '==', 'aloisoberhofer@system.system.local').get();
  q.forEach(d => console.log(d.id, d.data()));
}
run().catch(console.error);
