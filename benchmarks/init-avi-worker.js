const {performance} = require('perf_hooks')
const math = require('mathjs')
const {initPlatform, snapshotPromise} = require('../avi-worker')
const TIMES = 100
const RESULTS = [];

(async () => {
  const snapshot = await snapshotPromise
  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})

  for (let i = 0; i < TIMES; ++i) {
    const before = performance.now()

    const worker = initPlatform(snapshot)

    RESULTS.push(performance.now() - before)
    worker.terminate()
  }

  gc()
  console.log({heapUsed: process.memoryUsage().heapUsed / 1000})
  console.log({min: math.min(RESULTS), max: math.max(RESULTS), median: math.median(RESULTS)})
})()
