const {performance} = require('perf_hooks')
const nock = require('nock')
const math = require('mathjs')
const ivm = require('isolated-vm')
const {initPlatform, snapshot} = require('../isolated-vm-worker')
const messages = require('../messages')
const TIMES = 100
const RESULTS = [];

(async () => {
  require('../fixtures')
  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})

  for (let i = 0; i < TIMES; ++i) {
    process.stdout.write(i + ' ')
    const isolate = new ivm.Isolate({snapshot})
    const context = await isolate.createContext()
    const platformAPI = await initPlatform({context})

    let resolveWidgetReadyPromise
    const widgetReadyPromise = new Promise(resolve => {
      resolveWidgetReadyPromise = resolve
    })

    await context.evalClosure(`
      self.postMessage = (...args) => {
        $0.applyIgnored(null, args, {arguments: {copy: true}});
      }`,
      [(...args) => {
        // console.log(...args)
        if (args[0].type === 'widget_ready') {
          resolveWidgetReadyPromise()
        }
      }],
      {arguments: {reference: true}, filename: 'file:///post-message.js'}
    )

    const before = performance.now()

    messages.forEach(message => {
      // console.log(`sending message of type '${message.type}'`)
      platformAPI.postMessage({data: message})
    })
    await widgetReadyPromise

    RESULTS.push(performance.now() - before)

    isolate.dispose()
  }

  nock.restore()
  gc()

  process.stdout.write('\n')
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})
  console.log({min: math.min(RESULTS), max: math.max(RESULTS), median: math.median(RESULTS)})
})()
