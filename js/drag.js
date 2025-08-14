let currentDragging = null;
let dragOffset = { x: 0, y: 0 };
let isMultiDragging = false;
let multiDragOffsets = new Map(); // Store relative positions of all selected elements

// Alt/Option key duplication state
let isAltPressed = false;
let isDuplicateDrag = false;
let duplicatedElements = new Map(); // Maps original elements to their duplicates
let originalSelectedElements = [];

// Position tracking for undo
let dragStartPositions = new Map(); // Maps elements to their initial positions

function captureStartPositions(elements) {
    dragStartPositions.clear();
    elements.forEach(element => {
        dragStartPositions.set(element, {
            left: element.style.left,
            top: element.style.top,
            containerId: element.parentElement?.id || 'canvas',
            // Capture full element state for better restoration
            elementState: window.undoManager ? window.undoManager.captureElementState(element) : null
        });
    });
}

function setupFrameDragging(frame, titleBar) {
    if (!titleBar) return;

    titleBar.addEventListener('mousedown', (e) => {
        // Check if in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
            return;
        }
        
        if (e.metaKey || e.ctrlKey) return; // Don't drag frame if cmd/ctrl is held
        if (e.target.classList.contains('free-floating')) return; // Don't drag frame if clicking a free-floating element
        if (e.target.classList.contains('resize-handle')) return; // Don't drag if clicking resize handle
        if (window.isPanning) return; // Don't drag if panning
        
        // Don't drag if clicking on any element that's being edited
        if (window.textEditing && window.textEditing.isEditing(e.target)) {
            return;
        }
        
        // Don't drag frame during placement or resize operations
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (window.isPlacementDragging && window.isPlacementDragging()) return;
        if (window.isResizing && window.isResizing()) return;
        
        // Handle shift+click for multi-selection before starting drag
        if (e.shiftKey && window.selectElement) {
            e.stopPropagation();
            e.preventDefault();
            window.selectElement(frame, true);
            return;
        }
        
        // CHECK FOR EDGE DETECTION FIRST - before starting drag (includes extended zones)
        if (window.handleElementMouseDown && window.handleElementMouseDown(frame, e)) {
            // Edge detection handled the event (started resize) - don't drag
            return;
        }
        
        // Handle alt+drag for duplication
        if (isAltPressed || e.altKey) {
            // Make sure frame is selected before duplicating
            if (window.selectElement && window.getSelectedElements) {
                const selectedElements = window.getSelectedElements();
                const isAlreadySelected = selectedElements.includes(frame);
                if (!isAlreadySelected) {
                    window.selectElement(frame);
                }
            }
            
            // Create duplicates of all selected elements
            const shouldExtractStaticElements = e.metaKey || e.ctrlKey;
            createDuplicates(shouldExtractStaticElements);
            
            // Find the duplicate of this frame to drag
            const duplicate = duplicatedElements.get(frame);
            if (duplicate) {
                currentDragging = duplicate;
            } else {
                currentDragging = frame; // Fallback
            }
        } else {
            currentDragging = frame;
        }
        const rect = currentDragging.getBoundingClientRect();
        
        // Account for zoom when calculating drag offset
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        dragOffset.x = (e.clientX - rect.left) / zoom;
        dragOffset.y = (e.clientY - rect.top) / zoom;
        
        currentDragging.classList.add('dragging');
        
        // Select the frame when dragging starts (preserve multi-selection if frame is already selected)
        if (window.selectElement && window.getSelectedElements && !isDuplicateDrag) {
            const selectedElements = window.getSelectedElements();
            const isAlreadySelected = selectedElements.includes(frame);
            if (!isAlreadySelected) {
                window.selectElement(frame);
            }
        }
        
        // Check if we're starting a multi-selection drag
        if (window.getSelectedElements) {
            const updatedSelectedElements = window.getSelectedElements();
            // Starting multi-element frame drag
            if (updatedSelectedElements.length > 1 && updatedSelectedElements.includes(currentDragging)) {
                isMultiDragging = true;
                setupMultiDragOffsets(currentDragging, updatedSelectedElements);
                // Capture start positions for all selected elements
                captureStartPositions(updatedSelectedElements);
            } else {
                // Single element drag - capture just this element
                captureStartPositions([currentDragging]);
            }
        } else {
            // Fallback for single element
            captureStartPositions([currentDragging]);
        }
        
        bringToFront(currentDragging);
        e.preventDefault();
    });
}

function setupElementDragging(element) {
    element.addEventListener('mousedown', (e) => {
        // Check if in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
            return;
        }
        
        if (e.metaKey || e.ctrlKey) return; // This is for extraction, not dragging
        if (!element.classList.contains('free-floating')) return;
        if (e.target.classList.contains('resize-handle')) return; // Don't drag if clicking resize handle
        if (window.isPanning) return; // Don't drag if panning
        
        // Don't drag if this element is being edited
        if (window.textEditing && window.textEditing.isEditing(element)) {
            return;
        }
        
        // Don't drag during placement or resize operations
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (window.isPlacementDragging && window.isPlacementDragging()) return;
        if (window.isResizing && window.isResizing()) return;
        
        // If this is an element-frame, only handle drag if clicking directly on the element-frame background
        // Don't handle drag for child elements - let them handle their own drag
        if (element.classList.contains('element-frame')) {
            // If the click target is a child element with free-floating class, don't handle the drag
            if (e.target !== element && e.target.classList.contains('free-floating')) {
                return;
            }
        }
        
        // Check if we're clicking on a nested element-frame (but not its contents)
        // Only prevent drag if clicking directly on an element-frame that's not this element
        const clickedElement = e.target;
        const isNestedElementFrame = clickedElement.classList.contains('element-frame') && 
                                   clickedElement !== element;
        
        if (isNestedElementFrame) {
            return; // Let the nested element-frame handle the drag
        }
        
        // Handle shift+click for multi-selection before starting drag
        if (e.shiftKey && window.selectElement) {
            e.stopPropagation();
            e.preventDefault();
            window.selectElement(element, true);
            return;
        }
        
        e.stopPropagation();
        
        // CHECK FOR EDGE DETECTION FIRST - before blocking other handlers (includes extended zones)
        if (window.handleElementMouseDown && window.handleElementMouseDown(element, e)) {
            // Edge detection handled the event (started resize) - don't drag
            return;
        }
        
        e.stopImmediatePropagation(); // Prevent any other handlers from firing
        
        // Handle alt+drag for duplication
        if (isAltPressed || e.altKey) {
            // Make sure element is selected before duplicating
            if (window.selectElement && window.getSelectedElements) {
                const selectedElements = window.getSelectedElements();
                const isAlreadySelected = selectedElements.includes(element);
                if (!isAlreadySelected) {
                    window.selectElement(element);
                }
            }
            
            // Create duplicates of all selected elements
            const shouldExtractStaticElements = e.metaKey || e.ctrlKey;
            createDuplicates(shouldExtractStaticElements);
            
            // Find the duplicate of this element to drag
            const duplicate = duplicatedElements.get(element);
            if (duplicate) {
                currentDragging = duplicate;
            } else {
                currentDragging = element; // Fallback
            }
        } else {
            currentDragging = element;
        }
        const rect = currentDragging.getBoundingClientRect();
        
        // Account for zoom when calculating drag offset
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        dragOffset.x = (e.clientX - rect.left) / zoom;
        dragOffset.y = (e.clientY - rect.top) / zoom;
        
        currentDragging.classList.add('dragging');
        
        // Select the element when dragging starts (preserve multi-selection if element is already selected)
        if (window.selectElement && window.getSelectedElements && !isDuplicateDrag) {
            const selectedElements = window.getSelectedElements();
            const isAlreadySelected = selectedElements.includes(element);
            if (!isAlreadySelected) {
                window.selectElement(element);
            }
        }
        
        // Check if we're starting a multi-selection drag
        if (window.getSelectedElements) {
            const updatedSelectedElements = window.getSelectedElements();
            // Starting multi-element drag
            if (updatedSelectedElements.length > 1 && updatedSelectedElements.includes(currentDragging)) {
                isMultiDragging = true;
                setupMultiDragOffsets(currentDragging, updatedSelectedElements);
                // Capture start positions for all selected elements
                captureStartPositions(updatedSelectedElements);
            } else {
                // Single element drag - capture just this element
                captureStartPositions([currentDragging]);
            }
        } else {
            // Fallback for single element
            captureStartPositions([currentDragging]);
        }
        
        bringToFront(currentDragging);
        
        // Also bring parent frame to front if element is in a frame
        const parentFrame = currentDragging.closest('.frame');
        if (parentFrame) {
            bringToFront(parentFrame);
        }
        
        e.preventDefault();
    }, true); // Use capture phase to handle events before they bubble
}

// Alt/Option key tracking for duplication
document.addEventListener('keydown', (e) => {
    if (e.altKey && !isAltPressed) {
        isAltPressed = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (!e.altKey && isAltPressed) {
        isAltPressed = false;
        
        // If we're in the middle of a duplicate drag and alt is released, abort the operation
        if (isDuplicateDrag && currentDragging) {
            abortDuplicateDrag();
        }
    }
});

// Also handle window blur to reset alt state
window.addEventListener('blur', () => {
    if (isAltPressed && isDuplicateDrag && currentDragging) {
        abortDuplicateDrag();
    }
    isAltPressed = false;
});

// Duplication functions
function duplicateElement(element, shouldExtract = false) {
    const duplicate = element.cloneNode(true);
    
    // Remove selection state from duplicate
    duplicate.classList.remove('selected', 'dragging');
    
    // Generate unique IDs for duplicate and its children
    if (duplicate.id) {
        duplicate.id = duplicate.id + '_duplicate_' + Date.now();
    }
    
    // Update IDs of child elements
    const childrenWithIds = duplicate.querySelectorAll('[id]');
    childrenWithIds.forEach(child => {
        if (child.id) {
            child.id = child.id + '_duplicate_' + Date.now();
        }
    });
    
    // Check if this is a static element that needs to be extracted
    const isStaticElement = !element.classList.contains('free-floating') && 
                           !element.classList.contains('frame') && 
                           !element.classList.contains('element-frame');
    
    if (isStaticElement && shouldExtract) {
        // Make duplicate free-floating like extraction.js does
        const elementRect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect();
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        
        // Calculate position relative to parent
        const relativeLeft = elementRect.left - parentRect.left;
        const relativeTop = elementRect.top - parentRect.top;
        
        // Add free-floating class and set position
        duplicate.classList.add('free-floating');
        duplicate.style.left = (relativeLeft / zoom + 10) + 'px'; // Small offset
        duplicate.style.top = (relativeTop / zoom + 10) + 'px';
        
        // Preserve width and height
        duplicate.style.width = (elementRect.width / zoom) + 'px';
        duplicate.style.height = (elementRect.height / zoom) + 'px';
        
        // Insert duplicate after original
        // Use helper function to insert before script/style tags if in frame-content
        if (window.insertElementIntoFrameContent) {
            window.insertElementIntoFrameContent(element.parentElement, duplicate);
        } else {
            element.parentElement.appendChild(duplicate);
        }
        
        // Set up dragging and resize for this new free-floating element
        setupElementDragging(duplicate);
        // Resize handles now managed automatically by edge detection system when selected
        // if (window.addSelectionAnchors) {
        //     window.addSelectionAnchors(duplicate);
        // }
        if (window.makeSelectable) {
            window.makeSelectable(duplicate);
        }
    } else {
        // Position duplicate slightly offset from original
        const currentLeft = parseFloat(element.style.left) || 0;
        const currentTop = parseFloat(element.style.top) || 0;
        duplicate.style.left = (currentLeft + 10) + 'px';
        duplicate.style.top = (currentTop + 10) + 'px';
        
        // Insert duplicate after original
        // Use helper function to insert before script/style tags if in frame-content
        if (window.insertElementIntoFrameContent) {
            window.insertElementIntoFrameContent(element.parentElement, duplicate);
        } else {
            element.parentElement.appendChild(duplicate);
        }
        
        // Set up interactivity for the duplicate
        if (duplicate.classList.contains('frame')) {
            const titleBar = duplicate.querySelector('.frame-title');
            if (titleBar) {
                setupFrameDragging(duplicate, titleBar);
            }
            // Make selectable
            if (window.makeSelectable) {
                window.makeSelectable(duplicate);
            }
            // Resize handles now managed automatically by edge detection system when selected
            // Set up resize
            // if (window.addSelectionAnchors) {
            //     window.addSelectionAnchors(duplicate);
            // }
        } else if (duplicate.classList.contains('free-floating')) {
            setupElementDragging(duplicate);
            // Make selectable
            if (window.makeSelectable) {
                window.makeSelectable(duplicate);
            }
            // Resize handles now managed automatically by edge detection system when selected
            // Set up resize
            // if (window.addSelectionAnchors) {
            //     window.addSelectionAnchors(duplicate);
            // }
        }
    }
    
    return duplicate;
}

function createDuplicates(shouldExtractStaticElements = false) {
    const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
    
    // Filter elements based on whether they should be duplicated
    const elementsToProcess = selectedElements.filter(element => {
        const isFreeDraggable = element.classList.contains('free-floating') || 
                               element.classList.contains('frame') || 
                               element.classList.contains('element-frame');
        
        if (isFreeDraggable) {
            return true; // Always duplicate draggable elements
        } else {
            return shouldExtractStaticElements; // Only duplicate static elements if cmd+alt
        }
    });
    
    if (elementsToProcess.length === 0) {
        return; // Nothing to duplicate
    }
    
    // Store original selection
    originalSelectedElements = [...selectedElements];
    
    // Clear current selection
    if (window.clearSelection) {
        window.clearSelection();
    }
    
    // Create duplicates and track mapping
    duplicatedElements.clear();
    elementsToProcess.forEach(element => {
        const duplicate = duplicateElement(element, shouldExtractStaticElements);
        duplicatedElements.set(element, duplicate);
        
        // Select the duplicate instead
        if (window.selectElement) {
            window.selectElement(duplicate, true);
        }
    });
    
    isDuplicateDrag = true;
}

function deleteDuplicates() {
    duplicatedElements.forEach((duplicate, original) => {
        if (duplicate.parentElement) {
            duplicate.parentElement.removeChild(duplicate);
        }
    });
    duplicatedElements.clear();
}

function abortDuplicateDrag() {
    // Stop the drag operation entirely
    if (currentDragging) {
        currentDragging.classList.remove('dragging');
    }
    
    // Remove dragging class from all multi-selected elements
    if (isMultiDragging) {
        multiDragOffsets.forEach((offset, element) => {
            element.classList.remove('dragging');
        });
    }
    
    // Delete all duplicates
    deleteDuplicates();
    
    // Clear all selections
    if (window.clearSelection) {
        window.clearSelection();
    }
    
    // Reset all drag state
    currentDragging = null;
    dragOffset = { x: 0, y: 0 };
    isMultiDragging = false;
    multiDragOffsets.clear();
    isDuplicateDrag = false;
    originalSelectedElements = [];
}

// Global mouse move handler
document.addEventListener('mousemove', (e) => {
    if (!currentDragging || window.isPanning) return;
    
    if (isMultiDragging) {
        moveMultiSelection(e);
    } else {
        moveSingleElement(e);
    }
});

function moveSingleElement(e) {
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
}

// Global mouse up handler
document.addEventListener('mouseup', (e) => {
    if (!currentDragging) return;
    
    // Always ensure we clean up the dragging state, regardless of any errors
    try {
        // Record movement for undo before handling container changes
        const movedElements = [];
        
        if (isMultiDragging) {
            // Handle container changes for all selected elements FIRST
            handleMultiSelectionContainerChanges(e);
            
            // THEN record positions after container changes are complete
            dragStartPositions.forEach((startPos, element) => {
                const currentContainerId = element.parentElement?.id || 'canvas';
                
                if (startPos.left !== element.style.left || 
                    startPos.top !== element.style.top ||
                    startPos.containerId !== currentContainerId) {
                    
                    // Capture complete element state after all changes are finalized
                    const finalElementState = window.undoManager ? window.undoManager.captureElementState(element) : null;
                    
                    movedElements.push({
                        elementId: element.id,
                        oldPosition: { left: startPos.left, top: startPos.top },
                        newPosition: { left: element.style.left, top: element.style.top },
                        oldContainerId: startPos.containerId,
                        newContainerId: currentContainerId,
                        oldElementState: startPos.elementState,
                        newElementState: finalElementState
                    });
                }
            });
        } else if (currentDragging.classList.contains('free-floating')) {
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
            
            // Record single element movement
            const startPos = dragStartPositions.get(currentDragging);
            if (startPos && (startPos.left !== currentDragging.style.left || 
                startPos.top !== currentDragging.style.top ||
                startPos.containerId !== (currentDragging.parentElement?.id || 'canvas'))) {
                movedElements.push({
                    elementId: currentDragging.id,
                    oldPosition: { left: startPos.left, top: startPos.top },
                    newPosition: { left: currentDragging.style.left, top: currentDragging.style.top },
                    oldContainerId: startPos.containerId,
                    newContainerId: currentDragging.parentElement?.id || 'canvas',
                    oldElementState: startPos.elementState,
                    newElementState: window.undoManager ? window.undoManager.captureElementState(currentDragging) : null
                });
            }
        } else {
            // Frame or other element movement
            const startPos = dragStartPositions.get(currentDragging);
            if (startPos && (startPos.left !== currentDragging.style.left || 
                startPos.top !== currentDragging.style.top)) {
                movedElements.push({
                    elementId: currentDragging.id,
                    oldPosition: { left: startPos.left, top: startPos.top },
                    newPosition: { left: currentDragging.style.left, top: currentDragging.style.top },
                    oldContainerId: startPos.containerId,
                    newContainerId: currentDragging.parentElement?.id || 'canvas',
                    oldElementState: startPos.elementState,
                    newElementState: window.undoManager ? window.undoManager.captureElementState(currentDragging) : null
                });
            }
        }
        
        // Record the movement if anything changed (and not duplicate drag)
        if (movedElements.length > 0 && !isDuplicateDrag && window.recordMove) {
            window.recordMove(movedElements);
        }
    } catch (error) {
        console.error('Error during mouse-up container check:', error);
    } finally {
        // Always clean up dragging state to ensure element detaches from mouse
        if (currentDragging) {
            currentDragging.classList.remove('dragging');
            currentDragging = null;
        }
        
        // Clean up dragging class from all multi-selected elements
        if (isMultiDragging) {
            multiDragOffsets.forEach((offset, element) => {
                element.classList.remove('dragging');
            });
        }
        
        // Reset drag state
        dragOffset = { x: 0, y: 0 };
        isMultiDragging = false;
        multiDragOffsets.clear();
        dragStartPositions.clear();
        
        // Handle duplicate drag completion
        if (isDuplicateDrag) {
            if (isAltPressed) {
                // Alt key still held - keep duplicates, clear duplication state
                isDuplicateDrag = false;
                duplicatedElements.clear();
                originalSelectedElements = [];
            } else {
                // Alt key released - duplicates were already deleted in keyup handler
                // Just clean up state
                isDuplicateDrag = false;
                duplicatedElements.clear();
                originalSelectedElements = [];
            }
        }
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
    
    // Get the old container before moving
    const oldParent = element.parentElement;
    const oldContainerId = oldParent?.id || 'canvas';
    
    // No script cleanup needed - iframe isolation handles script separation
    // Move element to new parent 
    if (window.insertElementIntoFrameContent) {
        window.insertElementIntoFrameContent(newParent, element);
    } else {
        newParent.appendChild(element);
    }

    const newParentStyle = window.getComputedStyle(newParent);
    if (newParentStyle.display === 'flex') {
        // Drop element into flex flow
        element.classList.remove('free-floating');
        element.style.position = 'relative';
        element.style.left = '';
        element.style.top = '';
        element.style.margin = '0';
    } else {
        // Update position for absolutely positioned containers
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }
    
    console.log(`🚚 DRAG: Element moved to new container (no script cleanup needed)`);
    
    console.log(`Element moved to ${newParent.id || newParent.className || 'container'}`);
}

function setupMultiDragOffsets(primaryElement, selectedElements) {
    multiDragOffsets.clear();
    
    // Get the primary element's position
    const primaryRect = primaryElement.getBoundingClientRect();
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    
    // Store relative offsets for all selected elements
    selectedElements.forEach(element => {
        if (element === primaryElement) return; // Skip the primary element
        
        const elementRect = element.getBoundingClientRect();
        
        // Calculate offset relative to primary element in canvas space
        const offsetX = (elementRect.left - primaryRect.left) / zoom;
        const offsetY = (elementRect.top - primaryRect.top) / zoom;
        
        multiDragOffsets.set(element, { x: offsetX, y: offsetY });
        
        // Add dragging class to all selected elements
        element.classList.add('dragging');
    });
}

function moveMultiSelection(e) {
    // Move the primary element first
    moveSingleElement(e);
    
    // Then move all other selected elements maintaining their relative positions
    multiDragOffsets.forEach((offset, element) => {
        if (element.classList.contains('frame')) {
            moveFrameWithOffset(element, offset, e);
        } else if (element.classList.contains('free-floating')) {
            moveElementWithOffset(element, offset, e);
        }
    });
}

function moveFrameWithOffset(frame, offset, e) {
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    const canvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
    
    // Apply the primary element's drag offset plus this element's relative offset
    const newLeft = canvasCoords.x - dragOffset.x + offset.x;
    const newTop = canvasCoords.y - dragOffset.y + offset.y;
    
    // Keep frame within canvas bounds
    const frameWidth = parseFloat(frame.style.width) || frame.offsetWidth;
    const frameHeight = parseFloat(frame.style.height) || frame.offsetHeight;
    
    frame.style.left = Math.max(0, Math.min(newLeft, window.innerWidth / zoom - frameWidth)) + 'px';
    frame.style.top = Math.max(0, Math.min(newTop, window.innerHeight / zoom - frameHeight)) + 'px';
}

function moveElementWithOffset(element, offset, e) {
    const parentRect = element.parentElement.getBoundingClientRect();
    
    // Convert positions to canvas space
    const mouseCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
    const parentCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(parentRect.left, parentRect.top) : { x: parentRect.left, y: parentRect.top };
    
    // Apply the primary element's drag offset plus this element's relative offset
    const newLeft = mouseCanvasCoords.x - dragOffset.x + offset.x - parentCanvasCoords.x;
    const newTop = mouseCanvasCoords.y - dragOffset.y + offset.y - parentCanvasCoords.y;
    
    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';
}

function handleMultiSelectionContainerChanges(e) {
    // Check container changes for the primary dragged element first
    if (currentDragging.classList.contains('free-floating')) {
        const elementRect = currentDragging.getBoundingClientRect();
        const elementCenter = {
            x: elementRect.left + elementRect.width / 2,
            y: elementRect.top + elementRect.height / 2
        };
        
        let newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, currentDragging);
        
        if (newParent && newParent !== currentDragging.parentElement) {
            moveElementToContainer(currentDragging, newParent, e.clientX, e.clientY);
        }
    }
    
    // Check container changes for all other selected elements
    multiDragOffsets.forEach((offset, element) => {
        if (element.classList.contains('free-floating')) {
            const elementRect = element.getBoundingClientRect();
            const elementCenter = {
                x: elementRect.left + elementRect.width / 2,
                y: elementRect.top + elementRect.height / 2
            };
            
            let newParent = findContainerAtPoint(elementCenter.x, elementCenter.y, element);
            
            if (newParent && newParent !== element.parentElement) {
                // Calculate the element's position relative to the new parent
                const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
                const newParentRect = newParent.getBoundingClientRect();
                const parentCanvasCoords = window.canvasZoom ? 
                    window.canvasZoom.screenToCanvas(newParentRect.left, newParentRect.top) : 
                    { x: newParentRect.left, y: newParentRect.top };
                
                const elementCanvasCoords = window.canvasZoom ? 
                    window.canvasZoom.screenToCanvas(elementRect.left, elementRect.top) : 
                    { x: elementRect.left, y: elementRect.top };
                
                let newLeft = elementCanvasCoords.x - parentCanvasCoords.x;
                let newTop = elementCanvasCoords.y - parentCanvasCoords.y;
                
                // Get the old container before moving
                const oldParent = element.parentElement;
                const oldContainerId = oldParent?.id || 'canvas';
                
                // No script cleanup needed - iframe isolation handles script separation
                // Move element to new parent
                if (window.insertElementIntoFrameContent) {
                    window.insertElementIntoFrameContent(newParent, element);
                } else {
                    newParent.appendChild(element);
                }
                
                // Update position
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                
                console.log(`🚚 MULTI-DRAG: Element moved to new container (no script cleanup needed)`);
                
                console.log(`Multi-selected element moved to ${newParent.id || newParent.className || 'container'}`);
            }
        }
    });
}