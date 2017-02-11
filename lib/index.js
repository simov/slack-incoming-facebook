
var argv = require('minimist')(process.argv.slice(2))

var fs = require('fs')
var path = require('path')

var request = require('@request/client')
var purest = require('purest')({request, promise: Promise})

var env, config, db, dbpath, facebook

var init = (args = {}) => (
  env = args.env || process.env.NODE_ENV || argv.env || 'development',

  config = (args.config || require(path.resolve(process.cwd(), argv.config)))[env],

  dbpath = !args.db && path.resolve(process.cwd(), argv.db),
  db = args.db || require(dbpath),

  facebook = purest({
    provider: 'facebook',
    config: args.purest || require(
      argv.purest ? path.resolve(process.cwd(), argv.purest) : '../config/purest')
  }),

  {env, config, db, facebook}
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
  ts: new Date(item.created_time).getTime() / 1000
})

var get = () => facebook
  .get(config.facebook.id + '/feed')
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
  .auth(config.facebook.token)
  .request()
  .then(([err, body]) => body.data
    .filter(event => new Date(event.created_time).getTime() > db[env].timestamp)
    .map(attachment))

var post = (attachments) => Promise.all(
  [].concat(config.slack.hook).map((hook) => new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: hook,
      json: {
        username: config.slack.username,
        icon_url: config.slack.icon_url,
        channel: config.slack.channel,
        attachments
      },
      callback: (err, res, body) => (err ? reject(err) : resolve([res, body]))
    })
  }))
)

var store = () => {
  db[env].timestamp = new Date().getTime()
  fs.writeFileSync(dbpath, JSON.stringify(db, null, 2), 'utf8')
}

var check = () =>
  get().then((attachments) => (
    attachments.length &&

    post(attachments).then((responses) => (
      store(),
      responses
    ))
  ))

module.exports = {init, attachment, get, post, store, check}
