
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

var last = db[env].events.timestamp


var attachment = (event) => ({
  fallback: 'Incoming WebHook Error!',
  color: '#3b5998',
  pretext: 'На *' +
    event.start_time.slice(0, 10) + '* от *' +
    event.start_time.slice(11, 16) +
    '* ще се проведе събитие във VarnaLab',

  // works
  // author_name: 'Created by ' + event.owner.name,
  // author_link: 'https://www.facebook.com/' + event.owner.id,
  // author_icon: '...',

  title: event.name,
  title_link: 'https://www.facebook.com/events/' + event.id + '/',
  text: event.description,

  image_url: (event.cover ? event.cover.source : ''),

  // works
  // footer: 'Facebook',
  // footer_icon: 'http://i.imgur.com/3ZEu3Ip.png',
  // the timestamp is incorrect for some reason
  // ts: new Date(event.updated_time)

  mrkdwn_in: ['pretext']
})


function check () {
  facebook
    .get(config.id + '/events')
    .qs({
      fields: [
        'id',
        'cover',
        'description',
        'start_time',
        'name',
        'place',
        'timezone',
        'updated_time',
        'owner'
      ].join(',')
    })
    .auth(config.token)
    .request((err, res, body) => {
      if (err) {
        console.error(new Date().toString(), err.message, err.stack)
        return
      }

      var attachments = body.data
        .filter(event => new Date(event.updated_time).getTime() > last)
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
            last = db[env].events.timestamp = new Date(body.data[0].updated_time).getTime()
            fs.writeFileSync(path.join(__dirname, '../config/db.json'),
              JSON.stringify(db, null, 2), 'utf8')
          }
        })
      }
    })
}


check()
