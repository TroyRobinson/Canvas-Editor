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