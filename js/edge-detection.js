// Edge Detection System - Replace resize handles with intelligent edge detection
(function() {
    'use strict';

    // Configuration constants
    const EDGE_THRESHOLD_BASE = 12; // Base threshold in pixels
    const EDGE_THRESHOLD_MIN = 6;   // Minimum threshold for small elements
    const CORNER_PRIORITY = 1.5;    // Corner zones are 50% larger than edge zones
    const EXTERNAL_ZONE = 8;        // Additional pixels outside element for hit detection
    
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
        const externalZone = EXTERNAL_ZONE / zoom; // Additional hit area outside element
        
        // Extended hit detection rectangle (includes external zone)
        const extendedRect = {
            left: rect.left - externalZone,
            right: rect.right + externalZone,
            top: rect.top - externalZone,
            bottom: rect.bottom + externalZone,
            width: rect.width + (2 * externalZone),
            height: rect.height + (2 * externalZone)
        };
        
        // Check if click is within extended hit area
        const inExtendedArea = clientX >= extendedRect.left && clientX <= extendedRect.right &&
                              clientY >= extendedRect.top && clientY <= extendedRect.bottom;
        
        if (!inExtendedArea) {
            return null; // Click is too far outside element
        }
        
        // Get click position relative to extended element bounds
        const relativeX = clientX - extendedRect.left;
        const relativeY = clientY - extendedRect.top;
        
        // Adjust thresholds for extended area
        const adjustedEdgeThreshold = edgeThreshold + externalZone;
        const adjustedCornerThreshold = cornerThreshold + externalZone;
        
        // Edge detection flags (using extended bounds)
        const nearLeft = relativeX <= adjustedEdgeThreshold;
        const nearRight = relativeX >= (extendedRect.width - adjustedEdgeThreshold);
        const nearTop = relativeY <= adjustedEdgeThreshold;
        const nearBottom = relativeY >= (extendedRect.height - adjustedEdgeThreshold);
        
        // Corner detection flags (with larger threshold)
        const nearLeftCorner = relativeX <= adjustedCornerThreshold;
        const nearRightCorner = relativeX >= (extendedRect.width - adjustedCornerThreshold);
        const nearTopCorner = relativeY <= adjustedCornerThreshold;
        const nearBottomCorner = relativeY >= (extendedRect.height - adjustedCornerThreshold);
        
        // For debugging - less verbose now
        if (window.edgeDetectionDebug) {
            console.log(`🎯 Extended detection:`, {
                originalRect: { width: rect.width, height: rect.height },
                extendedRect: { width: extendedRect.width, height: extendedRect.height },
                clickPos: { x: clientX, y: clientY },
                relativePos: { x: relativeX, y: relativeY },
                thresholds: { edge: adjustedEdgeThreshold, corner: adjustedCornerThreshold, external: externalZone },
                flags: { nearLeft, nearRight, nearTop, nearBottom, nearLeftCorner, nearRightCorner, nearTopCorner, nearBottomCorner }
            });
        }
        
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
     * Used for dynamic cursor updates - works with extended hit zones
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
     * Check if mouse position is within extended resize zones
     * @param {HTMLElement} element - The target element
     * @param {number} clientX - Mouse X coordinate  
     * @param {number} clientY - Mouse Y coordinate
     * @returns {boolean} - True if within extended zones
     */
    function isInExtendedResizeZone(element, clientX, clientY) {
        const rect = element.getBoundingClientRect();
        const zoom = window.canvasZoom ? window.canvasZoom.getCurrentZoom() : 1;
        const externalZone = EXTERNAL_ZONE / zoom;
        
        // Extended hit detection rectangle
        const extendedRect = {
            left: rect.left - externalZone,
            right: rect.right + externalZone,
            top: rect.top - externalZone,
            bottom: rect.bottom + externalZone
        };
        
        return clientX >= extendedRect.left && clientX <= extendedRect.right &&
               clientY >= extendedRect.top && clientY <= extendedRect.bottom;
    }
    
    /**
     * Check if a click is in the external zone (outside element but within extended area)
     * @param {HTMLElement} element - The target element
     * @param {number} clientX - Mouse X coordinate  
     * @param {number} clientY - Mouse Y coordinate
     * @returns {boolean} - True if click is in external zone only
     */
    function isInExternalZoneOnly(element, clientX, clientY) {
        const rect = element.getBoundingClientRect();
        
        // Check if outside actual element bounds
        const isOutsideElement = clientX < rect.left || clientX > rect.right ||
                                clientY < rect.top || clientY > rect.bottom;
        
        // But still within extended zones
        const isInExtended = isInExtendedResizeZone(element, clientX, clientY);
        
        return isOutsideElement && isInExtended;
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
     * Setup dynamic cursor feedback for an element with extended hit zones
     * @param {HTMLElement} element - Element to add cursor feedback to
     */
    function setupDynamicCursor(element) {
        let currentCursor = '';
        
        const updateCursor = (e) => {
            if (!isResizable(element)) {
                element.style.cursor = '';
                return;
            }
            
            // Check if we're in extended resize zones
            if (isInExtendedResizeZone(element, e.clientX, e.clientY)) {
                const newCursor = getCursorForMousePosition(element, e.clientX, e.clientY);
                if (newCursor !== currentCursor) {
                    currentCursor = newCursor;
                    element.style.cursor = newCursor;
                }
            } else {
                // Outside extended zones - use default cursor
                if (currentCursor !== 'move') {
                    currentCursor = 'move';
                    element.style.cursor = 'move';
                }
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
        // Skip edge detection for certain conditions
        if (!isResizable(element)) {
            return false;
        }
        
        // Detect resize position (now includes extended hit zones)
        const resizePosition = detectResizePosition(element, e.clientX, e.clientY);
        
        if (resizePosition) {
            console.log(`🎯 Extended edge detection: Starting ${resizePosition} resize on ${element.id || element.className}`);
            
            // Prevent default selection behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Start resize operation
            if (window.startResize) {
                window.startResize(e, element, resizePosition);
            }
            
            return true; // Resize initiated
        }
        
        return false; // No resize, proceed with normal selection
    }

    // Global document-level cursor and event management for extended hit zones
    let globalCursorActive = false;
    let currentExtendedElement = null;
    
    function setupGlobalCursorHandling() {
        // Global mousemove for cursor feedback
        document.addEventListener('mousemove', (e) => {
            if (globalCursorActive) return; // Avoid conflicts with element-level handlers
            
            // Find if we're over any selected element's extended zones
            const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
            currentExtendedElement = null;
            
            for (const element of selectedElements) {
                if (!isResizable(element)) continue;
                
                if (isInExtendedResizeZone(element, e.clientX, e.clientY)) {
                    const cursor = getCursorForMousePosition(element, e.clientX, e.clientY);
                    if (cursor && cursor !== 'move') {
                        document.body.style.cursor = cursor;
                        currentExtendedElement = element; // Track which element we're over
                        return;
                    }
                }
            }
            
            // No resize zones found, clear cursor
            if (document.body.style.cursor && document.body.style.cursor !== 'auto') {
                document.body.style.cursor = '';
            }
            currentExtendedElement = null;
        });
        
        // Global mousedown for extended zone clicks
        document.addEventListener('mousedown', (e) => {
            // Only handle if we're currently over an extended zone
            if (!currentExtendedElement) return;
            
            // Check if this is indeed an external zone click (outside actual element)
            if (isInExternalZoneOnly(currentExtendedElement, e.clientX, e.clientY)) {
                console.log(`🎯 Global external zone click detected on ${currentExtendedElement.id}`);
                
                // Handle the external zone click
                if (window.handleElementMouseDown && window.handleElementMouseDown(currentExtendedElement, e)) {
                    // Resize was initiated from external zone
                    console.log(`🎯 External zone resize initiated successfully`);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, true); // Use capture phase to handle before other handlers
        
        // Clear cursor when mouse leaves canvas area
        document.addEventListener('mouseleave', () => {
            document.body.style.cursor = '';
            currentExtendedElement = null;
        });
    }
    
    // Initialize global cursor and event handling
    setupGlobalCursorHandling();
    
    // Global API
    window.edgeDetection = {
        detect: detectResizePosition,
        getCursor: getCursorForMousePosition,
        isResizable: isResizable,
        setupDynamicCursor: setupDynamicCursor,
        removeDynamicCursor: removeDynamicCursor,
        handleMouseDown: handleElementMouseDown,
        isInExtendedZone: isInExtendedResizeZone,
        isInExternalZone: isInExternalZoneOnly
    };

    // Backward compatibility
    window.detectResizePosition = detectResizePosition;
    window.handleElementMouseDown = handleElementMouseDown;
    
    // Debug toggle
    window.toggleEdgeDetectionDebug = () => {
        window.edgeDetectionDebug = !window.edgeDetectionDebug;
        console.log(`🎯 Edge detection debug: ${window.edgeDetectionDebug ? 'ON' : 'OFF'}`);
    };

    console.log('🎯 Edge detection system initialized with extended hit zones');

})();