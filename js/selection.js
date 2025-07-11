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
        return;
    }
    
    // Add element to selection if not already selected
    if (!selectedElements.includes(element)) {
        selectedElements.push(element);
        element.classList.add('selected');
    }
}

function clearSelection() {
    selectedElements.forEach(element => {
        element.classList.remove('selected');
    });
    selectedElements = [];
}

function getSelectedElement() {
    return selectedElements.length > 0 ? selectedElements[0] : null;
}

function getSelectedElements() {
    return [...selectedElements];
}

// Add selection anchors (resize handles) to elements
function addSelectionAnchors(element) {
    const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        element.appendChild(handle);
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Trigger resize functionality if available
            if (window.startResize) {
                window.startResize(e, element, pos);
            }
        });
    });
    
    // Add click handler for selection
    element.addEventListener('mousedown', (e) => {
        // Don't select if clicking on a resize handle
        if (e.target.classList.contains('resize-handle')) return;
        
        // Don't interfere with existing drag operations
        if (window.isPanning) return;
        
        e.stopPropagation();
        
        // Check if shift key is pressed for multi-selection
        const addToSelection = e.shiftKey;
        
        // Prevent text selection when shift-clicking
        if (addToSelection) {
            e.preventDefault();
        }
        
        selectElement(element, addToSelection);
    });
}

// Canvas click handling is now managed by marquee-selection.js
// to properly coordinate between marquee selection and selection clearing

// Make any element selectable (without resize handles)
function makeSelectable(element) {
    // Add click handler for selection
    element.addEventListener('mousedown', (e) => {
        // Don't interfere with existing operations
        if (window.isPanning) return;
        
        // Don't select if it's an input and user is typing
        if (element.tagName === 'INPUT' && document.activeElement === element) return;
        
        e.stopPropagation();
        
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