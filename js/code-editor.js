/**
 * Code Editor Module
 * 
 * Provides a right-side resizable code pane that shows the exact code of selected elements
 * and supports bi-directional editing between code and canvas.
 */

(function() {
    'use strict';

    // State management
    let currentSelectedElement = null;
    let mutationObserver = null;
    let isUpdatingFromCode = false;
    let isUpdatingFromCanvas = false;
    let panelWidth = localStorage.getItem('codeEditorWidth') || '400px';
    let isDragging = false;

    // DOM elements
    let panel = null;
    let resizer = null;
    let textarea = null;

    // Initialize the code editor when the DOM is ready
    function init() {
        panel = document.getElementById('code-editor-panel');
        resizer = document.getElementById('code-editor-resizer');
        textarea = document.getElementById('code-editor-textarea');

        if (!panel || !resizer || !textarea) {
            console.error('Code editor elements not found in DOM');
            return;
        }

        setupPanel();
        setupResizer();
        setupEventListeners();
        
        // Initially hide the panel
        hidePanel();
    }

    // Setup initial panel state
    function setupPanel() {
        panel.style.width = panelWidth;
        panel.style.right = '0';
        panel.style.top = '0';
        panel.style.height = '100vh';
        panel.style.position = 'fixed';
        panel.style.zIndex = '1000';
    }

    // Setup resize functionality
    function setupResizer() {
        resizer.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Listen for selection changes
        window.addEventListener('selectionChanged', handleSelectionChange);
        
        // Real-time updates on textarea change (debounced for performance)
        textarea.addEventListener('input', debounce(applyCodeChanges, 500));
        
        // Keyboard shortcuts
        textarea.addEventListener('keydown', handleKeyDown);
    }

    // Handle selection changes from the main selection system
    function handleSelectionChange() {
        // Avoid updates when we're applying code changes to prevent infinite loops
        if (isUpdatingFromCode) return;
        
        const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
        
        if (selectedElements.length === 1) {
            const element = selectedElements[0];
            if (element !== currentSelectedElement) {
                setSelectedElement(element);
                showPanel();
            }
        } else if (selectedElements.length > 1) {
            // Multiple selection - show combined code or a summary
            setMultipleSelection(selectedElements);
            showPanel();
        } else {
            // No selection
            clearSelection();
            hidePanel();
        }
    }

    // Set the currently selected element
    function setSelectedElement(element) {
        // Stop observing previous element
        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        currentSelectedElement = element;
        
        if (element) {
            updateCodeView();
            startObservingElement(element);
        }
    }

    // Handle multiple selected elements
    function setMultipleSelection(elements) {
        // Stop observing previous element
        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        currentSelectedElement = null;
        
        // Show a summary or combined code for multiple elements
        let combinedCode = '<!-- Multiple elements selected -->\n';
        elements.forEach((element, index) => {
            const cleanElement = cleanElementForSerialization(element);
            combinedCode += `<!-- Element ${index + 1} -->\n`;
            combinedCode += formatHTML(cleanElement.outerHTML) + '\n\n';
        });
        
        textarea.value = combinedCode;
        textarea.disabled = true; // Disable editing for multiple selection
    }

    // Clear selection
    function clearSelection() {
        if (mutationObserver) {
            mutationObserver.disconnect();
        }
        currentSelectedElement = null;
        textarea.value = '';
        textarea.disabled = true;
    }

    // Update the code view with current element's HTML
    function updateCodeView() {
        if (!currentSelectedElement || isUpdatingFromCode) return;

        isUpdatingFromCanvas = true;
        
        try {
            const cleanElement = cleanElementForSerialization(currentSelectedElement);
            const formattedHTML = formatHTML(cleanElement.outerHTML);
            textarea.value = formattedHTML;
            textarea.disabled = false;
        } catch (error) {
            console.error('Error updating code view:', error);
            textarea.value = '<!-- Error serializing element -->';
            textarea.disabled = true;
        }
        
        isUpdatingFromCanvas = false;
    }

    // Clean element for serialization (remove system-added elements)
    function cleanElementForSerialization(element) {
        const clone = element.cloneNode(true);
        
        // Remove resize handles
        clone.querySelectorAll('.resize-handle').forEach(el => el.remove());
        
        // Remove selection classes and system classes
        clone.classList.remove('selected', 'dragging', 'resizing');
        
        // Remove any data attributes added by the system
        ['data-original-container', 'data-extraction-ghost'].forEach(attr => {
            clone.removeAttribute(attr);
        });
        
        // Clean up any temporary styles
        if (clone.style.willChange) {
            clone.style.willChange = '';
        }
        
        return clone;
    }

    // Format HTML for better readability
    function formatHTML(html) {
        try {
            // Simple HTML formatting - add indentation and line breaks
            return html
                .replace(/></g, '>\n<')
                .replace(/^\s*\n/gm, '')
                .split('\n')
                .map((line, index) => {
                    const depth = (line.match(/^\s*</g) && line.match(/^\s*<\//g)) ? 0 : 
                                 line.match(/^\s*</g) ? 1 : 0;
                    return '  '.repeat(depth) + line.trim();
                })
                .join('\n');
        } catch (error) {
            return html; // Return original if formatting fails
        }
    }

    // Start observing element for changes
    function startObservingElement(element) {
        mutationObserver = new MutationObserver(
            debounce(() => {
                if (!isUpdatingFromCode) {
                    updateCodeView();
                }
            }, 100)
        );

        mutationObserver.observe(element, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
            attributeOldValue: true
        });
    }

    // Apply code changes back to the element
    function applyCodeChanges() {
        if (!currentSelectedElement || isUpdatingFromCanvas || textarea.disabled) return;

        isUpdatingFromCode = true;

        try {
            const newHTML = textarea.value.trim();
            
            // Capture old state for undo before making changes
            const oldElement = currentSelectedElement;
            const oldHTML = cleanElementForSerialization(oldElement).outerHTML;
            
            // Create a temporary container to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = newHTML;
            
            if (tempContainer.children.length !== 1) {
                throw new Error('Code must contain exactly one root element');
            }
            
            const newElement = tempContainer.children[0];
            
            // Preserve the original element's ID to maintain undo system tracking
            if (oldElement.id && !newElement.id) {
                newElement.id = oldElement.id;
            }
            
            // Preserve the element's position and container
            const parent = oldElement.parentNode;
            const nextSibling = oldElement.nextSibling;
            
            // Replace the element
            parent.removeChild(oldElement);
            parent.insertBefore(newElement, nextSibling);
            
            // Update the current reference
            currentSelectedElement = newElement;
            
            // Re-setup element behaviors if needed
            setupElementBehaviors(newElement);
            
            // Ensure the element gets properly processed by the selection system
            // by calling makeContainerElementsSelectable if it's in a container
            const container = newElement.closest('.frame-content') || newElement.closest('#canvas');
            if (container && window.makeContainerElementsSelectable) {
                // Re-process this specific element to ensure it's selectable
                if (!newElement.dataset.selectable && 
                    ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BUTTON', 'INPUT', 'IMG', 'DIV'].includes(newElement.tagName)) {
                    newElement.dataset.selectable = 'true';
                    if (window.makeSelectable) {
                        window.makeSelectable(newElement);
                    }
                }
            }
            
            // Update selection to the new element
            if (window.selectElement) {
                window.selectElement(newElement);
            }
            
            // Record undo operation as content change
            if (window.recordContentChange && newElement.id) {
                const newHTML = cleanElementForSerialization(newElement).outerHTML;
                window.recordContentChange(newElement.id, oldHTML, newHTML);
            }
            
            // Restart observation on the new element
            if (mutationObserver) {
                mutationObserver.disconnect();
            }
            startObservingElement(newElement);
            
        } catch (error) {
            console.error('Error applying code changes:', error);
            alert('Error applying changes: ' + error.message);
        }

        isUpdatingFromCode = false;
    }

    // Setup behaviors for the new element after code application
    function setupElementBehaviors(element) {
        // Re-setup frame behaviors if it's a frame
        if (element.classList.contains('frame') && window.setupFrame) {
            window.setupFrame(element);
        }
        
        // Re-setup free-floating element behaviors
        if (element.classList.contains('free-floating') && window.setupFreeFloatingElement) {
            window.setupFreeFloatingElement(element);
        }
        
        // Ensure element has proper drag/resize setup via selection system
        if (!element.dataset.selectable) {
            element.dataset.selectable = 'true';
        }
        if (window.makeSelectable) {
            window.makeSelectable(element);
        }
    }

    // Validate HTML syntax without applying changes
    function validateHTML(html) {
        try {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html;
            return tempContainer.children.length === 1;
        } catch (error) {
            return false;
        }
    }

    // Handle keyboard shortcuts in textarea
    function handleKeyDown(event) {
        // Escape to close panel
        if (event.key === 'Escape') {
            event.preventDefault();
            hidePanel();
            // Clear selection
            if (window.clearSelection) {
                window.clearSelection();
            }
        }
    }

    // Panel visibility controls
    function showPanel() {
        panel.style.display = 'flex';
        document.body.style.paddingRight = panelWidth;
    }

    function hidePanel() {
        panel.style.display = 'none';
        document.body.style.paddingRight = '0';
    }

    // Resize functionality
    function startResize(event) {
        isDragging = true;
        document.body.style.cursor = 'ew-resize';
        event.preventDefault();
    }

    function handleResize(event) {
        if (!isDragging) return;

        const newWidth = window.innerWidth - event.clientX;
        const minWidth = 200;
        const maxWidth = window.innerWidth * 0.8;
        
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        panelWidth = constrainedWidth + 'px';
        
        panel.style.width = panelWidth;
        document.body.style.paddingRight = panelWidth;
        
        // Save to localStorage
        localStorage.setItem('codeEditorWidth', panelWidth);
    }

    function stopResize() {
        isDragging = false;
        document.body.style.cursor = '';
    }

    // Utility function for debouncing
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.codeEditor = {
        show: showPanel,
        hide: hidePanel,
        updateCodeView: updateCodeView,
        isVisible: () => panel && panel.style.display !== 'none'
    };

})();