import compression from 'compression'
import express from 'express'
import bodyParser from 'body-parser'
import crypto from 'crypto'
import https from 'https'
import request from 'request'
import config from './config'


// Middle ware defines
const verifyRequestSignature = () => {

}

const app = express()
app.use(compression())
app.use(bodyParser.json({ verify: verifyRequestSignature }))


// Config routes
app.get('/', (req, res) => {
  res.send({ msg: 'hello world!!!' })
})

// Start server code
const SERVER_PORT = config.server.port
const PROFILE = config.profile

app.listen(SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on port ${SERVER_PORT} ${PROFILE}`)
})
