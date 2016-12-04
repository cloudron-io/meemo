/* jslint node:true */

'use strict';

exports = module.exports = {
    db: null,

    databaseUrl: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/meemo',
    _clearDatabase: clearDatabase,
    attachmentDir: process.env.ATTACHMENT_DIR || (__dirname + '/../storage')
};

var MongoClient = require('mongodb').MongoClient;

function clearDatabase(callback) {
    MongoClient.connect(exports.databaseUrl, function (error, db) {
        if (error) return callback(error);

        db.dropDatabase(callback);
    });
}
