import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
  type StorageReference,
} from "firebase/storage";
import { storage } from "./firebase";
import { mutate } from "./mutations";

async function reserveUpload(userId: string, productionId: string, logicalPath: string, file: File) {
  void userId; // Ownership comes from the verified authentication token.
  const result = await mutate({ action: "reserveUpload", productionId, logicalPath, size: file.size, contentType: file.type });
  if (!result.path) throw new Error("The server did not reserve an upload.");
  return ref(storage, result.path);
}

/**
 * Image types accepted for production artwork. storage.rules enforces the
 * same content-type allowlist (plus application/pdf) and a 20MB ceiling.
 */
export const ARTWORK_CONTENT_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export async function uploadProductionArtwork(
  userId: string,
  productionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!ARTWORK_CONTENT_TYPES.includes(file.type))
    throw new Error("Image must be PNG, JPEG, WebP, or GIF");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");

  const storageRef = await reserveUpload(userId, productionId, `artwork`, file);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function uploadOperatingAgreement(
  userId: string,
  productionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (file.type !== "application/pdf")
    throw new Error("Operating agreement must be a PDF");
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF must be under 20MB");

  const storageRef = await reserveUpload(userId, productionId, `agreement.pdf`, file);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export type ProductionDocType =
  | "instruction-letter"
  | "member-signature-page"
  | "subscription-agreement"
  | "operating-agreement";

export async function uploadProductionDocument(
  userId: string,
  productionId: string,
  docType: ProductionDocType,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (file.type !== "application/pdf")
    throw new Error("File must be a PDF");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("PDF must be under 20MB");

  const storageRef = await reserveUpload(userId, productionId, `${docType}.pdf`, file);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export type InvestorDocType =
  | "distributed/instruction-letter"
  | "distributed/signature-page"
  | "distributed/subscription-agreement"
  | "signed/signature-page"
  | "signed/subscription-agreement"
  | "executed/signature-page"
  | "executed/subscription-agreement";

export async function uploadInvestorDocument(
  userId: string,
  productionId: string,
  investorId: string,
  docType: InvestorDocType,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (file.type !== "application/pdf")
    throw new Error("File must be a PDF");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("PDF must be under 20MB");

  const storageRef = await reserveUpload(userId, productionId, `investors/${investorId}/${docType}.pdf`, file);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function deleteFile(path: string): Promise<void> {
  await mutate({ action: "deleteFile", path });
}

async function collectFiles(dir: StorageReference): Promise<StorageReference[]> {
  const res = await listAll(dir);
  const nested = await Promise.all(res.prefixes.map((p) => collectFiles(p)));
  return [...res.items, ...nested.flat()];
}

/**
 * Best-effort removal of every file uploaded for a production
 * (productions/{userId}/{productionId}/**). Returns the number of files that
 * could not be deleted; never throws.
 */
export async function deleteProductionFiles(
  userId: string,
  productionId: string
): Promise<number> {
  try {
    const files = await collectFiles(ref(storage, `productions/${userId}/${productionId}`));
    const results = await Promise.allSettled(files.map((f) => deleteFile(f.fullPath)));
    return results.filter((r) => r.status === "rejected").length;
  } catch (err) {
    console.error("Failed to list production files for cleanup:", err);
    return -1;
  }
}
