import { loadAssets } from '../src/lib/assets.js';

try {
  const assets = loadAssets();
  console.log(`Validated ${assets.length} asset(s).`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

