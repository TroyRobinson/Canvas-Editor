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
        const textElement = findEditableTextElement(e.target);
        if (textElement && !isEditing(textElement)) {
            e.preventDefault();
            e.stopPropagation();
            enterEditMode(textElement);
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

    // Check if an element should be treated as editable text
    function isTextLikeElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        
        const tagName = element.tagName.toLowerCase();
        
        // Explicit text elements
        if (element.classList.contains('text-element')) return true;
        
        // Common text elements
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'dt', 'dd', 'blockquote', 'figcaption'].includes(tagName)) {
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
    function enterEditMode(element) {
        // Exit any current edit mode
        if (currentlyEditingElement && currentlyEditingElement !== element) {
            exitEditMode(currentlyEditingElement);
        }

        // Set this element as currently editing
        currentlyEditingElement = element;
        
        // Enable contentEditable
        element.contentEditable = 'true';
        element.dataset.editing = 'true';
        
        // Add editing class for visual feedback
        element.classList.add('editing');
        
        // Focus and select all text
        element.focus();
        
        // Select all text for easy replacement
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Prevent drag while editing
        element.dataset.originalDraggable = element.draggable;
        element.draggable = false;
        
        // Handle enter key to exit edit mode
        element.addEventListener('keydown', handleKeyDown);
    }

    // Exit edit mode for a text element
    function exitEditMode(element) {
        if (!element || !isEditing(element)) return;
        
        // Remove contentEditable
        element.contentEditable = 'false';
        delete element.dataset.editing;
        
        // Remove editing class
        element.classList.remove('editing');
        
        // Restore draggable if it was set
        if (element.dataset.originalDraggable === 'true') {
            element.draggable = true;
        }
        delete element.dataset.originalDraggable;
        
        // Remove event listener
        element.removeEventListener('keydown', handleKeyDown);
        
        // Clear selection
        const selection = window.getSelection();
        selection.removeAllRanges();
        
        // Clear currently editing reference
        if (currentlyEditingElement === element) {
            currentlyEditingElement = null;
        }
        
        // Blur the element
        element.blur();
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
        getCurrentlyEditingElement: () => currentlyEditingElement
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTextEditing);
    } else {
        initTextEditing();
    }
})();