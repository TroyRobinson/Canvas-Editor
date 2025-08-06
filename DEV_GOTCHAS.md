# Development Gotchas and Technical Considerations

## CSS Manager Development Lessons
### CSS Editor Module Integration Issues
**Problem**: CSS content disappearing after mode switches due to empty textarea overwriting CSS Manager state
**Solution**: Only save CSS content from textarea if it contains actual content (`textarea.value.trim()`)
**Lesson**: Mode switching logic must validate content before persisting to prevent data loss

### CORS Issues with Local File Loading
**Problem**: `fetch('styles.css')` fails with CORS errors when running locally
**Solution**: Embed CSS content in HTML via `<script id="css-content" type="text/plain">` tag
**Lesson**: Local file access requires embedded content or server environment for security

### CSS Manager Abstraction Benefits
**Decision**: Extracted CSS operations from code-editor.js into dedicated css-manager.js
**Benefits**: Single responsibility, better testability, reusable CSS operations, cleaner error handling
**Implementation**: CSS Manager handles state, code editor handles UI; clean API boundary

### Canvas Click Event Coordination
**Architecture**: Canvas clicks managed by marquee-selection.js, not selection.js
**Reason**: Proper coordination between marquee selection and selection clearing
**Integration**: Canvas clicks trigger `window.codeEditor.showCSSEditor()` for CSS mode switching

## Mode Manager Development Lessons

### Event Handler Accumulation with innerHTML Replacement
**Problem**: Multiple script versions mixing event handlers (frame's script version 1 and version 2 handlers both remaining on same button)
**Root Cause**: Using `element.innerHTML = newHTML` only replaces content but preserves existing DOM elements with their attached event handlers
**Symptom**: Clicking button triggers both old and new event handlers simultaneously

### The innerHTML vs Element Replacement Distinction
**WRONG approach (causes handler accumulation):**
```javascript
frameContent.innerHTML = storedHTML; // Only changes content, keeps old handlers
```

**CORRECT approach (strips all handlers cleanly):**
```javascript
const newFrameContent = document.createElement('div');
newFrameContent.innerHTML = storedHTML;
parent.removeChild(oldFrameContent);  // Strips ALL event handlers
parent.insertBefore(newFrameContent, nextSibling);  // Fresh clean element
```

### Why Code Editor Manual Process Worked
**Manual process**: Copy code → Select element → Paste same code
**Why it worked**: Code editor uses proper element replacement (`removeChild()` + `insertBefore()`)
**Lesson**: Always follow the code editor's cleanup pattern for element replacement

### Event Handler Cleanup Best Practices
**Rule**: Never use `innerHTML` replacement for elements that may have script handlers
**Pattern**: Always use complete element replacement with `removeChild()` + `insertBefore()`
**Follow-up**: Re-establish all Canvas behaviors after replacement (selection, drag, resize, scripts)
**Verification**: Check console for handler cleanup logs to ensure proper cleanup occurred