/* jslint node:true */

'use strict';

exports = module.exports = {
    get: get,
    del: del,
    add: add
};

var assert = require('assert'),
    config = require('../config.js');

var g_tokens;

function getCollection() {
    if (!g_tokens) {
        console.log('Opening tokens collection');

        config.db.createCollection('tokens');
        g_tokens = config.db.collection('tokens');
    }

    return g_tokens;
}

function get(value, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection().find({ value: value }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('No token found'));
        callback(null, result[0]);
    });
}

function del(value, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection().deleteOne({ value: value }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function add(value, cloudronToken, userId, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof cloudronToken, 'string');
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection().insert({ value: value, cloudronToken: cloudronToken, userId: userId }, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result);
    });
}
