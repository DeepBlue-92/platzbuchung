import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDoc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  deleteDoc, 
  setLogLevel 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { User, Role } from '../types';
import { getUserClubs } from './userUtils';

setLogLevel('error');

const isBrowser = typeof window !== 'undefined';

const app = initializeApp(firebaseConfig);
export const db = isBrowser
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId)
  : initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const waitForAuth = isBrowser
  ? new Promise<void>((resolve) => {
      const unsub = auth.onAuthStateChanged(() => {
        unsub();
        resolve();
      });
    })
  : Promise.resolve();

export async function testConnection() {
  if (!isBrowser) return;
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

if (isBrowser) {
  testConnection();
}

const DOMAIN = '.system.local';

export async function loginWithUsername(username: string, passwordRaw: string, vereinsId: string): Promise<User> {
  const rawInput = (username || '').trim();
  const normalizedVereinsId = (vereinsId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
  const normalizedUsername = rawInput.toLowerCase().replace(/\s/g, '');
  const enteredPass = (passwordRaw || '').trim();
  const pwd = enteredPass.length < 6 ? `${enteredPass}-tennis` : enteredPass;

  const isSuperadmin = normalizedUsername === 'superadmin';
  const defaultSysEmail = isSuperadmin 
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

    // 1. Find user document in /users collection: search by username, name, email or direct ID
    const qUsername = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername)
    );
    let snap = await getDocs(qUsername);
    let matchedDoc: any = null;

    if (!snap.empty) {
      matchedDoc = snap.docs.find(d => {
        const u = d.data();
        const tId = (u.tenantId || u.vereinsId || '').toLowerCase().replace(/\s/g, '');
        if (tId === normalizedVereinsId) return true;
        const clubIds = (u.clubs || []).map((c: any) => (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, ''));
        return clubIds.includes(normalizedVereinsId);
      }) || snap.docs[0];
    } else {
      // Try query by name
      const qName = query(
        collection(db, 'users'),
        where('name', '==', normalizedUsername)
      );
      const snapName = await getDocs(qName);
      if (!snapName.empty) {
        matchedDoc = snapName.docs.find(d => {
          const u = d.data();
          const tId = (u.tenantId || u.vereinsId || '').toLowerCase().replace(/\s/g, '');
          if (tId === normalizedVereinsId) return true;
          const clubIds = (u.clubs || []).map((c: any) => (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, ''));
          return clubIds.includes(normalizedVereinsId);
        }) || snapName.docs[0];
      } else {
        // Try query by email
        const qEmail = query(
          collection(db, 'users'),
          where('email', '==', rawInput.toLowerCase())
        );
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          matchedDoc = snapEmail.docs.find(d => {
            const u = d.data();
            const tId = (u.tenantId || u.vereinsId || '').toLowerCase().replace(/\s/g, '');
            if (tId === normalizedVereinsId) return true;
            const clubIds = (u.clubs || []).map((c: any) => (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, ''));
            return clubIds.includes(normalizedVereinsId);
          }) || snapEmail.docs[0];
        }
      }
    }

    if (!matchedDoc && isSuperadmin) {
      try {
        const directDoc = await getDoc(doc(db, 'users', 'superadmin'));
        if (directDoc.exists()) {
          matchedDoc = directDoc;
        }
      } catch {
        // ignore
      }
    }

    if (!matchedDoc) {
      if (isSuperadmin) {
        try {
          let cred;
          try {
            cred = await signInWithEmailAndPassword(auth, defaultSysEmail, pwd);
          } catch (signInErr: any) {
            cred = await createUserWithEmailAndPassword(auth, defaultSysEmail, pwd);
          }
          const uid = cred.user.uid;
          const saDoc = {
            id: uid,
            username: 'superadmin',
            name: 'superadmin',
            role: 'super-admin',
            tenantId: 'system',
            password: enteredPass,
            passwort: enteredPass,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), saDoc);
          return {
            id: uid,
            name: 'superadmin',
            klarname: 'Globaler Super-Admin',
            role: Role.SUPER_ADMIN,
            vereinsId: 'super-admin',
            clubs: [{ vereinsId: 'system', clubName: 'System', role: Role.SUPER_ADMIN }],
            createdAt: saDoc.createdAt
          } as User;
        } catch (authErr) {
          throw new Error('Fehler beim Erstellen des Superadmins.');
        }
      } else {
        throw new Error('Benutzername oder Passwort falsch.');
      }
    }

    const userData = matchedDoc.data() as any;
    const docId = matchedDoc.id;

    if (userData.isSuspended) {
      throw new Error('Dein Konto wurde gesperrt. Bitte kontaktiere den Administrator.');
    }

    // Verify password and synchronize with Firebase Auth
    const storedPass = (userData.password || userData.passwort || '').toString().trim();
    const dbPasswordMatches = storedPass !== '' && (
      enteredPass === storedPass ||
      pwd === storedPass ||
      `${enteredPass}-tennis` === storedPass ||
      `${storedPass}-tennis` === pwd
    );

    let uid = docId;
    const isTempId = docId.includes('_') || docId.startsWith('temp_');

    const authEmailsToTry = Array.from(new Set([
      userData.email,
      defaultSysEmail,
      userData.authEmail
    ].filter(Boolean)));

    if (isTempId) {
      // Temporary/migrated seed record without permanent Auth record
      if (!dbPasswordMatches) {
        throw new Error('Benutzername oder Passwort falsch.');
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, defaultSysEmail, pwd);
        uid = cred.user.uid;

        const migratedDoc = {
          ...userData,
          id: uid,
          email: userData.email || defaultSysEmail,
          password: enteredPass,
          passwort: enteredPass
        };
        await setDoc(doc(db, 'users', uid), migratedDoc);
        await deleteDoc(doc(db, 'users', docId)).catch(() => {});
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(auth, defaultSysEmail, pwd);
            uid = cred.user.uid;
            const migratedDoc = {
              ...userData,
              id: uid,
              email: userData.email || defaultSysEmail,
              password: enteredPass,
              passwort: enteredPass
            };
            await setDoc(doc(db, 'users', uid), migratedDoc);
            if (docId !== uid) {
              await deleteDoc(doc(db, 'users', docId)).catch(() => {});
            }
          } catch {
            throw new Error('Benutzername oder Passwort falsch.');
          }
        } else {
          throw new Error('Benutzername oder Passwort falsch.');
        }
      }
    } else {
      // Permanent user with real UID
      let authSuccess = false;

      for (const testEmail of authEmailsToTry) {
        try {
          await signInWithEmailAndPassword(auth, testEmail, pwd);
          authSuccess = true;
          break;
        } catch {
          // Try next email
        }
      }

      if (!authSuccess) {
        if (dbPasswordMatches) {
          console.warn("Auth credentials re-aligning with DB password...");
          try {
            const newEmail = defaultSysEmail.includes('@') 
              ? defaultSysEmail.replace('@', `.${Date.now()}@`) 
              : `${normalizedUsername}.${Date.now()}@system.local`;
            const cred = await createUserWithEmailAndPassword(auth, newEmail, pwd);
            uid = cred.user.uid;
            
            const migratedDoc = {
              ...userData,
              id: uid,
              email: userData.email || newEmail,
              password: enteredPass,
              passwort: enteredPass
            };
            await setDoc(doc(db, 'users', uid), migratedDoc);
            if (docId !== uid) {
              await setDoc(doc(db, 'users', docId), { ...migratedDoc, authUid: uid }, { merge: true });
            }
            authSuccess = true;
          } catch {
            // Re-alignment fallback failed
          }
        }
      }

      if (!authSuccess) {
        throw new Error('Benutzername oder Passwort falsch.');
      }
    }

    // Return the mapped User object
    const resolvedClubs = getUserClubs(userData);
    const isSuper = (userData.role === 'super-admin' || userData.role === 'superadmin' || userData.role === 'SUPER_ADMIN');
    const clubRole = resolvedClubs.find(c => {
      const cid = (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, '');
      return cid === normalizedVereinsId;
    })?.role;
    const isAdminOfCurrentClub = (
      userData.role === 'admin' ||
      userData.role === Role.ADMIN ||
      clubRole === 'admin' ||
      clubRole === Role.ADMIN ||
      userData.hauptAdmin === true ||
      (Array.isArray(userData.adminClubIds) && userData.adminClubIds.includes(normalizedVereinsId))
    );

    if (!isSuper && isAdminOfCurrentClub && (userData.role !== 'admin' || !userData.adminClubIds?.includes(normalizedVereinsId))) {
      try {
        const adminClubs = Array.from(new Set([
          ...(userData.adminClubIds || []),
          normalizedVereinsId,
          ...resolvedClubs.filter(c => c.role === 'admin' || c.role === Role.ADMIN).map(c => (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, ''))
        ])).filter(Boolean);
        await setDoc(doc(db, 'users', uid), {
          role: 'admin',
          adminClubIds: adminClubs
        }, { merge: true });
      } catch (e) {
        console.warn("Could not auto-promote user doc to admin:", e);
      }
    }

    return {
      id: uid,
      name: userData.username || userData.name || normalizedUsername,
      role: isSuper ? Role.SUPER_ADMIN : (isAdminOfCurrentClub ? Role.ADMIN : Role.MITGLIED),
      vereinsId: userData.tenantId || userData.vereinsId || normalizedVereinsId,
      clubs: resolvedClubs.length > 0 ? resolvedClubs : [{ vereinsId: normalizedVereinsId, clubName: normalizedVereinsId, role: isAdminOfCurrentClub ? Role.ADMIN : Role.MITGLIED }],
      password: userData.password || userData.passwort || enteredPass,
      klarname: userData.klarname || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || defaultSysEmail,
      phone: userData.phone || userData.telefon || '',
      gender: (userData.gender || userData.geschlecht || 'm') as any,
      birthDate: userData.birthDate || null,
      isSuspended: !!userData.isSuspended,
      hauptAdmin: !!userData.hauptAdmin,
      showAiAssistant: userData.showAiAssistant !== false,
      showContactInfo: userData.showContactInfo !== undefined ? !!userData.showContactInfo : (userData.kontaktfreigabe !== undefined ? !!userData.kontaktfreigabe : true),
      onboarding_pending: userData.onboarding_pending !== undefined ? !!userData.onboarding_pending : false,
      avatarUrl: userData.avatarUrl || null,
      avatarId: userData.avatarId || null,
      createdAt: userData.createdAt || new Date().toISOString()
    } as User;

  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes('permission') || msg.includes('Permission') || err.code === 'permission-denied') {
      console.error("loginWithUsername permission error:", err);
      throw new Error('Fehler bei der Datenbankberechtigung. Der Login oder Verein ist blockiert.');
    }
    if (msg.includes('Benutzername oder Passwort falsch') || msg.includes('gesperrt')) {
      console.warn("Login rejected:", msg);
      throw err;
    }
    console.warn("loginWithUsername warning:", msg);
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow: boolean = true) {
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
  if (shouldThrow) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Warning (Handled): ', JSON.stringify(errInfo));
  }
}
