// Edge Detection System - Replace resize handles with intelligent edge detection
(function() {
    'use strict';

    // Configuration constants
    const EDGE_THRESHOLD_BASE = 12; // Base threshold in pixels
    const EDGE_THRESHOLD_MIN = 6;   // Minimum threshold for small elements
    const CORNER_PRIORITY = 1.2;    // Corner zones are 20% larger than edge zones
    
    /**
     * Detect which edge or corner of an element was clicked
     * @param {HTMLElement} element - The target element
     * @param {number} clientX - Click X coordinate in screen space
     * @param {number} clientY - Click Y coordinate in screen space
     * @returns {string|null} - Position string ('nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w') or null
     */
    function detectResizePosition(element, clientX, clientY) {
        const rect = element.getBoundingClientRect();
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        
        // Calculate adaptive edge threshold
        const minDimension = Math.min(rect.width, rect.height);
        const sizeBasedThreshold = Math.max(EDGE_THRESHOLD_MIN, Math.min(EDGE_THRESHOLD_BASE, minDimension * 0.25));
        const edgeThreshold = sizeBasedThreshold / zoom;
        const cornerThreshold = edgeThreshold * CORNER_PRIORITY;
        
        // Get click position relative to element
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;
        
        console.log(`🎯 Detection details:`, {
            elementSize: { width: rect.width, height: rect.height },
            clickPos: { x: clientX, y: clientY },
            relativePos: { x: relativeX, y: relativeY },
            thresholds: { edge: edgeThreshold, corner: cornerThreshold },
            zoom
        });
        
        // Edge detection flags
        const nearLeft = relativeX <= edgeThreshold;
        const nearRight = relativeX >= (rect.width - edgeThreshold);
        const nearTop = relativeY <= edgeThreshold;
        const nearBottom = relativeY >= (rect.height - edgeThreshold);
        
        // Corner detection flags (with larger threshold)
        const nearLeftCorner = relativeX <= cornerThreshold;
        const nearRightCorner = relativeX >= (rect.width - cornerThreshold);
        const nearTopCorner = relativeY <= cornerThreshold;
        const nearBottomCorner = relativeY >= (rect.height - cornerThreshold);
        
        console.log(`🎯 Edge flags:`, { nearLeft, nearRight, nearTop, nearBottom });
        console.log(`🎯 Corner flags:`, { nearLeftCorner, nearRightCorner, nearTopCorner, nearBottomCorner });
        
        // Corner detection (higher priority)
        if (nearTopCorner && nearLeftCorner) return 'nw';
        if (nearTopCorner && nearRightCorner) return 'ne';
        if (nearBottomCorner && nearLeftCorner) return 'sw';
        if (nearBottomCorner && nearRightCorner) return 'se';
        
        // Edge detection
        if (nearTop) return 'n';
        if (nearBottom) return 's';
        if (nearLeft) return 'w';
        if (nearRight) return 'e';
        
        return null; // Not near any resize edge
    }

    /**
     * Get appropriate cursor style for a resize position
     * @param {string} position - Position string from detectResizePosition
     * @returns {string} - CSS cursor value
     */
    function getCursorForPosition(position) {
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'e': 'e-resize',
            'w': 'w-resize'
        };
        return cursors[position] || 'default';
    }

    /**
     * Detect current resize position based on mouse coordinates over element
     * Used for dynamic cursor updates
     * @param {HTMLElement} element - The target element
     * @param {number} clientX - Mouse X coordinate
     * @param {number} clientY - Mouse Y coordinate
     * @returns {string} - Cursor style
     */
    function getCursorForMousePosition(element, clientX, clientY) {
        const position = detectResizePosition(element, clientX, clientY);
        return position ? getCursorForPosition(position) : 'move';
    }

    /**
     * Check if an element should have edge detection enabled
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} - True if element should support edge detection
     */
    function isResizable(element) {
        if (!element) return false;
        
        // Skip if element is being edited
        if (window.textEditing && window.textEditing.isEditing(element)) {
            return false;
        }
        
        // Skip if in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
            return false;
        }
        
        // Skip if in placement mode
        if (window.isInPlacementMode && window.isInPlacementMode()) {
            return false;
        }
        
        // Support frames, element-frames, and free-floating elements
        return element.classList.contains('frame') || 
               element.classList.contains('element-frame') || 
               element.classList.contains('free-floating');
    }

    /**
     * Setup dynamic cursor feedback for an element
     * @param {HTMLElement} element - Element to add cursor feedback to
     */
    function setupDynamicCursor(element) {
        let currentCursor = '';
        
        const updateCursor = (e) => {
            if (!isResizable(element)) {
                element.style.cursor = '';
                return;
            }
            
            const newCursor = getCursorForMousePosition(element, e.clientX, e.clientY);
            if (newCursor !== currentCursor) {
                currentCursor = newCursor;
                element.style.cursor = newCursor;
            }
        };
        
        element.addEventListener('mousemove', updateCursor);
        
        element.addEventListener('mouseleave', () => {
            element.style.cursor = '';
            currentCursor = '';
        });
        
        // Store cleanup function
        element._edgeDetectionCleanup = () => {
            element.removeEventListener('mousemove', updateCursor);
            element.style.cursor = '';
        };
    }

    /**
     * Remove dynamic cursor feedback from an element
     * @param {HTMLElement} element - Element to remove feedback from
     */
    function removeDynamicCursor(element) {
        if (element._edgeDetectionCleanup) {
            element._edgeDetectionCleanup();
            delete element._edgeDetectionCleanup;
        }
    }

    /**
     * Enhanced mousedown handler that includes edge detection
     * @param {HTMLElement} element - The element that was clicked
     * @param {MouseEvent} e - The mousedown event
     * @returns {boolean} - True if resize was initiated, false if should proceed with selection
     */
    function handleElementMouseDown(element, e) {
        console.log(`🎯 Edge detection called for ${element.id || element.className}`);
        
        // Skip edge detection for certain conditions
        if (!isResizable(element)) {
            console.log(`🎯 Element not resizable: ${element.className}`);
            return false;
        }
        
        // Detect resize position
        const resizePosition = detectResizePosition(element, e.clientX, e.clientY);
        console.log(`🎯 Detected resize position: ${resizePosition || 'none'}`);
        
        if (resizePosition) {
            console.log(`🎯 Edge detection: Starting ${resizePosition} resize on ${element.id || element.className}`);
            
            // Prevent default selection behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Start resize operation
            if (window.startResize) {
                console.log(`🎯 Calling window.startResize`);
                window.startResize(e, element, resizePosition);
            } else {
                console.error(`🎯 window.startResize not available!`);
            }
            
            return true; // Resize initiated
        }
        
        return false; // No resize, proceed with normal selection
    }

    // Global API
    window.edgeDetection = {
        detect: detectResizePosition,
        getCursor: getCursorForMousePosition,
        isResizable: isResizable,
        setupDynamicCursor: setupDynamicCursor,
        removeDynamicCursor: removeDynamicCursor,
        handleMouseDown: handleElementMouseDown
    };

    // Backward compatibility
    window.detectResizePosition = detectResizePosition;
    window.handleElementMouseDown = handleElementMouseDown;

    console.log('🎯 Edge detection system initialized');

})();