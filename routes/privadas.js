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

router.get('/admin/index', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT *
      FROM publicaciones
      WHERE
      autor_id = ${connection.escape(peticion.session.usuario.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            respuesta.render('admin/index', { usuario: peticion.session.usuario, mensaje: peticion.flash('mensaje'), publicaciones: filas })
        })
        connection.release()
    })
})

router.get('/admin/procesar_cerrar_sesion', (peticion, respuesta) => {
    peticion.session.destroy();
    respuesta.redirect("/")
})

router.get('/admin/agregar', (peticion, respuesta) => {
    respuesta.render('admin/agregar', { mensaje: peticion.flash('mensaje'), usuario: peticion.session.usuario })
})

router.post('/admin/procesar_agregar', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const date = new Date()
        const fecha = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
        const consulta = `
      INSERT INTO
      publicaciones
      (titulo, resumen, contenido, autor_id, fecha_hora)
      VALUES
      (
        ${connection.escape(peticion.body.titulo)},
        ${connection.escape(peticion.body.resumen)},
        ${connection.escape(peticion.body.contenido)},
        ${connection.escape(peticion.session.usuario.id)},
        ${connection.escape(fecha)}
      )
    `
        connection.query(consulta, (error, filas, campos) => {
            peticion.flash('mensaje', 'Publicación agregada')
            respuesta.redirect("/admin/index")
        })
        connection.release()
    })
})

router.get('/admin/editar/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      SELECT * FROM publicaciones
      WHERE
      id = ${connection.escape(peticion.params.id)}
      AND
      autor_id = ${connection.escape(peticion.session.usuario.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                respuesta.render('admin/editar', { publicacion: filas[0], mensaje: peticion.flash('mensaje'), usuario: peticion.session.usuario })
            } else {
                peticion.flash('mensaje', 'Operación no permitida')
                respuesta.redirect("/admin/index")
            }
        })
        connection.release()
    })
})

router.post('/admin/procesar_editar', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        console.log(peticion.body.contenido);
        const consulta = `
      UPDATE publicaciones
      SET
      titulo = ${connection.escape(peticion.body.titulo)},
      resumen = ${connection.escape(peticion.body.resumen)},
      contenido = ${connection.escape(peticion.body.contenido)}
      WHERE
      id = ${connection.escape(peticion.body.id)}
      AND
      autor_id = ${connection.escape(peticion.session.usuario.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas && filas.changedRows > 0) {
                peticion.flash('mensaje', 'Publicación editada')
            } else {
                peticion.flash('mensaje', 'Publicación no editada')
            }
            respuesta.redirect("/admin/index")
        })
        connection.release()
    })
})

router.get('/admin/procesar_eliminar/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
      DELETE
      FROM
      publicaciones
      WHERE
      id = ${connection.escape(peticion.params.id)}
      AND
      autor_id = ${connection.escape(peticion.session.usuario.id)}
    `
        connection.query(consulta, (error, filas, campos) => {
            if (filas && filas.affectedRows > 0) {
                peticion.flash('mensaje', 'Publicación eliminada')
            } else {
                peticion.flash('mensaje', 'Publicación no eliminada')
            }
            respuesta.redirect("/admin/index")
        })
        connection.release()
    })
})

module.exports = router