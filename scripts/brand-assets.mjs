import { mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const branding = path.join(root, 'branding');
const resources = path.join(root, 'src-tauri/gen/android/app/src/main/res');
const androidIcons = path.join(root, 'src-tauri/icons/android');
const pattern = ['11110', '10001', '10001', '11110', '10100', '10010', '10001'];
const dots = pattern.flatMap((row, y) => [...row].flatMap((on, x) => on === '1' ? [{ x: 38 + x * 8, y: 30 + y * 8, r: 2.35 }] : []));
const circles = dots.map(({ x, y, r }) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 108 108">${body}</svg>\n`;
const glyph = `<g fill="#F5F5F5">${circles}</g>`;
const pathData = dots.map(({ x, y, r }) => `M${(x - r).toFixed(2)},${y}a${r},${r} 0,1 0 ${r * 2},0a${r},${r} 0,1 0 -${r * 2},0`).join(' ');
const vector = (scale = 1) => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${scale === 1 ? 108 : 24}dp" android:height="${scale === 1 ? 108 : 24}dp" android:viewportWidth="108" android:viewportHeight="108">
  <group android:pivotX="54" android:pivotY="54" android:scaleX="${scale}" android:scaleY="${scale}">
    <path android:fillColor="#FFFFFF" android:pathData="${pathData}" />
  </group>
</vector>\n`;
const adaptive = monochrome => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background" />
  <foreground android:drawable="@drawable/rhythm_icon_foreground" />
${monochrome ? '  <monochrome android:drawable="@drawable/rhythm_icon_foreground" />\n' : ''}</adaptive-icon>\n`;
function write(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

if (process.argv.includes('--sync')) {
  function copyTree(source, destination) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      if (entry.isDirectory()) copyTree(from, to);
      else copyFileSync(from, to);
    }
  }
  copyTree(androidIcons, resources);
  copyFileSync(path.join(root, 'src-tauri/icons/ios/AppIcon-60x60@3x.png'), path.join(root, 'public/apple-touch-icon.png'));
  copyFileSync(path.join(root, 'src-tauri/icons/icon.png'), path.join(root, 'public/app-icon.png'));
  console.log('Brand assets synced to Android and web.');
} else {
  mkdirSync(branding, { recursive: true });
  const legacy = svg(`<rect width="108" height="108" rx="24" fill="#0C0C0C"/><g transform="translate(-18.9 -18.9) scale(1.35)">${glyph}</g>`);
  write(path.join(branding, 'icon.svg'), legacy);
  write(path.join(root, 'public/icon.svg'), legacy);
  write(path.join(branding, 'android-background.svg'), svg('<rect width="108" height="108" fill="#0C0C0C"/>'));
  write(path.join(branding, 'android-foreground.svg'), svg(glyph));
  write(path.join(branding, 'icon-manifest.json'), JSON.stringify({ default: 'icon.svg', bg_color: '#0C0C0C', android_bg: 'android-background.svg', android_fg: 'android-foreground.svg', android_fg_scale: 100, android_monochrome: 'android-foreground.svg' }, null, 2) + '\n');
  for (const base of [androidIcons, resources]) {
    write(path.join(base, 'drawable/rhythm_icon_foreground.xml'), vector());
    write(path.join(base, 'drawable/ic_stat_rhythm.xml'), vector(1.45));
    write(path.join(base, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#0C0C0C</color></resources>\n');
    for (const version of [26, 33]) for (const name of ['ic_launcher', 'ic_launcher_round']) {
      write(path.join(base, `mipmap-anydpi-v${version}/${name}.xml`), adaptive(version === 33));
    }
  }
  console.log(`Created Fresh Milkshake icon: ${dots.length} dots; full-bleed Android background; safe foreground radius <33dp.`);
}
