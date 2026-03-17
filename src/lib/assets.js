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

export function validateAssets(rawAssets, options = {}) {
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const thumbnailExists =
    options.thumbnailExists ?? ((thumbnail) => defaultThumbnailExists(projectRoot, thumbnail));

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

    const id = isNonEmptyString(asset.id) ? asset.id.trim() : '';
    const title = isNonEmptyString(asset.title) ? asset.title.trim() : '';
    const author = isNonEmptyString(asset.author) ? asset.author.trim() : '';
    const thumbnail = normalizeThumbnail(asset.thumbnail);
    const downloadUrl = isNonEmptyString(asset.download_url) ? asset.download_url.trim() : '';
    const rawTags = Array.isArray(asset.tags) ? asset.tags : [];
    const tags = rawTags.filter((tag) => isNonEmptyString(tag)).map((tag) => tag.trim());

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
      issues.push(`${prefix} is missing a non-empty \`download_url\`.`);
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
      download_note: normalizeOptionalText(asset.download_note),
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

  return validateAssets(rawAssets, { projectRoot });
}

export function getAllTags(assets = loadAssets()) {
  return [...new Set(assets.flatMap((asset) => asset.tags))];
}
