// Mode Manager - Handles switching between edit and interactive modes
(function() {
    'use strict';

    // Storage for frame code snapshots
    const frameCodeStorage = new Map();

    // Initialize mode state
    window.canvasMode = {
        mode: 'edit', // Default to edit mode
        
        setMode(newMode) {
            if (this.mode === newMode) return;
            
            // Exit any active operations before switching
            this.exitAllActiveOperations();
            
            // Handle code storage/restoration based on mode transition
            if (this.mode === 'edit' && newMode === 'interactive') {
                // Store all frame code before entering interactive mode
                this.storeAllFrameCode();
            } else if (this.mode === 'interactive' && newMode === 'edit') {
                // Restore all frame code when exiting interactive mode
                this.restoreAllFrameCode();
            }
            
            this.mode = newMode;
            document.body.setAttribute('data-canvas-mode', newMode);
            
            // Update toggle UI
            this.updateToggleUI();
            
            // Dispatch custom event for other modules
            window.dispatchEvent(new CustomEvent('canvasModeChanged', { 
                detail: { mode: newMode } 
            }));
        },
        
        getMode() {
            return this.mode;
        },
        
        isEditMode() {
            return this.mode === 'edit';
        },
        
        isInteractiveMode() {
            return this.mode === 'interactive';
        },
        
        toggleMode() {
            this.setMode(this.mode === 'edit' ? 'interactive' : 'edit');
        },
        
        exitAllActiveOperations() {
            // Clear selection if in interactive mode
            if (this.mode === 'interactive' && window.clearSelection) {
                window.clearSelection();
            }
            
            // Exit text editing if active
            if (window.textEditing && window.textEditing.getCurrentlyEditingElement()) {
                const editingElement = window.textEditing.getCurrentlyEditingElement();
                if (editingElement && window.textEditing.exitEditMode) {
                    window.textEditing.exitEditMode(editingElement);
                }
            }
            
            // Cancel element placement if active
            if (window.isInPlacementMode && window.isInPlacementMode()) {
                // Dispatch escape key event to cancel placement
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }
        },
        
        updateToggleUI() {
            const toggle = document.getElementById('mode-toggle');
            if (toggle) {
                toggle.checked = this.mode === 'interactive';
            }
        },
        
        createToggleUI() {
            // Create toggle container
            const toggleContainer = document.createElement('div');
            toggleContainer.id = 'mode-toggle-container';
            toggleContainer.innerHTML = `
                <span class="mode-label">Edit</span>
                <label class="mode-toggle-switch">
                    <input type="checkbox" id="mode-toggle">
                    <span class="mode-toggle-slider"></span>
                </label>
                <span class="mode-label">Interactive</span>
            `;
            
            // Add event listener to toggle
            const toggle = toggleContainer.querySelector('#mode-toggle');
            toggle.addEventListener('change', (e) => {
                this.setMode(e.target.checked ? 'interactive' : 'edit');
            });
            
            // Insert at the beginning of body
            document.body.insertBefore(toggleContainer, document.body.firstChild);
        },
        
        // Store code copies of all frames when entering interactive mode
        storeAllFrameCode() {
            console.log('📋 STORING: Frame code for interactive mode');
            frameCodeStorage.clear(); // Clear any existing storage
            
            // Find all frames
            const frames = document.querySelectorAll('.frame');
            frames.forEach(frame => {
                const frameContent = frame.querySelector('.frame-content');
                if (frameContent) {
                    // Store the complete innerHTML of the frame content
                    frameCodeStorage.set(frame.id, frameContent.innerHTML);
                    console.log(`💾 STORED: Code for frame ${frame.id}`);
                }
            });
        },
        
        // Restore frame code when exiting interactive mode
        restoreAllFrameCode() {
            console.log('🔄 RESTORING: Frame code from edit mode');
            
            frameCodeStorage.forEach((storedHTML, frameId) => {
                const frame = document.getElementById(frameId);
                if (!frame) {
                    console.warn(`⚠️ RESTORE: Frame ${frameId} not found, skipping`);
                    return;
                }
                
                const oldFrameContent = frame.querySelector('.frame-content');
                if (!oldFrameContent) {
                    console.warn(`⚠️ RESTORE: Frame content not found for ${frameId}, skipping`);
                    return;
                }
                
                // Create new frame-content element from stored HTML (proper cleanup approach)
                const newFrameContent = document.createElement('div');
                newFrameContent.className = 'frame-content';
                newFrameContent.innerHTML = storedHTML;
                
                // Use proper element replacement to strip all old event handlers
                const parent = oldFrameContent.parentElement;
                const nextSibling = oldFrameContent.nextSibling;
                
                // CRITICAL: Remove old element completely (strips all event handlers)
                parent.removeChild(oldFrameContent);
                parent.insertBefore(newFrameContent, nextSibling);
                
                console.log(`✅ RESTORED: Code for frame ${frameId} with proper cleanup`);
                
                // Re-establish all necessary behaviors after code restoration
                this.reestablishFrameBehaviors(frame);
            });
            
            // Clear storage after restoration
            frameCodeStorage.clear();
        },
        
        // Re-establish all Canvas behaviors and script activation after code restoration
        reestablishFrameBehaviors(frame) {
            const frameContent = frame.querySelector('.frame-content');
            if (!frameContent) return;
            
            console.log(`🔧 RE-ESTABLISHING: Behaviors for frame ${frame.id}`);
            
            // Ensure all elements have IDs for tracking
            if (window.ensureAllElementsHaveIds) {
                window.ensureAllElementsHaveIds(frameContent);
            }
            
            // Make static elements selectable
            frameContent.querySelectorAll('*').forEach(element => {
                if (!element.classList.contains('free-floating') && 
                    !element.classList.contains('resize-handle') &&
                    window.makeSelectable) {
                    window.makeSelectable(element);
                }
            });
            
            // Re-establish container behaviors
            if (window.makeContainerElementsSelectable) {
                window.makeContainerElementsSelectable(frameContent);
            }
            
            // Setup element extraction for the frame content
            if (window.setupElementExtraction) {
                window.setupElementExtraction(frameContent);
            }
            
            // Activate scripts for this frame
            if (window.scriptManager && window.scriptManager.activateScripts) {
                window.scriptManager.activateScripts(frame);
            }
            
            // Refresh selection visuals if elements are selected
            if (window.refreshSelectionVisuals) {
                window.refreshSelectionVisuals();
            }
            
            console.log(`✨ COMPLETED: Behavior re-establishment for frame ${frame.id}`);
        }
    };

    // Set initial mode on body
    document.body.setAttribute('data-canvas-mode', 'edit');

    // Event interception for edit mode
    let jsInterceptionListener = null;

    function setupJSInterception() {
        // Remove existing listener if any
        if (jsInterceptionListener) {
            document.removeEventListener('click', jsInterceptionListener, true);
        }

        // Create new listener
        jsInterceptionListener = function(e) {
            // Don't intercept during placement mode - let placement system handle events
            if (window.isInPlacementMode && window.isInPlacementMode()) {
                return;
            }
            
            // Only intercept in edit mode
            if (window.canvasMode.isEditMode()) {
                
                // Check if click is on an interactive element within a frame
                const target = e.target;
                const isInFrame = target.closest('.frame-content') || target.closest('.element-frame');
                const isInteractiveElement = (
                    target.tagName === 'BUTTON' ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'SELECT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'A' ||
                    target.getAttribute('onclick') ||
                    target.closest('button') ||
                    target.closest('a')
                );

                // Prevent JS execution on interactive elements within frames
                if (isInFrame && isInteractiveElement) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    // Do NOT call window.selectElement here; selection is handled on mousedown
                }
            }
        };

        // Add listener at capture phase to intercept before other handlers
        document.addEventListener('click', jsInterceptionListener, true);
    }

    // Setup interception when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupJSInterception);
    } else {
        setupJSInterception();
    }

    // Listen for mode changes to enable/disable features
    window.addEventListener('canvasModeChanged', (e) => {
        const mode = e.detail.mode;
        
        if (mode === 'interactive') {
            // In interactive mode, editing features should be disabled
            // This will be handled by other modules checking canvasMode.isEditMode()
        } else {
            // In edit mode, JS in frames should be disabled
            // Already handled by event interception
        }
    });

})();