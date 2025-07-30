let isPanning = false;
let isSpaceHeld = false;
let panStartPos = { x: 0, y: 0 };
let panStartTransform = { x: 0, y: 0 };

// Make panning state globally accessible
window.isPanning = false;

// Track spacebar state
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpaceHeld) {
        // Don't prevent default if user is editing text or in code editor
        if ((window.textEditing && window.textEditing.getCurrentlyEditingElement()) ||
            (window.codeEditor && window.codeEditor.isActive())) {
            return; // Allow space to be typed in text
        }
        
        e.preventDefault(); // Prevent page scroll
        isSpaceHeld = true;
        document.body.classList.add('space-held');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        // Don't affect pan state if user is editing text or in code editor
        if ((window.textEditing && window.textEditing.getCurrentlyEditingElement()) ||
            (window.codeEditor && window.codeEditor.isActive())) {
            return; // Let text editing handle space normally
        }
        
        isSpaceHeld = false;
        document.body.classList.remove('space-held');
        if (isPanning) {
            isPanning = false;
            window.isPanning = false;
            document.body.classList.remove('panning');
        }
    }
});

// Start panning
document.addEventListener('mousedown', (e) => {
    if (!isSpaceHeld) return;
    
    // Don't start panning if clicking on frames or elements
    if (e.target !== canvas && e.target.closest('.frame')) return;
    if (e.target.classList.contains('free-floating')) return;
    
    e.preventDefault();
    isPanning = true;
    window.isPanning = true;
    document.body.classList.add('panning');
    
    panStartPos = { x: e.clientX, y: e.clientY };
    
    // Store current transform
    if (window.canvasZoom) {
        const transform = window.canvasZoom.getTransform();
        panStartTransform = { 
            x: transform.translateX, 
            y: transform.translateY 
        };
    }
});

// Pan the canvas
document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    
    const deltaX = e.clientX - panStartPos.x;
    const deltaY = e.clientY - panStartPos.y;
    
    if (window.canvasZoom) {
        window.canvasZoom.pan(
            panStartTransform.x + deltaX,
            panStartTransform.y + deltaY
        );
    }
});

// Stop panning
document.addEventListener('mouseup', (e) => {
    if (isPanning) {
        isPanning = false;
        window.isPanning = false;
        document.body.classList.remove('panning');
    }
});

// Handle window blur (user switches tabs)
window.addEventListener('blur', () => {
    isSpaceHeld = false;
    isPanning = false;
    window.isPanning = false;
    document.body.classList.remove('space-held', 'panning');
});