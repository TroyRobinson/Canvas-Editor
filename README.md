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

#### `js/comment-manager.js`
**Purpose**: HTML comment visualization with interactive bubbles and Comment Mode editing
- **Comment Detection**: Scans for HTML comment nodes (`<!-- comment -->`) in all elements
- **Visual Indicators**: Blue bubble (💬) positioned outside element boundaries (only shown for elements with existing comments)
- **Comment Mode**: Press `C` key to toggle Comment Mode with visual chip indicator
- **Interactive Editing**: In Comment Mode, click any element to add/edit comments via editable textarea popover
- **Unified Storage**: All elements, including buttons and inputs, store comments using HTML comment nodes
- **Comment Isolation**: Parent frame comments and child element comments remain independent
- **Bubble Interaction**: Click bubbles to show same editable popover as clicking the element
- **Drag/Resize Tracking**: Bubbles smoothly follow elements during operations
- **Key relationships**:
  - Integrates with mode-manager.js for Comment Mode state and JS interception bypass
  - Integrates with selection.js for element selection on bubble/element click
  - Uses fixed positioning to avoid affecting document flow
  - Coordinates with zoom/pan systems for proper positioning
  - Records comment changes to undo.js system

#### `js/iframe-manager.js`
**Purpose**: Iframe-based interactive mode previews with script isolation
- **Preview Creation**: Creates same-origin iframes for frame content during interactive mode
- **Perfect Positioning**: Positions iframes to overlay frame content areas exactly
- **CSS Injection**: Injects global CSS into iframe documents for consistent styling
- **Script Activation**: Manual script activation in iframe context with fallback handling
- **Lifecycle Management**: Complete iframe creation, positioning, show/hide, and cleanup
- **Key relationships**:
  - Used by mode-manager.js for interactive mode implementation
  - Uses css-manager.js for CSS injection into iframes
  - Eliminates need for complex script cleanup in other modules

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
- **⚠️ Event Priority**: Exposes `window.isInPlacementMode()` - ALL event handlers must check this before calling `stopPropagation()` to prevent interference with element placement precision
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
- **Default script/style tags**: All frames include empty `<style>` and `<script>` tags at bottom of frame-content
- **Smart element insertion**: New elements are inserted before script/style tags to maintain code template position
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

#### `js/auto-layout.js`
**Purpose**: Flexbox auto-layout conversion for absolutely positioned children
- **Shift + A**: Apply auto-layout to selected container (converts to flexbox while preserving the container's original width and height)
- Detects dominant orientation by where most elements are positioned
- Converts elements into a single horizontal row or vertical column with no outliers
- Calculates padding from the space above and left of the upper-left element
- Integrates with drag.js so dropped items join the container's flex flow and elements can be reordered by dragging within the container

#### `js/edge-detection.js`
**Purpose**: Intelligent resize detection system with extended hit zones
- **Smart Edge Detection**: Adaptive thresholds based on element size and zoom level
- **Extended Hit Zones**: 8px buffer zones outside element boundaries for easier targeting
- **Global Event Handling**: Document-level event capture for external zone interactions
- **Dynamic Cursor Feedback**: Real-time cursor changes based on mouse position over resize zones
- **Zoom Compatibility**: All detection scales correctly with canvas zoom levels
- **Performance Optimized**: Zero DOM elements, minimal computational overhead
- **Key relationships**: 
  - Integrated with selection.js for automatic setup on selected elements
  - Coordinates with drag.js to prevent conflicts between resize and drag operations
  - Works with resize.js to initiate resize operations from edge/corner detection
  - Provides global API for other modules to check resize zones and capabilities

### Interaction Systems

#### `js/drag.js`
**Purpose**: Comprehensive dragging system for all element types
- Frame dragging with title bar interaction
- Free-floating element dragging with container detection
- Automatic container switching when elements are dragged between containers
- Elements dropped into flex auto-layout containers join the container's flow
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
    - Elements dropped into flex auto-layout containers automatically join the flow

#### `js/resize.js`
**Purpose**: Element resizing with intelligent edge detection system
- **Edge Detection**: No DOM handles - detects resize operations via element border clicks
- **Extended Hit Zones**: 8px buffer outside element boundaries for easier targeting
- **8-Direction Resize**: Corners (nw, ne, sw, se) and edges (n, s, e, w) with adaptive thresholds
- **Drag-to-resize mode** for element creation
- **Container-aware resizing** that moves elements between containers when appropriate
- **Minimum size constraints** (different for frames vs other elements)
- **Auto-fit text**: Double-click corners to resize text elements to fit content
- **Undo support**: Records size and position changes with container tracking
- **Key relationships**: 
  - Uses edge-detection.js for resize initiation
  - Coordinates with zoom.js for accurate sizing
  - Records resize operations to undo.js
  - Triggers container checks in drag.js system
  - Integrates with text-editing.js to determine if an element is a text element for the resize-to-fit-content feature.

#### `js/selection.js`
**Purpose**: Multi-element selection with high-performance CSS-only visual feedback
- **Selection Management**: Single and multi-selection (Shift+click) with instant visual updates
- **CSS-Only Indicators**: Pure CSS selection outlines and corner indicators eliminate DOM manipulation
- **Edge Detection Integration**: Automatic setup of intelligent resize zones for selected elements
- **Visual Feedback**: Consistent selection indicators with hover effects for discoverability
- **Element Setup**: Automatic selection setup for new elements via MutationObserver
- **Key relationships**: Core system used by drag.js, edge-detection.js, and marquee-selection.js
  - **Instant refresh**: `selectionChanged` events trigger immediate CSS class updates
  - **Manual refresh**: `window.refreshSelectionVisuals()` for DOM mutations, undo/redo, text editing
  - **Performance optimized**: ~99% reduction in DOM operations compared to handle-based systems

#### `js/text-editing.js`
**Purpose**: Inline text editing for all text elements
- **Double-click to edit**: Activates edit mode for any text element (h1-h6, p, div.text-element, etc.)
- **Smart element detection**: Identifies editable text elements while excluding containers and interactive elements
- **Mode management**: Toggles contentEditable dynamically, preventing conflicts with drag operations
- **Visual feedback**: Adds blue outline and light background during edit mode
- **Click-outside to exit**: Automatically exits edit mode when clicking elsewhere
- **Space handling fixes**: Prevents default button behavior on spacebar, uses CSS `white-space: pre-wrap` for proper space preservation, and normalizes HTML formatting whitespace when entering edit mode
- **Undo integration**: Captures complete text edits (original → final content) as single undo operations
- **Key relationships**:
  - Coordinates with drag.js to prevent dragging during edit mode
  - Integrates with pan.js to allow space key typing when editing (disables space+drag pan)
  - Uses MutationObserver to ensure new text elements start with contentEditable=false
  - Records content changes to undo.js when exiting edit mode (if content changed)
  - Selection overlay restoration: On exiting edit mode, calls `window.refreshSelectionVisuals()` to ensure that, if the edited element remains selected, its selection overlay (resize handles) is restored.
  - Provides global API (`window.textEditing`) for other modules to check edit state.
    - E.g. exposes isTextLikeElement utility globally for use by other modules (e.g., resize.js, selection.js)

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
  - **Ctrl+R**: AI-powered frame enhancement (works even during text editing)
  - **C**: Toggle Comment Mode for adding/editing element comments
  - Ctrl+N for new frames, Ctrl+0 for zoom reset
  - Backspace for deletion (with undo recording)
  - **Ctrl+G for grouping** (with undo recording)
- Element deletion functionality with input field protection
- **Grouping functionality**: Wraps multiple selected elements in element-frame containers
- Coordinates the initialization of the entire application
- **Key relationships**: Orchestrates the other modules and provides entry point

#### `js/mode-manager.js`
**Purpose**: Canvas mode switching between edit and interactive modes using iframe isolation, plus Comment Mode management
- **Edit Mode**: Default mode for creating, selecting, and manipulating elements (no script execution)
- **Interactive Mode**: Creates isolated iframe previews where scripts execute safely
- **Comment Mode**: Independent mode for adding/editing HTML comments on any element
- **Iframe Isolation**: Complete separation - scripts run only in iframes, never in edit mode
- **Visual Continuity**: Frame title bars and borders remain visible during interactive mode
- **Mode Toggle UI**: Checkbox switch in top-right corner for interactive mode, "Comment Mode" chip for comment mode
- **Escape Shortcuts**: `Esc` exits interactive mode back to edit mode, or leaves Comment Mode when nothing is selected
- **JS Interception**: Prevents interactive element clicks in edit mode, but allows them in comment mode
- **Key relationships**:
  - Uses iframe-manager.js for iframe creation and positioning
  - Uses css-manager.js for injecting styles into iframes
  - Coordinates with comment-manager.js for Comment Mode state
  - Modifies canvas container's `data-canvas-mode` and `data-comment-mode` attributes

#### `js/css-manager.js`
**Purpose**: Centralized CSS loading, persistence, application, and iframe injection
- **CSS State Management**: Manages global CSS content, edit state, and dynamic style element
- **Embedded CSS Loading**: Loads initial CSS from embedded script tag to avoid CORS issues
- **Live CSS Application**: Real-time CSS updates via dynamic `<style>` element
- **Iframe CSS Injection**: Injects global CSS into iframe documents for interactive mode
- **Key relationships**:
  - Used by code-editor.js for CSS operations
  - Used by iframe-manager.js for injecting CSS into iframe previews

#### `js/script-manager.js` (Simplified)
**Purpose**: Minimal script activation for edit mode (CSS only)
- **Edit Mode**: Scripts disabled - only CSS styles activated for visual editing
- **Interactive Mode**: Scripts execute in iframe isolation (handled by iframe-manager.js)
- **Elimination**: Removed complex event handler cleanup, element cloning, and cross-container reactivation
- **Key relationships**:
  - No longer called by drag.js or resize.js (no cleanup needed)
  - Minimal activation for CSS-only editing experience

#### `js/llm-manager.js`
**Purpose**: AI-powered code enhancement via OpenRouter API with multiple enhancement modes
- **Three Enhancement Modes**: Standard (Ctrl+R), Custom Message (replacing), and Edit Message (editing)
- **Smart HTML Processing**: Strips existing code for replacing mode, preserves for editing mode
- **Custom Message Support**: Accepts user-provided enhancement instructions via Chat/History tab
- **Event System**: Emits lifecycle events (started/completed/failed) with custom message and mode tracking
- **API Integration**: Uses OpenRouter with proper system/user message structure for token efficiency
- **Proper Cleanup**: Uses complete element replacement to prevent content accumulation between AI enhancements
- **Visual Feedback**: Shows loading spinner in frame title bar that moves with frame
- **Script Re-activation**: Automatically reactivates scripts after code insertion
- **Free-floating Element Recovery**: Re-establishes drag/resize/selection behaviors for extracted elements after AI generation
- **State Preservation**: Snapshots and restores element selectable/draggable state across AI regenerations to maintain user customizations
- **Key constraints for AI-generated code**:
  - No `DOMContentLoaded` events (scripts execute dynamically after page load)
  - Use `@keyframes` animations instead of CSS transitions (`.free-floating` has `transition: none !important`)
  - Append elements to frame content area, not `document.body`
  - Use container-scoped queries (`frameContent.querySelectorAll`), not `document.getElementById`
  - Use standardized `data-initialized` attribute pattern (system clears automatically before script execution)
  - Avoid manipulating Canvas system properties (`contenteditable`, `data-selectable`, etc.)
- **Key relationships**:
  - Uses llm-prompt.js for system/user prompt separation
  - Scripts execute in iframe isolation during interactive mode
  - Coordinates with selection.js to get selected frames
  - Follows same cleanup pattern as code-editor.js and mode-manager.js (element replacement not innerHTML)

#### `js/right-pane-manager.js`
**Purpose**: Manages right-side tabbed panel UI with resizing and visibility controls
- **Tab System**: Registers and manages multiple tabs (Code Editor, Chat/History, Settings/Context)
- **Toggle Button**: Circular menu button in top-right to open panel (hidden by default)
- **Close Button**: X button in tab header to close panel and show toggle button
- **Resizable Panel**: Drag border to resize, width persisted in localStorage
- **State Management**: Panel stays open/closed until user changes it
- **Tab Persistence**: Respects user-chosen tabs, only auto-switches when no explicit choice made
- **Key relationships**: Coordinates with code-editor.js, chat-history-tab.js, and settings-context-tab.js

#### `js/code-editor.js`
**Purpose**: Code editing tab within the right pane with bi-directional editing for HTML and CSS
- **HTML/CSS Mode Toggle**: Switch between editing element HTML and global CSS styles
- **Real-time Code View**: Shows exact HTML of selected elements (frame-content only for frames) OR global CSS with live updates
- **Automatic Code Application**: Changes apply automatically with 200ms debounce
- **Bi-directional Sync**: Code changes update canvas, canvas changes update code
- **CSS Global Editing**: Live CSS editing with immediate visual feedback across all canvas elements
- **Native Textarea Undo**: Standard Ctrl/Cmd+Z works within the code editor
- **Canvas Undo Integration**: Focus/blur snapshots create proper canvas undo entries
- **Multi-selection Support**: Shows combined code for multiple selected elements
- **Smart Mode Switching**: Auto-switches to HTML when selecting elements, only if panel is open
- **Key relationships**:
  - Registers as tab with right-pane-manager.js
  - Delegates CSS operations to css-manager.js
  - Listens to `selectionChanged` events from selection.js
  - Integrates with undo.js via `recordElementReplacement` for HTML structure changes
  - Delegates script activation to script-manager.js
  - Protected from canvas keyboard shortcuts when focused
  - Re-establishes element behaviors after code application

#### `js/chat-history-tab.js`
**Purpose**: Enhancement history tracking and custom message interface
- **Frame-Scoped History**: Shows enhancement requests for currently selected frame only (hidden when no frame selected)
- **Custom Message Input**: Text area for user-specified enhancement requests with fixed-height UI
- **Replacing/Editing Toggle**: Switch between code replacement and incremental editing modes (Editing default)
- **Real-time Status**: Displays processing, success, and error states with timestamps and mode indicators
- **Message Display**: History cards show custom messages prominently with frame reference below
- **Auto-filtering**: Dynamically updates when selecting different frames
- **Event Integration**: Listens to enhancement lifecycle events from llm-manager.js

#### `js/settings-context-tab.js`
**Purpose**: AI enhancement configuration interface with three-mode prompt templates
- **Three Prompt Templates**: No Message (Ctrl+R), With Message (replacing), and Edit Message (editing) modes
- **Full-width Textareas**: All prompt templates use consistent full-width styling like System Prompt
- **Mode Toggle**: Organized under "User Prompt Template" title for clear prompt type switching
- **API Configuration**: OpenRouter API key input with fallback to default key
- **Model Parameters**: Temperature, max tokens, model selection, and thinking tokens settings
- **LocalStorage Persistence**: Auto-saves all settings with 500ms debounce
- **Reset Functionality**: Restore all settings to hardcoded defaults with confirmation dialog

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

### Mode Switching (Iframe-Based)
1. **Edit Mode** (default): Clean content editing without script execution
   - Element creation, selection, dragging, resizing
   - All keyboard shortcuts active  
   - Selection indicators visible (blue outlines, resize handles)
   - Scripts disabled to prevent event handler conflicts
2. **Interactive Mode**: Isolated script testing via iframe previews
   - Scripts execute in iframe isolation
   - Frame title bars remain visible for context
   - Iframe positioned to overlay frame content exactly
   - Toggle via checkbox in top-right corner or Ctrl/Cmd+E

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

### Keyboard Duplication Workflow
1. Select element(s) using any selection method
2. **Ctrl/Cmd + D**: Duplicate selection in place
3. **Ctrl/Cmd + C**, then **Ctrl/Cmd + V**: Copy and paste selection
   - Pasting onto a free-floating element overlays the copy
   - Pasting inside a flex container inserts the copy after the current element respecting flex direction

### Size & Weight Shortcuts
1. **1-8**: Set text/button size for selected elements
2. **Shift + 1-8**: Set font weight for selected text or buttons
3. **Scroll**: Cycle through text/button size steps
4. **Shift + Scroll**: Cycle through font weight for selected text or buttons

### Text Editing Workflow
1. **Double-click** any text element (h1-h6, p, div.text-element, etc.) to enter edit mode
2. Element shows blue outline and light background when editing
3. Type, select, delete text as needed - space key works normally
4. **Click outside** the element or press **Escape/Enter** to exit edit mode
5. Dragging is disabled while editing to prevent accidental moves

### Right Pane & Code Editing Workflow
1. **Click toggle button** (top-right) → Opens right-side tabbed panel
2. **Select any element** → Switches to Code Editor tab if panel is open (HTML mode)
3. **Click canvas (no selection)** → Shows global CSS in Code Editor if panel is open (CSS mode)
4. **Toggle HTML/CSS modes** → Use buttons in code editor header to switch
5. **Type HTML/CSS changes** → Canvas updates automatically after 200ms pause
6. **Use Ctrl/Cmd+Z in code editor** → Instant undo/redo within editor (native browser behavior)
7. **Click on canvas or switch elements** → Code change recorded in canvas undo system
8. **Press Ctrl/Cmd+Z on canvas** → Reverts entire element to previous HTML state
9. **Click X button** → Closes panel, shows toggle button again
10. **Drag panel border** → Resize panel width (persisted)

### AI Enhancement with Custom Messages Workflow
1. **Select a frame** → Chat/History tab shows frame-specific enhancement history
2. **Choose enhancement mode** → Toggle between "Editing" (keeps existing code) and "Replacing" (starts fresh)
3. **Type custom message** → Describe desired functionality in the text area
4. **Press Enter or click send** → Triggers AI enhancement with custom instructions
5. **View history** → Custom messages appear prominently in history cards with frame reference
6. **Configure prompts** → Settings/Context tab has three prompt templates for different enhancement types

### Script Activation Workflow (Iframe-Based)
1. **Edit Mode**: Scripts are **not executed** - pure content editing without script interference
2. **Interactive Mode**: Scripts execute **only in iframe isolation** for safe testing
3. **Mode Switching**: Iframe creation uses current frame HTML with injected global CSS
4. **Script Isolation**: All user scripts run in iframe context, completely separated from Canvas editor
5. **Natural Cleanup**: Iframe destruction automatically cleans up all script event handlers
6. **Visual Continuity**: Frame title bars and borders remain visible during interactive preview

### Deletion Workflow
1. Select any element(s) using single-click, shift+click, or marquee selection
2. Press Backspace to delete all selected elements
3. Deletion is protected when typing in input fields or contentEditable elements

### Container Management
- Elements automatically switch containers when dragged over new parents
- Frame resizing triggers automatic container reassignment for contained elements
- Zoom and pan operations maintain relative positioning
- In flexbox containers created with **Shift + A**, child elements remain individually selectable, and dragging a child without Cmd/Ctrl reorders it within the flex flow

## Performance Optimizations

- **will-change CSS properties** for smooth animations during drag/resize/zoom
- **Event capture and delegation** for efficient event handling
- **Coordinate caching** during drag operations
- **Mutation observers** for automatic element setup without manual registration
- **Iframe isolation** eliminates complex script event handler cleanup (~350 lines removed)

## Global State Management

The application uses a distributed state management approach where each module exposes necessary functions and state through the `window` object:

- `window.canvasZoom` - Zoom and coordinate utilities
- `window.isPanning` - Pan state
- `window.selectElement`, `window.getSelectedElements` - Selection management
- `window.isResizing`, `window.isInPlacementMode` - Operation state flags
- `window.undoManager` - Undo/redo system instance
- `window.recordCreate`, `window.recordDelete`, `window.recordMove`, `window.recordElementReplacement`, etc. - Operation recording functions
- `window.textEditing` - Text editing state and utilities (isEditing, getCurrentlyEditingElement)
- `window.canvasMode` - Current mode state ('edit' or 'interactive')
- `window.rightPaneManager` - Right pane UI API (registerTab, switchToTab, show, hide, isVisible)
- `window.codeEditor` - Code editor tab API (show, hide, isActive, updateCodeView, showCSSEditor)
- `window.cssManager` - CSS management API (getCurrentCSS, updateCSS, hasBeenEdited, initialize, injectIntoIframe)
- `window.iframeManager` - Iframe preview API (createPreviewIframe, showIframe, hideIframe, destroyIframe, positionIframe)

This architecture allows modules to coordinate without tight coupling while maintaining clear separation of concerns.

## Technical Considerations for Undo/Redo

### Multi-Element Operations
- **Batching**: Multi-element moves and deletes are recorded as single commands, not wrapped in additional batch containers
- **Container Changes**: Position recording happens AFTER container changes to ensure accurate coordinate capture
- **State Capture**: Complete DOM state including positioning data, styles, and hierarchy is preserved

### HTML Structure Changes
- **Element Replacement**: Code editor changes use `recordElementReplacement` for complete HTML structure updates
- **Focus/Blur Snapshots**: Before/after HTML states captured on code editor focus and blur events
- **Native vs Canvas Undo**: Code editor supports native browser undo within textarea, plus canvas undo for complete element restoration

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