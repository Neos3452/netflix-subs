(function() {
    /**
     * Decimal adjustment of a number.
     *
     * @param {String}  type  The type of adjustment.
     * @param {Number}  value The number.
     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
     * @returns {Number} The adjusted value.
     */
    function decimalAdjust(type, value, exp) {
        // If the exp is undefined or zero...
        if (typeof exp === 'undefined' || +exp === 0) {
            return Math[type](value);
        }
        value = +value;
        exp = +exp;
        // If the value is not a number or the exp is not an integer...
        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return NaN;
        }
        // Shift
        value = value.toString().split('e');
        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
        // Shift back
        value = value.toString().split('e');
        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }

    // Decimal round
    if (!Math.round10) {
        Math.round10 = function(value, exp) {
            return decimalAdjust('round', value, exp);
        };
    }
    // Decimal floor
    if (!Math.floor10) {
        Math.floor10 = function(value, exp) {
            return decimalAdjust('floor', value, exp);
        };
    }
    // Decimal ceil
    if (!Math.ceil10) {
        Math.ceil10 = function(value, exp) {
            return decimalAdjust('ceil', value, exp);
        };
    }
})();

//document.getElementById('player-menu-track-settings').addEventListener('onmouseenter', function() { console.log('clicked'); })
//$('.player-control-bar').append('<div class="player-control-button player-fill-screen icon-player-full-screen" tabindex="0" role="button"></div>');
$(window).load(function() {
'use strict';

var DEBUG = 1;

function LOG(msg) { if (DEBUG) console.log(msg); }
function WARN(msg) { if (DEBUG) console.warn(msg); }
function ERR(msg) { console.error(msg); }

var customSubtitles = null;

watchSettingsMenu(function(settingsMenu) {
    if (customSubtitles === null) {
        customSubtitles = new CustomSubtitlesInjector();
    }
    customSubtitles.injectIntoSettings(settingsMenu);
}, function() {
    customSubtitles.uninject();
});

function watchSettingsMenu(addedCb, removedCb) {
    if (!$('#playerContainer').length) {
        WARN('No player container, won\'t look for settings');
        return;
    }

    var settingsMenuId = 'player-menu-track-settings';

    var settingsFinder = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            var node = null;
            var i = 0;
            for (i = 0; i < mutation.addedNodes.length; ++i) {
                node = mutation.addedNodes[i];
                if (node.id === settingsMenuId) {
                    LOG('Menu settings has been added');
                    addedCb($(node));
                    return;
                }
            }

            for (i = 0; i < mutation.removedNodes.length; ++i) {
                node = mutation.removedNodes[i];
                if (node.id === settingsMenuId) {
                    LOG('Menu settings has been removed');
                    removedCb($(node));
                    return;
                }
            }
        });
    });
    settingsFinder.observe(document, {childList: true, subtree: true});
}

// This functions is used to hide subtitles so user preference is saved instead of overridden to NONE
function hideNetflixSubtitles() {
    $('.player-timedtext-text-container').hide();
    if (!document.netflixSubtitleObserver) {
        document.netflixSubtitleObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                for (var i = 0; i < mutation.addedNodes.length; ++i) {
                    var node = $(mutation.addedNodes[i]);
                    if (node.hasClass('player-timedtext-text-container')) {
                        node.hide();
                    }
                }
            });
        });
    }
    findSubtitleContainer().then(function (subtitleContainer) {
        document.netflixSubtitleObserver.observe(subtitleContainer[0], {childList: true});
    });
}

function restoreNetflixSubtitles() {
    if (document.netflixSubtitleObserver) {
        document.netflixSubtitleObserver.disconnect();
        $('.player-timedtext-text-container').show();
    }
}

function findVideoTag() {
    return new Promise(function(resolve, reject) {
        var videoTag = $('video');
        if (videoTag.length != 1) {
            ERR('[NetflixSubtitle] Could not find video tag.');
            reject();
        } else {
            resolve(videoTag);
        }
    });
}

function findSubtitleContainer() {
    return new Promise(function(resolve, reject) {
        var element = $('.player-timedtext');
        if (element.length != 1) {
            ERR('[NetflixSubtitle] Could not find subtitle container.');
            reject();
        } else {
            resolve(element);
        }
    });
}

function getUserSubtitle() {
    return new Promise(function(resolve, reject) {
        var input = $('<input type="file"/>');
        input.change(function () {
            var files = input[0].files;
            if (files.length < 1) {
                LOG('No files picked');
                reject();
            } else {
                if (files.length > 1) {
                    WARN('Only one file is supported, picking first one');
                }

                var reader = new FileReader();
                reader.addEventListener('loadend', function () {
                    if (reader.error) {
                        WARN('Failed loading file: ' + reader.error);
                        reject();
                    } else {
                        resolve(parser.fromSrt(reader.result, true));
                    }
                });
                reader.readAsText(files[0]);
            }
        });
        input.click();
    });
}

function observeNetflixVisibility(element, visible, invisible) {
    var isVisible = !element.hasClass('display-none');
    var settingsObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                if (!element.hasClass('display-none')) {
                    if (!isVisible) {
                        isVisible = true;
                        visible(element);
                    }
                } else if (isVisible) {
                    isVisible = false;
                    invisible(element);
                }
            }
        });
    });
    settingsObserver.observe(element[0], {attributes: true});
    if (isVisible) {
        visible(element);
    } else {
        invisible(element);
    }
    return { disconnect: settingsObserver.disconnect.bind(settingsObserver) };
}

function htmlForTextWithEmbeddedNewlines(text) {
    var htmls = [];
    var lines = text.split(/\n/);
    // The temporary <div/> is to perform HTML entity encoding reliably.
    //
    // document.createElement() is *much* faster than jQuery('<div></div>')
    // http://stackoverflow.com/questions/268490/
    //
    // You don't need jQuery but then you need to struggle with browser
    // differences in innerText/textContent yourself
    var tmpDiv = jQuery(document.createElement('div'));
    for (var i = 0 ; i < lines.length ; i++) {
        htmls.push(tmpDiv.text(lines[i]).html());
    }
    return htmls.join("<br/>");
}

function CustomSubtitlesInjector() {
    // Custom subtitles settings menu
    var customSubtitlesEmbedder = null;
    var wasEmbedderActive = false;
    var subtitles = null;
    var customSubtitlesSettings = $('<ol class="player-timed-text-tracks player-visible custom-netflix-subtitles">' +
        '<lh>Subtitles settings</lh></ol>');
    var customSubtitlesDelayLabel = $('<div class="netflix-subtitles-delay-label"></div>');
    var customSubtitlesDelayIncrease = $('<i class="fa fa-plus-circle"></i>');
    var customSubtitlesDelayDecrease = $('<i class="fa fa-minus-circle"></i>');

    var delay;
    var delayStep = 0.25;
    var setDelay = function (newDelay) {
        if ($.isNumeric(newDelay)) {
            delay = Math.round10(newDelay, -2);
            customSubtitlesDelayLabel.text('Delay: ' + delay + ' s');
            if (customSubtitlesEmbedder) {
                customSubtitlesEmbedder.delay = delay;
                customSubtitlesEmbedder.displaySubtitlesForCurrentTime();
            }
        }
    };
    setDelay(0);

    customSubtitlesDelayIncrease.click(function () {
        setDelay(delay + delayStep);
        return false;
    });
    customSubtitlesDelayDecrease.click(function () {
        setDelay(delay - delayStep);
        return false;
    });

    customSubtitlesSettings.append(
        $('<li></li>')
            .append(customSubtitlesDelayLabel)
            .append($('<div class="settings-right"></div>')
                .append(customSubtitlesDelayIncrease)
                .append(customSubtitlesDelayDecrease)));

    var selectedClass = 'player-track-selected';
    var customSubtitles = $('<li>Custom</li>');
    var settingsMenu = null;
    var originalTextSettings = null;
    var substitutedTextSettings = null;
    var selectedSubtitle = null;

    var settingsMenuClickHandler = function () {
        var element = $(this);

        if (customSubtitlesEmbedder) {
            customSubtitlesEmbedder.deactivate();
            customSubtitlesEmbedder = null;
            subtitles = null;
        }
        customSubtitlesSettings.detach();
        setDelay(0);

        if (this == customSubtitles[0]) {
            var previouslySelected = selectedSubtitle;
            getUserSubtitle().then(function (newSubs) {
                LOG('Subtitles loaded');
                if (selectedSubtitle[0] === customSubtitles[0]) {
                    subtitles = newSubs;

                    hideNetflixSubtitles();

                    customSubtitlesSettings.appendTo(settingsMenu);
                    customSubtitlesEmbedder = new SubtitlesEmbedder(subtitles);
                    customSubtitlesEmbedder.delay = delay;
                    customSubtitlesEmbedder.activate();

                    previouslySelected.removeClass(selectedClass);
                    element.addClass(selectedClass);
                }
                // else someone switched subtitles while we were loading
            });
        } else {
            restoreNetflixSubtitles();

            selectedSubtitle.removeClass(selectedClass);
            element.addClass(selectedClass);
        }
        selectedSubtitle = element;
        originalTextSettings.children().eq(element.index()).click();
    };

    this.injectIntoSettings = function(settingsNode) {

        if (settingsMenu !== null) {
            this.uninject();
        }

        // rewire subtitle settings
        settingsMenu = settingsNode;
        originalTextSettings = settingsMenu.find('.player-timed-text-tracks');
        substitutedTextSettings = originalTextSettings.clone();
        selectedSubtitle = substitutedTextSettings.find('.' + selectedClass);
        substitutedTextSettings.append(customSubtitles);

        substitutedTextSettings.on('click', 'li', settingsMenuClickHandler);

        originalTextSettings.hide();
        settingsMenu.append(substitutedTextSettings);

        if (wasEmbedderActive && subtitles !== null) {
            LOG('Restoring subtitles');
            selectedSubtitle.removeClass(selectedClass);
            customSubtitles.addClass(selectedClass);
            selectedSubtitle = customSubtitles;
            hideNetflixSubtitles();

            customSubtitlesSettings.appendTo(settingsMenu);
            customSubtitlesEmbedder = new SubtitlesEmbedder(subtitles);
            customSubtitlesEmbedder.delay = delay;
            customSubtitlesEmbedder.activate();

        }
    };

    this.uninject = function() {

        if (customSubtitlesEmbedder) {
            wasEmbedderActive = true;
            customSubtitlesEmbedder.deactivate();
            customSubtitlesEmbedder = null;
            restoreNetflixSubtitles();
        }

        substitutedTextSettings.remove();

        originalTextSettings.show();

        originalTextSettings = null;
        substitutedTextSettings = null;
        selectedSubtitle = null;
        settingsMenu = null;
    };
}

function SubtitlesEmbedder(subtitles) {
    this.subtitles = subtitles;
    this.delay = 0;
    var video = null;
    var netflixSubtitleContainer = null;
    var subtitleContainer = $('<div id="custom-subtitles" style="white-space: nowrap; text-align: center; position: absolute;"></div>');
    var subtitleText =
        $('<span style="line-height:normal;font-weight:normal;color:#ffffff;text-shadow:#000000 0px 0px 13px;' +
            'font-family:Arial,Helvetica;font-weight:bolder"></span>');
    var progressBarVisible = true;
    var progressBarObserver = null;
    var progressBar = null;

    subtitleContainer.append(subtitleText);
    var subtitleResize = function() {
        if (subtitleContainer.is(":visible")) {
            // Try to do the same thing as netflix ie.
            // Place subtitles inside video element (which can be scaled down)
            // In the 10% from bottom or right above progress bar whichever is higher
            // Center of text in the center of video element
            var containerWidth = netflixSubtitleContainer.width();
            var containerHeight = netflixSubtitleContainer.height();
            var containerPosition = netflixSubtitleContainer.position();
            var videoWidth = video.videoWidth;
            var videoHeight = video.videoHeight;

            var insideWidth = containerWidth;
            var insideHeight = containerHeight;

            if (containerHeight / containerWidth > videoHeight / videoWidth) {
                insideHeight = videoHeight * (containerWidth / videoWidth);
            } else {
                insideWidth = videoWidth * (containerHeight / videoHeight);
            }

            LOG('containerWidth ' + containerWidth + ' videoWidth ' + videoWidth + ' insideWidth ' + insideWidth);
            LOG('containerHeight ' + containerHeight + ' videoHeight ' + videoHeight + ' insideHeight ' + insideHeight);

            var fontSize = Math.round(insideWidth / 40);
            subtitleText.css('fontSize', fontSize);

            // assume video is always centered
            var textWidth = subtitleContainer.width();
            var leftRatio = (1 - Math.max(textWidth / containerWidth, 0)) * 50; // half the value and change to % == multiply by 50

            var progressTop = progressBar.position().top;
            var heightOffset = Math.max((containerHeight - insideHeight) / 2, 0);
            var progressBarTransposition = progressBarVisible ? heightOffset + insideHeight - progressTop : 0;
            var bottomRatio = heightOffset + Math.max(0.10 * insideHeight, progressBarTransposition);
            LOG('bottomRatio: ' + bottomRatio + ' heightOffset: ' + heightOffset + ' progressBarTransposition: ' + progressBarTransposition + ' progress top: ' + progressTop);
            bottomRatio /= containerHeight;
            bottomRatio *= 100; // percentify

            subtitleContainer.css({left: (leftRatio + '%'), bottom: (bottomRatio + '%')});

            LOG('Resize to font: ' + fontSize + ', bottom: ' + bottomRatio + ' left: ' + leftRatio);
        }
    };

    this.displaySubtitlesForCurrentTime = function() {
        var time = (video.currentTime - this.delay) * 1000; // get time in milliseconds

        // TODO: ain't this a little too heavy?
        var subtitlesLength = this.subtitles.length;
        for (var i = 0; i < subtitlesLength; ++i) {
            if (this.subtitles[i].startTime > time) {
                subtitleContainer.hide();
                break;
            }
            if (this.subtitles[i].endTime > time) {
                subtitleText.html(htmlForTextWithEmbeddedNewlines(this.subtitles[i].text));
                subtitleContainer.show();
                subtitleResize();
                break;
            }
        }
        if (i == subtitlesLength) {
            subtitleContainer.hide();
        }
    };
    var subtitlesDisplayCallback = this.displaySubtitlesForCurrentTime;

    this.activate = function() {
        LOG('Activating custom subtitles');
        netflixSubtitleContainer = $('.player-video-wrapper').children().first();
        progressBar = $('.player-controls-wrapper');
        progressBarObserver = observeNetflixVisibility(progressBar,
            function() { progressBarVisible = true; subtitleResize(); },
            function() { progressBarVisible = false; subtitleResize(); });
        $(window).resize(subtitleResize);
        netflixSubtitleContainer.resize(subtitleResize);
        video = $('video')[0];
        subtitlesDisplayCallback = this.displaySubtitlesForCurrentTime.bind(this);
        video.addEventListener('timeupdate', subtitlesDisplayCallback);
        netflixSubtitleContainer.append(subtitleContainer);
        subtitlesDisplayCallback();
    };

    this.deactivate = function() {
        LOG('Deactivating custom subtitles');
        if (netflixSubtitleContainer) {
            subtitleContainer.remove();
            netflixSubtitleContainer.off('resize', subtitleResize);
            netflixSubtitleContainer = null;
        }
        $(window).off('resize', subtitleResize);
        if (progressBarObserver) {
            progressBarObserver.disconnect();
            progressBarObserver = null;
        }
        progressBar = null;
        if (video) {
            video.removeEventListener('timeupdate', subtitlesDisplayCallback);
            video = null;
        }
    };
}

});