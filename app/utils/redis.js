const redis = require('redis')
var config = require('../config');

let client = redis.createClient({
  url: config('redis').url,
  legacyMode: true
})
client.on('connect', () => { console.log('Redis connected') })
client.on('ready', () => { console.log('Redis is ready to be used') })
client.on('end', () => { console.log('Redis connection has been closed') })
client.on('error', (e) => { console.log('Redis error', e) })
client.on('reconnecting', (e) => { console.log('Redis is reconnecting', e) })

client.connect().catch(console.error)

module.exports = client
