import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AssetValidationError, loadAssets, validateAssets } from '../src/lib/assets.js';

const validAsset = {
  id: 'scene-001',
  title: '赛博朋克小巷',
  author: 'GS-Hub Demo',
  tags: ['城市', '夜景'],
  thumbnail: '/thumbnails/scene-001.svg',
  download_url: 'https://pan.baidu.com/s/1gs-hub-demo',
  summary: '测试素材'
};

function createTempProject(assets, { withThumbnail = true, downloadLinkText } = {}) {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'gs-hub-'));
  const dataDir = path.join(projectRoot, 'src', 'data');
  const thumbDir = path.join(projectRoot, 'public', 'thumbnails');

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(thumbDir, { recursive: true });
  writeFileSync(path.join(dataDir, 'assets.json'), JSON.stringify(assets, null, 2));

  if (withThumbnail) {
    writeFileSync(path.join(thumbDir, 'scene-001.svg'), '<svg xmlns="http://www.w3.org/2000/svg" />');
  }

  if (downloadLinkText) {
    writeFileSync(path.join(projectRoot, 'download_link.txt'), downloadLinkText);
  }

  return projectRoot;
}

test('validateAssets accepts an empty asset list', () => {
  const assets = validateAssets([], { thumbnailExists: () => true });
  assert.deepEqual(assets, []);
});

test('validateAssets accepts a valid asset entry', () => {
  const assets = validateAssets([validAsset], { thumbnailExists: () => true });
  assert.equal(assets[0].id, validAsset.id);
  assert.equal(assets[0].thumbnail, validAsset.thumbnail);
});

test('validateAssets accepts download_link as an alias', () => {
  const assets = validateAssets(
    [{ ...validAsset, download_url: undefined, download_link: 'https://pan.baidu.com/s/1alias-demo' }],
    { thumbnailExists: () => true }
  );
  assert.equal(assets[0].download_url, 'https://pan.baidu.com/s/1alias-demo');
});

test('validateAssets rejects duplicate ids', () => {
  assert.throws(
    () => validateAssets([validAsset, { ...validAsset }], { thumbnailExists: () => true }),
    AssetValidationError
  );
});

test('validateAssets rejects invalid download links', () => {
  assert.throws(
    () =>
      validateAssets([{ ...validAsset, download_url: 'http://example.com/file.zip' }], {
        thumbnailExists: () => true
      }),
    AssetValidationError
  );
});

test('loadAssets checks whether thumbnails exist in public/', () => {
  const projectRoot = createTempProject([validAsset], { withThumbnail: false });
  assert.throws(() => loadAssets({ projectRoot }), AssetValidationError);
});

test('loadAssets accepts a valid project layout', () => {
  const projectRoot = createTempProject([validAsset]);
  const assets = loadAssets({ projectRoot });
  assert.equal(assets.length, 1);
  assert.equal(assets[0].author, validAsset.author);
});

test('loadAssets merges download_link.txt and prepends the extraction code', () => {
  const projectRoot = createTempProject([validAsset], {
    downloadLinkText: `1. scene-001.sog\n链接：https://pan.quark.cn/s/example123\n提取码：ABCD`
  });
  const assets = loadAssets({ projectRoot });
  assert.equal(assets[0].download_url, 'https://pan.quark.cn/s/example123');
  assert.equal(assets[0].download_note, '提取码：ABCD');
});
