// Comment Manager - Displays HTML comments as interactive bubbles
// Scans for HTML comments in elements and creates visual indicators

(function() {
    'use strict';

    let commentObserver = null;
    let activeCommentDisplay = null;
    const commentBubbles = new Map(); // element -> bubble element
    const commentData = new Map(); // element -> array of comments

    // Configuration
    const BUBBLE_SIZE = 16;
    const BUBBLE_OFFSET = 4;
    const DISPLAY_OFFSET = 8;
    const Z_INDEX_BUBBLE = 50;
    const Z_INDEX_DISPLAY = 200;

    /**
     * Extract HTML comments that are direct children of an element
     * Only gets comments that belong specifically to this element, not nested ones
     * @param {HTMLElement} element - Element to scan for comments
     * @returns {Array} Array of comment text strings
     */
    function extractComments(element) {
        if (!element) return [];
        
        const comments = [];
        
        // Method 1: Check direct child nodes for comment nodes
        for (let i = 0; i < element.childNodes.length; i++) {
            const node = element.childNodes[i];
            if (node.nodeType === Node.COMMENT_NODE) {
                const commentText = node.nodeValue.trim();
                if (commentText) {
                    comments.push(commentText);
                }
            }
        }
        
        // Method 2: Also check for comments in the element's direct HTML content
        // But only if there are no direct comment nodes (for elements with innerHTML set)
        if (comments.length === 0 && element.innerHTML) {
            const directComments = extractDirectComments(element.innerHTML);
            comments.push(...directComments);
        }
        
        return comments;
    }

    /**
     * Extract comments that are at the top level of HTML string, not nested in child elements
     * @param {string} html - HTML string to parse
     * @returns {Array} Array of comment text strings
     */
    function extractDirectComments(html) {
        const comments = [];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Look for direct child comment nodes in the parsed content
        for (let i = 0; i < tempDiv.childNodes.length; i++) {
            const node = tempDiv.childNodes[i];
            if (node.nodeType === Node.COMMENT_NODE) {
                const commentText = node.nodeValue.trim();
                if (commentText) {
                    comments.push(commentText);
                }
            }
        }
        
        return comments;
    }

    /**
     * Check if element should have comment detection
     * Exclude system elements and comment bubbles themselves
     */
    function shouldProcessElement(element) {
        if (!element || !element.tagName) return false;
        
        // Skip system elements
        if (element.classList.contains('comment-bubble') || 
            element.classList.contains('comment-display') ||
            element.classList.contains('selection-marquee') ||
            element.id === 'canvas') {
            return false;
        }
        
        // Only process elements that can contain HTML content
        const hasContent = element.innerHTML && element.innerHTML.includes('<!--');
        return hasContent;
    }

    /**
     * Check if a comment bubble should be visible for an element
     * Respects canvas mode and text editing, but stays visible during drag/resize
     */
    function shouldShowBubble(element) {
        // Skip in interactive mode
        if (window.canvasMode === 'interactive') return false;
        
        // Skip during panning (global operation)
        if (window.isPanning) return false;
        
        // Skip during text editing of this specific element
        if (window.textEditing && window.textEditing.isEditing() && 
            window.textEditing.getCurrentlyEditingElement() === element) {
            return false;
        }
        
        // Stay visible during drag/resize operations for better UX
        return true;
    }

    /**
     * Create a comment bubble element
     * @param {HTMLElement} parentElement - Element that contains the comment
     * @param {Array} comments - Array of comment strings
     * @returns {HTMLElement} Bubble element
     */
    function createCommentBubble(parentElement, comments) {
        const bubble = document.createElement('div');
        bubble.className = 'comment-bubble';
        bubble.innerHTML = '💬';
        bubble.title = `${comments.length} comment${comments.length > 1 ? 's' : ''}`;
        
        // Use fixed positioning to avoid affecting document flow
        bubble.style.position = 'fixed';
        bubble.style.width = BUBBLE_SIZE + 'px';
        bubble.style.height = BUBBLE_SIZE + 'px';
        bubble.style.fontSize = '10px';
        bubble.style.cursor = 'pointer';
        bubble.style.zIndex = Z_INDEX_BUBBLE;
        bubble.style.pointerEvents = 'auto';
        
        // Click handler
        bubble.addEventListener('click', (e) => {
            if (e.target === bubble) {
                e.stopPropagation();
                e.preventDefault();
                
                // Select the parent element
                if (window.selectElement) {
                    window.selectElement(parentElement);
                }
                
                // Show comment display
                showCommentDisplay(parentElement, comments, e.clientX, e.clientY);
            }
        });
        
        // Prevent bubble from interfering with drag operations
        bubble.addEventListener('mousedown', (e) => {
            if (e.target === bubble) {
                e.stopPropagation();
            }
        });
        
        return bubble;
    }

    /**
     * Position a comment bubble relative to its parent element using fixed positioning
     * @param {HTMLElement} bubble - Bubble element to position
     * @param {HTMLElement} parentElement - Parent element with comments
     */
    function positionCommentBubble(bubble, parentElement) {
        const shouldShow = shouldShowBubble(parentElement);
        
        // Use getBoundingClientRect for real-time screen coordinates
        const parentRect = parentElement.getBoundingClientRect();
        const EXTERNAL_ZONE = 8; // Match edge detection external zone
        
        // Position outside edge detection zones to avoid interference
        let x, y;
        if (parentElement.classList.contains('frame')) {
            // For frames, position outside the frame boundary
            x = parentRect.right + EXTERNAL_ZONE + BUBBLE_OFFSET;
            y = parentRect.top + BUBBLE_OFFSET;
        } else {
            // For other elements, position outside with external zone
            x = parentRect.right + EXTERNAL_ZONE + BUBBLE_OFFSET;
            y = parentRect.top + BUBBLE_OFFSET;
        }
        
        // Ensure bubble stays within viewport
        const maxX = window.innerWidth - BUBBLE_SIZE - 10;
        const maxY = window.innerHeight - BUBBLE_SIZE - 10;
        
        bubble.style.left = Math.min(Math.max(x, 10), maxX) + 'px';
        bubble.style.top = Math.max(Math.min(y, maxY), 10) + 'px';
        
        // Control visibility without affecting positioning
        bubble.style.visibility = shouldShow ? 'visible' : 'hidden';
    }

    /**
     * Create and show floating comment display area
     * @param {HTMLElement} element - Element containing comments
     * @param {Array} comments - Array of comment strings
     * @param {number} clickX - X coordinate of click
     * @param {number} clickY - Y coordinate of click
     */
    function showCommentDisplay(element, comments, clickX, clickY) {
        hideCommentDisplay();
        
        const display = document.createElement('div');
        display.className = 'comment-display';
        
        const commentsText = comments.join('\n\n');
        display.textContent = commentsText;
        
        // Styling
        display.style.position = 'fixed';
        display.style.left = (clickX + DISPLAY_OFFSET) + 'px';
        display.style.top = clickY + 'px';
        display.style.zIndex = Z_INDEX_DISPLAY;
        display.style.pointerEvents = 'auto';
        
        document.body.appendChild(display);
        activeCommentDisplay = display;
        
        // Position adjustment to keep in viewport
        const rect = display.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            display.style.left = (clickX - rect.width - DISPLAY_OFFSET) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            display.style.top = (clickY - rect.height) + 'px';
        }
        
        // Click outside to close
        const closeHandler = (e) => {
            if (!display.contains(e.target)) {
                hideCommentDisplay();
                document.removeEventListener('click', closeHandler, true);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
        }, 100);
    }

    /**
     * Hide and remove the active comment display
     */
    function hideCommentDisplay() {
        if (activeCommentDisplay) {
            activeCommentDisplay.remove();
            activeCommentDisplay = null;
        }
    }

    /**
     * Process an element for comments and create/update its bubble
     * @param {HTMLElement} element - Element to process
     */
    function processElementComments(element) {
        if (!shouldProcessElement(element)) return;
        
        const comments = extractComments(element);
        const hadBubble = commentBubbles.has(element);
        
        if (comments.length > 0) {
            commentData.set(element, comments);
            
            if (!hadBubble) {
                const bubble = createCommentBubble(element, comments);
                commentBubbles.set(element, bubble);
                document.body.appendChild(bubble);
            } else {
                // Update existing bubble
                const bubble = commentBubbles.get(element);
                bubble.title = `${comments.length} comment${comments.length > 1 ? 's' : ''}`;
            }
            
            // Position the bubble
            const bubble = commentBubbles.get(element);
            positionCommentBubble(bubble, element);
        } else {
            // Remove bubble if no comments
            if (hadBubble) {
                const bubble = commentBubbles.get(element);
                bubble.remove();
                commentBubbles.delete(element);
                commentData.delete(element);
            }
        }
    }

    /**
     * Scan all elements in the canvas for comments
     */
    function scanAllElements() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        
        // Clear existing data for elements that no longer exist
        const existingElements = new Set();
        
        // Find all potential elements
        const allElements = canvas.querySelectorAll('*');
        allElements.forEach(element => {
            existingElements.add(element);
            processElementComments(element);
        });
        
        // Clean up bubbles for removed elements
        for (const [element, bubble] of commentBubbles) {
            if (!existingElements.has(element) || !document.contains(element)) {
                bubble.remove();
                commentBubbles.delete(element);
                commentData.delete(element);
            }
        }
    }

    /**
     * Refresh all bubble positions
     */
    function refreshAllBubblePositions() {
        for (const [element, bubble] of commentBubbles) {
            if (document.contains(element)) {
                positionCommentBubble(bubble, element);
            }
        }
    }

    /**
     * Monitor for any drag operations and continuously update all comment bubbles
     */
    function setupDragStateMonitor() {
        let dragAnimationId = null;
        let anyElementBeingDragged = false;
        
        const dragObserver = new MutationObserver((mutations) => {
            let dragStateChanged = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const element = mutation.target;
                    
                    // Check if this element started or stopped being dragged
                    if (element.classList.contains('dragging')) {
                        if (!anyElementBeingDragged) {
                            anyElementBeingDragged = true;
                            dragStateChanged = true;
                        }
                    }
                }
            });
            
            // Also check if all drag operations have stopped
            if (anyElementBeingDragged) {
                const canvas = document.getElementById('canvas');
                const draggingElements = canvas ? canvas.querySelectorAll('.dragging') : [];
                
                if (draggingElements.length === 0) {
                    anyElementBeingDragged = false;
                    dragStateChanged = true;
                }
            }
            
            // Start or stop continuous updates based on drag state
            if (dragStateChanged) {
                if (anyElementBeingDragged) {
                    startContinuousUpdates();
                } else {
                    stopContinuousUpdates();
                }
            }
        });
        
        const canvas = document.getElementById('canvas');
        if (canvas) {
            dragObserver.observe(canvas, {
                attributes: true,
                attributeFilter: ['class'],
                subtree: true
            });
        }
        
        function startContinuousUpdates() {
            if (dragAnimationId) return; // Already running
            
            const updateAllBubbles = () => {
                // Update all comment bubbles during any drag operation
                for (const [element, bubble] of commentBubbles) {
                    if (document.contains(element)) {
                        positionCommentBubble(bubble, element);
                    }
                }
                
                if (anyElementBeingDragged) {
                    dragAnimationId = requestAnimationFrame(updateAllBubbles);
                }
            };
            
            dragAnimationId = requestAnimationFrame(updateAllBubbles);
        }
        
        function stopContinuousUpdates() {
            if (dragAnimationId) {
                cancelAnimationFrame(dragAnimationId);
                dragAnimationId = null;
            }
        }
    }

    /**
     * Monitor resize state changes and provide fluid positioning during resize operations
     */
    function setupResizeStateMonitor() {
        let resizeAnimationId = null;
        let wasResizing = false;
        
        const checkResizeState = () => {
            const isCurrentlyResizing = window.isResizing && window.isResizing();
            
            if (isCurrentlyResizing && !wasResizing) {
                // Start continuous updates during resize
                startResizeContinuousUpdates();
            } else if (!isCurrentlyResizing && wasResizing) {
                // Stop continuous updates when resize ends
                stopResizeContinuousUpdates();
            }
            
            wasResizing = isCurrentlyResizing;
        };
        
        function startResizeContinuousUpdates() {
            if (resizeAnimationId) return; // Already running
            
            const updateAllBubbles = () => {
                // Update all comment bubbles during any resize operation
                for (const [element, bubble] of commentBubbles) {
                    if (document.contains(element)) {
                        positionCommentBubble(bubble, element);
                    }
                }
                
                if (window.isResizing && window.isResizing()) {
                    resizeAnimationId = requestAnimationFrame(updateAllBubbles);
                }
            };
            
            resizeAnimationId = requestAnimationFrame(updateAllBubbles);
        }
        
        function stopResizeContinuousUpdates() {
            if (resizeAnimationId) {
                cancelAnimationFrame(resizeAnimationId);
                resizeAnimationId = null;
            }
        }
        
        setInterval(checkResizeState, 50);
        
        // Also listen for window resize events
        window.addEventListener('resize', () => {
            setTimeout(() => {
                for (const [element, bubble] of commentBubbles) {
                    if (document.contains(element)) {
                        positionCommentBubble(bubble, element);
                    }
                }
            }, 50);
        });
    }

    /**
     * Initialize comment detection system
     */
    function initialize() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        
        // Initial scan
        scanAllElements();
        
        // Set up mutation observer for DOM changes
        commentObserver = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldScan = true;
                } else if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                    // Content changes might affect comments
                    if (mutation.target && shouldProcessElement(mutation.target.parentElement)) {
                        shouldScan = true;
                    }
                }
            });
            
            if (shouldScan) {
                // Debounce rescans
                setTimeout(scanAllElements, 50);
            }
        });
        
        commentObserver.observe(canvas, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: false
        });
        
        // Listen for zoom/pan changes to reposition bubbles
        window.addEventListener('wheel', () => {
            setTimeout(() => {
                for (const [element, bubble] of commentBubbles) {
                    if (document.contains(element)) {
                        positionCommentBubble(bubble, element);
                    }
                }
            }, 50);
        });
        
        // Listen for selection changes to hide comment display
        window.addEventListener('selectionChanged', hideCommentDisplay);
        
        // Listen for mode changes
        window.addEventListener('canvasModeChanged', (e) => {
            if (e.detail && e.detail.mode) {
                setTimeout(refreshAllBubblePositions, 10);
            }
        });
        
        // Monitor drag state changes via class mutations
        setupDragStateMonitor();
        
        // Listen for resize state changes
        setupResizeStateMonitor();
        
        console.log('Comment Manager initialized');
    }

    /**
     * Clean up comment system
     */
    function cleanup() {
        if (commentObserver) {
            commentObserver.disconnect();
            commentObserver = null;
        }
        
        // Remove all bubbles
        for (const [, bubble] of commentBubbles) {
            bubble.remove();
        }
        commentBubbles.clear();
        commentData.clear();
        
        hideCommentDisplay();
    }

    // Global API
    window.commentManager = {
        initialize,
        cleanup,
        scanAllElements,
        refreshAllBubblePositions,
        hideCommentDisplay
    };

    // Auto-initialize when canvas is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();