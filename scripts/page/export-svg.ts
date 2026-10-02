// GitHub shows README images through <img>, where neither external CSS nor CSS variables are
// available, so every style the chart gets from stylesheets is written into the markup.

const INHERITED_PROPERTIES = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'font-family',
    'font-size',
    'font-weight',
    'text-anchor',
    'dominant-baseline',
    'visibility',
    'shape-rendering',
    'white-space',
];
const OWN_PROPERTIES = ['opacity', 'alignment-baseline', 'stop-color', 'stop-opacity'];
const REMOVED_ATTRIBUTES = ['class', 'tabindex', 'cursor'];

type StyleValues = Record<string, string>;

function createDefaultsReader() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const cache = new Map<string, StyleValues>();
    document.documentElement.appendChild(svg);

    return {
        get(tagName: string) {
            let values = cache.get(tagName);

            if (!values) {
                const element = document.createElementNS(svg.namespaceURI, tagName);
                svg.appendChild(element);
                const style = getComputedStyle(element);
                values = Object.fromEntries(
                    [...INHERITED_PROPERTIES, ...OWN_PROPERTIES].map((property) => [
                        property,
                        style.getPropertyValue(property),
                    ]),
                );
                cache.set(tagName, values);
            }

            return values;
        },
        dispose() {
            svg.remove();
        },
    };
}

function inlineStyles(
    source: Element,
    target: Element,
    defaults: ReturnType<typeof createDefaultsReader>,
    parentValues?: StyleValues,
) {
    const style = getComputedStyle(source);
    const defaultValues = defaults.get(source.tagName);
    const values: StyleValues = {};
    const declarations: string[] = [];

    for (const property of INHERITED_PROPERTIES) {
        const value = style.getPropertyValue(property);
        values[property] = value;

        if (value !== (parentValues ?? defaultValues)[property]) {
            declarations.push(`${property}:${value}`);
        }
    }

    for (const property of OWN_PROPERTIES) {
        const value = style.getPropertyValue(property);

        if (value !== defaultValues[property]) {
            declarations.push(`${property}:${value}`);
        }
    }

    for (const attribute of REMOVED_ATTRIBUTES) {
        target.removeAttribute(attribute);
    }

    for (const attribute of target.getAttributeNames()) {
        if (attribute.startsWith('data-')) {
            target.removeAttribute(attribute);
        }
    }

    if (declarations.length) {
        target.setAttribute('style', declarations.join(';'));
    } else {
        target.removeAttribute('style');
    }

    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children);

    sourceChildren.forEach((sourceChild, index) => {
        const targetChild = targetChildren[index];

        if (getComputedStyle(sourceChild).display === 'none') {
            targetChild.remove();
        } else {
            inlineStyles(sourceChild, targetChild, defaults, values);
        }
    });
}

// The library generates random ids, which would change the file on every run.
function normalizeIds(markup: string) {
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);

    return ids.reduce(
        (result, id, index) => result.replaceAll(`"${id}"`, `"id${index}"`).replaceAll(`#${id}`, `#id${index}`),
        markup,
    );
}

export function exportSvg(source: SVGSVGElement) {
    const {width, height} = source.getBoundingClientRect();
    const target = source.cloneNode(true) as SVGSVGElement;
    const defaults = createDefaultsReader();

    inlineStyles(source, target, defaults);
    defaults.dispose();

    target.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    target.setAttribute('width', String(width));
    target.setAttribute('height', String(height));
    target.setAttribute('viewBox', `0 0 ${width} ${height}`);

    return normalizeIds(new XMLSerializer().serializeToString(target));
}
