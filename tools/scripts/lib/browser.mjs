import { existsSync } from 'node:fs';

// No CI, usa a versão do Chromium instalada pelo Playwright do package-lock.
// Localmente, mantém Chrome/Edge do sistema; CHROME_PATH permite escolher outro.
export function browserOptions() {
  const configured = process.env.CHROME_PATH;
  if (configured && !existsSync(configured)) {
    throw new Error('CHROME_PATH aponta para um navegador que não existe.');
  }
  const systemPaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return {
    executablePath: configured || (process.env.CI ? undefined : systemPaths.find((p) => existsSync(p))),
    headless: true,
    args: [
      '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      // Os runners Linux não têm GPU física; WebGL usa renderização por software.
      ...(process.env.CI ? ['--use-angle=swiftshader'] : []),
    ],
  };
}
