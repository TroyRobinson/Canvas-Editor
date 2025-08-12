/**
 * Code Editor Tab Module
 * 
 * Provides code editing functionality as a tab in the right pane.
 * Handles HTML/CSS mode switching, content synchronization, and validation.
 */

(function() {
    'use strict';

    // State management
    let currentSelectedElement = null;
    let mutationObserver = null;
    let isUpdatingFromCode = false;
    let isUpdatingFromCanvas = false;
    
    // CSS mode state
    let currentMode = 'html'; // 'html' or 'css'
    
    // Snapshot system for canvas undo integration
    let elementSnapshot = null;
    let snapshotTimer = null;

    // DOM elements
    let tabContent = null;
    let textarea = null;
    let modeToggleHtml = null;
    let modeToggleCss = null;
    let headerSpan = null;

    // Initialize the code editor tab
    function init() {
        if (!window.rightPaneManager) {
            console.error('Right Pane Manager not available');
            return;
        }

        // Register with the right pane manager
        tabContent = window.rightPaneManager.registerTab('code-editor', {
            title: 'Code Editor',
            onInit: initializeTab,
            onShow: onTabShow,
            onHide: onTabHide
        });
    }

    // Initialize tab content when first created
    function initializeTab(container) {
        // Create the tab content structure
        container.innerHTML = `
            <div class="code-editor-header">
                <span>HTML View</span>
                <div class="mode-toggle">
                    <button class="mode-toggle-btn mode-active" data-mode="html" data-selectable="false">HTML</button>
                    <button class="mode-toggle-btn" data-mode="css" data-selectable="false">Global CSS</button>
                </div>
            </div>
            <textarea class="code-editor-textarea" spellcheck="false"></textarea>
        `;

        // Get DOM references
        textarea = container.querySelector('.code-editor-textarea');
        modeToggleHtml = container.querySelector('[data-mode="html"]');
        modeToggleCss = container.querySelector('[data-mode="css"]');
        headerSpan = container.querySelector('.code-editor-header span');

        if (!textarea || !modeToggleHtml || !modeToggleCss || !headerSpan) {
            console.error('Code editor tab elements not found');
            return;
        }

        setupEventListeners();
        setupModeToggle();
        
        // Initialize CSS Manager - ensure it's available
        initializeCSSManager();
        
        // Initially disable textarea
        textarea.disabled = true;
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

    // Called when tab becomes visible
    function onTabShow() {
        // Update the code view if there's a selected element
        if (currentSelectedElement) {
            updateCodeView();
        }
    }

    // Called when tab becomes hidden
    function onTabHide() {
        // Record final snapshot when hiding
        recordFinalSnapshot();
    }

    // Switch between HTML and CSS modes
    function switchMode(mode) {
        if (mode === currentMode) return;
        
        // Save current content before switching - but only if textarea has content
        if (currentMode === 'css' && window.cssManager && textarea.value.trim()) {
            window.cssManager.updateCSS(textarea.value);
        }
        
        currentMode = mode;
        updateModeUI();
        
        if (currentMode === 'html') {
            // Switch to HTML mode - show selected element's HTML
            updateCodeView();
            textarea.disabled = !currentSelectedElement;
        } else {
            // Switch to CSS mode - show all CSS
            if (window.cssManager) {
                try {
                    const currentCSS = window.cssManager.getCurrentCSS();
                    textarea.value = currentCSS;
                } catch (error) {
                    console.error('Error getting CSS from CSS Manager:', error);
                    textarea.value = '/* Error loading CSS: ' + error.message + ' */';
                }
            } else {
                console.error('CSS Manager not available in switchMode');
                textarea.value = '/* CSS Manager not available - check console for errors */';
            }
            textarea.disabled = false;
        }
    }

    // Update mode toggle UI
    function updateModeUI() {
        if (currentMode === 'html') {
            modeToggleHtml.classList.add('mode-active');
            modeToggleCss.classList.remove('mode-active');
            headerSpan.textContent = 'HTML View';
        } else {
            modeToggleHtml.classList.remove('mode-active');
            modeToggleCss.classList.add('mode-active');
            headerSpan.textContent = 'CSS View';
        }
    }

    // Initialize CSS Manager with fallback to embedded CSS
    function initializeCSSManager() {
        // Check if CSS Manager is available
        if (typeof window.cssManager !== 'undefined') {
            try {
                window.cssManager.initialize();
                return;
            } catch (error) {
                console.error('Failed to initialize CSS Manager:', error);
            }
        }
        
        // Fallback: create a simple CSS manager if the module didn't load
        createFallbackCSSManager();
    }
    
    // Create a fallback CSS manager if the module fails to load
    function createFallbackCSSManager() {
        let fallbackCssContent = '';
        let fallbackStyleElement = null;
        
        // Load CSS from embedded script
        const cssContentElement = document.getElementById('css-content');
        if (cssContentElement) {
            fallbackCssContent = cssContentElement.textContent || cssContentElement.innerText;
        }
        
        // Create style element
        fallbackStyleElement = document.createElement('style');
        fallbackStyleElement.id = 'dynamic-css';
        document.head.appendChild(fallbackStyleElement);
        fallbackStyleElement.textContent = fallbackCssContent;
        
        // Create minimal CSS manager API
        window.cssManager = {
            initialize: () => {},
            getCurrentCSS: () => fallbackCssContent,
            updateCSS: (newCSS) => {
                fallbackCssContent = newCSS;
                if (fallbackStyleElement) {
                    fallbackStyleElement.textContent = newCSS;
                }
            },
            hasBeenEdited: () => true,
            ensureInitialized: () => {}
        };
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
                // Show the right pane and switch to code editor tab
                window.rightPaneManager.switchToTab('code-editor');
            }
        } else if (selectedElements.length > 1) {
            // Multiple selection - show combined code or a summary
            // Switch to HTML mode for multiple selection
            switchMode('html');
            setMultipleSelection(selectedElements);
            // Show the right pane and switch to code editor tab
            window.rightPaneManager.switchToTab('code-editor');
        } else {
            // No selection
            clearSelection();
            // Don't hide the entire pane, just clear the content
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
            let elementToShow = element;
            
            // If the element is a frame, show only the frame-content HTML
            if (element.classList.contains('frame')) {
                const frameContent = element.querySelector('.frame-content');
                if (frameContent) {
                    elementToShow = frameContent;
                    combinedCode += `<!-- Frame ${index + 1} Content -->\n`;
                } else {
                    combinedCode += `<!-- Frame ${index + 1} (no content) -->\n`;
                }
            } else {
                combinedCode += `<!-- Element ${index + 1} -->\n`;
            }
            
            const cleanElement = cleanElementForSerialization(elementToShow);
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
            let elementToShow = currentSelectedElement;
            
            // If the selected element is a frame, show only the frame-content HTML
            if (currentSelectedElement.classList.contains('frame')) {
                const frameContent = currentSelectedElement.querySelector('.frame-content');
                if (frameContent) {
                    elementToShow = frameContent;
                } else {
                    console.warn('Frame selected but no frame-content found');
                }
            }
            
            const cleanElement = cleanElementForSerialization(elementToShow);
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
            
            // Check if we're editing a frame's content
            if (currentSelectedElement.classList.contains('frame')) {
                const frameContent = currentSelectedElement.querySelector('.frame-content');
                if (frameContent) {
                    // Replace only the frame-content, not the entire frame
                    const newFrameContent = newElement;
                    
                    // Preserve the frame-content class
                    if (!newFrameContent.classList.contains('frame-content')) {
                        newFrameContent.classList.add('frame-content');
                    }
                    
                    // Preserve the original frame-content's ID if it has one
                    if (frameContent.id && !newFrameContent.id) {
                        newFrameContent.id = frameContent.id;
                    }
                    
                    // Replace the frame-content
                    const parent = frameContent.parentNode;
                    const nextSibling = frameContent.nextSibling;
                    parent.removeChild(frameContent);
                    parent.insertBefore(newFrameContent, nextSibling);
                    
                    // Ensure all elements are properly processed by the selection system
                    if (window.makeContainerElementsSelectable) {
                        window.makeContainerElementsSelectable(newFrameContent);
                    }
                    
                    // Re-setup content tracking and extraction for the new frame content
                    if (window.ensureAllElementsHaveIds) {
                        window.ensureAllElementsHaveIds(newFrameContent);
                    }
                    
                    // Make static elements selectable individually
                    newFrameContent.querySelectorAll('h3, p, button').forEach(element => {
                        if (window.makeSelectable) {
                            window.makeSelectable(element);
                        }
                    });
                    
                    // Activate scripts for the frame (this will include the new content)
                    // Scripts will be activated when entering interactive mode via iframe
                    console.log('💡 CODE EDITOR: Scripts will activate in interactive mode iframe');
                    
                    // Keep the frame selected (not the frame-content)
                    // The observation remains on the frame, not the content
                    
                } else {
                    console.warn('Frame selected but no frame-content found for editing');
                    throw new Error('Frame content not found');
                }
            } else {
                // Normal element replacement logic for non-frames
                
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
            }
            
        } catch (error) {
            console.error('Error applying code changes:', error);
            alert('Error applying changes: ' + error.message);
        }

        // Delay resetting the flag to account for mutation observer debounce (100ms)
        setTimeout(() => {
            isUpdatingFromCode = false;
        }, 150);
    }

    // Apply CSS changes using CSS Manager
    function applyCSSChanges() {
        try {
            const newCSS = textarea.value;
            
            if (window.cssManager) {
                window.cssManager.updateCSS(newCSS);
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
            // Scripts will be activated when entering interactive mode via iframe
            console.log('💡 CODE EDITOR: Scripts will activate in interactive mode iframe');
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
            let elementToSnapshot = currentSelectedElement;
            
            // If the selected element is a frame, snapshot the frame-content instead
            if (currentSelectedElement.classList.contains('frame')) {
                const frameContent = currentSelectedElement.querySelector('.frame-content');
                if (frameContent) {
                    elementToSnapshot = frameContent;
                }
            }
            
            elementSnapshot = {
                elementId: currentSelectedElement.id, // Always use the frame's ID for tracking
                originalHTML: cleanElementForSerialization(elementToSnapshot).outerHTML,
                timestamp: Date.now(),
                isFrameContent: currentSelectedElement.classList.contains('frame') // Track if this was frame content
            };
        }
    }
    
    function recordFinalSnapshot() {
        if (elementSnapshot && currentSelectedElement && currentSelectedElement.id === elementSnapshot.elementId) {
            let elementToSnapshot = currentSelectedElement;
            
            // If the snapshot was for frame content, compare frame content
            if (elementSnapshot.isFrameContent && currentSelectedElement.classList.contains('frame')) {
                const frameContent = currentSelectedElement.querySelector('.frame-content');
                if (frameContent) {
                    elementToSnapshot = frameContent;
                }
            }
            
            const currentHTML = cleanElementForSerialization(elementToSnapshot).outerHTML;
            
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

    // Handle keyboard shortcuts in textarea
    function handleKeyDown(event) {
        // Escape to close panel
        if (event.key === 'Escape') {
            event.preventDefault();
            window.rightPaneManager.hide();
            // Clear selection
            if (window.clearSelection) {
                window.clearSelection();
            }
        }
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

    // Expose public API (for backward compatibility)
    window.codeEditor = {
        show: () => window.rightPaneManager.switchToTab('code-editor'),
        hide: () => window.rightPaneManager.hide(),
        updateCodeView: updateCodeView,
        isVisible: () => window.rightPaneManager.isVisible() && window.rightPaneManager.getActiveTab() === 'code-editor',
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
            // Ensure CSS Manager is ready
            if (window.cssManager) {
                window.cssManager.ensureInitialized();
            }
            
            switchMode('css');
            window.rightPaneManager.switchToTab('code-editor');
            
            // Force update textarea even if already in CSS mode
            if (currentMode === 'css' && window.cssManager) {
                const currentCSS = window.cssManager.getCurrentCSS();
                textarea.value = currentCSS;
                textarea.disabled = false; // Ensure textarea is enabled in CSS mode
            }
        }
    };

})();