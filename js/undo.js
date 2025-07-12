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
        this.batchMode = true;
        this.currentBatch = [];
    }

    // End batch and add as single command
    endBatch() {
        if (this.currentBatch.length > 0) {
            const batchCommand = new Command('batch', {
                commands: this.currentBatch
            });
            this.addCommand(batchCommand);
        }
        this.batchMode = false;
        this.currentBatch = [];
    }

    // Add a command to history
    addCommand(command) {
        if (this.isExecuting) return;

        if (this.batchMode) {
            this.currentBatch.push(command);
            return;
        }

        // Remove any commands after current index
        this.history = this.history.slice(0, this.currentIndex + 1);

        // Add new command
        this.history.push(command);
        this.currentIndex++;

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
        
        try {
            if (command.type === 'batch') {
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
        
        try {
            if (command.type === 'batch') {
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
        container.appendChild(element);
        
        // Restore selection if it was selected
        if (data.wasSelected) {
            window.selectElement(element, false);
        }
    }

    // Undo element deletion
    undoDelete(data) {
        // Recreate all deleted elements
        for (const elementData of data.elements) {
            const element = this.recreateElement(elementData.state);
            const container = document.getElementById(elementData.containerId) || canvas;
            container.appendChild(element);
            
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
                element.style.left = move.oldPosition.left;
                element.style.top = move.oldPosition.top;
                
                // Restore container if changed
                if (move.oldContainerId !== move.newContainerId) {
                    const oldContainer = document.getElementById(move.oldContainerId) || canvas;
                    oldContainer.appendChild(element);
                }
            }
        }
    }

    // Redo movement
    redoMove(data) {
        for (const move of data.moves) {
            const element = document.getElementById(move.elementId);
            if (element) {
                element.style.left = move.newPosition.left;
                element.style.top = move.newPosition.top;
                
                // Restore container if changed
                if (move.oldContainerId !== move.newContainerId) {
                    const newContainer = document.getElementById(move.newContainerId) || canvas;
                    newContainer.appendChild(element);
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
        container.appendChild(groupFrame);
        
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

    // Helper: Recreate element from saved state
    recreateElement(state) {
        const element = document.createElement(state.tagName);
        
        // Restore ID and classes
        element.id = state.id;
        element.className = state.className;
        
        // Restore styles
        Object.assign(element.style, state.styles);
        
        // Restore attributes
        for (const [key, value] of Object.entries(state.attributes || {})) {
            element.setAttribute(key, value);
        }
        
        // Restore content
        if (state.innerHTML) {
            element.innerHTML = state.innerHTML;
        }
        
        // Re-setup behaviors based on element type
        if (element.classList.contains('frame')) {
            window.setupFrame(element);
        } else if (element.classList.contains('element-frame')) {
            window.setupElementFrame(element);
        } else if (element.classList.contains('free-floating')) {
            window.setupFreeFloatingElement(element);
        }
        
        return element;
    }

    // Helper: Capture element state
    captureElementState(element) {
        return {
            id: element.id,
            tagName: element.tagName.toLowerCase(),
            className: element.className,
            styles: {
                position: element.style.position,
                left: element.style.left,
                top: element.style.top,
                width: element.style.width,
                height: element.style.height,
                zIndex: element.style.zIndex
            },
            attributes: this.captureAttributes(element),
            innerHTML: element.innerHTML
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
        elements: elements.map(element => ({
            state: undoManager.captureElementState(element),
            containerId: element.parentElement?.id || 'canvas',
            wasSelected: element.classList.contains('selected')
        }))
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