let currentZoom = 1;
let zoomTimeout = null;
let indicatorTimeout = null;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

let zoomIndicator;

// Initialize zoom indicator after DOM loads
window.addEventListener('load', () => {
    zoomIndicator = document.getElementById('zoom-indicator');
});

// Track canvas transform for proper coordinate conversion
let canvasTransform = {
    scale: 1,
    translateX: 0,
    translateY: 0
};

function updateZoomIndicator() {
    if (!zoomIndicator) return;
    
    zoomIndicator.textContent = `${Math.round(currentZoom * 100)}%`;
    zoomIndicator.classList.add('visible');
    
    // Clear previous timeout
    clearTimeout(indicatorTimeout);
    
    // Hide indicator after 2 seconds
    indicatorTimeout = setTimeout(() => {
        zoomIndicator.classList.remove('visible');
    }, 2000);
}

function handleWheel(e) {
    // Only zoom if cmd/ctrl is held
    if (!e.metaKey && !e.ctrlKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Add zooming class for will-change optimization
    if (!canvas.classList.contains('zooming')) {
        canvas.classList.add('zooming');
    }
    
    // Clear previous timeout and set new one to remove will-change
    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
        canvas.classList.remove('zooming');
    }, 150);
    
    // Calculate zoom direction and new zoom level
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const oldZoom = currentZoom;
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    
    if (currentZoom === oldZoom) return; // No change
    
    // Get mouse position relative to the canvas container (viewport)
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Convert mouse position to canvas coordinates (accounting for current transform)
    const canvasX = (mouseX - rect.left) / oldZoom;
    const canvasY = (mouseY - rect.top) / oldZoom;
    
    // Calculate new transform to keep the point under the mouse stationary
    const scaleChange = currentZoom / oldZoom;
    canvasTransform.translateX = mouseX - canvasX * currentZoom;
    canvasTransform.translateY = mouseY - canvasY * currentZoom;
    canvasTransform.scale = currentZoom;
    
    // Apply transform
    canvas.style.transform = `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${currentZoom})`;
    
    // Update background size to maintain grid appearance
    canvas.style.backgroundSize = `${50 * currentZoom}px ${50 * currentZoom}px`;
    
    // Update zoom indicator
    updateZoomIndicator();
}

// Convert screen coordinates to canvas coordinates (for drag/drop calculations)
function screenToCanvas(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left) / currentZoom,
        y: (screenY - rect.top) / currentZoom
    };
}

// Convert canvas coordinates to screen coordinates
function canvasToScreen(canvasX, canvasY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: canvasX * currentZoom + rect.left,
        y: canvasY * currentZoom + rect.top
    };
}

// Add wheel event listener
window.addEventListener('wheel', handleWheel, { passive: false });

// Reset zoom function
function resetZoom() {
    currentZoom = 1;
    canvasTransform = { scale: 1, translateX: 0, translateY: 0 };
    canvas.style.transform = 'none';
    canvas.style.backgroundSize = '50px 50px';
    updateZoomIndicator();
}

// Pan function
function pan(newX, newY) {
    canvasTransform.translateX = newX;
    canvasTransform.translateY = newY;
    canvas.style.transform = `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${currentZoom})`;
}

// Expose zoom functions globally for potential use by other modules
window.canvasZoom = {
    screenToCanvas,
    canvasToScreen,
    getCurrentZoom: () => currentZoom,
    getTransform: () => ({ ...canvasTransform }),
    pan,
    resetZoom
};