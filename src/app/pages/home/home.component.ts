import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../api.service';
import { PdfsService, PdfDoc } from '../../pdfs.service';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html'
})
export class HomePageComponent {
  authed: boolean | null = null;
  recents: PdfDoc[] = [];
  constructor(private api: ApiService, private pdfs: PdfsService) { this.init(); }
  get syncMode() { return this.pdfs.syncMode; }
  get isSaving() { return this.pdfs.isSaving; }
  get lastSavedAt() { return this.pdfs.lastSavedAt; }
  get lastError() { return this.pdfs.lastError; }
  async init() {
    try {
      const res = await this.api.ensureAuth();
      this.authed = !!res?.data?.valid;
      if (this.authed) { this.recents = await this.pdfs.list(['active']); }
    } catch { this.authed = false; }
  }
}
