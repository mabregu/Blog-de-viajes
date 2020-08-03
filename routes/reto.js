const express = require('express')
const router = express.Router()
const mysql = require('mysql')
const path = require('path')
const nodemailer = require('nodemailer')
const {
    config
} = require('../config');
const sindatos = 'recurso no encontrado';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.email,
        pass: config.mailpass
    }
})

var pool = mysql.createPool({
    connectionLimit: 20,
    host: config.server,
    user: config.user,
    password: '',
    database: config.dbName
})

function enviarPublicacion(email, publicacion) {
    const opciones = {
        from: config.email,
        to: email,
        subject: 'Nueva publicación',
        text: `Su publicacion titulada "${publicacion.titulo}", con resumen "${publicacion.resumen}" y contenido "${publicacion.contenido}" se realizo con exito.`
    }
    transporter.sendMail(opciones, (error, info) => {});
}

/**
 * GET /api/v1/publicaciones
 * 
 * JSON con todas las publicaciones.
 * 
 * GET /api/v1/publicaciones?busqueda=<palabra>
 * 
 * JSON con todas las publicaciones que tengan la palabra < palabra > en el título, contenido o resumen.
 */
router.get('/api/v1/publicaciones', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        let consulta = `SELECT * FROM publicaciones`;
        let modificadorConsulta = ""
        let busqueda = (peticion.query.busqueda) ? peticion.query.busqueda : ""
        if (busqueda != "") {
            modificadorConsulta = `
                WHERE
                titulo LIKE '%${busqueda}%' OR
                resumen LIKE '%${busqueda}%' OR
                contenido LIKE '%${busqueda}%'
            `;
            consulta += modificadorConsulta;
        }
        connection.query(consulta, (error, filas, campos) => {
            respuesta.status(200).json({
                datos: filas,
                mensaje: 'listado de publicaciones'
            });
        })
        connection.release()
    })
})

/**
 * GET /api/v1/publicaciones/<id>
 * 
 * Publicación con id = < id > .Considera cuando el id no existe.
 */
router.get('/api/v1/publicaciones/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
                SELECT *
                FROM publicaciones
                WHERE id = ${connection.escape(peticion.params.id)}
            `
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                respuesta.status(200).json({
                    datos: filas,
                    mensaje: 'publicación encontrada'
                });
            } else {
                respuesta.status(404).json({
                    mensaje: sindatos
                });
            }
        })
        connection.release()
    })
})

/**
 * GET /api/v1/autores
 * 
 * JSON con todos los autores.
 */
router.get('/api/v1/autores', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        let consulta = `SELECT * FROM autores`;
        connection.query(consulta, (error, filas, campos) => {
            respuesta.status(200).json({
                datos: filas,
                mensaje: 'listado de autores'
            });
        })
        connection.release()
    })
})

/**
 * GET /api/v1/autores/<id>
 * 
 * JSON con la información del autor con id = < id > y este contiene sus publicaciones.Considera cuando el id no existe.
 */
router.get('/api/v1/autores/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const consulta = `
            SELECT p.id, titulo, resumen, fecha_hora, pseudonimo, votos, avatar
            FROM autores a
            inner join publicaciones p on p.autor_id = a.id
            WHERE a.id = ${connection.escape(peticion.params.id)}
        `;
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                respuesta.status(200).json({
                    datos: filas,
                    mensaje: 'autor encontrado'
                });
            } else {
                respuesta.status(404).json({
                    mensaje: sindatos
                });
            }
        })
        connection.release()
    })
})

/**
 *  POST /api/v1/autores 
 * 
 * Crea un autor dado un pseudónimo, email, contraseña.Validar peticiones con pseudónimos duplicados o email duplicados.Devuelve un JSON con el objeto creado.
 */
router.post('/api/v1/autores', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        const email = peticion.body.email.toLowerCase().trim()
        const pseudonimo = peticion.body.pseudonimo.trim()
        const contrasena = peticion.body.contrasena
        const consultaEmail = `
            SELECT *
            FROM autores
            WHERE email = ${connection.escape(email)}
        `;

        connection.query(consultaEmail, (error, filas, campos) => {
            if (filas.length > 0) {
                respuesta.status(404).json({
                    mensaje: 'email duplicado'
                });
            } else {
                const consultaPseudonimo = `
                    SELECT * FROM autores
                    WHERE pseudonimo = ${connection.escape(pseudonimo)}
                `;
                connection.query(consultaPseudonimo, (error, filas, campos) => {
                    if (filas.length > 0) {
                        respuesta.status(404).json({
                            mensaje: 'pseudonimo duplicado'
                        });
                    } else {
                        const consulta = `
                            INSERT INTO autores (email, contrasena, pseudonimo)
                            VALUES (
                                ${connection.escape(email)},
                                ${connection.escape(contrasena)},
                                ${connection.escape(pseudonimo)}
                            )
                        `;
                        connection.query(consulta, (error, filas, campos) => {
                            respuesta.status(201).json({
                                datos: `email ${email} pseudonimo ${pseudonimo}`,
                                mensaje: 'objeto creado'
                            });
                        })
                    }
                })
            }
        })
        connection.release()
    })
})

/**
 *  POST /api/v1/publicaciones?email=<email>&contrasena=<contrasena>
 * 
 * Crea una publicación para el usuario con < email > = email, si este se puede validar correctamente con la contraseña.Se le envía un título, resumen y contenido.Devuelve un JSON con el objeto creado.
 */
router.post('/api/v1/publicaciones', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        let email = peticion.body.email.toLowerCase().trim();
        let contrasena = peticion.body.contrasena;
        const date = new Date()
        let fecha = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        let titulo = peticion.body.titulo;
        let resumen = peticion.body.resumen;
        let contenido = peticion.body.contenido;
        let consulta = `
            SELECT *
            FROM autores
            WHERE email = ${connection.escape(email)} AND
            contrasena = ${connection.escape(contrasena)}
        `;
        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                consulta = `
                    INSERT INTO publicaciones (titulo, resumen, contenido, autor_id, fecha_hora) VALUES
                    (
                        ${connection.escape(titulo)},
                        ${connection.escape(resumen)},
                        ${connection.escape(contenido)},
                        ${connection.escape(filas[0].id)},
                        ${connection.escape(fecha)}
                    )
                `;
                connection.query(consulta, (error, filas, campos) => {
                    let publicacion = {
                        titulo: titulo,
                        resumen: resumen,
                        contenido: contenido,
                    };
                    enviarPublicacion(email, publicacion);
                    respuesta.status(201).json({
                        datos: `titulo ${titulo} resumen ${resumen} contenido ${contenido}`,
                        mensaje: 'objeto creado'
                    });
                })
            } else {
                respuesta.status(404).json({
                    mensaje: sindatos
                });
            }
        })
        connection.release()
    })
})

/**
 * DELETE /api/v1/publicaciones/<id>?email=<email>&contrasena=<contrasena>
 * 
 * Elimina la publicación si las credenciales son correctas y la publicación le pertenece al usuario.
 */
router.delete('/api/v1/publicaciones/:id', (peticion, respuesta) => {
    pool.getConnection((err, connection) => {
        let email = peticion.body.email.toLowerCase().trim();
        let contrasena = peticion.body.contrasena;
        let consulta = `
            SELECT * FROM autores WHERE 
            email = ${connection.escape(email)} AND
            contrasena = ${connection.escape(contrasena)}
        `;

        connection.query(consulta, (error, filas, campos) => {
            if (filas.length > 0) {
                consulta = `
                    DELETE FROM publicaciones WHERE id = ${connection.escape(peticion.params.id)} 
                    AND autor_id = ${filas[0].id}
                `;
                connection.query(consulta, (error, filas, campos) => {
                    if (filas && filas.affectedRows > 0) {
                        respuesta.status(200).json({
                            mensaje: 'objeto eliminado'
                        });
                    } else {
                        respuesta.status(404).json({
                            mensaje: sindatos
                        });
                    }
                })
            } else {
                respuesta.status(404).json({
                    mensaje: sindatos
                });
            }
        })
        connection.release()
    })
})

module.exports = router