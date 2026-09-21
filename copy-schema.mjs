import { copyFileSync } from 'node:fs';

copyFileSync('server/src/schema.sql', 'dist-server/schema.sql');
console.log('[schema] copiado a dist-server/schema.sql');