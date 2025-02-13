const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'error', 
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json() 
  ),
  transports: [
    new transports.Console(), 
    new transports.File({ filename: 'error.log' }) 
  ],
});

module.exports = logger;
