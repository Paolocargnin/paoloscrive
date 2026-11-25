// Scrittoio: Paolo's private back office for the Workspace (ADR 0026).

const generi = {
  nota: { singolare: 'Nota', plurale: 'Note', articolo: 'una Nota' },
  racconto: {
    singolare: 'Racconto',
    plurale: 'Racconti',
    articolo: 'un Racconto',
  },
  personaggio: {
    singolare: 'Personaggio',
    plurale: 'Personaggi',
    articolo: 'un Personaggio',
  },
};

const provenienze = {
  'drive-testi': 'Drive · Testi',
  'drive-radice': 'Drive · Il mio Drive',
  'drive-2016': 'Drive · 2016–2020',
  'drive-2008': 'Drive · 2008–2016',
  scrittoio: 'Scritti qui',
};

const ordini = {
  recenti: 'dal più recente',
  vecchi: 'dal più vecchio',
  modificati: 'modificati di recente',
  titolo: 'per titolo',
  lunghi: 'dal più lungo',
};

const mesi = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

// The six spine tints of the Collana (ADR 0025).
const tinte = [
  '#d4a619',
  '#3e6862',
  '#6c2a3d',
  '#b7832c',
  '#243b66',
  '#8d9399',
];

const suggerimenti = {
  nota: 'Un’idea, una scena, un dialogo, una frase da non perdere.',
  racconto: 'Nasce come Bozza. La pubblichi tu, quando è pronta.',
  personaggio:
    'Chi è, com’è fatto, che cosa vuole. Lo Scrittoio ti mostrerà dove compare.',
};

const state = {
  testi: [],
  forme: {},
  lingue: {},
  repository: null,
  lista: [],
  corrente: null,
  editor: null,
};

const main = document.querySelector('#main');
const search = document.querySelector('#search');

/* Small helpers */

const raw = (value) => ({ __html: String(value) });

function escape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );
}

function piece(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(piece).join('');
  if (typeof value === 'object' && '__html' in value) return value.__html;
  return escape(value);
}

function markup(strings, ...values) {
  return raw(
    strings.reduce(
      (out, string, index) => out + string + piece(values[index]),
      '',
    ),
  );
}

function put(node, fragment) {
  node.innerHTML = fragment.__html;
}

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function dataLunga(writtenAt) {
  if (!writtenAt) return null;
  const [year, month, day] = writtenAt.split('-');
  if (day) return `${Number(day)} ${mesi[Number(month) - 1]} ${year}`;
  if (month) return `${mesi[Number(month) - 1]} ${year}`;
  return year;
}

function parole(count) {
  return count === 1 ? '1 parola' : `${count.toLocaleString('it-IT')} parole`;
}

function provenienzaDi(testo) {
  const cartella = testo.origine?.cartella;
  if (!cartella) return 'scrittoio';
  if (cartella === 'Il mio Drive') return 'drive-radice';
  if (cartella.startsWith('Testi/2008-2016')) return 'drive-2008';
  if (cartella.startsWith('Testi/2016-2020')) return 'drive-2016';
  return 'drive-testi';
}

function tinta(slug) {
  let hash = 0;
  for (const character of slug)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return tinte[hash % tinte.length];
}

function etichetta(testo) {
  if (testo.genere === 'nota') {
    return testo.forma ? (state.forme[testo.forma] ?? testo.forma) : 'Nota';
  }
  if (testo.genere === 'racconto') {
    return testo.stato === 'pubblicato'
      ? 'Racconto pubblicato'
      : 'Racconto · Bozza';
  }
  return 'Personaggio';
}

let toastTimer;
function toast(message, { error = false, action = null } = {}) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      node.classList.remove('visible');
      action.run();
    });
    node.append(' ', button);
  }
  node.classList.toggle('error', error);
  node.classList.toggle('actionable', Boolean(action));
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => node.classList.remove('visible'),
    action ? 10000 : error ? 6000 : 2600,
  );
}

async function api(path, { method = 'GET', body, keepalive = false } = {}) {
  const response = await fetch(path, {
    method,
    keepalive,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errore ?? `Errore ${response.status}`);
  }
  return data;
}

function prepare(testo) {
  return {
    ...testo,
    anno: testo.writtenAt ? testo.writtenAt.slice(0, 4) : null,
    provenienza: provenienzaDi(testo),
    cerca: normalize(`${testo.title}\n${testo.testo}`),
  };
}

function remember(testo) {
  const summary = prepare(testo);
  const index = state.testi.findIndex((item) => item.ref === testo.ref);
  if (index === -1) state.testi.push(summary);
  else state.testi[index] = summary;
}

/* Routing: #/?genere=nota&forma=poesia, #/t/note/slug, #/t/note/slug/modifica */

function currentRoute(fromHash = location.hash) {
  const hash = fromHash.replace(/^#/, '') || '/';
  const [pathname, query = ''] = hash.split('?');
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts.length >= 3) {
    return {
      view: parts[3] === 'modifica' ? 'editor' : 'reader',
      ref: `${parts[1]}/${parts[2]}`,
    };
  }
  const params = new URLSearchParams(query);
  return {
    view: 'archive',
    filtro: {
      genere: params.get('genere') ?? '',
      forma: params.get('forma') ?? '',
      anno: params.get('anno') ?? '',
      da: params.get('da') ?? '',
      q: params.get('q') ?? '',
      ordine: params.get('ordine') ?? 'recenti',
    },
  };
}

let lastArchiveHash = '#/';

function archiveHash(filtro) {
  const params = new URLSearchParams();
  for (const key of ['genere', 'forma', 'anno', 'da', 'q']) {
    if (filtro[key]) params.set(key, filtro[key]);
  }
  if (filtro.ordine && filtro.ordine !== 'recenti')
    params.set('ordine', filtro.ordine);
  const query = params.toString();
  return query ? `#/?${query}` : '#/';
}

function currentFilter() {
  const route = currentRoute();
  return route.view === 'archive'
    ? route.filtro
    : currentRoute(lastArchiveHash).filtro;
}

function go(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', hash);
    render();
  } else if (location.hash === hash) {
    render();
  } else {
    location.hash = hash;
  }
}

function setFilter(changes) {
  const filtro = { ...currentFilter(), ...changes };
  if (changes.forma) filtro.genere = 'nota';
  if (changes.genere && changes.genere !== 'nota') filtro.forma = '';
  go(archiveHash(filtro), {
    replace: 'q' in changes && Object.keys(changes).length === 1,
  });
}

/* Filtering */

function matches(testo, filtro, skip = '') {
  if (skip !== 'genere' && filtro.genere && testo.genere !== filtro.genere)
    return false;
  if (skip !== 'forma' && filtro.forma && testo.forma !== filtro.forma)
    return false;
  if (skip !== 'anno' && filtro.anno && testo.anno !== filtro.anno)
    return false;
  if (skip !== 'da' && filtro.da && testo.provenienza !== filtro.da)
    return false;
  if (filtro.q) {
    const terms = normalize(filtro.q).split(/\s+/).filter(Boolean);
    if (!terms.every((term) => testo.cerca.includes(term))) return false;
  }
  return true;
}

function sorted(testi, ordine) {
  // Undated texts go last, whichever way the dates run.
  const byDate = (a, b, direction = 1) => {
    if (!a.writtenAt || !b.writtenAt) {
      return (
        (a.writtenAt ? -1 : 1) - (b.writtenAt ? -1 : 1) ||
        b.updatedAt.localeCompare(a.updatedAt)
      );
    }
    return direction * b.writtenAt.localeCompare(a.writtenAt);
  };
  const copy = [...testi];
  switch (ordine) {
    case 'vecchi':
      return copy.sort((a, b) => byDate(a, b, -1));
    case 'modificati':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'titolo':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'it'));
    case 'lunghi':
      return copy.sort((a, b) => b.words - a.words);
    default:
      return copy.sort(byDate);
  }
}

function counts(filtro, skip, key) {
  const result = new Map();
  for (const testo of state.testi) {
    if (!matches(testo, filtro, skip)) continue;
    const value = testo[key];
    if (value == null) continue;
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

/* Sidebar */

function renderSidebar() {
  const filtro = currentFilter();
  const route = currentRoute();
  if (document.activeElement !== search) search.value = filtro.q;

  const perGenere = counts(filtro, 'genere', 'genere');
  const totale = [...perGenere.values()].reduce((sum, n) => sum + n, 0);
  put(
    document.querySelector('#generi'),
    markup`${[
      ['', 'Tutto', totale],
      ...Object.entries(generi).map(([key, g]) => [
        key,
        g.plurale,
        perGenere.get(key) ?? 0,
      ]),
    ].map(
      ([key, label, count]) =>
        markup` <button
          class="filter"
          type="button"
          data-genere="${key}"
          aria-pressed="${route.view === 'archive' && filtro.genere === key}"
        >
          <span class="label">${label}</span><span class="count">${count}</span>
        </button>`,
    )}`,
  );

  const perForma = counts({ ...filtro, genere: 'nota' }, 'forma', 'forma');
  put(
    document.querySelector('#forme'),
    markup`${Object.entries(state.forme)
      .filter(([key]) => perForma.has(key) || filtro.forma === key)
      .map(
        ([key, label]) =>
          markup` <button
            class="chip"
            type="button"
            data-forma="${key}"
            aria-pressed="${filtro.forma === key}"
          >
            ${label}<span class="count">${perForma.get(key) ?? 0}</span>
          </button>`,
      )}`,
  );

  const perAnno = counts(filtro, 'anno', 'anno');
  put(
    document.querySelector('#anni'),
    markup`${[...perAnno.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(
        ([anno, count]) =>
          markup` <button
            class="chip"
            type="button"
            data-anno="${anno}"
            aria-pressed="${filtro.anno === anno}"
            title="${count} testi"
          >
            ${anno}<span class="count">${count}</span>
          </button>`,
      )}`,
  );

  const perProvenienza = counts(filtro, 'da', 'provenienza');
  put(
    document.querySelector('#provenienze'),
    markup`${Object.entries(provenienze)
      .filter(([key]) => perProvenienza.has(key))
      .map(
        ([key, label]) =>
          markup` <button
            class="filter"
            type="button"
            data-da="${key}"
            aria-pressed="${filtro.da === key}"
          >
            <span class="label">${label}</span
            ><span class="count">${perProvenienza.get(key)}</span>
          </button>`,
      )}`,
  );

  renderRepository();
}

function renderRepository() {
  const node = document.querySelector('#repository');
  const repo = state.repository;
  if (!repo) {
    node.textContent = '';
    return;
  }
  const pending = repo.modificati.length;
  const quando = repo.ultimo?.data
    ? new Date(repo.ultimo.data).toLocaleString('it-IT', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  if (pending === 0 && repo.daInviare === 0) {
    put(
      node,
      markup`<p><span class="dot"></span>Tutto salvato nel repository privato.</p>
        ${quando ? markup`<p class="small-caps">Ultimo salvataggio ${quando}</p>` : ''}`,
    );
    return;
  }
  const cosa =
    pending > 0
      ? `${pending === 1 ? 'Un testo cambiato' : `${pending} testi cambiati`} da salvare`
      : `${repo.daInviare === 1 ? 'Un salvataggio' : `${repo.daInviare} salvataggi`} da inviare a GitHub`;
  put(
    node,
    markup`<p><span class="dot pending"></span>${cosa}.</p>
      <button class="button primary" type="button" id="salva-repository">
        Salva nel repository
      </button>`,
  );
}

async function refreshRepository() {
  try {
    state.repository = await api('/api/repository');
  } catch {
    state.repository = null;
  }
  renderRepository();
}

let repositoryTimer;
function scheduleRepositoryRefresh() {
  clearTimeout(repositoryTimer);
  repositoryTimer = setTimeout(refreshRepository, 600);
}

async function saveRepository(button) {
  button.disabled = true;
  button.textContent = 'Salvataggio…';
  try {
    if (state.editor?.dirty) await saveEditor();
    const result = await api('/api/repository', { method: 'POST' });
    state.repository = result;
    if (result.errore) {
      toast(
        `Salvato sul Mac, ma l’invio a GitHub non è riuscito: ${result.errore}`,
        { error: true },
      );
    } else {
      toast('Salvato e inviato al repository privato.');
    }
  } catch (error) {
    toast(error.message, { error: true });
  }
  renderRepository();
}

/* Archive */

function highlight(text, query) {
  const safe = escape(text);
  const terms = query.split(/\s+/).filter((term) => term.length > 1);
  if (terms.length === 0) return raw(safe);
  const pattern = new RegExp(
    `(${terms.map((term) => escape(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  return raw(safe.replace(pattern, '<mark>$1</mark>'));
}

function excerptFor(testo, query) {
  if (!query) return testo.excerpt;
  const first = normalize(query).split(/\s+/).filter(Boolean)[0];
  const index = normalize(testo.testo).indexOf(first);
  if (index < 0) return testo.excerpt;
  const start = Math.max(0, index - 70);
  return `${start > 0 ? '…' : ''}${testo.testo.slice(start, start + 220).replace(/\s+/g, ' ')}…`;
}

function entry(testo, query) {
  const meta = [
    etichetta(testo),
    dataLunga(testo.writtenAt),
    parole(testo.words),
  ];
  if (testo.materiali.length) meta.push(`${testo.materiali.length} materiali`);
  if (testo.lang !== 'it')
    meta.push(state.lingue[testo.lang]?.ownName ?? testo.lang);
  return markup` <li>
    <a
      class="entry"
      href="#/t/${testo.ref}"
      data-genere="${testo.genere}"
      style="--spine: ${tinta(testo.slug)}"
    >
      <span class="entry-title">${highlight(testo.title, query)}</span>
      <span class="entry-meta small-caps"
        >${meta.filter(Boolean).join(' · ')}</span
      >
      ${testo.words ? markup`<span class="entry-excerpt">${highlight(excerptFor(testo, query), query)}</span>` : ''}
    </a>
  </li>`;
}

function archiveTitle(filtro) {
  if (filtro.forma) return state.forme[filtro.forma] ?? filtro.forma;
  if (filtro.genere) return generi[filtro.genere].plurale;
  return 'Tutto lo Scrittoio';
}

function renderArchive(filtro) {
  lastArchiveHash = archiveHash(filtro);
  const lista = sorted(
    state.testi.filter((testo) => matches(testo, filtro)),
    filtro.ordine,
  );
  state.lista = lista.map((testo) => testo.ref);

  const attivi = [
    filtro.genere && !filtro.forma && ['genere', generi[filtro.genere].plurale],
    filtro.forma && ['forma', state.forme[filtro.forma]],
    filtro.anno && ['anno', filtro.anno],
    filtro.da && ['da', provenienze[filtro.da]],
    filtro.q && ['q', `«${filtro.q}»`],
  ].filter(Boolean);

  const byDate = filtro.ordine === 'recenti' || filtro.ordine === 'vecchi';
  const groups = [];
  for (const testo of lista) {
    const key = byDate ? (testo.anno ?? 'Senza data') : '';
    if (groups.at(-1)?.key !== key) groups.push({ key, testi: [] });
    groups.at(-1).testi.push(testo);
  }

  const parolePerLista = lista.reduce((sum, testo) => sum + testo.words, 0);
  const genereNuovo = filtro.genere || (filtro.forma ? 'nota' : 'nota');

  put(
    main,
    markup` <div class="archive">
      <header class="archive-head">
        <div>
          <h1>${archiveTitle(filtro)}</h1>
          <p class="lede">
            ${lista.length === 1 ? 'Un testo' : `${lista.length} testi`},
            ${parole(parolePerLista)} ·
            ${ordini[filtro.ordine] ?? ordini.recenti}
          </p>
        </div>
        <div class="archive-tools">
          <label>
            <span class="visually-hidden">Ordina</span>
            <select id="ordine">
              ${Object.entries(ordini).map(
                ([key, label]) =>
                  markup`<option
                    value="${key}"
                    ${raw(filtro.ordine === key ? 'selected' : '')}
                  >
                    ${label[0].toUpperCase()}${label.slice(1)}
                  </option>`,
              )}
            </select>
          </label>
          <button
            class="button primary"
            type="button"
            data-nuovo="${genereNuovo}"
          >
            ${raw('&#43;')}
            ${generi[genereNuovo].singolare === 'Nota' ? 'Nuova nota' : `Nuovo ${generi[genereNuovo].singolare.toLowerCase()}`}
          </button>
        </div>
      </header>
      ${
        attivi.length
          ? markup`<div class="active-filters">
              ${attivi.map(
                ([key, label]) =>
                  markup`<button
                      class="chip"
                      type="button"
                      aria-pressed="true"
                      data-togli="${key}"
                      title="Togli il filtro"
                    >
                      ${label} ×
                    </button>`,
              )}
              <button class="button quiet" type="button" data-togli="tutto">
                Togli i filtri
              </button>
            </div>`
          : ''
      }
      ${
        lista.length === 0
          ? markup`<div class="empty">
              <p>Nessun testo con questi filtri.</p>
              <button class="button" type="button" data-togli="tutto">
                Mostra tutto
              </button>
            </div>`
          : groups.map(
              (group) =>
                markup` <section
                  class="year"
                  ${raw(byDate ? '' : 'style="grid-template-columns: minmax(0,1fr)"')}
                >
                  ${
                    byDate
                      ? markup`<h2 class="year-label">
                            ${group.key}<small
                              >${group.testi.length === 1 ? '1 testo' : `${group.testi.length} testi`}</small
                            >
                          </h2>`
                      : ''
                  }
                  <ul class="entries">
                    ${group.testi.map((testo) => entry(testo, filtro.q))}
                  </ul>
                </section>`,
            )
      }
    </div>`,
  );
}

/* Reader */

function materiali(testo) {
  return testo.materiali.map((nome) => {
    const url = `/api/materiali/${testo.ref}/${encodeURIComponent(nome)}`;
    if (/\.(png|jpe?g|webp)$/i.test(nome)) {
      return markup`<a
        class="materiale"
        href="${url}"
        target="_blank"
        rel="noopener"
        ><img src="${url}" alt="" loading="lazy" /><span>${nome}</span></a
      >`;
    }
    if (/\.(m4a|mp3|wav|ogg)$/i.test(nome)) {
      return markup`<div class="materiale wide">
        <audio controls preload="none" src="${url}"></audio><span>${nome}</span>
      </div>`;
    }
    return markup`<a
      class="materiale"
      href="${url}"
      target="_blank"
      rel="noopener"
      ><span>📄 ${nome}</span></a
    >`;
  });
}

function neighbours(ref) {
  const lista = state.lista.length
    ? state.lista
    : state.testi.map((testo) => testo.ref);
  const index = lista.indexOf(ref);
  return {
    index,
    total: lista.length,
    previous: index > 0 ? lista[index - 1] : null,
    next: index >= 0 && index < lista.length - 1 ? lista[index + 1] : null,
  };
}

function driveLink(origine) {
  return origine?.drive
    ? `https://drive.google.com/open?id=${encodeURIComponent(origine.drive)}`
    : null;
}

function renderReader(testo) {
  const { index, total, previous, next } = neighbours(testo.ref);
  const meta = [
    dataLunga(testo.writtenAt) &&
      `Scritto ${testo.writtenAt.length === 10 ? 'il' : 'nel'} ${dataLunga(testo.writtenAt)}`,
    parole(testo.words),
  ];
  if (testo.lang !== 'it')
    meta.push(state.lingue[testo.lang]?.ownName ?? testo.lang);
  const origine = testo.origine;

  put(
    main,
    markup` <div class="reader-bar">
        <a class="back" href="${lastArchiveHash}">← Archivio</a>
        <span class="spacer"></span>
        ${index >= 0 ? markup`<span class="position">${index + 1} di ${total}</span>` : ''}
        <a
          class="icon-button"
          href="${previous ? `#/t/${previous}` : '#'}"
          aria-disabled="${!previous}"
          title="Precedente (←)"
          aria-label="Testo precedente"
          >‹</a
        >
        <a
          class="icon-button"
          href="${next ? `#/t/${next}` : '#'}"
          aria-disabled="${!next}"
          title="Successivo (→)"
          aria-label="Testo successivo"
          >›</a
        >
        ${
          testo.stato !== 'pubblicato'
            ? markup`<button
                class="button quiet danger"
                type="button"
                id="cancella"
                title="Cancella questo testo"
              >
                Cancella
              </button>`
            : ''
        }
        ${
          testo.genere === 'nota'
            ? markup`<button
                class="button quiet"
                type="button"
                id="sviluppa"
                title="La Nota diventa una Bozza tra i Racconti"
              >
                Trasforma in Racconto
              </button>`
            : ''
        }
        <a class="button" href="#/t/${testo.ref}/modifica" title="Modifica (E)"
          >Modifica</a
        >
      </div>
      <article class="reader">
        <header class="reader-head">
          <p class="kicker small-caps">${etichetta(testo)}</p>
          <h1>${testo.title}</h1>
          <span class="ornament" aria-hidden="true"></span>
          <p class="reader-meta small-caps">
            ${meta.filter(Boolean).join(' · ')}
          </p>
        </header>
        <div
          class="testo"
          data-genere="${testo.genere}"
          data-forma="${testo.forma ?? ''}"
        >
          ${raw(testo.html.trim())}
        </div>

        ${
          testo.genere === 'personaggio'
            ? markup`<section class="aside-block">
                <h2 class="small-caps">Compare in</h2>
                ${
                  testo.menzioni.length
                    ? markup`<ul class="menzioni">
                        ${testo.menzioni.map(
                          (menzione) =>
                            markup`<li>
                            <a href="#/t/${menzione.ref}">${menzione.title}</a>
                            <p>${menzione.snippet}</p>
                          </li>`,
                        )}
                      </ul>`
                    : markup`<p class="provenienza">
                        Per ora nessun altro testo nomina ${testo.title}.
                      </p>`
                }
              </section>`
            : ''
        }
        ${
          testo.appuntiHtml
            ? markup`<section class="aside-block">
                <h2 class="small-caps">Appunti, la Nota da cui è nato</h2>
                <div class="testo">${raw(testo.appuntiHtml)}</div>
              </section>`
            : ''
        }
        ${
          testo.letturaCriticaHtml
            ? markup`<section class="aside-block">
                <h2 class="small-caps">Lettura critica</h2>
                <div class="testo">${raw(testo.letturaCriticaHtml)}</div>
              </section>`
            : ''
        }
        ${
          testo.materiali.length
            ? markup`<section class="aside-block">
                <h2 class="small-caps">Materiali</h2>
                <div class="materiali">${materiali(testo)}</div>
              </section>`
            : ''
        }

        <section class="aside-block provenienza">
          <h2 class="small-caps">Provenienza</h2>
          ${
            origine
              ? markup`<p>
                  Da Google Drive, cartella <em>${origine.cartella}</em>, file
                  «${origine.file}».
                  ${driveLink(origine) ? markup`<a href="${driveLink(origine)}" target="_blank" rel="noopener">Apri nel Drive ↗</a>` : ''}
                </p>`
              : markup`<p>Scritto nello Scrittoio.</p>`
          }
          <p>Nel Workspace: <code>${testo.ref}/testo.md</code></p>
        </section>

        ${
          testo.stato === 'bozza'
            ? markup`<p class="hint">
                Quando la Bozza è pronta, completa titolo e descrizione e
                pubblicala tu dal terminale:
                <code
                  >pnpm pubblica -- --slug ${testo.slug} --approved-by "Paolo
                  Cargnin"</code
                >
              </p>`
            : ''
        }
      </article>`,
  );
}

/* Editor */

function renderEditor(testo) {
  const showNotes = Boolean(testo.appuntiHtml || testo.letturaCriticaHtml);
  put(
    main,
    markup` <div class="editor-bar">
        <a class="back" href="#/t/${testo.ref}" id="fine">← Fine</a>
        <span class="spacer"></span>
        <span class="save-state" id="save-state">Salvataggio automatico</span>
        <button class="button" type="button" id="salva" title="Salva (⌘S)">
          Salva
        </button>
      </div>
      <div class="editor-layout ${showNotes ? 'with-notes' : ''}">
        <div class="sheet">
          <input
            class="title-input"
            id="title"
            value="${testo.title}"
            aria-label="Titolo"
            autocomplete="off"
          />
          <div class="meta-row">
            <span class="meta-field small-caps"
              >${generi[testo.genere].singolare}${testo.stato === 'bozza' ? ' · Bozza' : ''}</span
            >
            ${
              testo.genere === 'nota'
                ? markup`<label class="meta-field"
                    ><span class="small-caps">Forma</span>
                    <select id="forma">
                      <option value="">—</option>
                      ${Object.entries(state.forme).map(
                        ([key, label]) =>
                          markup`<option
                            value="${key}"
                            ${raw(testo.forma === key ? 'selected' : '')}
                          >
                            ${label}
                          </option>`,
                      )}
                    </select></label
                  >`
                : ''
            }
            <label class="meta-field"
              ><span class="small-caps">Scritto</span>
              <input
                id="writtenAt"
                value="${testo.writtenAt ?? ''}"
                placeholder="2025-04-29"
                inputmode="numeric"
                title="Un anno, un mese o un giorno: 2009, 2009-08, 2009-08-14"
            /></label>
            <label class="meta-field"
              ><span class="small-caps">Lingua</span>
              <select id="lang">
                ${Object.entries(state.lingue).map(
                  ([key, lingua]) =>
                    markup`<option
                      value="${key}"
                      ${raw(testo.lang === key ? 'selected' : '')}
                    >
                      ${lingua.ownName}
                    </option>`,
                )}
              </select></label
            >
          </div>
          <textarea
            class="body-input"
            id="body"
            spellcheck="true"
            lang="${testo.lang}"
            placeholder="Scrivi."
          ></textarea>
        </div>
        ${
          showNotes
            ? markup`<aside class="notes-panel">
                ${
                  testo.appuntiHtml
                    ? markup`<h2 class="small-caps">Appunti</h2>
                        <div class="testo">${raw(testo.appuntiHtml)}</div>`
                    : ''
                }
                ${
                  testo.letturaCriticaHtml
                    ? markup`<h2 class="small-caps">Lettura critica</h2>
                        <div class="testo">
                          ${raw(testo.letturaCriticaHtml)}
                        </div>`
                    : ''
                }
              </aside>`
            : ''
        }
      </div>`,
  );

  const body = document.querySelector('#body');
  body.value = testo.body;
  autosize(body);
  state.editor = { ref: testo.ref, dirty: false, saving: null, timer: null };

  for (const id of ['title', 'forma', 'writtenAt', 'lang', 'body']) {
    const field = document.querySelector(`#${id}`);
    field?.addEventListener('input', () => {
      if (id === 'body') autosize(body);
      markDirty();
    });
  }
  if (!testo.body.trim() && testo.title) body.focus();
  else if (!testo.title) document.querySelector('#title').focus();
}

function autosize(textarea) {
  if (CSS.supports('field-sizing', 'content')) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + 4}px`;
}

function setSaveState(text, kind = '') {
  const node = document.querySelector('#save-state');
  if (!node) return;
  node.textContent = text;
  node.className = `save-state ${kind}`;
}

function markDirty() {
  const editor = state.editor;
  if (!editor) return;
  editor.dirty = true;
  setSaveState('Modifiche non salvate', 'dirty');
  clearTimeout(editor.timer);
  editor.timer = setTimeout(() => saveEditor(), 900);
}

function editorValues() {
  const values = {
    title: document.querySelector('#title')?.value ?? '',
    body: document.querySelector('#body')?.value ?? '',
    lang: document.querySelector('#lang')?.value,
  };
  const forma = document.querySelector('#forma');
  if (forma) values.forma = forma.value || null;
  const writtenAt = document.querySelector('#writtenAt');
  const date = writtenAt?.value.trim() ?? '';
  const validDate =
    date === '' ||
    /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/.test(date);
  writtenAt?.setAttribute('aria-invalid', String(!validDate));
  if (validDate) values.writtenAt = date || null;
  if (!values.title.trim()) delete values.title;
  return values;
}

async function saveEditor({ keepalive = false } = {}) {
  const editor = state.editor;
  if (!editor || !editor.dirty) return;
  clearTimeout(editor.timer);
  if (editor.saving) {
    await editor.saving;
    if (!editor.dirty) return;
  }
  editor.dirty = false;
  setSaveState('Salvataggio…');
  const values = editorValues();
  editor.saving = api(`/api/testi/${editor.ref}`, {
    method: 'PUT',
    body: values,
    keepalive,
  })
    .then((testo) => {
      remember(testo);
      if (state.corrente?.ref === testo.ref) state.corrente = testo;
      const time = new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (!editor.dirty) setSaveState(`Salvato alle ${time}`);
      scheduleRepositoryRefresh();
      renderSidebar();
    })
    .catch((error) => {
      editor.dirty = true;
      setSaveState('Non salvato', 'error');
      toast(error.message, { error: true });
    })
    .finally(() => {
      editor.saving = null;
    });
  await editor.saving;
}

/* Dialogs */

function openNewDialog(genere = 'nota') {
  const dialog = document.querySelector('#nuovo');
  const form = document.querySelector('#nuovo-form');
  form.reset();
  form.elements.genere.value = genere;
  const select = form.elements.forma;
  select.innerHTML = markup`<option value="">Senza forma</option>
    ${Object.entries(state.forme).map(
      ([key, label]) => markup`<option value="${key}">${label}</option>`,
    )}`.__html;
  const filtro = currentFilter();
  if (filtro.forma) select.value = filtro.forma;
  updateNewDialog();
  dialog.showModal();
  form.elements.title.focus();
}

function updateNewDialog() {
  const form = document.querySelector('#nuovo-form');
  const genere = form.elements.genere.value;
  document.querySelector('#nuovo-forma').hidden = genere !== 'nota';
  document.querySelector('#nuovo-hint').textContent = suggerimenti[genere];
}

async function createFromDialog() {
  const form = document.querySelector('#nuovo-form');
  const genere = form.elements.genere.value;
  const title = form.elements.title.value.trim();
  if (!title) return;
  try {
    const testo = await api('/api/testi', {
      method: 'POST',
      body: {
        genere,
        title,
        forma:
          genere === 'nota' ? form.elements.forma.value || null : undefined,
      },
    });
    remember(testo);
    state.corrente = testo;
    scheduleRepositoryRefresh();
    go(`#/t/${testo.ref}/modifica`);
    const creato = {
      nota: 'Nota creata',
      racconto: 'Racconto creato',
      personaggio: 'Personaggio creato',
    };
    toast(`${creato[genere]}: ${testo.title}`);
  } catch (error) {
    toast(error.message, { error: true });
  }
}

function confirmDialog({ title, text, action, danger = false }) {
  const dialog = document.querySelector('#conferma');
  document.querySelector('#conferma-titolo').textContent = title;
  document.querySelector('#conferma-testo').textContent = text;
  const confirm = document.querySelector('#conferma-si');
  confirm.textContent = action;
  confirm.classList.toggle('danger', danger);
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'si'),
      { once: true },
    );
  });
}

async function developCurrent() {
  const testo = state.corrente;
  if (!testo || testo.genere !== 'nota') return;
  const ok = await confirmDialog({
    title: 'Trasformare in Racconto?',
    text: `«${testo.title}» diventa una Bozza tra i Racconti. La Nota resta accanto alla Bozza come Appunti, da tenere sott’occhio mentre scrivi.`,
    action: 'Trasforma',
  });
  if (!ok) return;
  try {
    const bozza = await api(`/api/testi/${testo.ref}/sviluppa`, {
      method: 'POST',
    });
    state.testi = state.testi.filter((item) => item.ref !== testo.ref);
    remember(bozza);
    state.corrente = bozza;
    scheduleRepositoryRefresh();
    go(`#/t/${bozza.ref}/modifica`);
    toast('Ora è una Bozza tra i Racconti.');
  } catch (error) {
    toast(error.message, { error: true });
  }
}

// How safe a text is once deleted, from the private repository's point of view.
const recupero = {
  salvato:
    'Puoi annullare subito; dopo resta comunque nella storia del repository privato.',
  modificato:
    'Puoi annullare finché lo Scrittoio resta aperto. Dopo, dal repository privato si recupera solo l’ultima versione salvata lì, senza le modifiche più recenti.',
  nuovo:
    'Non è mai stato salvato nel repository: puoi annullare solo finché lo Scrittoio resta aperto, poi non si recupera più.',
};

async function deleteCurrent() {
  const testo = state.corrente;
  if (!testo || testo.stato === 'pubblicato') return;
  const insieme = [
    testo.materiali.length === 1 && 'il suo materiale',
    testo.materiali.length > 1 && `i suoi ${testo.materiali.length} materiali`,
    testo.appunti && 'gli Appunti',
  ].filter(Boolean);
  const ok = await confirmDialog({
    title: `Cancellare «${testo.title}»?`,
    text: `${recupero[testo.repository] ?? recupero.nuovo}${
      insieme.length ? ` Se ne vanno anche ${insieme.join(' e ')}.` : ''
    }`,
    action: 'Cancella',
    danger: true,
  });
  if (!ok) return;
  const { previous, next } = neighbours(testo.ref);
  try {
    await api(`/api/testi/${testo.ref}`, { method: 'DELETE' });
  } catch (error) {
    toast(error.message, { error: true });
    return;
  }
  const position = state.lista.indexOf(testo.ref);
  state.testi = state.testi.filter((item) => item.ref !== testo.ref);
  state.lista = state.lista.filter((ref) => ref !== testo.ref);
  state.corrente = null;
  scheduleRepositoryRefresh();
  const destination = next ?? previous;
  go(destination ? `#/t/${destination}` : lastArchiveHash);
  toast(`Hai cancellato «${testo.title}».`, {
    action: { label: 'Annulla', run: () => restore(testo.ref, position) },
  });
}

async function restore(ref, position) {
  try {
    const testo = await api(`/api/testi/${ref}/ripristina`, { method: 'POST' });
    remember(testo);
    if (position >= 0 && !state.lista.includes(ref)) {
      state.lista.splice(position, 0, ref);
    }
    state.corrente = testo;
    scheduleRepositoryRefresh();
    go(`#/t/${ref}`);
    toast(`«${testo.title}» è tornato al suo posto.`);
  } catch (error) {
    toast(error.message, { error: true });
  }
}

/* Rendering */

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const route = currentRoute();
  if (
    state.editor &&
    !(route.view === 'editor' && route.ref === state.editor.ref)
  ) {
    await saveEditor();
    state.editor = null;
  }
  renderSidebar();

  if (route.view === 'archive') {
    state.corrente = null;
    renderArchive(route.filtro);
    document.title = `${archiveTitle(route.filtro)} · Scrittoio`;
    return;
  }

  let testo =
    state.corrente?.ref === route.ref && state.corrente.html !== undefined
      ? state.corrente
      : null;
  if (!testo) {
    try {
      testo = await api(`/api/testi/${route.ref}`);
    } catch (error) {
      if (token !== renderToken) return;
      put(
        main,
        markup`<div class="archive">
          <div class="empty">
            <p>${error.message}</p>
            <a class="button" href="#/">Torna all’archivio</a>
          </div>
        </div>`,
      );
      return;
    }
  }
  if (token !== renderToken) return;
  state.corrente = testo;
  document.title = `${testo.title} · Scrittoio`;
  if (route.view === 'editor') renderEditor(testo);
  else renderReader(testo);
  main.scrollTop = 0;
}

/* Events */

document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  const { dataset } = target;
  if ('genere' in dataset && target.classList.contains('filter')) {
    setFilter({ genere: dataset.genere, forma: '' });
  } else if (dataset.forma) {
    setFilter({
      forma: currentFilter().forma === dataset.forma ? '' : dataset.forma,
    });
  } else if (dataset.anno) {
    setFilter({
      anno: currentFilter().anno === dataset.anno ? '' : dataset.anno,
    });
  } else if (dataset.da) {
    setFilter({ da: currentFilter().da === dataset.da ? '' : dataset.da });
  } else if (dataset.togli) {
    if (dataset.togli === 'tutto') go('#/');
    else setFilter({ [dataset.togli]: '' });
  } else if (dataset.nuovo) {
    openNewDialog(dataset.nuovo);
  } else if (target.id === 'salva-repository') {
    saveRepository(target);
  } else if (target.id === 'sviluppa') {
    developCurrent();
  } else if (target.id === 'cancella') {
    deleteCurrent();
  } else if (target.id === 'salva') {
    if (state.editor) state.editor.dirty = true;
    saveEditor();
  } else if (target.getAttribute('aria-disabled') === 'true') {
    event.preventDefault();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'ordine') setFilter({ ordine: event.target.value });
  if (event.target.name === 'genere' && event.target.closest('#nuovo-form'))
    updateNewDialog();
});

let searchTimer;
search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const route = currentRoute();
    if (route.view !== 'archive') {
      go(archiveHash({ ...currentFilter(), q: search.value.trim() }));
    } else {
      setFilter({ q: search.value.trim() });
    }
  }, 120);
});

document.querySelector('#nuovo').addEventListener('close', (event) => {
  if (event.target.returnValue === 'crea') createFromDialog();
});

function typing(target) {
  return target.closest('input, textarea, select, [contenteditable]');
}

document.addEventListener('keydown', (event) => {
  const route = currentRoute();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (state.editor) {
      state.editor.dirty = true;
      saveEditor();
    }
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') {
    if (event.target === search) {
      search.value = '';
      setFilter({ q: '' });
      search.blur();
    } else if (route.view === 'editor') {
      go(`#/t/${route.ref}`);
    } else if (route.view === 'reader') {
      go(lastArchiveHash);
    }
    return;
  }
  if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey)
    return;
  if (event.key === '/') {
    event.preventDefault();
    search.focus();
    search.select();
  } else if (event.key === 'n') {
    event.preventDefault();
    openNewDialog(currentFilter().genere || 'nota');
  } else if (route.view === 'reader') {
    const { previous, next } = neighbours(route.ref);
    if ((event.key === 'ArrowLeft' || event.key === 'k') && previous)
      go(`#/t/${previous}`);
    if ((event.key === 'ArrowRight' || event.key === 'j') && next)
      go(`#/t/${next}`);
    if (event.key === 'e') go(`#/t/${route.ref}/modifica`);
  }
});

window.addEventListener('hashchange', render);

window.addEventListener('beforeunload', (event) => {
  if (state.editor?.dirty) {
    saveEditor({ keepalive: true });
    event.preventDefault();
  }
});

window.addEventListener('focus', refreshRepository);

/* Start */

async function start() {
  try {
    const data = await api('/api/testi');
    state.forme = data.forme;
    state.lingue = data.lingue;
    state.testi = data.testi.map(prepare);
  } catch (error) {
    put(
      main,
      markup`<div class="archive">
        <div class="empty">
          <p>Non riesco a leggere il Workspace: ${error.message}</p>
        </div>
      </div>`,
    );
    return;
  }
  await render();
  refreshRepository();
}

start();
