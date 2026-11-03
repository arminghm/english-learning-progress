import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/data', { recursive: true });
await cp('docs', 'dist', { recursive: true });
await cp('data/progress.json', 'dist/data/progress.json');
console.log('Built dist/');
