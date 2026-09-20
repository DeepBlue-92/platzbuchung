import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { TournamentTemplate, TournamentInstance } from '../types/championship';
import { deepCleanUndefined, getNormalizedVereinsId } from './db';
import { createDefaultTemplate } from '../utils/championshipCalculator';

export function listenToChampionshipTemplates(
  rawVereinsId: string,
  callback: (templates: TournamentTemplate[]) => void
): () => void {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_templates`;
  const colRef = collection(db, 'vereine', vereinsId, 'championship_templates');

  const unsubscribe = onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty) {
        // Seed default template if completely empty
        try {
          const defTpl = createDefaultTemplate(vereinsId);
          await saveChampionshipTemplate(vereinsId, defTpl);
          callback([defTpl]);
          return;
        } catch (e) {
          console.warn('Could not auto-seed championship template:', e);
          callback([]);
          return;
        }
      }

      const templates: TournamentTemplate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TournamentTemplate;
        templates.push({
          ...data,
          id: docSnap.id,
        });
      });

      // Sort by creation date descending
      templates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(templates);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path, false);
      callback([]);
    }
  );

  return unsubscribe;
}

export async function saveChampionshipTemplate(
  rawVereinsId: string,
  template: TournamentTemplate
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_templates/${template.id}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_templates', template.id);

  const cleanData = deepCleanUndefined({
    ...template,
    tenantId: vereinsId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

export async function deleteChampionshipTemplate(
  rawVereinsId: string,
  templateId: string
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_templates/${templateId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_templates', templateId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, true);
  }
}

export function listenToChampionshipTournaments(
  rawVereinsId: string,
  callback: (tournaments: TournamentInstance[]) => void
): () => void {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments`;
  const colRef = collection(db, 'vereine', vereinsId, 'championship_tournaments');

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const tournaments: TournamentInstance[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TournamentInstance;
        tournaments.push({
          ...data,
          id: docSnap.id,
        });
      });

      // Sort by creation date descending
      tournaments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(tournaments);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path, false);
      callback([]);
    }
  );

  return unsubscribe;
}

export async function saveChampionshipTournament(
  rawVereinsId: string,
  tournament: TournamentInstance
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments/${tournament.id}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournament.id);

  const cleanData = deepCleanUndefined({
    ...tournament,
    tenantId: vereinsId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Soft delete: moves tournament to trash with a 30-day retention period.
 * Instant permanent deletion is prohibited in the UI.
 */
export async function softDeleteChampionshipTournament(
  rawVereinsId: string,
  tournamentId: string
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments/${tournamentId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournamentId);

  try {
    await setDoc(
      docRef,
      {
        status: 'trash',
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Restore tournament from trash back to active status.
 */
export async function restoreChampionshipTournament(
  rawVereinsId: string,
  tournamentId: string
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments/${tournamentId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournamentId);

  try {
    await setDoc(
      docRef,
      {
        status: 'active',
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Archive tournament.
 */
export async function archiveChampionshipTournament(
  rawVereinsId: string,
  tournamentId: string
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments/${tournamentId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournamentId);

  try {
    await setDoc(
      docRef,
      {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Activate tournament (from draft or archived).
 */
export async function activateChampionshipTournament(
  rawVereinsId: string,
  tournamentId: string
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const path = `vereine/${vereinsId}/championship_tournaments/${tournamentId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournamentId);

  try {
    await setDoc(
      docRef,
      {
        status: 'active',
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Automatically purges tournaments in trash that were deleted more than 30 days ago.
 */
export async function purgeExpiredTrashTournaments(
  rawVereinsId: string,
  tournaments: TournamentInstance[]
): Promise<void> {
  const vereinsId = getNormalizedVereinsId(rawVereinsId);
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  for (const t of tournaments) {
    if (t.status === 'trash' && t.deletedAt) {
      const deletedTime = new Date(t.deletedAt).getTime();
      if (now - deletedTime > THIRTY_DAYS_MS) {
        try {
          const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', t.id);
          await deleteDoc(docRef);
        } catch (e) {
          console.warn(`Failed to purge expired tournament ${t.id}:`, e);
        }
      }
    }
  }
}
