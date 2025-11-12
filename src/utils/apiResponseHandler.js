// 通用响应处理器：根据 action 与响应头返回统一的 preview 对象
// preview = { kind: 'image'|'pdf'|'html'|'json'|'links'|'markdown'|'binary', blob?, url?, html?, json?, links?, markdown? }

function dataUriToBlob(dataUri) {
    const match = dataUri.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) return null;
    const mime = match[1];
    const b64 = match[2];
    const bytes = atob(b64);
    const len = bytes.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = bytes.charCodeAt(i);
    return new Blob([u8], { type: mime });
}

// 主处理函数：传入 Response 对象和当前 action，返回一个对象描述如何展示
export async function handleApiResponse(response, action) {
    const ct = (response.headers.get('content-type') || '').toLowerCase();

    // 二进制（图片、pdf、其他）
    if (ct.startsWith('image/')) {
        const blob = await response.blob();
        return { kind: 'image', blob };
    }
    if (ct.includes('application/pdf')) {
        const blob = await response.blob();
        return { kind: 'pdf', blob };
    }

    // JSON：按 action 进一步处理
    if (ct.includes('application/json')) {
        const text = await response.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            // 非标准 JSON，作为文本展示
            return { kind: 'html', html: `<pre>${escapeHtml(text)}</pre>` };
        }

        // 链接列表 action => 期望数组或 { links: [...] }
        if (action === 'links') {
            if (Array.isArray(parsed)) return { kind: 'links', links: parsed };
            if (parsed && Array.isArray(parsed.links)) return { kind: 'links', links: parsed.links };
        }

        // scrape 可能返回结构化结果（显示为 formatted JSON 或 HTML）
        if (action === 'scrape' || action === 'json') {
            // json action 也可能返回 a) structured object b) { result: "data:...base64" }
            if (parsed && typeof parsed.result === 'string' && parsed.result.startsWith('data:')) {
                const blob = dataUriToBlob(parsed.result);
                if (blob) return { kind: blob.type.startsWith('image/') ? 'image' : 'binary', blob };
            }
            return { kind: 'json', json: parsed };
        }

        // markdown could be returned as JSON { markdown: "..." }
        if (action === 'markdown') {
            if (parsed && typeof parsed.markdown === 'string') return { kind: 'markdown', markdown: parsed.markdown };
            // fallback to JSON view
            return { kind: 'json', json: parsed };
        }

        // default: show parsed JSON
        return { kind: 'json', json: parsed };
    }

    // HTML/text
    if (ct.includes('text/html')) {
        const html = await response.text();
        return { kind: 'html', html };
    }
    if (ct.includes('text/markdown') || action === 'markdown') {
        const md = await response.text();
        return { kind: 'markdown', markdown: md };
    }
    if (ct.includes('text/plain')) {
        const txt = await response.text();
        return { kind: 'html', html: `<pre>${escapeHtml(txt)}</pre>` };
    }

    // fallback: treat as binary
    const blob = await response.blob();
    return { kind: 'binary', blob };
}

// small helper
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}