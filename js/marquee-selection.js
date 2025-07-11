// Marquee selection state
let isMarqueeSelecting = false;
let marqueeStartPos = { x: 0, y: 0 };
let marqueeElement = null;

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
        
        // Get all selectable elements
        const elements = getAllSelectableElements();
        
        // Check each element
        elements.forEach(element => {
            const elementRect = element.getBoundingClientRect();
            let shouldSelect = false;
            const hasChildren = hasSelectableChildren(element);
            
            if (hasChildren) {
                // Container with children - must be completely contained
                shouldSelect = rectContainsElement(marqueeRect, elementRect);
            } else {
                // Standalone element - just needs to intersect
                shouldSelect = rectsIntersect(marqueeRect, elementRect);
            }
            
            if (shouldSelect && window.selectElement) {
                window.selectElement(element, true); // Always add to selection
            }
        });
    }
    
    // Hide marquee
    marqueeElement.style.display = 'none';
    isMarqueeSelecting = false;
}

// Initialize marquee selection
function initializeMarqueeSelection() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Handle mousedown on canvas
    canvas.addEventListener('mousedown', (e) => {
        // Only start marquee on direct canvas click
        if (e.target !== canvas) return;
        
        // Don't start marquee if panning or other operations
        if (window.isPanning) return;
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (window.isResizing && window.isResizing()) return;
        
        // Start marquee selection
        startMarqueeSelection(e);
        e.preventDefault();
    });
    
    // Handle mousemove
    document.addEventListener('mousemove', (e) => {
        updateMarqueeSelection(e);
    });
    
    // Handle mouseup
    document.addEventListener('mouseup', (e) => {
        if (isMarqueeSelecting) {
            const addToSelection = e.shiftKey;
            endMarqueeSelection(e, addToSelection);
        }
    });
    
    // Cancel on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMarqueeSelecting) {
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