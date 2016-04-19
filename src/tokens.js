/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    remove: remove,
    add: add
};

var assert = require('assert'),
    MongoClient = require('mongodb').MongoClient,
    config = require('./config.js');

var g_db, g_tokens;

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_db.createCollection('tokens');
        g_tokens = db.collection('tokens');

        callback(null);
    });
}

function get(value, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof callback, 'function');

    g_tokens.find({ value: value }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('No token found'));
        callback(null, result[0]);
    });
}

function remove(value, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof callback, 'function');

    g_tokens.deleteOne({ value: value }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function add(value, cloudronToken, callback) {
    assert.strictEqual(typeof value, 'string');
    assert.strictEqual(typeof cloudronToken, 'string');
    assert.strictEqual(typeof callback, 'function');

    g_tokens.insert({ value: value, cloudronToken: cloudronToken }, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result);
    });
}
