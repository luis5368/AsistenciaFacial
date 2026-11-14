import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const models = [
  { name: 'yunet', directory: 'face_detection_yunet', file: 'face_detection_yunet_2023mar.onnx', bytes: 232589, sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4', license: 'MIT' },
  { name: 'sface', directory: 'face_recognition_sface', file: 'face_recognition_sface_2021dec.onnx', bytes: 38696353, sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79', license: 'Apache-2.0' },
];
const publicDir = new URL('apps/frontend/public/', root);
await mkdir(new URL('models/', publicDir), { recursive: true });
await mkdir(new URL('ort/', publicDir), { recursive: true });
await mkdir(new URL('licenses/', publicDir), { recursive: true });
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Descarga HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
for (const model of models) {
  model.url = `https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/${model.directory}/${model.file}`;
  const target = new URL(`models/${model.file}`, publicDir);
  let data;
  try { data = await readFile(target); } catch { data = await download(model.url); }
  if (data.length !== model.bytes || createHash('sha256').update(data).digest('hex') !== model.sha256) throw new Error(`Integridad incorrecta: ${model.name}; no se usará el archivo`);
  await writeFile(target, data);
  const license = await download(`https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/${model.directory}/LICENSE`);
  await writeFile(new URL(`licenses/${model.name}.txt`, publicDir), license);
  console.log(`${model.name}: ${data.length} bytes, SHA-256 verificado`);
}
// WASM and its JS loader must come from the exact installed ORT package.
const ortDir = new URL('node_modules/onnxruntime-web/dist/', root);
const assets = [];
for (const file of await readdir(ortDir)) {
  if (/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(file)) {
    await copyFile(new URL(file, ortDir), new URL(`ort/${file}`, publicDir));
    assets.push(`/ort/${file}`);
  }
}
await writeFile(new URL('models/manifest.json', publicDir), JSON.stringify({ models, runtimeAssets: assets }, null, 2) + '\n');
console.log(`Recursos ORT copiados: ${assets.length}`);
