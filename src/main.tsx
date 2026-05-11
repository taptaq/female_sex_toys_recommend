import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  APP_THEME_HOME_COSMOS_IMAGE_BY_ID,
  applyAppTheme,
  preloadAllAppThemeHomeCosmos,
  readStoredAppTheme,
} from './lib/app-theme.ts';

const initialThemeId = readStoredAppTheme();
applyAppTheme(initialThemeId);

const homeCosmosPreloadLink = document.createElement("link");
homeCosmosPreloadLink.rel = "preload";
homeCosmosPreloadLink.as = "image";
homeCosmosPreloadLink.href = APP_THEME_HOME_COSMOS_IMAGE_BY_ID[initialThemeId];
document.head.appendChild(homeCosmosPreloadLink);

const scheduleHomeCosmosPreload = () => {
  void preloadAllAppThemeHomeCosmos();
};

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(scheduleHomeCosmosPreload, { timeout: 900 });
} else {
  globalThis.setTimeout(scheduleHomeCosmosPreload, 240);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
