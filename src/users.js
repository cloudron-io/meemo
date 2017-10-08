/* jslint node:true */

'use strict';

exports = module.exports = {
    UserError: UserError,

    verify: verify,
    profile: profile,
    list: list
};

var assert = require('assert'),
    bcrypt = require('bcryptjs'),
    path = require('path'),
    ldapjs = require('ldapjs'),
    safe = require('safetydance'),
    util = require('util');

var LOCAL_AUTH_FILE = path.resolve(process.env.LOCAL_AUTH_FILE || './.users.json');

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

function verify(username, password, callback) {
    profile(username, true, function (error, result) {
        if (error) return callback(error);

        if (process.env.LDAP_URL) {
            var ldapClient = ldapjs.createClient({ url: process.env.LDAP_URL });
            ldapClient.on('error', function (error) {
                console.error('LDAP error', error);
                callback(new UserError(UserError.INTERNAL_ERROR, error));
            });

            var ldapDn = 'cn=' + result.username + ',' + process.env.LDAP_USERS_BASE_DN;

            ldapClient.bind(ldapDn, password, function (error) {
                if (error) return callback(new UserError(UserError.NOT_AUTHORIZED));

                callback(null, { user: result });
            });
        } else {
            bcrypt.compare(password, result.passwordHash, function (error, valid) {
                if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));
                if (!valid) return callback(new UserError(UserError.NOT_AUTHORIZED));

                // strip passwordHash
                delete result.passwordHash;

                callback(null, { user: result });
            });
        }
    });
}

// identifier may be userId, email, username
function profile(identifier, full, callback) {
    assert.strictEqual(typeof identifier, 'string');
    assert.strictEqual(typeof full, 'boolean');
    assert.strictEqual(typeof callback, 'function');

    if (process.env.LDAP_URL) {
        var ldapClient = ldapjs.createClient({ url: process.env.LDAP_URL });
        ldapClient.on('error', function (error) {
            console.error('LDAP error', error);
        });

        ldapClient.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD, function (error) {
            if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

            ldapClient.search(process.env.LDAP_USERS_BASE_DN, { filter: '(|(uid=' + identifier + ')(mail=' + identifier + ')(username=' + identifier + '))' }, function (error, result) {
                if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

                var items = [];

                result.on('searchEntry', function(entry) {
                    items.push(entry.object);
                });

                result.on('error', function (error) {
                    callback(new UserError(UserError.INTERNAL_ERROR, error));
                });

                result.on('end', function (result) {
                    if (result.status !== 0) return callback(new UserError(UserError.NOT_FOUND, 'non-zero status from LDAP search: ' + result.status));
                    if (items.length === 0) return callback(new UserError(UserError.NOT_FOUND, 'No LDAP entries found'));

                    // translate proprety names
                    items[0].id = items[0].uid;

                    if (full) return callback(null, items[0]);

                    var out = {
                        id: items[0].uid,
                        username: items[0].username,
                        displayName: items[0].displayname,
                        email: items[0].mail
                    };

                    callback(null, out);
                });
            });
        });
    } else {
        var users = safe.JSON.parse(safe.fs.readFileSync(LOCAL_AUTH_FILE));
        if (!users) return callback(new UserError(UserError.NOT_FOUND));
        if (!users[identifier]) return callback(new UserError(UserError.NOT_FOUND));

        var result = {
            id: users[identifier].username,
            username: users[identifier].username,
            displayName: users[identifier].displayName,
            email: users[identifier].email,
            passwordHash: full ? users[identifier].passwordHash : undefined
        };

        callback(null, result);
    }
}

function list(callback) {
    if (process.env.LDAP_URL) {
        var client = ldapjs.createClient({ url: process.env.LDAP_URL });
        client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD, function (error) {
            if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

            client.search(process.env.LDAP_USERS_BASE_DN, { scope: 'sub' }, function (error, res) {
                if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

                var entries = [];
                res.on('searchEntry', function(entry) {
                    var data = {
                        id: entry.object.uid,
                        username: entry.object.username,
                        displayName: entry.object.displayname
                    };

                    entries.push(data);
                });
                res.on('error', function (error) {
                    callback(new UserError(UserError.INTERNAL_ERROR, error));
                });
                res.on('end', function () {
                    callback(null, entries);
                });
            });
        });
    } else {
        var users = safe.JSON.parse(safe.fs.readFileSync(LOCAL_AUTH_FILE));
        if (!users) return callback(null, []);

        var result = Object.keys(users).map(function (u) {
            return {
                id: users[u].username,
                username: users[u].username,
                displayName: users[u].displayName
            };
        });

        callback(null, result);
    }
}
