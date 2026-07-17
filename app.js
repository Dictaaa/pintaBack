// src/app.js
const express = require('express');
require('express-async-errors');         // captura async/await
const cors = require('cors');
const morgan = require('morgan');
const path    = require('path');

const { connectDB } = require('./src/config/db');
const routes = require('./src/routes');      // index.js que exporta todas
const errorHandler = require('./src/middlewares/error.handler');

connectDB();                             // conecta BD

const app = express();

app.use(cors());
//app.use(morgan('dev'));                // Middleware que muestra logs HTTP
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/v1', routes);              // prefijo global

app.use(errorHandler);                   // manejador 4 parámetros

module.exports = app;