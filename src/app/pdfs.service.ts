import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export type PdfStatus = 'active'|'archived'|'deleted';
export interface PdfDoc { id: string; title?: string; annotations?: any; status: PdfStatus; createdAt: string; updatedAt: string }

const API_BASE = normalizeBase(environment.pdfApiBase || 'https://pdf-api.berjis.tech');
const STORAGE_KEY = 'berjis-pdfs';

@Injectable({ providedIn: 'root' })
export class PdfsService {
  private cache: Record<string, PdfDoc> = {};
  private preferRemote = true;
  syncMode: 'remote'|'local' = 'remote';
  isSaving = false;
  lastSavedAt: string | null = null;
  lastError: string | null = null;

  constructor(private http: HttpClient) { this.load(); }
  private load() { try { const raw = localStorage.getItem(STORAGE_KEY); this.cache = raw ? JSON.parse(raw) : {}; } catch { this.cache = {}; } }
  private persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache)); }
  private now() { return new Date().toISOString(); }

  async list(status: PdfStatus[] = ['active']): Promise<PdfDoc[]> {
    if (this.preferRemote) {
      try {
        const res = await firstValueFrom(this.http.get<any>(`${API_BASE}/v1/pdfs`, { params: { status: status.join(',') }, withCredentials: true }));
        const rows: PdfDoc[] = res?.data || [];
        for (const p of rows) this.cache[p.id] = p; this.persist();
        this.preferRemote = true; this.syncMode='remote'; this.lastError=null; return rows;
      } catch (e) { this.switchToLocal(e); }
    }
    return Object.values(this.cache).filter(p => status.includes(p.status)).sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
  }
  get(id: string) { return this.cache[id]; }
  async fetch(id: string): Promise<PdfDoc|undefined> {
    if (this.preferRemote) {
      try {
        const res = await firstValueFrom(this.http.get<any>(`${API_BASE}/v1/pdfs/${id}`, { withCredentials: true }));
        const p: PdfDoc = res?.data; if (p) { this.cache[p.id] = p; this.persist(); }
        this.preferRemote = true; this.syncMode='remote'; this.lastError=null; return p;
      } catch (e) { this.switchToLocal(e); }
    }
    return this.cache[id];
  }

  async create(initial?: Partial<PdfDoc>): Promise<PdfDoc> {
    const tmp: PdfDoc = { id: this.uuid(), title: initial?.title?.trim() || '', annotations: initial?.annotations ?? [], status: 'active', createdAt: this.now(), updatedAt: this.now() };
    if (this.preferRemote) {
      try {
        this.beginSave();
        const res = await firstValueFrom(this.http.post<any>(`${API_BASE}/v1/pdfs`, { title: tmp.title || undefined, annotations: tmp.annotations }, { withCredentials: true }));
        const p: PdfDoc = res.data; this.cache[p.id] = p; this.persist(); this.endSave(); return p;
      } catch (e) { this.endSave(e); this.switchToLocal(e); }
    }
    this.cache[tmp.id] = tmp; this.persist(); return tmp;
  }

  async save(p: PdfDoc): Promise<PdfDoc|undefined> {
    const hasTitle = !!p.title && p.title.trim().length>0;
    const hasAnns = p.annotations && JSON.stringify(p.annotations).length>2;
    if (!hasTitle && !hasAnns) return undefined;
    if (this.preferRemote) {
      try {
        this.beginSave();
        const res = await firstValueFrom(this.http.put<any>(`${API_BASE}/v1/pdfs/${p.id}`, { title: p.title || undefined, annotations: p.annotations }, { withCredentials: true }));
        const out: PdfDoc = res.data; this.cache[out.id] = out; this.persist(); this.endSave(); return out;
      } catch (e) { this.endSave(e); this.switchToLocal(e); }
    }
    p.updatedAt = this.now(); this.cache[p.id] = { ...p }; this.persist(); return p;
  }

  async archive(id: string) { if (this.preferRemote) { try { this.beginSave(); await firstValueFrom(this.http.post(`${API_BASE}/v1/pdfs/${id}/archive`, {}, { withCredentials: true })); this.endSave(); } catch (e) { this.endSave(e); this.switchToLocal(e); } } const p=this.cache[id]; if (p){ p.status='archived'; p.updatedAt=this.now(); this.persist(); } }
  async restore(id: string) { if (this.preferRemote) { try { this.beginSave(); await firstValueFrom(this.http.post(`${API_BASE}/v1/pdfs/${id}/restore`, {}, { withCredentials: true })); this.endSave(); } catch (e) { this.endSave(e); this.switchToLocal(e); } } const p=this.cache[id]; if (p){ p.status='active'; p.updatedAt=this.now(); this.persist(); } }
  async softDelete(id: string) { if (this.preferRemote) { try { this.beginSave(); await firstValueFrom(this.http.delete(`${API_BASE}/v1/pdfs/${id}`, { withCredentials: true })); this.endSave(); } catch (e) { this.endSave(e); this.switchToLocal(e); } } const p=this.cache[id]; if (p){ p.status='deleted'; p.updatedAt=this.now(); this.persist(); } }

  private beginSave(){ this.isSaving=true; this.lastError=null; }
  private endSave(err?: any){ this.isSaving=false; if (err) this.lastError = err?.message||'sync error'; else this.lastSavedAt=this.now(); }
  private switchToLocal(e?: any){ this.preferRemote=false; this.syncMode='local'; this.lastError = e?.message || 'offline, saving locally'; }
  private uuid(): string { return 'f_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

function normalizeBase(base: string): string {
  if (!base) return '';
  return base.replace(/\/+$/, '');
}

