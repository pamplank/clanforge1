// scripts/migrate-auction-images-bucket.js
//
// One-off migration script: copies every file in the "auction-images"
// storage bucket from the old Supabase project to the same bucket in the
// new "Redted" Supabase project, preserving folder structure / file names.
//
// Usage:
//   SOURCE_SUPABASE_URL=... \
//   SOURCE_SUPABASE_SERVICE_ROLE_KEY=... \
//   TARGET_SUPABASE_URL=... \
//   TARGET_SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/migrate-auction-images-bucket.js
//
// Optional env vars:
//   BUCKET_NAME        - defaults to "auction-images"
//   MIGRATE_CONCURRENCY - how many files to transfer at once (default 5)
//   DRY_RUN=1          - list what would be copied without downloading/uploading
//
// Requires the "@supabase/supabase-js" package:
//   npm install @supabase/supabase-js
//
// Service role keys are required (not anon keys) because listing/reading
// every object in the bucket and writing into the destination bucket both
// need to bypass row-level/storage policies.

import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = process.env.BUCKET_NAME || "auction-images";
const CONCURRENCY = Number(process.env.MIGRATE_CONCURRENCY) || 5;
const DRY_RUN = process.env.DRY_RUN === "1";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        "Set SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY, " +
        "TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY before running this script."
    );
  }
  return value;
}

function buildClient(urlEnv, keyEnv) {
  const url = requireEnv(urlEnv);
  const key = requireEnv(keyEnv);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Supabase Storage's `.list()` only returns one directory level at a time.
// Folders show up as entries with `id === null`, so we recurse into those
// to build a flat list of every actual file path in the bucket.
async function listAllFiles(client, bucket, prefix = "") {
  const files = [];
  const pageSize = 100;
  let page = 0;

  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Failed to list "${prefix || "/"}" in bucket "${bucket}": ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      // Folders (a.k.a. "placeholder" objects) have no id/metadata.
      const isFolder = entry.id === null && !entry.metadata;
      if (isFolder) {
        const nested = await listAllFiles(client, bucket, fullPath);
        files.push(...nested);
      } else {
        files.push(fullPath);
      }
    }

    if (data.length < pageSize) break;
    page += 1;
  }

  return files;
}

async function copyFile(sourceClient, targetClient, path) {
  const { data: blob, error: downloadError } = await sourceClient.storage
    .from(BUCKET_NAME)
    .download(path);

  if (downloadError) {
    throw new Error(`Download failed for "${path}": ${downloadError.message}`);
  }

  const arrayBuffer = await blob.arrayBuffer();
  const contentType = blob.type || "application/octet-stream";

  const { error: uploadError } = await targetClient.storage
    .from(BUCKET_NAME)
    .upload(path, Buffer.from(arrayBuffer), {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed for "${path}": ${uploadError.message}`);
  }
}

// Simple fixed-size worker pool so we don't blast either project with
// hundreds of simultaneous requests, but still transfer several files
// in parallel.
async function runWithConcurrency(items, concurrency, worker) {
  const results = { succeeded: [], failed: [] };
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      try {
        await worker(item, index);
        results.succeeded.push(item);
      } catch (err) {
        results.failed.push({ item, error: err.message || String(err) });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`Migrating bucket "${BUCKET_NAME}"${DRY_RUN ? " (dry run)" : ""}...`);

  const sourceClient = buildClient("SOURCE_SUPABASE_URL", "SOURCE_SUPABASE_SERVICE_ROLE_KEY");
  const targetClient = buildClient("TARGET_SUPABASE_URL", "TARGET_SUPABASE_SERVICE_ROLE_KEY");

  console.log("Listing files in source bucket...");
  const files = await listAllFiles(sourceClient, BUCKET_NAME);
  console.log(`Found ${files.length} file(s) to copy.`);

  if (files.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    for (const path of files) console.log(`  would copy: ${path}`);
    return;
  }

  let completed = 0;
  const { succeeded, failed } = await runWithConcurrency(files, CONCURRENCY, async (path) => {
    await copyFile(sourceClient, targetClient, path);
    completed += 1;
    console.log(`[${completed}/${files.length}] copied ${path}`);
  });

  console.log("\n--- Migration summary ---");
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed:    ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const { item, error } of failed) {
      console.log(`  ${item}: ${error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Migration aborted:", err.message || err);
  process.exitCode = 1;
});
