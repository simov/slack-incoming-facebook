
const env = process.env.NODE_ENV || 'development'

var config = require('../config/')[env]
config.id = process.env.ID || config.id
config.hook = process.env.HOOK || config.hook
var providers = require('../config/purest')

var fs = require('fs')
var path = require('path')
var db = require('../config/db')

var request = require('@request/client')
var purest = require('purest')({request})
var facebook = purest({provider: 'facebook', config: providers})

var last = db[env].feed.timestamp


var attachment = (item) => ({
  fallback: 'Incoming WebHook Error!',
  color: '#3b5998',

  // pretext: item.name ? ('> *' + item.name + '*') : '',

  author_name: item.from.name,
  author_link: 'https://www.facebook.com/' + item.from.id,
  // author_icon: '...',

  title: item.name || (item.message && item.message.slice(0, 25)),
  title_link: item.link || item.permalink_url,
  text: item.description || item.message,

  // image_url: item.full_picture,
  thumb_url: item.full_picture,

  footer: item.type.replace(/^(\w){1}/, item.type[0].toUpperCase()),
  footer_icon: 'https://en.facebookbrand.com/wp-content/themes/fb-branding/assets/favicons/favicon-16x16.png',
  ts: new Date(item.created_time).getTime() / 1000,

  mrkdwn_in: ['pretext']
})


function check () {
  facebook
    .get(config.id + '/feed')
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
    .auth(config.token)
    .request((err, res, body) => {
      if (err) {
        console.error(new Date().toString(), err.message, err.stack)
        return
      }
      var attachments = body.data
        .filter(event => new Date(event.created_time).getTime() > last)
        .map(attachment)

      if (attachments.length) {
        request({
          method: 'POST',
          url: config.hook,
          json: {
            username: config.attachment.username,
            icon_url: config.attachment.icon_url,
            channel: config.attachment.channel,
            attachments: attachments
          },
          callback: (err, res, _body) => {
            if (err) {
              console.error(new Date().toString(), err.message, err.stack)
              return
            }
            console.log(new Date().toString(), res.statusCode, _body)
            last = db[env].feed.timestamp = new Date(body.data[0].updated_time).getTime()
            fs.writeFileSync(path.join(__dirname, '../config/db.json'),
              JSON.stringify(db, null, 2), 'utf8')
          }
        })
      }
    })
}


check()
