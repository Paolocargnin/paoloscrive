import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { contentContract } from '../src/content/contract.mjs';
import { optionsFromArguments } from '../scripts/workspace-cli.mjs';
import {
  createText,
  developText,
  listTexts,
  readMaterial,
  readText,
  saveText,
} from './archivio.mjs';
import { renderSidecar, renderText } from './pagina.mjs';
import { repositoryStatus, saveRepository } from './repository.mjs';

/**
 * The Scrittoio (ADR 0026): Paolo's private back office for the Workspace.
 * It listens only on this computer and is never part of the public site.
 */
const root = path.resolve(import.meta.dirname, '..');
const options = optionsFromArguments();
const workspace = path.resolve(
  options.get('--workspace') ?? path.join(root, 'content', 'workspace'),
);
const port = Number(
  options.get('--port') ?? process.env.SCRITTOIO_PORT ?? 4322,
);
const host = '127.0.0.1';
const publicDirectory = path.join(import.meta.dirname, 'public');
const fonts = {
  'eb-garamond': path.join(
    root,
    'node_modules/@fontsource-variable/eb-garamond',
  ),
  'bodoni-moda': path.join(
    root,
    'node_modules/@fontsource-variable/bodoni-moda',
  ),
};

const staticTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function send(
  response,
  status,
  body,
  type = 'application/json; charset=utf-8',
) {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(
    type.startsWith('application/json') ? JSON.stringify(body) : body,
  );
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function withHtml(text) {
  return {
    ...text,
    html: await renderText(text),
    appuntiHtml: await renderSidecar(text.appunti),
    letturaCriticaHtml: await renderSidecar(text.letturaCritica),
  };
}

// Only this computer may talk to the Scrittoio: a page on another site cannot
// read or change the Workspace through the browser.
function trusted(request) {
  const allowedHosts = [`${host}:${port}`, `localhost:${port}`];
  if (!allowedHosts.includes(request.headers.host ?? '')) {
    return false;
  }
  const origin = request.headers.origin;
  return (
    request.method === 'GET' ||
    origin === undefined ||
    allowedHosts.some((allowed) => origin === `http://${allowed}`)
  );
}

async function serveStatic(response, directory, relative) {
  const file = path.resolve(directory, relative);
  if (!file.startsWith(`${directory}${path.sep}`)) {
    return send(response, 404, { errore: 'Non trovato.' });
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      'content-type':
        staticTypes[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': relative.endsWith('.woff2')
        ? 'max-age=86400'
        : 'no-store',
    });
    response.end(content);
  } catch {
    send(response, 404, { errore: 'Non trovato.' });
  }
}

async function route(request, response) {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const { method } = request;

  if (parts[0] === 'api') {
    const [, resource, cartella, slug, extra] = parts;
    const ref = cartella && slug ? `${cartella}/${slug}` : null;

    if (resource === 'testi' && !ref && method === 'GET') {
      return send(response, 200, {
        testi: await listTexts(workspace),
        forme: contentContract.workspace.forme,
        lingue: contentContract.languages,
      });
    }
    if (resource === 'testi' && !ref && method === 'POST') {
      return send(
        response,
        201,
        await withHtml(await createText(workspace, await readJson(request))),
      );
    }
    if (resource === 'testi' && ref && !extra && method === 'GET') {
      return send(
        response,
        200,
        await withHtml(await readText(workspace, ref)),
      );
    }
    if (resource === 'testi' && ref && !extra && method === 'PUT') {
      return send(
        response,
        200,
        await withHtml(await saveText(workspace, ref, await readJson(request))),
      );
    }
    if (
      resource === 'testi' &&
      ref &&
      extra === 'sviluppa' &&
      method === 'POST'
    ) {
      return send(
        response,
        200,
        await withHtml(await developText(workspace, ref)),
      );
    }
    if (resource === 'materiali' && ref && extra && method === 'GET') {
      const { content, type } = await readMaterial(workspace, ref, extra);
      response.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-store',
      });
      return response.end(content);
    }
    if (resource === 'repository' && method === 'GET') {
      return send(response, 200, await repositoryStatus(workspace));
    }
    if (resource === 'repository' && method === 'POST') {
      return send(response, 200, await saveRepository(workspace));
    }
    return send(response, 404, { errore: 'Non trovato.' });
  }

  if (method !== 'GET') {
    return send(response, 405, { errore: 'Metodo non ammesso.' });
  }
  if (parts[0] === 'font' && Object.hasOwn(fonts, parts[1] ?? '')) {
    return serveStatic(response, fonts[parts[1]], parts.slice(2).join('/'));
  }
  return serveStatic(
    response,
    publicDirectory,
    parts.length ? parts.join('/') : 'index.html',
  );
}

const server = createServer(async (request, response) => {
  if (!trusted(request)) {
    return send(response, 403, {
      errore: 'Lo Scrittoio risponde solo da questo computer.',
    });
  }
  try {
    await route(request, response);
  } catch (error) {
    const status = error.status ?? 500;
    if (status === 500) {
      console.error(error);
    }
    send(response, status, { errore: error.message });
  }
});

server.listen(port, host, () => {
  const address = `http://localhost:${port}`;
  console.log(`Scrittoio aperto su ${address}`);
  console.log(`Workspace: ${workspace}`);
  if (process.argv.includes('--apri')) {
    execFile('open', [address]);
  }
});
