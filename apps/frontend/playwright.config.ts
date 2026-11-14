import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests/e2e', timeout: 180000, workers:1,
  use:{baseURL:'http://127.0.0.1:4173',channel:'chrome',headless:true,trace:'off',screenshot:'off',launchOptions:{args:['--use-fake-device-for-media-stream']}},
  webServer:process.env.AF_EXTERNAL_SERVER ? undefined : {command:'npm run preview -- --host 127.0.0.1',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000},
});
