// Mode Manager - Handles switching between edit and interactive modes using iframe previews
(function() {
    'use strict';

    // Initialize mode state
    window.canvasMode = {
        mode: 'edit', // Default to edit mode
        commentMode: false, // Comment mode state
        
        setMode(newMode) {
            if (this.mode === newMode) return;
            
            // Exit any active operations before switching
            this.exitAllActiveOperations();
            
            // Handle iframe-based mode transition
            if (this.mode === 'edit' && newMode === 'interactive') {
                // Create iframe previews for all frames
                this.enterInteractiveMode();
            } else if (this.mode === 'interactive' && newMode === 'edit') {
                // Destroy iframe previews, return to edit mode
                this.enterEditMode();
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
        
        setCommentMode(enabled) {
            if (this.commentMode === enabled) return;
            
            this.commentMode = enabled;
            document.body.setAttribute('data-comment-mode', enabled ? 'active' : 'inactive');
            
            // Update comment mode UI
            this.updateCommentModeUI();
            
            // Dispatch custom event for other modules
            window.dispatchEvent(new CustomEvent('commentModeChanged', { 
                detail: { enabled: enabled } 
            }));
        },
        
        toggleCommentMode() {
            this.setCommentMode(!this.commentMode);
        },
        
        isCommentMode() {
            return this.commentMode;
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
        
        updateCommentModeUI() {
            const chip = document.getElementById('comment-mode-chip');
            if (chip) {
                chip.style.display = this.commentMode ? 'flex' : 'none';
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
            
            // Create comment mode chip
            this.createCommentModeChip();
        },
        
        createCommentModeChip() {
            // Create comment mode chip container
            const chipContainer = document.createElement('div');
            chipContainer.id = 'comment-mode-chip';
            chipContainer.innerHTML = `
                <span class="chip-icon">💬</span>
                <span class="chip-text">Comment Mode</span>
            `;
            chipContainer.style.display = 'none'; // Hidden by default
            
            // Insert after the mode toggle container
            const modeToggle = document.getElementById('mode-toggle-container');
            if (modeToggle) {
                modeToggle.insertAdjacentElement('afterend', chipContainer);
            }
        },
        
        // Enter interactive mode by creating iframe previews for all frames
        enterInteractiveMode() {
            console.log('🎮 INTERACTIVE MODE: Creating iframe previews with latest frame content');
            
            const frames = document.querySelectorAll('.frame');
            frames.forEach(frame => {
                const frameContent = frame.querySelector('.frame-content');
                if (frameContent && window.iframeManager) {
                    try {
                        // IMPORTANT: Always destroy existing iframe first to ensure fresh content
                        window.iframeManager.destroyIframe(frame.id);
                        
                        // Get CURRENT frame content (includes any recent edits/moves)
                        const htmlContent = frameContent.innerHTML;
                        const cssContent = window.cssManager ? window.cssManager.getCurrentCSS() : '';
                        
                        console.log(`📄 Current HTML for ${frame.id}:`, htmlContent.substring(0, 100));
                        
                        // Create iframe preview with current content
                        window.iframeManager.createPreviewIframe(frame, htmlContent, cssContent);
                        window.iframeManager.showIframe(frame.id);
                        
                        console.log(`🎮 Created fresh iframe preview for ${frame.id}`);
                    } catch (error) {
                        console.error(`❌ Failed to create iframe for ${frame.id}:`, error);
                    }
                }
            });
        },
        
        // Enter edit mode by destroying iframe previews
        enterEditMode() {
            console.log('✏️  EDIT MODE: Destroying iframe previews');
            
            if (window.iframeManager) {
                window.iframeManager.destroyAllIframes();
            }
            
            // Ensure all frame content is visible
            const frames = document.querySelectorAll('.frame');
            frames.forEach(frame => {
                const frameContent = frame.querySelector('.frame-content');
                if (frameContent) {
                    frameContent.style.display = 'block';
                }
            });
        }
    };

    // Set initial mode on body
    document.body.setAttribute('data-canvas-mode', 'edit');
    document.body.setAttribute('data-comment-mode', 'inactive');

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
            
            // Don't intercept in comment mode - allow comment system to handle interactions
            if (window.canvasMode.isCommentMode && window.canvasMode.isCommentMode()) {
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