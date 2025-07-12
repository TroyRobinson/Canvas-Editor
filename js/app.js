// Group selected elements into an element-frame
function groupSelectedElements() {
    // Get selected elements
    const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
    
    // Need at least 2 elements to group
    if (selectedElements.length < 2) {
        return;
    }
    
    
    // Calculate bounding box of all selected elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    selectedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const canvasRect = document.getElementById('canvas').getBoundingClientRect();
        
        // Convert to canvas coordinates
        const elementLeft = rect.left - canvasRect.left;
        const elementTop = rect.top - canvasRect.top;
        const elementRight = elementLeft + rect.width;
        const elementBottom = elementTop + rect.height;
        
        minX = Math.min(minX, elementLeft);
        minY = Math.min(minY, elementTop);
        maxX = Math.max(maxX, elementRight);
        maxY = Math.max(maxY, elementBottom);
    });
    
    // Create element-frame at the bounding box position
    const groupWidth = maxX - minX;
    const groupHeight = maxY - minY;
    const elementFrame = createElementFrame(minX, minY, groupWidth, groupHeight);
    
    // Prepare data for undo
    const groupData = [];
    
    // Move selected elements into the element-frame
    selectedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const canvasRect = document.getElementById('canvas').getBoundingClientRect();
        const frameRect = elementFrame.getBoundingClientRect();
        
        // Capture original state for undo
        groupData.push({
            elementId: element.id,
            originalContainerId: element.parentElement?.id || 'canvas',
            originalPosition: { left: element.style.left, top: element.style.top },
            groupPosition: { left: '', top: '' } // Will be set below
        });
        
        // Calculate new relative position within the element-frame
        const newLeft = (rect.left - canvasRect.left) - (frameRect.left - canvasRect.left);
        const newTop = (rect.top - canvasRect.top) - (frameRect.top - canvasRect.top);
        
        // Update element position
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        
        // Update group position in undo data
        groupData[groupData.length - 1].groupPosition = { 
            left: newLeft + 'px', 
            top: newTop + 'px' 
        };
        
        // Move element to the element-frame
        elementFrame.appendChild(element);
    });
    
    // Clear current selection and select the new element-frame
    if (window.clearSelection) {
        window.clearSelection();
    }
    if (window.selectElement) {
        window.selectElement(elementFrame);
    }
    
    // Record grouping for undo
    if (window.recordGroup && window.undoManager) {
        const groupState = window.undoManager.captureElementState(elementFrame);
        window.recordGroup(elementFrame.id, groupState, 'canvas', groupData);
    }
}

// Initialize the canvas with some frames
window.addEventListener('load', () => {
    initializeCanvas();
    
    // Add keyboard shortcut to create new frames
    document.addEventListener('keydown', (e) => {
        if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const x = Math.random() * (window.innerWidth - 300);
            const y = Math.random() * (window.innerHeight - 200);
            createFrame(x, y);
        }
        
        // Reset zoom with Cmd/Ctrl + 0
        if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            window.canvasZoom.resetZoom();
        }
        
        // Delete selected elements with Backspace
        if (e.key === 'Backspace') {
            // Protect situations where user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
                return; // Allow normal backspace behavior in text fields
            }
            
            // Get selected elements
            const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
            
            if (selectedElements.length > 0) {
                e.preventDefault(); // Prevent browser back navigation
                
                // Record deletion for undo
                if (window.recordDelete) {
                    window.recordDelete(selectedElements);
                }
                
                // Remove each selected element from DOM
                selectedElements.forEach(element => {
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                });
                
                // Clear selection
                if (window.clearSelection) {
                    window.clearSelection();
                }
            }
        }
        
        // Group selected elements with Cmd/Ctrl + G
        if (e.key === 'g' && (e.metaKey || e.ctrlKey)) {
            // Protect situations where user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
                return; // Allow normal typing behavior in text fields
            }
            
            e.preventDefault();
            groupSelectedElements();
        }
        
        // Undo with Cmd/Ctrl + Z
        if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
            // Protect situations where user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
                return; // Allow normal undo behavior in text fields
            }
            
            e.preventDefault();
            if (window.undoManager) {
                window.undoManager.undo();
            }
        }
        
        // Redo with Shift + Cmd/Ctrl + Z
        if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
            // Protect situations where user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
                return; // Allow normal redo behavior in text fields
            }
            
            e.preventDefault();
            if (window.undoManager) {
                window.undoManager.redo();
            }
        }
    });
});