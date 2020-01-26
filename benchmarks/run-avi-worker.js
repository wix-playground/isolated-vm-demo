const {performance} = require('perf_hooks')
const nock = require('nock')
const math = require('mathjs')
const {initPlatform, snapshotPromise} = require('../avi-worker')
const messages = require('../messages')
const TIMES = 100
const RESULTS = [];

(async () => {
  const snapshot = await snapshotPromise
  require('../fixtures')
  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})

  for (let i = 0; i < TIMES; ++i) {
    process.stdout.write(i + ' ')
    const worker = initPlatform(snapshot)

    let resolveWidgetReadyPromise
    const widgetReadyPromise = new Promise(resolve => {
      resolveWidgetReadyPromise = resolve
    })

    worker.addEventListener('message', msg => {
      // console.log(msg)
      if (msg.data.type === 'widget_ready') {
        resolveWidgetReadyPromise()
      }
    })

    const before = performance.now()

    messages.forEach(message => {
      // console.log(`sending message of type '${message.type}'`)
      worker.postMessage(message)
    })
    await widgetReadyPromise

    RESULTS.push(performance.now() - before)

    worker.terminate()
    nock.restore()
  }

  gc()

  process.stdout.write('\n')
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})
  console.log({min: math.min(RESULTS), max: math.max(RESULTS), median: math.median(RESULTS)})
})()
