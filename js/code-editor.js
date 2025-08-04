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
    
    // CSS mode state
    let currentMode = 'html'; // 'html' or 'css'
    let cssContent = '';
    let cssStyleElement = null;
    
    // Snapshot system for canvas undo integration
    let elementSnapshot = null;
    let snapshotTimer = null;

    // DOM elements
    let panel = null;
    let resizer = null;
    let textarea = null;
    let modeToggleHtml = null;
    let modeToggleCss = null;

    // Initialize the code editor when the DOM is ready
    function init() {
        panel = document.getElementById('code-editor-panel');
        resizer = document.getElementById('code-editor-resizer');
        textarea = document.getElementById('code-editor-textarea');
        modeToggleHtml = document.getElementById('mode-toggle-html');
        modeToggleCss = document.getElementById('mode-toggle-css');

        if (!panel || !resizer || !textarea || !modeToggleHtml || !modeToggleCss) {
            console.error('Code editor elements not found in DOM');
            return;
        }

        setupPanel();
        setupResizer();
        setupEventListeners();
        setupModeToggle();
        loadCSSContent();
        
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

    // Setup mode toggle functionality
    function setupModeToggle() {
        modeToggleHtml.addEventListener('click', () => switchMode('html'));
        modeToggleCss.addEventListener('click', () => switchMode('css'));
        
        // Set initial state
        updateModeUI();
    }

    // Switch between HTML and CSS modes
    function switchMode(mode) {
        if (mode === currentMode) return;
        
        // Save current content before switching
        if (currentMode === 'css') {
            cssContent = textarea.value;
        }
        
        currentMode = mode;
        updateModeUI();
        
        if (currentMode === 'html') {
            // Switch to HTML mode - show selected element's HTML
            updateCodeView();
            textarea.disabled = !currentSelectedElement;
        } else {
            // Switch to CSS mode - show all CSS
            // Ensure CSS content is loaded if it's empty
            if (!cssContent || cssContent.trim() === '') {
                loadCSSContent();
            }
            textarea.value = cssContent;
            textarea.disabled = false;
        }
    }

    // Update mode toggle UI
    function updateModeUI() {
        if (currentMode === 'html') {
            modeToggleHtml.classList.add('active');
            modeToggleCss.classList.remove('active');
            document.getElementById('code-editor-header').querySelector('span').textContent = 'HTML View';
        } else {
            modeToggleHtml.classList.remove('active');
            modeToggleCss.classList.add('active');
            document.getElementById('code-editor-header').querySelector('span').textContent = 'CSS View';
        }
    }

    // Load CSS content from embedded script tag
    function loadCSSContent() {
        try {
            const cssContentElement = document.getElementById('css-content');
            if (cssContentElement) {
                cssContent = cssContentElement.textContent || cssContentElement.innerText;
            } else {
                cssContent = '/* CSS content not found */';
            }
            
            // Create or update CSS style element for live updates
            if (!cssStyleElement) {
                cssStyleElement = document.createElement('style');
                cssStyleElement.id = 'dynamic-css';
                document.head.appendChild(cssStyleElement);
            }
            cssStyleElement.textContent = cssContent;
        } catch (error) {
            console.error('Failed to load CSS content:', error);
            cssContent = '/* Error loading CSS */';
        }
    }

    // Handle selection changes from the main selection system
    function handleSelectionChange() {
        // Avoid updates when we're applying code changes to prevent infinite loops
        if (isUpdatingFromCode) return;
        
        const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
        
        if (selectedElements.length === 1) {
            const element = selectedElements[0];
            if (element !== currentSelectedElement) {
                // Switch to HTML mode when selecting an element
                switchMode('html');
                setSelectedElement(element);
                showPanel();
            }
        } else if (selectedElements.length > 1) {
            // Multiple selection - show combined code or a summary
            // Switch to HTML mode for multiple selection
            switchMode('html');
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

    // Apply code changes back to the element or CSS
    function applyCodeChanges() {
        if (isUpdatingFromCanvas || textarea.disabled) return;

        if (currentMode === 'css') {
            applyCSSChanges();
            return;
        }

        if (!currentSelectedElement) return;
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
            const oldElement = currentSelectedElement;
            currentSelectedElement = newElement;
            
            // Ensure all elements are properly processed by the selection system first
            if (window.makeContainerElementsSelectable) {
                window.makeContainerElementsSelectable(newElement);
            }
            
            // Re-setup element behaviors
            setupElementBehaviors(newElement);
            
            // Also setup behaviors for child elements that need special treatment
            setupChildElementBehaviors(newElement);
            
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

    // Apply CSS changes to the dynamic style element
    function applyCSSChanges() {
        try {
            const newCSS = textarea.value;
            
            // Update the dynamic CSS style element
            if (cssStyleElement) {
                cssStyleElement.textContent = newCSS;
                cssContent = newCSS;
            }
        } catch (error) {
            console.error('Error applying CSS changes:', error);
        }
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
        if (window.scriptManager) {
            window.scriptManager.activateScripts(element);
        }
    }

    // Setup behaviors for child elements that need special treatment
    function setupChildElementBehaviors(parentElement) {
        // Find all child elements that need special behavior setup
        const elementsNeedingSetup = parentElement.querySelectorAll('.free-floating, .frame');
        
        elementsNeedingSetup.forEach(childElement => {
            setupElementBehaviors(childElement);
        });
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
        // CSS mode functionality
        switchToCSS: () => switchMode('css'),
        switchToHTML: () => switchMode('html'),
        showCSSEditor: () => {
            // Always ensure CSS content is loaded when showing CSS editor
            if (!cssContent || cssContent.trim() === '') {
                loadCSSContent();
            }
            switchMode('css');
            showPanel();
            // Force update textarea even if already in CSS mode
            if (currentMode === 'css') {
                textarea.value = cssContent;
                textarea.disabled = false; // Ensure textarea is enabled in CSS mode
            }
        }
    };

})();