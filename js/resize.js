let resizing = false;
let resizeTarget = null;
let resizeHandle = null;
let resizeStartPos = { x: 0, y: 0 };
let resizeStartSize = { width: 0, height: 0 };
let resizeStartOffset = { left: 0, top: 0 };
let isDragToResize = false; // Flag for drag-to-resize mode

// For undo tracking
let resizeStartContainerId = null;

// Expose resizing state and functions globally for other modules
window.isResizing = () => resizing;
window.startResize = startResize;

function addResizeHandles(element) {
    // DEPRECATED: Resize functionality now uses edge detection system
    console.warn('⚠️ addResizeHandles() is deprecated - resize now uses edge detection on element borders');
    
    // Ensure element is properly set up for selection which will trigger handle management
    if (window.makeSelectable) {
        window.makeSelectable(element);
    }
}

function startResize(e, element, handlePos) {
    // Check if in interactive mode
    if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
        return;
    }
    
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
    
    // Capture container ID for undo tracking
    resizeStartContainerId = element.parentElement?.id || 'canvas';
    
    // Select the element when resizing starts (preserve multi-selection if element is already selected)
    if (window.selectElement && window.getSelectedElements) {
        const selectedElements = window.getSelectedElements();
        const isAlreadySelected = selectedElements.includes(element);
        if (!isAlreadySelected) {
            window.selectElement(element);
        }
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
    
    // Apply minimum sizes only for frames, not for element-frames or other elements
    if (resizeTarget.classList.contains('frame')) {
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
    } else {
        // For element-frames and other elements, allow any size including very small
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
            // Record resize for undo before cleanup
            if (window.recordResize && resizeTarget) {
                const newContainerId = resizeTarget.parentElement?.id || 'canvas';
                
                // Only record if something actually changed
                if (resizeStartSize.width !== parseFloat(resizeTarget.style.width) ||
                    resizeStartSize.height !== parseFloat(resizeTarget.style.height) ||
                    resizeStartOffset.left !== parseFloat(resizeTarget.style.left) ||
                    resizeStartOffset.top !== parseFloat(resizeTarget.style.top) ||
                    resizeStartContainerId !== newContainerId) {
                    
                    window.recordResize(
                        resizeTarget.id,
                        { width: resizeStartSize.width + 'px', height: resizeStartSize.height + 'px' },
                        { width: resizeTarget.style.width, height: resizeTarget.style.height },
                        { left: resizeStartOffset.left + 'px', top: resizeStartOffset.top + 'px' },
                        { left: resizeTarget.style.left, top: resizeTarget.style.top },
                        resizeStartContainerId,
                        newContainerId
                    );
                }
            }
            
            // Mark element as manually resized to disable auto-resize behavior
            if (resizeTarget && window.textEditing && window.textEditing.isTextLikeElement(resizeTarget)) {
                resizeTarget.dataset.manuallyResized = 'true';
                // Also clear explicit auto-fit mode
                if (resizeTarget.dataset.autoFit === 'true') {
                    delete resizeTarget.dataset.autoFit;
                }
            }
            
            resizeTarget.classList.remove('resizing');
        } catch (error) {
            console.error('Error during resize cleanup:', error);
        } finally {
            // Always reset resize state
            resizing = false;
            resizeTarget = null;
            resizeHandle = null;
            isDragToResize = false; // Reset drag-to-resize flag
            resizeStartContainerId = null;
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
                
                // Get the old container before moving
                const oldParent = element.parentElement;
                const oldContainerId = oldParent?.id || 'canvas';
                
                // Clean up script handlers from the old container by cloning
                // No script cleanup needed - iframe isolation handles script separation
                newParent.appendChild(element);
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                
                console.log(`📦 RESIZE: Element moved to new container (no script cleanup needed)`);
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
    
    const endTime = performance.now();
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
                
                // Get the old container before moving
                const oldParent = element.parentElement;
                const oldContainerId = oldParent?.id || 'canvas';
                
                // Clean up script handlers from the old container by cloning
                // No script cleanup needed - iframe isolation handles script separation
                newParent.appendChild(element);
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                
                console.log(`📦 RESIZE: Element moved to new container (no script cleanup needed)`);
            }
        }
    });
}

// Resize a text element to fit its content
function resizeTextElementToFitContent(element) {
    if (!window.textEditing || !window.textEditing.isTextLikeElement(element)) return;

    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;

    // Helper to measure a node's intrinsic rect by cloning it
    function measureNode(node, forceInlineBlock = false, whiteSpace = 'pre-wrap') {
        const clone = node.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = 'auto';
        clone.style.width = 'auto';
        clone.style.whiteSpace = whiteSpace;
        if (forceInlineBlock) {
            clone.style.display = 'inline-block';
        }
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.zIndex = '-1';
        clone.style.maxWidth = 'none';
        clone.style.maxHeight = 'none';
        clone.style.minWidth = '0';
        clone.style.minHeight = '0';
        document.body.appendChild(clone);
        const rect = clone.getBoundingClientRect();
        document.body.removeChild(clone);
        return rect;
    }

    if (tag === 'button') {
        // For buttons: adjust width to fit content, but respect user-defined height
        const label = element.querySelector('span[data-button-label="true"]') || element;
        const useNowrap = element.dataset.autoFit === 'true';
        const labelRect = measureNode(label, true, useNowrap ? 'nowrap' : 'pre-wrap');

        const cs = window.getComputedStyle(element);
        const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

        const newWidth = (labelRect.width + paddingX + borderX) / zoom;
        const contentHeight = (labelRect.height + paddingY + borderY) / zoom;

        // Preserve explicit manual height if present; otherwise, use content height
        const hasManualHeight = element.dataset.manuallyResized === 'true' && !!element.style.height;
        if (!hasManualHeight) {
            element.style.height = Math.max(1, contentHeight) + 'px';
        }
        element.style.width = Math.max(1, newWidth) + 'px';
    } else {
        // Default path for non-button text elements
        const useNowrap = element.dataset.autoFit === 'true';
        const rect = measureNode(element, false, useNowrap ? 'nowrap' : 'pre-wrap');
        // If element has been manually resized, preserve width; only adjust height to content
        const preserveWidth = element.dataset.manuallyResized === 'true' && !!element.style.width;
        if (!preserveWidth) {
            element.style.width = (rect.width / zoom) + 'px';
        }
        element.style.height = (rect.height / zoom) + 'px';
    }
    // Mark element as auto-fit mode for auto-resize behavior
    element.dataset.autoFit = 'true';
    // Do not clear manuallyResized here; callers that want to reset manual
    // sizing (e.g., explicit resize-to-fit) should clear it themselves upstream.
    // Optionally, record resize for undo
    if (window.recordResize && element.id) {
        window.recordResize(
            element.id,
            { width: '', height: '' },
            { width: element.style.width, height: element.style.height },
            { left: element.style.left, top: element.style.top },
            { left: element.style.left, top: element.style.top },
            element.parentElement?.id || 'canvas',
            element.parentElement?.id || 'canvas'
        );
    }
}
window.resizeTextElementToFitContent = resizeTextElementToFitContent;

// Explicit single-line fit used by corner handle double-click
function resizeTextElementToSingleLineFit(element) {
    if (!window.textEditing || !window.textEditing.isTextLikeElement(element)) return;

    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;

    function measureNodeNowrap(node, forceInlineBlock = false) {
        const clone = node.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = 'auto';
        clone.style.width = 'auto';
        clone.style.whiteSpace = 'nowrap';
        if (forceInlineBlock) clone.style.display = 'inline-block';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.zIndex = '-1';
        clone.style.maxWidth = 'none';
        clone.style.maxHeight = 'none';
        clone.style.minWidth = '0';
        clone.style.minHeight = '0';
        document.body.appendChild(clone);
        const rect = clone.getBoundingClientRect();
        document.body.removeChild(clone);
        return rect;
    }

    if (tag === 'button') {
        const label = element.querySelector('span[data-button-label="true"]') || element;
        const labelRect = measureNodeNowrap(label, true);
        const cs = window.getComputedStyle(element);
        const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
        element.style.width = Math.max(1, (labelRect.width + paddingX + borderX) / zoom) + 'px';
        element.style.height = Math.max(1, (labelRect.height + paddingY + borderY) / zoom) + 'px';
    } else {
        const rect = measureNodeNowrap(element, false);
        element.style.whiteSpace = 'nowrap';
        element.style.width = (rect.width / zoom) + 'px';
        element.style.height = (rect.height / zoom) + 'px';
    }

    // Enable auto-fit mode and clear manual flag to allow dynamic width during editing
    element.dataset.autoFit = 'true';
    if (element.dataset.manuallyResized === 'true') {
        delete element.dataset.manuallyResized;
    }

    // Optionally, record resize for undo consistency
    if (window.recordResize && element.id) {
        window.recordResize(
            element.id,
            { width: '', height: '' },
            { width: element.style.width, height: element.style.height },
            { left: element.style.left, top: element.style.top },
            { left: element.style.left, top: element.style.top },
            element.parentElement?.id || 'canvas',
            element.parentElement?.id || 'canvas'
        );
    }
}
window.resizeTextElementToSingleLineFit = resizeTextElementToSingleLineFit;