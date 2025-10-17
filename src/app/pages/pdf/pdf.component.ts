import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PdfsService, PdfDoc } from '../../pdfs.service';

@Component({
  standalone: true,
  selector: 'app-pdf',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pdf.component.html'
})
export class PdfPageComponent implements OnInit {
  pdf: PdfDoc | null = null;
  annotations: { text: string }[] = [];
  pendingSave?: any;
  zoom = 1;
  openModal = false;
  openId = '';
  openQuery = '';
  openRows: PdfDoc[] = [];
  openFiltered: PdfDoc[] = [];
  // Editor state
  editorDoc: {
    pageWidth: number;
    pageHeight: number;
    items: ({ id: string; type: 'text'; x: number; y: number; w: number; h: number; rot?: number; text: string; fontSize: number; fontFamily?: 'helvetica'|'times'|'courier'; bold?: boolean; italic?: boolean; underline?: boolean; color?: string }
      | { id: string; type: 'image'|'sign'; x: number; y: number; w: number; h: number; rot?: number; dataUrl: string; ar?: number }
      | { id: string; type: 'link'; x: number; y: number; w: number; h: number; rot?: number; text: string; url: string; color?: string; fontSize?: number }
      | { id: string; type: 'shape'; x: number; y: number; w: number; h: number; rot?: number; shape: 'rect'|'ellipse'|'line'; stroke?: string; fill?: string; strokeWidth?: number }
      | { id: string; type: 'whiteout'; x: number; y: number; w: number; h: number }
      | { id: string; type: 'annotation'; x: number; y: number; w: number; h: number; text: string }
      | { id: string; type: 'formText'|'formTextarea'|'formSelect'|'formRadio'|'formCheckbox'|'formSignature'; x: number; y: number; w: number; h: number; name?: string; placeholder?: string; options?: string[]; tabIndex?: number })[];
  } = { pageWidth: 595.28, pageHeight: 841.89, items: [] }; // default A4 in pt
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom' = 'A4';
  customPageWidth = 595.28;
  customPageHeight = 841.89;
  selectedId: string | null = null;
  isDragging = false;
  dragOffset = { x: 0, y: 0 };
  isResizing = false;
  resizeHandle: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'|null = null;
  isRotating = false;
  displayScale = 96 / 72; // pt -> px for screen preview
  private editorSaveTimer?: any;
  private readonly editorStorageKey = 'berjis-pdf-editor-docs';
  private fileInput?: HTMLInputElement;
  formEditMode = true;
  // signature modal
  signModal = false; sigDrawing = false; sigCanvas?: HTMLCanvasElement; sigCtx?: CanvasRenderingContext2D|null; sigLast?: {x:number,y:number}|null = null;
  uploadModal = false;
  contextMenus: { name: string, menus: { icon: string, name: string, action: string }[] }[] = [
    { name: 'File', menus: [
      { icon: '', name: 'New', action: 'new' },
      { icon: '', name: 'Open', action: 'open' },
      { icon: '', name: 'Rename', action: 'rename' },
      { icon: '', name: 'Upload', action: 'upload' },
      { icon: '', name: 'Download (.json)', action: 'download' },
      { icon: '', name: 'Export PDF', action: 'exportPdf' },
      { icon: '', name: 'Export PDF (forms)', action: 'exportPdfForms' },
      { icon: '', name: 'Print', action: 'print' }
    ]},
    { name: 'Edit', menus: [
      { icon: '', name: 'Undo', action: 'undo' },
      { icon: '', name: 'Redo', action: 'redo' }
    ]},
    { name: 'View', menus: [
      { icon: '', name: 'Zoom in', action: 'zoomIn' },
      { icon: '', name: 'Zoom out', action: 'zoomOut' },
      { icon: '', name: 'Page view', action: 'pageView' }
    ]},
    { name: 'Annotate', menus: [
      { icon: '', name: 'Highlight', action: 'highlight' },
      { icon: '', name: 'Comment', action: 'comment' },
      { icon: '', name: 'Draw', action: 'draw' }
    ]},
    { name: 'Tools', menus: [
      { icon: '', name: 'Find', action: 'find' },
      { icon: '', name: 'Rotate', action: 'rotate' }
    ]},
    { name: 'Help', menus: [
      { icon: '', name: 'PDF help', action: 'help' }
    ]}
  ];

  onMenu(action: string){
    switch(action){
      case 'new': this.router.navigate(['/pdf','new']); break;
      case 'open': { this.showOpen(); break; }
      case 'download': this.download(); break;
      case 'rename': this.showRename(); break;
      case 'exportPdf': this.exportPdf(); break;
      case 'exportPdfForms': this.exportPdfWithForms(); break;
      case 'upload': this.showUpload(); break;
      case 'print': window.print(); break;
      case 'undo': document.execCommand('undo'); break;
      case 'redo': document.execCommand('redo'); break;
      case 'zoomIn': this.zoom = Math.min(3, this.zoom + 0.1); break;
      case 'zoomOut': this.zoom = Math.max(0.5, this.zoom - 0.1); break;
      default: break;
    }
  }

  private download(){
    const name = ((this.pdf?.title)||'pdf').replace(/\s+/g,'-').slice(0,80);
    const blob = new Blob([JSON.stringify({ title: this.pdf?.title||'', annotations: this.annotations }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  private async showOpen(){ this.openModal = true; try { this.openRows = await this.svc.list(['active']); } catch { this.openRows = []; } this.openFiltered=[...this.openRows]; this.openQuery=''; }
  onOpenQueryChange(){ const q=(this.openQuery||'').toLowerCase(); if(!q){ this.openFiltered=[...this.openRows]; return; } this.openFiltered = this.openRows.filter(p => (p.title||'').toLowerCase().includes(q) || JSON.stringify(p.annotations||[]).toLowerCase().includes(q)); }
  openPdf(p: PdfDoc){ this.openModal=false; this.router.navigate(['/pdf', p.id]); }
  cancelOpen(){ this.openModal=false; }

  // Rename modal
  renameModal = false; renameTitle = '';
  private showRename(){ this.renameTitle=(this.pdf?.title||''); this.renameModal=true; }
  confirmRename(){ if(!this.pdf){ this.renameModal=false; return; } this.pdf.title=(this.renameTitle||'').trim(); this.renameModal=false; this.onTitleChange(); }
  cancelRename(){ this.renameModal=false; }
  

  constructor(private route: ActivatedRoute, private router: Router, public svc: PdfsService) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || 'new';
    this.pdf = { id, title: '', annotations: [], status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (id !== 'new') {
      const existing = this.svc.get(id) || await this.svc.fetch(id);
      if (existing) this.pdf = existing; else { this.router.navigate(['/']); return; }
    }
    this.annotations = Array.isArray(this.pdf?.annotations) ? this.pdf!.annotations as any : [];
    this.loadEditorDoc();
    setTimeout(() => this.ensureFileInput(), 0);
  }

  onTitleChange() { this.queueSave(); }
  addAnnotation() { this.annotations.push({ text: '' }); this.queueSave(); }
  onAnnChange(i: number, val: string) { this.annotations[i].text = val; this.queueSave(); }

  private queueSave() { if (!this.pdf) return; if (this.pendingSave) clearTimeout(this.pendingSave); this.pendingSave = setTimeout(() => this.save(), 400); }
  private async ensureCreatedId() { if (this.pdf && this.pdf.id === 'new') { const hasTitle = !!this.pdf.title && this.pdf.title.trim().length > 0; const hasAnns = JSON.stringify(this.annotations).length > 2; if (hasTitle || hasAnns) { const created = await this.svc.create({ title: this.pdf.title, annotations: this.annotations }); this.pdf = created; this.router.navigate(['/pdf', created.id], { replaceUrl: true }); } } }
  private async save() { if (!this.pdf) return; await this.ensureCreatedId(); if (!this.pdf) return; this.pdf.annotations = this.annotations; await this.svc.save(this.pdf); }

  // Editor: page size
  setPageSize(sz: 'A4'|'Letter'|'Legal'|'Custom'){
    this.pageSize = sz;
    const map: Record<string, [number, number]> = { A4: [595.28, 841.89], Letter: [612, 792], Legal: [612, 1008], Custom: [this.customPageWidth, this.customPageHeight] };
    const [w, h] = map[sz];
    this.editorDoc.pageWidth = w; this.editorDoc.pageHeight = h;
    this.queueEditorSave();
  }
  onCustomPageSizeChange(){ if(this.pageSize==='Custom'){ this.editorDoc.pageWidth=this.customPageWidth; this.editorDoc.pageHeight=this.customPageHeight; this.queueEditorSave(); } }

  // Editor: add items
  addTextBox(){
    const id = this.uuid();
    this.editorDoc.items.push({ id, type: 'text', x: 40, y: 60, w: 200, h: 24, text: 'Text', fontSize: 14, color: '#000000', fontFamily: 'helvetica' });
    this.selectedId = id; this.queueEditorSave();
  }
  addLink(){ const id=this.uuid(); this.editorDoc.items.push({ id, type: 'link', x: 40, y: 100, w: 220, h: 20, text: 'Link text', url: 'https://', color:'#2563eb', fontSize: 14 }); this.selectedId=id; this.queueEditorSave(); }
  addImage(){
    if (!this.fileInput) this.ensureFileInput();
    this.fileInput!.click();
  }
  private ensureFileInput(){
    if (this.fileInput) return;
    const el = document.createElement('input'); el.type='file'; el.accept='image/*'; el.style.display='none';
    el.addEventListener('change', async (e: any) => {
      const file = el.files && el.files[0]; if(!file) return; const reader = new FileReader();
      reader.onload = () => {
        const id = this.uuid();
        const w = 200; const h = 150; const ar = w / h;
        this.editorDoc.items.push({ id, type: 'image', x: 60, y: 80, w, h, dataUrl: String(reader.result), ar });
        this.selectedId = id; this.queueEditorSave(); el.value='';
      };
      reader.readAsDataURL(file);
    });
    document.body.appendChild(el); this.fileInput = el;
  }
  addSignature(){ this.addImage(); }
  addWhiteout(){ const id=this.uuid(); this.editorDoc.items.push({ id, type: 'whiteout', x: 80, y: 120, w: 160, h: 50 }); this.selectedId=id; this.queueEditorSave(); }
  addAnnotationItem(){ const id=this.uuid(); this.editorDoc.items.push({ id, type: 'annotation', x: 50, y: 50, w: 140, h: 80, text: 'Note' }); this.selectedId=id; this.queueEditorSave(); }
  addShape(shape: 'rect'|'ellipse'|'line'){ const id=this.uuid(); const base={ id, type: 'shape' as const, x: 100, y: 120, w: 120, h: 80, rot: 0, stroke:'#111827', fill: shape==='line' ? 'transparent' : '#e5e7eb', strokeWidth: 1 }; this.editorDoc.items.push({ ...base, shape }); this.selectedId=id; this.queueEditorSave(); }
  addFormField(kind: 'formText'|'formTextarea'|'formSelect'|'formRadio'|'formCheckbox'|'formSignature'){
    const id=this.uuid(); const base={ id, x: 120, y: 140, w: 200, h: kind==='formTextarea'?80:28, name: `${kind}_${id.slice(-4)}`, tabIndex: 0 } as any;
    if(kind==='formSelect') base.options=['Option 1','Option 2'];
    this.editorDoc.items.push({ type: kind, ...base }); this.selectedId=id; this.queueEditorSave();
  }

  // Editor: selection and dragging
  selectItem(id: string){ this.selectedId = id; }
  onCanvasMouseDown(ev: MouseEvent){
    const target = ev.target as HTMLElement;
    // rotate handle
    if(target && target.getAttribute('data-rotate')==='1' && this.selectedId){ this.isRotating=true; ev.preventDefault(); return; }
    // resize handle
    const rh = target?.getAttribute?.('data-rh') as any;
    const id = target?.getAttribute?.('data-eid');
    if (rh && id){ this.selectedId=id; this.isResizing=true; this.resizeHandle=rh; ev.preventDefault(); return; }
    if (!id) { this.selectedId = null; return; }
    this.selectedId = id; this.isDragging = true;
    const item = this.editorDoc.items.find(i => i.id===id); if(!item) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (ev.clientX - rect.left) / this.displayScale; const py = (ev.clientY - rect.top) / this.displayScale;
    this.dragOffset.x = px - item.x; this.dragOffset.y = py - item.y;
  }
  onCanvasMouseMove(ev: MouseEvent){
    const rect=(ev.currentTarget as HTMLElement).getBoundingClientRect(); const px=(ev.clientX-rect.left)/this.displayScale; const py=(ev.clientY-rect.top)/this.displayScale;
    const item = this.selectedId ? this.editorDoc.items.find(i=>i.id===this.selectedId) : null; if(!item) return;
    if(this.isDragging){ item.x = Math.max(0, Math.min(this.editorDoc.pageWidth - item.w, px - this.dragOffset.x)); item.y = Math.max(0, Math.min(this.editorDoc.pageHeight - item.h, py - this.dragOffset.y)); return; }
    if(this.isResizing && this.resizeHandle){
      const start = { x: item.x, y: item.y, w: item.w, h: item.h } as any;
      const minW=10, minH=10;
      const keepAR = (item.type==='image' || item.type==='sign') && (ev.shiftKey===false);
      let nx=start.x, ny=start.y, nw=start.w, nh=start.h;
      const rx = px, ry = py;
      const h = this.resizeHandle;
      const east = h.includes('e'); const west = h.includes('w'); const north = h.includes('n'); const south = h.includes('s');
      if(east){ nw = Math.max(minW, rx - start.x); }
      if(south){ nh = Math.max(minH, ry - start.y); }
      if(west){ nw = Math.max(minW, start.x + start.w - rx); nx = Math.min(rx, start.x + start.w - minW); }
      if(north){ nh = Math.max(minH, start.y + start.h - ry); ny = Math.min(ry, start.y + start.h - minH); }
      if(keepAR){
        const ar = (item as any).ar || (start.w/start.h);
        if((east || west) && !(north || south)){
          nh = Math.max(minH, Math.round(nw / ar));
          if(north){ ny = start.y + start.h - nh; }
        } else if((north || south) && !(east || west)){
          nw = Math.max(minW, Math.round(nh * ar));
          if(west){ nx = start.x + start.w - nw; }
        } else {
          // corner: choose larger scale change to derive the other
          const dw = nw / start.w; const dh = nh / start.h;
          if(Math.abs(dw) >= Math.abs(dh)){
            nh = Math.max(minH, Math.round(nw / ar)); if(north){ ny = start.y + start.h - nh; }
          } else {
            nw = Math.max(minW, Math.round(nh * ar)); if(west){ nx = start.x + start.w - nw; }
          }
        }
      }
      item.x = Math.max(0, nx); item.y = Math.max(0, ny); item.w = Math.min(this.editorDoc.pageWidth - item.x, nw); item.h = Math.min(this.editorDoc.pageHeight - item.y, nh);
      return;
    }
    if(this.isRotating){
      const cx = item.x + item.w/2; const cy = item.y + item.h/2; const ang = Math.atan2(py - cy, px - cx) * 180/Math.PI; (item as any).rot = Math.round(ang);
      return;
    }
  }
  onCanvasMouseUp(){ if(this.isDragging||this.isResizing||this.isRotating){ this.isDragging=false; this.isResizing=false; this.isRotating=false; this.resizeHandle=null; this.queueEditorSave(); } }

  // Editor: property editing
  updateSelectedText(val: string){ const it=this.getSelected(); if(it&&(it.type==='text'||it.type==='link'||it.type==='annotation')){ (it as any).text = val; this.queueEditorSave(); } }
  updateSelectedFontSize(sz: number){ const it=this.getSelected(); if(it&&(it.type==='text'||it.type==='link')){ (it as any).fontSize = Math.max(6, Math.min(96, sz||14)); this.queueEditorSave(); } }
  updateSelectedColor(color: string){ const it=this.getSelected(); if(it&&(it.type==='text'||it.type==='link')){ (it as any).color = color; this.queueEditorSave(); } }
  toggleStyle(style: 'bold'|'italic'|'underline'){ const it=this.getSelected(); if(it&&it.type==='text'){ (it as any)[style] = !(it as any)[style]; this.queueEditorSave(); } }
  rotateSelected(delta: number){ const it=this.getSelected(); if(!it) return; (it as any).rot = (((it as any).rot||0)+delta)%360; this.queueEditorSave(); }
  setSelectedWidth(newW: number){ const it=this.getSelected(); if(!it) return; newW = Math.max(10, Math.min(2000, Number(newW)||it.w)); if(it.type==='image'||it.type==='sign'){ const ar=(it.ar|| (it.w/it.h)); const newH = Math.max(10, Math.round(newW / ar)); it.w=newW; it.h=newH; } else { it.w=newW; } this.queueEditorSave(); }
  updateSelectedSize(w: number, h: number){ const it=this.getSelected(); if(it){ it.w=Math.max(10,w); it.h=Math.max(10,h); this.queueEditorSave(); } }
  deleteSelected(){ if(!this.selectedId) return; this.editorDoc.items = this.editorDoc.items.filter(i=>i.id!==this.selectedId); this.selectedId=null; this.queueEditorSave(); }
  bringToFront(){ if(!this.selectedId) return; const idx=this.editorDoc.items.findIndex(i=>i.id===this.selectedId); if(idx>=0){ const [it]=this.editorDoc.items.splice(idx,1); this.editorDoc.items.push(it); this.queueEditorSave(); } }
  // Forms: edit mode and tab order
  toggleFormEdit(){ this.formEditMode=!this.formEditMode; }
  autoTabOrder(){ const forms = this.editorDoc.items.filter(i=> i.type.startsWith('form')) as any[]; forms.sort((a,b)=> a.y===b.y ? a.x-b.x : a.y-b.y); forms.forEach((f,idx)=> f.tabIndex=idx+1); this.queueEditorSave(); }

  // Editor: persistence (local only for now)
  private loadEditorDoc(){ try { const map = JSON.parse(localStorage.getItem(this.editorStorageKey)||'{}'); const id=this.pdf?.id||'new'; const d = map[id]; if(d && d.pageWidth && d.pageHeight && Array.isArray(d.items)){ this.editorDoc = d; this.inferPageSizeFromDims(); } } catch {}
  }
  private saveEditorDoc(){ try { const id=this.pdf?.id||'new'; const raw = localStorage.getItem(this.editorStorageKey); const map = raw ? JSON.parse(raw) : {}; map[id] = this.editorDoc; localStorage.setItem(this.editorStorageKey, JSON.stringify(map)); } catch {}
  }
  queueEditorSave(){ if(this.editorSaveTimer) clearTimeout(this.editorSaveTimer); this.editorSaveTimer = setTimeout(()=> this.saveEditorDoc(), 300); }
  private inferPageSizeFromDims(){ const w=this.editorDoc.pageWidth, h=this.editorDoc.pageHeight; const approx = (a:number,b:number)=> Math.abs(a-b) < 2; if(approx(w,595.28)&&approx(h,841.89)) this.pageSize='A4'; else if(approx(w,612)&&approx(h,792)) this.pageSize='Letter'; else if(approx(w,612)&&approx(h,1008)) this.pageSize='Legal'; else { this.pageSize='Custom'; this.customPageWidth=w; this.customPageHeight=h; } }

  // Export as PDF (uses pdf-lib)
  async exportPdf(){
    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib') as any;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([this.editorDoc.pageWidth, this.editorDoc.pageHeight]);
      const fonts: Record<string, any> = {};
      const getFont = async (fam?: string) => {
        const key = (fam||'helvetica').toLowerCase();
        if(fonts[key]) return fonts[key];
        const map: Record<string, string> = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier };
        const name = map[key] || StandardFonts.Helvetica;
        fonts[key] = await pdfDoc.embedFont(name);
        return fonts[key];
      };
      const col = (hex?: string) => { if(!hex) return undefined; const c=this.hexToRgb(hex); return c? rgb(c.r/255, c.g/255, c.b/255): undefined; };
      for(const it of this.editorDoc.items){
        if(it.type==='text'){
          const font = await getFont(it.fontFamily);
          const size = it.fontSize || 14;
          const y = this.editorDoc.pageHeight - it.y - size;
          page.drawText(String(it.text||''), { x: it.x, y, size, font, color: col(it.color), rotate: degrees(it.rot||0) });
          if(it.underline){ page.drawLine({ start: { x: it.x, y: y-2 }, end: { x: it.x + it.w, y: y-2 }, thickness: 0.5, color: rgb(0,0,0) }); }
        } else if ((it.type==='image' || it.type==='sign') && (it as any).dataUrl){
          const dataUrl = (it as any).dataUrl as string;
          const isPng = dataUrl.startsWith('data:image/png');
          const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
          const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const y = this.editorDoc.pageHeight - it.y - it.h;
          page.drawImage(img, { x: it.x, y, width: it.w, height: it.h, rotate: degrees((it as any).rot||0) });
        } else if (it.type==='link'){
          const size = (it as any).fontSize || 14; const y = this.editorDoc.pageHeight - it.y - size; const font = await getFont('helvetica');
          page.drawText((it as any).text || '', { x: it.x, y, size, font, color: col((it as any).color||'#2563eb') });
          // Note: clickable links not added in this pass
        } else if (it.type==='shape'){
          const stroke = col((it as any).stroke||'#111827'); const fill = ((it as any).fill && (it as any).fill!=='transparent') ? col((it as any).fill) : undefined; const sw = (it as any).strokeWidth || 1;
          if((it as any).shape==='rect'){
            page.drawRectangle({ x: it.x, y: this.editorDoc.pageHeight - it.y - it.h, width: it.w, height: it.h, borderColor: stroke, color: fill, borderWidth: sw });
          } else if((it as any).shape==='ellipse'){
            page.drawEllipse({ x: it.x + it.w/2, y: this.editorDoc.pageHeight - it.y - it.h/2, xScale: it.w/2, yScale: it.h/2, borderColor: stroke, color: fill, borderWidth: sw });
          } else if((it as any).shape==='line'){
            page.drawLine({ start: { x: it.x, y: this.editorDoc.pageHeight - it.y }, end: { x: it.x + it.w, y: this.editorDoc.pageHeight - it.y - it.h }, color: stroke, thickness: sw });
          }
        } else if (it.type==='whiteout'){
          page.drawRectangle({ x: it.x, y: this.editorDoc.pageHeight - it.y - it.h, width: it.w, height: it.h, color: rgb(1,1,1) });
        } else if (it.type==='annotation'){
          const y = this.editorDoc.pageHeight - it.y - it.h; page.drawRectangle({ x: it.x, y, width: it.w, height: it.h, color: rgb(1,1,0) });
          const font = await getFont('helvetica'); page.drawText((it as any).text||'', { x: it.x+4, y: y + it.h - 14, size: 11, font, color: rgb(0,0,0) });
        } else if (it.type.startsWith('form')){
          // Flatten visual placeholder for non-forms export
          page.drawRectangle({ x: it.x, y: this.editorDoc.pageHeight - it.y - it.h, width: it.w, height: it.h, borderColor: rgb(0.47,0.47,0.47), borderWidth: 1 });
          const font = await getFont('helvetica'); const name = (it as any).name || '';
          if(name){ page.drawText(name, { x: it.x+3, y: this.editorDoc.pageHeight - it.y - it.h - 10, size: 9, font, color: rgb(0,0,0) }); }
        }
      }
      const name = ((this.pdf?.title)||'document').replace(/\s+/g,'-').slice(0,80);
      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { alert('Export requires pdf-lib. Please install it: yarn add pdf-lib'); }
  }
  async exportPdfWithForms(){
    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib') as any;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([this.editorDoc.pageWidth, this.editorDoc.pageHeight]);
      const form = pdfDoc.getForm();
      const fonts: Record<string, any> = {};
      const getFont = async (fam?: string) => {
        const key = (fam||'helvetica').toLowerCase();
        if(fonts[key]) return fonts[key];
        const map: Record<string, string> = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier };
        const name = map[key] || StandardFonts.Helvetica;
        fonts[key] = await pdfDoc.embedFont(name);
        return fonts[key];
      };
      const col = (hex?: string) => { if(!hex) return undefined; const c=this.hexToRgb(hex); return c? rgb(c.r/255, c.g/255, c.b/255): undefined; };
      // draw non-form items first
      for(const it of this.editorDoc.items){
        if(!it.type.startsWith('form')){ // reuse flattened drawing via exportPdf logic
          // Simple reuse by creating minimal ops here
          if(it.type==='text'){
            const font = await getFont(it.fontFamily); const size = it.fontSize || 14; const y = this.editorDoc.pageHeight - it.y - size;
            page.drawText(String(it.text||''), { x: it.x, y, size, font, color: col(it.color), rotate: degrees(it.rot||0) });
            if(it.underline){ page.drawLine({ start: { x: it.x, y: y-2 }, end: { x: it.x + it.w, y: y-2 }, thickness: 0.5, color: rgb(0,0,0) }); }
          } else if ((it.type==='image' || it.type==='sign') && (it as any).dataUrl){
            const dataUrl = (it as any).dataUrl as string; const isPng = dataUrl.startsWith('data:image/png'); const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0)); const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes); const y = this.editorDoc.pageHeight - it.y - it.h; page.drawImage(img, { x: it.x, y, width: it.w, height: it.h, rotate: degrees((it as any).rot||0) });
          } else if (it.type==='link'){
            const size = (it as any).fontSize || 14; const y = this.editorDoc.pageHeight - it.y - size; const font = await getFont('helvetica'); page.drawText((it as any).text || '', { x: it.x, y, size, font, color: col((it as any).color||'#2563eb') });
          } else if (it.type==='shape'){
            const stroke = col((it as any).stroke||'#111827'); const fill = ((it as any).fill && (it as any).fill!=='transparent') ? col((it as any).fill) : undefined; const sw = (it as any).strokeWidth || 1;
            if((it as any).shape==='rect'){ page.drawRectangle({ x: it.x, y: this.editorDoc.pageHeight - it.y - it.h, width: it.w, height: it.h, borderColor: stroke, color: fill, borderWidth: sw }); }
            else if((it as any).shape==='ellipse'){ page.drawEllipse({ x: it.x + it.w/2, y: this.editorDoc.pageHeight - it.y - it.h/2, xScale: it.w/2, yScale: it.h/2, borderColor: stroke, color: fill, borderWidth: sw }); }
            else if((it as any).shape==='line'){ page.drawLine({ start: { x: it.x, y: this.editorDoc.pageHeight - it.y }, end: { x: it.x + it.w, y: this.editorDoc.pageHeight - it.y - it.h }, color: stroke, thickness: sw }); }
          } else if (it.type==='whiteout'){
            page.drawRectangle({ x: it.x, y: this.editorDoc.pageHeight - it.y - it.h, width: it.w, height: it.h, color: rgb(1,1,1) });
          } else if (it.type==='annotation'){
            const y = this.editorDoc.pageHeight - it.y - it.h; page.drawRectangle({ x: it.x, y, width: it.w, height: it.h, color: rgb(1,1,0) }); const font = await getFont('helvetica'); page.drawText((it as any).text||'', { x: it.x+4, y: y + it.h - 14, size: 11, font, color: rgb(0,0,0) });
          }
        }
      }
      // Add form fields in tab order
      const formItems = this.editorDoc.items.filter(i=> i.type.startsWith('form')) as any[];
      formItems.sort((a,b)=> (a.tabIndex||0) - (b.tabIndex||0));
      for(const it of formItems){
        const name = (it as any).name || it.id; const x = it.x; const y = this.editorDoc.pageHeight - it.y - it.h; const width = it.w; const height = it.h;
        if(it.type==='formText'){
          const f = form.createTextField(name); f.addToPage(page, { x, y, width, height });
        } else if(it.type==='formTextarea'){
          const f = form.createTextField(name); (f as any).setMultiline ? (f as any).setMultiline(true) : (f as any).enableMultiline && (f as any).enableMultiline(); f.addToPage(page, { x, y, width, height });
        } else if(it.type==='formSelect'){
          const f = form.createDropdown(name); if(Array.isArray(it.options)) f.setOptions(it.options as any); f.addToPage(page, { x, y, width, height });
        } else if(it.type==='formRadio'){
          const g = form.createRadioGroup(name); const opt = 'opt1'; g.addOptionToPage(opt, page, { x, y, width: Math.min(width, height), height: Math.min(width, height) });
        } else if(it.type==='formCheckbox'){
          const f = form.createCheckBox(name); f.addToPage(page, { x, y, width: Math.min(width, height), height: Math.min(width, height) });
        } else if(it.type==='formSignature'){
          const f = form.createSignature(name); f.addToPage(page, { x, y, width, height });
        }
      }
      const name = ((this.pdf?.title)||'document-forms').replace(/\s+/g,'-').slice(0,80);
      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { alert('Forms export requires pdf-lib. Please install it: yarn add pdf-lib'); }
  }

  // utils
  getSelected(){ return this.editorDoc.items.find(i=>i.id===this.selectedId) || null; }
  private uuid(): string { return 'i_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  private hexToRgb(hex: string){ try { const m = hex.replace('#',''); const bigint = parseInt(m,16); if(m.length===6) return { r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255 }; } catch {} return null; }
  shapeBorder(it: any): string { if(!it || it.shape==='line') return 'none'; const w = it.strokeWidth || 1; const col = it.stroke || '#111827'; return `${w}px solid ${col}`; }
  shapeFill(it: any): string { if(!it) return 'transparent'; return it.shape==='line' ? 'transparent' : (it.fill || 'transparent'); }
  lineBorderTop(it: any): string { const w = (it && it.strokeWidth) || 1; const col = (it && it.stroke) || '#111827'; return `${w}px solid ${col}`; }
  transformStyle(it: any): string { const rot = (it && it.rot) || 0; return rot ? `rotate(${rot}deg)` : ''; }
  itemDataUrl(it: any): string { return it && it.dataUrl ? it.dataUrl : ''; }
  itemFontSize(it: any): number { return (it && it.fontSize) ? Number(it.fontSize) : 14; }
  itemColor(it: any, fallback: string = '#2563eb'): string { return (it && it.color) ? it.color : fallback; }
  itemText(it: any): string { return (it && typeof it.text==='string') ? it.text : ''; }
  isLineShape(it: any): boolean { return !!it && it.shape==='line'; }
  fieldName(it: any): string { return (it && it.name) ? it.name : 'field'; }
  fieldTabIndex(it: any): number { return (it && typeof it.tabIndex==='number') ? it.tabIndex : 0; }
  handleLeft(it: any, h: string): number {
    if(!it) return 0; const w = Number(it.w)||0;
    const map: Record<string, number> = { nw: -2, n: w/2 - 2, ne: w - 2, e: w - 2, se: w - 2, s: w/2 - 2, sw: -2, w: -2 };
    const val = (map[h] ?? -2);
    return val * this.displayScale;
  }
  handleTop(it: any, h: string): number {
    if(!it) return 0; const hh = Number(it.h)||0;
    const map: Record<string, number> = { nw: -2, n: -2, ne: -2, e: hh/2 - 2, se: hh - 2, s: hh - 2, sw: hh - 2, w: hh/2 - 2 };
    const val = (map[h] ?? -2);
    return val * this.displayScale;
  }
  // Selected getters for template bindings
  getSelFontSize(): number { const it=this.getSelected(); if(!it) return 14; return (it as any).fontSize || 14; }
  getSelColor(): string { const it=this.getSelected(); if(!it) return '#000000'; return (it as any).color || '#000000'; }
  getSelUrl(): string { const it=this.getSelected(); if(!it) return ''; return (it as any).url || ''; }
  setSelectedUrl(url: string){ const it=this.getSelected(); if(!it) return; (it as any).url = url; this.queueEditorSave(); }
  getSelStroke(): string { const it=this.getSelected(); return it ? ((it as any).stroke||'#111827') : '#111827'; }
  setSelStroke(v: string){ const it=this.getSelected(); if(!it) return; (it as any).stroke=v; this.queueEditorSave(); }
  getSelFill(): string { const it=this.getSelected(); return it ? ((it as any).fill||'transparent') : 'transparent'; }
  setSelFill(v: string){ const it=this.getSelected(); if(!it) return; (it as any).fill=v; this.queueEditorSave(); }
  getSelStrokeWidth(): number { const it=this.getSelected(); return it ? Number((it as any).strokeWidth||1) : 1; }
  setSelStrokeWidth(v: number){ const it=this.getSelected(); if(!it) return; (it as any).strokeWidth=Number(v)||1; this.queueEditorSave(); }
  getSelText(): string { const it=this.getSelected(); return it ? ((it as any).text||'') : ''; }
  getSelName(): string { const it=this.getSelected(); return it ? ((it as any).name||'') : ''; }
  setSelName(v: string){ const it=this.getSelected(); if(!it) return; (it as any).name=v; this.queueEditorSave(); }
  getSelTabIndex(): number { const it=this.getSelected(); return it ? Number((it as any).tabIndex||0) : 0; }
  setSelTabIndex(v: any){ const it=this.getSelected(); if(!it) return; (it as any).tabIndex=Number(v)||0; this.queueEditorSave(); }
  getSelOptionsString(): string { const it=this.getSelected() as any; return Array.isArray(it?.options) ? it.options.join(', ') : ''; }
  setSelOptionsString(v: string){ const it=this.getSelected() as any; if(!it) return; it.options=String(v).split(',').map((s:string)=>s.trim()).filter(Boolean); this.queueEditorSave(); }

  // Upload existing PDF (requires pdf.js)
  showUpload(){ this.uploadModal=true; }
  async onUploadFile(files: FileList|null){
    if(!files || files.length===0){ this.uploadModal=false; return; }
    const file = files[0]; if(file.type!=='application/pdf'){ alert('Please select a PDF file.'); return; }
    try{
      const pdfjsLib: any = await import('pdfjs-dist');
      const buf = await file.arrayBuffer();
      // Use workerless rendering to avoid worker wiring hassles in first pass
      const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true } as any).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(this.editorDoc.pageWidth/viewport.width, this.editorDoc.pageHeight/viewport.height);
      const v2 = page.getViewport({ scale });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(v2.width); canvas.height = Math.ceil(v2.height);
      const ctx = canvas.getContext('2d'); if(!ctx) throw new Error('no ctx');
      await page.render({ canvasContext: ctx, viewport: v2 }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      this.editorDoc.items.unshift({ id: this.uuid(), type: 'image', x: 0, y: 0, w: v2.width, h: v2.height, dataUrl, ar: v2.width/v2.height });
      try { (page as any).cleanup && (page as any).cleanup(); (page as any).destroy && (page as any).destroy(); (pdf as any).cleanup && (pdf as any).cleanup(); (pdf as any).destroy && (pdf as any).destroy(); } catch {}
      try { canvas.width = 0; canvas.height = 0; } catch {}
      this.queueEditorSave();
    } catch(e){ alert('Failed to render PDF: ' + (e as any)?.message); }
    this.uploadModal=false;
  }

  // Signature drawing
  openSign(){ this.signModal=true; setTimeout(()=> this.initSigCanvas(), 0); }
  private initSigCanvas(){
    const el = document.getElementById('sig-canvas') as HTMLCanvasElement|null; if(!el) return; this.sigCanvas=el; this.sigCtx=el.getContext('2d'); if(!this.sigCtx) return; this.sigCtx.lineWidth=2; this.sigCtx.lineCap='round'; this.sigCtx.strokeStyle='#111827';
  }
  sigStart(ev: MouseEvent){ this.sigDrawing=true; const rect=(ev.target as HTMLCanvasElement).getBoundingClientRect(); this.sigLast={ x: ev.clientX-rect.left, y: ev.clientY-rect.top }; }
  sigMove(ev: MouseEvent){ if(!this.sigDrawing||!this.sigCtx||!this.sigLast) return; const rect=(ev.target as HTMLCanvasElement).getBoundingClientRect(); const x=ev.clientX-rect.left, y=ev.clientY-rect.top; this.sigCtx.beginPath(); this.sigCtx.moveTo(this.sigLast.x, this.sigLast.y); this.sigCtx.lineTo(x,y); this.sigCtx.stroke(); this.sigLast={x,y}; }
  sigEnd(){ this.sigDrawing=false; this.sigLast=null; }
  sigClear(){ if(!this.sigCtx||!this.sigCanvas) return; this.sigCtx.clearRect(0,0,this.sigCanvas.width,this.sigCanvas.height); }
  sigSave(){ if(!this.sigCanvas) { this.signModal=false; return; } const url=this.sigCanvas.toDataURL('image/png'); const id=this.uuid(); const w=200,h=80; this.editorDoc.items.push({ id, type:'sign', x:60, y:80, w, h, dataUrl:url, ar:w/h }); this.selectedId=id; this.queueEditorSave(); this.signModal=false; }
}
