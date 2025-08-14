// Auto-layout module: converts absolutely positioned children to flexbox layout

(function() {
    function applyAutoLayout(container) {
        if (!container) return;

        const children = Array.from(container.children).filter(el => el.nodeType === 1);
        if (children.length === 0) return;

        // Capture original HTML for undo
        const oldHTML = container.outerHTML;

        const containerRect = container.getBoundingClientRect();
        const childData = children.map(el => {
            const rect = el.getBoundingClientRect();
            return {
                element: el,
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top,
                width: rect.width,
                height: rect.height
            };
        });

        const minLeft = Math.min(...childData.map(d => d.left));
        const minTop = Math.min(...childData.map(d => d.top));

        // Determine dominant positioning direction based on majority alignment
        function std(values) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        }

        const stdLeft = std(childData.map(d => d.left));
        const stdTop = std(childData.map(d => d.top));
        const direction = stdTop <= stdLeft ? 'row' : 'column';

        // Sort children along the primary axis
        childData.sort((a, b) => direction === 'row' ? a.left - b.left : a.top - b.top);

        // Compute gaps between elements along primary axis
        const gaps = [];
        for (let i = 1; i < childData.length; i++) {
            const prev = childData[i - 1];
            const curr = childData[i];
            const gap = direction === 'row'
                ? curr.left - (prev.left + prev.width)
                : curr.top - (prev.top + prev.height);
            if (gap >= 0) gaps.push(gap);
        }
        let gapValue = 0;
        if (gaps.length > 0) {
            const sortedGaps = gaps.sort((a, b) => a - b);
            gapValue = Math.round(sortedGaps[Math.floor(sortedGaps.length / 2)]);
        }

        // Apply flexbox layout to container
        container.style.display = 'flex';
        container.style.flexDirection = direction;
        container.style.alignItems = 'flex-start';
        container.style.gap = gapValue + 'px';
        container.style.padding = '0';
        container.style.paddingLeft = minLeft + 'px';
        container.style.paddingTop = minTop + 'px';
        container.style.width = 'fit-content';
        container.style.height = 'fit-content';

        // Update children styles and order
        childData.forEach(data => {
            const el = data.element;
            el.style.position = 'relative';
            el.style.left = '';
            el.style.top = '';
            el.classList.remove('free-floating');
            el.style.margin = '0';
            if (direction === 'row') {
                el.style.marginTop = '0';
            } else {
                el.style.marginLeft = '0';
            }
        });

        // Reappend children in sorted order
        childData.forEach(d => container.appendChild(d.element));

        // Reinitialize selection/behavior for children
        if (window.makeContainerElementsSelectable) {
            window.makeContainerElementsSelectable(container);
        }

        const newHTML = container.outerHTML;
        if (window.recordElementReplacement) {
            window.recordElementReplacement(container.id, oldHTML, newHTML);
        }

        if (window.selectElement) {
            window.selectElement(container);
        }
    }

    window.applyAutoLayout = applyAutoLayout;
})();

