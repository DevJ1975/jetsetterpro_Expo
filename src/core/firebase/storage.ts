import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { auth } from './auth';
import { firebaseApp, isFirebaseConfigured } from './config';

// Durable media sync — user photos (vault documents, parking spot, journal)
// live under the user's private Cloud Storage tree so they survive a reinstall
// or device change instead of being lost with the local file uri. Everything
// here is best-effort and gated: when Firebase isn't configured or no user is
// signed in, callers keep the local uri as a fallback and nothing breaks.
//
// Path convention: users/{uid}/{folder}/{id}.jpg — enforced by
// firebase/storage.rules (each user reads/writes only their own tree).

export interface StoredImage {
  url: string; // https download URL (persisted for display)
  path: string; // storage path (persisted so we can delete deterministically)
}

export function storagePath(uid: string, folder: string, id: string): string {
  return `users/${uid}/${folder}/${id}.jpg`;
}

export function isMediaSyncAvailable(): boolean {
  return isFirebaseConfigured() && !!auth.currentUser;
}

// Read a local file:// uri into a NATIVE Blob via XMLHttpRequest. This is the
// battle-tested Expo pattern: plain fetch(fileUri).blob() is hang-prone on
// local uris, and a Uint8Array/base64 payload throws on RN >= 0.74 ("Creating
// blobs from ArrayBuffer … are not supported"). A native Blob hits Firebase's
// supported upload path.
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('uriToBlob failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Compress/resize a picked image and upload it to the signed-in user's private
 * Storage tree. Returns the download URL + path, or null when unavailable or on
 * any failure (the caller then keeps the local uri as a graceful fallback).
 */
export async function uploadUserImage(
  localUri: string,
  folder: string,
  id: string,
): Promise<StoredImage | null> {
  const user = auth.currentUser;
  if (!localUri || !isFirebaseConfigured() || !user) return null;
  try {
    // Documents/spot photos don't need full-resolution — cap width and
    // re-encode as JPEG to keep uploads (and the free-tier bill) small.
    const context = ImageManipulator.manipulate(localUri).resize({ width: 1600 });
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

    const blob = await uriToBlob(out.uri);
    const path = storagePath(user.uid, folder, id);
    const objectRef = ref(getStorage(firebaseApp), path);
    await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(objectRef);
    return { url, path };
  } catch {
    return null;
  }
}

/** Best-effort delete of a previously uploaded image by its storage path. */
export async function deleteUserImage(path?: string | null): Promise<void> {
  if (!path || !isFirebaseConfigured() || !auth.currentUser) return;
  try {
    await deleteObject(ref(getStorage(firebaseApp), path));
  } catch {
    /* already gone or offline — nothing to do */
  }
}
