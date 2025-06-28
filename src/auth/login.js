/*

const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const usersPath = path.join(__dirname, 'users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

async function authenticateUser(username, password) {
    const user = users.find(u => u.username === username);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;

    return user;
}

module.exports = { authenticateUser };


 */