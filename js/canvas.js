const canvas = document.getElementById('canvas');
let frameCounter = 0;
let highestZIndex = 1;

// Create initial frames
function initializeCanvas() {
    createFrame(100, 100, 'Frame 1');
    createFrame(400, 200, 'Frame 2');
}

function bringToFront(element) {
    highestZIndex++;
    element.style.zIndex = highestZIndex;
}