function createFrame(x, y, title) {
    frameCounter++;
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.id = `frame-${frameCounter}`;
    frame.style.left = x + 'px';
    frame.style.top = y + 'px';
    frame.style.width = '800px';
    frame.style.height = '600px';
    
    const titleBar = document.createElement('div');
    titleBar.className = 'frame-title';
    titleBar.textContent = title || `Frame ${frameCounter}`;
    
    const content = document.createElement('div');
    content.className = 'frame-content';
    
    // Add initial content
    if (frameCounter === 1) {
        content.innerHTML = `
            <h3 id="frame-${frameCounter}-heading" class="free-floating" style="position: absolute; left: 20px; top: 20px; width: 200px;">My Cool App</h3>
            <p id="frame-${frameCounter}-text" class="free-floating" style="position: absolute; left: 20px; top: 60px; width: 200px;">My buttons sparkle</p>
            <button id="frame-${frameCounter}-button" class="free-floating" style="position: absolute; left: 20px; top: 100px; width: 100px; height: 40px;">
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

    // Add frame action buttons
    addFrameControls(frame, titleBar);
    
    
    // Resize functionality now uses edge detection on element borders
    // addResizeHandles(frame); // DEPRECATED
    
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
    
    // Make static elements selectable individually and setup free-floating elements
    const staticElements = content.querySelectorAll('h3, p, button');
    staticElements.forEach(element => {
        if (window.makeSelectable) {
            window.makeSelectable(element);
        }
        
        // If element is free-floating, set it up for dragging
        if (element.classList.contains('free-floating')) {
            if (window.setupFreeFloatingElement) {
                window.setupFreeFloatingElement(element);
            }
        }
    });
    
    // Activate scripts for this frame
    // Scripts will be activated when entering interactive mode via iframe
    console.log('💡 FRAME CREATED: Scripts will activate in interactive mode iframe');

    return frame;
}

function addFrameControls(frame, titleBar) {
    if (!frame || !titleBar) return;

    // Ensure title bar can position absolute children
    titleBar.style.position = 'relative';

    // Magic sparkle enhancement button (edit mode)
    if (!titleBar.querySelector('.frame-enhance-btn')) {
        const enhanceBtn = document.createElement('button');
        enhanceBtn.className = 'frame-enhance-btn';
        enhanceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/><path d="M16 11l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><path d="M22 4l.5 1.5L24 6l-1.5.5L22 8l-.5-1.5L20 6l1.5-.5L22 4z"/></svg>';
        enhanceBtn.title = 'Enhance with AI';
        enhanceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.llmManager || !window.llmManager.enhanceFrameWithAI) return;
            enhanceBtn.style.display = 'none';
            window.llmManager.enhanceFrameWithAI(frame).finally(() => {
                if (window.canvasMode && window.canvasMode.isEditMode && window.canvasMode.isEditMode()) {
                    enhanceBtn.style.display = 'flex';
                }
            });
        });
        titleBar.appendChild(enhanceBtn);
    }

    // Refresh button for interactive mode
    if (!titleBar.querySelector('.frame-refresh-btn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'frame-refresh-btn';
        refreshBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.83-3.36L23 10M1 14l4.66-4.66A9 9 0 0010.33 1.5"/></svg>';
        refreshBtn.title = 'Refresh preview';
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!(window.iframeManager && window.iframeManager.destroyIframe && window.iframeManager.createPreviewIframe)) return;
            const frameContent = frame.querySelector('.frame-content');
            if (!frameContent) return;
            const htmlContent = frameContent.innerHTML;
            const cssContent = window.cssManager ? window.cssManager.getCurrentCSS() : '';
            window.iframeManager.destroyIframe(frame.id);
            window.iframeManager.createPreviewIframe(frame, htmlContent, cssContent);
            window.iframeManager.showIframe(frame.id);
        });
        titleBar.appendChild(refreshBtn);
    }
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
    
    // Resize functionality now uses edge detection on element borders
    // addResizeHandles(elementFrame); // DEPRECATED
    
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
        addFrameControls(frame, titleBar);
    }
    
    if (content) {
        ensureAllElementsHaveIds(content);
        setupElementExtraction(content);
        setupContentTracking(content);
        if (window.makeContainerElementsSelectable) {
            window.makeContainerElementsSelectable(content);
        }
        
        // Make static elements selectable individually and setup free-floating elements
        content.querySelectorAll('h3, p, button').forEach(element => {
            if (window.makeSelectable) {
                window.makeSelectable(element);
            }
            
            // If element is free-floating, set it up for dragging
            if (element.classList.contains('free-floating')) {
                if (window.setupFreeFloatingElement) {
                    window.setupFreeFloatingElement(element);
                }
            }
        });
    }
    
    // Resize functionality now uses edge detection on element borders
    // addResizeHandles(frame); // DEPRECATED
};

window.setupElementFrame = function(elementFrame) {
    // Resize functionality now uses edge detection on element borders
    // addResizeHandles(elementFrame); // DEPRECATED
    setupElementDragging(elementFrame);
    setupElementExtraction(elementFrame);
};

window.setupFreeFloatingElement = function(element) {
    // Resize functionality now uses edge detection on element borders
    // addResizeHandles(element); // DEPRECATED
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