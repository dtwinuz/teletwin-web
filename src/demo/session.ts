// Demo-only fake sign-in state: a stored Telegram session (so the app opens the main screen, not the login form)
// and corp credentials of the demo employee. Everything is fictional and lives only in this browser tab's storage.
import { DEMO_EMPLOYEE } from './corpServer';
import { DEMO_CORP_SERVER } from './data';

export const DEMO_TELEGRAM_USER = {
  id: '7100200300',
  firstName: 'Jasur',
  lastName: 'Toshmatov',
  phone: '998901234567',
};

const DEMO_DC_ID = 2;

export function seedDemoSession(token: string) {
  try {
    // Every reload starts from the same fixtures
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('account1', JSON.stringify({
      dcId: DEMO_DC_ID,
      userId: DEMO_TELEGRAM_USER.id,
      firstName: DEMO_TELEGRAM_USER.firstName,
      lastName: DEMO_TELEGRAM_USER.lastName,
    }));
    localStorage.setItem(`teletwin.corp.${DEMO_TELEGRAM_USER.id}`, JSON.stringify({
      server: DEMO_CORP_SERVER,
      token,
      employee: { id: DEMO_EMPLOYEE.id, login: DEMO_EMPLOYEE.login, fullName: DEMO_EMPLOYEE.fullName },
    }));
  } catch {
    // Blocked storage: the app shows its sign-in screens, the fixtures still answer
  }
}
