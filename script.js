//document.getElementById('player-menu-track-settings').addEventListener('onmouseenter', function() { console.log('clicked'); })
//$('.player-control-bar').append('<div class="player-control-button player-fill-screen icon-player-full-screen" tabindex="0" role="button"></div>');
(function(){
'use strict';

var DEBUG = 1;

function LOG(msg) { if (DEBUG) console.log(msg); }
function WARN(msg) { if (DEBUG) console.warn(msg); }
function ERR(msg) { console.error(msg); }

findSettingsMenu().then(function(settingsMenu) {
    LOG('settings found');
    var originalTextSettings = settingsMenu.find('.player-timed-text-tracks');
    var substitutedTextSettings = originalTextSettings.clone();

    var customSubtitlesEmbedder = null;

    var selectedClass = 'player-track-selected';
    var selectedSubtitle = substitutedTextSettings.find('.' + selectedClass);
    var customSubtitles = $('<li>Custom</li>');
    substitutedTextSettings.append(customSubtitles);

    substitutedTextSettings.on('click', 'li', function() {
        var element = $(this);

        if (customSubtitlesEmbedder) {
            customSubtitlesEmbedder.deactivate();
            customSubtitlesEmbedder = null;
        }

        if (this == customSubtitles[0]) {
            getUserSubtitle().then(function(subtitles) {
                LOG('Subtitles loaded');
                if (selectedSubtitle[0] == customSubtitles[0]) {
                    customSubtitlesEmbedder = new SubtitlesEmbedder(subtitles);
                    customSubtitlesEmbedder.activate();
                }
                // else someone switched subtitles while we were loading
            });
            hideNetflixSubtitles();
        } else {
            restoreNetflixSubtitles();
        }

        selectedSubtitle.removeClass(selectedClass);
        element.addClass(selectedClass);
        selectedSubtitle = element;
        originalTextSettings.children().eq(element.index()).click();
    });

    originalTextSettings.hide();
    settingsMenu.append(substitutedTextSettings);
});

function findSettingsMenu() {
    return new Promise(function(resolve, reject) {
        var settingsFinder = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                for (var i = 0; i < mutation.addedNodes.length; ++i) {
                    var node = mutation.addedNodes[i];
                    if (node.id == 'player-menu-track-settings') {
                        settingsFinder.disconnect();
                        resolve($(node));
                    }
                }
            });
        });
        settingsFinder.observe(document, {childList: true, subtree: true});
    });
}

// This functions is used to hide subtitles so user preference is saved instead of overridden to NONE
function hideNetflixSubtitles() {
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
        input.click();
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

function SubtitlesEmbedder(subtitles) {
    var subtitles = subtitles;
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
        var subtitlesLength = subtitles.length;
        for (var i = 0; i < subtitlesLength; ++i) {
            if (subtitles[i].startTime > time) {
                subtitleContainer.hide();
                break;
            }
            if (subtitles[i].endTime > time) {
                subtitleText.html(htmlForTextWithEmbeddedNewlines(subtitles[i].text));
                subtitleContainer.show();
                subtitleResize();
                break;
            }
        }
    };

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
        video.addEventListener('timeupdate', this.displaySubtitlesForCurrentTime.bind(this));
        netflixSubtitleContainer.append(subtitleContainer);
        this.displaySubtitlesForCurrentTime();
    };

    this.deactivate = function() {
        LOG('Deactivating custom subtitles');
        if (netflixSubtitleContainer) {
            subtitleContainer.remove();
            netflixSubtitleContainer = null;
            netflixSubtitleContainer.off('resize', subtitleResize);
        }
        $(window).off('resize', subtitleResize);
        if (progressBarObserver) {
            progressBarObserver.disconnect();
            progressBarObserver = null;
        }
        progressBar = null;
        if (video) {
            video.removeEventListener('timeupdate', this.displaySubtitlesForCurrentTime.bind(this));
            video = null;
        }
    };
}

})();
