import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

type ConfigDoc<T> = {
  key: string;
  userId?: ObjectId | null;
  value?: T;
};

export type ConfigSource = "user" | "global" | "default" | "none";

export async function readScopedConfig<T>(params: {
  key: string;
  userId?: string | null;
  fallback: T;
}): Promise<{ config: T; source: ConfigSource }> {
  const db = await getDb();
  const settings = db.collection("settings");

  if (params.userId && ObjectId.isValid(params.userId)) {
    const userDoc = await settings.findOne<ConfigDoc<T>>({
      key: params.key,
      userId: new ObjectId(params.userId),
    });
    if (userDoc?.value) {
      return { config: userDoc.value, source: "user" };
    }
  }

  const globalDoc = await settings.findOne<ConfigDoc<T>>({
    key: params.key,
    userId: null,
  });
  if (globalDoc?.value) {
    return { config: globalDoc.value, source: "global" };
  }

  const legacyDoc = await settings.findOne<ConfigDoc<T>>({
    key: params.key,
    userId: { $exists: false },
  });
  if (legacyDoc?.value) {
    return { config: legacyDoc.value, source: "global" };
  }

  return { config: params.fallback, source: "default" };
}

export async function upsertScopedConfig<T>(params: {
  key: string;
  userId?: string | null;
  config: T;
}) {
  const db = await getDb();
  const settings = db.collection("settings");

  const targetUserId =
    params.userId && ObjectId.isValid(params.userId)
      ? new ObjectId(params.userId)
      : null;

  await settings.updateOne(
    { key: params.key, userId: targetUserId },
    {
      $set: {
        value: params.config,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function deleteScopedConfig(params: {
  key: string;
  userId?: string | null;
}) {
  const db = await getDb();
  const settings = db.collection("settings");

  if (params.userId && ObjectId.isValid(params.userId)) {
    await settings.deleteOne({
      key: params.key,
      userId: new ObjectId(params.userId),
    });
    return;
  }

  await settings.deleteMany({
    key: params.key,
    $or: [{ userId: null }, { userId: { $exists: false } }],
  });
}
