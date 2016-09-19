/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    put: put
};

var assert = require('assert'),
    config = require('../config.js'),
    MongoClient = require('mongodb').MongoClient;

var g_db;
var g_collections = {};

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;

        callback(null);
    });
}

function getCollection(userId) {
    assert.strictEqual(typeof userId, 'string');

    if (!g_collections[userId]) {
        g_db.createCollection(userId + '_settings');
        g_collections[userId] = g_db.collection(userId + '_settings');
    }

    return g_collections[userId];
}

function put(userId, settings, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof settings, 'object');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).update({ type: 'frontend' }, { type: 'frontend', value: settings }, { upsert: true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function get(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({ type: 'frontend' }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result[0] ? result[0].value : {
            title: 'Guacamoly'
        });
    });
}
