(function () {
'use strict';

Vue.config.debug = true;

window.Guacamoly = window.Guacamoly || {};

window.Guacamoly.disableCheckboxes = function () {
    // disable interactive checkboxes
    Vue.nextTick(function () {
        $('.card-content input[type="checkbox"]').on('click', function (event) {
            event.preventDefault();
        });
    });
};

function markdownitCheckbox (md) {
    var arrayReplaceAt = md.utils.arrayReplaceAt;
    var lastId = 0;
    var pattern = /(.*)\[(X|\s|\_|\-)\]\s(.*)/i;

    function splitTextToken (original, Token) {
        var checked, id, prelabel, label, matches, nodes, ref, text, token, value;
        text = original.content;
        nodes = [];
        matches = text.match(pattern);
        prelabel = matches[1];
        value = matches[2];
        label = matches[3];
        checked = (ref = value === 'X' || value === 'x') !== null ? ref : { 'true' : false };

        /**
        * content pre-checkbox
        */
        token = new Token('text', '', 0);
        token.content = prelabel;
        nodes.push(token);

        /**
        * <input type="checkbox" id="checkbox{n}" checked="true">
        */
        id = 'checkbox' + lastId;
        lastId += 1;
        token = new Token('checkbox_input', 'input', 0);
        token.attrs = [['type', 'checkbox'], ['id', id]];
        if (checked === true) {
            token.attrs.push(['checked', 'true']);
        }
        nodes.push(token);

        /**
        * <label for="checkbox{n}">
        */
        token = new Token('label_open', 'label', 1);
        token.attrs = [['for', id]];
        nodes.push(token);

        /**
        * content of label tag
        */
        token = new Token('text', '', 0);
        token.content = label;
        nodes.push(token);

        /**
        * closing tags
        */
        nodes.push(new Token('label_close', 'label', -1));

        return nodes;
    }

    md.core.ruler.push('checkbox', function (state) {
        var token, tokens;
        var blockTokens = state.tokens;
        var i = 0;
        var j = 0;
        var l = blockTokens.length;

        while (j < l) {
            if (blockTokens[j].type !== 'inline') {
                j++;
                continue;
            }

            tokens = blockTokens[j].children;
            i = tokens.length - 1;

            while (i >= 0) {
                token = tokens[i];
                if (token.type === 'text' && pattern.test(token.content)) {
                    blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, splitTextToken(token, state.Token));
                }
                i--;
            }
            j++;
        }
    });
}

// https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
function markdownTargetBlank(md) {
    // stash the default renderer
    var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        var href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

        if (href.indexOf('https://') === 0 || href.indexOf('http://') === 0 || href.indexOf('/api/files/') === 0) {
            // in case another plugin added that attribute already
            var aIndex = tokens[idx].attrIndex('target');

            if (aIndex < 0) {
                tokens[idx].attrPush(['target', '_blank']); // add new attribute
            } else {
                tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

function colorizeIt (md) {
    var regexp = /\:([#\w\-]+)\:/;

    function isColor(color) {
        // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
        var colors = [
            'clear',
            'aliceblue', 'lightsalmon', 'antiquewhite', 'lightseagreen', 'aqua', 'lightskyblue', 'aquamarine', 'lightslategray', 'azure', 'lightsteelblue', 'beige', 'lightyellow', 'bisque', 'lime', 'black', 'limegreen', 'blanchedalmond', 'linen', 'blue', 'magenta', 'blueviolet', 'maroon', 'brown', 'mediumaquamarine', 'burlywood', 'mediumblue', 'cadetblue', 'mediumorchid', 'chartreuse', 'mediumpurple', 'chocolate', 'mediumseagreen', 'coral', 'mediumslateblue', 'cornflowerblue', 'mediumspringgreen', 'cornsilk', 'mediumturquoise', 'crimson', 'mediumvioletred', 'cyan', 'midnightblue', 'darkblue', 'mintcream', 'darkcyan', 'mistyrose', 'darkgoldenrod', 'moccasin', 'darkgray', 'navajowhite', 'darkgreen', 'navy', 'darkkhaki', 'oldlace', 'darkmagenta', 'olive', 'darkolivegreen', 'olivedrab', 'darkorange', 'orange', 'darkorchid', 'orangered', 'darkred', 'orchid', 'darksalmon', 'palegoldenrod', 'darkseagreen', 'palegreen', 'darkslateblue', 'paleturquoise', 'darkslategray', 'palevioletred', 'darkturquoise', 'papayawhip', 'darkviolet', 'peachpuff', 'deeppink', 'peru', 'deepskyblue', 'pink', 'dimgray', 'plum', 'dodgerblue', 'powderblue', 'firebrick', 'purple', 'floralwhite', 'red', 'forestgreen', 'rosybrown', 'fuchsia', 'royalblue', 'gainsboro', 'saddlebrown', 'ghostwhite', 'salmon', 'gold', 'sandybrown', 'goldenrod', 'seagreen', 'gray', 'seashell', 'green', 'sienna', 'greenyellow', 'silver', 'honeydew', 'skyblue', 'hotpink', 'slateblue', 'indianred', 'slategray', 'indigo', 'snow', 'ivory', 'springgreen', 'khaki', 'steelblue', 'lavender', 'tan', 'lavenderblush', 'teal', 'lawngreen', 'thistle', 'lemonchiffon', 'tomato', 'lightblue', 'turquoise', 'lightcoral', 'violet', 'lightcyan', 'wheat', 'lightgoldenrodyellow', 'white', 'lightgreen', 'whitesmoke', 'lightgrey', 'yellow', 'lightpink', 'yellowgreen'
        ];

        if (color[0] === '#') return true;

        return colors.indexOf(color) !== -1;
    }

    md.inline.ruler.push('colorizeIt', function (state, silent) {
        // slowwww... maybe use an advanced regexp engine for this
        var match = regexp.exec(state.src.slice(state.pos));
        if (!match) return false;
        if (!isColor(match[1])) return false;

        // valid match found, now we need to advance cursor
        state.pos += match[0].length;

        // don't insert any tokens in silent mode
        if (silent) return true;

        var token = state.push('colorizeIt', '', 0);
        token.meta = { color: match[1] };

        return true;
    });

    md.renderer.rules.colorizeIt = function (tokens, id/*, options, env*/) {
        if (tokens[id].meta.color === 'clear') {
            return '</span>';
        } else {
            return '<span style="color: ' + tokens[id].meta.color + ';">';
        }
    };
}

var md = window.markdownit({
    breaks: true,
    html: true,
    linkify: true
}).use(window.markdownitEmoji)
.use(colorizeIt)
.use(markdownitCheckbox)
.use(markdownTargetBlank);

md.renderer.rules.emoji = function(token, idx) {
  return twemoji.parse(token[idx].content);
};

Vue.filter('markdown', function (value) {
    if (!value) return '';

    return md.render(value);
});

Vue.filter('prettyDateOffset', function (time) {
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
});

})();
