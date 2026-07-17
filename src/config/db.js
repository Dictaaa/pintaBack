const { Sequelize } = require('sequelize');
const env = require('./envs');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a Supabase PostgreSQL');
  } catch (error) {
    console.error('❌ Error al conectar PostgreSQL:', error);
  }
}

module.exports = { sequelize, connectDB };