/* jslint node:true */

'use strict';

exports = module.exports = {
    port: process.env.PORT || 3000,
    databaseUrl: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/guacamoly',
    _clearDatabase: clearDatabase,
    attachmentDir: process.env.ATTACHMENT_DIR || (__dirname + '/../attachments'),
    origin: process.env.APP_ORIGIN || 'http://localhost:3000'
};

var MongoClient = require('mongodb').MongoClient;

function clearDatabase(callback) {
    MongoClient.connect(exports.databaseUrl, function (error, db) {
        if (error) return callback(error);

        db.dropDatabase(callback);
    });
}
