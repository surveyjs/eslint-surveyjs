
'use strict';

module.exports = {
    create(context) {
        const FORBIDDEN_METHODS = ['getElementById', 'querySelector'];

        return {
            MemberExpression(node) {
                const methodName = node.property.name;

                if (!FORBIDDEN_METHODS.includes(methodName)) {
                    return;
                }

                if (node.object.type === 'Identifier' && node.object.name === 'document') {
                    context.report({ 
                        node, 
                        message: `'document.${methodName}' is not allowed in Shadow DOM context. Use querySelector on el.getRootNode() or current elementRoot instead.` 
                    });
                    return;
                }

                if (node.object.type === 'CallExpression') {
                    const callee = node.object.callee;
                    
                    if (callee.type === 'Identifier' && callee.name === 'getDocument') {
                         context.report({ 
                            node, 
                            message: `'getDocument().${methodName}' is not allowed in Shadow DOM context. Use querySelector on el.getRootNode() or current elementRoot instead.` 
                        });
                        return;
                    }
                    
                    if (
                        callee.type === 'MemberExpression' &&
                        callee.object.name === 'DomDocumentHelper' &&
                        callee.property.name === 'getDocument'
                    ) {
                         context.report({ 
                            node, 
                            message: `'DomDocumentHelper.getDocument().${methodName}' is not allowed in Shadow DOM context. Use querySelector on el.getRootNode() or current elementRoot instead.` 
                        });
                        return;
                    }
                }
            },
        };
    }
};