// Selection state management
let selectedElements = [];

// Selection functions
function selectElement(element, addToSelection = false) {
    if (!element) return;
    
    // If not adding to selection, clear previous selections
    if (!addToSelection) {
        clearSelection();
    }
    
    // Toggle selection if element is already selected and we're adding to selection
    if (addToSelection && selectedElements.includes(element)) {
        element.classList.remove('selected');
        selectedElements = selectedElements.filter(el => el !== element);
        // Dispatch selection changed event
        window.dispatchEvent(new CustomEvent('selectionChanged', {
            detail: { selectedElements: [...selectedElements] }
        }));
        return;
    }
    
    // Add element to selection if not already selected
    if (!selectedElements.includes(element)) {
        selectedElements.push(element);
        element.classList.add('selected');
    }
    
    // Dispatch selection changed event
    window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { selectedElements: [...selectedElements] }
    }));
}

function clearSelection() {
    selectedElements.forEach(element => {
        element.classList.remove('selected');
    });
    selectedElements = [];
    
    // Dispatch selection changed event
    window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { selectedElements: [] }
    }));
}

function getSelectedElement() {
    return selectedElements.length > 0 ? selectedElements[0] : null;
}

function getSelectedElements() {
    return [...selectedElements];
}

// Enhanced selection with edge detection for resizing
function addSelectionAnchors(element) {
    // Set up edge detection and dynamic cursor
    if (window.edgeDetection && window.edgeDetection.setupDynamicCursor) {
        window.edgeDetection.setupDynamicCursor(element);
    }
    
    // Add enhanced click handler with edge detection
    element.addEventListener('mousedown', (e) => {
        // Don't select if clicking on a resize handle (backward compatibility)
        if (e.target.classList.contains('resize-handle')) return;
        
        // Check if in placement mode - let placement system handle events
        if (window.isInPlacementMode && window.isInPlacementMode()) {
            return;
        }
        
        // Don't interfere with existing drag operations
        if (window.isPanning) return;
        
        e.stopPropagation();
        
        // Try edge detection first for resize operations
        if (window.handleElementMouseDown && window.handleElementMouseDown(element, e)) {
            // Edge detection handled the event (started resize)
            return;
        }
        
        // Check if shift key is pressed for multi-selection
        const addToSelection = e.shiftKey;
        
        // Prevent text selection when shift-clicking
        if (addToSelection) {
            e.preventDefault();
        }
        
        selectElement(element, addToSelection);
    });
}

// Utility: check if element is static inside a frame (not free-floating)
function isStaticElementInFrame(element) {
    // Must be inside a .frame-content
    const frameContent = element.closest('.frame-content');
    if (!frameContent) return false;
    // If absolutely positioned, it's extracted/free-floating
    const style = window.getComputedStyle(element);
    if (style.position === 'absolute') return false;
    // Could add more checks if needed (e.g., data attributes)
    return true;
}

// --- Pure CSS visual refresh with edge detection ---
function refreshSelectionVisuals() {
    const startTime = performance.now();
    const selected = getSelectedElements();
    // Clean up any old resize handles that might still exist
    document.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
    
    // Set up edge detection for all selected elements
    selected.forEach(element => {
        // Skip static elements inside frames - they don't need resize
        if (isStaticElementInFrame(element)) return;
        
        // Set up edge detection and dynamic cursor
        if (window.edgeDetection && window.edgeDetection.setupDynamicCursor) {
            window.edgeDetection.setupDynamicCursor(element);
        }
        
        // Add visual selection indicator class
        element.classList.add('edge-resizable');
    });
    
    // Remove edge detection from unselected elements
    document.querySelectorAll('.edge-resizable').forEach(element => {
        if (!selectedElements.includes(element)) {
            element.classList.remove('edge-resizable');
            if (window.edgeDetection && window.edgeDetection.removeDynamicCursor) {
                window.edgeDetection.removeDynamicCursor(element);
            }
        }
    });
}
window.refreshSelectionVisuals = refreshSelectionVisuals;

// Auto-refresh selection visuals whenever selection changes
window.addEventListener('selectionChanged', (e) => {
    // Only refresh in edit mode
    if (window.canvasMode && window.canvasMode.isEditMode()) {
        // Edge detection setup is very lightweight, no need for RAF
        refreshSelectionVisuals();
    }
});

// Canvas click handling is now managed by marquee-selection.js
// to properly coordinate between marquee selection and selection clearing

// Make any element selectable with edge detection support
function makeSelectable(element) {
    // Set up edge detection for resizable elements
    if (window.edgeDetection && window.edgeDetection.isResizable && window.edgeDetection.isResizable(element)) {
        window.edgeDetection.setupDynamicCursor(element);
    }
    
    // Add enhanced click handler with edge detection
    element.addEventListener('mousedown', (e) => {
        // Check if in placement mode - let placement system handle events
        if (window.isInPlacementMode && window.isInPlacementMode()) {
            return;
        }
        
        // Check if in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
            return;
        }
        
        // Don't interfere with existing operations
        if (window.isPanning) return;
        
        // Don't select if it's an input/textarea and user is typing or in code editor
        if ((element.tagName === 'INPUT' && document.activeElement === element) ||
            (window.codeEditor && window.codeEditor.isActive())) return;
        
        e.stopPropagation();
        
        // Try edge detection first for resize operations
        if (window.handleElementMouseDown && window.handleElementMouseDown(element, e)) {
            // Edge detection handled the event (started resize)
            return;
        }
        
        // Check if shift key is pressed for multi-selection
        const addToSelection = e.shiftKey;
        
        // Prevent text selection when shift-clicking
        if (addToSelection) {
            e.preventDefault();
        }
        
        selectElement(element, addToSelection);
    });
}

// Make all elements in a container selectable
function makeContainerElementsSelectable(container) {
    // Find all potential selectable elements
    const selectableElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, button, input, img, div:not(.frame):not(.frame-content):not(.resize-handle)');
    
    selectableElements.forEach(element => {
        // Skip if already has selection capability
        if (element.dataset.selectable === 'true') return;
        
        // Skip resize handles
        if (element.classList.contains('resize-handle')) return;
        
        // Mark as selectable
        element.dataset.selectable = 'true';
        
        // Make it selectable
        makeSelectable(element);
    });
}

// Initialize selection for existing content
function initializeSelection() {
    // Make all frames selectable via shift+click (in addition to drag)
    document.querySelectorAll('.frame').forEach(frame => {
        if (frame.dataset.selectable !== 'true') {
            frame.dataset.selectable = 'true';
            makeSelectable(frame);
        }
    });
    
    // Make all existing frame content selectable
    document.querySelectorAll('.frame-content').forEach(content => {
        makeContainerElementsSelectable(content);
    });
    
    // Make canvas elements selectable
    makeContainerElementsSelectable(document.getElementById('canvas'));
}

// Expose selection functions globally
window.selectElement = selectElement;
window.clearSelection = clearSelection;
window.getSelectedElement = getSelectedElement;
window.getSelectedElements = getSelectedElements;
window.addSelectionAnchors = addSelectionAnchors;
window.makeSelectable = makeSelectable;
window.makeContainerElementsSelectable = makeContainerElementsSelectable;
window.initializeSelection = initializeSelection;

// Watch for new elements being added
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
                // Skip processing if in placement mode - element will be handled after placement
                if (window.isInPlacementMode && window.isInPlacementMode()) {
                    return;
                }
                
                // If it's a frame, make it selectable and scan its content
                if (node.classList && node.classList.contains('frame')) {
                    if (node.dataset.selectable !== 'true') {
                        node.dataset.selectable = 'true';
                        makeSelectable(node);
                    }
                    const content = node.querySelector('.frame-content');
                    if (content) {
                        makeContainerElementsSelectable(content);
                    }
                }
                // If it's a frame-content, scan its content
                else if (node.classList && node.classList.contains('frame-content')) {
                    makeContainerElementsSelectable(node);
                }
                // If it's any other element, make it selectable if appropriate
                else if (node.tagName && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BUTTON', 'INPUT', 'IMG'].includes(node.tagName)) {
                    if (node.dataset.selectable !== 'true') {
                        node.dataset.selectable = 'true';
                        makeSelectable(node);
                    }
                }
            }
        });
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Track shift key state to prevent text selection
document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        document.body.classList.add('shift-selecting');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        document.body.classList.remove('shift-selecting');
    }
});

// Also remove the class when window loses focus
window.addEventListener('blur', () => {
    document.body.classList.remove('shift-selecting');
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSelection);
} else {
    initializeSelection();
}