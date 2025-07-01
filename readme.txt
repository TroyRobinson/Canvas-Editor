# Interactive Canvas Wireframing Tool: Complete Documentation

<overview>
A **single-page web application** for creating interactive wireframes with draggable frames, extractable elements, and advanced canvas manipulation features including zoom and pan functionality.
</overview>

## Core Architecture

<technical_foundation>
- **Single HTML page** with modular script sections organized like separate files
- **Dark theme** with viewport-filling canvas (`100vw`, `100vh`)
- **Grid background** pattern using CSS linear gradients
- **Global state management** for frame counter and z-index tracking
</technical_foundation>

## Frame System

### Core Features
- **Draggable frames** with title bars and content areas
  - Click anywhere on frame to drag (not just title bar)
  - Absolute positioning on canvas
  - **Z-index management**: Last dragged frame ALWAYS stays on top
  - Initial frames created on load with sample content

### Keyboard Controls
- **Cmd/Ctrl + N**: Creates new frame at random position

## Element Extraction System

<extraction_mechanics>
**CRITICAL**: Element extraction uses **Cmd/Ctrl + Click + Drag** in a single fluid motion

### How It Works
1. **Hold** Cmd/Ctrl key
2. **Click** on any element within a frame
3. **Drag** to extract and position the element
4. **Release** to drop the element in new location

### Behavior Details
- **Immediate conversion** to absolute positioning
- **Free-floating elements** become draggable WITHOUT modifier keys
- **Visual feedback**: Blue outline (`2px solid #3b82f6`) while dragging
- **Ghost element** follows mouse during extraction
- **Zoom-aware**: ALWAYS maintains proper positioning at all zoom levels
</extraction_mechanics>

## Drag & Drop Mechanics

### Core Principles
- **Parent-aware positioning**: Elements ALWAYS maintain position relative to current parent
- **Smart container detection**: Uses mouse position to find target container
- **Z-index-based priority**: Checks frames from highest to lowest z-index

### Technical Implementation
<drag_drop_details>
- **Proper drop positioning**: Element drops EXACTLY where mouse is released
- **Canvas bounds checking** for frames
- **Zoom corrections**:
  - Drag offset calculations account for current zoom level
  - Elements stay directly under mouse cursor at ALL zoom levels
  - Coordinate conversions between screen and canvas space
</drag_drop_details>

## Resize System

### Handle Types
| Handle Type | Size | Purpose | Location |
|------------|------|---------|----------|
| **Corner** | 6x6px | 2D resizing | All four corners |
| **Edge** | 20px wide/tall | 1D resizing | All four edges |

### Resize Rules
- **ALL elements resizable** EXCEPT text (which auto-sizes)
- **Minimum size enforcement**: 50px width/height
- **Visual feedback**: Handles appear on hover, persist during resize
- **Zoom-aware resizing**: ALWAYS maintains proper scaling at all zoom levels

## Automatic Element Re-parenting

<reparenting_logic>
**CRITICAL FEATURE**: Elements automatically change parents based on their position

### Re-parenting Triggers
- **During resize**: Elements outside frame bounds move to container below
- **During drag**: Elements attach to new containers when dropped

### Detection Algorithm
```
IF element center is outside current parent bounds:
  → Check for frame at element position
  → IF frame found: Attach to highest z-index frame
  → ELSE: Attach to canvas
```

### Specific Behaviors
- **Frame-to-canvas**: Elements move to canvas if outside frame
- **Canvas-to-frame**: Canvas elements move into frames if inside bounds
- **Z-index priority**: When multiple frames overlap, elements ALWAYS attach to topmost frame
</reparenting_logic>

## Zoom System

<zoom_features>
### Controls
- **Ctrl/Cmd + Scroll**: Zoom in/out
- **Ctrl/Cmd + 0**: Reset zoom to 100%

### Technical Specifications
- **Zoom range**: 10% to 500% with 10% increments
- **Mouse-relative zooming**: Zooms relative to mouse position, NOT center
- **Transform origin**: Set to (0,0) for predictable calculations

### Visual Feedback
- Zoom percentage indicator in bottom-right
- Grid background scales with zoom
- NO transitions (for smooth performance)

### Performance Optimizations
- `will-change: transform` applied during zoom
- Automatic cleanup after interactions
- Hardware acceleration enabled
</zoom_features>

## Pan System

<pan_mechanics>
### Activation
**Space + Drag** to pan around the canvas

### Cursor States
| State | Cursor | Condition |
|-------|--------|-----------|
| Default | `pointer` | Normal state |
| Ready | `grab` | Holding spacebar |
| Panning | `grabbing` | Spacebar + dragging |

### Behavior Rules
- Pan DISABLED when clicking on frames/elements
- Other interactions DISABLED during pan
- Window blur handling for clean state reset
- Works seamlessly with zoom system
</pan_mechanics>

## Technical Implementation

### Event Management
<event_system>
- **Event delegation**: Single `mousemove`/`mouseup` handlers for ALL dragging
- **`getBoundingClientRect()`**: For accurate position calculations
- **Parent-relative positioning**: Convert between coordinate spaces
- **Dynamic z-index assignment**: Incrementing counter for proper layering
</event_system>

### CSS Classes
```css
.dragging     /* Applied during element drag */
.resizing     /* Applied during resize operation */
.free-floating /* Applied to extracted elements */
.zooming      /* Applied to canvas during zoom */
.panning      /* Applied to canvas during pan */
```

### Coordinate System
<coordinate_transformation>
**CRITICAL**: All positioning MUST account for zoom level

```javascript
screenToCanvas(x, y)  // Converts screen coordinates to canvas space
canvasToScreen(x, y)  // Converts canvas coordinates to screen space
```

- Maintains accurate positioning at ALL zoom levels
- Transform origin ALWAYS set to (0,0)
- Handles parent-relative conversions
</coordinate_transformation>

### Performance Optimizations
1. **`will-change` hints** for browser optimization
2. **Removed after interactions** to free memory
3. **Applied selectively**:
   - Canvas during zoom
   - Elements during drag/resize
4. **NO CSS transitions** during interactions

## Visual Design System

<design_specifications>
### Color Scheme
| Element | Color | Hex Code |
|---------|-------|----------|
| Background | Dark | `#0a0a0a` |
| Frames | Lighter Dark | `#1a1a1a` |
| Accents | Blue | `#3b82f6` |
| Text | White | `#ffffff` |

### Element Styling
- **Text elements**: Use `fit-content` width when extracted
- **Overflow handling**: ALWAYS set to `visible` to prevent clipping
- **Cursor states**: 
  - `move` cursor on frames/elements
  - `default` cursor on content
  - Context-specific cursors during operations

### UI Elements
- **Help text**: Bottom-left corner showing all keyboard shortcuts
- **Zoom indicator**: Bottom-right corner showing current zoom percentage
</design_specifications>

## Complete Keyboard Reference

<keyboard_shortcuts>
| Shortcut | Action | Notes |
|----------|--------|-------|
| **Cmd/Ctrl + Click + Drag** | Extract element from frame | Single fluid motion required |
| **Cmd/Ctrl + N** | Create new frame | Random position on canvas |
| **Cmd/Ctrl + Scroll** | Zoom in/out | 10% increments |
| **Cmd/Ctrl + 0** | Reset zoom to 100% | Instant reset |
| **Space + Drag** | Pan around canvas | Disabled on elements |
</keyboard_shortcuts>

<critical_reminders>
**REMEMBER**:
- NEVER use transitions during drag/zoom/pan operations
- ALWAYS maintain zoom-aware positioning
- ALWAYS respect z-index hierarchy
- Elements MUST re-parent automatically based on position
- Zoom MUST be mouse-relative, not center-relative
</critical_reminders>

## Modular File Structure

<modular_architecture>
The application has been refactored from a single HTML file into a modular structure:

### File Organization
- **index.html** - Minimal HTML structure with external file references
- **styles.css** - All CSS styles extracted from original HTML
- **js/canvas.js** - Canvas initialization and frame management
- **js/frame.js** - Frame creation and setup functionality  
- **js/drag.js** - Drag and drop mechanics for frames and elements
- **js/extraction.js** - Element extraction system (Cmd/Ctrl + Click + Drag)
- **js/resize.js** - Resize handles and resizing functionality
- **js/zoom.js** - Zoom system with mouse-relative zooming
- **js/pan.js** - Pan system with Space + Drag
- **js/element-creation.js** - New element creation with keyboard shortcuts
- **js/app.js** - Main initialization and keyboard shortcuts

### Benefits
- **Maintainability**: Clean separation of concerns
- **Extensibility**: Easy to add new features in isolated modules
- **Performance**: Proper dependency loading order
- **Development**: Easier debugging and code navigation
</modular_architecture>

## Two-Frame System

<frame_types>
The application supports two distinct types of frames:

### Screen-Frames (Full HTML)
- **Complete frames** with title bars and content areas
- **Main containers** for organizing wireframe content
- **Canvas-only placement** - can only be placed on the main canvas
- **Traditional frame behavior** with all existing functionality

### Element-Frames (Special Divs)  
- **Lightweight container divs** with off-white background (`#f5f5f5`)
- **Dashed border styling** (`2px dashed #999`) for visual distinction
- **Universal placement** - can be placed anywhere:
  - Inside screen-frames
  - Inside other element-frames (nested)
  - On the main canvas
- **Act as drop targets** for other elements and element-frames
- **Full functionality** - support dragging, resizing, element extraction

### Nested Container Support
- **Deep nesting capability**: Element-frames can contain other element-frames
- **Proper drop detection**: Uses `document.elementsFromPoint()` for accurate nested targeting
- **Automatic re-parenting**: Elements move between containers based on position
- **Z-index awareness**: Respects container hierarchy for drop target selection
</frame_types>

## Element Creation System

<element_creation>
### Keyboard Shortcuts for Element Creation
- **F** - Screen-frame (follows mouse, places on canvas only)
- **R** - Element-frame (off-white background, universal placement)
- **T** - Text element (editable with `contentEditable`)
- **L/D** - Line element (thin horizontal line, 2px height)
- **O** - Circle element (perfect circle with dark styling)
- **B** - Button element (functional, logs clicks to console)
- **P** - Input field element (functional text input)

### Interactive Placement Workflow
1. **Key Press**: Element appears attached to mouse cursor by top-left corner
2. **Mouse Following**: Element follows mouse movement with semi-transparent overlay
3. **Click to Drop**: Simple left-click places element at current mouse position
4. **Click-Drag to Resize**: Click and drag immediately places element and starts resize operation
   - **Precise Sizing**: Element spans exactly from initial click point to current mouse position
   - **Direct Calculation**: Uses `size = mousePosition - elementTopLeft` instead of delta-based resizing
   - **Seamless Transition**: Placement mode smoothly transitions to resize mode for fluid interaction

### Element Features
- **Text Elements**: `contentEditable` for in-place editing, transparent background
- **Line Elements**: 2px height, 100px default width, light gray color
- **Circle Elements**: Perfect circles using `border-radius: 50%`
- **Button Elements**: Functional buttons with click handlers that log their labels
- **Input Elements**: Wrapped in container divs for resize handle support, full text input functionality
- **All Elements**: Support extraction, drag, resize, and container re-parenting
- **Resize Handles**: Appear on hover for all elements, corner and edge handles for precise resizing
</element_creation>

## Advanced Functionality

<advanced_features>
### Container Drop Detection
- **Nested Element Support**: Elements can be dropped into deeply nested element-frames
- **Accurate Targeting**: Uses browser's `elementsFromPoint()` API for precise detection
- **Priority System**: Most specific (deepest nested) container takes precedence
- **Visual Feedback**: Elements attach to appropriate containers during drag operations

### Size Constraint Management  
- **Frame Minimums**: Screen-frames and element-frames maintain 50px minimum dimensions
- **Element Flexibility**: Other elements can be resized to any size including very small (1px minimum)
- **Unrestricted Resizing**: Buttons, text, and other extracted elements have no size limits

### Coordinate System Improvements
- **Fixed Positioning Conversion**: Proper coordinate transformation when moving elements from body to containers
- **Zoom-Aware Calculations**: All positioning accounts for current zoom level
- **Parent-Relative Coordinates**: Elements maintain correct position regardless of container
</advanced_features>

## Known Issues & Development Notes

<development_status>
### Current Limitations
- **Complex Nested Scenarios**: Very deep nesting of element-frames may need additional testing

### Recent Fixes Applied
- **Element Visibility**: Fixed elements not appearing when clicked-to-drop (coordinate conversion issue)
- **Frame Creation**: F key now makes frames follow mouse like other elements instead of random placement
- **Keyboard Shortcuts**: Fixed shortcuts not working after placing frames (placement state reset issue)
- **Nested Dropping**: Fixed dropping into nested element-frames using proper DOM traversal
- **Drop & Resize Precision**: Fixed drag-to-resize so elements fit exactly between drop point and mouse position
- **Input Element Resize Handles**: Fixed input elements not showing resize handles by wrapping them in container divs

### Technical Implementation Learnings

#### Drop & Resize Precision Solution
**Problem**: Delta-based resizing (`newSize = startSize + mouseDelta`) caused elements to be oversized
**Solution**: Direct position calculation (`newSize = mousePosition - elementTopLeft`) for drag-to-resize mode
**Implementation**: Added `isDragToResize` flag to distinguish between placement and normal resize operations

#### Void Element Resize Handle Support
**Problem**: Input elements (void/self-closing) cannot contain child resize handles
**Solution**: Wrapper div approach - wrap input in container div that can hold resize handles
**Pattern**: Can be applied to other void elements (img, hr, br) if needed

#### Coordinate System Management
**Key Insight**: Proper coordinate transformation between screen and canvas space is critical for zoom support
**Implementation**: Uses `screenToCanvas()` and `canvasToScreen()` functions consistently throughout
**Result**: All operations work correctly at any zoom level and in any container

### Architecture Decisions
- **Modular Design**: Separated concerns into focused JavaScript modules for maintainability
- **Two-Frame System**: Distinguished between structural frames (screen-frames) and flexible containers (element-frames)
- **Event-Driven**: All interactions use proper event delegation and cleanup
- **Performance-Optimized**: Uses `will-change` hints and proper transform handling
</development_status>