const {performance} = require('perf_hooks')
const math = require('mathjs')
const ivm = require('isolated-vm')
const {initPlatform, snapshot} = require('../isolated-vm-worker')
const TIMES = 100
const RESULTS = [];

(async () => {
  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})

  for (let i = 0; i < TIMES; ++i) {
    const before = performance.now()

    const isolate = new ivm.Isolate({snapshot})
    const context = await isolate.createContext()
    await initPlatform({context})

    RESULTS.push(performance.now() - before)
    isolate.dispose()
  }

  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})

  console.log({min: math.min(RESULTS), max: math.max(RESULTS), median: math.median(RESULTS)})
})()
