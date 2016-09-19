/* jslint node:true */

'use strict';

exports = module.exports = {
    get: get,
    add: add
};

var assert = require('assert'),
    ObjectId = require('mongodb').ObjectID,
    config = require('../config.js');

var g_collections = {};

function getCollection(userId) {
    assert.strictEqual(typeof callback, 'function');

    if (!g_collections[userId]) {
        config.db.createCollection(userId + '_shares');
        g_collections[userId] = config.db.collection(userId + '_shares');
    }

    return g_collections[userId];
}

function add(userId, thingId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof callback, 'function');

    var doc = {
        thingId: thingId,
        createdAt: new Date()
    };

    getCollection(userId).insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result.insertedIds[0]);
    });
}

function get(userId, shareId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof shareId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({ _id: new ObjectId(shareId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        callback(null, result[0]);
    });
}
