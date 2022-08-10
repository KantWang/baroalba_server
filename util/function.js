const { Router } = require("express");
const mysql = require("mysql2/promise");
  
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 1000,
    multipleStatements: true,
});

module.exports = pool;
