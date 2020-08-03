const express = require('express')
const { config } = require('./config');
const aplicacion = express()
const bodyParser = require('body-parser')
const session = require('express-session')
const flash = require('express-flash')
const fileUpload = require('express-fileupload')

const rutasMiddleware = require('./routes/middleware')
const rutasPublicas = require('./routes/publicas')
const rutasPrivadas = require('./routes/privadas')
const rutasPublicaciones = require('./routes/reto')

aplicacion.use(bodyParser.json())
aplicacion.use(bodyParser.urlencoded({ extended: true }))
aplicacion.set("view engine", "ejs")
aplicacion.use(session({ secret: 'token-muy-secreto', resave: true, saveUninitialized: true }));
aplicacion.use(flash())
aplicacion.use(express.static('public'))
aplicacion.use(fileUpload())

aplicacion.use(rutasMiddleware)
aplicacion.use(rutasPublicas)
aplicacion.use(rutasPrivadas)
aplicacion.use(rutasPublicaciones)

aplicacion.listen(config.port, () => {
    console.log(`Servidor iniciado en http://localhost:${config.port}`);
})