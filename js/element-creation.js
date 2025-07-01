let placingElement = null;
let placementMode = false;
let elementCounter = 0;
let placementStartPos = { x: 0, y: 0 };
let isPlacementDragging = false;

// Element factories
function createTextElement() {
    elementCounter++;
    const element = document.createElement('div');
    element.className = 'text-element free-floating';
    element.contentEditable = true;
    element.textContent = 'Text';
    element.style.width = '100px';
    element.style.height = '30px';
    element.id = `text-${elementCounter}`;
    return element;
}

function createLineElement() {
    elementCounter++;
    const element = document.createElement('div');
    element.className = 'line-element free-floating';
    element.style.width = '100px';
    element.style.height = '2px';
    element.id = `line-${elementCounter}`;
    return element;
}

function createCircleElement() {
    elementCounter++;
    const element = document.createElement('div');
    element.className = 'circle-element free-floating';
    element.style.width = '60px';
    element.style.height = '60px';
    element.id = `circle-${elementCounter}`;
    return element;
}

function createButtonElement() {
    elementCounter++;
    const element = document.createElement('button');
    element.className = 'button-element free-floating';
    element.textContent = `Button ${elementCounter}`;
    element.style.width = '120px';
    element.style.height = '36px';
    element.id = `button-${elementCounter}`;
    
    // Add click functionality
    element.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log(`${element.textContent} clicked`);
    });
    
    return element;
}

function createInputElement() {
    elementCounter++;
    
    // Create wrapper container for input element (needed for resize handles)
    const wrapper = document.createElement('div');
    wrapper.className = 'input-wrapper free-floating';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '150px';
    wrapper.style.height = '32px';
    wrapper.id = `input-wrapper-${elementCounter}`;
    
    // Create the actual input element
    const input = document.createElement('input');
    input.className = 'input-element';
    input.type = 'text';
    input.placeholder = 'Type here...';
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.id = `input-${elementCounter}`;
    
    // Prevent extraction when typing, but allow resize handles to work
    input.addEventListener('mousedown', (e) => {
        // Only stop propagation if we're actively typing AND not clicking a resize handle
        if (document.activeElement === input && !e.target.classList.contains('resize-handle')) {
            e.stopPropagation();
        }
    });
    
    // Add input to wrapper
    wrapper.appendChild(input);
    
    return wrapper;
}

function startElementPlacement(elementType) {
    if (placingElement) {
        cancelElementPlacement();
    }
    
    placementMode = true;
    
    // Create the appropriate element
    switch (elementType) {
        case 'frame':
            placingElement = createFrameForPlacement();
            break;
        case 'element-frame':
            placingElement = createElementFrameForPlacement();
            break;
        case 'text':
            placingElement = createTextElement();
            break;
        case 'line':
            placingElement = createLineElement();
            break;
        case 'circle':
            placingElement = createCircleElement();
            break;
        case 'button':
            placingElement = createButtonElement();
            break;
        case 'input':
            placingElement = createInputElement();
            break;
        default:
            return;
    }
    
    if (placingElement) {
        placingElement.classList.add('placing-element');
        document.body.appendChild(placingElement);
        
        // Position at mouse location
        document.addEventListener('mousemove', handlePlacementMouseMove);
        document.addEventListener('mousedown', handlePlacementMouseDown);
        document.addEventListener('mouseup', handlePlacementMouseUp);
        document.addEventListener('keydown', handlePlacementKeydown);
    }
}

function createFrameForPlacement() {
    frameCounter++;
    const frame = document.createElement('div');
    frame.className = 'frame placing-element';
    frame.id = `frame-${frameCounter}`;
    frame.style.width = '300px';
    frame.style.height = '200px';
    
    const titleBar = document.createElement('div');
    titleBar.className = 'frame-title';
    titleBar.textContent = `Frame ${frameCounter}`;
    
    const content = document.createElement('div');
    content.className = 'frame-content';
    content.innerHTML = `
        <h3>Frame ${frameCounter}</h3>
        <p>This is isolated content.</p>
        <button onclick="console.log('Button clicked in Frame ${frameCounter}')">
            Click Me
        </button>
    `;
    
    frame.appendChild(titleBar);
    frame.appendChild(content);
    
    return frame;
}

function createElementFrameForPlacement() {
    frameCounter++;
    const elementFrame = document.createElement('div');
    elementFrame.className = 'element-frame free-floating placing-element';
    elementFrame.id = `element-frame-${frameCounter}`;
    elementFrame.style.width = '150px';
    elementFrame.style.height = '100px';
    return elementFrame;
}


function handlePlacementMouseDown(e) {
    if (!placingElement || e.button !== 0) return; // Only left mouse button
    
    e.preventDefault();
    e.stopPropagation();
    
    placementStartPos = { x: e.clientX, y: e.clientY };
    isPlacementDragging = false;
}

function handlePlacementMouseUp(e) {
    if (!placingElement) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (!isPlacementDragging) {
        // Simple click - just place the element
        placeElement(e.clientX, e.clientY);
    } else {
        // Was dragging - element is already placed and being resized
        // Clean up resize state
        if (resizeTarget) {
            resizeTarget.classList.remove('resizing');
            resizing = false;
            resizeTarget = null;
            resizeHandle = null;
        }
        
        console.log(`Element placed and resized`);
        
        // Reset placement state
        placingElement = null;
        placementMode = false;
        isPlacementDragging = false;
        placementStartPos = { x: 0, y: 0 };
        
        // Remove event listeners
        document.removeEventListener('mousemove', handlePlacementMouseMove);
        document.removeEventListener('mousedown', handlePlacementMouseDown);
        document.removeEventListener('mouseup', handlePlacementMouseUp);
        document.removeEventListener('keydown', handlePlacementKeydown);
    }
}

function handlePlacementMouseMove(e) {
    if (!placingElement) return;
    
    if (placementStartPos.x !== 0 && !isPlacementDragging) {
        // Check if we've moved enough to start drag-resize
        const deltaX = e.clientX - placementStartPos.x;
        const deltaY = e.clientY - placementStartPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 5) { // Start drag-resize after 5px movement
            isPlacementDragging = true;
            
            // Place the element at the START position (where mouse was first pressed)
            const placedElement = placeElement(placementStartPos.x, placementStartPos.y);
            
            if (placedElement) {
                // Start with minimal size - let the resize system handle all sizing
                // This ensures the element fits exactly between drop point and mouse
                const minSize = 1;
                placedElement.style.width = minSize + 'px';
                placedElement.style.height = minSize + 'px';
                
                // Set up resize state to track from the placement start position
                // The resize system will size the element to exactly where the mouse is
                resizing = true;
                resizeTarget = placedElement;
                resizeHandle = 'se'; // Southeast corner resize
                resizeStartPos = { x: placementStartPos.x, y: placementStartPos.y }; // Anchor at drop point
                resizeStartSize = { width: minSize, height: minSize }; // Minimal starting size
                resizeStartOffset = { 
                    left: parseFloat(placedElement.style.left) || 0, 
                    top: parseFloat(placedElement.style.top) || 0 
                };
                isDragToResize = true; // Enable direct sizing mode
                
                placedElement.classList.add('resizing');
                bringToFront(placedElement);
                
                return; // Don't update position since we're now resizing
            }
        }
    }
    
    if (!isPlacementDragging) {
        // Normal mouse following
        placingElement.style.left = e.clientX + 'px';
        placingElement.style.top = e.clientY + 'px';
    }
}

function placeElement(mouseX, mouseY) {
    if (!placingElement) return;
    
    // Find container at mouse position
    const container = findContainerAtPoint(mouseX, mouseY, placingElement);
    
    // Calculate position relative to container before removing from body
    const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
    let newLeft, newTop;
    
    if (container === canvas) {
        const canvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(mouseX, mouseY) : { x: mouseX, y: mouseY };
        newLeft = canvasCoords.x;
        newTop = canvasCoords.y;
    } else {
        const containerRect = container.getBoundingClientRect();
        const mouseCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(mouseX, mouseY) : { x: mouseX, y: mouseY };
        const containerCanvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(containerRect.left, containerRect.top) : { x: containerRect.left, y: containerRect.top };
        
        newLeft = mouseCanvasCoords.x - containerCanvasCoords.x;
        newTop = mouseCanvasCoords.y - containerCanvasCoords.y;
    }
    
    // Remove placement classes and positioning
    placingElement.classList.remove('placing-element');
    placingElement.style.position = 'absolute';
    placingElement.style.left = newLeft + 'px';
    placingElement.style.top = newTop + 'px';
    
    // Move from body to container
    document.body.removeChild(placingElement);
    container.appendChild(placingElement);
    
    // Setup element based on type
    if (placingElement.classList.contains('frame')) {
        // For frames, only place on canvas and setup frame functionality
        if (container !== canvas) {
            // Frames can only be placed on canvas, so recalculate position
            const canvasCoords = window.canvasZoom ? window.canvasZoom.screenToCanvas(mouseX, mouseY) : { x: mouseX, y: mouseY };
            placingElement.style.left = canvasCoords.x + 'px';
            placingElement.style.top = canvasCoords.y + 'px';
            
            // Remove from current container and add to canvas
            if (placingElement.parentElement) {
                placingElement.parentElement.removeChild(placingElement);
            }
            canvas.appendChild(placingElement);
        }
        
        // Add resize handles
        addResizeHandles(placingElement);
        
        // Make frame draggable
        const titleBar = placingElement.querySelector('.frame-title');
        setupFrameDragging(placingElement, titleBar);
        
        // Setup element extraction for frame content
        const frameContent = placingElement.querySelector('.frame-content');
        setupElementExtraction(frameContent);
        
        // Add element-frame to first two frames
        if (frameCounter <= 2) {
            setTimeout(() => {
                createElementFrame(20, 80, 120, 80, frameContent);
            }, 100);
        }
    } else {
        // For other elements, add normal functionality
        addResizeHandles(placingElement);
        setupElementDragging(placingElement);
        
        // If it's an element-frame, setup extraction
        if (placingElement.classList.contains('element-frame')) {
            setupElementExtraction(placingElement);
        }
    }
    
    console.log(`${placingElement.id} placed in ${container.id || container.className || 'canvas'}`);
    
    const placedElement = placingElement;
    
    // Reset placement state before calling cancelElementPlacement
    placingElement = null;
    placementMode = false;
    isPlacementDragging = false;
    placementStartPos = { x: 0, y: 0 };
    
    // Remove event listeners
    document.removeEventListener('mousemove', handlePlacementMouseMove);
    document.removeEventListener('mousedown', handlePlacementMouseDown);
    document.removeEventListener('mouseup', handlePlacementMouseUp);
    document.removeEventListener('keydown', handlePlacementKeydown);
    
    return placedElement;
}

function handlePlacementKeydown(e) {
    if (e.key === 'Escape') {
        cancelElementPlacement();
    }
}

function cancelElementPlacement() {
    if (placingElement && placingElement.parentElement) {
        placingElement.parentElement.removeChild(placingElement);
    }
    
    placingElement = null;
    placementMode = false;
    isPlacementDragging = false;
    placementStartPos = { x: 0, y: 0 };
    
    document.removeEventListener('mousemove', handlePlacementMouseMove);
    document.removeEventListener('mousedown', handlePlacementMouseDown);
    document.removeEventListener('mouseup', handlePlacementMouseUp);
    document.removeEventListener('keydown', handlePlacementKeydown);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
    
    // Don't trigger if already placing an element
    if (placementMode) return;
    
    // Don't trigger if modifier keys are held
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    
    switch (e.key.toLowerCase()) {
        case 'f':
            e.preventDefault();
            startElementPlacement('frame');
            break;
        case 'r':
            e.preventDefault();
            startElementPlacement('element-frame');
            break;
        case 't':
            e.preventDefault();
            startElementPlacement('text');
            break;
        case 'l':
        case 'd':
            e.preventDefault();
            startElementPlacement('line');
            break;
        case 'o':
            e.preventDefault();
            startElementPlacement('circle');
            break;
        case 'b':
            e.preventDefault();
            startElementPlacement('button');
            break;
        case 'p':
            e.preventDefault();
            startElementPlacement('input');
            break;
    }
});