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
    
    // Snapshot system for canvas undo integration
    let elementSnapshot = null;
    let snapshotTimer = null;

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
        
        // Take snapshot when user starts editing
        textarea.addEventListener('focus', takeInitialSnapshot);
        
        // Real-time updates on textarea change (debounced for performance)
        textarea.addEventListener('input', debounce(applyCodeChanges, 200));
        
        // Record final snapshot when user stops editing (debounced)
        textarea.addEventListener('input', debounce(recordFinalSnapshot, 2000));
        
        // Record snapshot when switching elements or closing panel
        textarea.addEventListener('blur', recordFinalSnapshot);
        
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
        // Record final snapshot of previous element if there was one
        if (currentSelectedElement && currentSelectedElement !== element) {
            recordFinalSnapshot();
        }
        
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
        // Record final snapshot if there was an active edit
        recordFinalSnapshot();
        
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
            
            // Preserve cursor position if user is actively editing
            const shouldPreserveCursor = document.activeElement === textarea && !textarea.disabled;
            let cursorStart, cursorEnd;
            
            if (shouldPreserveCursor) {
                cursorStart = textarea.selectionStart;
                cursorEnd = textarea.selectionEnd;
            }
            
            // Only update if content actually changed to avoid unnecessary cursor disruption
            if (textarea.value !== formattedHTML) {
                textarea.value = formattedHTML;
                
                // Restore cursor position if we preserved it and it's still valid
                if (shouldPreserveCursor && cursorStart !== undefined) {
                    const maxLength = textarea.value.length;
                    textarea.setSelectionRange(
                        Math.min(cursorStart, maxLength), 
                        Math.min(cursorEnd, maxLength)
                    );
                }
            }
            
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
            // First, separate text content from tags for better formatting
            let formatted = html
                // Add line breaks around tags
                .replace(/></g, '>\n<')
                // Separate text content from opening tags
                .replace(/>([^<\s][^<]*[^<\s])</g, '>\n$1\n<')
                // Clean up extra whitespace
                .replace(/^\s*\n/gm, '')
                .replace(/\n\s*\n/g, '\n');
            
            const lines = formatted.split('\n');
            let indentLevel = 0;
            const indentSize = 2;
            
            return lines.map(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return '';
                
                // Decrease indent for closing tags
                if (trimmedLine.startsWith('</')) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                
                const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;
                
                // Increase indent for opening tags (but not self-closing or closing tags)
                if (trimmedLine.startsWith('<') && 
                    !trimmedLine.startsWith('</') && 
                    !trimmedLine.endsWith('/>')) {
                    indentLevel++;
                }
                
                return indentedLine;
            }).join('\n');
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
            
            // Create a temporary container to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = newHTML;
            
            if (tempContainer.children.length !== 1) {
                throw new Error('Code must contain exactly one root element');
            }
            
            const newElement = tempContainer.children[0];
            
            // Preserve the original element's ID to maintain undo system tracking
            if (currentSelectedElement.id && !newElement.id) {
                newElement.id = currentSelectedElement.id;
            }
            
            // Preserve the element's position and container
            const parent = currentSelectedElement.parentNode;
            const nextSibling = currentSelectedElement.nextSibling;
            
            // Replace the element
            parent.removeChild(currentSelectedElement);
            parent.insertBefore(newElement, nextSibling);
            
            // Update the current reference
            currentSelectedElement = newElement;
            
            // Re-setup element behaviors if needed
            setupElementBehaviors(newElement);
            
            // Also setup behaviors for child elements that need special treatment
            setupChildElementBehaviors(newElement);
            
            // Ensure all elements are properly processed by the selection system
            if (window.makeContainerElementsSelectable) {
                window.makeContainerElementsSelectable(newElement);
            }
            
            // Update selection to the new element
            if (window.selectElement) {
                window.selectElement(newElement);
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

        // Delay resetting the flag to account for mutation observer debounce (100ms)
        setTimeout(() => {
            isUpdatingFromCode = false;
        }, 150);
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
        
        // Activate any scripts within the element
        activateScripts(element);
    }

    // Setup behaviors for child elements that need special treatment
    function setupChildElementBehaviors(parentElement) {
        // Find all child elements that need special behavior setup
        const elementsNeedingSetup = parentElement.querySelectorAll('.free-floating, .frame');
        
        elementsNeedingSetup.forEach(childElement => {
            setupElementBehaviors(childElement);
        });
    }

    // Activate scripts within an element using proper cleanup and re-execution
    function activateScripts(element) {
        const scripts = element.querySelectorAll('script');
        const styles = element.querySelectorAll('style');
        
        // Activate styles first (they don't need special handling)
        styles.forEach(style => {
            if (!style.dataset.activated) {
                style.dataset.activated = 'true';
            }
        });
        
        // Clean up any existing script handlers for this element before activating new ones
        cleanupScriptHandlers(element);
        
        // Process scripts
        scripts.forEach(script => {
            const scriptContent = script.textContent || script.innerText;
            if (!scriptContent.trim()) return; // Skip empty scripts
            
            try {
                // Execute the script with container scoping
                executeScriptInContainer(scriptContent, element);
                
                // Mark as activated
                script.dataset.activated = 'true';
                
                console.log('Script activated for element:', element.id);
            } catch (error) {
                console.error('Error activating script:', error);
                console.error('Script content:', scriptContent);
                // Mark as activated even if failed to prevent repeated attempts
                script.dataset.activated = 'true';
            }
        });
    }

    // Clean up existing script handlers for a container (when scripts are re-activated)
    function cleanupScriptHandlers(element) {
        // For container script re-activation, we don't need complex cleanup
        // since we're re-running the entire script for the container
        console.log('Re-activating scripts for container:', element.id);
    }

    // Execute script with container scoping (simple approach)
    function executeScriptInContainer(scriptContent, containerElement) {
        const containerId = containerElement.id || 'canvas';
        
        // Create wrapped script that scopes querySelectorAll to the container
        const wrappedScript = `
        (function() {
            const containerElement = arguments[0];
            
            // Override document.querySelectorAll temporarily to scope to container
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = function(selector) {
                return containerElement.querySelectorAll(selector);
            };
            
            try {
                ${scriptContent}
            } finally {
                // Restore original function
                document.querySelectorAll = originalQuerySelectorAll;
            }
        })`;
        
        try {
            // Execute the script with container scoping
            eval(wrappedScript)(containerElement);
        } catch (error) {
            console.error('Error executing script:', error);
            throw error;
        }
    }


    // Snapshot system for canvas undo integration
    function takeInitialSnapshot() {
        if (currentSelectedElement && !elementSnapshot) {
            elementSnapshot = {
                elementId: currentSelectedElement.id,
                originalHTML: cleanElementForSerialization(currentSelectedElement).outerHTML,
                timestamp: Date.now()
            };
        }
    }
    
    function recordFinalSnapshot() {
        if (elementSnapshot && currentSelectedElement && currentSelectedElement.id === elementSnapshot.elementId) {
            const currentHTML = cleanElementForSerialization(currentSelectedElement).outerHTML;
            
            // Only record if there was an actual change
            if (currentHTML !== elementSnapshot.originalHTML) {
                // Record element replacement for canvas undo system
                if (window.recordElementReplacement) {
                    window.recordElementReplacement(
                        elementSnapshot.elementId,
                        elementSnapshot.originalHTML,
                        currentHTML
                    );
                }
            }
            
            // Clear snapshot
            elementSnapshot = null;
        }
        
        // Clear any pending snapshot timer
        if (snapshotTimer) {
            clearTimeout(snapshotTimer);
            snapshotTimer = null;
        }
    }
    
    function clearSnapshot() {
        elementSnapshot = null;
        if (snapshotTimer) {
            clearTimeout(snapshotTimer);
            snapshotTimer = null;
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
        // Record final snapshot when hiding panel
        recordFinalSnapshot();
        
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

    // Utility function to check if user is actively editing in the code editor
    function isCodeEditorActive() {
        return textarea && document.activeElement === textarea && !textarea.disabled;
    }

    // Clean up script handlers from an element when it leaves a container using cloning
    function cleanupElementHandlers(element, oldContainerId) {
        console.log(`🧹 CLEANING: Element ${element.id} leaving container ${oldContainerId}`);
        
        // Always clone to strip ALL event listeners (both script and Canvas handlers)
        const cleanElement = cloneElementClean(element);
        
        // Replace the original element with the clean clone
        const parent = element.parentElement;
        const nextSibling = element.nextSibling;
        
        // Important: Remove the old element completely
        parent.removeChild(element);
        parent.insertBefore(cleanElement, nextSibling);
        
        // CRITICAL: Re-establish Canvas behaviors that were stripped by cloning
        reestablishCanvasBehaviors(cleanElement);
        
        console.log(`✅ CLEANED: Element ${cleanElement.id} is now clean of all script handlers`);
        
        return cleanElement; // Return the clean element for further processing
    }

    // Re-establish Canvas behaviors after cloning strips all event listeners
    function reestablishCanvasBehaviors(element) {
        // Re-establish selection behavior
        if (window.makeSelectable) {
            window.makeSelectable(element);
        }
        
        // Re-establish drag behavior for free-floating elements
        if (element.classList.contains('free-floating') && window.setupElementDragging) {
            window.setupElementDragging(element);
        }
        
        // Re-establish frame behaviors if it's a frame
        if (element.classList.contains('frame') && window.setupFrame) {
            window.setupFrame(element);
        }
        
        // Re-establish element-frame behaviors
        if (element.classList.contains('element-frame') && window.setupElementFrame) {
            window.setupElementFrame(element);
        }
        
        // Re-establish resize handles (this is usually handled by selection system)
        if (window.addResizeHandles && (element.classList.contains('free-floating') || element.classList.contains('frame') || element.classList.contains('element-frame'))) {
            window.addResizeHandles(element);
        }
        
        // Ensure the element is marked as selectable
        if (!element.dataset.selectable) {
            element.dataset.selectable = 'true';
        }
        
        console.log(`Re-established Canvas behaviors for element ${element.id}`);
    }

    // Clone an element while preserving all attributes but stripping event listeners
    function cloneElementClean(element) {
        const clone = element.cloneNode(true);
        
        // Ensure the clone has the same ID and attributes
        clone.id = element.id;
        clone.className = element.className;
        
        // Copy all inline styles
        clone.style.cssText = element.style.cssText;
        
        // Copy all data attributes and other attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'id' && attr.name !== 'class' && attr.name !== 'style') {
                clone.setAttribute(attr.name, attr.value);
            }
        });
        
        return clone;
    }

    // Re-activate scripts in a container when elements are moved into it
    function reactivateContainerScripts(container, movedElement = null) {
        // Find the root container (frame or element-frame) that might have scripts
        let scriptContainer = container;
        
        // If the container is a frame content area, get the parent frame
        if (container.classList.contains('frame-content')) {
            scriptContainer = container.parentElement;
        }
        
        // Only re-activate scripts for containers that actually have scripts
        // Canvas typically doesn't have scripts, so don't activate for canvas moves
        if (scriptContainer.classList.contains('frame') || 
            scriptContainer.classList.contains('element-frame')) {
            
            console.log(`🔄 RE-ACTIVATING: Scripts for container ${scriptContainer.id}`);
            activateScripts(scriptContainer);
        } else if (scriptContainer.id === 'canvas') {
            console.log(`📋 CANVAS MOVE: Element moved to canvas, no script activation needed`);
        }
        
        // Check parent containers up the tree (but be more selective)
        let parent = scriptContainer.parentElement;
        while (parent && parent !== document.body && parent.id !== 'canvas') {
            if (parent.classList.contains('frame') || 
                parent.classList.contains('element-frame')) {
                
                console.log(`🔄 RE-ACTIVATING: Scripts for parent container ${parent.id}`);
                activateScripts(parent);
                break; // Only go up to the first script container
            }
            parent = parent.parentElement;
        }
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
        isVisible: () => panel && panel.style.display !== 'none',
        // Snapshot management for external use
        takeSnapshot: takeInitialSnapshot,
        recordSnapshot: recordFinalSnapshot,
        clearSnapshot: clearSnapshot,
        // Utility for other modules to check if code editor is active
        isActive: isCodeEditorActive,
        // Script re-activation when elements move between containers
        reactivateContainerScripts: reactivateContainerScripts,
        // Clean up script handlers when elements leave containers
        cleanupElementHandlers: cleanupElementHandlers
    };

})();