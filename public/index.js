/* jslint browser:true */
/* global angular */
/* global $ */

'use strict';

var app = angular.module('app', [
    'hc.marked'
]);

app.config(['markedProvider', function (markedProvider) {
    markedProvider.setOptions({gfm: true});
}]);

app.controller('MainController', function ($scope, $http, $timeout, $document) {

    $scope.things = [];
    $scope.tags = [];
    $scope.filter = '';
    $scope.addFormData = {
        busy: true,
        content: ''
    };

    $scope.settings = {
        title: 'Holy Guacamoly',
        backgroundUrl: ''
    };

    $scope.addFilterTag = function (tag) {
        var hashed = '#' + tag.name;

        if ($scope.filter.indexOf(hashed) === -1)  {
            $scope.filter = $scope.filter + ' ' + hashed;
        } else {
            $scope.filter = $scope.filter.replace(hashed, '');
        }

        $scope.fetchThings();
    };

    $scope.addThing = function () {
        $scope.addFormData.busy = true;

        $http.post('/api/things', { content: $scope.addFormData.content }, {}).then(function (result) {
            $scope.addFormData.busy = false;
            $scope.addFormData.content = '';

            $('#modalAdd').modal('hide');

            $scope.fetchThings();
            $scope.fetchTags();
        }, function (result) {
            console.error('error:', result);
            $scope.addFormData.busy = false;
        });
    };

    $scope.deleteThing = function (id) {
        $http.delete('/api/things/' + id, {}).then(function (result) {
            $scope.fetchThings();
        }, function (result) {
            console.error('error:', result);
        });
    };

    $scope.fetchThings = function () {
        var url = '/api/things';

        if ($scope.filter) {
            url += '?filter=' + encodeURIComponent($scope.filter);
        }

        $http.get(url, {}).then(function (result) {
            angular.copy(result.data.things, $scope.things);
        }, function (result) {
            console.error('error:', result);
        });
    };

    $scope.fetchTags = function () {
        $http.get('/api/tags', {}).then(function (result) {
            angular.copy(result.data.tags, $scope.tags);
        }, function (result) {
            console.error('error:', result);
        });
    };

    $('#modalSettings').on('hidden.bs.modal', function () {
        $scope.fetchSettings();
    });

    $scope.saveSettings = function () {
        $http.post('/api/settings', { settings: $scope.settings }, {}).then(function (result) {
            $('#modalSettings').modal('hide');
        }, function (result) {
            console.error('error:', result);
        });
    };

    $scope.fetchSettings = function () {
        $http.get('/api/settings', {}).then(function (result) {
            angular.extend($scope.settings, result.data.settings);
        }, function (result) {
            console.error('error:', result);
        });
    };

    $scope.fetchThings();
    $scope.fetchTags();
    $scope.fetchSettings();

    $timeout(function () {
        $.material.init();

        $('#modalAdd').on('shown.bs.modal', function () {
            $('#inputContent').focus();
        });
    });
});

app.filter('prettyDateOffset', function () {
    // http://ejohn.org/files/pretty.js
    return function prettyDateOffset(time){
        var date = new Date(time),
            diff = (((new Date()).getTime() - date.getTime()) / 1000),
            day_diff = Math.floor(diff / 86400);

        if (isNaN(day_diff) || day_diff < 0)
            return;

        return day_diff === 0 && (
                diff < 60 && 'just now' ||
                diff < 120 && '1 minute ago' ||
                diff < 3600 && Math.floor( diff / 60 ) + ' minutes ago' ||
                diff < 7200 && '1 hour ago' ||
                diff < 86400 && Math.floor( diff / 3600 ) + ' hours ago') ||
            day_diff === 1 && 'Yesterday' ||
            day_diff < 7 && day_diff + ' days ago' ||
            day_diff < 31 && Math.ceil( day_diff / 7 ) + ' weeks ago' ||
            day_diff < 365 && Math.round( day_diff / 30 ) +  ' months ago' ||
                              Math.round( day_diff / 365 ) + ' years ago';
    };
});

app.filter('prettyDate', function () {
    var months = new Array(12);
    months[0] = 'January';
    months[1] = 'February';
    months[2] = 'March';
    months[3] = 'April';
    months[4] = 'May';
    months[5] = 'June';
    months[6] = 'July';
    months[7] = 'August';
    months[8] = 'September';
    months[9] = 'October';
    months[10] = 'November';
    months[11] = 'December';

    return function prettyDateOffset(time) {
        var date = new Date(time);
        return date.getUTCMonth() + 1 + ' ' + months[date.getDate()] + ' ' + date.getUTCFullYear();
    };
});

app.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind('keydown keypress', function (event) {
            if(event.which === 13) {
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});
