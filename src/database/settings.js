/* jslint node:true */

'use strict';

exports = module.exports = {
    get: get,
    put: put
};

var assert = require('assert'),
    config = require('../config.js');

var g_collections = {};

function getCollection(userId) {
    assert.strictEqual(typeof userId, 'string');

    if (!g_collections[userId]) {
        config.db.createCollection(userId + '_settings');
        g_collections[userId] = config.db.collection(userId + '_settings');
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
            title: 'Meemo'
        });
    });
}
