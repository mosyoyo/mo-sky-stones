import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCalendar } from './src/ics.js';

const root = path.dirname(fileURLToPath(import.meta.url));

fs.writeFileSync(
  path.join(root, 'red.ics'),
  generateCalendar('red', { days: 120, name: '光遇·红石(最后一场)' })
);

fs.writeFileSync(
  path.join(root, 'black.ics'),
  generateCalendar('black', { days: 120, name: '光遇·黑石(最后一场)' })
);

console.log('Generated red.ics and black.ics');
