// Mode Manager - Handles switching between edit and interactive modes
(function() {
    'use strict';

    // Initialize mode state
    window.canvasMode = {
        mode: 'edit', // Default to edit mode
        
        setMode(newMode) {
            if (this.mode === newMode) return;
            
            // Exit any active operations before switching
            this.exitAllActiveOperations();
            
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