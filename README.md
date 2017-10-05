
<div align="center">
  <img src="media/xpel.png" alt=""/>
</div>
<div align="center">
  <strong>Tiny single function event-emitter/pubsub</strong>
</div>
<div align="center">
  <a href="https://npmjs.org/package/xpel">
    <img src="https://img.shields.io/npm/v/xpel.svg?style=flat-square" alt="npm package version" />
  </a>
  <a href="https://npmjs.org/package/xpel">
  <img src="https://img.shields.io/npm/dm/xpel.svg?style=flat-square" alt="npm downloads" />
  </a>
  <a href="https://github.com/feross/standard">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square" alt="standard JS linter" />
  </a>
  <a href="https://github.com/prettier/prettier">
    <img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg?style=flat-square" alt="prettier code formatting" />
  </a>
  <a href="https://travis-ci.org/tiaanduplessis/xpel">
    <img src="https://img.shields.io/travis/tiaanduplessis/xpel.svg?style=flat-square" alt="travis ci build status" />
  </a>
  <a href="https://github.com/tiaanduplessis/xpel/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/xpel.svg?style=flat-square" alt="project license" />
  </a>
  <a href="http://makeapullrequest.com">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="make a pull request" />
  </a>
</div>
<br>
<div align="center">
  <a href="https://github.com/tiaanduplessis/xpel/watchers">
    <img src="https://img.shields.io/github/watchers/tiaanduplessis/xpel.svg?style=social" alt="Github Watch Badge" />
  </a>
  <a href="https://github.com/tiaanduplessis/xpel/stargazers">
    <img src="https://img.shields.io/github/stars/tiaanduplessis/xpel.svg?style=social" alt="Github Star Badge" />
  </a>
  <a href="https://twitter.com/intent/tweet?text=Check%20out%20xpel!%20https://github.com/tiaanduplessis/xpel%20%F0%9F%91%8D">
    <img src="https://img.shields.io/twitter/url/https/github.com/tiaanduplessis/xpel.svg?style=social" alt="Tweet" />
  </a>
</div>
<br>
<div align="center">
  Built with ❤︎ by <a href="https://github.com/tiaanduplessis">tiaanduplessis</a> and <a href="https://github.com/tiaanduplessis/xpel/contributors">contributors</a>
</div>

<h2>Table of Contents</h2>
<details>
  <summary>Table of Contents</summary>
  <li><a href="#install">Install</a></li>
  <li><a href="#usage">Usage</a></li>
  <li><a href="#contribute">Contribute</a></li>
  <li><a href="#license">License</a></li>
</details>

## Install

[![Greenkeeper badge](https://badges.greenkeeper.io/tiaanduplessis/xpel.svg)](https://greenkeeper.io/)

```sh
$ npm install xpel
# OR
$ yarn add xpel
```

## Usage

```js
const xpel = require('xpel')

const emitter = xpel()

emitter('foo', data => console.log('foo:', data))
const unsubBar = emitter('bar', data => console.log('bar:', data))
emitter('bar', data => console.log('bar2:', data))
const unsubFoo = emitter('foo', data => console.log('foo2:', data))

// listen to all events
emitter('*', () => console.log('Things are happening!'))

// Emit
emitter('foo', 5)

// unsub foo
unsubFoo('foo')

emitter('foo', 'nothing emitted')
emitter('bar', 5)

// unsub bar
unsubBar('bar')

emitter('bar', 'baz')
emitter('foo', 'baz')

// foo: 5
// foo2: 5
// Things are happening!
// Things are happening!
/// bar: 5
// bar2: 5
// Things are happening!
// Things are happening!
// Things are happening!

```

## Contributing

Contributions are welcome!

1. Fork it.
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

Or open up [a issue](https://github.com/tiaanduplessis/xpel/issues).

## License

Licensed under the MIT License.
