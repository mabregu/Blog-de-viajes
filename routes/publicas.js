const express = require('express')
const router = express.Router()
const mysql = require('mysql')
const path = require('path')
const nodemailer = require('nodemailer')
const { config } = require('../config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nmabregu@gmail.com',
        pass: '********************'
    }
})


var pool = mysql.createPool({
    connectionLimit: 20,
    host: config.server,
    user: config.user,
    password: '',
    database: config.dbName
})

function enviarCorreoBienvenida(email, nombre) {
    const opciones = {
        from: 'nmabregu@outlook.com',
        to: email,
        subject: 'Bienvenido al blog de viajes',
        text: `Hola ${nombre}`
    }
    transporter.sendMail(opciones, (error, info) => {});
}

router.get('/', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        let consulta
        let modificadorConsulta = ""
        let modificadorPagina = ""
        let pagina = 0
        const busqueda = (peticion.query.busqueda) ? peticion.query.busqueda : ""
        if (busqueda != "") {
            modificadorConsulta = `
        WHERE
        titulo LIKE '%${busqueda}%' OR
        resumen LIKE '%${busqueda}%' OR
        contenido LIKE '%${busqueda}%'
      `
            modificadorPagina = ""
        } else {
            pagina = (peticion.query.pagina) ? parseInt(peticion.query.pagina) : 0
            if (pagina < 0) {
                pagina = 0
            }
            modificadorPagina = `
        LIMIT 5 OFFSET ${pagina*5}
      `
        }
        consulta = `
      SELECT
      publicaciones.id id, titulo, resumen, fecha_hora, pseudonimo, votos, avatar
      FROM publicaciones
      INNER JOIN autores
      ON publicaciones.autor_id = autores.id
      ${modificadorConsulta}
      ORDER BY fecha_hora DESC
      ${modificadorPagina}
    `
        connection.query(consulta, (error, filas, campos) => {
            respuesta.render('index', { publicaciones: filas, busqueda: busqueda, pagina: pagina })
        })
        connection.release()
    })
})

router.get('/registro', (peticion, respuesta) => {
    respuesta.render('registro', { mensaje: peticion.flash('mensaje') })
})

router.post('/procesar_registro', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const email = peticion.body.email.toLowerCase().trim()
        const pseudonimo = peticion.body.pseudonimo.trim()
        const contrasena = peticion.body.contrasena
        const consultaEmail = `
      SELECT *
      FROM autores
      WHERE email = ${connection.escape(email)}
    `
        connection.query(consultaEmail, (error, filas, campos) => {
            if (filas.length > 0) {
                peticion.flash('mensaje', 'Email duplicado')
                respuesta.redirect('/registro')
            } else {
                const consultaPseudonimo = `
          SELECT *
          FROM autores
          WHERE pseudonimo = ${connection.escape(pseudonimo)}
        `
                connection.query(consultaPseudonimo, (error, filas, campos) => {
                    if (filas.length > 0) {
                        peticion.flash('mensaje', 'Pseudonimo duplicado')
                        respuesta.redirect('/registro')
                    } else {
                        const consulta = `
                                INSERT INTO
                                autores
                                (email, contrasena, pseudonimo)
                                VALUES (
                                  ${connection.escape(email)},
                                  ${connection.escape(contrasena)},
                                  ${connection.escape(pseudonimo)}
                                )
                              `
                        connection.query(consulta, (error, filas, campos) => {
                            if (peticion.files && peticion.files.avatar) {
                                const archivoAvatar = peticion.files.avatar
                                const id = filas.insertId
                                const nombreArchivo = `${id}${path.extname(archivoAvatar.name)}`
                                archivoAvatar.mv(`./public/avatars/${nombreArchivo}`, (error) => {
                                    const consultaAvatar = `
                                UPDATE
                                autores
                                SET avatar = ${connection.escape(nombreArchivo)}
                                WHERE id = ${connection.escape(id)}
                              `
                                    connection.query(consultaAvatar, (error, filas, campos) => {
                                        enviarCorreoBienvenida(email, pseudonimo)
                                        peticion.flash('mensaje', 'Usuario registrado con avatar')
                                        respuesta.redirect('/registro')
                                    })
                                })
                            } else {
                                enviarCorreoBienvenida(email, pseudonimo)
                                peticion.flash('mensaje', 'Usuario registrado')
                                respuesta.redirect('/registro')
                            }
                        })
                    }
                })
            }
        })
        connection.release()
    })
})

router.get('/inicio', (peticion, respuesta) => {
    respuesta.render('inicio', { mensaje: peticion.flash('mensaje') })
})

router.post('/procesar_inicio', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT *
      FROM autores
      WHERE
      email = ${connection.escape(peticion.body.email)} AND
      contrasena = ${connection.escape(peticion.body.contrasena)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                peticion.session.usuario = filas[0]
                respuesta.redirect('/admin/index')
            } else {
                peticion.flash('mensaje', 'Datos inválidos')
                respuesta.redirect('/inicio')
            }
        })
        connection.release()
    })
})

router.get('/publicacion/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${connection.escape(peticion.params.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                respuesta.render('publicacion', { publicacion: filas[0] })
            } else {
                respuesta.redirect('/')
            }
        })
        connection.release()
    })
})

router.get('/autores', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT autores.id id, pseudonimo, avatar, publicaciones.id publicacion_id, titulo
      FROM autores
      INNER JOIN
      publicaciones
      ON
      autores.id = publicaciones.autor_id
      ORDER BY autores.id DESC, publicaciones.fecha_hora DESC
    `
        connection.query(consulta, (error, filas, campos) => {
            autores = []
            ultimoAutorId = undefined
            filas.forEach(registro => {
                if (registro.id != ultimoAutorId) {
                    ultimoAutorId = registro.id
                    autores.push({
                        id: registro.id,
                        pseudonimo: registro.pseudonimo,
                        avatar: registro.avatar,
                        publicaciones: []
                    })
                }
                autores[autores.length - 1].publicaciones.push({
                    id: registro.publicacion_id,
                    titulo: registro.titulo
                })
            });
            respuesta.render('autores', { autores: autores })
        })


        connection.release()
    })
})



router.get('/publicacion/:id/votar', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${connection.escape(peticion.params.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                const consultaVoto = `
          UPDATE publicaciones
          SET
          votos = votos + 1
          WHERE id = ${connection.escape(peticion.params.id)}
        `
                connection.query(consultaVoto, (error, filas, campos) => {
                    respuesta.redirect(`/publicacion/${peticion.params.id}`)
                })
            } else {
                peticion.flash('mensaje', 'Publicación inválida')
                respuesta.redirect('/')
            }
        })
        connection.release()
    })
})



module.exports = router