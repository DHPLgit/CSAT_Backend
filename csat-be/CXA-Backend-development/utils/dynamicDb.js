// const mysql = require('mysql2');

// const dynamicDb = async (dbName) => {
//     const connection = mysql.createConnection({
//         host: 'localhost',
//         user: 'root',
//         password: '',
//         port: 3306
//     });

//     // Check and create the database if it doesn't exist
//     await new Promise((resolve, reject) => {
//         connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
//             if (err) {
//                 reject(err);
//             } else {
//                 console.log(`Database ${dbName} ensured.`);
//                 resolve();
//             }
//         });
//     });

//     // Connect to the dynamic database
//     return mysql.createConnection({
//         host: 'localhost',
//         user: 'root',
//         password: '',
//         database: dbName,
//         port: 3306
//     });
// };

// module.exports = dynamicDb;

const mysql = require('mysql2/promise');

const dynamicDb = async (dbName) => {
    const connection = await mysql.createConnection({
        host: 'nps2024.c77lbckdfmrs.us-west-2.rds.amazonaws.com',
        user: 'admin',
        password: 'Admin2024',
        database: dbName, // Ensure this is 'nps_simman10'
    });
    return connection;
};

module.exports = dynamicDb;
