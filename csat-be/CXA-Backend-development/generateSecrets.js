const crypto = require('crypto');

const generateSecret = (length) => {
    return crypto.randomBytes(length).toString('hex');
};

const accessTokenSecret = generateSecret(32); // 32 bytes = 256 bits
const refreshTokenSecret = generateSecret(32);

console.log(`ACCESS_TOKEN_SECRET=${accessTokenSecret}`);
console.log(`REFRESH_TOKEN_SECRET=${refreshTokenSecret}`);
