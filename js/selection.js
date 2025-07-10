// Selection state management
let selectedElement = null;

// Selection functions
function selectElement(element) {
    // Clear previous selection
    if (selectedElement) {
        selectedElement.classList.remove('selected');
    }
    
    // Select new element
    selectedElement = element;
    if (element) {
        element.classList.add('selected');
    }
}

function clearSelection() {
    if (selectedElement) {
        selectedElement.classList.remove('selected');
        selectedElement = null;
    }
}

function getSelectedElement() {
    return selectedElement;
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
        selectElement(element);
    });
}

// Global click handler to clear selection when clicking on empty space
document.addEventListener('mousedown', (e) => {
    // Clear selection if clicking on empty space (canvas background)
    if (e.target === document.getElementById('canvas') || e.target === document.body) {
        clearSelection();
    }
});

// Expose selection functions globally
window.selectElement = selectElement;
window.clearSelection = clearSelection;
window.getSelectedElement = getSelectedElement;
window.addSelectionAnchors = addSelectionAnchors;