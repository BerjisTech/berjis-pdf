import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfsService, PdfDoc } from '../../pdfs.service';

@Component({
  standalone: true,
  selector: 'app-pdf',
  imports: [CommonModule, FormsModule],
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
    pages?: { id: string; items: any[] }[];
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
  displayScale = 1; // preview scale: px per pt (smaller preview)
  private editorSaveTimer?: any;
  private readonly editorStorageKey = 'berjis-pdf-editor-docs';
  private fileInput?: HTMLInputElement;
  formEditMode = true;
  // signature modal
  signModal = false; sigDrawing = false; sigCanvas?: HTMLCanvasElement; sigCtx?: CanvasRenderingContext2D|null; sigLast?: {x:number,y:number}|null = null;
  uploadModal = false;
  // multi-page state
  currentPage = 0;
  uploadPages: { index: number; dataUrl: string; width: number; height: number; selected: boolean }[] = [];
  // grid & snap
  gridEnabled = true;
  gridSize = 10; // points
  gridVisible = false;
  // Share modal
  shareOpen = false;
  shareRows: { userId: string; role: 'viewer'|'commenter'|'editor' }[] = [];
  shareUserId = '';
  shareRole: 'viewer'|'commenter'|'editor' = 'viewer';
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
    { name: 'Insert', menus: [
      { icon: '', name: 'Text', action: 'insertText' },
      { icon: '', name: 'Link', action: 'insertLink' },
      { icon: '', name: 'Image', action: 'insertImage' },
      { icon: '', name: 'Signature', action: 'insertSignature' },
      { icon: '', name: 'Whiteout', action: 'insertWhiteout' },
      { icon: '', name: 'Annotate', action: 'insertAnnotation' },
      { icon: '', name: 'Shape: Rectangle', action: 'insertShapeRect' },
      { icon: '', name: 'Shape: Ellipse', action: 'insertShapeEllipse' },
      { icon: '', name: 'Shape: Line', action: 'insertShapeLine' },
      { icon: '', name: 'Form: Text', action: 'insertFormText' },
      { icon: '', name: 'Form: Text multiline', action: 'insertFormTextarea' },
      { icon: '', name: 'Form: Drop-down list', action: 'insertFormSelect' },
      { icon: '', name: 'Form: Radio button', action: 'insertFormRadio' },
      { icon: '', name: 'Form: Checkbox', action: 'insertFormCheckbox' },
      { icon: '', name: 'Form: Signature box', action: 'insertFormSignature' }
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

  // History (undo/redo)
  private history: { doc: any; selectedId: string | null; currentPage: number }[] = [];
  private historyIndex = -1;
  private pushHistory(){
    try {
      const snap = {
        doc: JSON.parse(JSON.stringify(this.editorDoc)),
        selectedId: this.selectedId,
        currentPage: this.currentPage,
      };
      // truncate future if after undo
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      this.history.push(snap);
      if (this.history.length > 50) { this.history.shift(); }
      this.historyIndex = this.history.length - 1;
    } catch {}
  }
  undo(){
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    const h = this.history[this.historyIndex];
    this.editorDoc = JSON.parse(JSON.stringify(h.doc));
    this.selectedId = h.selectedId;
    this.currentPage = h.currentPage;
    this.inferPageSizeFromDims();
    this.ensurePages();
    this.saveEditorDoc();
  }
  redo(){
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const h = this.history[this.historyIndex];
    this.editorDoc = JSON.parse(JSON.stringify(h.doc));
    this.selectedId = h.selectedId;
    this.currentPage = h.currentPage;
    this.inferPageSizeFromDims();
    this.ensurePages();
    this.saveEditorDoc();
  }

  onMenu(action: string){
    switch(action){
      case 'new': this.router.navigate(['/pdf','new']); break;
      case 'open': { this.showOpen(); break; }
      case 'download': this.download(); break;
      case 'rename': this.showRename(); break;
      case 'exportPdf': this.exportPdf(); break;
      case 'exportPdfForms': this.exportPdfWithForms(); break;
      case 'upload': this.showUpload(); break;
      // Insert shortcuts
      case 'insertText': this.addTextBox(); break;
      case 'insertLink': this.addLink(); break;
      case 'insertImage': this.addImage(); break;
      case 'insertSignature': this.openSign(); break;
      case 'insertWhiteout': this.addWhiteout(); break;
      case 'insertAnnotation': this.addAnnotationItem(); break;
      case 'insertShapeRect': this.addShape('rect'); break;
      case 'insertShapeEllipse': this.addShape('ellipse'); break;
      case 'insertShapeLine': this.addShape('line'); break;
      case 'insertFormText': this.addFormField('formText'); break;
      case 'insertFormTextarea': this.addFormField('formTextarea'); break;
      case 'insertFormSelect': this.addFormField('formSelect'); break;
      case 'insertFormRadio': this.addFormField('formRadio'); break;
      case 'insertFormCheckbox': this.addFormField('formCheckbox'); break;
      case 'insertFormSignature': this.addFormField('formSignature'); break;
      case 'print': window.print(); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'zoomIn': this.zoom = Math.min(4, Math.round((this.zoom + 0.1) * 10) / 10); break;
      case 'zoomOut': this.zoom = Math.max(0.25, Math.round((this.zoom - 0.1) * 10) / 10); break;
      case 'pageView': this.zoom = 1; break;
      case 'rotate': this.rotateSelected(90); break;
      case 'find': { const q = prompt('Find text'); if (q) this.findInItems(q); break; }
      case 'highlight': { const id=this.uuid(); this.editorDoc.items.push({ id, type: 'shape', x: 40, y: 40, w: 200, h: 24, rot: 0, stroke:'#f59e0b', fill:'#fde68a', strokeWidth: 0.5, shape: 'rect' }); this.selectedId=id; this.queueEditorSave(); break; }
      case 'comment': this.addAnnotationItem(); break;
      case 'draw': this.addShape('line'); break;
      case 'help': this.openHelp('pdf'); break;
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
    this.ensurePages();
    // seed history after initial load
    this.pushHistory();
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
    const fontSize = 14; const h = fontSize + 4;
    this.editorDoc.items.push({ id, type: 'text', x: 40, y: 60, w: 200, h, text: 'Text', fontSize, color: '#000000', fontFamily: 'helvetica' });
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
        const dataUrl = String(reader.result);
        const probe = new Image();
        probe.onload = () => {
          const natW = probe.naturalWidth || 800; const natH = probe.naturalHeight || 600; const ar0 = natW / Math.max(1, natH);
          // Fit into a reasonable box preserving aspect ratio
          const maxW = Math.min(300, this.editorDoc.pageWidth * 0.6);
          const maxH = Math.min(300, this.editorDoc.pageHeight * 0.6);
          const scale = Math.min(maxW / natW, maxH / natH, 1);
          const w = Math.round(natW * scale); const h = Math.round(natH * scale);
          const id = this.uuid();
          this.editorDoc.items.push({ id, type: 'image', x: 60, y: 80, w, h, dataUrl, ar: ar0 });
          this.selectedId = id; this.queueEditorSave(); el.value='';
        };
        probe.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
    document.body.appendChild(el); this.fileInput = el;
  }
  addSignature(){ this.addImage(); }
  addWhiteout(){ const id=this.uuid(); this.editorDoc.items.push({ id, type: 'whiteout', x: 80, y: 120, w: 160, h: 50 }); this.selectedId=id; this.queueEditorSave(); }
  addAnnotationItem(){ const id=this.uuid(); this.editorDoc.items.push({ id, type: 'annotation', x: 50, y: 50, w: 140, h: 80, text: 'Note' }); this.selectedId=id; this.queueEditorSave(); }
  private findInItems(q: string){ const qq=q.toLowerCase(); const pages = (this.editorDoc.pages&&this.editorDoc.pages.length? this.editorDoc.pages: [{ items: this.editorDoc.items } as any]); for (let pi=0; pi<pages.length; pi++){ const items = pages[pi].items||[]; const it = items.find((i:any)=> (i.text||'').toLowerCase().includes(qq)); if (it){ this.currentPage = Math.max(0, Math.min(pi, (this.editorDoc.pages?.length||1)-1)); if (this.editorDoc.pages && this.editorDoc.pages.length){ this.editorDoc.items = this.editorDoc.pages[this.currentPage].items; } this.selectedId = it.id; this.queueEditorSave(); break; } } }
  addShape(shape: 'rect'|'ellipse'|'line'){ const id=this.uuid(); const base={ id, type: 'shape' as const, x: 100, y: 120, w: 120, h: 80, rot: 0, stroke:'#111827', fill: shape==='line' ? 'transparent' : '#e5e7eb', strokeWidth: 1 }; this.editorDoc.items.push({ ...base, shape }); this.selectedId=id; this.queueEditorSave(); }
  addFormField(kind: 'formText'|'formTextarea'|'formSelect'|'formRadio'|'formCheckbox'|'formSignature'){
    const id=this.uuid(); const base={ id, x: 120, y: 140, w: 200, h: kind==='formTextarea'?80:28, name: `${kind}_${id.slice(-4)}`, tabIndex: 0 } as any;
    if(kind==='formSelect') base.options=['Option 1','Option 2'];
    this.editorDoc.items.push({ type: kind, ...base }); this.selectedId=id; this.queueEditorSave();
  }

  // Editor: selection and dragging
  selectItem(id: string){ this.selectedId = id; }
  onCanvasMouseDown(ev: MouseEvent){
    const src = ev.currentTarget as HTMLElement;
    const target = ev.target as HTMLElement;
    // ignore clicks on editor UI overlays (toolbars, menus)
    if (target && (target.closest && target.closest('.editor-ui'))) return;
    // rotate handle
    const rotateAttr = (src.getAttribute('data-rotate') || target.getAttribute('data-rotate'));
    if(rotateAttr==='1' && this.selectedId){ this.isRotating=true; ev.preventDefault(); return; }
    // resize handle
    const rh = (src.getAttribute('data-rh') || target.getAttribute('data-rh')) as any;
    const idAttr = (src.getAttribute('data-eid') || target.getAttribute('data-eid'));
    if (rh && idAttr){ this.selectedId=idAttr; this.isResizing=true; this.resizeHandle=rh; ev.preventDefault(); return; }
    const id = idAttr;
    if (!id) { this.selectedId = null; return; }
    this.selectedId = id; this.isDragging = true;
    const item = this.editorDoc.items.find(i => i.id===id); if(!item) return;
    const pageEl = (target.closest && target.closest('[data-page="1"]')) as HTMLElement || (src.closest && src.closest('[data-page="1"]')) as HTMLElement || src;
    const rect = pageEl.getBoundingClientRect();
    const factor = this.displayScale * this.zoom;
    const px = (ev.clientX - rect.left) / factor; const py = (ev.clientY - rect.top) / factor;
    this.dragOffset.x = px - item.x; this.dragOffset.y = py - item.y;
  }
  onCanvasMouseMove(ev: MouseEvent){
    const src = ev.currentTarget as HTMLElement; const target = ev.target as HTMLElement;
    const pageEl = (target.closest && target.closest('[data-page="1"]')) as HTMLElement || (src.closest && src.closest('[data-page="1"]')) as HTMLElement || src;
    const rect = pageEl.getBoundingClientRect(); const factor = this.displayScale * this.zoom; const px=(ev.clientX-rect.left)/factor; const py=(ev.clientY-rect.top)/factor;
    const item = this.selectedId ? this.editorDoc.items.find(i=>i.id===this.selectedId) : null; if(!item) return;
    if(this.isDragging){
      let nx = px - this.dragOffset.x; let ny = py - this.dragOffset.y;
      if(this.gridEnabled && !ev.altKey){ nx = this.snap(nx); ny = this.snap(ny); }
      item.x = Math.max(0, Math.min(this.editorDoc.pageWidth - item.w, nx));
      item.y = Math.max(0, Math.min(this.editorDoc.pageHeight - item.h, ny));
      return;
    }
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
      if(this.gridEnabled && !ev.altKey){ nx=this.snap(nx); ny=this.snap(ny); nw=this.snap(nw); nh=this.snap(nh); }
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
  updateSelectedFontSize(sz: number){ const it=this.getSelected(); if(it&&(it.type==='text'||it.type==='link')){ const fs = Math.max(6, Math.min(96, sz||14)); (it as any).fontSize = fs; (it as any).h = fs + 4; this.queueEditorSave(); } }
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
  queueEditorSave(){
    if (!this.editorSaveTimer) this.pushHistory();
    if (this.editorSaveTimer) clearTimeout(this.editorSaveTimer);
    this.editorSaveTimer = setTimeout(()=> this.saveEditorDoc(), 300);
  }
  private inferPageSizeFromDims(){ const w=this.editorDoc.pageWidth, h=this.editorDoc.pageHeight; const approx = (a:number,b:number)=> Math.abs(a-b) < 2; if(approx(w,595.28)&&approx(h,841.89)) this.pageSize='A4'; else if(approx(w,612)&&approx(h,792)) this.pageSize='Letter'; else if(approx(w,612)&&approx(h,1008)) this.pageSize='Legal'; else { this.pageSize='Custom'; this.customPageWidth=w; this.customPageHeight=h; } }

  // Pages management
  private ensurePages(){
    if(!Array.isArray(this.editorDoc.pages) || this.editorDoc.pages!.length===0){
      this.editorDoc.pages = [{ id: this.uuid(), items: this.editorDoc.items }];
      this.currentPage = 0;
    } else {
      // point items to current page's items for backward bindings
      this.currentPage = Math.min(this.currentPage, this.editorDoc.pages!.length-1);
      this.editorDoc.items = this.editorDoc.pages![this.currentPage].items;
    }
  }
  selectPage(i: number){ if(!this.editorDoc.pages) return; this.currentPage = Math.max(0, Math.min(i, this.editorDoc.pages.length-1)); this.editorDoc.items = this.editorDoc.pages[this.currentPage].items; this.selectedId=null; this.queueEditorSave(); }
  addPage(){ if(!this.editorDoc.pages) this.editorDoc.pages=[]; const newItems: any[] = []; this.editorDoc.pages.push({ id: this.uuid(), items: newItems }); this.selectPage(this.editorDoc.pages.length-1); }
  deletePage(i: number){ if(!this.editorDoc.pages || this.editorDoc.pages.length<=1) return; this.editorDoc.pages.splice(i,1); this.selectPage(Math.max(0, Math.min(this.currentPage, this.editorDoc.pages.length-1))); }
  movePage(i: number, dir: -1|1){ if(!this.editorDoc.pages) return; const j=i+dir; if(j<0||j>=this.editorDoc.pages.length) return; const [p]=this.editorDoc.pages.splice(i,1); this.editorDoc.pages.splice(j,0,p); this.selectPage(j); }

  // Export as PDF (uses pdf-lib)
  async exportPdf(){
    try {
      const { PDFDocument, rgb, StandardFonts, degrees, PDFName, PDFArray, PDFNumber, PDFString } = await import('pdf-lib') as any;
      const pdfDoc = await PDFDocument.create();
      const pages = (this.editorDoc.pages && this.editorDoc.pages.length>0) ? this.editorDoc.pages : [{ id: this.uuid(), items: this.editorDoc.items } as any];
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
      for(const pg of pages){
        const page = pdfDoc.addPage([this.editorDoc.pageWidth, this.editorDoc.pageHeight]);
        const items = pg.items || [];
        for(const it of items){
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
          // Add a link annotation over the text area
          try { this.addLinkAnnotation(pdfDoc, page, it.x, this.editorDoc.pageHeight - it.y - ((it as any).h || size), it.w, ((it as any).h || size), (it as any).url || '', { PDFName, PDFArray, PDFNumber, PDFString }); } catch {}
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
      }
      const name = ((this.pdf?.title)||'document').replace(/\s+/g,'-').slice(0,80);
      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { alert('Export requires pdf-lib. Please install it: yarn add pdf-lib'); }
  }
  private openHelp(app: 'docs'|'sheets'|'slides'|'pdf'){ const sp = localStorage.getItem(`berjis_help_url_${app}`); const g = localStorage.getItem('berjis_help_url'); const u = sp||g||`/help/${app}`; window.open(u, '_blank'); }
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
  private addLinkAnnotation(pdfDoc: any, page: any, x: number, y: number, w: number, h: number, url: string, lib: any){
    const { PDFName, PDFArray, PDFNumber, PDFString } = lib;
    const ctx = pdfDoc.context;
    const rect = PDFArray.withContext(ctx);
    rect.push(PDFNumber.of(x), PDFNumber.of(y), PDFNumber.of(x + w), PDFNumber.of(y + h));
    const border = PDFArray.withContext(ctx); border.push(PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0));
    const annot = ctx.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Link'),
      Rect: rect,
      Border: border,
      A: ctx.obj({ S: PDFName.of('URI'), URI: PDFString.of(url||'') })
    });
    const annotRef = ctx.register(annot);
    const Annots = PDFName.of('Annots');
    let annots = (page as any).node.get(Annots);
    if (!annots) { annots = ctx.obj([]); (page as any).node.set(Annots, annots); }
    annots.push(annotRef);
  }
  shapeBorder(it: any): string { if(!it || it.shape==='line') return 'none'; const w = it.strokeWidth || 1; const col = it.stroke || '#111827'; return `${w}px solid ${col}`; }
  shapeFill(it: any): string { if(!it) return 'transparent'; return it.shape==='line' ? 'transparent' : (it.fill || 'transparent'); }
  lineBorderTop(it: any): string { const w = (it && it.strokeWidth) || 1; const col = (it && it.stroke) || '#111827'; return `${w}px solid ${col}`; }
  transformStyle(it: any): string { const rot = (it && it.rot) || 0; return rot ? `rotate(${rot}deg)` : ''; }
  itemDataUrl(it: any): string { return it && it.dataUrl ? it.dataUrl : ''; }
  itemFontSize(it: any): number { return (it && it.fontSize) ? Number(it.fontSize) : 14; }
  itemColor(it: any, fallback: string = '#2563eb'): string { return (it && it.color) ? it.color : fallback; }
  itemText(it: any): string { return (it && typeof it.text==='string') ? it.text : ''; }
  widthPx(it: any): number { return Math.round((it?.w||0) * this.displayScale); }
  heightPx(it: any): number {
    if(!it) return 0;
    if(it.type==='text' || it.type==='link'){ const fs = (it.fontSize||14); return Math.round((fs + 4) * this.displayScale); }
    if((it.type==='image'||it.type==='sign')){ const ar = (it.ar || (it.w && it.h ? it.w/it.h : 1)) || 1; const h = ar ? (it.w / ar) : (it.h||0); return Math.round(h * this.displayScale); }
    return Math.round((it.h||0) * this.displayScale);
  }
  isImg(it: any): boolean { return !!it && (it.type==='image' || it.type==='sign'); }
  aspectRatioVal(it: any): string { const ar = (it?.ar) ?? ((it?.w && it?.h) ? (it.w/it.h) : 1); return String(ar || 1); }
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
    if(!it) return 0; const hh = this.displayHeightPt(it);
    const map: Record<string, number> = { nw: -2, n: -2, ne: -2, e: hh/2 - 2, se: hh - 2, s: hh - 2, sw: hh - 2, w: hh/2 - 2 };
    const val = (map[h] ?? -2);
    return val * this.displayScale;
  }
  private displayHeightPt(it: any): number { if(!it) return 0; if(it.type==='image'||it.type==='sign'){ const ar = (it.ar || (it.w && it.h ? it.w/it.h : 1)) || 1; return ar ? it.w / ar : (it.h||0); } return it.h||0; }
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

  // Keyboard shortcuts
  @HostListener('window:keydown', ['$event'])
  handleKeydown(ev: KeyboardEvent){
    // avoid when modals or inputs are focused
    const active = document.activeElement as HTMLElement | null;
    const isTyping = !!active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.isContentEditable);
    if (isTyping) return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selectedId && !this.signModal && !this.openModal && !this.renameModal && !this.uploadModal){ this.deleteSelected(); ev.preventDefault(); }
    if (ev.key === 'Escape'){ this.selectedId = null; }
    // Undo/redo
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) this.redo(); else this.undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); this.redo(); return; }
    // Clipboard: copy/cut/paste selected items
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c') { this.copySelected(); ev.preventDefault(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'x') { this.cutSelected(); ev.preventDefault(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') { this.pasteClipboard(); ev.preventDefault(); return; }
    if (this.selectedId && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)){
      const it = this.getSelected(); if(!it) return;
      const step = ev.shiftKey ? 10 : 1;
      if(ev.key==='ArrowLeft') it.x = Math.max(0, it.x - step);
      if(ev.key==='ArrowRight') it.x = Math.min(this.editorDoc.pageWidth - it.w, it.x + step);
      if(ev.key==='ArrowUp') it.y = Math.max(0, it.y - step);
      if(ev.key==='ArrowDown') it.y = Math.min(this.editorDoc.pageHeight - it.h, it.y + step);
      this.queueEditorSave(); ev.preventDefault();
    }
  }

  // Clipboard helpers
  private clipboard: any | null = null;
  private deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
  copySelected(){ const it = this.getSelected(); if(!it) return; this.clipboard = this.deepClone(it); }
  cutSelected(){ const it = this.getSelected(); if(!it) return; this.clipboard = this.deepClone(it); this.deleteSelected(); }
  pasteClipboard(){ if(!this.clipboard) return; const it = this.deepClone(this.clipboard); it.id = this.uuid(); it.x = Math.min(this.editorDoc.pageWidth - it.w, (it.x||0) + 10); it.y = Math.min(this.editorDoc.pageHeight - it.h, (it.y||0) + 10); this.editorDoc.items.push(it); this.selectedId = it.id; this.queueEditorSave(); }

  // Snap helper
  private snap(v: number){ const g = Math.max(1, Number(this.gridSize)||10); return Math.round(v / g) * g; }

  // Thumbnails: render to canvas on hover
  renderPageThumb(i: number, el: any){ try {
      const pg = this.editorDoc.pages?.[i]; if(!pg || !el || typeof el.getContext!=='function') return;
      const ctx = el.getContext('2d'); if(!ctx) return; const W=Number(el.width)||120, H=Number(el.height)||160; ctx.clearRect(0,0,W,H); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
      const sx = W / this.editorDoc.pageWidth; const sy = H / this.editorDoc.pageHeight; const s = Math.min(sx, sy);
      for(const it of pg.items){
        if(it.type==='text'){ ctx.fillStyle = it.color||'#111'; ctx.font = `${Math.max(8, Math.floor((it.fontSize||14)*s))}px Arial`; ctx.fillText(it.text||'', it.x*s, (it.y + (it.fontSize||14))*s); }
        else if((it.type==='image'||it.type==='sign') && (it as any).dataUrl){ const img = new Image(); const x=it.x*s, y=it.y*s, w=it.w*s, h=it.h*s; img.onload = ()=> { ctx.drawImage(img, x, y, w, h); }; img.src = (it as any).dataUrl; }
        else if(it.type==='shape'){ ctx.strokeStyle=(it as any).stroke||'#111'; ctx.lineWidth=(it as any).strokeWidth||1; if((it as any).shape==='rect'){ if((it as any).fill && (it as any).fill!=='transparent'){ ctx.fillStyle=(it as any).fill; ctx.fillRect(it.x*s, it.y*s, it.w*s, it.h*s); } ctx.strokeRect(it.x*s, it.y*s, it.w*s, it.h*s); }
          else if((it as any).shape==='ellipse'){ ctx.beginPath(); ctx.ellipse((it.x+it.w/2)*s,(it.y+it.h/2)*s,(it.w/2)*s,(it.h/2)*s,0,0,Math.PI*2); if((it as any).fill && (it as any).fill!=='transparent'){ ctx.fillStyle=(it as any).fill; ctx.fill(); } ctx.stroke(); }
          else if((it as any).shape==='line'){ ctx.beginPath(); ctx.moveTo(it.x*s, it.y*s); ctx.lineTo((it.x+it.w)*s, (it.y+it.h)*s); ctx.stroke(); } }
        else if(it.type==='whiteout'){ ctx.fillStyle='#ffffff'; ctx.fillRect(it.x*s, it.y*s, it.w*s, it.h*s); }
        else if(it.type==='annotation'){ ctx.fillStyle='#fde047'; ctx.fillRect(it.x*s, it.y*s, it.w*s, it.h*s); }
        else if(it.type.startsWith('form')){ ctx.strokeStyle='#60a5fa'; ctx.strokeRect(it.x*s, it.y*s, it.w*s, it.h*s); }
      }
      ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,W,H);
    } catch {}
  }

  // Upload existing PDF (requires pdf.js)
  showUpload(){ this.uploadModal=true; this.uploadPages=[]; }
  async onUploadFile(files: FileList|null){
    if(!files || files.length===0){ this.uploadModal=false; return; }
    const file = files[0]; if(file.type!=='application/pdf'){ alert('Please select a PDF file.'); return; }
    try{
      const pdfjsLib: any = await import('pdfjs-dist');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true } as any).promise;
      const maxPages = Math.min(30, pdf.numPages||1);
      this.uploadPages = [];
      for(let i=1;i<=maxPages;i++){
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(this.editorDoc.pageWidth/viewport.width, this.editorDoc.pageHeight/viewport.height);
        const v2 = page.getViewport({ scale });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(v2.width); canvas.height = Math.ceil(v2.height);
        const ctx = canvas.getContext('2d'); if(!ctx) throw new Error('no ctx');
        await page.render({ canvasContext: ctx, viewport: v2 }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        this.uploadPages.push({ index: i, dataUrl, width: v2.width, height: v2.height, selected: i<=5 });
        try { (page as any).cleanup && (page as any).cleanup(); } catch {}
        try { canvas.width = 0; canvas.height = 0; } catch {}
      }
      try { (pdf as any).cleanup && (pdf as any).cleanup(); (pdf as any).destroy && (pdf as any).destroy(); } catch {}
    } catch(e){ alert('Failed to render PDF: ' + (e as any)?.message); }
  }
  toggleUploadSelectAll(sel: boolean){ this.uploadPages = this.uploadPages.map(p => ({ ...p, selected: sel })); }
  insertUpload(mode: 'pages'|'images'){
    const chosen = this.uploadPages.filter(p=>p.selected);
    if(chosen.length===0){ alert('Select at least one page'); return; }
    if(mode==='pages'){
      for(const p of chosen){
        const items = [{ id: this.uuid(), type: 'image', x: 0, y: 0, w: p.width, h: p.height, dataUrl: p.dataUrl, ar: p.width/p.height } as any];
        if(!this.editorDoc.pages) this.editorDoc.pages=[];
        this.editorDoc.pages.push({ id: this.uuid(), items });
      }
      this.selectPage((this.editorDoc.pages?.length||1)-1);
    } else {
      // insert into current page as stacked images
      for(const p of chosen){ this.editorDoc.items.push({ id: this.uuid(), type: 'image', x: 0, y: 0, w: p.width, h: p.height, dataUrl: p.dataUrl, ar: p.width/p.height } as any); }
    }
    this.queueEditorSave(); this.uploadModal=false; this.uploadPages=[];
  }

  // Share helpers
  openShare(){ this.shareOpen = true; this.loadCollaborators(); }
  async loadCollaborators(){
    if(!this.pdf) return; try {
      const res = await fetch(`/v1/pdfs/${encodeURIComponent(this.pdf.id)}/collaborators`, { credentials: 'include' });
      const j = await res.json(); const rows = (j?.data||[]) as any[];
      this.shareRows = rows.map(r => ({ userId: r.userId || r.user_id, role: (r.permission==='edit'?'editor':r.permission==='comment'?'commenter':'viewer') }));
    } catch { this.shareRows = []; }
  }
  async addCollaborator(){ if(!this.pdf) return; const userId=this.shareUserId.trim(); if(!userId) return; const role=this.shareRole; await fetch(`/v1/pdfs/${encodeURIComponent(this.pdf.id)}/collaborators`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) }); this.shareUserId=''; await this.loadCollaborators(); }
  async removeCollaborator(uid: string){ if(!this.pdf) return; await fetch(`/v1/pdfs/${encodeURIComponent(this.pdf.id)}/collaborators?user_id=${encodeURIComponent(uid)}`, { method: 'DELETE', credentials: 'include' }); await this.loadCollaborators(); }

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
