/**
 * One-time migration script to move existing BunnyCDN files
 * from flat storage to the new user-folder structure.
 *
 * Usage: POST /api/migrate-cdn?secret=YOUR_SECRET
 *        POST /api/migrate-cdn?secret=YOUR_SECRET&dryRun=true   (preview only)
 *        POST /api/migrate-cdn?secret=YOUR_SECRET&table=customer (single table)
 *
 * Tables: customer, model, images, banks, transactions, posts
 */

import type { ActionFunctionArgs } from "react-router";
import { prisma } from "~/services/database.server";
import { getUserUploadPath, type UploadFileType } from "~/services/upload.server";

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || "migrate-cdn-2026";

const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "";
const API_KEY = process.env.BUNNY_API_KEY || "";
const BASE_HOSTNAME = process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";
const CDN_HOST = process.env.BUNNY_CDN_HOST || `https://${STORAGE_ZONE}.b-cdn.net`;

interface MigrationResult {
  table: string;
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Check if a URL is already in the new folder structure.
 * New structure URLs contain patterns like: /m-{id}-{name}/ or /c-{id}-{name}/
 */
function isAlreadyMigrated(url: string): boolean {
  if (!url) return true;
  return /\/[mc]-[a-f0-9]{24}-[a-z0-9]+\//.test(url);
}

/**
 * Extract the old file path from a CDN URL (everything after the CDN host).
 */
function extractPathFromUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.pathname.substring(1); // remove leading /
  } catch {
    return url;
  }
}

/**
 * Download a file from BunnyCDN storage API (not CDN cache).
 */
async function downloadFromBunny(filePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${filePath}`;
  try {
    const response = await fetch(endpoint, {
      headers: { AccessKey: API_KEY },
    });
    if (!response.ok) {
      console.error(`[Migration] Download failed: ${filePath} (${response.status})`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    console.error(`[Migration] Download error: ${filePath}`, error);
    return null;
  }
}

/**
 * Upload a file to the new path in BunnyCDN.
 */
async function uploadToBunny(buffer: Buffer, newPath: string, contentType: string): Promise<boolean> {
  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${newPath}`;
  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        AccessKey: API_KEY,
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });
    return response.ok;
  } catch (error) {
    console.error(`[Migration] Upload error: ${newPath}`, error);
    return false;
  }
}

/**
 * Delete old file from BunnyCDN.
 */
async function deleteFromBunny(filePath: string): Promise<boolean> {
  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${filePath}`;
  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { AccessKey: API_KEY },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get file extension from path.
 */
function getExtFromPath(path: string): string {
  const match = path.match(/\.(\w+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

/**
 * Migrate a single file: download → upload to new path → return new URL.
 */
async function migrateFile(
  oldUrl: string,
  folderPath: string,
  filePrefix: string,
  dryRun: boolean
): Promise<string | null> {
  const oldPath = extractPathFromUrl(oldUrl);
  if (!oldPath) return null;

  const ext = getExtFromPath(oldPath);
  const timestamp = Date.now() + Math.floor(Math.random() * 1000); // avoid collisions
  const newFileName = `${filePrefix}-${timestamp}.${ext}`;
  const newPath = `${folderPath}/${newFileName}`;
  const newUrl = `${CDN_HOST}/${newPath}`;

  if (dryRun) {
    console.log(`[DRY RUN] ${oldPath} → ${newPath}`);
    return newUrl;
  }

  // Download
  const file = await downloadFromBunny(oldPath);
  if (!file) return null;

  // Upload to new path
  const uploaded = await uploadToBunny(file.buffer, newPath, file.contentType);
  if (!uploaded) return null;

  // Delete old file (non-blocking)
  deleteFromBunny(oldPath).catch(() => {});

  console.log(`[Migration] ✓ ${oldPath} → ${newPath}`);
  return newUrl;
}

// ─── Table migration functions ───────────────────────────────────────────────

async function migrateCustomerProfiles(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "customer.profile", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const customers = await prisma.customer.findMany({
    where: { profile: { not: "" } },
    select: { id: true, firstName: true, whatsapp: true, profile: true },
  });
  result.total = customers.length;

  for (const customer of customers) {
    if (!customer.profile || isAlreadyMigrated(customer.profile)) {
      result.skipped++;
      continue;
    }
    try {
      const folderPath = getUserUploadPath("customer", customer.id, customer.firstName || "user", "avatar", customer.whatsapp ?? undefined);
      const newUrl = await migrateFile(customer.profile, folderPath, "avatar", dryRun);
      if (newUrl) {
        if (!dryRun) {
          await prisma.customer.update({ where: { id: customer.id }, data: { profile: newUrl } });
        }
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`customer ${customer.id}: download/upload failed`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`customer ${customer.id}: ${e.message}`);
    }
  }
  return result;
}

async function migrateModelProfiles(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "model.profile", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const models = await prisma.model.findMany({
    where: { profile: { not: "" } },
    select: { id: true, firstName: true, whatsapp: true, profile: true },
  });
  result.total = models.length;

  for (const model of models) {
    if (!model.profile || isAlreadyMigrated(model.profile)) {
      result.skipped++;
      continue;
    }
    try {
      const folderPath = getUserUploadPath("model", model.id, model.firstName || "user", "avatar", model.whatsapp ?? undefined);
      const newUrl = await migrateFile(model.profile, folderPath, "avatar", dryRun);
      if (newUrl) {
        if (!dryRun) {
          await prisma.model.update({ where: { id: model.id }, data: { profile: newUrl } });
        }
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`model ${model.id}: download/upload failed`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`model ${model.id}: ${e.message}`);
    }
  }
  return result;
}

async function migrateImages(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "images", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const images = await prisma.images.findMany({
    select: { id: true, name: true, modelId: true, customerId: true },
  });
  result.total = images.length;

  // Batch fetch user info
  const modelIds = [...new Set(images.filter(i => i.modelId).map(i => i.modelId!))];
  const customerIds = [...new Set(images.filter(i => i.customerId).map(i => i.customerId!))];

  const modelsMap = new Map<string, { name: string; whatsapp?: number }>();
  const customersMap = new Map<string, { name: string; whatsapp?: number }>();

  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, firstName: true, whatsapp: true } });
    models.forEach(m => modelsMap.set(m.id, { name: m.firstName || "user", whatsapp: m.whatsapp ?? undefined }));
  }
  if (customerIds.length > 0) {
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, whatsapp: true } });
    customers.forEach(c => customersMap.set(c.id, { name: c.firstName || "user", whatsapp: c.whatsapp ?? undefined }));
  }

  for (const image of images) {
    if (!image.name || isAlreadyMigrated(image.name)) {
      result.skipped++;
      continue;
    }
    try {
      let folderPath: string;
      if (image.modelId) {
        const info = modelsMap.get(image.modelId) || { name: "user" };
        folderPath = getUserUploadPath("model", image.modelId, info.name, "gallery", info.whatsapp);
      } else if (image.customerId) {
        const info = customersMap.get(image.customerId) || { name: "user" };
        folderPath = getUserUploadPath("customer", image.customerId, info.name, "gallery", info.whatsapp);
      } else {
        result.skipped++;
        continue;
      }

      const newUrl = await migrateFile(image.name, folderPath, "gallery", dryRun);
      if (newUrl) {
        if (!dryRun) {
          await prisma.images.update({ where: { id: image.id }, data: { name: newUrl } });
        }
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`image ${image.id}: download/upload failed`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`image ${image.id}: ${e.message}`);
    }
  }
  return result;
}

async function migrateBankQR(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "banks.qr_code", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const banks = await prisma.banks.findMany({
    where: { qr_code: { not: "" } },
    select: { id: true, qr_code: true, modelId: true },
  });
  result.total = banks.length;

  // Batch fetch model info
  const modelIds = [...new Set(banks.filter(b => b.modelId).map(b => b.modelId!))];
  const modelsMap = new Map<string, { name: string; whatsapp?: number }>();
  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, firstName: true, whatsapp: true } });
    models.forEach(m => modelsMap.set(m.id, { name: m.firstName || "user", whatsapp: m.whatsapp ?? undefined }));
  }

  for (const bank of banks) {
    if (!bank.qr_code || isAlreadyMigrated(bank.qr_code) || !bank.modelId) {
      result.skipped++;
      continue;
    }
    try {
      const info = modelsMap.get(bank.modelId) || { name: "user" };
      const folderPath = getUserUploadPath("model", bank.modelId, info.name, "qr", info.whatsapp);
      const newUrl = await migrateFile(bank.qr_code, folderPath, "qr", dryRun);
      if (newUrl) {
        if (!dryRun) {
          await prisma.banks.update({ where: { id: bank.id }, data: { qr_code: newUrl } });
        }
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`bank ${bank.id}: download/upload failed`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`bank ${bank.id}: ${e.message}`);
    }
  }
  return result;
}

async function migrateTransactions(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "transaction_history.paymentSlip", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const transactions = await prisma.transaction_history.findMany({
    where: { paymentSlip: { isEmpty: false } },
    select: { id: true, paymentSlip: true, customerId: true, modelId: true },
  });
  result.total = transactions.length;

  // Batch fetch user info
  const modelIds = [...new Set(transactions.filter(t => t.modelId).map(t => t.modelId!))];
  const customerIds = [...new Set(transactions.filter(t => t.customerId).map(t => t.customerId!))];

  const modelsMap = new Map<string, { name: string; whatsapp?: number }>();
  const customersMap = new Map<string, { name: string; whatsapp?: number }>();

  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, firstName: true, whatsapp: true } });
    models.forEach(m => modelsMap.set(m.id, { name: m.firstName || "user", whatsapp: m.whatsapp ?? undefined }));
  }
  if (customerIds.length > 0) {
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, whatsapp: true } });
    customers.forEach(c => customersMap.set(c.id, { name: c.firstName || "user", whatsapp: c.whatsapp ?? undefined }));
  }

  for (const tx of transactions) {
    const slips = tx.paymentSlip || [];
    if (slips.length === 0 || slips.every(s => isAlreadyMigrated(s))) {
      result.skipped++;
      continue;
    }
    try {
      let folderPath: string;
      if (tx.customerId) {
        const info = customersMap.get(tx.customerId) || { name: "user" };
        folderPath = getUserUploadPath("customer", tx.customerId, info.name, "slip", info.whatsapp);
      } else if (tx.modelId) {
        const info = modelsMap.get(tx.modelId) || { name: "user" };
        folderPath = getUserUploadPath("model", tx.modelId, info.name, "slip", info.whatsapp);
      } else {
        result.skipped++;
        continue;
      }

      const newSlips: string[] = [];
      let allOk = true;
      for (const slip of slips) {
        if (isAlreadyMigrated(slip)) {
          newSlips.push(slip);
          continue;
        }
        const newUrl = await migrateFile(slip, folderPath, "slip", dryRun);
        if (newUrl) {
          newSlips.push(newUrl);
        } else {
          newSlips.push(slip); // keep old URL if migration fails
          allOk = false;
        }
      }

      if (!dryRun) {
        await prisma.transaction_history.update({ where: { id: tx.id }, data: { paymentSlip: newSlips } });
      }

      if (allOk) {
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`transaction ${tx.id}: partial migration`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`transaction ${tx.id}: ${e.message}`);
    }
  }
  return result;
}

async function migratePosts(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = { table: "post.images", total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const posts = await prisma.post.findMany({
    where: { images: { isEmpty: false } },
    select: { id: true, images: true, modelId: true, customerId: true, authorType: true },
  });
  result.total = posts.length;

  // Batch fetch user info
  const modelIds = [...new Set(posts.filter(p => p.modelId).map(p => p.modelId!))];
  const customerIds = [...new Set(posts.filter(p => p.customerId).map(p => p.customerId!))];

  const modelsMap = new Map<string, { name: string; whatsapp?: number }>();
  const customersMap = new Map<string, { name: string; whatsapp?: number }>();

  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, firstName: true, whatsapp: true } });
    models.forEach(m => modelsMap.set(m.id, { name: m.firstName || "user", whatsapp: m.whatsapp ?? undefined }));
  }
  if (customerIds.length > 0) {
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, whatsapp: true } });
    customers.forEach(c => customersMap.set(c.id, { name: c.firstName || "user", whatsapp: c.whatsapp ?? undefined }));
  }

  for (const post of posts) {
    const imgs = post.images || [];
    if (imgs.length === 0 || imgs.every(i => isAlreadyMigrated(i))) {
      result.skipped++;
      continue;
    }
    try {
      let folderPath: string;
      if (post.authorType === "model" && post.modelId) {
        const info = modelsMap.get(post.modelId) || { name: "user" };
        folderPath = getUserUploadPath("model", post.modelId, info.name, "post", info.whatsapp);
      } else if (post.customerId) {
        const info = customersMap.get(post.customerId) || { name: "user" };
        folderPath = getUserUploadPath("customer", post.customerId, info.name, "post", info.whatsapp);
      } else {
        result.skipped++;
        continue;
      }

      const newImgs: string[] = [];
      let allOk = true;
      for (const img of imgs) {
        if (isAlreadyMigrated(img)) {
          newImgs.push(img);
          continue;
        }
        const newUrl = await migrateFile(img, folderPath, "post", dryRun);
        if (newUrl) {
          newImgs.push(newUrl);
        } else {
          newImgs.push(img);
          allOk = false;
        }
      }

      if (!dryRun) {
        await prisma.post.update({ where: { id: post.id }, data: { images: newImgs } });
      }

      if (allOk) {
        result.migrated++;
      } else {
        result.failed++;
        result.errors.push(`post ${post.id}: partial migration`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`post ${post.id}: ${e.message}`);
    }
  }
  return result;
}

// ─── Main action ─────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (secret !== MIGRATION_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "true";
  const tableFilter = url.searchParams.get("table"); // optional: run specific table only

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[Migration] Starting CDN migration | dryRun=${dryRun} | table=${tableFilter || "all"}`);
  console.log(`${"=".repeat(60)}\n`);

  const results: MigrationResult[] = [];

  const tableFns: Record<string, () => Promise<MigrationResult>> = {
    customer: () => migrateCustomerProfiles(dryRun),
    model: () => migrateModelProfiles(dryRun),
    images: () => migrateImages(dryRun),
    banks: () => migrateBankQR(dryRun),
    transactions: () => migrateTransactions(dryRun),
    posts: () => migratePosts(dryRun),
  };

  const tablesToRun = tableFilter ? [tableFilter] : Object.keys(tableFns);

  for (const table of tablesToRun) {
    const fn = tableFns[table];
    if (!fn) {
      results.push({ table, total: 0, migrated: 0, skipped: 0, failed: 0, errors: [`Unknown table: ${table}`] });
      continue;
    }
    console.log(`\n--- Migrating: ${table} ---`);
    const tableResult = await fn();
    results.push(tableResult);
    console.log(`[${table}] total=${tableResult.total} migrated=${tableResult.migrated} skipped=${tableResult.skipped} failed=${tableResult.failed}`);
  }

  const summary = {
    dryRun,
    totalRecords: results.reduce((s, r) => s + r.total, 0),
    totalMigrated: results.reduce((s, r) => s + r.migrated, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
    tables: results,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[Migration] Complete | migrated=${summary.totalMigrated} skipped=${summary.totalSkipped} failed=${summary.totalFailed}`);
  console.log(`${"=".repeat(60)}\n`);

  return Response.json(summary);
}
