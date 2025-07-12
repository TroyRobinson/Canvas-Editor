// Undo/Redo system using Command pattern
// Handles all canvas operations: create, delete, move, resize, group, extract

class Command {
    constructor(type, data) {
        this.type = type;
        this.data = data;
        this.timestamp = Date.now();
    }
}

class UndoManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 100;
        this.isExecuting = false;
        this.batchMode = false;
        this.currentBatch = [];
    }

    // Start a batch operation (for multi-element actions)
    startBatch() {
        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Starting batch operation');
        }
        this.batchMode = true;
        this.currentBatch = [];
    }

    // End batch and add as single command
    endBatch() {
        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Ending batch operation, batch size:', this.currentBatch.length);
        }
        
        if (this.currentBatch.length > 0) {
            const batchCommand = new Command('batch', {
                commands: this.currentBatch
            });
            
            if (window.DEBUG_UNDO) {
                console.log('UNDO DEBUG: Creating batch command with commands:', this.currentBatch.map(c => c.type));
            }
            
            this.addCommand(batchCommand);
        }
        this.batchMode = false;
        this.currentBatch = [];
    }

    // Add a command to history
    addCommand(command) {
        if (this.isExecuting) return;

        // Debug logging to help identify command patterns
        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Adding command:', {
                type: command.type,
                batchMode: this.batchMode,
                currentBatchSize: this.currentBatch.length,
                historySize: this.history.length,
                data: command.data
            });
        }

        if (this.batchMode) {
            this.currentBatch.push(command);
            if (window.DEBUG_UNDO) {
                console.log('UNDO DEBUG: Command added to batch, batch size now:', this.currentBatch.length);
            }
            return;
        }

        // Remove any commands after current index
        this.history = this.history.slice(0, this.currentIndex + 1);

        // Add new command
        this.history.push(command);
        this.currentIndex++;

        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Command added to history, history size now:', this.history.length);
        }

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    // Undo last action
    undo() {
        if (this.currentIndex < 0) return;

        this.isExecuting = true;
        const command = this.history[this.currentIndex];
        
        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Undoing command:', {
                type: command.type,
                index: this.currentIndex,
                data: command.data
            });
        }
        
        try {
            if (command.type === 'batch') {
                if (window.DEBUG_UNDO) {
                    console.log('UNDO DEBUG: Undoing batch with commands:', command.data.commands.map(c => c.type));
                }
                // Undo batch commands in reverse order
                for (let i = command.data.commands.length - 1; i >= 0; i--) {
                    this.executeUndo(command.data.commands[i]);
                }
            } else {
                this.executeUndo(command);
            }
            this.currentIndex--;
        } finally {
            this.isExecuting = false;
        }
    }

    // Redo last undone action
    redo() {
        if (this.currentIndex >= this.history.length - 1) return;

        this.isExecuting = true;
        this.currentIndex++;
        const command = this.history[this.currentIndex];
        
        if (window.DEBUG_UNDO) {
            console.log('UNDO DEBUG: Redoing command:', {
                type: command.type,
                index: this.currentIndex,
                data: command.data
            });
        }
        
        try {
            if (command.type === 'batch') {
                if (window.DEBUG_UNDO) {
                    console.log('UNDO DEBUG: Redoing batch with commands:', command.data.commands.map(c => c.type));
                }
                // Redo batch commands in original order
                for (const cmd of command.data.commands) {
                    this.executeRedo(cmd);
                }
            } else {
                this.executeRedo(command);
            }
        } finally {
            this.isExecuting = false;
        }
    }

    // Execute undo for specific command type
    executeUndo(command) {
        switch (command.type) {
            case 'create':
                this.undoCreate(command.data);
                break;
            case 'delete':
                this.undoDelete(command.data);
                break;
            case 'move':
                this.undoMove(command.data);
                break;
            case 'resize':
                this.undoResize(command.data);
                break;
            case 'group':
                this.undoGroup(command.data);
                break;
            case 'extract':
                this.undoExtract(command.data);
                break;
            case 'content':
                this.undoContentChange(command.data);
                break;
        }
    }

    // Execute redo for specific command type
    executeRedo(command) {
        switch (command.type) {
            case 'create':
                this.redoCreate(command.data);
                break;
            case 'delete':
                this.redoDelete(command.data);
                break;
            case 'move':
                this.redoMove(command.data);
                break;
            case 'resize':
                this.redoResize(command.data);
                break;
            case 'group':
                this.redoGroup(command.data);
                break;
            case 'extract':
                this.redoExtract(command.data);
                break;
            case 'content':
                this.redoContentChange(command.data);
                break;
        }
    }

    // Undo element creation
    undoCreate(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            element.remove();
        }
    }

    // Redo element creation
    redoCreate(data) {
        const element = this.recreateElement(data.elementState);
        const container = document.getElementById(data.containerId) || canvas;
        
        // Insert at correct position
        this.insertElementInContainer(element, data.elementState, container);
        
        // Setup behaviors
        this.setupElementBehaviors(element, data.elementState);
        
        // Restore selection if it was selected
        if (data.wasSelected) {
            window.selectElement(element, false);
        }
    }

    // Undo element deletion
    undoDelete(data) {
        // Sort elements by their DOM position for proper restoration order
        // Static elements should be restored in their original document order
        const sortedElements = [...data.elements].sort((a, b) => {
            // If both are static elements in the same container, use DOM order hints
            if (!a.state.isFreeFloating && !b.state.isFreeFloating && 
                a.containerId === b.containerId) {
                // Use positioning data if available
                if (a.state.positioning && b.state.positioning) {
                    return a.state.positioning.canvasY - b.state.positioning.canvasY;
                }
            }
            // For mixed types or different containers, preserve original order
            return 0;
        });
        
        // Recreate all deleted elements in proper order
        for (const elementData of sortedElements) {
            const element = this.recreateElement(elementData.state);
            const container = document.getElementById(elementData.containerId) || canvas;
            
            // For static elements in frames, try to restore HTML flow structure
            if (!elementData.state.isFreeFloating && 
                container.classList && container.classList.contains('frame-content')) {
                this.restoreStaticElementInFrame(element, elementData.state, container, elementData.contextData);
            } else {
                // Insert at correct position using standard method
                this.insertElementInContainer(element, elementData.state, container);
            }
            
            // Setup behaviors
            this.setupElementBehaviors(element, elementData.state);
            
            // Restore selection state
            if (elementData.wasSelected) {
                window.selectElement(element, true);
            }
        }
    }

    // Redo element deletion
    redoDelete(data) {
        for (const elementData of data.elements) {
            const element = document.getElementById(elementData.state.id);
            if (element) {
                element.remove();
            }
        }
    }

    // Undo movement
    undoMove(data) {
        for (const move of data.moves) {
            const element = document.getElementById(move.elementId);
            if (element) {
                const oldContainer = document.getElementById(move.oldContainerId) || canvas;
                const currentContainer = element.parentElement;
                
                // If container changed, restore to old container first
                if (move.oldContainerId !== move.newContainerId) {
                    // For static elements, use DOM insertion helpers to restore flow position
                    if (move.oldElementState && !move.oldElementState.isFreeFloating) {
                        this.insertElementInContainer(element, move.oldElementState, oldContainer);
                    } else {
                        oldContainer.appendChild(element);
                    }
                }
                
                // Restore exact position - prioritize the oldElementState positioning data
                let positionRestored = false;
                
                if (move.oldElementState && move.oldElementState.positioning) {
                    const relativeLeft = move.oldElementState.positioning.relativeLeft;
                    const relativeTop = move.oldElementState.positioning.relativeTop;
                    
                    if (relativeLeft && relativeTop) {
                        if (window.DEBUG_UNDO) {
                            console.log('UNDO DEBUG: Setting position from oldElementState positioning', {
                                relativeLeft: relativeLeft,
                                relativeTop: relativeTop,
                                containerId: move.oldContainerId
                            });
                        }
                        
                        element.style.left = relativeLeft;
                        element.style.top = relativeTop;
                        positionRestored = true;
                    }
                }
                
                // Fallback to oldPosition if no positioning data
                if (!positionRestored) {
                    if (window.DEBUG_UNDO) {
                        console.log('UNDO DEBUG: Setting position from oldPosition fallback', move.oldPosition);
                    }
                    element.style.left = move.oldPosition.left;
                    element.style.top = move.oldPosition.top;
                }
                
                // For static elements that were in document flow, clear positioning
                if (move.oldElementState && !move.oldElementState.isFreeFloating && 
                    move.oldElementState.computedPosition === 'static') {
                    element.style.position = '';
                    element.style.left = '';
                    element.style.top = '';
                }
            }
        }
    }

    // Redo movement
    redoMove(data) {
        for (const move of data.moves) {
            const element = document.getElementById(move.elementId);
            if (element) {
                if (window.DEBUG_UNDO) {
                    console.log('REDO DEBUG: Moving element', {
                        elementId: move.elementId,
                        from: move.oldContainerId,
                        to: move.newContainerId,
                        oldPos: move.oldPosition,
                        newPos: move.newPosition,
                        hasNewState: !!move.newElementState
                    });
                }
                
                const newContainer = document.getElementById(move.newContainerId) || canvas;
                
                // If container changed, move to new container first
                if (move.oldContainerId !== move.newContainerId) {
                    if (window.DEBUG_UNDO) {
                        console.log('REDO DEBUG: Container change detected, moving to', move.newContainerId);
                    }
                    
                    // For static elements, use DOM insertion helpers
                    if (move.newElementState && !move.newElementState.isFreeFloating) {
                        this.insertElementInContainer(element, move.newElementState, newContainer);
                    } else {
                        newContainer.appendChild(element);
                    }
                }
                
                // Restore exact position - prioritize the newElementState positioning data
                let positionRestored = false;
                
                if (move.newElementState && move.newElementState.positioning) {
                    // Use the stored relative position which should be accurate to the container
                    const relativeLeft = move.newElementState.positioning.relativeLeft;
                    const relativeTop = move.newElementState.positioning.relativeTop;
                    
                    if (relativeLeft && relativeTop) {
                        if (window.DEBUG_UNDO) {
                            console.log('REDO DEBUG: Setting position from newElementState positioning', {
                                relativeLeft: relativeLeft,
                                relativeTop: relativeTop,
                                containerId: move.newContainerId
                            });
                        }
                        
                        element.style.left = relativeLeft;
                        element.style.top = relativeTop;
                        positionRestored = true;
                    }
                }
                
                // Fallback to newPosition if no positioning data
                if (!positionRestored) {
                    if (window.DEBUG_UNDO) {
                        console.log('REDO DEBUG: Setting position from newPosition fallback', move.newPosition);
                    }
                    element.style.left = move.newPosition.left;
                    element.style.top = move.newPosition.top;
                }
                
                // For static elements that should be in document flow, clear positioning
                if (move.newElementState && !move.newElementState.isFreeFloating && 
                    move.newElementState.computedPosition === 'static') {
                    if (window.DEBUG_UNDO) {
                        console.log('REDO DEBUG: Clearing positioning for static element');
                    }
                    element.style.position = '';
                    element.style.left = '';
                    element.style.top = '';
                }
            }
        }
    }

    // Undo resize
    undoResize(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            element.style.width = data.oldSize.width;
            element.style.height = data.oldSize.height;
            element.style.left = data.oldPosition.left;
            element.style.top = data.oldPosition.top;
            
            // Restore container if changed
            if (data.oldContainerId !== data.newContainerId) {
                const oldContainer = document.getElementById(data.oldContainerId) || canvas;
                oldContainer.appendChild(element);
            }
        }
    }

    // Redo resize
    redoResize(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            element.style.width = data.newSize.width;
            element.style.height = data.newSize.height;
            element.style.left = data.newPosition.left;
            element.style.top = data.newPosition.top;
            
            // Restore container if changed
            if (data.oldContainerId !== data.newContainerId) {
                const newContainer = document.getElementById(data.newContainerId) || canvas;
                newContainer.appendChild(element);
            }
        }
    }

    // Undo grouping
    undoGroup(data) {
        const groupFrame = document.getElementById(data.groupId);
        if (groupFrame) {
            // Move elements back to their original containers
            for (const elementData of data.elements) {
                const element = document.getElementById(elementData.elementId);
                if (element) {
                    const originalContainer = document.getElementById(elementData.originalContainerId) || canvas;
                    originalContainer.appendChild(element);
                    element.style.left = elementData.originalPosition.left;
                    element.style.top = elementData.originalPosition.top;
                }
            }
            // Remove the group frame
            groupFrame.remove();
        }
    }

    // Redo grouping
    redoGroup(data) {
        // Recreate group frame
        const groupFrame = this.recreateElement(data.groupState);
        const container = document.getElementById(data.groupContainerId) || canvas;
        
        // Insert and setup group frame
        this.insertElementInContainer(groupFrame, data.groupState, container);
        this.setupElementBehaviors(groupFrame, data.groupState);
        
        // Move elements into group
        for (const elementData of data.elements) {
            const element = document.getElementById(elementData.elementId);
            if (element) {
                groupFrame.appendChild(element);
                element.style.left = elementData.groupPosition.left;
                element.style.top = elementData.groupPosition.top;
            }
        }
    }

    // Undo extraction
    undoExtract(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            // Restore original styles
            element.style.position = data.originalState.position;
            element.style.left = data.originalState.left;
            element.style.top = data.originalState.top;
            element.style.width = data.originalState.width;
            element.style.height = data.originalState.height;
            element.classList.remove('free-floating');
            
            // Remove resize handles
            element.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
            
            // Restore to original container
            const originalContainer = document.getElementById(data.originalContainerId);
            if (originalContainer) {
                originalContainer.appendChild(element);
            }
        }
    }

    // Redo extraction
    redoExtract(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            // Apply extracted state
            element.style.position = 'absolute';
            element.style.left = data.extractedState.left;
            element.style.top = data.extractedState.top;
            element.style.width = data.extractedState.width;
            element.style.height = data.extractedState.height;
            element.classList.add('free-floating');
            
            // Add to canvas
            canvas.appendChild(element);
            
            // Re-setup as free-floating
            window.setupFreeFloatingElement(element);
        }
    }

    // Undo content change
    undoContentChange(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            element.textContent = data.oldContent;
        }
    }

    // Redo content change
    redoContentChange(data) {
        const element = document.getElementById(data.elementId);
        if (element) {
            element.textContent = data.newContent;
        }
    }

    // Helper: Recreate element from saved state
    recreateElement(state) {
        const element = document.createElement(state.tagName);
        
        // Restore ID and classes
        element.id = state.id;
        element.className = state.className;
        
        // Restore content first (before positioning)
        if (state.innerHTML) {
            element.innerHTML = state.innerHTML;
        }
        if (state.textContent && !state.innerHTML) {
            element.textContent = state.textContent;
        }
        if (state.contentEditable) {
            element.contentEditable = state.contentEditable;
        }
        
        // Restore attributes
        for (const [key, value] of Object.entries(state.attributes || {})) {
            element.setAttribute(key, value);
        }
        
        // Handle positioning based on element type
        if (state.isFreeFloating || state.computedPosition === 'absolute') {
            // For free-floating elements, restore all positioning styles
            Object.assign(element.style, state.styles);
        } else {
            // For static elements, only restore non-positioning styles
            const positioningProps = ['position', 'left', 'top'];
            for (const [prop, value] of Object.entries(state.styles)) {
                if (!positioningProps.includes(prop) || 
                    (prop === 'position' && value !== 'absolute')) {
                    element.style[prop] = value;
                }
            }
            
            // Restore position if it was explicitly set and not absolute
            if (state.styles.position && state.styles.position !== 'absolute') {
                element.style.position = state.styles.position;
            }
        }
        
        return element;
    }
    
    // Helper: Insert element at correct DOM position
    insertElementInContainer(element, state, container) {
        // For static elements, try to restore DOM flow position
        if (!state.isFreeFloating && state.nextSiblingId) {
            const nextSibling = document.getElementById(state.nextSiblingId);
            if (nextSibling && nextSibling.parentElement === container) {
                container.insertBefore(element, nextSibling);
                return;
            }
        }
        
        if (!state.isFreeFloating && state.previousSiblingId) {
            const prevSibling = document.getElementById(state.previousSiblingId);
            if (prevSibling && prevSibling.parentElement === container) {
                const nextSibling = prevSibling.nextSibling;
                if (nextSibling) {
                    container.insertBefore(element, nextSibling);
                } else {
                    container.appendChild(element);
                }
                return;
            }
        }
        
        // Fallback: append to container
        container.appendChild(element);
    }
    
    // Helper: Restore static element in frame with special handling
    restoreStaticElementInFrame(element, state, frameContent, contextData = null) {
        // Try the standard insertion first
        this.insertElementInContainer(element, state, frameContent);
        
        // If insertion failed or element seems misplaced, try alternative approaches
        if (!element.parentElement || element.parentElement !== frameContent) {
            // Fallback 1: Try to insert based on DOM structure hints
            if (state.nextSiblingId) {
                const nextSibling = frameContent.querySelector(`#${state.nextSiblingId}`);
                if (nextSibling) {
                    frameContent.insertBefore(element, nextSibling);
                    return;
                }
            }
            
            if (state.previousSiblingId) {
                const prevSibling = frameContent.querySelector(`#${state.previousSiblingId}`);
                if (prevSibling) {
                    // Insert after the previous sibling
                    if (prevSibling.nextSibling) {
                        frameContent.insertBefore(element, prevSibling.nextSibling);
                    } else {
                        frameContent.appendChild(element);
                    }
                    return;
                }
            }
            
            // Fallback 2: Use context data if available
            if (contextData && contextData.indexInParent !== undefined) {
                const currentChildren = Array.from(frameContent.children);
                const targetIndex = Math.min(contextData.indexInParent, currentChildren.length);
                
                if (currentChildren[targetIndex]) {
                    frameContent.insertBefore(element, currentChildren[targetIndex]);
                    return;
                } else {
                    frameContent.appendChild(element);
                    return;
                }
            }
            
            // Fallback 3: Insert based on element type typical positions
            const tagName = element.tagName.toLowerCase();
            if (tagName === 'h3') {
                // Headers typically go at the beginning
                const firstChild = frameContent.firstElementChild;
                if (firstChild) {
                    frameContent.insertBefore(element, firstChild);
                } else {
                    frameContent.appendChild(element);
                }
            } else if (tagName === 'button') {
                // Buttons typically go at the end
                frameContent.appendChild(element);
            } else {
                // For other elements (p, etc.), try to insert in middle
                const children = Array.from(frameContent.children);
                const midpoint = Math.floor(children.length / 2);
                if (children[midpoint]) {
                    frameContent.insertBefore(element, children[midpoint]);
                } else {
                    frameContent.appendChild(element);
                }
            }
        }
    }

    // Helper: Setup element behaviors after recreation
    setupElementBehaviors(element, state) {
        // Re-setup behaviors based on element type
        if (element.classList.contains('frame')) {
            window.setupFrame(element);
        } else if (element.classList.contains('element-frame')) {
            window.setupElementFrame(element);
        } else if (element.classList.contains('free-floating') || state.isFreeFloating) {
            window.setupFreeFloatingElement(element);
        } else {
            // For static elements, make them selectable if they should be
            if (window.makeSelectable) {
                window.makeSelectable(element);
            }
        }
    }

    // Helper: Capture element state
    captureElementState(element) {
        const computedStyle = window.getComputedStyle(element);
        const container = element.parentElement;
        const canvasRect = canvas.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        return {
            id: element.id,
            tagName: element.tagName.toLowerCase(),
            className: element.className,
            styles: {
                position: element.style.position || computedStyle.position,
                left: element.style.left,
                top: element.style.top,
                width: element.style.width,
                height: element.style.height,
                zIndex: element.style.zIndex
            },
            attributes: this.captureAttributes(element),
            innerHTML: element.innerHTML,
            textContent: element.textContent,
            contentEditable: element.contentEditable,
            
            // Enhanced positioning data
            isFreeFloating: element.classList.contains('free-floating'),
            computedPosition: computedStyle.position,
            
            // DOM flow position for static elements
            nextSiblingId: element.nextSibling?.id || null,
            previousSiblingId: element.previousSibling?.id || null,
            
            // Container-aware coordinates
            positioning: this.capturePosition(element),
            
            // Container scroll state
            containerScrollLeft: container?.scrollLeft || 0,
            containerScrollTop: container?.scrollTop || 0
        };
    }
    
    // Helper: Capture position data for both static and absolute elements
    capturePosition(element) {
        const container = element.parentElement;
        if (!container) return null;
        
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        return {
            // Relative to container (for repositioning)
            relativeLeft: element.style.left,
            relativeTop: element.style.top,
            
            // Absolute canvas coordinates (for cross-container moves)
            canvasX: elementRect.left - canvasRect.left,
            canvasY: elementRect.top - canvasRect.top,
            
            // Element center for container detection
            centerX: elementRect.left + elementRect.width / 2,
            centerY: elementRect.top + elementRect.height / 2,
            
            // Container information
            containerRect: {
                left: containerRect.left,
                top: containerRect.top,
                width: containerRect.width,
                height: containerRect.height
            }
        };
    }

    // Helper: Capture element attributes
    captureAttributes(element) {
        const attrs = {};
        for (const attr of element.attributes) {
            if (attr.name !== 'id' && attr.name !== 'class' && attr.name !== 'style') {
                attrs[attr.name] = attr.value;
            }
        }
        return attrs;
    }
}

// Global undo manager instance
const undoManager = new UndoManager();

// Debug utilities for troubleshooting multi-element operations
// Usage: Open browser console and run:
//   enableUndoDebug()     - Enable detailed logging of all undo operations
//   inspectUndoHistory()  - Show current state of undo history
//   disableUndoDebug()    - Turn off debug logging
window.enableUndoDebug = () => {
    window.DEBUG_UNDO = true;
    console.log('Undo debug mode enabled. All undo operations will be logged.');
    console.log('Try performing multi-element operations, then run inspectUndoHistory() to see the command structure.');
};

window.disableUndoDebug = () => {
    window.DEBUG_UNDO = false;
    console.log('Undo debug mode disabled.');
};

window.inspectUndoHistory = () => {
    console.log('=== UNDO HISTORY INSPECTION ===');
    console.log('Current index:', undoManager.currentIndex);
    console.log('Total commands:', undoManager.history.length);
    console.log('Batch mode:', undoManager.batchMode);
    console.log('Current batch size:', undoManager.currentBatch.length);
    
    console.log('\nCommand history:');
    undoManager.history.forEach((cmd, index) => {
        const marker = index === undoManager.currentIndex ? ' <- CURRENT' : '';
        if (cmd.type === 'batch') {
            console.log(`${index}: BATCH (${cmd.data.commands.length} commands: ${cmd.data.commands.map(c => c.type).join(', ')})${marker}`);
        } else if (cmd.type === 'move') {
            console.log(`${index}: MOVE (${cmd.data.moves.length} elements)${marker}`);
        } else if (cmd.type === 'delete') {
            console.log(`${index}: DELETE (${cmd.data.elements.length} elements)${marker}`);
        } else {
            console.log(`${index}: ${cmd.type.toUpperCase()}${marker}`);
        }
    });
    console.log('=== END INSPECTION ===');
};

// Expose global functions
window.undoManager = undoManager;
window.recordCreate = (elementId, elementState, containerId, wasSelected = false) => {
    undoManager.addCommand(new Command('create', {
        elementId,
        elementState,
        containerId,
        wasSelected
    }));
};

window.recordDelete = (elements) => {
    const data = {
        elements: elements.map((element, index) => {
            const elementData = {
                state: undoManager.captureElementState(element),
                containerId: element.parentElement?.id || 'canvas',
                wasSelected: element.classList.contains('selected'),
                deletionIndex: index // Track deletion order for proper restoration
            };
            
            // For static elements, capture extra context for better restoration
            if (!element.classList.contains('free-floating')) {
                elementData.contextData = {
                    tagName: element.tagName.toLowerCase(),
                    innerHTML: element.innerHTML,
                    textContent: element.textContent,
                    // Capture surrounding elements for better positioning
                    parentClassName: element.parentElement?.className || '',
                    siblingCount: element.parentElement?.children.length || 0,
                    indexInParent: Array.from(element.parentElement?.children || []).indexOf(element)
                };
            }
            
            return elementData;
        })
    };
    undoManager.addCommand(new Command('delete', data));
};

window.recordMove = (moves) => {
    undoManager.addCommand(new Command('move', { moves }));
};

window.recordResize = (elementId, oldSize, newSize, oldPosition, newPosition, oldContainerId, newContainerId) => {
    undoManager.addCommand(new Command('resize', {
        elementId,
        oldSize,
        newSize,
        oldPosition,
        newPosition,
        oldContainerId,
        newContainerId
    }));
};

window.recordGroup = (groupId, groupState, groupContainerId, elements) => {
    undoManager.addCommand(new Command('group', {
        groupId,
        groupState,
        groupContainerId,
        elements
    }));
};

window.recordExtract = (elementId, originalState, extractedState, originalContainerId) => {
    undoManager.addCommand(new Command('extract', {
        elementId,
        originalState,
        extractedState,
        originalContainerId
    }));
};

window.recordContentChange = (elementId, oldContent, newContent) => {
    undoManager.addCommand(new Command('content', {
        elementId,
        oldContent,
        newContent
    }));
};