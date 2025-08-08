let extracting = false;
let extractTarget = null;
let extractGhost = null;

function setupElementExtraction(frameContent) {
    frameContent.addEventListener('mousedown', (e) => {
        if (!e.metaKey && !e.ctrlKey) return; // Only extract with cmd/ctrl
        if (window.isPanning) return; // Don't extract while panning
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) return; // No extraction in interactive mode
        
        let target = e.target;
        
        // Find the closest extractable element (could be the target itself or a parent)
        // This allows extracting element-frames by clicking on their children
        while (target && target !== frameContent) {
            if (target.classList.contains('free-floating') || 
                target.classList.contains('element-frame') ||
                target.tagName === 'P' || target.tagName === 'H3' || 
                target.tagName === 'BUTTON' || target.tagName === 'DIV') {
                break;
            }
            target = target.parentElement;
        }
        
        if (!target || target === frameContent) return; // No valid target found
        if (target.classList.contains('free-floating')) return; // Already extracted
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Prevent parent handlers
        
        // Start extraction
        extracting = true;
        extractTarget = target;
        
        // Create ghost element for visual feedback
        const rect = target.getBoundingClientRect();
        extractGhost = target.cloneNode(true);
        extractGhost.className = 'extraction-ghost';
        extractGhost.style.width = rect.width + 'px';
        extractGhost.style.height = rect.height + 'px';
        extractGhost.style.left = rect.left + 'px';
        extractGhost.style.top = rect.top + 'px';
        document.body.appendChild(extractGhost);
        
        // Immediately convert to absolute positioning
        makeElementFreeFloating(target, e.clientX, e.clientY);
    }, true); // Use capture phase
}

function makeElementFreeFloating(element, mouseX, mouseY) {
    const parentRect = element.parentElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Capture original state for undo
    const originalState = {
        position: element.style.position || '',
        left: element.style.left || '',
        top: element.style.top || '',
        width: element.style.width || '',
        height: element.style.height || ''
    };
    const originalContainerId = element.parentElement?.id || 'canvas';
    
    // Calculate position relative to parent
    const relativeLeft = elementRect.left - parentRect.left;
    const relativeTop = elementRect.top - parentRect.top;
    
    // Account for zoom
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    
    // Add free-floating class and set position
    element.classList.add('free-floating');
    element.style.left = (relativeLeft / zoom) + 'px';
    element.style.top = (relativeTop / zoom) + 'px';
    
    // Preserve width and height for all elements including text elements
    element.style.width = (elementRect.width / zoom) + 'px';
    element.style.height = (elementRect.height / zoom) + 'px';
    
    // Resize handles now managed automatically by edge detection system when selected
    // addResizeHandles(element); // DEPRECATED
    
    // Setup dragging for this element
    setupElementDragging(element);
    
    // Start dragging immediately with zoom-adjusted offset
    currentDragging = element;
    const rect = element.getBoundingClientRect();
    dragOffset.x = (mouseX - rect.left) / zoom;
    dragOffset.y = (mouseY - rect.top) / zoom;
    element.classList.add('dragging');
    
    // Select the element so it remains selected after drag ends
    if (window.selectElement) {
        window.selectElement(element);
    }
    
    // Record extraction for undo
    if (window.recordExtract) {
        const extractedState = {
            position: 'absolute',
            left: element.style.left,
            top: element.style.top,
            width: element.style.width,
            height: element.style.height
        };
        window.recordExtract(element.id, originalState, extractedState, originalContainerId);
    }
    
    console.log(`Element extracted and is now free-floating`);
}

// Update mouse move for extraction ghost
const originalMouseMove = document.onmousemove;
document.addEventListener('mousemove', (e) => {
    if (extractGhost) {
        extractGhost.style.left = (e.clientX - dragOffset.x) + 'px';
        extractGhost.style.top = (e.clientY - dragOffset.y) + 'px';
    }
});

// Clean up extraction on mouse up
const originalMouseUp = document.onmouseup;
document.addEventListener('mouseup', (e) => {
    // Clean up extraction state
    if (extractGhost) {
        try {
            document.body.removeChild(extractGhost);
        } catch (error) {
            console.error('Error removing extraction ghost:', error);
        }
        extractGhost = null;
    }
    extracting = false;
    extractTarget = null;
});