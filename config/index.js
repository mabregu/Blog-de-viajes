require('dotenv').config();

const config = {
    dev: process.env.NODE_ENV != 'production',
    port: process.env.PORT || 3000,
    server: process.env.HOST || 'localhost',
    user: process.env.USER || 'root',
    pass: process.env.PASWORD || '',
    dbName: process.env.DBNAME || 'blog',
    email: process.env.MAIL || 'tumail@blog.com',
    mailpass: process.env.MAILPASS || 'tumail@blog.com',
};

module.exports = {
    config
};