// src/api.js
// 通用 API helper：优先使用 VUE_APP_API_BASE，回退到相对 /api 路径
// 使用方式：import { apiGetJson, apiPostJson } from '@/api';

function normalizeBase(base) {
    if (!base) return '';
    return base.replace(/\/+$/, ''); // 移除尾部斜杠
}

const ENV_BASE = normalizeBase(process.env.VUE_APP_API_BASE || '');
const FALLBACK_PREFIX = '/api'; // 如果没有设置 VUE_APP_API_BASE 则请求相对 /api/*

function buildApiPath(path) {
    const p = path ? (path.startsWith('/') ? path : `/${path}`) : '/';
    if (ENV_BASE) return `${ENV_BASE}${p}`;
    return `${FALLBACK_PREFIX}${p}`;
}

export function apiFetch(path, init = {}) {
    const url = buildApiPath(path);
    return fetch(url, init);
}

export function apiGet(path, headers = {}) {
    return apiFetch(path, { method: 'GET', headers });
}

export async function apiGetJson(path, headers = {}) {
    const res = await apiGet(path, headers);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} for ${path}: ${text}`);
        err.response = res;
        throw err;
    }
    return res.json();
}

export async function apiPostJson(path, body, headers = {}) {
    const merged = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
    const res = await apiFetch(path, {
        method: 'POST',
        headers: merged,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} for ${path}: ${text}`);
        err.response = res;
        throw err;
    }
    return res.json();
}