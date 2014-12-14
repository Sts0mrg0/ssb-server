
var cont      = require('cont')
var deepEqual = require('deep-equal')
var tape      = require('tape')
var pull      = require('pull-stream')
// create 3 servers
// give them all pub servers (on localhost)
// and get them to follow each other...
var replicate = require('../plugins/replicate')
var gossip    = require('../plugins/gossip')
var friends   = require('../plugins/friends')
var logging   = require('../plugins/logging')

tape('replicate between 3 peers', function (t) {

  var u = require('./util')

  var alicePort = ~~(1024 + Math.random()*40000)
  var bobPort = ~~(1024 + Math.random()*40000)

  var aliceDb = u.createDB('test-alice', {
      port: alicePort, host: 'localhost', timeout: 2000,
      seeds: [{port: bobPort, host: 'localhost'}]
    }).use(gossip).use(friends).use(replicate)

  var alice = aliceDb.feed

  var bobDb = u.createDB('test-bob', {
      port: bobPort, host: 'localhost', timeout: 2000,
    }).use(friends).use(replicate)

  var bob = bobDb.feed

  cont.para([
    alice.add({type: 'follow', feed: bob.id, rel: 'follows'}),
    bob.add({type: 'follow', feed: alice.id, rel: 'follows'})
  ])(function () {

    bobDb.on('rpc:authorized', function (_, req) {
      console.log('AUTH', req)
    })

    var ary = []
    pull(
      bobDb.ssb.createHistoryStream({id: alice.id, seq: 0, live: true}),
      pull.through(function (data) {
        console.log(data)
        ary.push(data);
      }),
      pull.drain()
    )
    var l = 11
    var int = setInterval(function () {
      if(!--l) {
        bobDb.close()
        aliceDb.close()
        clearInterval(int)

        pull(
          bobDb.ssb.createHistoryStream({id: alice.id, sequence: 0}),
          pull.collect(function (err, _ary) {
            if(err) throw err
            t.equal(_ary.length, 12)
            t.deepEqual(ary,_ary)
            t.end()
          })
        )
      }
      alice.add({type: 'test', value: new Date()}, function (){})
    }, 200)

  })
})
