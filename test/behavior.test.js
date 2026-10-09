'use strict'

// Run without the legacy Jest/pretest hooks: node test/behavior.test.js
// Compare another checkout or an extracted package: add --root /path/to/root
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const checks = []
const check = (name, run) => checks.push({ name, run })
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isTypeError = error => error && error.name === 'TypeError'

check('unknown events reach wildcard listeners with the original arguments', xpel => {
  const emitter = xpel()
  const payload = { value: 42 }
  const calls = []
  emitter('*', (...args) => calls.push(args))
  emitter('unregistered', payload, null, undefined, 0)
  assert.deepStrictEqual(calls, [[payload, null, undefined, 0]])
  assert.strictEqual(calls[0][0], payload)
})

check('unknown events without listeners are harmless and do not insert keys', xpel => {
  const subs = {}
  const owner = {}
  const emitter = xpel.call(owner, subs)
  const keys = Reflect.ownKeys(subs)
  assert.strictEqual(emitter('unregistered'), owner)
  assert.strictEqual(emitter('unregistered', 1), owner)
  assert.deepStrictEqual(Reflect.ownKeys(subs), keys)
  assert.strictEqual(hasOwn(subs, 'unregistered'), false)
})

check('an explicitly undefined subscription is treated as missing', xpel => {
  const subs = { event: undefined }
  const emitter = xpel(subs)
  let calls = 0
  emitter('*', () => { calls += 1 })
  emitter('event')
  assert.strictEqual(calls, 1)
  assert.strictEqual(hasOwn(subs, 'event'), true)
  assert.strictEqual(subs.event, undefined)
})

check('null-prototype maps support missing and registered events', xpel => {
  const subs = Object.create(null)
  const emitter = xpel(subs)
  const calls = []
  emitter('*', value => calls.push(['wildcard', value]))
  emitter('missing', 1)
  assert.strictEqual(hasOwn(subs, 'missing'), false)
  emitter('event', value => calls.push(['event', value]))
  emitter('event', 2)
  assert.deepStrictEqual(calls, [['wildcard', 1], ['event', 2], ['wildcard', 2]])
})

check('named listeners run in registration order before wildcard listeners', xpel => {
  const emitter = xpel()
  const calls = []
  emitter('*', () => calls.push('wildcard first'))
  emitter('event', () => calls.push('event first'))
  emitter('event', () => calls.push('event second'))
  emitter('*', () => calls.push('wildcard second'))
  emitter('event')
  assert.deepStrictEqual(calls, ['event first', 'event second', 'wildcard first', 'wildcard second'])
})

check('emitting the wildcard name delivers each wildcard listener once', xpel => {
  const emitter = xpel()
  const calls = []
  emitter('*', value => calls.push(['first', value]))
  emitter('*', value => calls.push(['second', value]))
  emitter('*', 42)
  assert.deepStrictEqual(calls, [['first', 42], ['second', 42]])
})

check('emission preserves argument identity including multiple function arguments', xpel => {
  const emitter = xpel()
  const first = () => {}
  const second = () => {}
  const object = {}
  const symbol = Symbol('argument')
  const calls = []
  emitter('event', (...args) => calls.push(args))
  emitter('*', (...args) => calls.push(args))
  emitter('event', first, second, object, symbol, null, undefined)
  assert.strictEqual(calls.length, 2)
  for (const args of calls) {
    assert.deepStrictEqual(args, [first, second, object, symbol, null, undefined])
    assert.strictEqual(args[0], first)
    assert.strictEqual(args[1], second)
    assert.strictEqual(args[2], object)
    assert.strictEqual(args[3], symbol)
  }
})

check('exactly one function argument registers without dispatching', xpel => {
  const emitter = xpel()
  let named = 0
  let wildcard = 0
  emitter('*', () => { wildcard += 1 })
  const unsubscribe = emitter('event', () => { named += 1 })
  assert.strictEqual(typeof unsubscribe, 'function')
  assert.strictEqual(named, 0)
  assert.strictEqual(wildcard, 0)
  emitter('event')
  assert.strictEqual(named, 1)
  assert.strictEqual(wildcard, 1)
})

check('registration reads a truthy subscription twice and assigns one concatenated array', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const first = () => {}
  const added = () => {}
  const original = [first]
  let current = original
  const operations = []
  Object.defineProperty(subs, 'event', {
    get () { operations.push('get'); return current },
    set (value) { operations.push('set'); current = value }
  })
  emitter('event', added)
  assert.deepStrictEqual(operations, ['get', 'get', 'set'])
  assert.deepStrictEqual(Array.from(current), [first, added])
  assert.notStrictEqual(current, original)
  assert.deepStrictEqual(original, [first])
})

check('registration reads a falsy subscription once and assigns empty then populated arrays', xpel => {
  for (const value of [undefined, null, false, 0, NaN, '']) {
    const subs = {}
    const emitter = xpel(subs)
    const added = () => {}
    let current = value
    const operations = []
    const assignments = []
    Object.defineProperty(subs, 'event', {
      get () { operations.push('get'); return current },
      set (next) { operations.push('set'); assignments.push(next); current = next }
    })
    emitter('event', added)
    assert.deepStrictEqual(operations, ['get', 'set', 'set'])
    assert.strictEqual(assignments.length, 2)
    assert.deepStrictEqual(Array.from(assignments[0]), [])
    assert.deepStrictEqual(Array.from(assignments[1]), [added])
    assert.notStrictEqual(assignments[0], assignments[1])
    assert.strictEqual(current, assignments[1])
  }
})

check('registration concatenates the second truthy lookup result when a getter changes', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const ignored = () => {}
  const retained = () => {}
  const added = () => {}
  let reads = 0
  let assigned
  Object.defineProperty(subs, 'event', {
    get () { reads += 1; return reads === 1 ? [ignored] : [retained] },
    set (value) { assigned = value }
  })
  emitter('event', added)
  assert.strictEqual(reads, 2)
  assert.deepStrictEqual(Array.from(assigned), [retained, added])
})

check('registration still throws when a truthy getter changes to null on its second lookup', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  let reads = 0
  let writes = 0
  let wildcard = 0
  Object.defineProperty(subs, 'event', {
    get () { reads += 1; return reads === 1 ? [] : null },
    set () { writes += 1 }
  })
  emitter('*', () => { wildcard += 1 })
  assert.throws(() => emitter('event', () => {}), isTypeError)
  assert.strictEqual(reads, 2)
  assert.strictEqual(writes, 0)
  assert.strictEqual(wildcard, 0)
})

check('registration propagates errors from either getter evaluation without assignment', xpel => {
  for (const failOnRead of [1, 2]) {
    const subs = {}
    const emitter = xpel(subs)
    const error = new Error('registration getter failed')
    let reads = 0
    let writes = 0
    Object.defineProperty(subs, 'event', {
      get () {
        reads += 1
        if (reads === failOnRead) throw error
        return []
      },
      set () { writes += 1 }
    })
    assert.throws(() => emitter('event', () => {}), value => value === error)
    assert.strictEqual(reads, failOnRead)
    assert.strictEqual(writes, 0)
  }
})

check('zero-payload emissions deliver zero arguments', xpel => {
  const emitter = xpel()
  const calls = []
  emitter('event', (...args) => calls.push(args))
  emitter('*', (...args) => calls.push(args))
  emitter('event')
  assert.deepStrictEqual(calls, [[], []])
})

check('emission returns the factory receiver regardless of the emitter receiver', xpel => {
  const owner = {}
  const other = {}
  const emitter = xpel.call(owner)
  emitter('event', () => other)
  assert.strictEqual(emitter.call(other, 'event'), owner)
  assert.strictEqual(emitter.call(other, '*'), owner)
  assert.strictEqual(xpel()('*'), undefined)
})

check('registered falsy event names retain property-key behavior', xpel => {
  for (const name of ['', 0, false, null, undefined]) {
    const emitter = xpel()
    const calls = []
    emitter(name, value => calls.push(['named', value]))
    emitter('*', value => calls.push(['wildcard', value]))
    emitter(name, 42)
    assert.deepStrictEqual(calls, [['named', 42], ['wildcard', 42]])
  }
})

check('unknown falsy names and empty calls reach wildcard listeners', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const calls = []
  emitter('*', (...args) => calls.push(args))
  for (const name of ['', 0, false, null, undefined]) {
    emitter(name, 42)
    assert.strictEqual(hasOwn(subs, name), false)
  }
  emitter()
  assert.deepStrictEqual(calls, [[42], [42], [42], [42], [42], []])
})

check('registered symbol names retain symbol identity', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const name = Symbol('event')
  const calls = []
  emitter(name, value => calls.push(['named', value]))
  emitter('*', value => calls.push(['wildcard', value]))
  emitter(name, 42)
  assert.deepStrictEqual(calls, [['named', 42], ['wildcard', 42]])
  assert.strictEqual(hasOwn(subs, name), true)
})

check('unknown symbol names reach wildcard listeners without inserting a key', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const name = Symbol('missing')
  let calls = 0
  emitter('*', () => { calls += 1 })
  emitter(name)
  assert.strictEqual(calls, 1)
  assert.strictEqual(hasOwn(subs, name), false)
})

check('unsubscribe takes an explicit name and clears every listener for that name', xpel => {
  const emitter = xpel()
  const calls = []
  const unsubscribe = emitter('first', () => calls.push('first'))
  emitter('second', () => calls.push('second one'))
  emitter('second', () => calls.push('second two'))
  assert.strictEqual(unsubscribe(), undefined)
  emitter('first')
  const result = unsubscribe('second')
  assert.strictEqual(Array.isArray(result), true)
  assert.strictEqual(result.length, 0)
  emitter('second')
  emitter('first')
  assert.deepStrictEqual(calls, ['first', 'first'])
})

check('unsubscribe retains its falsy-name no-op behavior', xpel => {
  for (const name of ['', 0, false, null, undefined]) {
    const emitter = xpel()
    let calls = 0
    const unsubscribe = emitter(name, () => { calls += 1 })
    assert.strictEqual(unsubscribe(name), name)
    emitter(name)
    assert.strictEqual(calls, 1)
  }
})

check('unsubscribe can clear wildcard or symbol subscriptions', xpel => {
  const emitter = xpel()
  const name = Symbol('event')
  let calls = 0
  const unsubscribe = emitter(name, () => { calls += 1 })
  emitter('*', () => { calls += 1 })
  unsubscribe(name)
  emitter(name)
  unsubscribe('*')
  emitter('*')
  assert.strictEqual(calls, 1)
})

check('provided named listeners survive initialization and wildcard listeners are reset', xpel => {
  const calls = []
  const listener = () => calls.push('named')
  const supplied = [listener]
  const subs = { event: supplied, '*': [() => calls.push('old wildcard')] }
  const emitter = xpel(subs)
  emitter('event')
  assert.deepStrictEqual(calls, ['named'])
  assert.strictEqual(subs.event, supplied)
  assert.strictEqual(subs['*'].length, 0)
})

check('inherited listener arrays remain usable without creating an own property', xpel => {
  const calls = []
  const subs = Object.create({ event: [() => calls.push('inherited')] })
  const emitter = xpel(subs)
  emitter('*', () => calls.push('wildcard'))
  emitter('event')
  assert.deepStrictEqual(calls, ['inherited', 'wildcard'])
  assert.strictEqual(hasOwn(subs, 'event'), false)
})

check('missing emissions do not mutate a frozen supplied map', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  let calls = 0
  emitter('*', () => { calls += 1 })
  Object.freeze(subs)
  emitter('missing')
  assert.strictEqual(calls, 1)
  assert.deepStrictEqual(Reflect.ownKeys(subs), ['*'])
})

check('an existing subscription getter is evaluated exactly once per emission', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  let reads = 0
  const calls = []
  Object.defineProperty(subs, 'event', {
    get () {
      reads += 1
      return reads === 1 ? [() => calls.push('named')] : undefined
    }
  })
  emitter('*', () => calls.push('wildcard'))
  emitter('event')
  assert.strictEqual(reads, 1)
  assert.deepStrictEqual(calls, ['named', 'wildcard'])
})

check('a missing subscription getter is evaluated exactly once without being replaced', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  let reads = 0
  let calls = 0
  const get = () => { reads += 1 }
  Object.defineProperty(subs, 'event', { get })
  emitter('*', () => { calls += 1 })
  emitter('event')
  assert.strictEqual(reads, 1)
  assert.strictEqual(calls, 1)
  assert.strictEqual(Object.getOwnPropertyDescriptor(subs, 'event').get, get)
})

check('the wildcard name bypasses the ordinary subscription lookup', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  let reads = 0
  let calls = 0
  Object.defineProperty(subs, '*', {
    get () {
      reads += 1
      return [() => { calls += 1 }]
    }
  })
  emitter('*')
  assert.strictEqual(reads, 1)
  assert.strictEqual(calls, 1)
})

check('malformed defined subscription values still throw before wildcard dispatch', xpel => {
  for (const value of [null, false, 0, 1, NaN, '', 'text', {}, () => {}]) {
    const emitter = xpel({ event: value })
    let calls = 0
    emitter('*', () => { calls += 1 })
    assert.throws(() => emitter('event'), isTypeError)
    assert.strictEqual(calls, 0)
  }
})

check('inherited non-array values still throw without changing any prototypes', xpel => {
  const prototype = { event: () => {} }
  const subs = Object.create(prototype)
  const emitter = xpel(subs)
  let calls = 0
  emitter('*', () => { calls += 1 })
  for (const name of ['event', 'toString', 'constructor']) {
    assert.throws(() => emitter(name), isTypeError)
    assert.strictEqual(hasOwn(subs, name), false)
  }
  assert.strictEqual(calls, 0)
  assert.deepStrictEqual(Object.keys(prototype), ['event'])
})

check('defined map-compatible subscriptions keep their method receiver and dispatch', xpel => {
  const calls = []
  const listeners = {
    map (callback) {
      assert.strictEqual(this, listeners)
      callback(value => calls.push(['named', value]))
    }
  }
  const emitter = xpel({ event: listeners })
  emitter('*', value => calls.push(['wildcard', value]))
  emitter('event', 42)
  assert.deepStrictEqual(calls, [['named', 42], ['wildcard', 42]])
})

check('malformed wildcard subscriptions still throw after named dispatch', xpel => {
  for (const value of [undefined, null, false, 0, {}]) {
    const subs = {}
    const emitter = xpel(subs)
    let calls = 0
    emitter('event', () => { calls += 1 })
    subs['*'] = value
    assert.throws(() => emitter('event'), isTypeError)
    assert.strictEqual(calls, 1)
  }
})

check('subscription getter errors propagate unchanged before wildcard dispatch', xpel => {
  const subs = {}
  const emitter = xpel(subs)
  const error = new Error('getter failed')
  let calls = 0
  Object.defineProperty(subs, 'event', { get () { throw error } })
  emitter('*', () => { calls += 1 })
  assert.throws(() => emitter('event'), value => value === error)
  assert.strictEqual(calls, 0)
})

check('named listener errors stop later named and wildcard listeners', xpel => {
  const emitter = xpel()
  const error = new Error('listener failed')
  const calls = []
  emitter('event', () => { calls.push('first'); throw error })
  emitter('event', () => calls.push('second'))
  emitter('*', () => calls.push('wildcard'))
  assert.throws(() => emitter('event'), value => value === error)
  assert.deepStrictEqual(calls, ['first'])
})

check('wildcard listener errors stop later wildcard listeners', xpel => {
  const emitter = xpel()
  const error = new Error('wildcard failed')
  const calls = []
  emitter('event', () => calls.push('named'))
  emitter('*', () => { calls.push('wildcard first'); throw error })
  emitter('*', () => calls.push('wildcard second'))
  assert.throws(() => emitter('event'), value => value === error)
  assert.deepStrictEqual(calls, ['named', 'wildcard first'])
})

check('adding a named listener during dispatch affects the next emission', xpel => {
  const emitter = xpel()
  const calls = []
  let added = false
  emitter('event', () => {
    calls.push('first')
    if (!added) {
      added = true
      emitter('event', () => calls.push('added'))
    }
  })
  emitter('event', () => calls.push('second'))
  emitter('event')
  assert.deepStrictEqual(calls, ['first', 'second'])
  emitter('event')
  assert.deepStrictEqual(calls, ['first', 'second', 'first', 'second', 'added'])
})

check('clearing named listeners during dispatch retains the current listener array', xpel => {
  const emitter = xpel()
  const calls = []
  const unsubscribe = emitter('event', () => {
    calls.push('first')
    unsubscribe('event')
  })
  emitter('event', () => calls.push('second'))
  emitter('*', () => calls.push('wildcard'))
  emitter('event')
  emitter('event')
  assert.deepStrictEqual(calls, ['first', 'second', 'wildcard', 'wildcard'])
})

check('in-place array appends retain map length snapshot behavior', xpel => {
  const calls = []
  let added = false
  const listeners = [() => {
    calls.push('first')
    if (!added) {
      added = true
      listeners.push(() => calls.push('added'))
    }
  }]
  const emitter = xpel({ event: listeners })
  emitter('event')
  assert.deepStrictEqual(calls, ['first'])
  emitter('event')
  assert.deepStrictEqual(calls, ['first', 'first', 'added'])
})

check('in-place array deletion skips the removed future entry', xpel => {
  const calls = []
  const listeners = [
    () => { calls.push('first'); delete listeners[1] },
    () => calls.push('removed')
  ]
  const emitter = xpel({ event: listeners })
  emitter('event')
  assert.deepStrictEqual(calls, ['first'])
})

check('wildcard listeners added by named listeners run in that same emission', xpel => {
  const emitter = xpel()
  const calls = []
  emitter('event', () => {
    calls.push('named')
    emitter('*', () => calls.push('added wildcard'))
  })
  emitter('*', () => calls.push('existing wildcard'))
  emitter('event')
  assert.deepStrictEqual(calls, ['named', 'existing wildcard', 'added wildcard'])
})

check('clearing wildcard listeners during named dispatch prevents their delivery', xpel => {
  const emitter = xpel()
  const calls = []
  const unsubscribe = emitter('event', () => {
    calls.push('named')
    unsubscribe('*')
  })
  emitter('*', () => calls.push('wildcard'))
  emitter('event')
  assert.deepStrictEqual(calls, ['named'])
})

check('changing wildcard subscriptions during their dispatch retains the current array', xpel => {
  const emitter = xpel()
  const calls = []
  const unsubscribe = emitter('*', () => {
    calls.push('first')
    unsubscribe('*')
    emitter('*', () => calls.push('replacement'))
  })
  emitter('*', () => calls.push('second'))
  emitter('*')
  emitter('*')
  assert.deepStrictEqual(calls, ['first', 'second', 'replacement'])
})

check('reentrant named emissions complete synchronously before outer delivery resumes', xpel => {
  const emitter = xpel()
  const calls = []
  emitter('event', value => {
    calls.push('first ' + value)
    if (value === 'outer') emitter('event', 'inner')
  })
  emitter('event', value => calls.push('second ' + value))
  emitter('*', value => calls.push('wildcard ' + value))
  emitter('event', 'outer')
  assert.deepStrictEqual(calls, [
    'first outer', 'first inner', 'second inner', 'wildcard inner',
    'second outer', 'wildcard outer'
  ])
})

async function loadEsm (filename) {
  const code = fs.readFileSync(filename, 'utf8')
  const loaded = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  assert.strictEqual(typeof loaded.default, 'function', filename + ' default export')
  return loaded.default
}

function loadUmd (filename, mode) {
  const sandbox = Object.create(null)
  let exported
  if (mode === 'CommonJS') {
    sandbox.module = { exports: {} }
    sandbox.exports = sandbox.module.exports
  } else if (mode === 'AMD') {
    let definitions = 0
    sandbox.define = (...args) => {
      definitions += 1
      assert.strictEqual(definitions, 1, 'one AMD definition')
      if (Array.isArray(args[0])) assert.strictEqual(args.shift().length, 0, 'no AMD dependencies')
      assert.strictEqual(args.length, 1)
      exported = args[0]()
    }
    sandbox.define.amd = {}
  }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {
    filename,
    timeout: 1000,
    contextCodeGeneration: { strings: false, wasm: false }
  })
  if (mode === 'CommonJS') exported = sandbox.module.exports
  if (mode === 'browser') exported = sandbox.xpel
  assert.strictEqual(typeof exported, 'function', filename + ' ' + mode + ' export')
  return exported
}

async function main () {
  const args = process.argv.slice(2)
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--root'),
    'Usage: node test/behavior.test.js [--root /path/to/root]')
  const root = path.resolve(args[1] || path.join(__dirname, '..'))
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.strictEqual(typeof pkg.main, 'string')
  assert.strictEqual(typeof pkg.browser, 'string')
  assert.strictEqual(typeof pkg['jsnext:main'], 'string')
  const variants = []
  variants.push(['Node package entry', require(root)])
  const source = path.join(root, 'src/index.js')
  // Published tarballs omit src; the declared package exports still all run.
  if (fs.existsSync(source)) variants.push(['source', await loadEsm(source)])
  variants.push(['ES package export', await loadEsm(path.join(root, pkg['jsnext:main']))])
  for (const file of new Set([pkg.main, pkg.browser, 'dist/xpel.min.js'])) {
    for (const mode of ['CommonJS', 'AMD', 'browser']) {
      variants.push([file + ' (' + mode + ')', loadUmd(path.join(root, file), mode)])
    }
  }
  let failed = 0
  for (const [label, xpel] of variants) {
    let passed = 0
    for (const { name, run } of checks) {
      try {
        run(xpel)
        passed += 1
      } catch (error) {
        failed += 1
        process.stderr.write('FAIL ' + label + ': ' + name + '\n  ' + error.message + '\n')
      }
    }
    process.stdout.write(label + ': ' + passed + '/' + checks.length + ' checks passed\n')
  }
  const total = variants.length * checks.length
  process.stdout.write((total - failed) + '/' + total + ' checks passed across ' + variants.length + ' entry modes\n')
  if (failed) process.exitCode = 1
}

main().catch(error => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
