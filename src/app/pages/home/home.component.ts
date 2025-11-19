import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CoreAuthService } from '@berjis/angular-auth';
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
  private readonly auth = inject(CoreAuthService);
  private readonly pdfs = inject(PdfsService);

  constructor() { this.init(); }
  get syncMode() { return this.pdfs.syncMode; }
  get isSaving() { return this.pdfs.isSaving; }
  get lastSavedAt() { return this.pdfs.lastSavedAt; }
  get lastError() { return this.pdfs.lastError; }
  async init() {
    try {
      const session = await this.auth.ensureAuth({ maxAgeMs: 1500 });
      this.authed = !!session?.valid;
      if (this.authed) { this.recents = await this.pdfs.list(['active']); }
    } catch { this.authed = false; }
  }
}
