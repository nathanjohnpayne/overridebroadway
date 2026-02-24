import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

export async function uploadProductionArtwork(
  userId: string,
  productionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");

  const storageRef = ref(
    storage,
    `productions/${userId}/${productionId}/artwork`
  );
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

  const storageRef = ref(
    storage,
    `productions/${userId}/${productionId}/agreement.pdf`
  );
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

  const storageRef = ref(
    storage,
    `productions/${userId}/${productionId}/${docType}.pdf`
  );
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

  const storageRef = ref(
    storage,
    `productions/${userId}/${productionId}/investors/${investorId}/${docType}.pdf`
  );
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
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}
