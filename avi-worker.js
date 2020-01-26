const fs = require('fs')
const {WebWorker} = require('node-webworker')
const fetch = require('node-fetch')

const snapshotPromise = (async () => {
  const workerScript = await fs.promises.readFile('./bolt-worker.js', 'utf-8')
  const worker = new WebWorker({
    fetch,
    snapshotSupport: true,
    script: `${workerScript}\nself.postMessage('done')`,
    scriptName: 'worker.bundle.js',
  })
  // worker.onmessage = console.log

  return new Promise(resolve => {
    worker.onmessage = msg => {
      // console.log(msg.data)
      worker.snapshot(resolve)
    }
  })
})()

module.exports = {
  snapshotPromise,
  initPlatform: snapshot => {
    const worker = new WebWorker({
      fetch: (...args) => {
        // console.log(...args)
        return fetch(...args)
      },
      initSnapshot: snapshot,
    })
    // worker.onmessage = console.log
    return worker
  }
}
