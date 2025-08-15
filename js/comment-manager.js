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

        const isInputElement = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ||
                              element.tagName === 'SELECT' || element.tagName === 'BUTTON';

        if (isInputElement) {
            // For interactive elements, look for sibling comment nodes
            let prev = element.previousSibling;
            while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                prev = prev.previousSibling;
            }
            if (prev && prev.nodeType === Node.COMMENT_NODE) {
                const commentText = prev.nodeValue.trim();
                if (commentText) comments.push(commentText);
            }

            let next = element.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && !next.nodeValue.trim()) {
                next = next.nextSibling;
            }
            if (next && next.nodeType === Node.COMMENT_NODE) {
                const commentText = next.nodeValue.trim();
                if (commentText) comments.push(commentText);
            }

            return comments;
        }

        // Method 1: Check direct child nodes for comment nodes
        for (let i = 0; i < element.childNodes.length; i++) {
            const node = element.childNodes[i];
            if (node.nodeType === Node.COMMENT_NODE) {
                // Ignore comments that belong to child elements
                let prev = node.previousSibling;
                while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                    prev = prev.previousSibling;
                }
                if (prev && prev.nodeType === Node.ELEMENT_NODE) {
                    continue; // Comment is associated with previous element
                }

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
                // Ignore comments that belong to preceding elements
                let prev = node.previousSibling;
                while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                    prev = prev.previousSibling;
                }
                if (prev && prev.nodeType === Node.ELEMENT_NODE) {
                    continue;
                }

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
        
        // Always check elements that already have comments
        let hasContent = element.innerHTML && element.innerHTML.includes('<!--');
        if (!hasContent) {
            let prev = element.previousSibling;
            while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                prev = prev.previousSibling;
            }
            if (prev && prev.nodeType === Node.COMMENT_NODE) {
                hasContent = true;
            }
        }
        if (!hasContent) {
            let next = element.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && !next.nodeValue.trim()) {
                next = next.nextSibling;
            }
            if (next && next.nodeType === Node.COMMENT_NODE) {
                hasContent = true;
            }
        }
        if (hasContent) return true;
        
        // In comment mode: allow any element that can contain content
        if (window.canvasMode && window.canvasMode.isCommentMode && window.canvasMode.isCommentMode()) {
            // Allow frames, element-frames, and content elements
            if (element.classList.contains('frame') || 
                element.classList.contains('element-frame') ||
                element.classList.contains('free-floating')) {
                return true;
            }
            
            // Allow interactive elements
            if (element.tagName === 'BUTTON' || 
                element.tagName === 'INPUT' || 
                element.tagName === 'SELECT' || 
                element.tagName === 'TEXTAREA') {
                return true;
            }
            
            // Allow text elements and other content elements
            if (element.tagName === 'P' || element.tagName === 'H1' || element.tagName === 'H2' || 
                element.tagName === 'H3' || element.tagName === 'H4' || element.tagName === 'H5' || 
                element.tagName === 'H6' || element.tagName === 'SPAN' || element.tagName === 'DIV') {
                return true;
            }
            
            // Allow any element with content (but not script/style)
            return element.innerHTML !== undefined && element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE';
        }
        
        // In normal mode: only process elements that already have comments (handled above)
        return false;
    }

    /**
     * Check if a comment bubble should be visible for an element
     * ONLY show bubbles for elements that have existing comments
     */
    function shouldShowBubble(element) {
        // Skip in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode && window.canvasMode.isInteractiveMode()) return false;
        
        // Skip during panning (global operation)
        if (window.isPanning) return false;
        
        // Skip during text editing of this specific element
        if (window.textEditing && window.textEditing.isEditing() && 
            window.textEditing.getCurrentlyEditingElement() === element) {
            return false;
        }
        
        // ONLY show bubbles for elements that actually have comments
        const comments = extractComments(element);
        return comments.length > 0;
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
        bubble.style.background = '#6366f1';
        bubble.style.border = '1px solid #4338ca';
        bubble.style.borderRadius = '50%';
        bubble.style.display = 'flex';
        bubble.style.alignItems = 'center';
        bubble.style.justifyContent = 'center';
        bubble.style.color = '#ffffff';
        
        // Click handler
        bubble.addEventListener('click', (e) => {
            if (e.target === bubble) {
                e.stopPropagation();
                e.preventDefault();
                
                // Select the parent element
                if (window.selectElement) {
                    window.selectElement(parentElement);
                }
                
                // Always get fresh comments from the element
                const currentComments = extractComments(parentElement);
                
                // In comment mode: show editable comment display
                if (window.canvasMode && window.canvasMode.isCommentMode && window.canvasMode.isCommentMode()) {
                    showEditableCommentDisplay(parentElement, currentComments, e.clientX, e.clientY);
                } else {
                    // Normal mode: show read-only display
                    showCommentDisplay(parentElement, currentComments, e.clientX, e.clientY);
                }
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
     * Create and show editable comment display area for comment mode
     * @param {HTMLElement} element - Element containing comments
     * @param {Array} comments - Array of comment strings
     * @param {number} clickX - X coordinate of click
     * @param {number} clickY - Y coordinate of click
     */
    function showEditableCommentDisplay(element, comments, clickX, clickY) {
        hideCommentDisplay();
        
        const display = document.createElement('div');
        display.className = 'comment-display editable';
        
        // Create editable textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'comment-textarea';
        textarea.value = comments.join('\n\n');
        textarea.placeholder = 'Add your comment here...';
        
        display.appendChild(textarea);
        
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
        
        // Focus the textarea for immediate editing
        setTimeout(() => {
            textarea.focus();
            if (comments.length === 0) {
                // For new comments, place cursor at start
                textarea.setSelectionRange(0, 0);
            } else {
                // For existing comments, select all text for easy editing
                textarea.select();
            }
        }, 50);
        
        // Save on blur or Enter key
        const saveComment = () => {
            const newComment = textarea.value.trim();
            saveCommentToElement(element, newComment);
            hideCommentDisplay();
        };
        
        textarea.addEventListener('blur', saveComment);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveComment();
            } else if (e.key === 'Escape') {
                // Only close the comment popover on first Escape
                // Prevent the event from bubbling to global handlers
                e.preventDefault();
                e.stopPropagation();
                hideCommentDisplay();
            }
        });
        
        // Click outside to save and close (unless clicking on textarea)
        const closeHandler = (e) => {
            if (!display.contains(e.target)) {
                saveComment();
                document.removeEventListener('click', closeHandler, true);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
        }, 100);
    }

    /**
     * Save comment to element's HTML
     * @param {HTMLElement} element - Element to save comment to
     * @param {string} commentText - Comment text to save
     */
    function saveCommentToElement(element, commentText) {
        if (!element) return;
        
        // For input elements and other elements that don't support innerHTML modification,
        // use sibling HTML comments
        const isInputElement = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ||
                              element.tagName === 'SELECT' || element.tagName === 'BUTTON';

        if (isInputElement) {
            // Build old HTML representation (element + comment)
            let oldHTML = element.outerHTML;
            let next = element.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && !next.nodeValue.trim()) {
                next = next.nextSibling;
            }
            if (next && next.nodeType === Node.COMMENT_NODE) {
                oldHTML += `<!-- ${next.nodeValue.trim()} -->`;
                next.remove();
            }
            let prev = element.previousSibling;
            while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                prev = prev.previousSibling;
            }
            if (prev && prev.nodeType === Node.COMMENT_NODE) {
                oldHTML = `<!-- ${prev.nodeValue.trim()} -->` + oldHTML;
                prev.remove();
            }

            // Add new comment node if needed
            if (commentText) {
                const commentNode = document.createComment(` ${commentText} `);
                element.parentNode.insertBefore(commentNode, element.nextSibling);
            }

            // Record for undo system
            if (window.recordElementReplacement) {
                let newHTML = element.outerHTML;
                let sib = element.nextSibling;
                while (sib && sib.nodeType === Node.TEXT_NODE && !sib.nodeValue.trim()) {
                    sib = sib.nextSibling;
                }
                if (sib && sib.nodeType === Node.COMMENT_NODE) {
                    newHTML += `<!-- ${sib.nodeValue.trim()} -->`;
                }
                window.recordElementReplacement(element, oldHTML, commentText ? newHTML : element.outerHTML);
            }
        } else {
            // For regular elements, manipulate DOM directly
            const oldHTML = element.innerHTML;

            // Remove existing top-level comments (those not following an element)
            Array.from(element.childNodes).forEach(node => {
                if (node.nodeType === Node.COMMENT_NODE) {
                    let prev = node.previousSibling;
                    while (prev && prev.nodeType === Node.TEXT_NODE && !prev.nodeValue.trim()) {
                        prev = prev.previousSibling;
                    }
                    if (!prev || prev.nodeType !== Node.ELEMENT_NODE) {
                        node.remove();
                    }
                }
            });

            if (commentText) {
                const commentNode = document.createComment(` ${commentText} `);
                element.insertBefore(commentNode, element.firstChild);
            }

            const newHTML = element.innerHTML;
            if (window.recordElementReplacement) {
                window.recordElementReplacement(element, oldHTML, newHTML);
            }
        }
        
        // Refresh comment detection for this specific element only
        processElementComments(element);
    }

    /**
     * Hide and remove the active comment display
     */
    function hideCommentDisplay() {
        if (activeCommentDisplay) {
            activeCommentDisplay.remove();
            activeCommentDisplay = null;
            return true;
        }
        return false;
    }

    function hasActiveCommentDisplay() {
        return !!activeCommentDisplay;
    }

    /**
     * Process an element for comments and create/update its bubble
     * @param {HTMLElement} element - Element to process
     */
    function processElementComments(element) {
        if (!shouldProcessElement(element)) return;
        
        const comments = extractComments(element);
        const hadBubble = commentBubbles.has(element);
        
        // ONLY show bubbles for elements with existing comments
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
                bubble.innerHTML = '💬'; // Normal comment icon
                bubble.style.opacity = '1';
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
     * Setup click handler for comment mode interactions
     */
    function setupCommentModeClickHandler() {
        let isHandlingClick = false; // Prevent duplicate handling
        
        // Add global click listener for comment mode using both capture and bubble phases
        const handleCommentModeClick = (e) => {
            // Only handle clicks in comment mode
            if (!window.canvasMode || !window.canvasMode.isCommentMode || !window.canvasMode.isCommentMode()) {
                return;
            }
            
            // Prevent duplicate handling from multiple event listeners
            if (isHandlingClick) return;
            
            // Don't interfere with placement mode
            if (window.isInPlacementMode && window.isInPlacementMode()) {
                return;
            }
            
            // Don't handle clicks on comment bubbles or displays (they have their own handlers)
            if (e.target.closest('.comment-bubble') || e.target.closest('.comment-display')) {
                return;
            }
            
            // Find the clicked element within canvas
            const canvas = document.getElementById('canvas');
            if (!canvas || !canvas.contains(e.target)) {
                return;
            }
            
            // Find the nearest commentable element
            let targetElement = e.target;
            while (targetElement && targetElement !== canvas) {
                if (shouldProcessElement(targetElement)) {
                    // Found a commentable element
                    isHandlingClick = true;
                    
                    // Select the element
                    if (window.selectElement) {
                        window.selectElement(targetElement);
                    }
                    
                    // Get existing comments or create empty array
                    const comments = extractComments(targetElement);
                    
                    // Show editable comment display with a small delay to ensure other handlers complete
                    setTimeout(() => {
                        showEditableCommentDisplay(targetElement, comments, e.clientX, e.clientY);
                        isHandlingClick = false; // Reset flag
                    }, 10);
                    return;
                }
                targetElement = targetElement.parentElement;
            }
        };
        
        // Add listeners for both capture and bubble phases to ensure we catch the click
        document.addEventListener('click', handleCommentModeClick, true); // Capture phase
        document.addEventListener('click', handleCommentModeClick, false); // Bubble phase
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
        
        // Listen for comment mode changes
        window.addEventListener('commentModeChanged', (e) => {
            if (e.detail) {
                // Refresh all elements to show/hide bubbles based on new mode
                setTimeout(scanAllElements, 10);
            }
        });
        
        // Setup element click handling for comment mode
        setupCommentModeClickHandler();
        
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
        hideCommentDisplay,
        hasActiveCommentDisplay
    };

    // Auto-initialize when canvas is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();