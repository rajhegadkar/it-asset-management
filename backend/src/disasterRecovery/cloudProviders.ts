/**
 * Real off-site upload for backup archives (no mocks).
 * Uses Node's built-in fetch + crypto only, so no extra SDK dependencies are needed.
 *
 *  - AMAZON_S3 : AWS Signature V4. Works with AWS S3, Cloudflare R2, MinIO, Wasabi (set s3Endpoint).
 *  - WEBDAV    : HTTP PUT with Basic auth (Nextcloud, ownCloud, Synology, IIS WebDAV).
 *  - GOOGLE_DRIVE : Service-account JWT -> OAuth token -> multipart upload. The target folder must be
 *                   in a Shared Drive (or shared with the service account).
 *  - MICROSOFT_ONEDRIVE : OAuth refresh token -> Graph upload session (chunked, any size).
 */
import crypto from 'crypto';
import { CloudStorageConfig } from './types.js';

export interface UploadResult {
  success: boolean;
  message: string;
  url?: string;
  /** OneDrive rotates refresh tokens; the caller should persist this one. */
  newRefreshToken?: string;
}

const TIMEOUT_MS = 120_000;

async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs || TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function failText(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return `${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ''}`;
}

// ---------------------------------------------------------------- Amazon S3 (SigV4)

const sha256hex = (data: Buffer | string) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function s3Target(cfg: CloudStorageConfig, objectKey: string) {
  const region = cfg.s3Region || 'us-east-1';
  const bucket = cfg.s3Bucket || '';
  const keyPath = objectKey.split('/').map(rfc3986).join('/');
  if (cfg.s3Endpoint) {
    // Path-style for custom endpoints (MinIO / R2 / Wasabi)
    const base = new URL(cfg.s3Endpoint);
    const basePath = base.pathname.replace(/\/$/, '');
    return { url: `${base.protocol}//${base.host}${basePath}/${rfc3986(bucket)}/${keyPath}`, host: base.host, canonicalUri: `${basePath}/${rfc3986(bucket)}/${keyPath}`, region };
  }
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  return { url: `https://${host}/${keyPath}`, host, canonicalUri: `/${keyPath}`, region };
}

/** Builds SigV4 headers. Exported for unit testing against the AWS reference implementation. */
export function s3SignedHeaders(
  cfg: CloudStorageConfig,
  method: string,
  objectKey: string,
  body: Buffer,
  now = new Date(),
  extraHeaders: Record<string, string> = {}
) {
  const { host, canonicalUri, region, url } = s3Target(cfg, objectKey);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${cfg.s3SecretAccessKey || ''}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const out: Record<string, string> = { ...headers };
  delete out.host; // fetch sets Host from the URL
  out.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.s3AccessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url, headers: out };
}

function s3Key(cfg: CloudStorageConfig, filename: string) {
  const prefix = (cfg as any).s3Prefix ? String((cfg as any).s3Prefix).replace(/^\/+|\/+$/g, '') + '/' : 'itam-backups/';
  return `${prefix}${filename}`;
}

async function s3Put(cfg: CloudStorageConfig, filename: string, body: Buffer): Promise<UploadResult> {
  if (!cfg.s3Bucket || !cfg.s3AccessKeyId || !cfg.s3SecretAccessKey) {
    throw new Error('Amazon S3 needs a bucket, access key ID and secret access key.');
  }
  const key = s3Key(cfg, filename);
  const { url, headers } = s3SignedHeaders(cfg, 'PUT', key, body, new Date(), { 'content-type': 'application/octet-stream' });
  const res = await http(url, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`S3 upload failed: ${await failText(res)}`);
  return { success: true, message: `Backup uploaded to S3 bucket ${cfg.s3Bucket} as ${key}`, url: `s3://${cfg.s3Bucket}/${key}` };
}

async function s3Test(cfg: CloudStorageConfig): Promise<string> {
  const probe = Buffer.from(`itam connectivity test ${new Date().toISOString()}`);
  const name = `.itam-write-test-${Date.now()}.txt`;
  await s3Put(cfg, name, probe);
  // Clean up the probe object (ignore failures: the write itself proved access)
  try {
    const { url, headers } = s3SignedHeaders(cfg, 'DELETE', s3Key(cfg, name), Buffer.alloc(0));
    await http(url, { method: 'DELETE', headers, timeoutMs: 15000 });
  } catch {
    /* ignore */
  }
  return `Write access confirmed for S3 bucket ${cfg.s3Bucket} (${cfg.s3Endpoint || cfg.s3Region || 'us-east-1'}).`;
}

// ---------------------------------------------------------------- WebDAV

function davAuth(cfg: CloudStorageConfig) {
  return 'Basic ' + Buffer.from(`${cfg.webdavUsername || ''}:${cfg.webdavPassword || ''}`).toString('base64');
}

function davUrl(cfg: CloudStorageConfig, filename = '') {
  const base = (cfg.webdavUrl || '').replace(/\/+$/, '');
  return filename ? `${base}/${encodeURIComponent(filename)}` : `${base}/`;
}

async function webdavPut(cfg: CloudStorageConfig, filename: string, body: Buffer): Promise<UploadResult> {
  if (!cfg.webdavUrl) throw new Error('WebDAV server URL is required.');
  if (!/^https:\/\//i.test(cfg.webdavUrl) && process.env.NODE_ENV === 'production') {
    throw new Error('WebDAV URL must use https:// in production (credentials would be sent in clear text).');
  }
  const res = await http(davUrl(cfg, filename), {
    method: 'PUT',
    headers: { authorization: davAuth(cfg), 'content-type': 'application/octet-stream' },
    body,
  });
  if (!res.ok) throw new Error(`WebDAV upload failed: ${await failText(res)}`);
  return { success: true, message: `Backup uploaded to WebDAV (${cfg.webdavUrl})`, url: davUrl(cfg, filename) };
}

async function webdavTest(cfg: CloudStorageConfig): Promise<string> {
  if (!cfg.webdavUrl) throw new Error('WebDAV server URL is required.');
  const res = await http(davUrl(cfg), {
    method: 'PROPFIND',
    headers: { authorization: davAuth(cfg), depth: '0' },
    timeoutMs: 15000,
  });
  if (res.status !== 207 && !res.ok) throw new Error(`WebDAV folder not reachable: ${await failText(res)}`);
  const probe = `.itam-write-test-${Date.now()}.txt`;
  await webdavPut(cfg, probe, Buffer.from('itam connectivity test'));
  await http(davUrl(cfg, probe), { method: 'DELETE', headers: { authorization: davAuth(cfg) }, timeoutMs: 15000 }).catch(() => undefined);
  return `WebDAV folder reachable and writable: ${cfg.webdavUrl}`;
}

// ---------------------------------------------------------------- Google Drive

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function googleToken(cfg: CloudStorageConfig): Promise<string> {
  if (cfg.googleServiceAccountJson) {
    let sa: any;
    try {
      sa = JSON.parse(cfg.googleServiceAccountJson);
    } catch {
      throw new Error('Google service account JSON is not valid JSON.');
    }
    if (!sa.client_email || !sa.private_key) throw new Error('Service account JSON must contain client_email and private_key.');
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const iat = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: tokenUri, iat, exp: iat + 3600 }));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
    const res = await http(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      timeoutMs: 20000,
    });
    if (!res.ok) throw new Error(`Google sign-in failed: ${await failText(res)}`);
    return ((await res.json()) as any).access_token;
  }
  if (cfg.googleAccessToken) return cfg.googleAccessToken; // short-lived; fine for a manual test only
  throw new Error('Google Drive needs a service account JSON key.');
}

async function gdrivePut(cfg: CloudStorageConfig, filename: string, body: Buffer): Promise<UploadResult> {
  if (!cfg.googleDriveFolderId) throw new Error('Google Drive folder ID is required.');
  const token = await googleToken(cfg);
  const boundary = `itam${crypto.randomBytes(8).toString('hex')}`;
  const meta = JSON.stringify({ name: filename, parents: [cfg.googleDriveFolderId] });
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await http('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Google Drive upload failed: ${await failText(res)}`);
  const json: any = await res.json();
  return { success: true, message: `Backup uploaded to Google Drive (file id ${json.id})`, url: json.webViewLink };
}

async function gdriveTest(cfg: CloudStorageConfig): Promise<string> {
  if (!cfg.googleDriveFolderId) throw new Error('Google Drive folder ID is required.');
  const token = await googleToken(cfg);
  const res = await http(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cfg.googleDriveFolderId)}?supportsAllDrives=true&fields=id,name,capabilities/canAddChildren`, {
    headers: { authorization: `Bearer ${token}` },
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`Google Drive folder not accessible: ${await failText(res)}`);
  const json: any = await res.json();
  if (json.capabilities && json.capabilities.canAddChildren === false) throw new Error(`Folder "${json.name}" is read-only for this service account.`);
  return `Google Drive folder "${json.name}" is reachable and writable.`;
}

// ---------------------------------------------------------------- Microsoft OneDrive / SharePoint

async function oneDriveToken(cfg: CloudStorageConfig): Promise<{ accessToken: string; refreshToken?: string }> {
  if (!cfg.oneDriveClientId || !cfg.oneDriveRefreshToken) {
    throw new Error('OneDrive needs an app (client) ID and a refresh token from an admin sign-in.');
  }
  const tenant = cfg.oneDriveTenantId || 'common';
  const form = new URLSearchParams({
    client_id: cfg.oneDriveClientId,
    grant_type: 'refresh_token',
    refresh_token: cfg.oneDriveRefreshToken,
    scope: 'offline_access Files.ReadWrite',
  });
  if (cfg.oneDriveClientSecret) form.set('client_secret', cfg.oneDriveClientSecret);
  const res = await http(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`Microsoft sign-in failed: ${await failText(res)}`);
  const json: any = await res.json();
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

function oneDrivePath(cfg: CloudStorageConfig, filename: string) {
  const folder = (cfg.oneDriveFolder || '/ITAM_Backups').replace(/^\/+|\/+$/g, '');
  return [folder, filename].filter(Boolean).map((seg) => seg.split('/').map(encodeURIComponent).join('/')).join('/');
}

async function oneDrivePut(cfg: CloudStorageConfig, filename: string, body: Buffer): Promise<UploadResult> {
  const { accessToken, refreshToken } = await oneDriveToken(cfg);
  const session = await http(`https://graph.microsoft.com/v1.0/me/drive/root:/${oneDrivePath(cfg, filename)}:/createUploadSession`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    timeoutMs: 20000,
  });
  if (!session.ok) throw new Error(`OneDrive upload session failed: ${await failText(session)}`);
  const { uploadUrl } = (await session.json()) as any;

  const CHUNK = 320 * 1024 * 16; // 5 MiB, a multiple of 320 KiB as Graph requires
  let last: Response | null = null;
  for (let start = 0; start < body.length || (body.length === 0 && start === 0); start += CHUNK) {
    const end = Math.min(start + CHUNK, body.length);
    const chunk = body.subarray(start, end);
    last = await http(uploadUrl, {
      method: 'PUT',
      headers: { 'content-length': String(chunk.length), 'content-range': `bytes ${start}-${Math.max(end - 1, 0)}/${body.length}` },
      body: chunk,
    });
    if (!last.ok && last.status !== 202) throw new Error(`OneDrive chunk upload failed: ${await failText(last)}`);
    if (body.length === 0) break;
  }
  const item: any = last ? await last.json().catch(() => ({})) : {};
  return { success: true, message: `Backup uploaded to OneDrive (${cfg.oneDriveFolder || '/ITAM_Backups'})`, url: item.webUrl, newRefreshToken: refreshToken };
}

async function oneDriveTest(cfg: CloudStorageConfig): Promise<{ message: string; newRefreshToken?: string }> {
  const { accessToken, refreshToken } = await oneDriveToken(cfg);
  const res = await http('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,quota', {
    headers: { authorization: `Bearer ${accessToken}` },
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`OneDrive not accessible: ${await failText(res)}`);
  return { message: 'Signed in to Microsoft 365 and OneDrive is reachable.', newRefreshToken: refreshToken };
}

// ---------------------------------------------------------------- dispatch

export const CloudProviders = {
  async upload(cfg: CloudStorageConfig, filename: string, body: Buffer): Promise<UploadResult> {
    switch (cfg.provider) {
      case 'AMAZON_S3':
        return s3Put(cfg, filename, body);
      case 'WEBDAV':
        return webdavPut(cfg, filename, body);
      case 'GOOGLE_DRIVE':
        return gdrivePut(cfg, filename, body);
      case 'MICROSOFT_ONEDRIVE':
        return oneDrivePut(cfg, filename, body);
      default:
        throw new Error(`Unsupported cloud provider: ${cfg.provider}`);
    }
  },

  async test(cfg: CloudStorageConfig): Promise<{ message: string; newRefreshToken?: string }> {
    switch (cfg.provider) {
      case 'AMAZON_S3':
        return { message: await s3Test(cfg) };
      case 'WEBDAV':
        return { message: await webdavTest(cfg) };
      case 'GOOGLE_DRIVE':
        return { message: await gdriveTest(cfg) };
      case 'MICROSOFT_ONEDRIVE':
        return oneDriveTest(cfg);
      default:
        throw new Error(`Unsupported cloud provider: ${cfg.provider}`);
    }
  },
};
