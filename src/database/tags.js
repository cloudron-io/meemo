/* jslint node:true */

'use strict';

exports = module.exports = {
    get: get,
    del: del,
    update: update
};

var assert = require('assert'),
    ObjectId = require('mongodb').ObjectID,
    config = require('../config.js');

var g_collections = {};

function getCollection(userId) {
    assert.strictEqual(typeof userId, 'string');

    if (!g_collections[userId]) {
        config.db.createCollection(userId + '_tags');
        g_collections[userId] = config.db.collection(userId + '_tags');
    }

    return g_collections[userId];
}

function get(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result || []);
    });
}

function update(userId, name, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof name, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).update({ name: name }, {
        $inc: { usage: 1 },
        $set: {
            name: name
        }
    }, { upsert:true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function del(userId, tagId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof tagId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).deleteOne({ _id: new ObjectId(tagId) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}
