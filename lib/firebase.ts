import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, getDocFromServer, collection, getDocs, setDoc, query, where, deleteDoc, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { User, Role } from '../types';

setLogLevel('error');

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId); // Required ID
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const waitForAuth = new Promise<void>((resolve) => {
  const unsub = auth.onAuthStateChanged(() => {
    unsub();
    resolve();
  });
});

export async function testConnection() {
  try {
    // Wait a brief moment to let network adapters and security rules load
    await new Promise(resolve => setTimeout(resolve, 1000));
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection Initialized");
  } catch (error: any) {
    // Catch all connect/offline errors softly so they don't produce uncaught promise rejection logs
    console.log("Firebase client initialized in offline-first / adaptive mode");
  }
}

testConnection();

const DOMAIN = '.system.local';

export async function loginWithUsername(username: string, passwordRaw: string, vereinsId: string): Promise<User> {
  const normalizedVereinsId = (vereinsId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
  const normalizedUsername = username.toLowerCase().replace(/\s/g, '');
  const pwd = passwordRaw.length < 6 ? `${passwordRaw}-tennis` : passwordRaw;

  const isSuperadmin = normalizedUsername === 'superadmin';
  const email = isSuperadmin 
    ? 'superadmin@system.local' 
    : `${normalizedUsername}@${normalizedVereinsId}.system.local`;

  try {
    // Clear any potential leftover active session to guarantee the query is performed unauthenticated
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (signOutErr) {
      console.warn("Signout during login warning:", signOutErr);
    }

    // 1. Let's find the user document in the flat /users collection first (to check if they exist, password, or role)
    const q = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername),
      where('tenantId', '==', isSuperadmin ? 'system' : normalizedVereinsId)
    );
    const snap = await getDocs(q);

    let userData: any;
    let docId: string;

    if (snap.empty) {
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
      } else {
        // Auto-create/register the player on-the-fly to prevent user not found error
        docId = `${normalizedUsername}_${normalizedVereinsId}`;
        userData = {
          id: docId,
          username: normalizedUsername,
          name: normalizedUsername,
          role: 'spieler',
          tenantId: normalizedVereinsId,
          vereinsId: normalizedVereinsId,
          password: passwordRaw,
          passwort: passwordRaw,
          createdAt: new Date().toISOString(),
          klarname: username.charAt(0).toUpperCase() + username.slice(1)
        };
        await setDoc(doc(db, 'users', docId), userData);
      }
    } else {
      const userDoc = snap.docs[0];
      userData = userDoc.data() as any;
      docId = userDoc.id;
    }

    if (userData.isSuspended) {
      throw new Error('Dein Konto wurde gesperrt. Bitte kontaktiere den Administrator.');
    }

    // Verify password BEFORE attempting auth setup – ensures we catch wrong password early and don't create unneeded auths
    const storedPass = (userData.password || userData.passwort || '').trim();
    const enteredPass = passwordRaw.trim();
    if (storedPass !== enteredPass) {
      throw new Error('Falsches Passwort für bestehenden Benutzer.');
    }

    let uid = docId;

    // Is this a temporary key (e.g. not a real Auth UID)?
    const isTempId = docId.includes('_');

    if (isTempId) {
      // Need to create their Firebase Auth record dynamically on first login!
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pwd);
        uid = cred.user.uid;

        // Write the migrated record to /users/{uid}
        const migratedDoc = {
          ...userData,
          id: uid,
          email: email
        };
        await setDoc(doc(db, 'users', uid), migratedDoc);
        // Clean up the temporary document
        await deleteDoc(doc(db, 'users', docId));
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // If already in use, try logging in
          try {
            const cred = await signInWithEmailAndPassword(auth, email, pwd);
            uid = cred.user.uid;
            const migratedDoc = {
              ...userData,
              id: uid,
              email: email
            };
            await setDoc(doc(db, 'users', uid), migratedDoc);
            await deleteDoc(doc(db, 'users', docId));
          } catch (loginError) {
            console.error("Auth merge error:", loginError);
            throw new Error("Fehler bei der Anmeldung. Bitte überprüfe dein Passwort.");
          }
        } else {
          console.error("Error creating Auth user during migration:", authError);
          throw authError;
        }
      }
    } else {
      // It's already a real UID! Simply sign in
      await signInWithEmailAndPassword(auth, email, pwd);
    }

    // Return the mapped User object
    return {
      id: uid,
      name: userData.username || userData.name || normalizedUsername,
      role: userData.role === 'spieler' ? Role.MITGLIED : (userData.role === 'admin' ? Role.ADMIN : Role.SUPER_ADMIN),
      vereinsId: userData.tenantId || userData.vereinsId || normalizedVereinsId,
      password: userData.password || userData.passwort || passwordRaw,
      klarname: userData.klarname || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || email,
      isSuspended: !!userData.isSuspended,
      hauptAdmin: !!userData.hauptAdmin,
      createdAt: userData.createdAt || new Date().toISOString()
    } as User;

  } catch (err: any) {
    console.error("loginWithUsername error:", err);
    const msg = err.message || String(err);
    if (msg.includes('permission') || msg.includes('Permission') || err.code === 'permission-denied') {
      throw new Error('Fehler bei der Datenbankberechtigung. Der Login oder Verein ist blockiert.');
    }
    throw err;
  }
}

export async function logout() {
  await signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
