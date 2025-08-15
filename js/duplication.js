// Keyboard-based duplication and clipboard functionality
(function() {
    let clipboardElements = [];

    function isInputTarget(target) {
        return target.tagName === 'INPUT' ||
               target.tagName === 'TEXTAREA' ||
               target.contentEditable === 'true' ||
               (window.codeEditor && window.codeEditor.isActive());
    }

    function handleCopy() {
        clipboardElements = window.getSelectedElements ? window.getSelectedElements() : [];
    }

    function recordCreation(element) {
        if (window.recordCreate && window.undoManager) {
            const state = window.undoManager.captureElementState ? window.undoManager.captureElementState(element) : null;
            window.recordCreate(element.id, state, element.parentElement?.id || 'canvas', true);
        }
    }

    function duplicateInPlace() {
        const selected = window.getSelectedElements ? window.getSelectedElements() : [];
        if (!selected.length) return;

        const newElements = [];
        selected.forEach(el => {
            if (window.duplicateElement) {
                const dup = window.duplicateElement(el, false, false);
                newElements.push(dup);
            }
        });

        if (window.clearSelection) window.clearSelection();
        newElements.forEach(el => window.selectElement && window.selectElement(el, true));
        newElements.forEach(recordCreation);
    }

    function pasteFromClipboard() {
        if (!clipboardElements.length) return;
        const target = window.getSelectedElements ? window.getSelectedElements()[0] : null;
        const newElements = [];

        clipboardElements.forEach(original => {
            if (!window.duplicateElement) return;
            const dup = window.duplicateElement(original, false, false);
            if (target) {
                const parent = target.parentElement;
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.display === 'flex') {
                    dup.classList.remove('free-floating');
                    dup.style.position = '';
                    dup.style.left = '';
                    dup.style.top = '';
                    parent.insertBefore(dup, target.nextSibling);
                } else {
                    dup.classList.add('free-floating');
                    dup.style.left = target.style.left;
                    dup.style.top = target.style.top;
                    parent.insertBefore(dup, target.nextSibling);
                }
            }
            newElements.push(dup);
        });

        if (window.clearSelection) window.clearSelection();
        newElements.forEach(el => window.selectElement && window.selectElement(el, true));
        newElements.forEach(recordCreation);
    }

    document.addEventListener('keydown', (e) => {
        if (isInputTarget(e.target)) return;

        const isMeta = e.metaKey || e.ctrlKey;
        if (!isMeta) return;
        const key = e.key.toLowerCase();

        if (key === 'c') {
            handleCopy();
            e.preventDefault();
        } else if (key === 'd') {
            duplicateInPlace();
            e.preventDefault();
        } else if (key === 'v') {
            pasteFromClipboard();
            e.preventDefault();
        }
    });
})();
