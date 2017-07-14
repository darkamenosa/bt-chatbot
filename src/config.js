import dotenv from 'dotenv'

// Config dotenv
dotenv.config()

export default {
  profile: process.env.NODE_ENV || 'development',
  server: {
    port: process.env.PORT || 3000,
  },
  messenger: {
    app: {
      secret: process.env.MESSENGER_APP_SECRET,
    },
    validation: {
      token: process.env.MESSENGER_VALITION_TOKEN,
    },
    page: {
      accessToken: process.env.PAGE_ACCESS_TOKEN,
    },
  },
}
