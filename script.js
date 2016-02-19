//document.getElementById('player-menu-track-settings').addEventListener('onmouseenter', function() { console.log('clicked'); })
//$('.player-control-bar').append('<div class="player-control-button player-fill-screen icon-player-full-screen" tabindex="0" role="button"></div>');
(function(){
'use strict';

findSettingsMenu().then(function(settingsMenu) {
    console.log('settings found');
    var originalTextSettings = settingsMenu.find('.player-timed-text-tracks');
    var substitutedTextSettings = originalTextSettings.clone();

    var selectedClass = 'player-track-selected';
    var selectedSubtitle = substitutedTextSettings.find('.' + selectedClass);
    var customSubtitles = $('<li>Custom</li>');
    substitutedTextSettings.append(customSubtitles);
    substitutedTextSettings.on('click', 'li', function() {
        var element = $(this);
        var switchSubtitle = true;
        if (this == customSubtitles[0]) {
            switchSubtitle = window.confirm('Do you wanna add a subtitle?')
        }

        if (switchSubtitle) {
            selectedSubtitle.removeClass(selectedClass);
            element.addClass(selectedClass);
            selectedSubtitle = element;
            originalTextSettings.children().eq(element.index()).click();
        }
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

function observeNetflixVisibility(element, visible, invisible) {
    var isVisible = element.hasClass('player-visible');
    var settingsObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                if (element.hasClass('player-visible')) {
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
}

})();
