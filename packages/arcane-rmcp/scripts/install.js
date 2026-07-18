#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { binaryPath, downloadUrl, installRoot, releaseVersion, targetFor } = require("../lib/platform");

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 5;

function log(message) {
  process.stderr.write(`rarcane: ${message}\n`);
}

function validateUrl(url, options = {}) {
  const parsed = new URL(url);
  const allowHttp = options.allowInsecureHttp || process.env.ARCANE_RMCP_ALLOW_INSECURE_HTTP === "1";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    throw new Error(`refusing non-HTTPS download URL: ${url}`);
  }
  return parsed;
}

function download(url, destination, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const redirects = options.redirects || 0;
  const parsed = validateUrl(url, options);

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === "http:" ? http : https;
    const request = client.get(parsed, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error(`too many redirects downloading ${url}`));
          return;
        }
        if (!response.headers.location) {
          reject(new Error(`redirect from ${url} did not include Location`));
          return;
        }
        const redirected = new URL(response.headers.location, parsed);
        if (parsed.protocol === "https:" && redirected.protocol !== "https:") {
          reject(new Error(`refusing HTTPS downgrade redirect to ${redirected}`));
          return;
        }
        download(redirected.href, destination, { ...options, redirects: redirects + 1 }).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`download failed (${response.statusCode}) from ${url}`));
        return;
      }

      const partial = `${destination}.partial-${process.pid}`;
      const file = fs.createWriteStream(partial, { mode: 0o600 });
      const fail = (error) => {
        file.destroy();
        fs.rmSync(partial, { force: true });
        reject(error);
      };
      response.on("error", fail);
      file.on("error", fail);
      file.on("finish", () => file.close(() => {
        fs.renameSync(partial, destination);
        resolve();
      }));
      response.pipe(file);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`download timed out after ${timeoutMs}ms`)));
    request.on("error", (error) => {
      fs.rmSync(`${destination}.partial-${process.pid}`, { force: true });
      reject(error);
    });
  });
}

function verifyChecksum(archive, checksumFile) {
  const fields = fs.readFileSync(checksumFile, "utf8").trim().split(/\s+/);
  const expected = fields[0];
  const listed = (fields[1] || "").replace(/^\*/, "");
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new Error("checksum file is invalid");
  if (listed && listed !== path.basename(archive)) throw new Error(`checksum names unexpected asset ${listed}`);
  const actual = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error("checksum verification failed");
}

function runTar(args) {
  const result = spawnSync("tar", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "tar failed").trim());
  return result.stdout;
}

function inspectArchive(archive, expectedEntry) {
  const entries = runTar(["-tzf", archive]).trim().split(/\r?\n/).filter(Boolean);
  if (entries.length !== 1 || entries[0] !== expectedEntry || path.basename(entries[0]) !== entries[0]) {
    throw new Error(`archive must contain exactly ${expectedEntry} and no paths`);
  }
  const verbose = runTar(["-tvzf", archive]).trim();
  if (!verbose.startsWith("-")) throw new Error("archive entry is not a regular file");
}

function extractVerifiedBinary(archive, destination, expectedEntry) {
  inspectArchive(archive, expectedEntry);
  fs.mkdirSync(destination, { recursive: true });
  runTar(["-xzf", archive, "-C", destination, "--no-same-owner", "--no-same-permissions", "--", expectedEntry]);
  const extracted = path.join(destination, expectedEntry);
  const stat = fs.lstatSync(extracted);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("extracted binary is not a regular file");
  return extracted;
}

function installBinary(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staged = path.join(path.dirname(destination), `.${path.basename(destination)}.tmp-${process.pid}`);
  fs.copyFileSync(source, staged);
  fs.chmodSync(staged, 0o755);
  fs.renameSync(staged, destination);
}

async function main() {
  if (process.env.ARCANE_RMCP_SKIP_DOWNLOAD === "1") {
    log("skipping binary download because ARCANE_RMCP_SKIP_DOWNLOAD=1");
    return;
  }
  const target = targetFor();
  const destination = binaryPath();
  if (fs.existsSync(destination)) {
    log(`${path.basename(destination)} already installed for ${releaseVersion()}`);
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rarcane-install-"));
  const archive = path.join(tempDir, target.asset);
  const checksum = `${archive}.sha256`;
  const extractedDir = path.join(tempDir, "verified");
  const expectedEntry = process.platform === "win32" ? "rarcane.exe" : "rarcane";
  try {
    const url = downloadUrl(target);
    log(`downloading ${url}`);
    await download(url, archive);
    await download(`${url}.sha256`, checksum);
    verifyChecksum(archive, checksum);
    const extracted = extractVerifiedBinary(archive, extractedDir, expectedEntry);
    installBinary(extracted, destination || path.join(installRoot(), expectedEntry));
    log(`installed ${destination}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { download, extractVerifiedBinary, inspectArchive, installBinary, validateUrl, verifyChecksum };

if (require.main === module) {
  main().catch((error) => {
    log(error.message);
    process.exitCode = 1;
  });
}
