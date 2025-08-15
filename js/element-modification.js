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

    const weightMap = {
        'Digit1': '100', // Thin
        'Digit2': '200', // Extra Light
        'Digit3': '300', // Light
        'Digit4': '400', // Normal
        'Digit5': '500', // Medium
        'Digit6': '600', // Semi Bold
        'Digit7': '700', // Bold
        'Digit8': '800'  // Extra Bold
    };

    const buttonSizeMap = {
        '1': { width: '80px', height: '24px', fontSize: '10px' },   // XS
        '2': { width: '90px', height: '28px', fontSize: '12px' },   // SM
        '3': { width: '100px', height: '32px', fontSize: '14px' },  // MD
        '4': { width: '120px', height: '36px', fontSize: '16px' },  // LG
        '5': { width: '140px', height: '44px', fontSize: '18px' },  // XL
        '6': { width: '160px', height: '52px', fontSize: '20px' },  // 2XL
        '7': { width: '180px', height: '60px', fontSize: '22px' },  // 3XL
        '8': { width: '200px', height: '68px', fontSize: '24px' }   // 4XL
    };

    function isTextElement(element) {
        if (!element || !element.tagName) return false;
        if (element.classList && element.classList.contains('text-element')) return true;
        const textTags = ['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL'];
        return textTags.includes(element.tagName);
    }

    function isButtonElement(element) {
        return element && element.tagName === 'BUTTON';
    }

    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input/textarea/contentEditable or code editor is active
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.contentEditable === 'true' ||
            (window.codeEditor && window.codeEditor.isActive())) {
            return;
        }

        const selected = window.getSelectedElements ? window.getSelectedElements() : [];
        if (selected.length === 0) return;

        let handled = false;

        // Font weight handling (Shift + 1-8)
        if (e.shiftKey) {
            const newWeight = weightMap[e.code];
            if (newWeight) {
                const textElements = selected.filter(isTextElement);
                if (textElements.length) {
                    textElements.forEach(el => {
                        const oldWeight = el.style.fontWeight || window.getComputedStyle(el).fontWeight;
                        el.style.fontWeight = newWeight;
                        if (window.recordStyleChange && el.id) {
                            window.recordStyleChange(el.id, 'font-weight', oldWeight, newWeight);
                        }
                    });
                    handled = true;
                }
            }
        } else {
            const newSize = sizeMap[e.key];
            const buttonSize = buttonSizeMap[e.key];

            if (newSize) {
                const textElements = selected.filter(isTextElement);
                if (textElements.length) {
                    textElements.forEach(el => {
                        const oldSize = el.style.fontSize || window.getComputedStyle(el).fontSize;
                        el.style.fontSize = newSize;
                        if (window.recordStyleChange && el.id) {
                            window.recordStyleChange(el.id, 'font-size', oldSize, newSize);
                        }
                    });
                    handled = true;
                }
            }

            if (buttonSize) {
                const buttonElements = selected.filter(isButtonElement);
                if (buttonElements.length) {
                    buttonElements.forEach(el => {
                        const oldWidth = el.style.width || window.getComputedStyle(el).width;
                        const oldHeight = el.style.height || window.getComputedStyle(el).height;
                        const oldFontSize = el.style.fontSize || window.getComputedStyle(el).fontSize;

                        el.style.width = buttonSize.width;
                        el.style.height = buttonSize.height;
                        el.style.fontSize = buttonSize.fontSize;

                        if (window.recordStyleChange && el.id) {
                            window.recordStyleChange(el.id, 'width', oldWidth, buttonSize.width);
                            window.recordStyleChange(el.id, 'height', oldHeight, buttonSize.height);
                            window.recordStyleChange(el.id, 'font-size', oldFontSize, buttonSize.fontSize);
                        }
                    });
                    handled = true;
                }
            }
        }

        if (handled) {
            e.preventDefault();
        }
    });
})();
