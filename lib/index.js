
var fs = require('fs')
var request = require('@request/client')
var purest = require('purest')({request, promise: Promise})


var get = ({api, id, timestamp}) =>
  api
    .get(id + '/feed')
    .qs({
      limit: 5,
      fields: [
        'id',
        'object_id',
        'link',
        'permalink_url',

        'created_time',
        'updated_time',

        'caption',
        'name',
        'description',

        'picture',
        'full_picture',

        'type',
        'icon',

        'from',

        'story',
        'story_tags',
        'message',
        'message_tags'
      ].join(',')
    })
    .request()
    .then(([res, body]) =>
      res.statusCode !== 200
        ? Promise.reject(new Error(error(res, body)))
        : body.data
    )
    .then((posts) => posts
      .map((post) => (post.ts = new Date(post.created_time).getTime(), post))
      .filter((post) => post.ts > timestamp)
      .sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)
    )

var error = (res, body) => [
  res.statusCode,
  res.statusMessage,
  typeof body === 'object' ? JSON.stringify(body) : body
].join(' ')

var hooks = (config) =>
  [].concat(config)
    .map(({hook, username, icon_url, channel}) => [].concat(hook)
      .map((hook) => ({hook, username, icon_url, channel}))
      .reduce((all, hook) => all.concat(hook) || all, []))
    .reduce((all, hook) => all.concat(hook) || all, [])

var post = ({hooks, attachments}) => Promise.all(
  hooks.map((hook) => new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: hook.hook,
      json: {
        username: hook.username,
        icon_url: hook.icon_url,
        channel: hook.channel,
        attachments
      },
      callback: (err, res, body) => (
        err ? reject(err) :
        res.statusCode !== 200 ? reject(new Error(error(res, body))) :
        resolve([res, body])
      )
    })
  }))
)

var attachment = (item) => ({
  fallback: 'Facebook Activity!',
  color: '#3b5998',

  author_name: item.from.name,
  author_link: 'https://www.facebook.com/' + item.from.id,

  title: item.name || (item.message && item.message.slice(0, 25)),
  title_link: item.link || item.permalink_url,
  text: item.description || item.message,

  thumb_url: item.full_picture,

  footer: item.type.replace(/^(\w){1}/, item.type[0].toUpperCase()),
  footer_icon: 'https://cdn1.iconfinder.com' +
    '/data/icons/logotypes/32/facebook-128.png',

  ts: new Date(item.created_time).getTime() / 1000,
})

var store = ({db, env, dbpath}) => {
  db[env].timestamp = new Date().getTime()
  fs.writeFileSync(dbpath, JSON.stringify(db, null, 2), 'utf8')
}

var send = ({db, env, dbpath, config, _purest}) =>
  get({
    api: purest({
      provider: 'facebook',
      config: _purest || require('../config/purest'),
      defaults: {
        auth: {
          bearer: config.facebook.token
        }
      }
    }),
    id: config.facebook.id,
    timestamp: db[env].timestamp,
  })
  .then((posts) => !posts.length ? [] :
    post({
      hooks: hooks(config.slack),
      attachments: posts.map(attachment),
    })
    .then((responses) => (
      store({
        db,
        env,
        dbpath
      }),
      responses
    ))
  )

module.exports = Object.assign(send, {
  get, error, hooks, post, attachment, store, send
})
