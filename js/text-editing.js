// Text editing functionality - handles inline editing of text elements
(function() {
    'use strict';

    let currentlyEditingElement = null;

    // Utility: determine if element is a button
    function isButtonElement(element) {
        return element && element.tagName && element.tagName.toLowerCase() === 'button';
    }

    // Ensure a dedicated span exists to hold the button's label and return it
    function ensureButtonLabelSpan(button) {
        if (!isButtonElement(button)) return null;

        // Prefer an explicit data-marked span if present
        let span = button.querySelector('span[data-button-label="true"]');
        if (span) return span;

        // Wrap existing children in a dedicated span to serve as the editable label
        span = document.createElement('span');
        span.dataset.buttonLabel = 'true';
        // Move all current children into the span to preserve structure and listeners
        const children = Array.from(button.childNodes);
        children.forEach(child => span.appendChild(child));
        button.appendChild(span);
        return span;
    }

    // Resolve edit host (element that participates in canvas ops) and the DOM node that will be contentEditable
    function resolveHostAndEditNode(element) {
        if (isButtonElement(element)) {
            const host = element;
            const editNode = ensureButtonLabelSpan(element);
            return { host, editNode };
        }
        return { host: element, editNode: element };
    }

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
        let textElement = target.closest('h1, h2, h3, h4, h5, h6, p, span, button, div.text-element, li, td, th, dt, dd, blockquote, figcaption');

        // Special-case: if the match is a span inside a button, prefer the button as the editable host
        if (textElement && textElement.tagName && textElement.tagName.toLowerCase() === 'span') {
            const buttonAncestor = textElement.closest('button');
            if (buttonAncestor) {
                textElement = buttonAncestor;
            }
        }

        if (textElement && (isTextLikeElement(textElement) || isButtonElement(textElement))) {
            return textElement;
        }
        
        // Fallback: if anywhere inside a button, edit the button
        const buttonFallback = target.closest('button');
        if (buttonFallback) return buttonFallback;
        
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
        
        // Exclude interactive elements (allow buttons to be treated as text-like for sizing/edit host resolution)
        if (['input', 'textarea', 'select', 'a'].includes(tagName)) {
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
        const { host, editNode } = resolveHostAndEditNode(element);

        // Exit any current edit mode
        if (currentlyEditingElement && currentlyEditingElement !== host) {
            exitEditMode(currentlyEditingElement);
        }

        // Ensure host has an ID for undo tracking
        if (!host.id && window.ensureElementHasId) {
            window.ensureElementHasId(host);
        }

        // Set this host as currently editing
        currentlyEditingElement = host;

        // Store the original content for undo tracking (use host text)
        host.dataset.originalContent = host.textContent;

        // Normalize whitespace on edit node - trim excess but preserve intentional spaces
        const normalizedText = editNode.textContent.replace(/\n\s*/g, ' ').trim();
        editNode.textContent = normalizedText;

        // Enable contentEditable on the actual edit node; mark host as editing
        editNode.contentEditable = 'true';
        host.dataset.editing = 'true';

        // Visual feedback on both for clarity
        host.classList.add('editing');
        editNode.classList.add('editing');

        // Preserve whitespace on the edit node and keep label on one line by default
        editNode.style.whiteSpace = 'nowrap';

        // Do not alter height of host or edit node here; vertical centering is handled by CSS on the host.
        // If multi-line behavior is ever needed, this can be toggled to 'pre-wrap'

        // Focus the edit node
        editNode.focus();

        // Position cursor at click location if coordinates provided
        if (clickX !== undefined && clickY !== undefined) {
            try {
                const range = document.caretRangeFromPoint(clickX, clickY);
                if (range && editNode.contains(range.startContainer)) {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    positionCursorAtEnd(editNode);
                }
            } catch (e) {
                positionCursorAtEnd(editNode);
            }
        } else {
            const range = document.createRange();
            range.selectNodeContents(editNode);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Prevent drag while editing on the host element
        host.dataset.originalDraggable = host.draggable;
        host.draggable = false;

        // Handle enter/escape on the edit node, not the host
        editNode.addEventListener('keydown', handleKeyDown);

        // Handle auto-resize for elements that should auto-resize
        // Attach to edit node; handler will resolve the correct resize target
        editNode.addEventListener('input', handleAutoResize);

        // Force an initial measurement to sync width immediately upon entering edit
        if (window.resizeTextElementToFitContent) {
            const targetForSize = host.classList.contains('free-floating') ? host : editNode;
            window.resizeTextElementToFitContent(targetForSize);
        }
    }

    // Exit edit mode for a text element
    function exitEditMode(element) {
        if (!element || !isEditing(element)) return;

        const host = element;
        const labelSpan = isButtonElement(host) ? host.querySelector('span[data-button-label="true"]') : null;

        // Determine current content from host text
        const originalContent = host.dataset.originalContent;
        const currentContent = host.textContent;

        if (originalContent !== currentContent && window.recordContentChange && host.id) {
            window.recordContentChange(host.id, originalContent, currentContent);
        }

        // Clean up the original content data
        delete host.dataset.originalContent;

        // Remove editing flags
        delete host.dataset.editing;
        host.classList.remove('editing');

        // If a label span was used, clean it up
        if (labelSpan) {
            labelSpan.contentEditable = 'false';
            labelSpan.classList.remove('editing');
            labelSpan.style.whiteSpace = '';
            labelSpan.removeEventListener('keydown', handleKeyDown);
            labelSpan.removeEventListener('input', handleAutoResize);
        } else {
            // Non-button flow: disable contentEditable and cleanup directly on the element
            host.contentEditable = 'false';
            host.style.whiteSpace = '';
            host.removeEventListener('keydown', handleKeyDown);
            host.removeEventListener('input', handleAutoResize);
        }

        // Restore draggable if it was set on the host
        if (host.dataset.originalDraggable === 'true') {
            host.draggable = true;
        }
        delete host.dataset.originalDraggable;

        // No inline flex overrides; styling handled by CSS

        // Clear text selection
        const selection = window.getSelection();
        selection.removeAllRanges();

        // Clear currently editing reference
        if (currentlyEditingElement === host) {
            currentlyEditingElement = null;
        }

        // Blur the active element to close editing visuals
        if (labelSpan && document.activeElement === labelSpan) {
            labelSpan.blur();
        } else if (document.activeElement === host) {
            host.blur();
        }

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
        if (currentlyEditingElement) {
            const host = currentlyEditingElement;
            const labelSpan = isButtonElement(host) ? host.querySelector('span[data-button-label="true"]') : null;
            const clickedInside = host.contains(e.target) || (labelSpan && labelSpan.contains(e.target));
            if (!clickedInside) {
                exitEditMode(host);
            }
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
        // Resolve the element that should actually be resized: the nearest free-floating ancestor or the target itself
        let resizeTarget = e.target.closest('.free-floating') || e.target;
        if (shouldAutoResize(resizeTarget) && window.resizeTextElementToFitContent) {
            // Use requestAnimationFrame to avoid layout thrashing during typing
            if (resizeTarget._resizeTimeout) {
                cancelAnimationFrame(resizeTarget._resizeTimeout);
            }
            resizeTarget._resizeTimeout = requestAnimationFrame(() => {
                if (shouldAutoResize(resizeTarget)) { // Check again in case it changed
                    window.resizeTextElementToFitContent(resizeTarget);
                }
                resizeTarget._resizeTimeout = null;
            });
        }
    }

    // Handle key events while editing
    function handleKeyDown(e) {
        // Exit edit mode on Escape
        if (e.key === 'Escape') {
            e.preventDefault();
            const host = e.target.closest('button') || e.target;
            exitEditMode(host);
        }
        // Prevent enter from creating new lines (optional - remove if multi-line is desired)
        else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const host = e.target.closest('button') || e.target;
            exitEditMode(host);
        }
        // Handle spacebar for buttons - prevent default button behavior
        else if (e.key === ' ' && (e.target.tagName.toLowerCase() === 'button' || !!e.target.closest('button'))) {
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