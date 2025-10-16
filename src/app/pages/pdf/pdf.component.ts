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

  constructor(private route: ActivatedRoute, private router: Router, public svc: PdfsService) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || 'new';
    this.pdf = { id, title: '', annotations: [], status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (id !== 'new') {
      const existing = this.svc.get(id) || await this.svc.fetch(id);
      if (existing) this.pdf = existing; else { this.router.navigate(['/']); return; }
    }
    this.annotations = Array.isArray(this.pdf?.annotations) ? this.pdf!.annotations as any : [];
  }

  onTitleChange(){ this.queueSave(); }
  addAnnotation(){ this.annotations.push({ text: '' }); this.queueSave(); }
  onAnnChange(i:number, val:string){ this.annotations[i].text = val; this.queueSave(); }

  private queueSave(){ if (!this.pdf) return; if (this.pendingSave) clearTimeout(this.pendingSave); this.pendingSave = setTimeout(()=> this.save(), 400); }
  private async ensureCreatedId(){ if (this.pdf && this.pdf.id==='new'){ const hasTitle = !!this.pdf.title && this.pdf.title.trim().length>0; const hasAnns = JSON.stringify(this.annotations).length>2; if (hasTitle || hasAnns){ const created = await this.svc.create({ title: this.pdf.title, annotations: this.annotations }); this.pdf = created; this.router.navigate(['/pdf', created.id], { replaceUrl: true }); } } }
  private async save(){ if (!this.pdf) return; await this.ensureCreatedId(); if (!this.pdf) return; this.pdf.annotations = this.annotations; await this.svc.save(this.pdf); }
}
