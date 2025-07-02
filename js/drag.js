let currentDragging = null;
let dragOffset = { x: 0, y: 0 };

function setupFrameDragging(frame, titleBar) {
    frame.addEventListener('mousedown', (e) => {
        if (e.metaKey || e.ctrlKey) return; // Don't drag frame if cmd/ctrl is held
        if (e.target.classList.contains('free-floating')) return; // Don't drag frame if clicking a free-floating element
        if (e.target.classList.contains('resize-handle')) return; // Don't drag if clicking resize handle
        if (window.isPanning) return; // Don't drag if panning
        
        // Don't drag frame during placement or resize operations
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (window.isPlacementDragging && window.isPlacementDragging()) return;
        if (window.isResizing && window.isResizing()) return;
        
        currentDragging = frame;
        const rect = frame.getBoundingClientRect();
        
        // Account for zoom when calculating drag offset
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        dragOffset.x = (e.clientX - rect.left) / zoom;
        dragOffset.y = (e.clientY - rect.top) / zoom;
        
        frame.classList.add('dragging');
        bringToFront(frame);
        e.preventDefault();
    });
}

function setupElementDragging(element) {
    element.addEventListener('mousedown', (e) => {
        if (e.metaKey || e.ctrlKey) return; // This is for extraction, not dragging
        if (!element.classList.contains('free-floating')) return;
        if (e.target.classList.contains('resize-handle')) return; // Don't drag if clicking resize handle
        if (window.isPanning) return; // Don't drag if panning
        
        // Don't drag during placement or resize operations
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (window.isPlacementDragging && window.isPlacementDragging()) return;
        if (window.isResizing && window.isResizing()) return;
        
        // Check if we're clicking on a nested element-frame or its child
        // If so, don't start dragging this element
        const clickedElement = e.target;
        const isNestedElementFrame = clickedElement.classList.contains('element-frame') && 
                                   clickedElement !== element;
        const isChildOfNestedElementFrame = clickedElement.closest('.element-frame') && 
                                          clickedElement.closest('.element-frame') !== element;
        
        if (isNestedElementFrame || isChildOfNestedElementFrame) {
            return; // Let the nested element handle the drag
        }
        
        e.stopPropagation();
        e.stopImmediatePropagation(); // Prevent any other handlers from firing
        
        currentDragging = element;
        const rect = element.getBoundingClientRect();
        
        // Account for zoom when calculating drag offset
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        dragOffset.x = (e.clientX - rect.left) / zoom;
        dragOffset.y = (e.clientY - rect.top) / zoom;
        
        element.classList.add('dragging');
        bringToFront(element);
        
        // Also bring parent frame to front if element is in a frame
        const parentFrame = element.closest('.frame');
        if (parentFrame) {
            bringToFront(parentFrame);
        }
        
        e.preventDefault();
    }, true); // Use capture phase to handle events before they bubble
}

// Global mouse move handler
document.addEventListener('mousemove', (e) => {
    if (!currentDragging || window.isPanning) return;
    
    // Get canvas coordinates accounting for zoom and pan
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    const canvasRect = canvas.getBoundingClientRect();
    
    if (currentDragging.classList.contains('frame')) {
        // Convert mouse position to canvas space
        const canvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
        
        // Apply drag offset in canvas space
        const newLeft = canvasCoords.x - dragOffset.x;
        const newTop = canvasCoords.y - dragOffset.y;
        
        // Keep frame within canvas bounds (in canvas coordinates)
        const frameWidth = parseFloat(currentDragging.style.width) || currentDragging.offsetWidth;
        const frameHeight = parseFloat(currentDragging.style.height) || currentDragging.offsetHeight;
        
        currentDragging.style.left = Math.max(0, Math.min(newLeft, window.innerWidth / zoom - frameWidth)) + 'px';
        currentDragging.style.top = Math.max(0, Math.min(newTop, window.innerHeight / zoom - frameHeight)) + 'px';
    } else if (currentDragging.classList.contains('free-floating')) {
        // For free-floating elements, calculate relative to parent
        const parentRect = currentDragging.parentElement.getBoundingClientRect();
        
        // Convert positions to canvas space
        const mouseCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
        const parentCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(parentRect.left, parentRect.top) : { x: parentRect.left, y: parentRect.top };
        
        currentDragging.style.left = (mouseCanvasCoords.x - dragOffset.x - parentCanvasCoords.x) + 'px';
        currentDragging.style.top = (mouseCanvasCoords.y - dragOffset.y - parentCanvasCoords.y) + 'px';
    }
});

// Global mouse up handler
document.addEventListener('mouseup', (e) => {
    if (!currentDragging) return;
    
    // Always ensure we clean up the dragging state, regardless of any errors
    try {
        if (currentDragging.classList.contains('free-floating')) {
            // Check if element should be moved to a different container
            const elementRect = currentDragging.getBoundingClientRect();
            const elementCenter = {
                x: elementRect.left + elementRect.width / 2,
                y: elementRect.top + elementRect.height / 2
            };
            
            // Find which container the element is over
            let newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, currentDragging);
            
            if (newParent && newParent !== currentDragging.parentElement) {
                moveElementToContainer(currentDragging, newParent, e.clientX, e.clientY);
            }
        }
    } catch (error) {
        console.error('Error during mouse-up container check:', error);
    } finally {
        // Always clean up dragging state to ensure element detaches from mouse
        if (currentDragging) {
            currentDragging.classList.remove('dragging');
            currentDragging = null;
        }
        // Reset drag offset
        dragOffset = { x: 0, y: 0 };
    }
});

function findContainerAtPoint(x, y, excludeElement) {
    // Get all potential drop targets at the point
    const elementsAtPoint = document.elementsFromPoint(x, y);
    
    // Find the most specific (deepest nested) container
    for (let element of elementsAtPoint) {
        if (element === excludeElement) continue; // Don't drop on itself
        
        // Check if it's an element-frame
        if (element.classList.contains('element-frame')) {
            return element;
        }
        
        // Check if it's a frame-content area
        if (element.classList.contains('frame-content')) {
            return element;
        }
        
        // Check if we're inside a frame and can return its content
        if (element.classList.contains('frame')) {
            const content = element.querySelector('.frame-content');
            if (content) {
                const rect = content.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return content;
                }
            }
        }
    }
    
    // If not over any frame, return canvas
    return canvas;
}

function moveElementToContainer(element, newParent, mouseX, mouseY) {
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    
    // Convert mouse position to canvas coordinates
    const mouseCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(mouseX, mouseY) : { x: mouseX, y: mouseY };
    
    // Get parent position in canvas coordinates
    const newParentRect = newParent.getBoundingClientRect ? newParent.getBoundingClientRect() : { left: 0, top: 0 };
    const parentCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(newParentRect.left, newParentRect.top) : { x: newParentRect.left, y: newParentRect.top };
    
    // Calculate element's position relative to new parent
    // Use the mouse position minus the drag offset to maintain the grab point
    let newLeft = mouseCanvasCoords.x - dragOffset.x - parentCanvasCoords.x;
    let newTop = mouseCanvasCoords.y - dragOffset.y - parentCanvasCoords.y;
    
    // Move element to new parent
    newParent.appendChild(element);
    
    // Update position
    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';
    
    console.log(`Element moved to ${newParent.id || newParent.className || 'container'}`);
}