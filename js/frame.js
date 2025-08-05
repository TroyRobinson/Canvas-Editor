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
    if (frameCounter === 1) {
        content.innerHTML = `
            <h3 id="frame-${frameCounter}-heading">Frame ${frameCounter}</h3>
            <p id="frame-${frameCounter}-text">My buttons sparkle</p>
            <button id="frame-${frameCounter}-button">
                Click Me
            </button>
            <style>
                .flash {
                animation: flash-animation 0.3s;
                }
                @keyframes flash-animation {
                0% { background-color: yellow; }
                50% { background-color: red; }
                100% { background-color: yellow; }
                }
            </style>
            <script>
                (function() {
                const frame = document.currentScript.closest('.frame');
                const buttons = frame.querySelectorAll('button');
                buttons.forEach(button => {
                button.addEventListener('click', () => {
                button.classList.add('flash');
                setTimeout(() => button.classList.remove('flash'), 300);
                });
                });
                })();
            </script>
        `;
    } else if (frameCounter === 2) {
        content.innerHTML = `
            <h3 id="frame-${frameCounter}-heading">Frame ${frameCounter}</h3>
            <p id="frame-${frameCounter}-text">Click the button to </p>
            <button id="frame-${frameCounter}-button">
                Click Me
            </button>
            <style>
            </style>
            <script>
            </script>
        `;
    } else {
        content.innerHTML = `
            <h3 id="frame-${frameCounter}-heading">Frame ${frameCounter}</h3>
            <p id="frame-${frameCounter}-text">This is isolated content.</p>
            <button id="frame-${frameCounter}-button">
                Click Me
            </button>
            <style>
            </style>
            <script>
            </script>
        `;
    }
    
    
    frame.appendChild(titleBar);
    frame.appendChild(content);
    
    
    // Add resize handles
    addResizeHandles(frame);
    
    canvas.appendChild(frame);
    
    // Make frame draggable by title bar
    setupFrameDragging(frame, titleBar);
    
    // Ensure all elements have IDs
    ensureAllElementsHaveIds(content);
    
    // Setup element extraction for this frame
    setupElementExtraction(content);
    
    // Setup content tracking
    setupContentTracking(content);
    
    // Make frame content elements selectable
    if (window.makeContainerElementsSelectable) {
        window.makeContainerElementsSelectable(content);
    }
    
    // Make static elements selectable individually
    content.querySelectorAll('h3, p, button').forEach(element => {
        if (window.makeSelectable) {
            window.makeSelectable(element);
        }
    });
    
    // Activate scripts for this frame
    if (window.scriptManager && window.scriptManager.activateScripts) {
        window.scriptManager.activateScripts(frame);
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
        ensureAllElementsHaveIds(content);
        setupElementExtraction(content);
        setupContentTracking(content);
        if (window.makeContainerElementsSelectable) {
            window.makeContainerElementsSelectable(content);
        }
        
        // Make static elements selectable individually
        content.querySelectorAll('h3, p, button').forEach(element => {
            if (window.makeSelectable) {
                window.makeSelectable(element);
            }
        });
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

// Ensure all elements have unique IDs for undo tracking
let staticElementCounter = 0;

function ensureElementHasId(element) {
    if (!element.id && element.nodeType === Node.ELEMENT_NODE) {
        staticElementCounter++;
        const tagName = element.tagName.toLowerCase();
        element.id = `static-${tagName}-${staticElementCounter}`;
    }
}

function ensureAllElementsHaveIds(container) {
    // Give ID to container if it doesn't have one
    ensureElementHasId(container);
    
    // Give IDs to all children
    const allElements = container.querySelectorAll('*');
    allElements.forEach(ensureElementHasId);
}

// Expose globally for use by other modules
window.ensureAllElementsHaveIds = ensureAllElementsHaveIds;

// Helper function to insert elements before script/style tags in frame-content
function insertElementIntoFrameContent(container, element) {
    // Check if container is a frame-content
    if (!container.classList.contains('frame-content')) {
        // If not frame-content, use regular appendChild
        container.appendChild(element);
        return;
    }
    
    // Find the first style or script tag to insert before
    const styleTag = container.querySelector('style');
    const scriptTag = container.querySelector('script');
    
    // Determine insertion point (whichever comes first, or null if neither exists)
    let insertBefore = null;
    if (styleTag && scriptTag) {
        // Both exist, find which comes first
        const styleIndex = Array.from(container.children).indexOf(styleTag);
        const scriptIndex = Array.from(container.children).indexOf(scriptTag);
        insertBefore = styleIndex < scriptIndex ? styleTag : scriptTag;
    } else if (styleTag) {
        insertBefore = styleTag;
    } else if (scriptTag) {
        insertBefore = scriptTag;
    }
    
    if (insertBefore) {
        container.insertBefore(element, insertBefore);
    } else {
        // No style/script tags found, use regular appendChild
        container.appendChild(element);
    }
}

// Expose globally for use by other modules
window.insertElementIntoFrameContent = insertElementIntoFrameContent;

// Track content changes in frames for undo
function setupContentTracking(frameContent) {
    if (!window.undoManager) return;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (window.undoManager.isExecuting) return; // Don't track during undo/redo
            
            if (mutation.type === 'childList') {
                // Track additions/removals of static elements
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        !node.classList.contains('free-floating') &&
                        !node.classList.contains('resize-handle')) {
                        
                        // Ensure the new element has an ID
                        ensureElementHasId(node);
                        
                        // Make it selectable
                        if (window.makeSelectable) {
                            window.makeSelectable(node);
                        }
                        
                        // Record static element creation
                        setTimeout(() => {
                            if (window.recordCreate && window.undoManager && node.id) {
                                const elementState = window.undoManager.captureElementState(node);
                                window.recordCreate(node.id, elementState, frameContent.id || 'canvas', false);
                            }
                        }, 0);
                    }
                });
                
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        !node.classList.contains('free-floating') &&
                        !node.classList.contains('resize-handle')) {
                        // Note: Removal tracking is handled by explicit deletion
                    }
                });
            } else if (mutation.type === 'characterData') {
                // Track text content changes (only for actual text node changes)
                const element = mutation.target.nodeType === Node.TEXT_NODE ? 
                    mutation.target.parentElement : mutation.target;
                
                // Skip if element is currently being edited (text-editing.js will handle it)
                if (element && window.textEditing && window.textEditing.isEditing(element)) {
                    return;
                }
                
                if (element && element.id && !element.classList.contains('free-floating')) {
                    // Record content change as a special operation
                    if (window.recordContentChange) {
                        const oldValue = mutation.oldValue;
                        const newValue = mutation.target.textContent;
                        
                        if (oldValue !== newValue) {
                            window.recordContentChange(element.id, oldValue, newValue);
                        }
                    }
                }
            }
        });
    });
    
    observer.observe(frameContent, { 
        childList: true, 
        characterData: true, 
        subtree: true,
        characterDataOldValue: true
    });
    
    // Store observer reference for cleanup
    frameContent._contentObserver = observer;
}