const express = require('express')
const router = express.Router()
const { config } = require('../config');
const mysql = require('mysql')

var pool = mysql.createPool({
    connectionLimit: 20,
    host: config.server,
    user: config.user,
    password: '',
    database: config.dbName
})

router.use('/admin/', (peticion, respuesta, siguiente) => {
    if (!peticion.session.usuario) {
        peticion.flash('mensaje', 'Debe iniciar sesión')
        respuesta.redirect("/inicio")
    } else {
        siguiente()
    }
})


module.exports = router