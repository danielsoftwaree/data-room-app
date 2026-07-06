/**
 * Public entry of the dataroom-browser feature: browsing one data room's folder
 * tree (navigation, folder CRUD, PDF upload & preview).
 * The app shell imports ONLY from this barrel.
 */
export { DataroomBrowserScreen } from './components/dataroom-browser-screen';
export { validateBrowserSearch, type BrowserSearch } from './helpers/browser-search';
