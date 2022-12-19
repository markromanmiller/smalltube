/*
 * Overall structure:
 *
 * First, find the element with the main viewer class,
 * Hide it, and directly after it, indicate that it's
 * checking whether you have a current session.
 *
 * When that completes, and there's time, open the form.
 * The form should ask for:
 * 1) The number of videos to pull.
 * 2) The delay until you can ask for videos again.
 *
 * Upon submission, all video panels are queried.
 * Each entry decrements the total counter (which is saved and pulled somewhere)
 * And then the listener is pulled in for which each item is hidden
 *
 * DE-RISK: what happens if all the items are hidden in a row? is it just blank? do check!
 *
 * Then, at the end, the main view is shown again.
 *
 * (It'd be nice to say, at the end, "hey you've seen enough of these"
 */

function getCurrentTime() {
    const currentTime = new Date();
    return currentTime.getTime();
}

function isIntentionTimeExpired() {
    const limitUntil = +localStorage.getItem('smalltube-limit-until');
    return limitUntil <= getCurrentTime();
}

// functions
function getRemainingVideos() {
    if (isIntentionTimeExpired()) {
        return null;
    } else {
        return +localStorage.getItem('smalltube-videos-left');
    }
}

function gateVideo(videoElement) {
    videoElement.classList.add("smalltube-accounted-video");
    const remainingVideos = getRemainingVideos();
    if (remainingVideos > 0) {
        if ((remainingVideos % 10 === 0) || remainingVideos <= 5) {
            const tagNum = document.createElement("div");
            tagNum.innerHTML = remainingVideos.toString();
            tagNum.classList.add("smalltube-numbering");
            videoElement.insertAdjacentElement("beforeend", tagNum);
        }
        localStorage.setItem(
            'smalltube-videos-left',
            (remainingVideos-1).toString()
        );
    } else if (!needsIntentionForm) {
        videoElement.classList.add("smalltube-hidden");
    }
}

function gateCurrentVideos() {
    const currentVideos = document.getElementsByTagName('ytd-rich-item-renderer');
    for (let i = 0; i < currentVideos.length; i++) {
        gateVideo(currentVideos[i]);
    }
}

function showPatienceExhortation(viewerElement) {
    const patienceExhortation = document.createElement("h1");
    console.log((+localStorage.getItem('smalltube-limit-until')));
    console.log(getCurrentTime());
    const timeLeft = ((+localStorage.getItem('smalltube-limit-until')) - getCurrentTime());
    console.log(timeLeft);
    let timeString;
    if (timeLeft < 60 * 1000) {
        timeString = "less than a minute";
    } else if (timeLeft < 2 * 60 * 1000) {
        timeString = "1 minute"
    } else if (timeLeft < 60 * 60 * 1000) {
        timeString = Math.floor(timeLeft / (60 * 1000)).toString() + " minutes"
    } else if (timeLeft < 2 * 60 * 60 * 1000) {
        timeString = "1 hour";
    } else if (timeLeft < 24 * 60 * 60 * 1000) {
        timeString = Math.floor(timeLeft / (60 * 60 * 1000)).toString(+" hours")
    } else if (timeLeft < 2 * 24 * 60 * 60 * 1000) {
        timeString = "1 day"
    } else {
        timeString = Math.floor(timeLeft / (24 * 60 * 60 * 1000)).toString(+" hours")
    }

    patienceExhortation.innerText = "No video recommendations - wait " + timeString + ".";
    patienceExhortation.classList.add("smalltube-patience");
    viewerElement.insertAdjacentElement("afterend", patienceExhortation);
}

function gateViewer(viewerElement) {
    const remainingVideos = getRemainingVideos();
    console.log(remainingVideos);

    if (remainingVideos === null) {
        // hide the thing
        viewerElement.hidden = true;
        showIntentionForm(viewerElement);
    } else if (remainingVideos === 0) {
        viewerElement.hidden = true;
        showPatienceExhortation(viewerElement);
    } else {
        gateCurrentVideos();
    }
}

function showIntentionForm(viewerElement) {

    // add a sibling element showing "Looking for active sessions..."
    const mainDiv = document.createElement("div");

    // show the intention HTML
    mainDiv.innerHTML = "<div><form id='smalltube-intention'>" +
        "<p>Limit to &nbsp;" +
        "<input id='videos' type='number'> videos</p>" +
        "<p>for the next &nbsp;" +
        "<input id='until' type='number' step=any>" +
        "<select name='timeunit' id='timeunit'>" +
        "<option value='minutes'>minutes</option>" +
        "<option value='hours'>hours</option>" +
        "<option value='days'>days</option>" +
        "</select></p>" +
        "<input type='submit' value='Commit'>" +
        "</form></div>";

    mainDiv.classList.add("smalltube-div");
    viewerElement.insertAdjacentElement("afterend", mainDiv);

    const form = document.querySelector("#smalltube-intention");
    form.addEventListener('submit', function(event) {
        commitIntention(event, viewerElement);
    });
}

function commitIntention(event, viewerElement) {
    event.preventDefault();
    const videos = document.getElementById("videos").value;
    const until = document.getElementById("until").value;
    const timeunit = document.getElementById("timeunit").value;

    let unitMs;
    switch(timeunit) {
        case 'days':
            unitMs = 24 * 60 * 60 * 1000;
            break;
        case 'hours':
            unitMs = 60 * 60 * 1000;
            break;
        case 'minutes':
            unitMs = 60 * 1000;
            break;
    }

    console.log(until * unitMs);
    console.log(getCurrentTime() + until * unitMs);

    localStorage.setItem('smalltube-videos-left', videos.toString());
    localStorage.setItem('smalltube-limit-until', (getCurrentTime() + until * unitMs).toString());
    needsIntentionForm = false;

    viewerElement.hidden = false;
    gateCurrentVideos();
}

function checkForElements(observer) {
    const contentsElement = document.getElementById("contents");
    if (contentsElement) {
        contentsObserver.observe(contentsElement, {childList: true});
        contentsFound = true;
    }

    const renderers = document.getElementsByTagName("ytd-rich-grid-renderer");
    if (renderers.length) {
        rendererFound = true;
        gateViewer(renderers[0]);
    }

    // when both things are found, stop looking for them :-)
    console.log(contentsFound, rendererFound);
    if (contentsFound && rendererFound) {
        observer.disconnect();
    }
}

// MAIN

let contentsObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function (newNode) {
            newNode.querySelectorAll("ytd-rich-grid-row > div > ytd-rich-item-renderer").forEach(gateVideo);
        });
    });
});

console.log("SmallTube is active on a YouTube-type page.");

let needsIntentionForm = isIntentionTimeExpired();

// start off watching for the contents box to come in.
let contentsFound = false;
let rendererFound = false;

let observer = new MutationObserver(function(mutations) {
    checkForElements(observer);
});
observer.observe(document.documentElement, {subtree: true, childList:true});

checkForElements(observer);
