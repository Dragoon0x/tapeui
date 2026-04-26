/**
 * usetapeui test suite.
 *
 * Pure-Node tests against the built core engine. Covers:
 *   - intent extraction
 *   - reference resolution
 *   - sentiment classification
 *   - merge windowing
 *   - exporters
 *   - persist (.tape file format round-trip)
 *   - token translation
 *   - verify diffing
 *   - utils (selector edge cases, style diffing)
 *
 * No mocha, no jest. Just plain Node assertions so CI is dirt-simple.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  \u001b[31m✗\u001b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

function group(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

const distExists = fs.existsSync(path.join(__dirname, '..', 'dist', 'index.js'));
if (!distExists) {
  console.error('Run `npm run build` before `npm test`. (dist/ not found)');
  process.exit(1);
}

const core = require('../dist/core.js');
const {
  extractIntent,
  describeIntent,
  resolveReference,
  mergeStreams,
  reclassifyComment,
  buildReport,
  exportAgent,
  exportPrompt,
  exportMarkdown,
  exportJson,
  serializeTape,
  parseTape,
  detectTokenSystem,
  translateValue,
  diffStyles,
} = core;

console.log('\nusetapeui v1.0 test suite\n');

/* ----------------------- intent extraction ----------------------- */

group('Intent extraction', () => {
  test('detects "padding too aggressive" → change/padding/decrease', () => {
    const i = extractIntent('the padding is too aggressive');
    assert.strictEqual(i.action, 'change');
    assert.strictEqual(i.attribute, 'padding');
    assert.strictEqual(i.direction, 'decrease');
  });

  test('detects "make font bigger" → change/font-size/increase', () => {
    const i = extractIntent('make the font bigger');
    assert.strictEqual(i.action, 'change');
    assert.strictEqual(i.attribute, 'font-size');
    assert.strictEqual(i.direction, 'increase');
  });

  test('detects "love this card" → keep', () => {
    const i = extractIntent('love this card');
    assert.strictEqual(i.action, 'keep');
  });

  test('detects "why is this here?" → question', () => {
    const i = extractIntent('why is this here?');
    assert.strictEqual(i.action, 'question');
  });

  test('extracts numeric value with unit', () => {
    const i = extractIntent('set the padding to 16px');
    assert.strictEqual(i.hasValue, true);
    assert.strictEqual(i.value, '16px');
  });

  test('detects "way too small" → large magnitude + decrease', () => {
    const i = extractIntent('the text is way too small');
    assert.strictEqual(i.magnitude, 'large');
    // "too small" should be parsed as wanting to increase
    assert.strictEqual(i.direction, 'increase');
  });

  test('handles empty input', () => {
    const i = extractIntent('');
    assert.strictEqual(i.action, 'unknown');
  });

  test('describeIntent produces a non-empty string', () => {
    const i = extractIntent('reduce the padding');
    const s = describeIntent(i);
    assert.ok(s.length > 0);
  });
});

/* ----------------------- reference resolution ----------------------- */

group('Reference resolution', () => {
  const fakeMarkers = Array.from({ length: 4 }, (_, i) => ({
    t: i * 1000,
    selector: `.item-${i}`,
    tag: 'div',
    text: '',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    styles: {},
    classes: [],
    id: null,
    role: null,
  }));

  test('"the first one" → 0', () => {
    const r = resolveReference('change the first one', 2, fakeMarkers);
    assert.strictEqual(r.targetIndex, 0);
    assert.strictEqual(r.reason, 'ordinal');
  });

  test('"the last one" → final index', () => {
    const r = resolveReference('the last one is broken', 1, fakeMarkers);
    assert.strictEqual(r.targetIndex, 3);
  });

  test('"the previous" → currentIndex - 1', () => {
    const r = resolveReference('the previous one was fine', 2, fakeMarkers);
    assert.strictEqual(r.targetIndex, 1);
    assert.strictEqual(r.reason, 'backref');
  });

  test('"this" → current index', () => {
    const r = resolveReference('this is wrong', 2, fakeMarkers);
    assert.strictEqual(r.targetIndex, 2);
    assert.strictEqual(r.reason, 'demonstrative');
  });

  test('no demonstrative → null', () => {
    const r = resolveReference('a button at the top', 1, fakeMarkers);
    assert.strictEqual(r.targetIndex, null);
    assert.strictEqual(r.reason, 'none');
  });
});

/* ----------------------- merge & sentiment ----------------------- */

group('Merge + sentiment classification', () => {
  function mk(t, sel) {
    return {
      t, selector: sel, tag: 'div', text: '', rect: { x: 0, y: 0, w: 0, h: 0 },
      styles: {}, classes: [], id: null, role: null,
    };
  }
  function seg(t, text) {
    return { t, duration: 0, text, final: true, confidence: 1 };
  }

  test('pairs click + speech within window', () => {
    const out = mergeStreams([mk(1000, '.btn')], [seg(1100, 'this padding is wrong')]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].text, 'this padding is wrong');
    assert.strictEqual(out[0].sentiment, 'issue');
  });

  test('orphan segment becomes its own comment', () => {
    const out = mergeStreams([mk(1000, '.btn')], [seg(1100, 'love this'), seg(20000, 'this is great too')]);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[1].marker, null);
  });

  test('classifies "love" as positive', () => {
    const out = mergeStreams([mk(1000, '.btn')], [seg(1100, 'love this')]);
    assert.strictEqual(out[0].sentiment, 'positive');
  });

  test('classifies "why" as question', () => {
    const out = mergeStreams([mk(1000, '.btn')], [seg(1100, 'why is this here?')]);
    assert.strictEqual(out[0].sentiment, 'question');
  });

  test('reclassifyComment marks edited true', () => {
    const out = mergeStreams([mk(1000, '.btn')], [seg(1100, 'this is broken')]);
    const next = reclassifyComment({ ...out[0], text: 'love it now' });
    assert.strictEqual(next.edited, true);
    assert.strictEqual(next.sentiment, 'positive');
  });

  test('comments are sorted by time', () => {
    const out = mergeStreams(
      [mk(2000, '.a'), mk(500, '.b')],
      [seg(2100, 'one'), seg(450, 'two')],
    );
    assert.ok(out[0].t <= out[1].t);
  });
});

/* ----------------------- exporters ----------------------- */

group('Exporters', () => {
  function buildSampleReport() {
    return buildReport({
      markers: [
        {
          t: 100, selector: 'button.cta', tag: 'button',
          text: 'Sign up', rect: { x: 0, y: 0, w: 100, h: 40 },
          styles: { padding: '7px 18px', 'border-radius': '3px' },
          classes: ['cta'], id: null, role: null, screenshot: null, source: null,
        },
      ],
      segments: [{ t: 200, duration: 0, text: 'padding too aggressive', final: true, confidence: 1 }],
      duration: 5000,
      tokens: null,
    });
  }

  test('exportAgent wraps in <design_critique> tags', () => {
    const out = exportAgent(buildSampleReport());
    assert.match(out, /<design_critique>/);
    assert.match(out, /<\/design_critique>/);
  });

  test('exportAgent groups by sentiment', () => {
    const out = exportAgent(buildSampleReport());
    assert.match(out, /Issues to fix \(1\)/);
  });

  test('exportPrompt prepends agent instructions', () => {
    const out = exportPrompt(buildSampleReport());
    assert.match(out, /design critique/i);
    assert.match(out, /<design_critique>/);
  });

  test('exportMarkdown emits a header', () => {
    const out = exportMarkdown(buildSampleReport());
    assert.match(out, /^# Design critique/m);
  });

  test('exportJson returns valid JSON', () => {
    const out = exportJson(buildSampleReport());
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.version, '1');
  });
});

/* ----------------------- persist ----------------------- */

group('Persist (.tape file format)', () => {
  const sample = buildReport({
    markers: [{
      t: 0, selector: '.x', tag: 'div', text: '',
      rect: { x: 0, y: 0, w: 0, h: 0 }, styles: {}, classes: [],
      id: null, role: null, screenshot: null, source: null,
    }],
    segments: [],
    duration: 1000,
    tokens: null,
  });

  test('serialize → parse round-trips', () => {
    const json = serializeTape(sample);
    const back = parseTape(json);
    assert.ok(back);
    assert.strictEqual(back.url, sample.url);
    assert.strictEqual(back.markers.length, 1);
  });

  test('parseTape rejects invalid JSON', () => {
    assert.strictEqual(parseTape('not json'), null);
  });

  test('parseTape rejects wrong format', () => {
    assert.strictEqual(parseTape(JSON.stringify({ format: 'wrong', version: '1' })), null);
  });

  test('parseTape rejects wrong version', () => {
    assert.strictEqual(
      parseTape(JSON.stringify({ format: 'tape', version: '99', report: {} })),
      null,
    );
  });
});

/* ----------------------- tokens ----------------------- */

group('Token translation', () => {
  const tokens = {
    type: 'tailwind',
    spacing: { '12px': '3', '16px': '4' },
    typography: { '14px': 'text-sm', '16px': 'text-base' },
    colors: { 'rgb(255, 255, 255)': 'white' },
    cssVars: { '#3b82f6': '--brand' },
    tailwindDetected: true,
    cssVarsDetected: true,
  };

  test('translates spacing px to scale', () => {
    const out = translateValue('padding', '12px', tokens);
    assert.match(out, /3/);
  });

  test('translates font-size px to text class', () => {
    const out = translateValue('font-size', '14px', tokens);
    assert.match(out, /text-sm/);
  });

  test('translates color to css var', () => {
    const out = translateValue('color', '#3b82f6', tokens);
    assert.match(out, /--brand/);
  });

  test('passes through unknown values', () => {
    const out = translateValue('padding', '23px', tokens);
    assert.strictEqual(out, '23px');
  });

  test('null tokens passes through', () => {
    const out = translateValue('padding', '12px', null);
    assert.strictEqual(out, '12px');
  });
});

/* ----------------------- diff ----------------------- */

group('Style diffing', () => {
  test('detects added property', () => {
    const d = diffStyles({}, { padding: '8px' });
    assert.strictEqual(d.padding.before, '');
    assert.strictEqual(d.padding.after, '8px');
  });

  test('detects removed property', () => {
    const d = diffStyles({ padding: '8px' }, {});
    assert.strictEqual(d.padding.before, '8px');
    assert.strictEqual(d.padding.after, '');
  });

  test('detects changed value', () => {
    const d = diffStyles({ padding: '8px' }, { padding: '16px' });
    assert.strictEqual(d.padding.after, '16px');
  });

  test('returns empty diff for equal maps', () => {
    const d = diffStyles({ a: '1', b: '2' }, { a: '1', b: '2' });
    assert.strictEqual(Object.keys(d).length, 0);
  });
});

/* ----------------------- summary ----------------------- */

console.log(`\n  Total: ${passed + failed}`);
console.log(`  \u001b[32mPassed: ${passed}\u001b[0m`);
if (failed) console.log(`  \u001b[31mFailed: ${failed}\u001b[0m`);
console.log('');

if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  ${f.name}`);
    console.log(`    ${f.err.stack || f.err.message}`);
  }
  process.exit(1);
}
