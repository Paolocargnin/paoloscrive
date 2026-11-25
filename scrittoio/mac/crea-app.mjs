import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Builds Scrittoio.app and installs it in ~/Applications (ADR 0026).
 *
 * The app remembers where this checkout is and which Node runs it, so after
 * moving the repository or changing Node, run `pnpm scrittoio:app` again.
 */
const root = path.resolve(import.meta.dirname, '..', '..');
const here = import.meta.dirname;
const applications = path.join(os.homedir(), 'Applications');
const app = path.join(applications, 'Scrittoio.app');
const contents = path.join(app, 'Contents');
const port = Number(process.env.SCRITTOIO_PORT ?? 4322);

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

const plistValue = (value) =>
  typeof value === 'number'
    ? `<integer>${value}</integer>`
    : typeof value === 'boolean'
      ? `<${value}/>`
      : `<string>${String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</string>`;

function plist(entries) {
  const body = Object.entries(entries)
    .map(([key, value]) =>
      typeof value === 'object'
        ? `  <key>${key}</key>\n  <dict>\n${Object.entries(value)
            .map(([k, v]) => `    <key>${k}</key>\n    ${plistValue(v)}`)
            .join('\n')}\n  </dict>`
        : `  <key>${key}</key>\n  ${plistValue(value)}`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body}
</dict>
</plist>
`;
}

const work = await mkdtemp(path.join(os.tmpdir(), 'scrittoio-app-'));
try {
  await rm(app, { recursive: true, force: true });
  await mkdir(path.join(contents, 'MacOS'), { recursive: true });
  await mkdir(path.join(contents, 'Resources'), { recursive: true });

  console.log('Compilo l’app…');
  run('xcrun', [
    'swiftc',
    '-O',
    '-swift-version',
    '5',
    path.join(here, 'Scrittoio.swift'),
    '-o',
    path.join(contents, 'MacOS', 'Scrittoio'),
  ]);

  console.log('Disegno l’icona…');
  const icon = path.join(work, 'icona.png');
  run('xcrun', ['swift', path.join(here, 'icona.swift'), icon]);
  const iconset = path.join(work, 'AppIcon.iconset');
  await mkdir(iconset);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      execFileSync('sips', [
        '-z',
        String(size * scale),
        String(size * scale),
        icon,
        '--out',
        path.join(iconset, name),
      ]);
    }
  }
  run('iconutil', [
    '-c',
    'icns',
    iconset,
    '-o',
    path.join(contents, 'Resources', 'AppIcon.icns'),
  ]);

  await writeFile(
    path.join(contents, 'Info.plist'),
    plist({
      CFBundleName: 'Scrittoio',
      CFBundleDisplayName: 'Scrittoio',
      CFBundleIdentifier: 'it.paoloscrive.scrittoio',
      CFBundleExecutable: 'Scrittoio',
      CFBundleIconFile: 'AppIcon',
      CFBundlePackageType: 'APPL',
      CFBundleShortVersionString: '1.0',
      CFBundleVersion: '1',
      CFBundleDevelopmentRegion: 'it',
      LSMinimumSystemVersion: '13.0',
      LSApplicationCategoryType: 'public.app-category.productivity',
      NSHighResolutionCapable: true,
      NSHumanReadableCopyright: 'Paolo scrive',
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      ScrittoioRepository: root,
      ScrittoioNode: process.execPath,
      ScrittoioPort: port,
    }),
    'utf8',
  );

  run('codesign', ['--force', '--deep', '--sign', '-', app]);
  // Tell Launchpad and Spotlight about the app right away.
  run(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-f', app],
  );
  console.log(`Scrittoio.app è in ${app}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
