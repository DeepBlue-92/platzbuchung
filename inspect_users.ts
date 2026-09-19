import { db } from './lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function inspect() {
  const snap = await getDocs(collection(db, 'users'));
  console.log('Total user docs:', snap.docs.length);
  snap.docs.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('torben') || str.includes('hoenig') || str.includes('hönig') || str.includes('neuhausen')) {
      console.log('=== USER DOC ===');
      console.log('Doc ID:', doc.id);
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  });

  const clubsSnap = await getDocs(collection(db, 'clubs'));
  console.log('=== CLUBS IN DB ===');
  clubsSnap.docs.forEach(doc => {
    console.log('Club Doc ID:', doc.id, 'Data:', JSON.stringify(doc.data(), null, 2));
  });

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
