import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

export interface MutationRequest {
  action: "create" | "set" | "update" | "delete" | "ensure" | "deleteProduction" | "reserveUpload" | "deleteFile" | "assignDefaultPool";
  collection?: string;
  id?: string;
  productionId?: string;
  data?: object;
  logicalPath?: string;
  contentType?: string;
  size?: number;
  path?: string;
}

export async function mutate(request: MutationRequest): Promise<{ id?: string; path?: string }> {
  // JSON serialization strips undefined values before crossing the callable boundary.
  const call = httpsCallable<MutationRequest, { id?: string; path?: string }>(getFunctions(getApp(), "us-central1"), "mutate");
  const clean = JSON.parse(JSON.stringify(request)) as MutationRequest;
  if (clean.data) {
    const data = clean.data as Record<string, unknown>;
    delete data.createdAt;
    delete data.updatedAt;
  }
  const result = await call(clean);
  return result.data;
}

export async function createRecord(collection: string, data: object, productionId?: string): Promise<string> {
  const result = await mutate({ action: "create", collection, data, productionId });
  if (!result.id) throw new Error("The server did not return a record ID.");
  return result.id;
}
