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
  contextMenus: { name: string, menus: { icon: string, name: string, action: string }[] }[] = [
    { name: 'File', menus: [
      { icon: '', name: 'New', action: 'new' },
      { icon: '', name: 'Open', action: 'open' },
      { icon: '', name: 'Rename', action: 'rename' },
      { icon: '', name: 'Upload', action: 'upload' },
      { icon: '', name: 'Download (.json)', action: 'download' },
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
  }

  onTitleChange() { this.queueSave(); }
  addAnnotation() { this.annotations.push({ text: '' }); this.queueSave(); }
  onAnnChange(i: number, val: string) { this.annotations[i].text = val; this.queueSave(); }

  private queueSave() { if (!this.pdf) return; if (this.pendingSave) clearTimeout(this.pendingSave); this.pendingSave = setTimeout(() => this.save(), 400); }
  private async ensureCreatedId() { if (this.pdf && this.pdf.id === 'new') { const hasTitle = !!this.pdf.title && this.pdf.title.trim().length > 0; const hasAnns = JSON.stringify(this.annotations).length > 2; if (hasTitle || hasAnns) { const created = await this.svc.create({ title: this.pdf.title, annotations: this.annotations }); this.pdf = created; this.router.navigate(['/pdf', created.id], { replaceUrl: true }); } } }
  private async save() { if (!this.pdf) return; await this.ensureCreatedId(); if (!this.pdf) return; this.pdf.annotations = this.annotations; await this.svc.save(this.pdf); }
}
