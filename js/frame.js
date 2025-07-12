function createFrame(x, y, title) {
    frameCounter++;
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.id = `frame-${frameCounter}`;
    frame.style.left = x + 'px';
    frame.style.top = y + 'px';
    frame.style.width = '300px';
    frame.style.height = '200px';
    
    const titleBar = document.createElement('div');
    titleBar.className = 'frame-title';
    titleBar.textContent = title || `Frame ${frameCounter}`;
    
    const content = document.createElement('div');
    content.className = 'frame-content';
    
    // Add initial content
    content.innerHTML = `
        <h3>Frame ${frameCounter}</h3>
        <p>This is isolated content.</p>
        <button onclick="console.log('Button clicked in Frame ${frameCounter}')">
            Click Me
        </button>
    `;
    
    // Add an element-frame to the first two frames
    if (frameCounter <= 2) {
        setTimeout(() => {
            createElementFrame(20, 80, 120, 80, content);
        }, 100);
    }
    
    frame.appendChild(titleBar);
    frame.appendChild(content);
    
    // Add resize handles
    addResizeHandles(frame);
    
    canvas.appendChild(frame);
    
    // Make frame draggable by title bar
    setupFrameDragging(frame, titleBar);
    
    // Setup element extraction for this frame
    setupElementExtraction(content);
    
    // Make frame content elements selectable
    if (window.makeContainerElementsSelectable) {
        window.makeContainerElementsSelectable(content);
    }
    
    return frame;
}

function createElementFrame(x, y, width = 150, height = 100, parent = canvas) {
    frameCounter++;
    const elementFrame = document.createElement('div');
    elementFrame.className = 'element-frame free-floating';
    elementFrame.id = `element-frame-${frameCounter}`;
    elementFrame.style.left = x + 'px';
    elementFrame.style.top = y + 'px';
    elementFrame.style.width = width + 'px';
    elementFrame.style.height = height + 'px';
    
    // Add resize handles
    addResizeHandles(elementFrame);
    
    parent.appendChild(elementFrame);
    
    // Make element-frame draggable
    setupElementDragging(elementFrame);
    
    // Setup element extraction for this element-frame
    setupElementExtraction(elementFrame);
    
    return elementFrame;
}

// Setup functions for undo system
window.setupFrame = function(frame) {
    const titleBar = frame.querySelector('.frame-title');
    const content = frame.querySelector('.frame-content');
    
    if (titleBar) {
        setupFrameDragging(frame, titleBar);
    }
    
    if (content) {
        setupElementExtraction(content);
        if (window.makeContainerElementsSelectable) {
            window.makeContainerElementsSelectable(content);
        }
    }
    
    addResizeHandles(frame);
};

window.setupElementFrame = function(elementFrame) {
    addResizeHandles(elementFrame);
    setupElementDragging(elementFrame);
    setupElementExtraction(elementFrame);
};

window.setupFreeFloatingElement = function(element) {
    addResizeHandles(element);
    setupElementDragging(element);
    
    // Make selectable
    if (window.makeSelectable) {
        window.makeSelectable(element);
    }
};