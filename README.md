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
- **Key relationships**: Coordinates with drag and selection modules to prevent interference

### Element Management

#### `js/element-creation.js`
**Purpose**: Creation and placement of new elements
- Factory functions for different element types (text, buttons, circles, lines, inputs, frames)
- Interactive placement mode with mouse following
- Drag-to-resize during initial placement
- Keyboard shortcuts (F, R, T, L/D, O, B, P) for quick element creation
- **Key relationships**: 
  - Uses zoom.js for coordinate calculations
  - Calls frame.js for frame creation
  - Integrates with resize.js for drag-to-resize functionality
  - Uses drag.js container detection for proper parent assignment

#### `js/frame.js`
**Purpose**: Frame and element-frame creation and management
- `createFrame()` - Creates full HTML frames with title bars and content areas
- `createElementFrame()` - Creates simple container frames for grouping elements
- Automatic setup of drag, resize, and extraction capabilities
- **Key relationships**: Called by element-creation.js and app.js

#### `js/extraction.js`
**Purpose**: Converting static elements to free-floating draggable elements
- Ctrl/Cmd + click to extract elements from frames
- Converts position from relative to absolute positioning
- Adds resize handles and drag capabilities to extracted elements
- Visual ghost feedback during extraction
- **Key relationships**: Integrates with drag.js and resize.js to enable full manipulation

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
- **Key relationships**: 
  - Uses zoom.js for coordinate transformation
  - Integrates with selection.js for multi-selection support
  - Leverages extraction.js logic for making static elements free-floating
  - Clones elements and re-establishes their drag/resize/selection capabilities
  - Prevents conflicts with pan.js and resize.js operations

#### `js/resize.js`
**Purpose**: Element resizing with 8-direction handles
- 8 resize handles (corners and edges) for precise control
- Drag-to-resize mode for element creation
- Container-aware resizing that moves elements between containers when appropriate
- Minimum size constraints (different for frames vs other elements)
- **Key relationships**: 
  - Uses selection.js for resize handle management
  - Coordinates with zoom.js for accurate sizing
  - Triggers container checks in drag.js system

#### `js/selection.js`
**Purpose**: Multi-element selection and visual feedback
- Single and multi-selection (Shift+click)
- Resize handle management for selected elements
- Visual selection indicators
- Automatic selection setup for new elements via MutationObserver
- **Key relationships**: Core system used by drag.js, resize.js, and marquee-selection.js

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

### Application Bootstrap

#### `js/app.js`
**Purpose**: Application initialization and global keyboard shortcuts
- Window load event handling
- Global keyboard shortcuts (Ctrl+N for new frames, Ctrl+0 for zoom reset, Backspace for deletion, **Ctrl+G for grouping**)
- Element deletion functionality with input field protection
- **Grouping functionality**: Wraps multiple selected elements in element-frame containers
- Coordinates the initialization of the entire application
- **Key relationships**: Orchestrates the other modules and provides entry point

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

This architecture allows modules to coordinate without tight coupling while maintaining clear separation of concerns.