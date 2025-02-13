const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

let db; 

(async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    console.log('Connected to database.');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1); 
  }
})();

module.exports = {
  query: async (sql, params) => {
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.query(sql, params); 
  },
  getConnection: async () => {
    if (!db) {
      throw new Error('Database not connected');
    }
    return db;
  }
};
