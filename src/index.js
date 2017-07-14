import compression from 'compression'
import express from 'express'
import bodyParser from 'body-parser'
import crypto from 'crypto'
import request from 'request'
import config from './config'

// Define constant
const APP_SECRET = config.messenger.app.secret
const VALIDATION_TOKEN = config.messenger.validation.token
const PAGE_ACCESS_TOKEN = config.messenger.page.accessToken

// Middle ware defines
/**
 * Verify that the callback came from Facebook. Using the app Secret <fro></fro>m
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-sub-signature field, located in the header
 */
const verifyRequestSignature = (req, res, buf) => {
  const signature = req.headers['x-hub-signature']

  if (!signature) {
    // eslint-disable-next-line no-console
    throw new Error('Could not validate the request signature.')
    // console.error('Could not validate the signature')
  } else {
    const elements = signature.split('=')
    // const method = elements[0]
    const signatureHash = elements[1]

    const expectedHash = crypto
      .createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex')

    if (signatureHash !== expectedHash) {
      throw new Error('Could not validate the request signature.')
    }
  }
}

const callSendAPI = msgData => {
  request(
    {
      uri: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: msgData,
    },
    (error, response, body) => {
      // eslint-disable-next-line
      if (!error && response.statusCode == 200) {
        const recipientId = body.recipient_id
        const messageId = body.message_id

        if (messageId) {
          // eslint-disable-next-line no-console
          console.log(
            'Successfully sent message with id %s to recipient %s',
            messageId,
            recipientId
          )
        } else {
          // eslint-disable-next-line no-console
          console.log(
            'Successfully called Send API for recipient %s',
            recipientId
          )
        }
      } else {
        // eslint-disable-next-line no-console
        console.error(
          'Failing calling send API',
          response.statusMessage,
          body.error
        )
      }
    }
  )
}

const sendTextMessage = (recipientId, messageText) => {
  const msgData = {
    recipient: {
      id: recipientId,
    },
    message: {
      text: messageText,
      metadata: 'DEVELOPMENT_DEFINED_METADATA',
    },
  }

  callSendAPI(msgData)
}

const receivedAuthentication = event => {
  const senderId = event.sender.id
  // const recipientID = event.recipient.id
  // const timeOfAuth = event.timestamp
  // const passThroughParam = event.optin.ref

  sendTextMessage(senderId, 'Authentication sucessfull')
}
const receivedMessage = event => {
  const senderId = event.sender.id
  const recipientId = event.recipient.id
  const timeOfMessage = event.timestamp
  const message = event.message

  // eslint-disable-next-line no-console
  console.log(
    'Received message for user %d and page %d at %d with message:',
    senderId,
    recipientId,
    timeOfMessage
  )
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(message))

  const isEcho = message.is_echo
  const messageId = message.mid
  const appId = message.app_id
  const metadata = message.metadata

  const messageText = message.text
  const messageAttachments = message.attachments
  const quickReply = message.quick_reply

  if (isEcho) {
    // eslint-disable-next-line no-console
    console.log(
      'Received echo for message %s and app %d with metadata %s',
      messageId,
      appId,
      metadata
    )
    return
  } else if (quickReply) {
    const quickReplyPayload = quickReply.payload
    // eslint-disable-next-line no-console
    console.log(
      'Quick reply for message %s with payload %s',
      messageId,
      quickReplyPayload
    )
    return
  }

  if (messageText) {
    sendTextMessage(senderId, messageText)
  } else if (messageAttachments) {
    sendTextMessage(senderId, 'Message with attachment received')
  }
}

const receivedDeliveryConfirmation = event => {
  // const senderId = event.sender.id
  // const recipientId = event.recipient.id
  const delivery = event.delivery
  const messageIds = delivery.mids
  const watermark = delivery.watermark
  // const sequenceNumber = delivery.seq

  if (messageIds) {
    messageIds.forEach(messageId => {
      // eslint-disable-next-line no-console
      console.log(
        'Received delivery confirmation for message ID: %s',
        messageId
      )
    })
  }

  // eslint-disable-next-line no-console
  console.log('All message before %d were delivered.', watermark)
}

const receivedPostback = event => {
  const senderId = event.sender.id
  const recipientId = event.recipient.id
  const timeOfPostback = event.timestamp

  const payload = event.postback.payload

  // eslint-disable-next-line no-console
  console.log(
    'Received postback for user %d and page %d with payload %s at %d',
    senderId,
    recipientId,
    payload,
    timeOfPostback
  )

  sendTextMessage(senderId, 'Postback called')
}

const receivedMessageRead = event => {
  // const senderId = event.sender.id
  // const recipientId = event.recipient.id

  const watermark = event.read.watermark
  const sequenceNumber = event.read.seq

  // eslint-disable-next-line no-console
  console.log(
    'Received message read event for watermark %d and sequence number %d',
    watermark,
    sequenceNumber
  )
}

const receivedAccountLink = event => {
  const senderId = event.sender.id
  const status = event.account_linking.status
  const authCode = event.account_linking.authorization_code

  // eslint-disable-next-line no-console
  console.log(
    'Received account link event with for user %d with status %s and auth code %s',
    senderId,
    status,
    authCode
  )
}

/**
 * Express configuration
 */
const app = express()
app.use(compression())
app.use(bodyParser.json({ verify: verifyRequestSignature }))

/**
 * Check the token used in Webhook
 * setup is the same token used here.
 */
app.get('/messenger/webhook', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VALIDATION_TOKEN
  ) {
    // eslint-disable-next-line no-console
    console.log('Validating webhook')
    res.status(200).send(req.query['hub.challenge'])
  } else {
    // eslint-disable-next-line no-console
    console.error('Failed validation. Make sure validation tokens match.')
    res.sendStatus(403)
  }
})

/**
 * Setup callback for messenger webhook.
 */
app.post('/messenger/webhook', (req, res) => {
  const data = req.body
  // Make sure this is a page subscription
  if (data.object === 'page') {
    data.entry.forEach(pageEntry => {
      // const pageId = pageEntry.id
      // const timeOfEvent = pageEntry.time

      pageEntry.messaging.forEach(messagingEvent => {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent)
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent)
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent)
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent)
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent)
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent)
        } else {
          // eslint-disable-next-line no-console
          console.log(
            'Webhook received unknow messagingEvent: ',
            messagingEvent
          )
        }
      })
    })

    // Assume all went well
    res.sendStatus(200)
  }
})

app.get('/authorize', (req, res) => {
  const accountLinkingToken = req.query.account_linking_token
  const redirectURI = req.query.redirect_uri

  const authCode = '1234567890'
  const redirectURISuccess = `${redirectURI}&authorization_code=${authCode}`

  res.send({
    accountLinkingToken,
    redirectURI,
    redirectURISuccess,
  })
})
// Start server code
const SERVER_PORT = config.server.port
const PROFILE = config.profile

app.listen(SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on port ${SERVER_PORT} ${PROFILE}`)
})
