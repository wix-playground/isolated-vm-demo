'use strict';
const ivm = require('isolated-vm')
const WebSocket = require('ws')
const messages = require('./messages')
const {initPlatform, snapshot} = require('./isolated-vm-worker')

/**
 * Note that allowing untrusted users to access the v8 inspector may result in security issues.
 * Maybe it won't though, I don't know. I haven't really looked into everything the inspector can
 * do.
 */

// Create an inspector channel on port 10000
const wss = new WebSocket.Server({port: 10000});

wss.on('connection', async ws => {
  const isolate = new ivm.Isolate({
    inspector: true,
    memoryLimit: 128,
    snapshot
  })

  // Dispose inspector session on websocket disconnect
  let channel = isolate.createInspectorSession();

  const dispose = () => {
    try {
      channel.dispose()
    } catch (err) {
      console.error(err)
    }
  }

  ws.on('error', dispose);
  ws.on('close', dispose);

  // Relay messages from frontend to backend
  ws.on('message', message => {
    try {
      channel.dispatchProtocolMessage(message)
    } catch (err) {
      // This happens if inspector session was closed unexpectedly
      console.error(err)
      ws.close()
    }
  })

  // Relay messages from backend to frontend
  const send = message => {
    try {
      ws.send(message)
    } catch (err) {
      console.error(err)
      dispose()
    }
  }

  channel.onResponse = (callId, message) => send(message)
  channel.onNotification = send

  /**********************/

  const context = await isolate.createContext({inspector: true})
  const platformAPI = await initPlatform({context, devMode: true})
  messages.forEach(message => {
    console.log(`sending message of type '${message.type}'`)
    platformAPI.postMessage({data: message})
  })
});
console.log('open chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:10000');
