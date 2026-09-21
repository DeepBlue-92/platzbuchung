import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
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
  if (!vereinsId) {
    console.error('saveChampionshipTemplate: Vereins-ID fehlt oder ist leer.', { rawVereinsId });
    throw new Error('Fehlende Vereins-ID: Die Vorlage konnte keinem Verein zugeordnet werden.');
  }
  if (!template || !template.id) {
    console.error('saveChampionshipTemplate: Ungültige Vorlage oder fehlende ID.', { template });
    throw new Error('Ungültige Vorlage: Vorlagen-ID ist ein Pflichtfeld.');
  }
  if (!template.title || !template.title.trim()) {
    console.error('saveChampionshipTemplate: Pflichtfeld "Titel" fehlt.', { template });
    throw new Error('Bitte geben Sie einen Titel für die Vorlage an.');
  }
  if (!template.stages || template.stages.length === 0) {
    console.error('saveChampionshipTemplate: Pflichtfeld "Stufen" ist leer.', { template });
    throw new Error('Eine Vorlage muss mindestens eine Turnierstufe enthalten.');
  }

  const path = `vereine/${vereinsId}/championship_templates/${template.id}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_templates', template.id);

  const cleanData = deepCleanUndefined({
    ...template,
    tenantId: vereinsId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanData, { merge: true });
    console.log(`[ChampionshipService] Vorlage erfolgreich gespeichert: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Schreiben nach ${path}:`, error);
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

export async function deleteChampionshipTemplate(
  arg1: string,
  arg2?: string
): Promise<void> {
  let vereinsId: string;
  let templateId: string;

  if (arg2 !== undefined) {
    vereinsId = getNormalizedVereinsId(arg1);
    templateId = arg2;
  } else {
    templateId = arg1;
    let storedClub = '';
    try {
      storedClub = localStorage.getItem('selectedClubId') || '';
    } catch {
      // ignore in environments without localStorage
    }
    vereinsId = getNormalizedVereinsId(storedClub || 'default');
  }

  if (!vereinsId || !templateId) {
    console.error('deleteChampionshipTemplate: Parameter fehlen', { vereinsId, templateId });
    throw new Error('Vereins-ID oder Vorlagen-ID fehlt.');
  }
  const path = `vereine/${vereinsId}/championship_templates/${templateId}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_templates', templateId);

  // Defensive Programmierung: Verhindere im Service das Löschen, falls isLocked === true ist
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data?.isLocked === true) {
        console.warn(`[ChampionshipService] Löschen verhindert: Vorlage "${templateId}" ist gesperrt (isLocked === true).`);
        throw new Error('Gesperrte Vorlagen in aktiver Verwendung können nicht gelöscht werden.');
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('Gesperrte Vorlagen in aktiver Verwendung können nicht gelöscht werden')) {
      throw err;
    }
    console.warn('[ChampionshipService] Lock-Prüfung vor dem Löschen fehlgeschlagen/übersprungen:', err);
  }

  try {
    await deleteDoc(docRef);
    console.log(`[ChampionshipService] Vorlage gelöscht: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Löschen von ${path}:`, error);
    handleFirestoreError(error, OperationType.DELETE, path, true);
  }
}

export const deleteTemplate = deleteChampionshipTemplate;

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
  if (!vereinsId) {
    console.error('saveChampionshipTournament: Vereins-ID fehlt oder ist leer.', { rawVereinsId });
    throw new Error('Fehlende Vereins-ID: Das Turnier konnte keinem Verein zugeordnet werden.');
  }
  if (!tournament || !tournament.id) {
    console.error('saveChampionshipTournament: Ungültiges Turnier oder fehlende ID.', { tournament });
    throw new Error('Ungültiges Turnier: Turnier-ID ist ein Pflichtfeld.');
  }

  const path = `vereine/${vereinsId}/championship_tournaments/${tournament.id}`;
  const docRef = doc(db, 'vereine', vereinsId, 'championship_tournaments', tournament.id);

  const cleanData = deepCleanUndefined({
    ...tournament,
    tenantId: vereinsId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanData, { merge: true });
    console.log(`[ChampionshipService] Turnier erfolgreich gespeichert: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Schreiben nach ${path}:`, error);
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Soft delete: moves tournament to trash with a 30-day retention period.
 * Instant permanent deletion is prohibited in the UI.
 */
export async function softDeleteChampionshipTournament(
  arg1: string,
  arg2?: string
): Promise<void> {
  let vereinsId: string;
  let tournamentId: string;

  if (arg2 !== undefined) {
    vereinsId = getNormalizedVereinsId(arg1);
    tournamentId = arg2;
  } else {
    tournamentId = arg1;
    let storedClub = '';
    try {
      storedClub = localStorage.getItem('selectedClubId') || '';
    } catch {
      // ignore
    }
    vereinsId = getNormalizedVereinsId(storedClub || 'default');
  }

  if (!vereinsId || !tournamentId) {
    console.error('softDeleteChampionshipTournament: Parameter fehlen', { vereinsId, tournamentId });
    throw new Error('Vereins-ID oder Turnier-ID fehlt.');
  }

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
    console.log(`[ChampionshipService] Meisterschaft in Papierkorb verschoben: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Verschieben in den Papierkorb (${path}):`, error);
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Restore tournament from trash back to active status.
 */
export async function restoreChampionshipTournament(
  arg1: string,
  arg2?: string
): Promise<void> {
  let vereinsId: string;
  let tournamentId: string;

  if (arg2 !== undefined) {
    vereinsId = getNormalizedVereinsId(arg1);
    tournamentId = arg2;
  } else {
    tournamentId = arg1;
    let storedClub = '';
    try {
      storedClub = localStorage.getItem('selectedClubId') || '';
    } catch {
      // ignore
    }
    vereinsId = getNormalizedVereinsId(storedClub || 'default');
  }

  if (!vereinsId || !tournamentId) {
    console.error('restoreChampionshipTournament: Parameter fehlen', { vereinsId, tournamentId });
    throw new Error('Vereins-ID oder Turnier-ID fehlt.');
  }

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
    console.log(`[ChampionshipService] Meisterschaft wiederhergestellt: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Wiederherstellen (${path}):`, error);
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Archive tournament.
 */
export async function archiveChampionshipTournament(
  arg1: string,
  arg2?: string
): Promise<void> {
  let vereinsId: string;
  let tournamentId: string;

  if (arg2 !== undefined) {
    vereinsId = getNormalizedVereinsId(arg1);
    tournamentId = arg2;
  } else {
    tournamentId = arg1;
    let storedClub = '';
    try {
      storedClub = localStorage.getItem('selectedClubId') || '';
    } catch {
      // ignore
    }
    vereinsId = getNormalizedVereinsId(storedClub || 'default');
  }

  if (!vereinsId || !tournamentId) {
    console.error('archiveChampionshipTournament: Parameter fehlen', { vereinsId, tournamentId });
    throw new Error('Vereins-ID oder Turnier-ID fehlt.');
  }

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
    console.log(`[ChampionshipService] Meisterschaft archiviert: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Archivieren (${path}):`, error);
    handleFirestoreError(error, OperationType.WRITE, path, true);
  }
}

/**
 * Activate tournament (from draft or archived).
 */
export async function activateChampionshipTournament(
  arg1: string,
  arg2?: string
): Promise<void> {
  let vereinsId: string;
  let tournamentId: string;

  if (arg2 !== undefined) {
    vereinsId = getNormalizedVereinsId(arg1);
    tournamentId = arg2;
  } else {
    tournamentId = arg1;
    let storedClub = '';
    try {
      storedClub = localStorage.getItem('selectedClubId') || '';
    } catch {
      // ignore
    }
    vereinsId = getNormalizedVereinsId(storedClub || 'default');
  }

  if (!vereinsId || !tournamentId) {
    console.error('activateChampionshipTournament: Parameter fehlen', { vereinsId, tournamentId });
    throw new Error('Vereins-ID oder Turnier-ID fehlt.');
  }

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
    console.log(`[ChampionshipService] Meisterschaft aktiviert: ${path}`);
  } catch (error) {
    console.error(`[ChampionshipService] Fehler beim Aktivieren (${path}):`, error);
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

export const championshipService = {
  deleteTemplate: deleteChampionshipTemplate,
  deleteChampionshipTemplate,
  saveTemplate: saveChampionshipTemplate,
  saveChampionshipTemplate,
  listenToTemplates: listenToChampionshipTemplates,
  listenToChampionshipTemplates,
  listenToTournaments: listenToChampionshipTournaments,
  listenToChampionshipTournaments,
  saveTournament: saveChampionshipTournament,
  saveChampionshipTournament,
  archiveTournament: archiveChampionshipTournament,
  archiveChampionshipTournament,
  activateTournament: activateChampionshipTournament,
  activateChampionshipTournament,
  softDeleteTournament: softDeleteChampionshipTournament,
  softDeleteChampionshipTournament,
  trashTournament: softDeleteChampionshipTournament,
  restoreTournament: restoreChampionshipTournament,
  restoreChampionshipTournament,
  purgeExpiredTrashTournaments,
};
