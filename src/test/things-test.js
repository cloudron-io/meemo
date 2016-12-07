'use strict';

/* global it:false */
/* global describe:false */
/* global before:false */
/* global after:false */

var expect = require('expect.js'),
    config = require('../config.js'),
    logic = require('../logic.js');

describe('Things', function () {
    function setup(done) {
        config._clearDatabase(done);
    }

    function cleanup(done) {
        config._clearDatabase(done);
    }

    describe('extractURLs',  function () {
        before(setup);
        after(cleanup);

        it('succeeds with one url', function () {
            var test = 'Some content with a url http://meemo.minimal-space.de/';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(1);
            expect(urls[0]).to.equal('http://meemo.minimal-space.de/');
        });

        it('succeeds with multiple urls on one line', function () {
            var test = 'Some content with a url http://meemo.minimal-space.de/ and http://meemo.minimal-space.de/timestwo with even more http://meemo.minimal-space.de/cheerio.html bar';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(3);
            expect(urls[0]).to.equal('http://meemo.minimal-space.de/');
            expect(urls[1]).to.equal('http://meemo.minimal-space.de/timestwo');
            expect(urls[2]).to.equal('http://meemo.minimal-space.de/cheerio.html');
        });

        it('succeeds with multiple urls on multiple lines', function () {
            var test = 'Some content with a url http://meemo.minimal-space.de/ and http://meemo.minimal-space.de/timestwo with \n even more http://meemo.minimal-space.de/cheerio.html bar';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(3);
            expect(urls[0]).to.equal('http://meemo.minimal-space.de/');
            expect(urls[1]).to.equal('http://meemo.minimal-space.de/timestwo');
            expect(urls[2]).to.equal('http://meemo.minimal-space.de/cheerio.html');
        });

        it('filters out duplicate links', function () {
            var test = 'Some content with a url http://meemo.minimal-space.de/cheerio.html and http://meemo.minimal-space.de/timestwo with \n even more http://meemo.minimal-space.de/cheerio.html bar';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(2);
            expect(urls[0]).to.equal('http://meemo.minimal-space.de/cheerio.html');
            expect(urls[1]).to.equal('http://meemo.minimal-space.de/timestwo');
        });

        it('succeeds with multiple urls and #', function () {
            var test = 'Some content with a url http://meemo.minimal-space.de/#/ and http://meemo.minimal-space.de/time#stwo with even more http://meemo.minimal-space.de/cheerio.html#11 http://meemo.minimal-space.de/cheerio.html#11/give_me_more bar';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(4);
            expect(urls[0]).to.equal('http://meemo.minimal-space.de/#/');
            expect(urls[1]).to.equal('http://meemo.minimal-space.de/time#stwo');
            expect(urls[2]).to.equal('http://meemo.minimal-space.de/cheerio.html#11');
            expect(urls[3]).to.equal('http://meemo.minimal-space.de/cheerio.html#11/give_me_more');
        });

        it('does not extract urls from inline code blocks', function () {
            var test = 'Some code `content with a url http://meemo.minimal-space.de/` end';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(0);
        });

        it('does not extract urls from code blocks', function () {
            var test = 'Some code \n ```content with a url http://meemo.minimal-space.de/``` \n end';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(0);
        });

        it('does not extract markdown links', function () {
            var test = 'Test http://meemo.minimal-space.de/#/ spacer [Emphasis](#Emphasis) foobar [some link](http://meemo.minimal-space.de/#/)';

            var urls = logic.extractURLs(test);
            expect(urls.length).to.equal(1);
        });
    });

    describe('extractTags',  function () {
        before(setup);
        after(cleanup);

        it('succeeds with one tag', function () {
            var test = 'Hello #tag there!';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('tag');
        });

        it('succeeds with an umlaut tag', function () {
            var test = 'Kochen in der #küche!';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('küche');
        });

        it('succeeds with a tag starting with numbers', function () {
            var test = 'Hello #1337tag there!';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('1337tag');
        });

        it('succeeds with multiple tags', function () {
            var test = 'Hello #tag there! more #foobar #house tags';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(3);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
        });

        it('succeeds with multiple tags on multiple lines', function () {
            var test = 'Hello #tag there! more #foobar #house tags \n #other tags in #second line';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(5);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
            expect(tags[3]).to.equal('other');
            expect(tags[4]).to.equal('second');
        });

        it('succeeds with multiple tags together', function () {
            var test = 'Hello #tag there! more #foobar#house tags';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(3);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
        });

        it('ignores # in urls', function () {
            var test = 'Hello #tag there! more http://meemo.minimal-space.de/#11/52.5194/13.3456 tags';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('tag');
        });

        it('extract tags from urls ending with a tag in multiple urls', function () {
            var test = 'Hello #tag there! more http://meemo.minimal-space.de/#11/52.5194/13.3456 tags foo  http://meemo.minimal-space.de/#11/52.5194/13.3456#bar';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(2);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('bar');
        });

        it('succeeds for tags at the beginning', function () {
            var test = '#nad #and #we #do #this #more #often #so #we #can #produce #a #hell #of #a #lot #schlagworte';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(17);
            expect(tags).to.eql(['nad', 'and', 'we', 'do', 'this', 'more', 'often', 'so', 'we', 'can', 'produce', 'a', 'hell', 'of', 'a', 'lot', 'schlagworte' ]);
        });

        it('succeeds for tags starting with other tags', function () {
            var test = '#nad #and #we #do #this#more #often #so #we #can #produce#a#hell #of #a #lot #schlagworte';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(17);
            expect(tags).to.eql(['nad', 'and', 'we', 'do', 'this', 'more', 'often', 'so', 'we', 'can', 'produce', 'a', 'hell', 'of', 'a', 'lot', 'schlagworte' ]);
        });

        it('does not extract tags from inline code blocks', function () {
            var test = 'Some code `content with a #toggly tag` end';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(0);
        });

        it('does not extract tags from code blocks', function () {
            var test = 'Some code \n ```content with a #taggly tag``` \n end';

            var tags = logic.extractTags(test);
            expect(tags.length).to.equal(0);
        });
    });

    describe('richContent',  function () {
        before(setup);
        after(cleanup);

        var USER_ID = 'testUserId';

        it('shortens long URLs', function (done) {
            var longUrl = 'https://example.com/nebulade/status/761263459120115716/761263459120115716/761263459120115716/?bar=bazhashsometihg=foo#more=so';
            var content = 'Hello this is a too long url ' + longUrl + ' yeah';

            var thing = {
                tags: logic.extractTags(content),
                externalContent: [{ type: logic.TYPE_UNKNOWN, url: longUrl }],
                attachments: [],
                content: content,
            };

            logic.facelift(USER_ID, thing, function (error, result) {
                expect(error).to.equal(null);
                expect(result).to.equal('Hello this is a too long url [example.com/nebulade/status/761263459120...](' + longUrl + ') yeah');

                done();
            });
        });

        it('succeeds for tags starting at the beginning', function (done) {
            var content = '#nad #and #we #do #this #more #often #So #we #can #produce #a #hell #of #a #lot #schlagworte';
            var thing = {
                tags: logic.extractTags(content),
                externalContent: [],
                attachments: [],
                content: content,
            };

            logic.facelift(USER_ID, thing, function (error, result) {
                expect(error).to.equal(null);
                expect(result).to.equal('[#nad](#search?#nad) [#and](#search?#and) [#we](#search?#we) [#do](#search?#do) [#this](#search?#this) [#more](#search?#more) [#often](#search?#often) [#so](#search?#so) [#we](#search?#we) [#can](#search?#can) [#produce](#search?#produce) [#a](#search?#a) [#hell](#search?#hell) [#of](#search?#of) [#a](#search?#a) [#lot](#search?#lot) [#schlagworte](#search?#schlagworte)');

                done();
            });
        });

        it('succeeds for tags starting with other tags', function (done) {
            var content = '#nad #more#often#so #we';
            var thing = {
                tags: logic.extractTags(content),
                externalContent: [],
                attachments: [],
                content: content,
            };

            logic.facelift(USER_ID, thing, function (error, result) {
                expect(error).to.equal(null);
                expect(result).to.equal('[#nad](#search?#nad) [#more](#search?#more)[#often](#search?#often)[#so](#search?#so) [#we](#search?#we)');

                done();
            });
        });
    });
});
