import { Db, MongoClient, MongoClientOptions } from "mongodb";

function maskUri(u: string) {
  try {
    // mask credentials in the URI for safe logging
    return u.replace(/(mongodb(?:\+srv)?:\/\/)(.*@)/, "$1***:***@");
  } catch (e) {
    return "(invalid-uri)";
  }
}

const rawUri = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? process.env.MONGO_URL;
const uri = rawUri?.trim();

if (!uri || !/^mongodb/i.test(uri)) {
  const sample = "mongodb+srv://<user>:<pass>@cluster0.example.net/<dbname>?retryWrites=true&w=majority";
  throw new Error([
    "MONGO_URI is missing or invalid.",
    "Set the environment variable `MONGO_URI` (or `MONGODB_URI`/`MONGO_URL`) to a valid MongoDB connection string.",
    "For local dev use a .env.local file; for Vercel add the variable in Project Settings > Environment Variables.",
    `Current value: ${uri ? maskUri(uri) : "undefined"}`,
    `Example: ${sample}`,
  ].join(" "));
}

const options: MongoClientOptions = {};

let client: MongoClient;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
  // Log masked URI once to help debugging without exposing credentials
  // Useful when env differs between .env.local and .env or production
  // Keep this as info-level so developers can spot misconfiguration.
  // eslint-disable-next-line no-console
  console.info("Connecting to MongoDB using:", maskUri(uri));
}

const clientPromise = global._mongoClientPromise;

export async function getDb(dbName = process.env.MONGO_DB_NAME || "ajmeraexchange"): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export default clientPromise;

