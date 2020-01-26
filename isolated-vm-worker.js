const fs = require('fs')
const ivm = require('isolated-vm')
const fetch = require('node-fetch')
// require('./fixtures')
// const nock = require('nock')
// nock.recorder.rec({dont_print: true})

// get this shit from redis
const snapshot = ivm.Isolate.createSnapshot([
  {
    // language=JavaScript
    code: `
        Error.stackTraceLimit = 10

        this.self = this
        self.isPseudoWorker = true
        self.importScripts = () => {}
        self.setTimeout = cb => Promise.resolve().then(cb)
        self.clearTimeout = () => {}
        self.addEventListener = () => {}

        // https://stackoverflow.com/a/18002694
        class WorkerGlobalScope {}
        self.WorkerGlobalScope = WorkerGlobalScope
        self.__proto__ = WorkerGlobalScope.prototype;
      `,
    filename: 'file:///worker-env-setup.js'
  },
  {
    code: fs.readFileSync(require.resolve('lodash'), 'utf8'),
    filename: 'file:///lodash.js'
  },
  {
    code: fs.readFileSync('./bolt-worker.js', 'utf8'),
    filename: 'bolt-worker.js'
  },
  // any other scripts from rendererModel.platformControllersOnPage
])

module.exports = {
  snapshot,
  initPlatform: async ({context, devMode}) => {
    if (devMode) { // debugger does not works from code that arrives from snapshot :(
      await context.eval(fs.readFileSync('./bolt-worker.js', 'utf8'), {filename: 'bolt-worker.js'})
    }
    await context.eval(`self.__proto__ = WorkerGlobalScope.prototype;`, {filename: 'file:///plumbing.js'}) // TODO why do we need this again?

    await context.evalClosure(`
      self.importScripts = (...urls) => {
        $0.applySyncPromise(null, urls, {arguments: {copy: true}});
      }`,
      [async (...urls) => {
        for (const url of urls) {
          // console.log(`importing ${url}`)
          const res = await fetch(url)
          const code = await res.text()
          context.evalSync(code, {filename: url});
        }
      }],
      {arguments: {reference: true}, filename: 'file:///import-scripts.js'}
    )

    await context.evalClosure(`
      self.postMessage = (...args) => {
        $0.applyIgnored(null, args, {arguments: {copy: true}});
      }`,
      [(...args) => {
        // if (args[0].type === 'widget_ready') {
        //   const fixtures = nock.recorder.play();
        //   fixtures.unshift('\'use strict\'', 'const nock = require(\'nock\')')
        //   fs.writeFileSync('./fixtures', fixtures.join('\n'))
        //   console.log('Nock successfully saved recorded http calls')
        // }
        // console.log(args)
      }],
      {arguments: {reference: true}, filename: 'file:///post-message.js'}
    )

    const isolateOnMessage = await context.global.get('onmessage')

    return {
      postMessage: msg => isolateOnMessage.applyIgnored(null, [new ivm.ExternalCopy(msg).copyInto({release: true})])
    }
  }
}
