import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Resolve installed tools for this process only; never edit global environment settings.
const env = { ...process.env, CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || '2' };
if (process.platform === 'win32') {
  const sdk = env.ANDROID_HOME || path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  env.ANDROID_HOME = sdk;
  const studioJava = path.join(env.ProgramFiles, 'Android', 'Android Studio', 'jbr');
  if (!env.JAVA_HOME && existsSync(studioJava)) env.JAVA_HOME = studioJava;
  if (!env.NDK_HOME || !existsSync(path.join(env.NDK_HOME, 'source.properties'))) {
    const ndks = path.join(sdk, 'ndk');
    if (existsSync(ndks)) {
      const versions = readdirSync(ndks).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      if (versions.length) env.NDK_HOME = path.join(ndks, versions[0]);
    }
  }
}
const args = process.argv.slice(2);
const child = spawn(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'android', ...args], { env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
