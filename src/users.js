/* jslint node:true */

'use strict';

exports = module.exports = {
    UserError,

    upsert,
    profile,
    list
};

var assert = require('assert'),
    path = require('path'),
    safe = require('safetydance'),
    util = require('util');

function UserError(code, messageOrError) {
    assert.strictEqual(typeof code, 'string');

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.code = code;
    this.message = messageOrError || code;
}
util.inherits(UserError, Error);

UserError.NOT_FOUND = 'not found';
UserError.NOT_AUTHORIZED = 'not authorized';
UserError.INTERNAL_ERROR = 'internal error';

const USERS_FILEPATH = path.resolve(process.env.CLOUDRON_USERS_FILEPATH || '.users.json');

function upsert(username, email, displayName) {
    assert.strictEqual(typeof username, 'string');
    assert.strictEqual(typeof email, 'string');
    assert.strictEqual(typeof displayName, 'string');

    const users = safe.JSON.parse(safe.fs.readFileSync(USERS_FILEPATH)) || {};
    users[username] = {
        username,
        displayName,
        email
    };

    safe.fs.writeFileSync(USERS_FILEPATH, JSON.stringify(users, null, 4));
}

function profile(userId, full, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof full, 'boolean');
    assert.strictEqual(typeof callback, 'function');

    const users = safe.JSON.parse(safe.fs.readFileSync(USERS_FILEPATH));
    if (!users) return callback(new UserError(UserError.NOT_FOUND));
    if (!users[userId]) return callback(new UserError(UserError.NOT_FOUND));

    const result = {
        username: users[userId].username,
        displayName: users[userId].displayName,
        email: users[userId].email,
        passwordHash: full ? users[userId].passwordHash : undefined
    };

    callback(null, result);
}

function list(callback) {
    var users = safe.JSON.parse(safe.fs.readFileSync(USERS_FILEPATH));
    if (!users) return callback(null, []);

    var result = Object.keys(users).map(function (u) {
        return {
            username: users[u].username,
            displayName: users[u].displayName
        };
    });

    callback(null, result);
}
