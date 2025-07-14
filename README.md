# Interactive Canvas Builder

An interactive web-based canvas application that allows users to create, manipulate, and organize visual elements in a flexible workspace. This application provides a comprehensive set of tools for building interactive layouts with frames, elements, and nested containers.

## Architecture Overview

The application is built with a modular JavaScript architecture where each file handles a specific aspect of functionality. All modules communicate through global event listeners and shared state management.

### Core Files

#### `index.html`
The main HTML structure that defines:
- Canvas container (`#canvas`) - The main workspace
- Zoom indicator for displaying current zoom level
- Help text with keyboard shortcuts
- Sequential loading of JavaScript modules in dependency order

#### `styles.css`
Comprehensive CSS styling defining:
- Dark theme visual design
- Frame and element-frame styling with visual hierarchy
- Resize handle positioning and interaction states
- Selection states and marquee selection styling
- Performance optimizations (will-change properties)
- Responsive grid background pattern
- **Mode-specific styling**: Interactive mode hides selection indicators via `data-canvas-mode` attribute selectors

### Core Modules

#### `js/canvas.js`
**Purpose**: Core canvas initialization and z-index management
- Initializes the canvas with default frames
- Manages `frameCounter` for unique element IDs
- Provides `bringToFront()` function for z-index layering
- Serves as the foundation that other modules build upon

#### `js/zoom.js`
**Purpose**: Handles canvas zooming and coordinate transformation
- Mouse wheel zoom with Ctrl/Cmd modifier
- Zoom-to-mouse-point functionality for intuitive navigation
- Coordinate conversion between screen space and canvas space
- Pan support integrated with zoom transforms
- Global `window.canvasZoom` API for other modules
- **Key relationships**: Used by drag, resize, and element-creation modules for coordinate calculations

#### `js/pan.js`
**Purpose**: Canvas panning with spacebar + mouse drag
- Spacebar hold detection for pan mode
- Mouse drag panning with visual feedback
- Integration with zoom system for accurate positioning
- Global `window.isPanning` state for preventing conflicts
- **Text editing awareness**: Disables space key interception when text is being edited
- **Key relationships**: 
  - Coordinates with drag and selection modules to prevent interference
  - Checks `window.textEditing` state to allow normal space key typing during edit mode

### Element Management

#### `js/element-creation.js`
**Purpose**: Creation and placement of new elements
- Factory functions for different element types (text, buttons, circles, lines, inputs, frames)
- Interactive placement mode with mouse following
- Drag-to-resize during initial placement
- Keyboard shortcuts (F, R, T, L/D, O, B, P) for quick element creation
- **Text elements**: Created with `contentEditable=false` by default (edit mode activated via double-click)
- **Key relationships**: 
  - Uses zoom.js for coordinate calculations
  - Calls frame.js for frame creation
  - Integrates with resize.js for drag-to-resize functionality
  - Uses drag.js container detection for proper parent assignment
  - Text elements rely on text-editing.js for inline editing functionality

#### `js/frame.js`
**Purpose**: Frame and element-frame creation and management
- `createFrame()` - Creates full HTML frames with title bars and content areas
- `createElementFrame()` - Creates simple container frames for grouping elements
- Automatic setup of drag, resize, and extraction capabilities
- **Static element tracking**: MutationObserver assigns unique IDs to all static elements
- **Content change detection**: Tracks text modifications in static elements (pauses during active editing)
- **Key relationships**: 
  - Called by element-creation.js and app.js
  - Provides ID tracking for undo.js
  - Coordinates with text-editing.js to avoid duplicate content change recording

#### `js/extraction.js`
**Purpose**: Converting static elements to free-floating draggable elements
- Ctrl/Cmd + click to extract elements from frames
- Converts position from relative to absolute positioning
- Adds resize handles and drag capabilities to extracted elements
- Visual ghost feedback during extraction
- **Undo support**: Records extraction state for reversal
- **Key relationships**: Integrates with drag.js and resize.js, records to undo.js

### Interaction Systems

#### `js/drag.js`
**Purpose**: Comprehensive dragging system for all element types
- Frame dragging with title bar interaction
- Free-floating element dragging with container detection
- Automatic container switching when elements are dragged between containers
- Multi-selection group dragging with relative positioning maintained
- **Option/Alt+drag duplication**: Creates duplicates that follow mouse, with abort capability
- **Cmd+Option+Alt+drag extraction**: Duplicates static elements as free-floating elements
- Zoom-aware coordinate calculations
- **Text editing check**: Prevents dragging when elements are in edit mode
- **Undo/Redo support**: Records all movements with complete state capture
- **Key relationships**: 
  - Uses zoom.js for coordinate transformation
  - Integrates with selection.js for multi-selection support
  - Leverages extraction.js logic for making static elements free-floating
  - Records movements to undo.js with position and container tracking
  - Prevents conflicts with pan.js and resize.js operations
  - Checks `window.textEditing.isEditing()` to prevent drag during text edit

#### `js/resize.js`
**Purpose**: Element resizing with 8-direction handles
- 8 resize handles (corners and edges) for precise control
- Drag-to-resize mode for element creation
- Container-aware resizing that moves elements between containers when appropriate
- Minimum size constraints (different for frames vs other elements)
- **Undo support**: Records size and position changes with container tracking
- **Key relationships**: 
  - Uses selection.js for resize handle management
  - Coordinates with zoom.js for accurate sizing
  - Records resize operations to undo.js
  - Triggers container checks in drag.js system

#### `js/selection.js`
**Purpose**: Multi-element selection and visual feedback
- Single and multi-selection (Shift+click)
- Resize handle management for selected elements
- Visual selection indicators
- Automatic selection setup for new elements via MutationObserver
- **Key relationships**: Core system used by drag.js, resize.js, and marquee-selection.js

#### `js/text-editing.js`
**Purpose**: Inline text editing for all text elements
- **Double-click to edit**: Activates edit mode for any text element (h1-h6, p, div.text-element, etc.)
- **Smart element detection**: Identifies editable text elements while excluding containers and interactive elements
- **Mode management**: Toggles contentEditable dynamically, preventing conflicts with drag operations
- **Visual feedback**: Adds blue outline and light background during edit mode
- **Click-outside to exit**: Automatically exits edit mode when clicking elsewhere
- **Undo integration**: Captures complete text edits (original → final content) as single undo operations
- **Key relationships**:
  - Coordinates with drag.js to prevent dragging during edit mode
  - Integrates with pan.js to allow space key typing when editing (disables space+drag pan)
  - Uses MutationObserver to ensure new text elements start with contentEditable=false
  - Records content changes to undo.js when exiting edit mode (if content changed)
  - Provides global API (`window.textEditing`) for other modules to check edit state

#### `js/marquee-selection.js`
**Purpose**: Rectangle-based multi-selection
- Click and drag rectangle selection on empty canvas
- Real-time preview of elements that will be selected
- Different selection rules for containers vs standalone elements
- Integration with existing selection system
- **Key relationships**: 
  - Extends selection.js functionality
  - Coordinates with pan.js to prevent conflicts
  - Uses element detection from drag.js system

### State Management Systems

#### `js/undo.js` 
**Purpose**: Comprehensive undo/redo system using Command pattern
- **Command Pattern implementation**: Records all canvas operations as reversible commands
- **Batch operations**: Groups multi-element actions (move, delete) as single undo units
- **State capture**: Complete DOM state preservation including positioning, content, and hierarchy
- **Container-aware restoration**: Handles cross-container moves with accurate coordinate conversion
- **Static element support**: Tracks document flow positioning for proper restoration
- **Content change support**: Records and reverses text content modifications
- **Debug utilities**: `enableUndoDebug()`, `inspectUndoHistory()` for troubleshooting
- **Key relationships**:
  - Integrates with drag.js for movement tracking
  - Records operations from app.js (delete, group), resize.js, extraction.js
  - Records text edits from text-editing.js as complete content changes
  - Works with frame.js MutationObserver to track static elements (skips during active editing)

### Application Bootstrap

#### `js/app.js`
**Purpose**: Application initialization and global keyboard shortcuts
- Window load event handling
- Global keyboard shortcuts:
  - **Ctrl+Z / Shift+Ctrl+Z**: Undo/Redo operations
  - Ctrl+N for new frames, Ctrl+0 for zoom reset
  - Backspace for deletion (with undo recording)
  - **Ctrl+G for grouping** (with undo recording)
- Element deletion functionality with input field protection
- **Grouping functionality**: Wraps multiple selected elements in element-frame containers
- Coordinates the initialization of the entire application
- **Key relationships**: Orchestrates the other modules and provides entry point

#### `js/mode-manager.js`
**Purpose**: Canvas mode switching between edit and interactive modes
- **Edit Mode**: Default mode for creating, selecting, and manipulating elements
- **Interactive Mode**: Allows interaction with button onclick handlers and input fields
- **Mode Toggle UI**: Checkbox switch in top-right corner for quick mode changes
- **Visual Feedback**: CSS-driven hiding of selection indicators in interactive mode
- **Key relationships**: 
  - Modifies canvas container's `data-canvas-mode` attribute
  - CSS rules in styles.css respond to mode changes
  - Preserves element selection state across mode transitions

## Element Hierarchy and Types

### Frames
- **Full Frames**: Complete UI containers with title bars and content areas
- **Element-Frames**: Simple container divs for grouping related elements
- Both types can contain free-floating elements and other nested containers

### Free-Floating Elements
- **Text Elements**: Editable text with contentEditable
- **Buttons**: Interactive buttons with click handlers
- **Input Elements**: Text inputs wrapped in containers for resize handle support
- **Lines**: Simple divider elements
- **Circles**: Circular visual elements
- All free-floating elements can be dragged, resized, and moved between containers

## Key Interaction Patterns

### Mode Switching
1. **Edit Mode** (default): Full canvas editing capabilities
   - Element creation, selection, dragging, resizing
   - All keyboard shortcuts active
   - Selection indicators visible (blue outlines, resize handles)
2. **Interactive Mode**: Test interactive elements
   - Button onclick handlers execute
   - Input fields accept focus and text
   - Selection indicators hidden for clean interaction
   - Toggle via checkbox in top-right corner

### Creation Workflow
1. Press keyboard shortcut (F, R, T, etc.) to enter placement mode
2. Move mouse to position element
3. Click to place, or click+drag to place and size simultaneously
4. Element automatically gets resize handles and drag capabilities

### Extraction Workflow
1. Ctrl/Cmd + click on any element inside a frame
2. Element converts from static to free-floating
3. Immediately becomes draggable and resizable
4. Can be moved to other containers

### Multi-Selection Workflow
1. Shift+click elements to add to selection
2. Marquee select by dragging rectangle on empty canvas
3. All selected elements move together during drag operations
4. **Cmd/Ctrl + G**: Group selected elements into element-frame container

### Drag Duplication Workflow
1. Select element(s) using any selection method
2. **Option/Alt + drag**: Duplicates free-floating elements (frames, element-frames, extracted elements)
3. **Cmd/Ctrl + Option/Alt + drag**: Duplicates static elements AND makes them free-floating (extraction+duplication)
4. Duplicates are created and immediately dragged
5. **Keep duplicates**: Release mouse while holding modifier keys
6. **Cancel operation**: Release Option/Alt before mouse-up (aborts drag, deletes duplicates)

### Text Editing Workflow
1. **Double-click** any text element (h1-h6, p, div.text-element, etc.) to enter edit mode
2. Element shows blue outline and light background when editing
3. Type, select, delete text as needed - space key works normally
4. **Click outside** the element or press **Escape/Enter** to exit edit mode
5. Dragging is disabled while editing to prevent accidental moves

### Deletion Workflow
1. Select any element(s) using single-click, shift+click, or marquee selection
2. Press Backspace to delete all selected elements
3. Deletion is protected when typing in input fields or contentEditable elements

### Container Management
- Elements automatically switch containers when dragged over new parents
- Frame resizing triggers automatic container reassignment for contained elements
- Zoom and pan operations maintain relative positioning

## Performance Optimizations

- **will-change CSS properties** for smooth animations during drag/resize/zoom
- **Event capture and delegation** for efficient event handling
- **Coordinate caching** during drag operations
- **Mutation observers** for automatic element setup without manual registration

## Global State Management

The application uses a distributed state management approach where each module exposes necessary functions and state through the `window` object:

- `window.canvasZoom` - Zoom and coordinate utilities
- `window.isPanning` - Pan state
- `window.selectElement`, `window.getSelectedElements` - Selection management
- `window.isResizing`, `window.isInPlacementMode` - Operation state flags
- `window.undoManager` - Undo/redo system instance
- `window.recordCreate`, `window.recordDelete`, `window.recordMove`, etc. - Operation recording functions
- `window.textEditing` - Text editing state and utilities (isEditing, getCurrentlyEditingElement)
- `window.canvasMode` - Current mode state ('edit' or 'interactive')

This architecture allows modules to coordinate without tight coupling while maintaining clear separation of concerns.

## Technical Considerations for Undo/Redo

### Multi-Element Operations
- **Batching**: Multi-element moves and deletes are recorded as single commands, not wrapped in additional batch containers
- **Container Changes**: Position recording happens AFTER container changes to ensure accurate coordinate capture
- **State Capture**: Complete DOM state including positioning data, styles, and hierarchy is preserved

### Text Editing Integration
- **Complete Edit Tracking**: Text changes from enter → edit → exit are recorded as single undo operations
- **Duplicate Prevention**: MutationObserver pauses characterData tracking during active editing
- **Content Comparison**: Only records changes when text actually differs from original

### Cross-Container Movement
- **Coordinate Systems**: Positions are stored relative to containers, with fallback absolute coordinates
- **Static Elements**: Document flow positioning is tracked using sibling IDs and insertion hints
- **Restoration**: Elements return to exact positions even after complex cross-container operations

### Debug Utilities
```javascript
enableUndoDebug()     // Enable detailed console logging
inspectUndoHistory()  // View command history structure
disableUndoDebug()    // Turn off debug logging
```