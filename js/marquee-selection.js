// Marquee selection state
let isMarqueeSelecting = false;
let marqueeStartPos = { x: 0, y: 0 };
let marqueeElement = null;
let isDragging = false;
let dragThreshold = 5; // pixels
let previewSelectedElements = new Set();
let marqueeStartElement = null;

// Create marquee element
function createMarqueeElement() {
    const marquee = document.createElement('div');
    marquee.className = 'selection-marquee';
    marquee.style.position = 'fixed';
    marquee.style.pointerEvents = 'none';
    document.body.appendChild(marquee);
    return marquee;
}

// Start marquee selection
function startMarqueeSelection(e) {
    isMarqueeSelecting = true;
    marqueeStartPos = { x: e.clientX, y: e.clientY };
    
    // Create marquee element if it doesn't exist
    if (!marqueeElement) {
        marqueeElement = createMarqueeElement();
    }
    
    // Position and show marquee
    marqueeElement.style.left = e.clientX + 'px';
    marqueeElement.style.top = e.clientY + 'px';
    marqueeElement.style.width = '0px';
    marqueeElement.style.height = '0px';
    marqueeElement.style.display = 'block';
}

// Clear preview selections
function clearPreviewSelections() {
    previewSelectedElements.forEach(element => {
        element.classList.remove('preview-selected');
    });
    previewSelectedElements.clear();
}

// Update preview selections based on current marquee
function updatePreviewSelections(marqueeRect) {
    // Clear previous preview
    clearPreviewSelections();
    
    // Get all selectable elements
    const elements = getAllSelectableElements();
    
    // Check each element for intersection/containment
    elements.forEach(element => {
        const elementRect = element.getBoundingClientRect();
        let shouldPreview = false;
        const hasChildren = hasSelectableChildren(element);
        
        if (hasChildren) {
            // Container with children - must be completely contained
            shouldPreview = rectContainsElement(marqueeRect, elementRect);
        } else {
            // Standalone element - just needs to intersect
            shouldPreview = rectsIntersect(marqueeRect, elementRect);
        }
        
        if (shouldPreview) {
            element.classList.add('preview-selected');
            previewSelectedElements.add(element);
        }
    });
}

// Update marquee during drag
function updateMarqueeSelection(e) {
    if (!isMarqueeSelecting) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Calculate marquee dimensions
    const left = Math.min(marqueeStartPos.x, currentX);
    const top = Math.min(marqueeStartPos.y, currentY);
    const width = Math.abs(currentX - marqueeStartPos.x);
    const height = Math.abs(currentY - marqueeStartPos.y);
    
    // Update marquee element
    marqueeElement.style.left = left + 'px';
    marqueeElement.style.top = top + 'px';
    marqueeElement.style.width = width + 'px';
    marqueeElement.style.height = height + 'px';
    
    // Update preview selections in real-time
    const marqueeRect = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
    };
    updatePreviewSelections(marqueeRect);
}

// Check if element has selectable children
function hasSelectableChildren(element) {
    // Don't check children of the element itself, only direct descendants
    // to avoid counting the element's own classes
    
    // Check for any free-floating children
    const freeFloating = element.querySelectorAll('.free-floating');
    if (freeFloating.length > 0) return true;
    
    // Check for frames
    const frames = element.querySelectorAll('.frame');
    if (frames.length > 0) return true;
    
    // Check for any elements marked as selectable
    const selectableChildren = element.querySelectorAll('[data-selectable="true"]');
    if (selectableChildren.length > 0) return true;
    
    // Check for specific element types that are selectable
    const selectableTypes = element.querySelectorAll('.text-element, .button-element, .input-wrapper, .line-element, .circle-element');
    if (selectableTypes.length > 0) return true;
    
    return false;
}

// Check if rectangle completely contains element
function rectContainsElement(marqueeRect, elementRect) {
    return marqueeRect.left <= elementRect.left &&
           marqueeRect.right >= elementRect.right &&
           marqueeRect.top <= elementRect.top &&
           marqueeRect.bottom >= elementRect.bottom;
}

// Check if rectangles intersect
function rectsIntersect(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
}

// Get all selectable elements
function getAllSelectableElements() {
    const elements = new Set(); // Use Set to avoid duplicates
    
    // Get all frames
    document.querySelectorAll('.frame').forEach(el => elements.add(el));
    
    // Get all free-floating elements (including element-frames, buttons, text, etc.)
    document.querySelectorAll('.free-floating').forEach(el => elements.add(el));
    
    // Get all elements with specific element classes
    document.querySelectorAll('.text-element, .button-element, .input-wrapper, .line-element, .circle-element').forEach(el => elements.add(el));
    
    // Get all elements marked as selectable
    document.querySelectorAll('[data-selectable="true"]').forEach(el => elements.add(el));
    
    return Array.from(elements);
}

// End marquee selection and select elements
function endMarqueeSelection(e, addToSelection = false) {
    if (!isMarqueeSelecting) return;
    
    // Get marquee bounds
    const marqueeRect = marqueeElement.getBoundingClientRect();
    
    // Only process if marquee has some size
    if (marqueeRect.width > 5 || marqueeRect.height > 5) {
        // Clear selection if not adding to existing
        if (!addToSelection && window.clearSelection) {
            window.clearSelection();
        }
        
        // Select all elements that are currently previewed
        previewSelectedElements.forEach(element => {
            if (window.selectElement) {
                window.selectElement(element, true); // Always add to selection
            }
        });
    }
    
    // Clear preview selections
    clearPreviewSelections();
    
    // Hide marquee
    marqueeElement.style.display = 'none';
    isMarqueeSelecting = false;
}

// Initialize marquee selection
function initializeMarqueeSelection() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Handle mousedown on canvas, frame-content, and body for selection clearing
    document.addEventListener('mousedown', (e) => {
        const isCanvas = e.target === canvas;
        const isFrameContent = e.target.classList && e.target.classList.contains('frame-content');

        if (isCanvas || isFrameContent) {
            // Check if in interactive mode
            if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
                return;
            }

            // Don't start marquee if panning or other operations
            if (window.isPanning) return;
            if (window.isInPlacementMode && window.isInPlacementMode()) return;
            if (window.isResizing && window.isResizing()) return;

            // Store start position but don't start marquee yet
            marqueeStartPos = { x: e.clientX, y: e.clientY };
            marqueeStartElement = isCanvas ? canvas : e.target;
            isDragging = false;
        }
        // Handle clicks on body for selection clearing
        else if (e.target === document.body) {
            // Clear selections on empty space click
            if (!e.shiftKey && window.clearSelection) {
                window.clearSelection();
            }
        }
    });
    
    // Handle mousemove
    document.addEventListener('mousemove', (e) => {
        // Check if we should start marquee selection
        if (marqueeStartPos.x !== 0 && marqueeStartPos.y !== 0 && !isMarqueeSelecting) {
            const deltaX = e.clientX - marqueeStartPos.x;
            const deltaY = e.clientY - marqueeStartPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > dragThreshold) {
                // Start marquee selection
                startMarqueeSelection({ clientX: marqueeStartPos.x, clientY: marqueeStartPos.y });
                isDragging = true;
            }
        }
        
        updateMarqueeSelection(e);
    });
    
    // Handle mouseup
    document.addEventListener('mouseup', (e) => {
        if (isMarqueeSelecting) {
            const addToSelection = e.shiftKey;
            endMarqueeSelection(e, addToSelection);
        } else if (marqueeStartPos.x !== 0 && marqueeStartPos.y !== 0 && !isDragging) {
            // Simple click without drag - clear selections if not adding
            if (!e.shiftKey && window.clearSelection) {
                window.clearSelection();
            }

            // Show CSS editor only when clicking empty canvas
            if (marqueeStartElement === canvas && window.codeEditor && window.codeEditor.showCSSEditor) {
                window.codeEditor.showCSSEditor();
            }
        }

        // Reset marquee state
        marqueeStartPos = { x: 0, y: 0 };
        isDragging = false;
        marqueeStartElement = null;
    });
    
    // Cancel on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMarqueeSelecting) {
            clearPreviewSelections();
            marqueeElement.style.display = 'none';
            isMarqueeSelecting = false;
        }
    });
}

// Expose marquee state
window.isMarqueeSelecting = () => isMarqueeSelecting;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMarqueeSelection);
} else {
    initializeMarqueeSelection();
}