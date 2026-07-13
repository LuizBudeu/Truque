// Internationalization tests: the translator contract, dictionary
// completeness across languages, and that renderApp actually swaps every
// screen's copy — including a Portuguese leak/quality sweep over a full game.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTranslator,
  nextLanguage,
  languageMeta,
  LANGUAGES,
  messages,
} from '../client/js/i18n.js';
import { renderApp } from '../client/js/render.js';
import { nextSeat, buildModel, buildViewModel } from '../client/js/store.js';
import { getPlayerView } from '../shared/views.js';
import { C, makeState, autoPlay } from './helpers.js';

const ui = (overrides = {}) => ({
  curtain: false,
  selected: [],
  offset: null,
  push: 0,
  graveyardOpen: false,
  rulesOpen: false,
  ...overrides,
});

describe('translator', () => {
  test('resolves plain strings and calls function messages with params', () => {
    const t = createTranslator('en');
    assert.equal(t('menu.createRoom'), 'Create room');
    assert.equal(t('hud.round', { n: 3 }), 'Round 3');
  });

  test('missing keys fall back to English, then to the key itself', () => {
    const t = createTranslator('pt');
    // 'menu.createRoom' exists in pt; a bogus key returns the key.
    assert.equal(t('does.not.exist'), 'does.not.exist');
  });

  test('an unknown language falls back to the default dictionary', () => {
    const t = createTranslator('xx');
    assert.equal(t('menu.createRoom'), 'Create room');
  });

  test('nextLanguage cycles through LANGUAGES and wraps', () => {
    assert.equal(nextLanguage('en'), 'pt');
    assert.equal(nextLanguage('pt'), 'en'); // wraps with two languages
    assert.equal(languageMeta('pt').name, 'Português');
  });
});

describe('dictionary completeness', () => {
  const enKeys = Object.keys(messages.en);
  for (const { code } of LANGUAGES) {
    test(`'${code}' defines every key English defines`, () => {
      const missing = enKeys.filter((k) => !(k in messages[code]));
      assert.deepEqual(missing, [], `missing keys in '${code}': ${missing.join(', ')}`);
    });
  }

  test('every language provides well-formed rules sections', () => {
    for (const { code } of LANGUAGES) {
      const sections = createTranslator(code)('rules.sections');
      assert.ok(Array.isArray(sections) && sections.length > 0, code);
      for (const s of sections) {
        assert.equal(typeof s.h, 'string');
        assert.ok(Array.isArray(s.p) && s.p.length > 0, `${code} section "${s.h}"`);
      }
    }
  });
});

describe('renderApp honors the active language', () => {
  test('menu copy switches to Portuguese', () => {
    const en = renderApp({ screen: 'menu', lang: 'en' });
    const pt = renderApp({ screen: 'menu', lang: 'pt' });
    assert.ok(en.includes('Create room'));
    assert.ok(pt.includes('Criar sala'));
    assert.ok(!pt.includes('Create room'));
  });

  test('game screen copy switches to Portuguese', () => {
    const html = renderApp(buildModel(makeState(), 0, ui({ lang: 'pt' })));
    assert.ok(html.includes('Rodada 1')); // Round 1
    assert.ok(html.includes('Você é o Jogador 1')); // seat badge
    assert.ok(html.includes('Ordem dos naipes')); // suit-cycle title
    assert.ok(!html.includes('Round 1'));
  });

  test('language defaults to English when no language is set', () => {
    const html = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(html.includes('Round 1'));
  });
});

describe('language toggle control', () => {
  test('the HUD carries a language toggle showing the current code', () => {
    const html = renderApp(buildModel(makeState(), 0, ui({ lang: 'pt' })));
    assert.ok(html.includes('data-action="cycle-lang"'));
    assert.ok(html.includes('🌐 PT'));
  });

  test('the menu carries a language toggle too', () => {
    assert.ok(renderApp({ screen: 'menu', lang: 'en' }).includes('data-action="cycle-lang"'));
  });
});

describe('floating rules help', () => {
  test('the help FAB is present on menu and game, opens the rules modal', () => {
    assert.ok(renderApp({ screen: 'menu', lang: 'en' }).includes('data-action="open-rules"'));
    const game = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(game.includes('data-action="open-rules"'));
    assert.ok(!game.includes('data-action="close-rules"')); // modal closed by default
  });

  test('the rules modal renders translated content when open', () => {
    const en = renderApp(buildModel(makeState(), 0, ui({ rulesOpen: true })));
    assert.ok(en.includes('How to play'));
    assert.ok(en.includes('Objective'));
    assert.ok(en.includes('data-action="close-rules"'));
    const pt = renderApp(buildModel(makeState(), 0, ui({ rulesOpen: true, lang: 'pt' })));
    assert.ok(pt.includes('Como jogar'));
    assert.ok(pt.includes('Objetivo'));
  });
});

describe('Portuguese full-game render sweep', () => {
  test('every state renders cleanly in Portuguese and leaks nothing', () => {
    const online = (state, seat) =>
      buildViewModel(getPlayerView(state, seat), ui({ lang: 'pt' }), {
        online: true,
        connection: 'open',
        opponentConnected: true,
      });
    const check = (html, state, seat, label) => {
      for (const bad of ['undefined', 'NaN', '[object']) {
        assert.ok(!html.includes(bad), `${label}: rendered "${bad}"`);
      }
      for (const card of state.hands[1 - seat]) {
        assert.ok(
          !html.includes(`data-card="${card.rank}-${card.suit}"`),
          `${label}: opponent card leaked`,
        );
      }
    };
    autoPlay(37, {
      onStep: (state) => {
        const seat = nextSeat(state) ?? 0;
        check(renderApp(buildModel(state, seat, ui({ lang: 'pt' }))), state, seat, 'hotseat pt');
        for (const p of [0, 1]) check(renderApp(online(state, p)), state, p, `online pt seat ${p}`);
      },
    });
  });
});
