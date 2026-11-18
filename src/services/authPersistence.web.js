/**
 * Web Firebase Auth setup. The browser SDK persists the session in
 * localStorage by default.
 */
import { getAuth } from 'firebase/auth';

export const createAuth = (app) => getAuth(app);

export default createAuth;
