import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const defaultProjectRoot = process.cwd();

export class AssetValidationError extends Error {
  constructor(issues) {
    super(`Asset validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'AssetValidationError';
    this.issues = issues;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalText(value) {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeRequiredText(value) {
  return isNonEmptyString(value) ? value.trim() : '';
}

function normalizeThumbnail(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const raw = value.trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(raw)) {
    return null;
  }

  const withoutLeadingSlash = raw.replace(/^\/+/, '');
  if (!withoutLeadingSlash || withoutLeadingSlash.split('/').includes('..')) {
    return null;
  }

  return `/${withoutLeadingSlash}`;
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function defaultThumbnailExists(projectRoot, thumbnail) {
  const relativePath = thumbnail.replace(/^\/+/, '');
  return existsSync(path.resolve(projectRoot, 'public', relativePath));
}

function normalizeAssetKey(value) {
  return normalizeRequiredText(value).toLowerCase();
}

function parseDownloadLinksFile(rawText) {
  const blocks = rawText
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const links = new Map();

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const titleMatch = lines[0]?.match(/^\d+\.\s*(.+)$/);
    const urlLine = lines.find((line) => line.startsWith('链接：'));
    const codeLine = lines.find((line) => line.startsWith('提取码：'));

    if (!titleMatch || !urlLine) {
      continue;
    }

    const rawName = titleMatch[1].trim();
    const assetKey = normalizeAssetKey(rawName.replace(/\.[^.]+$/, ''));
    const url = urlLine.replace(/^链接：/, '').trim();
    const code = codeLine?.replace(/^提取码：/, '').trim() ?? '';

    if (!assetKey || !url) {
      continue;
    }

    links.set(assetKey, { url, code });
  }

  return links;
}

function loadDownloadLinks(projectRoot) {
  const downloadLinksPath = path.resolve(projectRoot, 'download_link.txt');

  if (!existsSync(downloadLinksPath)) {
    return new Map();
  }

  return parseDownloadLinksFile(readFileSync(downloadLinksPath, 'utf8'));
}

function mergeDownloadNote(note, code) {
  const segments = [];

  if (isNonEmptyString(code)) {
    segments.push(`提取码：${code.trim()}`);
  }

  if (isNonEmptyString(note)) {
    segments.push(note.trim());
  }

  return segments.length > 0 ? segments.join(' · ') : undefined;
}

export function validateAssets(rawAssets, options = {}) {
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const thumbnailExists =
    options.thumbnailExists ?? ((thumbnail) => defaultThumbnailExists(projectRoot, thumbnail));
  const downloadLinks = options.downloadLinks ?? new Map();

  if (!Array.isArray(rawAssets)) {
    throw new AssetValidationError(['`assets.json` must export a JSON array.']);
  }

  const issues = [];
  const seenIds = new Set();
  const normalizedAssets = rawAssets.map((asset, index) => {
    const prefix = `Item ${index + 1}`;

    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
      issues.push(`${prefix} must be a JSON object.`);
      return null;
    }

    const id = normalizeRequiredText(asset.id);
    const title = normalizeRequiredText(asset.title);
    const author = normalizeRequiredText(asset.author);
    const thumbnail = normalizeThumbnail(asset.thumbnail);
    const assetKey = normalizeAssetKey(id);
    const overrideDownloadUrl = downloadLinks.get(assetKey)?.url ?? '';
    const inlineDownloadUrl = normalizeRequiredText(asset.download_url);
    const aliasDownloadUrl = normalizeRequiredText(asset.download_link);
    const downloadUrl = overrideDownloadUrl || inlineDownloadUrl || aliasDownloadUrl;
    const rawTags = Array.isArray(asset.tags) ? asset.tags : [];
    const tags = rawTags.filter((tag) => isNonEmptyString(tag)).map((tag) => tag.trim());
    const downloadNote = mergeDownloadNote(asset.download_note, downloadLinks.get(assetKey)?.code);

    if (!id) {
      issues.push(`${prefix} is missing a non-empty \`id\`.`);
    } else if (seenIds.has(id)) {
      issues.push(`${prefix} uses duplicate id "${id}".`);
    } else {
      seenIds.add(id);
    }

    if (!title) {
      issues.push(`${prefix} is missing a non-empty \`title\`.`);
    }

    if (!author) {
      issues.push(`${prefix} is missing a non-empty \`author\`.`);
    }

    if (tags.length === 0) {
      issues.push(`${prefix} must include at least one non-empty tag.`);
    }

    if (!thumbnail) {
      issues.push(
        `${prefix} must use a local thumbnail path under \`public/\`, not an external URL or empty string.`
      );
    } else if (!thumbnailExists(thumbnail)) {
      issues.push(`${prefix} references missing thumbnail "${thumbnail}".`);
    }

    if (!downloadUrl) {
      issues.push(`${prefix} is missing a non-empty \`download_url\` or \`download_link\`.`);
    } else if (!isHttpsUrl(downloadUrl)) {
      issues.push(`${prefix} must use a valid https download link.`);
    }

    return {
      id,
      title,
      author,
      tags,
      thumbnail: thumbnail ?? '',
      download_url: downloadUrl,
      summary: normalizeOptionalText(asset.summary),
      description: normalizeOptionalText(asset.description),
      source: normalizeOptionalText(asset.source),
      download_note: downloadNote,
      preview_model: normalizeOptionalText(asset.preview_model)
    };
  });

  if (issues.length > 0) {
    throw new AssetValidationError(issues);
  }

  return normalizedAssets;
}

export function loadAssets(options = {}) {
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const dataPath = options.dataPath ?? path.resolve(projectRoot, 'src', 'data', 'assets.json');

  let rawAssets;

  try {
    rawAssets = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AssetValidationError([`Unable to parse assets data at "${dataPath}": ${message}`]);
  }

  return validateAssets(rawAssets, {
    projectRoot,
    downloadLinks: loadDownloadLinks(projectRoot)
  });
}

export function getAllTags(assets = loadAssets()) {
  return [...new Set(assets.flatMap((asset) => asset.tags))];
}
