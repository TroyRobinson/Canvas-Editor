// Element modification module: handle keyboard shortcuts for modifying selected elements

(function() {
    const sizeMap = {
        '1': '10px', // 2XS
        '2': '12px', // XS
        '3': '14px', // SM
        '4': '16px', // MD
        '5': '20px', // LG
        '6': '24px', // XL
        '7': '32px', // 2XL
        '8': '40px'  // 3XL
    };

    function isTextElement(element) {
        if (!element || !element.tagName) return false;
        if (element.classList && element.classList.contains('text-element')) return true;
        const textTags = ['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL'];
        return textTags.includes(element.tagName);
    }

    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input/textarea/contentEditable or code editor is active
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.contentEditable === 'true' ||
            (window.codeEditor && window.codeEditor.isActive())) {
            return;
        }

        const newSize = sizeMap[e.key];
        if (!newSize) return;

        const selected = window.getSelectedElements ? window.getSelectedElements() : [];
        if (selected.length === 0) return;

        const textElements = selected.filter(isTextElement);
        if (textElements.length === 0) return;

        e.preventDefault();
        textElements.forEach(el => {
            const oldSize = el.style.fontSize || window.getComputedStyle(el).fontSize;
            el.style.fontSize = newSize;
            if (window.recordStyleChange && el.id) {
                window.recordStyleChange(el.id, 'font-size', oldSize, newSize);
            }
        });
    });
})();
