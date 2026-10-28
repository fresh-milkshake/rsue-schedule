import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Local development certificate; use a private release key for public distribution.
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const jdk = process.env.JAVA_HOME || path.join(process.env.ProgramFiles || '', 'Android', 'Android Studio', 'jbr');
const versions = readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const tools = path.join(sdk, 'build-tools', versions[0]);
const suffix = process.platform === 'win32' ? '.exe' : '';
const java = path.join(jdk, 'bin', `java${suffix}`);
const keytool = path.join(jdk, 'bin', `keytool${suffix}`);
const keystore = path.resolve('.local/development.keystore');
const output = path.resolve(process.argv[3] || 'artifacts/ritm-arm64.apk');
const input = process.argv[2];
if (!input || !existsSync(input)) throw new Error('Передайте путь к release-unsigned.apk');
mkdirSync('.local', { recursive: true });
mkdirSync('artifacts', { recursive: true });
mkdirSync(path.dirname(output), { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${path.basename(command)}`);
}
if (!existsSync(keystore)) {
  run(keytool, ['-genkeypair', '-keystore', keystore, '-alias', 'rhythm-development', '-storepass', 'android', '-keypass', 'android', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Fresh Milkshake, O=Fresh Milkshake']);
}
const aligned = path.resolve('.local/aligned.apk');
run(path.join(tools, `zipalign${suffix}`), ['-f', '-P', '16', '4', path.resolve(input), aligned]);
const signer = path.join(tools, 'lib', 'apksigner.jar');
run(java, ['-jar', signer, 'sign', '--ks', keystore, '--ks-key-alias', 'rhythm-development', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', output, aligned]);
run(java, ['-jar', signer, 'verify', '--verbose', output]);
console.log(`APK: ${output}`);
