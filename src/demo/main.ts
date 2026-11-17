// Entry of the live demo build (`npm run build:demo`, `index.html` points here only in `--mode demo`):
// fake sign-in, in-memory corp server and demo badge first, then the real app (`../index.tsx`).
import { DEMO_TOKEN, installDemoCorpServer } from './corpServer';
import { mountDemoPill } from './pill';
import { seedDemoSession } from './session';

seedDemoSession(DEMO_TOKEN);
installDemoCorpServer();
mountDemoPill();

void import('../index');
