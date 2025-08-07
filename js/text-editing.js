// Text editing functionality - handles inline editing of text elements
(function() {
    'use strict';

    let currentlyEditingElement = null;

    // Initialize text editing functionality
    function initTextEditing() {
        // Use event delegation for double-click on text elements
        document.addEventListener('dblclick', handleDoubleClick);
        
        // Global click handler to exit edit mode when clicking outside
        document.addEventListener('mousedown', handleGlobalClick, true);
        
        // Set up observer for new text elements
        setupTextElementObserver();
    }

    // Handle double-click on text elements
    function handleDoubleClick(e) {
        // Check if in interactive mode
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) {
            return;
        }
        
        const textElement = findEditableTextElement(e.target);
        if (textElement && !isEditing(textElement)) {
            e.preventDefault();
            e.stopPropagation();
            enterEditMode(textElement, e.clientX, e.clientY);
        }
    }

    // Find if the target or its closest parent is an editable text element
    function findEditableTextElement(target) {
        // Check if the target itself is a text-like element
        if (isTextLikeElement(target)) {
            return target;
        }
        
        // Check if we're inside a text-like element (for nested scenarios)
        const textElement = target.closest('h1, h2, h3, h4, h5, h6, p, span, div.text-element, li, td, th, dt, dd, blockquote, figcaption');
        
        if (textElement && isTextLikeElement(textElement)) {
            return textElement;
        }
        
        return null;
    }

    // Helper function to position cursor at the end of text
    function positionCursorAtEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Check if an element should be treated as editable text
    function isTextLikeElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        
        const tagName = element.tagName.toLowerCase();
        
        // Explicit text elements
        if (element.classList.contains('text-element')) return true;
        
        // Common text elements
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'dt', 'dd', 'blockquote', 'figcaption', 'button', 'a'].includes(tagName)) {
            return true;
        }
        
        // Span elements (if they're not inside buttons or other interactive elements)
        if (tagName === 'span' && !element.closest('button, input, textarea, select, a')) {
            return true;
        }
        
        // Div elements with text content (but not if they're containers)
        if (tagName === 'div' && !element.classList.contains('frame') && 
            !element.classList.contains('element-frame') && 
            !element.classList.contains('frame-content') &&
            !element.classList.contains('frame-title') &&
            !element.querySelector('div, p, h1, h2, h3, h4, h5, h6') && // Not a container
            element.textContent.trim().length > 0) {
            return true;
        }
        
        // Exclude interactive elements
        if (['button', 'input', 'textarea', 'select', 'a'].includes(tagName)) {
            return false;
        }
        
        // Exclude elements that are already contentEditable
        if (element.contentEditable === 'true') {
            return false;
        }
        
        return false;
    }

    // Enter edit mode for a text element
    function enterEditMode(element, clickX, clickY) {
        // Exit any current edit mode
        if (currentlyEditingElement && currentlyEditingElement !== element) {
            exitEditMode(currentlyEditingElement);
        }

        // Ensure element has an ID for undo tracking
        if (!element.id && window.ensureElementHasId) {
            window.ensureElementHasId(element);
        }

        // Set this element as currently editing
        currentlyEditingElement = element;
        
        // Store the original content for undo tracking
        element.dataset.originalContent = element.textContent;
        
        // Normalize whitespace - trim excess but preserve intentional spaces
        const normalizedText = element.textContent.replace(/\n\s*/g, ' ').trim();
        element.textContent = normalizedText;
        
        // Enable contentEditable
        element.contentEditable = 'true';
        element.dataset.editing = 'true';
        
        // Add editing class for visual feedback
        element.classList.add('editing');
        
        // Apply white-space preservation style to maintain spaces
        element.style.whiteSpace = 'pre-wrap';
        
        // Focus the element
        element.focus();
        
        // Position cursor at click location if coordinates provided
        if (clickX !== undefined && clickY !== undefined) {
            try {
                const range = document.caretRangeFromPoint(clickX, clickY);
                if (range && element.contains(range.startContainer)) {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    // Fallback: position at end of text
                    positionCursorAtEnd(element);
                }
            } catch (e) {
                // Fallback: position at end of text
                positionCursorAtEnd(element);
            }
        } else {
            // No click coordinates, select all text (backward compatibility)
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Prevent drag while editing
        element.dataset.originalDraggable = element.draggable;
        element.draggable = false;
        
        // Handle enter key to exit edit mode
        element.addEventListener('keydown', handleKeyDown);
        
        // Handle auto-resize for elements that should auto-resize
        if (shouldAutoResize(element)) {
            element.addEventListener('input', handleAutoResize);
        }
    }

    // Exit edit mode for a text element
    function exitEditMode(element) {
        if (!element || !isEditing(element)) return;
        
        // Check if content changed and record for undo
        const originalContent = element.dataset.originalContent;
        const currentContent = element.textContent;
        
        if (originalContent !== currentContent && window.recordContentChange && element.id) {
            window.recordContentChange(element.id, originalContent, currentContent);
        }
        
        // Clean up the original content data
        delete element.dataset.originalContent;
        
        // Remove contentEditable
        element.contentEditable = 'false';
        delete element.dataset.editing;
        
        // Remove editing class
        element.classList.remove('editing');
        
        // Remove white-space style (let CSS handle it normally)
        element.style.whiteSpace = '';
        
        // Restore draggable if it was set
        if (element.dataset.originalDraggable === 'true') {
            element.draggable = true;
        }
        delete element.dataset.originalDraggable;
        
        // Remove event listeners
        element.removeEventListener('keydown', handleKeyDown);
        element.removeEventListener('input', handleAutoResize);
        
        // Clear text selection
        const selection = window.getSelection();
        selection.removeAllRanges();
        
        // Clear currently editing reference
        if (currentlyEditingElement === element) {
            currentlyEditingElement = null;
        }
        
        // Blur the element
        element.blur();

        // Refresh selection visuals if available (restores anchors if still selected)
        if (window.refreshSelectionVisuals) {
            window.refreshSelectionVisuals();
        }
    }

    // Check if an element is currently being edited
    function isEditing(element) {
        return element && element.dataset.editing === 'true';
    }

    // Handle global clicks to exit edit mode when clicking outside
    function handleGlobalClick(e) {
        if (currentlyEditingElement && !currentlyEditingElement.contains(e.target)) {
            exitEditMode(currentlyEditingElement);
        }
    }

    // Check if element should auto-resize (free-floating and not manually resized, or explicitly auto-fit)
    function shouldAutoResize(element) {
        // Explicit auto-fit mode always takes precedence
        if (element.dataset.autoFit === 'true') {
            return true;
        }
        
        // Free-floating elements auto-resize by default, unless manually resized or too long
        const style = window.getComputedStyle(element);
        const isFreeFloating = style.position === 'absolute' && element.classList.contains('free-floating');
        const hasBeenManuallyResized = element.dataset.manuallyResized === 'true';
        const textContent = element.textContent || '';
        const isShortText = textContent.length < 30;
        
        return isFreeFloating && !hasBeenManuallyResized && isShortText;
    }

    // Handle auto-resize for text elements that should auto-resize
    function handleAutoResize(e) {
        const element = e.target;
        if (shouldAutoResize(element) && window.resizeTextElementToFitContent) {
            // Use requestAnimationFrame to avoid layout thrashing during typing
            if (element._resizeTimeout) {
                cancelAnimationFrame(element._resizeTimeout);
            }
            element._resizeTimeout = requestAnimationFrame(() => {
                if (shouldAutoResize(element)) { // Check again in case it changed
                    window.resizeTextElementToFitContent(element);
                }
                element._resizeTimeout = null;
            });
        }
    }

    // Handle key events while editing
    function handleKeyDown(e) {
        // Exit edit mode on Escape
        if (e.key === 'Escape') {
            e.preventDefault();
            exitEditMode(e.target);
        }
        // Prevent enter from creating new lines (optional - remove if multi-line is desired)
        else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            exitEditMode(e.target);
        }
        // Handle spacebar for buttons - prevent default button behavior
        else if (e.key === ' ' && e.target.tagName.toLowerCase() === 'button') {
            e.preventDefault();
            e.stopPropagation();
            
            // Manually insert a space at the cursor position
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(' ');
            range.insertNode(textNode);
            
            // Move cursor after the space
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // Set up observer for new text elements
    function setupTextElementObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if it's any text-like element
                        if (isTextLikeElement(node)) {
                            // Ensure contentEditable is false by default
                            node.contentEditable = 'false';
                        }
                        // Also check children for text-like elements
                        const textElements = node.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, td, th, dt, dd, blockquote, figcaption');
                        textElements.forEach(textEl => {
                            if (isTextLikeElement(textEl)) {
                                textEl.contentEditable = 'false';
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.getElementById('canvas'), {
            childList: true,
            subtree: true
        });
    }

    // Public API
    window.textEditing = {
        isEditing: isEditing,
        exitEditMode: exitEditMode,
        getCurrentlyEditingElement: () => currentlyEditingElement,
        isTextLikeElement: isTextLikeElement
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTextEditing);
    } else {
        initTextEditing();
    }
})();