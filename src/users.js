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

var LOCAL_AUTH_FILE = path.resolve(process.env.CLOUDRON_LOCAL_AUTH_FILE || './.users.json');

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

// https://tools.ietf.org/search/rfc4515#section-3
var sanitizeInput = function (username) {
  return username
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\\/g, '\\5c')
    .replace(/\0/g, '\\00')
    .replace(/\//g, '\\2f');
};

function verify(username, password, callback) {

    profile(username, true, function (error, result) {
        if (error) return callback(error);

        if (process.env.CLOUDRON_LDAP_URL) {
            username = sanitizeInput(username);

            var ldapClient = ldapjs.createClient({ url: process.env.CLOUDRON_LDAP_URL });
            ldapClient.on('error', function (error) {
                console.error('LDAP error', error);
                callback(new UserError(UserError.INTERNAL_ERROR, error));
            });

            var ldapDn = 'cn=' + result.username + ',' + process.env.CLOUDRON_LDAP_USERS_BASE_DN;

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

    if (process.env.CLOUDRON_LDAP_URL) {
        identifier = sanitizeInput(identifier);

        var ldapClient = ldapjs.createClient({ url: process.env.CLOUDRON_LDAP_URL });
        ldapClient.on('error', function (error) {
            console.error('LDAP error', error);
        });

        ldapClient.bind(process.env.CLOUDRON_LDAP_BIND_DN, process.env.CLOUDRON_LDAP_BIND_PASSWORD, function (error) {
            if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

            ldapClient.search(process.env.CLOUDRON_LDAP_USERS_BASE_DN, { filter: '(|(uid=' + identifier + ')(mail=' + identifier + ')(username=' + identifier + ')(sAMAccountName=' + identifier + '))' }, function (error, result) {
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

                    if (full) return callback(null, items[0]);

                    var out = {
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
            username: users[identifier].username,
            displayName: users[identifier].displayName,
            email: users[identifier].email,
            passwordHash: full ? users[identifier].passwordHash : undefined
        };

        callback(null, result);
    }
}

function list(callback) {
    if (process.env.CLOUDRON_LDAP_URL) {
        var client = ldapjs.createClient({ url: process.env.CLOUDRON_LDAP_URL });
        client.bind(process.env.CLOUDRON_LDAP_BIND_DN, process.env.CLOUDRON_LDAP_BIND_PASSWORD, function (error) {
            if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

            client.search(process.env.CLOUDRON_LDAP_USERS_BASE_DN, { scope: 'sub' }, function (error, res) {
                if (error) return callback(new UserError(UserError.INTERNAL_ERROR, error));

                var entries = [];
                res.on('searchEntry', function(entry) {
                    var data = {
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
                username: users[u].username,
                displayName: users[u].displayName
            };
        });

        callback(null, result);
    }
}
