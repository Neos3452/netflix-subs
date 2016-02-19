//document.getElementById('player-menu-track-settings').addEventListener('onmouseenter', function() { console.log('clicked'); })
//$('.player-control-bar').append('<div class="player-control-button player-fill-screen icon-player-full-screen" tabindex="0" role="button"></div>');

findSettingsMenu().then(function(settingsMenu) {
    console.log('settings found');
    var textSettings = settingsMenu.find('.player-timed-text-tracks');
    var testObj = //textSettings.clone();
    $('<ol class="player-timed-text-tracks player-visible"><lh>My Subtitles</lh><li>Off</li><li>English [CC]</li><li>German</li><li>Polish</li><li class="player-track-selected">Test</li></ol>');

    textSettings.hide();
    settingsMenu.append(testObj);
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
    settingsObserver.observe(element[0], { attributes: true });
}
