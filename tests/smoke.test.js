const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.style = { display: 'none' };
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.children = [];
    this.onclick = null;
    this._classes = new Set(className ? className.split(/\s+/).filter(Boolean) : []);
    this.classList = {
      add: (...names) => names.forEach((name) => this._classes.add(name)),
      remove: (...names) => names.forEach((name) => this._classes.delete(name)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (this._classes.has(name)) {
            this._classes.delete(name);
            return false;
          }
          this._classes.add(name);
          return true;
        }
        if (force) this._classes.add(name);
        else this._classes.delete(name);
        return !!force;
      },
      contains: (name) => this._classes.has(name),
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  closest() {
    return this;
  }
}

function createHarness() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const scriptMatch = scriptMatches[scriptMatches.length - 1];
  if (!scriptMatch) throw new Error('Could not find app script in index.html');
  const source = scriptMatch[1].replace(/\n\s*calculate\(\);\s*$/, '\n');

  const byId = new Map();
  const classMap = new Map();

  function register(id, className = '') {
    const el = new FakeElement(id, className);
    if (id) byId.set(id, el);
    className.split(/\s+/).filter(Boolean).forEach((name) => {
      if (!classMap.has(name)) classMap.set(name, []);
      classMap.get(name).push(el);
    });
    return el;
  }

  [
    ['tab-sleep', 'mode-tab'],
    ['tab-nap', 'mode-tab'],
    ['tab-caff', 'mode-tab'],
    ['panel-sleep'],
    ['panel-nap'],
    ['panel-caff'],
    ['btn-wakeup', 'toggle-btn'],
    ['btn-sleep', 'toggle-btn'],
    ['time-label'],
    ['results'],
    ['info-strip'],
    ['alarm-panel'],
    ['alarm-toggle-btn'],
    ['alarm-time-display'],
    ['alarm-select-row'],
    ['sleep-options'],
    ['results-sub'],
    ['error'],
    ['timeInput'],
    ['napInput'],
    ['nap-results'],
    ['nap-output'],
    ['nap-error'],
    ['custom-nap-group'],
    ['customNapMins'],
    ['nap-hint'],
    ['toast'],
    ['fmt-12', 'fmt-btn'],
    ['fmt-24', 'fmt-btn'],
    ['buffer-val'],
    ['buffer-slider'],
    ['caffWakeInput'],
    ['caffBedInput'],
    ['caff-sens-hint'],
    ['caff-total-hint'],
    ['custom-mg-input'],
    ['caff-results'],
    ['caff-output'],
  ].forEach(([id, className]) => register(id, className || ''));

  [4, 5, 6, 0].forEach(() => register('', 'cycle-btn'));
  ['low', 'medium', 'high'].forEach(() => register('', 'caff-sens-btn'));
  [80, 140, 40, 80].forEach((mg, index) => {
    const btn = register(`drink-${index}`, 'caff-drink-btn');
    btn.dataset.mg = String(mg);
    if (index === 0) btn.classList.add('active');
  });

  const document = {
    getElementById(id) {
      const element = byId.get(id);
      if (!element) throw new Error(`Unknown element id: ${id}`);
      return element;
    },
    querySelectorAll(selector) {
      if (!selector.startsWith('.')) return [];
      const className = selector.slice(1);
      return (classMap.get(className) || []).slice();
    },
    createElement() {
      return new FakeElement();
    },
  };

  const timeouts = [];
  const context = {
    console,
    document,
    window: {},
    navigator: {
      clipboard: {
        writeText: () => Promise.resolve(),
      },
    },
    Notification: {
      requestPermission: () => Promise.resolve('granted'),
    },
    setTimeout(fn, ms) {
      timeouts.push({ fn, ms });
      return timeouts.length;
    },
    clearTimeout() {},
    Date,
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, document, timeouts };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    console.log(`  ${error.message}`);
    process.exitCode = 1;
  }
}

test('roundToNearest30 rolls 08:59 forward to 09:00', () => {
  const { context } = createHarness();
  const rounded = context.roundToNearest30(new Date('2026-03-30T08:59:00'));
  assert(context.formatTime(rounded) === '9:00 AM', `Expected 9:00 AM, got ${context.formatTime(rounded)}`);
});

test('sleep calculation renders recommended options', () => {
  const { context, document } = createHarness();
  document.getElementById('timeInput').value = '07:30';
  context.calculate();
  assert(document.getElementById('results').style.display === 'block', 'Sleep results should be visible');
  assert(document.getElementById('sleep-options').children.length > 0, 'Sleep options should be rendered');
});

test('caffeine calculation renders a cutoff label', () => {
  const { context, document } = createHarness();
  document.getElementById('caffWakeInput').value = '07:00';
  document.getElementById('caffBedInput').value = '23:00';
  context.calculateCaffeine();
  assert(document.getElementById('caff-results').style.display === 'block', 'Caffeine results should be visible');
  assert(document.getElementById('caff-output').innerHTML.includes('last safe cup'), 'Expected caffeine cutoff copy to be rendered');
});

test('changing time format refreshes sleep and nap results', () => {
  const { context, document } = createHarness();
  document.getElementById('timeInput').value = '07:30';
  context.calculate();
  document.getElementById('napInput').value = '13:00';
  context.calculateNap();
  context.setTimeFmt('24');
  assert(document.getElementById('results-sub').textContent.includes('07:30'), 'Sleep result should be reformatted to 24h');
  assert(document.getElementById('nap-output').innerHTML.includes('14:30'), 'Nap result should be reformatted to 24h');
});

test('changing time format does not refresh caffeine results yet', () => {
  const { context, document } = createHarness();
  document.getElementById('caffWakeInput').value = '07:00';
  document.getElementById('caffBedInput').value = '23:00';
  context.calculateCaffeine();
  const before = document.getElementById('caff-output').innerHTML;
  context.setTimeFmt('24');
  const after = document.getElementById('caff-output').innerHTML;
  assert(before === after, 'Caffeine result unexpectedly changed; the stale-format bug may already be fixed');
  assert(after.includes('11:00 PM'), 'Expected caffeine output to remain in 12h format after switching to 24h');
});
