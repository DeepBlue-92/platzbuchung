const fs = require('fs');
const file = 'lib/firebase.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    } else {
      // It's already a real UID! Simply sign in
      await signInWithEmailAndPassword(auth, email, pwd);
    }`;

const replacement = `    } else {
      // It's already a real UID! Simply sign in
      try {
        await signInWithEmailAndPassword(auth, email, pwd);
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password') {
          console.warn("Auth password out of sync with DB. Recreating Auth user...");
          const newEmail = email.replace('@', \`.\${Date.now()}@\`);
          const cred = await createUserWithEmailAndPassword(auth, newEmail, pwd);
          uid = cred.user.uid;
          
          const migratedDoc = {
            ...userData,
            id: uid,
            email: newEmail
          };
          await setDoc(doc(db, 'users', uid), migratedDoc);
          await deleteDoc(doc(db, 'users', docId));
        } else {
          throw authErr;
        }
      }
    }`;

code = code.replace(target, replacement);

const target2 = `    if (snap.empty) {
      // Compatibility: Let's check if superadmin isn't in DB yet, we can try to sign in and auto-create doc if successful!
      if (isSuperadmin) {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, pwd);
          const uid = cred.user.uid;
          // Auto-create superadmin doc in users flat hierarchy if it's missing!
          const saRef = doc(db, 'users', uid);
          const saDoc = {
            id: uid,
            username: 'superadmin',
            role: 'super-admin',
            tenantId: 'system',
            password: passwordRaw,
            createdAt: new Date().toISOString()
          };
          await setDoc(saRef, saDoc);
          return {
            id: uid,
            name: 'superadmin',
            klarname: 'Globaler Super-Admin',
            role: Role.SUPER_ADMIN,
            vereinsId: 'super-admin',
            createdAt: saDoc.createdAt
          };
        } catch (authErr) {
          throw new Error('Falscher Benutzername oder Passwort.');
        }
      } else {`;

const replacement2 = `    if (snap.empty) {
      if (isSuperadmin) {
        try {
          let cred;
          try {
            cred = await signInWithEmailAndPassword(auth, email, pwd);
          } catch (signInErr: any) {
            cred = await createUserWithEmailAndPassword(auth, email, pwd);
          }
          const uid = cred.user.uid;
          const saDoc = {
            id: uid,
            username: 'superadmin',
            role: 'super-admin',
            tenantId: 'system',
            password: passwordRaw,
            passwort: passwordRaw,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), saDoc);
          return {
            id: uid,
            name: 'superadmin',
            klarname: 'Globaler Super-Admin',
            role: Role.SUPER_ADMIN,
            vereinsId: 'super-admin',
            createdAt: saDoc.createdAt
          };
        } catch (authErr) {
          throw new Error('Fehler beim Erstellen des Superadmins.');
        }
      } else {`;

code = code.replace(target2, replacement2);
fs.writeFileSync(file, code);
console.log("Patched lib/firebase.ts");
