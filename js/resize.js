let resizing = false;
let resizeTarget = null;
let resizeHandle = null;
let resizeStartPos = { x: 0, y: 0 };
let resizeStartSize = { width: 0, height: 0 };
let resizeStartOffset = { left: 0, top: 0 };
let isDragToResize = false; // Flag for drag-to-resize mode

// Expose resizing state and functions globally for other modules
window.isResizing = () => resizing;
window.startResize = startResize;

function addResizeHandles(element) {
    // Use the selection module's anchor function
    if (window.addSelectionAnchors) {
        window.addSelectionAnchors(element);
    }
}

function startResize(e, element, handlePos) {
    if (window.isPanning) return; // Don't resize while panning
    
    resizing = true;
    resizeTarget = element;
    resizeHandle = handlePos;
    resizeStartPos = { x: e.clientX, y: e.clientY };
    
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    const rect = element.getBoundingClientRect();
    resizeStartSize = { 
        width: rect.width / zoom, 
        height: rect.height / zoom 
    };
    resizeStartOffset = { 
        left: parseFloat(element.style.left) || 0, 
        top: parseFloat(element.style.top) || 0 
    };
    
    element.classList.add('resizing');
    
    // Select the element when resizing starts
    if (window.selectElement) {
        window.selectElement(element);
    }
    
    bringToFront(element);
}

document.addEventListener('mousemove', (e) => {
    if (!resizing || window.isPanning) return;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    // Account for zoom
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    const scaledDeltaX = deltaX / zoom;
    const scaledDeltaY = deltaY / zoom;
    
    let newWidth = resizeStartSize.width;
    let newHeight = resizeStartSize.height;
    let newLeft = resizeStartOffset.left;
    let newTop = resizeStartOffset.top;
    
    // Adjust size and position based on handle
    switch (resizeHandle) {
        case 'se':
            if (isDragToResize) {
                // For drag-to-resize: calculate size directly from mouse position
                // The element spans from its top-left (resizeStartOffset) to current mouse
                const mouseCanvasCoords = window.canvasZoom ? 
                    window.canvasZoom.screenToCanvas(e.clientX, e.clientY) : 
                    { x: e.clientX, y: e.clientY };
                
                // Get element's parent position in canvas coordinates
                const parent = resizeTarget.parentElement;
                const parentRect = parent.getBoundingClientRect ? parent.getBoundingClientRect() : { left: 0, top: 0 };
                const parentCanvasCoords = window.canvasZoom ? 
                    window.canvasZoom.screenToCanvas(parentRect.left, parentRect.top) : 
                    { x: parentRect.left, y: parentRect.top };
                
                // Calculate size as difference between mouse and element's top-left
                // Element's absolute position = parent position + element's relative position
                const elementAbsoluteLeft = parentCanvasCoords.x + resizeStartOffset.left;
                const elementAbsoluteTop = parentCanvasCoords.y + resizeStartOffset.top;
                
                newWidth = Math.max(1, mouseCanvasCoords.x - elementAbsoluteLeft);
                newHeight = Math.max(1, mouseCanvasCoords.y - elementAbsoluteTop);
            } else {
                // Normal resize: add delta to starting size
                newWidth += scaledDeltaX;
                newHeight += scaledDeltaY;
            }
            break;
        case 'sw':
            newWidth -= scaledDeltaX;
            newHeight += scaledDeltaY;
            newLeft += scaledDeltaX;
            break;
        case 'ne':
            newWidth += scaledDeltaX;
            newHeight -= scaledDeltaY;
            newTop += scaledDeltaY;
            break;
        case 'nw':
            newWidth -= scaledDeltaX;
            newHeight -= scaledDeltaY;
            newLeft += scaledDeltaX;
            newTop += scaledDeltaY;
            break;
        case 'n':
            newHeight -= scaledDeltaY;
            newTop += scaledDeltaY;
            break;
        case 's':
            newHeight += scaledDeltaY;
            break;
        case 'e':
            newWidth += scaledDeltaX;
            break;
        case 'w':
            newWidth -= scaledDeltaX;
            newLeft += scaledDeltaX;
            break;
    }
    
    // Apply minimum sizes only for frames and element-frames, not for other elements
    if (resizeTarget.classList.contains('frame') || resizeTarget.classList.contains('element-frame')) {
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
    } else {
        // For other elements, allow any size including very small
        newWidth = Math.max(1, newWidth);
        newHeight = Math.max(1, newHeight);
    }
    
    // Update element
    resizeTarget.style.width = newWidth + 'px';
    resizeTarget.style.height = newHeight + 'px';
    resizeTarget.style.left = newLeft + 'px';
    resizeTarget.style.top = newTop + 'px';
    
    // Check for element containment if resizing a frame or element-frame
    if (resizeTarget.classList.contains('frame')) {
        checkElementContainment(resizeTarget);
    } else if (resizeTarget.classList.contains('element-frame')) {
        checkElementFrameContainment(resizeTarget);
    }
});

document.addEventListener('mouseup', (e) => {
    if (resizing) {
        try {
            resizeTarget.classList.remove('resizing');
        } catch (error) {
            console.error('Error during resize cleanup:', error);
        } finally {
            // Always reset resize state
            resizing = false;
            resizeTarget = null;
            resizeHandle = null;
            isDragToResize = false; // Reset drag-to-resize flag
        }
    }
});

function checkElementContainment(frame) {
    const frameContent = frame.querySelector('.frame-content');
    const frameRect = frameContent.getBoundingClientRect();
    
    // Check all free-floating elements in this frame
    const elementsInFrame = frameContent.querySelectorAll('.free-floating');
    elementsInFrame.forEach(element => {
        const elementRect = element.getBoundingClientRect();
        const elementCenter = {
            x: elementRect.left + elementRect.width / 2,
            y: elementRect.top + elementRect.height / 2
        };
        
        // If element center is outside frame, find appropriate container
        if (elementCenter.x < frameRect.left || elementCenter.x > frameRect.right ||
            elementCenter.y < frameRect.top || elementCenter.y > frameRect.bottom) {
            
            // Find which container the element should go to
            const newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, element);
            
            if (newParent && newParent !== frameContent) {
                // Calculate position relative to new parent accounting for zoom
                const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
                const newParentRect = newParent.getBoundingClientRect ? newParent.getBoundingClientRect() : { left: 0, top: 0 };
                const newLeft = (elementRect.left - newParentRect.left) / zoom;
                const newTop = (elementRect.top - newParentRect.top) / zoom;
                
                newParent.appendChild(element);
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
            }
        }
    });
    
    // Check all free-floating elements on canvas
    const canvasElements = canvas.querySelectorAll('.free-floating');
    canvasElements.forEach(element => {
        if (element.parentElement !== canvas) return;
        
        const elementRect = element.getBoundingClientRect();
        const elementCenter = {
            x: elementRect.left + elementRect.width / 2,
            y: elementRect.top + elementRect.height / 2
        };
        
        // Check if element should move to any frame
        const newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, element);
        
        if (newParent && newParent !== canvas) {
            // Calculate position relative to new parent accounting for zoom
            const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
            const newParentRect = newParent.getBoundingClientRect();
            const newLeft = (elementRect.left - newParentRect.left) / zoom;
            const newTop = (elementRect.top - newParentRect.top) / zoom;
            
            newParent.appendChild(element);
            element.style.left = newLeft + 'px';
            element.style.top = newTop + 'px';
        }
    });
}

function checkElementFrameContainment(elementFrame) {
    const frameRect = elementFrame.getBoundingClientRect();
    
    // Check all free-floating elements in this element-frame
    const elementsInFrame = elementFrame.querySelectorAll('.free-floating');
    elementsInFrame.forEach(element => {
        if (element === elementFrame) return; // Skip the element-frame itself
        
        const elementRect = element.getBoundingClientRect();
        const elementCenter = {
            x: elementRect.left + elementRect.width / 2,
            y: elementRect.top + elementRect.height / 2
        };
        
        // If element center is outside element-frame, find appropriate container
        if (elementCenter.x < frameRect.left || elementCenter.x > frameRect.right ||
            elementCenter.y < frameRect.top || elementCenter.y > frameRect.bottom) {
            
            // Find which container the element should go to
            const newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, element);
            
            if (newParent && newParent !== elementFrame) {
                // Calculate position relative to new parent accounting for zoom
                const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
                const newParentRect = newParent.getBoundingClientRect ? newParent.getBoundingClientRect() : { left: 0, top: 0 };
                const newLeft = (elementRect.left - newParentRect.left) / zoom;
                const newTop = (elementRect.top - newParentRect.top) / zoom;
                
                newParent.appendChild(element);
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
            }
        }
    });
}